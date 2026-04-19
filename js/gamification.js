/* ============================================
   SPEAKFLOW - GAMIFICATION MODULE
   Version: 1.0.0
   Handles XP, levels, streaks, achievements, and rewards
   ============================================ */

// ============================================
// GAMIFICATION CONFIGURATION
// ============================================

const GamificationConfig = {
    // XP Settings
    xp: {
        practiceComplete: 10,
        perfectScore: 25,
        streakBonus: {
            3: 30,
            7: 100,
            14: 250,
            30: 500,
            100: 1000
        },
        achievementComplete: 50,
        dailyChallengeComplete: 30,
        shareProgress: 10,
        referFriend: 50,
        levelUpBonus: 100
    },
    
    // Level Settings
    level: {
        baseXP: 100,
        exponent: 1.5,
        maxLevel: 100
    },
    
    // Streak Settings
    streak: {
        maxStreakBonus: 7,
        freezeEnabled: true,
        freezeCost: 50,
        maxFreezes: 3
    },
    
    // Achievement Categories
    categories: {
        practice: 'practice',
        streak: 'streak',
        mastery: 'mastery',
        social: 'social',
        premium: 'premium',
        special: 'special'
    },
    
    // Reward Types
    rewardTypes: {
        xp: 'xp',
        streakFreeze: 'streak_freeze',
        premiumDays: 'premium_days',
        avatar: 'avatar',
        title: 'title',
        badge: 'badge'
    },
    
    // Storage Keys
    storage: {
        profile: 'gamification_profile',
        achievements: 'gamification_achievements',
        rewards: 'gamification_rewards'
    }
};

// ============================================
// XP & LEVEL SYSTEM
// ============================================

class XPLevelSystem {
    constructor() {
        this.profile = this.loadProfile();
        this.levelUpCallbacks = [];
    }
    
    loadProfile() {
        const saved = localStorage.getItem(GamificationConfig.storage.profile);
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error('Failed to load profile:', e);
            }
        }
        
        return {
            xp: 0,
            level: 1,
            totalXP: 0,
            levelHistory: [],
            lastUpdated: new Date().toISOString()
        };
    }
    
    saveProfile() {
        localStorage.setItem(GamificationConfig.storage.profile, JSON.stringify(this.profile));
    }
    
    calculateXPForLevel(level) {
        return Math.floor(
            GamificationConfig.level.baseXP * Math.pow(level, GamificationConfig.level.exponent)
        );
    }
    
    getXPForNextLevel() {
        return this.calculateXPForLevel(this.profile.level + 1);
    }
    
    getXPForCurrentLevel() {
        return this.calculateXPForLevel(this.profile.level);
    }
    
    getProgressToNextLevel() {
        const currentLevelXP = this.getXPForCurrentLevel();
        const nextLevelXP = this.getXPForNextLevel();
        const xpInCurrentLevel = this.profile.xp - currentLevelXP;
        const xpNeeded = nextLevelXP - currentLevelXP;
        
        return {
            current: xpInCurrentLevel,
            needed: xpNeeded,
            percentage: (xpInCurrentLevel / xpNeeded) * 100
        };
    }
    
    addXP(amount, source = 'practice') {
        const oldLevel = this.profile.level;
        
        this.profile.xp += amount;
        this.profile.totalXP += amount;
        
        // Check for level ups
        let levelUps = [];
        while (this.profile.xp >= this.getXPForNextLevel()) {
            this.profile.level++;
            levelUps.push(this.profile.level);
            
            // Add level up bonus XP
            this.profile.xp += GamificationConfig.xp.levelUpBonus;
            
            // Record level up
            this.profile.levelHistory.push({
                level: this.profile.level,
                timestamp: new Date().toISOString(),
                xp: this.profile.xp
            });
        }
        
        this.profile.lastUpdated = new Date().toISOString();
        this.saveProfile();
        
        // Dispatch events
        const event = new CustomEvent('gamification:xpGain', {
            detail: { amount, source, newXP: this.profile.xp, totalXP: this.profile.totalXP }
        });
        document.dispatchEvent(event);
        
        // Dispatch level up events
        for (const newLevel of levelUps) {
            const levelUpEvent = new CustomEvent('gamification:levelUp', {
                detail: { oldLevel, newLevel, xp: this.profile.xp }
            });
            document.dispatchEvent(levelUpEvent);
            
            // Call callbacks
            this.levelUpCallbacks.forEach(cb => cb(oldLevel, newLevel));
        }
        
        return {
            xpGained: amount,
            newXP: this.profile.xp,
            levelUps,
            currentLevel: this.profile.level
        };
    }
    
    onLevelUp(callback) {
        this.levelUpCallbacks.push(callback);
    }
    
    getProfile() {
        return { ...this.profile };
    }
    
    getStats() {
        const progress = this.getProgressToNextLevel();
        
        return {
            level: this.profile.level,
            xp: this.profile.xp,
            totalXP: this.profile.totalXP,
            nextLevelXP: this.getXPForNextLevel(),
            currentLevelXP: this.getXPForCurrentLevel(),
            progressPercentage: progress.percentage,
            xpToNextLevel: progress.needed
        };
    }
}

// ============================================
// STREAK SYSTEM
// ============================================

class StreakSystem {
    constructor(xpSystem) {
        this.xpSystem = xpSystem;
        this.streak = this.loadStreak();
        this.freezes = this.loadFreezes();
    }
    
    loadStreak() {
        const saved = localStorage.getItem('gamification_streak');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error('Failed to load streak:', e);
            }
        }
        
        return {
            current: 0,
            longest: 0,
            lastPracticeDate: null,
            lastUpdated: null
        };
    }
    
    loadFreezes() {
        const saved = localStorage.getItem('gamification_freezes');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error('Failed to load freezes:', e);
            }
        }
        
        return {
            available: 0,
            used: 0,
            history: []
        };
    }
    
    saveStreak() {
        localStorage.setItem('gamification_streak', JSON.stringify(this.streak));
    }
    
    saveFreezes() {
        localStorage.setItem('gamification_freezes', JSON.stringify(this.freezes));
    }
    
    updateStreak() {
        const today = new Date().toDateString();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toDateString();
        
        // Check if already updated today
        if (this.streak.lastPracticeDate === today) {
            return { streak: this.streak.current, increased: false };
        }
        
        let increased = false;
        
        if (this.streak.lastPracticeDate === yesterdayStr) {
            // Continue streak
            this.streak.current++;
            increased = true;
        } else if (this.streak.lastPracticeDate !== today) {
            // Streak broken or first practice
            if (this.streak.lastPracticeDate && this.streak.current > 0) {
                // Check if can use streak freeze
                if (this.canUseFreeze()) {
                    this.useFreeze();
                } else {
                    this.streak.current = 1;
                }
            } else {
                this.streak.current = 1;
            }
            increased = true;
        }
        
        // Update longest streak
        if (this.streak.current > this.streak.longest) {
            this.streak.longest = this.streak.current;
        }
        
        this.streak.lastPracticeDate = today;
        this.streak.lastUpdated = new Date().toISOString();
        this.saveStreak();
        
        // Apply streak bonus if applicable
        if (increased && GamificationConfig.xp.streakBonus[this.streak.current]) {
            const bonus = GamificationConfig.xp.streakBonus[this.streak.current];
            this.xpSystem.addXP(bonus, `streak_bonus_${this.streak.current}`);
            
            const event = new CustomEvent('gamification:streakBonus', {
                detail: { streak: this.streak.current, bonus }
            });
            document.dispatchEvent(event);
        }
        
        const event = new CustomEvent('gamification:streakUpdate', {
            detail: { streak: this.streak.current, longest: this.streak.longest, increased }
        });
        document.dispatchEvent(event);
        
        return { streak: this.streak.current, increased, longest: this.streak.longest };
    }
    
    canUseFreeze() {
        return GamificationConfig.streak.freezeEnabled && 
               this.freezes.available > 0 &&
               this.freezes.used < GamificationConfig.streak.maxFreezes;
    }
    
    useFreeze() {
        if (!this.canUseFreeze()) return false;
        
        this.freezes.available--;
        this.freezes.used++;
        this.freezes.history.push({
            date: new Date().toISOString(),
            streakSaved: this.streak.current
        });
        
        this.saveFreezes();
        
        const event = new CustomEvent('gamification:freezeUsed', {
            detail: { remaining: this.freezes.available }
        });
        document.dispatchEvent(event);
        
        return true;
    }
    
    addFreeze() {
        if (this.freezes.available < GamificationConfig.streak.maxFreezes) {
            this.freezes.available++;
            this.saveFreezes();
            
            const event = new CustomEvent('gamification:freezeAdded', {
                detail: { available: this.freezes.available }
            });
            document.dispatchEvent(event);
            
            return true;
        }
        return false;
    }
    
    getStreak() {
        return { ...this.streak };
    }
    
    getFreezes() {
        return { ...this.freezes };
    }
}

// ============================================
// ACHIEVEMENT SYSTEM
// ============================================

class AchievementSystem {
    constructor(xpSystem, streakSystem) {
        this.xpSystem = xpSystem;
        this.streakSystem = streakSystem;
        this.achievements = this.loadAchievements();
        this.initAchievements();
    }
    
    initAchievements() {
        if (this.achievements.length === 0) {
            this.achievements = this.getDefaultAchievements();
            this.saveAchievements();
        }
    }
    
    getDefaultAchievements() {
        return [
            // Practice Achievements
            { id: 'first_practice', name: 'First Step', description: 'Complete your first practice session', category: GamificationConfig.categories.practice, requirement: { type: 'practice_count', target: 1 }, xpReward: 20, icon: '🎯', unlocked: false, progress: 0 },
            { id: 'practice_10', name: 'Dedicated Learner', description: 'Complete 10 practice sessions', category: GamificationConfig.categories.practice, requirement: { type: 'practice_count', target: 10 }, xpReward: 50, icon: '📚', unlocked: false, progress: 0 },
            { id: 'practice_100', name: 'Practice Master', description: 'Complete 100 practice sessions', category: GamificationConfig.categories.practice, requirement: { type: 'practice_count', target: 100 }, xpReward: 200, icon: '🏆', unlocked: false, progress: 0 },
            { id: 'perfect_score', name: 'Perfect!', description: 'Get a perfect score (100/100)', category: GamificationConfig.categories.practice, requirement: { type: 'perfect_score', target: 1 }, xpReward: 50, icon: '⭐', unlocked: false, progress: 0 },
            
            // Streak Achievements
            { id: 'streak_3', name: 'On Fire!', description: 'Maintain a 3-day streak', category: GamificationConfig.categories.streak, requirement: { type: 'streak', target: 3 }, xpReward: 30, icon: '🔥', unlocked: false, progress: 0 },
            { id: 'streak_7', name: 'Weekly Warrior', description: 'Maintain a 7-day streak', category: GamificationConfig.categories.streak, requirement: { type: 'streak', target: 7 }, xpReward: 100, icon: '📅', unlocked: false, progress: 0 },
            { id: 'streak_30', name: 'Monthly Master', description: 'Maintain a 30-day streak', category: GamificationConfig.categories.streak, requirement: { type: 'streak', target: 30 }, xpReward: 500, icon: '🌙', unlocked: false, progress: 0 },
            { id: 'streak_100', name: 'Legendary', description: 'Maintain a 100-day streak', category: GamificationConfig.categories.streak, requirement: { type: 'streak', target: 100 }, xpReward: 1000, icon: '👑', unlocked: false, progress: 0 },
            
            // Mastery Achievements
            { id: 'level_5', name: 'Rising Star', description: 'Reach level 5', category: GamificationConfig.categories.mastery, requirement: { type: 'level', target: 5 }, xpReward: 50, icon: '⭐', unlocked: false, progress: 0 },
            { id: 'level_10', name: 'Expert', description: 'Reach level 10', category: GamificationConfig.categories.mastery, requirement: { type: 'level', target: 10 }, xpReward: 100, icon: '🌟', unlocked: false, progress: 0 },
            { id: 'level_25', name: 'Master', description: 'Reach level 25', category: GamificationConfig.categories.mastery, requirement: { type: 'level', target: 25 }, xpReward: 250, icon: '🏅', unlocked: false, progress: 0 },
            { id: 'level_50', name: 'Grand Master', description: 'Reach level 50', category: GamificationConfig.categories.mastery, requirement: { type: 'level', target: 50 }, xpReward: 500, icon: '💎', unlocked: false, progress: 0 },
            
            // Vocabulary Achievements
            { id: 'words_10', name: 'Vocabulary Builder', description: 'Master 10 words', category: GamificationConfig.categories.mastery, requirement: { type: 'words_mastered', target: 10 }, xpReward: 50, icon: '📖', unlocked: false, progress: 0 },
            { id: 'words_50', name: 'Word Wizard', description: 'Master 50 words', category: GamificationConfig.categories.mastery, requirement: { type: 'words_mastered', target: 50 }, xpReward: 150, icon: '🔤', unlocked: false, progress: 0 },
            { id: 'words_100', name: 'Lexicon Legend', description: 'Master 100 words', category: GamificationConfig.categories.mastery, requirement: { type: 'words_mastered', target: 100 }, xpReward: 300, icon: '📚', unlocked: false, progress: 0 },
            
            // Social Achievements
            { id: 'share_first', name: 'Social Butterfly', description: 'Share your score for the first time', category: GamificationConfig.categories.social, requirement: { type: 'share_count', target: 1 }, xpReward: 20, icon: '🦋', unlocked: false, progress: 0 },
            { id: 'refer_first', name: 'Community Builder', description: 'Refer your first friend', category: GamificationConfig.categories.social, requirement: { type: 'referral_count', target: 1 }, xpReward: 50, icon: '👥', unlocked: false, progress: 0 },
            
            // Premium Achievements
            { id: 'premium_upgrade', name: 'Premium Member', description: 'Upgrade to Premium', category: GamificationConfig.categories.premium, requirement: { type: 'premium', target: 1 }, xpReward: 200, icon: '💎', unlocked: false, progress: 0 },
            
            // Special Achievements
            { id: 'night_owl', name: 'Night Owl', description: 'Practice after midnight', category: GamificationConfig.categories.special, requirement: { type: 'time_of_day', target: 'night' }, xpReward: 30, icon: '🦉', unlocked: false, progress: 0 },
            { id: 'early_bird', name: 'Early Bird', description: 'Practice before 6 AM', category: GamificationConfig.categories.special, requirement: { type: 'time_of_day', target: 'morning' }, xpReward: 30, icon: '🐦', unlocked: false, progress: 0 }
        ];
    }
    
    loadAchievements() {
        const saved = localStorage.getItem(GamificationConfig.storage.achievements);
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error('Failed to load achievements:', e);
            }
        }
        return [];
    }
    
    saveAchievements() {
        localStorage.setItem(GamificationConfig.storage.achievements, JSON.stringify(this.achievements));
    }
    
    checkAchievement(achievementId, currentValue) {
        const achievement = this.achievements.find(a => a.id === achievementId);
        if (!achievement || achievement.unlocked) return false;
        
        const requirement = achievement.requirement;
        let completed = false;
        
        switch (requirement.type) {
            case 'practice_count':
                completed = currentValue >= requirement.target;
                break;
            case 'streak':
                completed = currentValue >= requirement.target;
                break;
            case 'level':
                completed = currentValue >= requirement.target;
                break;
            case 'perfect_score':
                completed = currentValue >= requirement.target;
                break;
            case 'words_mastered':
                completed = currentValue >= requirement.target;
                break;
            case 'share_count':
                completed = currentValue >= requirement.target;
                break;
            case 'referral_count':
                completed = currentValue >= requirement.target;
                break;
            case 'premium':
                completed = currentValue >= requirement.target;
                break;
        }
        
        if (completed) {
            this.unlockAchievement(achievement);
        }
        
        return completed;
    }
    
    unlockAchievement(achievement) {
        if (achievement.unlocked) return false;
        
        achievement.unlocked = true;
        achievement.unlockedAt = new Date().toISOString();
        
        // Award XP
        this.xpSystem.addXP(achievement.xpReward, `achievement_${achievement.id}`);
        
        this.saveAchievements();
        
        // Dispatch event
        const event = new CustomEvent('gamification:achievementUnlocked', {
            detail: { achievement }
        });
        document.dispatchEvent(event);
        
        return true;
    }
    
    updateProgress(statType, value) {
        let updated = false;
        
        for (const achievement of this.achievements) {
            if (achievement.unlocked) continue;
            
            if (achievement.requirement.type === statType) {
                achievement.progress = Math.min(value, achievement.requirement.target);
                
                if (this.checkAchievement(achievement.id, value)) {
                    updated = true;
                }
            }
        }
        
        this.saveAchievements();
        return updated;
    }
    
    getAchievements() {
        return this.achievements;
    }
    
    getUnlockedAchievements() {
        return this.achievements.filter(a => a.unlocked);
    }
    
    getLockedAchievements() {
        return this.achievements.filter(a => !a.unlocked);
    }
    
    getAchievementsByCategory(category) {
        return this.achievements.filter(a => a.category === category);
    }
    
    getStats() {
        const unlocked = this.getUnlockedAchievements();
        const total = this.achievements.length;
        const totalXP = unlocked.reduce((sum, a) => sum + a.xpReward, 0);
        
        return {
            unlocked: unlocked.length,
            total,
            percentage: (unlocked.length / total) * 100,
            totalXPEarned: totalXP
        };
    }
}

// ============================================
// REWARD SYSTEM
// ============================================

class RewardSystem {
    constructor(xpSystem) {
        this.xpSystem = xpSystem;
        this.rewards = this.loadRewards();
        this.initRewards();
    }
    
    initRewards() {
        if (this.rewards.length === 0) {
            this.rewards = this.getDefaultRewards();
            this.saveRewards();
        }
    }
    
    getDefaultRewards() {
        return [
            { id: 'reward_xp_100', name: 'XP Boost', description: 'Gain 100 bonus XP', type: GamificationConfig.rewardTypes.xp, value: 100, cost: 500, icon: '⚡', available: true },
            { id: 'reward_streak_freeze', name: 'Streak Freeze', description: 'Protect your streak for one day', type: GamificationConfig.rewardTypes.streakFreeze, value: 1, cost: 200, icon: '❄️', available: true },
            { id: 'reward_premium_7', name: '7 Days Premium', description: 'Free Premium for 7 days', type: GamificationConfig.rewardTypes.premiumDays, value: 7, cost: 2000, icon: '💎', available: true },
            { id: 'reward_title_fluent', name: '"Fluent Speaker" Title', description: 'Earn the Fluent Speaker title', type: GamificationConfig.rewardTypes.title, value: 'Fluent Speaker', cost: 1000, icon: '🏷️', available: true },
            { id: 'reward_badge_golden', name: 'Golden Badge', description: 'Special golden profile badge', type: GamificationConfig.rewardTypes.badge, value: 'golden', cost: 1500, icon: '🥇', available: true }
        ];
    }
    
    loadRewards() {
        const saved = localStorage.getItem(GamificationConfig.storage.rewards);
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error('Failed to load rewards:', e);
            }
        }
        return [];
    }
    
    saveRewards() {
        localStorage.setItem(GamificationConfig.storage.rewards, JSON.stringify(this.rewards));
    }
    
    purchaseReward(rewardId, userXP) {
        const reward = this.rewards.find(r => r.id === rewardId);
        if (!reward || !reward.available) {
            return { success: false, error: 'Reward not available' };
        }
        
        if (userXP < reward.cost) {
            return { success: false, error: 'Not enough XP' };
        }
        
        // Deduct XP
        this.xpSystem.addXP(-reward.cost, 'reward_purchase');
        
        // Record purchase
        reward.purchasedAt = new Date().toISOString();
        reward.purchased = true;
        
        this.saveRewards();
        
        const event = new CustomEvent('gamification:rewardPurchased', {
            detail: { reward }
        });
        document.dispatchEvent(event);
        
        return { success: true, reward };
    }
    
    getRewards() {
        return this.rewards;
    }
    
    getAvailableRewards() {
        return this.rewards.filter(r => r.available);
    }
}

// ============================================
// GAMIFICATION UI CONTROLLER
// ============================================

class GamificationUIController {
    constructor(xpSystem, streakSystem, achievementSystem, rewardSystem) {
        this.xpSystem = xpSystem;
        this.streakSystem = streakSystem;
        this.achievementSystem = achievementSystem;
        this.rewardSystem = rewardSystem;
        this.elements = {};
        this.init();
    }
    
    init() {
        this.bindElements();
        this.bindEvents();
        this.renderAll();
        this.setupAnimations();
    }
    
    bindElements() {
        this.elements = {
            xpValue: document.getElementById('xpValue'),
            levelValue: document.getElementById('levelValue'),
            streakValue: document.getElementById('streakValue'),
            nextLevelProgress: document.getElementById('nextLevelProgress'),
            progressFill: document.getElementById('progressFill'),
            achievementsList: document.getElementById('achievementsList'),
            rewardsList: document.getElementById('rewardsList'),
            levelUpModal: document.getElementById('levelUpModal'),
            achievementToast: document.getElementById('achievementToast')
        };
    }
    
    bindEvents() {
        document.addEventListener('gamification:xpGain', (e) => {
            this.showXPGain(e.detail.amount);
            this.renderStats();
        });
        
        document.addEventListener('gamification:levelUp', (e) => {
            this.showLevelUp(e.detail.oldLevel, e.detail.newLevel);
            this.renderStats();
        });
        
        document.addEventListener('gamification:streakUpdate', (e) => {
            this.renderStats();
            if (e.detail.increased) {
                this.showStreakUpdate(e.detail.streak);
            }
        });
        
        document.addEventListener('gamification:achievementUnlocked', (e) => {
            this.showAchievementUnlocked(e.detail.achievement);
            this.renderAchievements();
        });
        
        document.addEventListener('gamification:rewardPurchased', (e) => {
            this.showRewardPurchased(e.detail.reward);
            this.renderRewards();
        });
    }
    
    renderAll() {
        this.renderStats();
        this.renderAchievements();
        this.renderRewards();
    }
    
    renderStats() {
        const stats = this.xpSystem.getStats();
        const streak = this.streakSystem.getStreak();
        
        if (this.elements.xpValue) {
            this.elements.xpValue.textContent = stats.xp;
        }
        
        if (this.elements.levelValue) {
            this.elements.levelValue.textContent = stats.level;
        }
        
        if (this.elements.streakValue) {
            this.elements.streakValue.textContent = streak.current;
        }
        
        if (this.elements.nextLevelProgress) {
            this.elements.nextLevelProgress.textContent = `${stats.xpToNextLevel} XP to next level`;
        }
        
        if (this.elements.progressFill) {
            this.elements.progressFill.style.width = `${stats.progressPercentage}%`;
        }
    }
    
    renderAchievements() {
        if (!this.elements.achievementsList) return;
        
        const achievements = this.achievementSystem.getAchievements();
        const unlocked = achievements.filter(a => a.unlocked);
        const locked = achievements.filter(a => !a.unlocked);
        
        this.elements.achievementsList.innerHTML = `
            <div class="achievements-header">
                <h3>Achievements</h3>
                <span class="achievements-count">${unlocked.length}/${achievements.length}</span>
            </div>
            <div class="achievements-grid">
                ${[...unlocked, ...locked].map(ach => `
                    <div class="achievement-card ${ach.unlocked ? 'unlocked' : 'locked'}" data-id="${ach.id}">
                        <div class="achievement-icon">${ach.icon}</div>
                        <div class="achievement-info">
                            <div class="achievement-name">${ach.name}</div>
                            <div class="achievement-desc">${ach.description}</div>
                            ${!ach.unlocked && ach.progress > 0 ? `
                                <div class="achievement-progress">
                                    <div class="progress-bar">
                                        <div class="progress-fill" style="width: ${(ach.progress / ach.requirement.target) * 100}%"></div>
                                    </div>
                                    <span>${ach.progress}/${ach.requirement.target}</span>
                                </div>
                            ` : ''}
                            ${ach.unlocked ? `
                                <div class="achievement-reward">+${ach.xpReward} XP</div>
                            ` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    renderRewards() {
        if (!this.elements.rewardsList) return;
        
        const stats = this.xpSystem.getStats();
        const rewards = this.rewardSystem.getAvailableRewards();
        
        this.elements.rewardsList.innerHTML = `
            <div class="rewards-header">
                <h3>Rewards Shop</h3>
                <div class="user-xp">💰 ${stats.xp} XP available</div>
            </div>
            <div class="rewards-grid">
                ${rewards.map(reward => `
                    <div class="reward-card" data-id="${reward.id}">
                        <div class="reward-icon">${reward.icon}</div>
                        <div class="reward-info">
                            <div class="reward-name">${reward.name}</div>
                            <div class="reward-desc">${reward.description}</div>
                            <div class="reward-cost">${reward.cost} XP</div>
                            <button class="btn btn-sm purchase-reward" data-id="${reward.id}" ${stats.xp < reward.cost ? 'disabled' : ''}>
                                Purchase
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
        // Attach purchase handlers
        document.querySelectorAll('.purchase-reward').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = btn.dataset.id;
                this.purchaseReward(id);
            });
        });
    }
    
    purchaseReward(rewardId) {
        const stats = this.xpSystem.getStats();
        const result = this.rewardSystem.purchaseReward(rewardId, stats.xp);
        
        if (result.success) {
            this.renderStats();
            this.renderRewards();
            this.showToast(`🎁 Purchased ${result.reward.name}!`, 'success');
        } else {
            this.showToast(result.error, 'error');
        }
    }
    
    showXPGain(amount) {
        const xpElement = this.elements.xpValue;
        if (!xpElement) return;
        
        const floatingXP = document.createElement('div');
        floatingXP.className = 'floating-xp';
        floatingXP.textContent = `+${amount} XP`;
        floatingXP.style.position = 'absolute';
        floatingXP.style.left = `${xpElement.getBoundingClientRect().left}px`;
        floatingXP.style.top = `${xpElement.getBoundingClientRect().top}px`;
        floatingXP.style.animation = 'floatUp 1s ease forwards';
        
        document.body.appendChild(floatingXP);
        
        setTimeout(() => floatingXP.remove(), 1000);
    }
    
    showLevelUp(oldLevel, newLevel) {
        const modal = this.elements.levelUpModal;
        if (modal) {
            modal.innerHTML = `
                <div class="level-up-content">
                    <div class="level-up-icon">🎉</div>
                    <h2>Level Up!</h2>
                    <p>You reached Level ${newLevel}!</p>
                    <div class="level-up-reward">+${GamificationConfig.xp.levelUpBonus} XP Bonus!</div>
                    <button class="btn btn-primary" onclick="this.closest('.level-up-modal').remove()">Continue</button>
                </div>
            `;
            modal.classList.add('show');
            
            setTimeout(() => {
                modal.classList.remove('show');
            }, 3000);
        }
    }
    
    showStreakUpdate(streak) {
        this.showToast(`🔥 ${streak} day streak! Keep it up!`, 'streak');
    }
    
    showAchievementUnlocked(achievement) {
        const toast = this.elements.achievementToast;
        if (toast) {
            toast.innerHTML = `
                <div class="achievement-unlock">
                    <div class="achievement-icon">${achievement.icon}</div>
                    <div class="achievement-info">
                        <div class="achievement-title">Achievement Unlocked!</div>
                        <div class="achievement-name">${achievement.name}</div>
                        <div class="achievement-reward">+${achievement.xpReward} XP</div>
                    </div>
                </div>
            `;
            toast.classList.add('show');
            
            setTimeout(() => {
                toast.classList.remove('show');
            }, 4000);
        }
    }
    
    showRewardPurchased(reward) {
        this.showToast(`🎁 You got ${reward.name}!`, 'success');
    }
    
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `gamification-toast toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => toast.remove(), 3000);
    }
    
    setupAnimations() {
        // Add CSS animations
        const style = document.createElement('style');
        style.textContent = `
            @keyframes floatUp {
                0% {
                    opacity: 1;
                    transform: translateY(0);
                }
                100% {
                    opacity: 0;
                    transform: translateY(-50px);
                }
            }
            
            .floating-xp {
                font-size: 14px;
                font-weight: bold;
                color: var(--color-warning);
                pointer-events: none;
                z-index: 1000;
            }
            
            .gamification-toast {
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                padding: 12px 24px;
                border-radius: 40px;
                color: white;
                font-weight: 600;
                z-index: 1000;
                animation: slideUp 0.3s ease;
            }
            
            .toast-streak {
                background: linear-gradient(135deg, #f59e0b, #ef4444);
            }
            
            .toast-success {
                background: #10b981;
            }
            
            .toast-error {
                background: #ef4444;
            }
            
            .level-up-modal {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 2000;
                opacity: 0;
                visibility: hidden;
                transition: all 0.3s;
            }
            
            .level-up-modal.show {
                opacity: 1;
                visibility: visible;
            }
            
            .level-up-content {
                background: var(--bg-primary);
                border-radius: 40px;
                padding: 40px;
                text-align: center;
                animation: bounceIn 0.5s ease;
            }
            
            @keyframes bounceIn {
                0% {
                    transform: scale(0);
                    opacity: 0;
                }
                50% {
                    transform: scale(1.1);
                }
                100% {
                    transform: scale(1);
                    opacity: 1;
                }
            }
            
            .achievement-card {
                display: flex;
                gap: 16px;
                padding: 16px;
                background: var(--bg-secondary);
                border-radius: 16px;
                margin-bottom: 12px;
           
