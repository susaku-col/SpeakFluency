// ============================================
// SpeakFlow Gamification Module
// XP, Levels, Streaks & Achievements
// ============================================

// ============================================
// Gamification State Management
// ============================================

const GamificationState = {
    isInitialized: false,
    userId: null,
    level: 1,
    xp: 0,
    totalXp: 0,
    xpToNextLevel: 100,
    streak: 0,
    longestStreak: 0,
    badges: [],
    achievements: [],
    dailyGoal: {
        type: 'minutes',
        target: 15,
        current: 0,
        completed: false
    },
    stats: {
        totalLessons: 0,
        totalMinutes: 0,
        perfectLessons: 0,
        totalWordsLearned: 0,
        totalExercisesCorrect: 0,
        totalExercisesIncorrect: 0
    },
    leaderboard: [],
    userRank: 0
};

// ============================================
// Constants
// ============================================

const LEVEL_THRESHOLDS = {
    1: 0, 2: 100, 3: 250, 4: 450, 5: 700,
    6: 1000, 7: 1350, 8: 1750, 9: 2200, 10: 2700,
    11: 3250, 12: 3850, 13: 4500, 14: 5200, 15: 5950,
    16: 6750, 17: 7600, 18: 8500, 19: 9450, 20: 10450,
    21: 11500, 22: 12600, 23: 13750, 24: 14950, 25: 16200
};

const XP_REWARDS = {
    LESSON_COMPLETE: 50,
    PERFECT_LESSON: 100,
    EXERCISE_CORRECT: 10,
    STREAK_BONUS: 25,
    DAILY_LOGIN: 20,
    ACHIEVEMENT_UNLOCK: 100,
    BADGE_EARNED: 50,
    LEVEL_UP: 200,
    SHARE_ACHIEVEMENT: 15,
    REFERRAL: 100
};

const STREAK_BONUSES = {
    7: { xp: 100, badge: 'week_warrior' },
    14: { xp: 250, badge: 'fortnight_champion' },
    30: { xp: 500, badge: 'monthly_master' },
    60: { xp: 1000, badge: 'two_month_legend' },
    90: { xp: 2000, badge: 'quarter_king' },
    180: { xp: 5000, badge: 'half_year_hero' },
    365: { xp: 10000, badge: 'yearly_yoda' }
};

// ============================================
// Helper Functions
// ============================================

/**
 * Get user ID from auth
 */
const getUserId = () => {
    return auth?.user?.id || localStorage.getItem('user_id') || null;
};

/**
 * Show toast notification
 */
const showToast = (message, type = 'info', title = null) => {
    if (window.showToast) {
        window.showToast(message, type, title);
    } else {
        console.log(`[Gamification] ${type}: ${message}`);
    }
};

/**
 * Play sound effect
 */
const playSound = (soundName) => {
    const audio = new Audio(`/audio/${soundName}.mp3`);
    audio.volume = 0.5;
    audio.play().catch(e => console.log('Audio play failed:', e));
};

/**
 * Format number with abbreviation
 */
const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
};

// ============================================
// API Calls
// ============================================

/**
 * Fetch user gamification data
 */
const fetchGamificationData = async () => {
    try {
        const response = await fetch('/api/gamification/profile', {
            headers: {
                'Authorization': `Bearer ${auth?.token || ''}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            updateState(data.data);
            return data.data;
        }
        return null;
    } catch (error) {
        console.error('Fetch gamification error:', error);
        loadFromLocalStorage();
        return GamificationState;
    }
};

/**
 * Update streak
 */
const updateStreak = async () => {
    try {
        const response = await fetch('/api/gamification/streak', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${auth?.token || ''}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            if (data.data.streakBonus > 0) {
                showStreakBonus(data.data);
            }
            GamificationState.streak = data.data.streak;
            GamificationState.longestStreak = data.data.longestStreak;
            saveToLocalStorage();
            updateUI();
            return data.data;
        }
        return null;
    } catch (error) {
        console.error('Update streak error:', error);
        return null;
    }
};

/**
 * Claim daily reward
 */
const claimDailyReward = async () => {
    try {
        const response = await fetch('/api/gamification/claim-daily', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${auth?.token || ''}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showDailyReward(data.data);
            await addXP(data.data.xp, 'daily_login');
            return data.data;
        }
        return null;
    } catch (error) {
        console.error('Claim daily reward error:', error);
        return null;
    }
};

/**
 * Add XP
 */
const addXP = async (amount, source) => {
    try {
        const response = await fetch('/api/gamification/add-xp', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${auth?.token || ''}`
            },
            body: JSON.stringify({ amount, source })
        });
        
        const data = await response.json();
        
        if (data.success) {
            const oldLevel = GamificationState.level;
            GamificationState.xp = data.data.newXp;
            GamificationState.totalXp = data.data.totalXp;
            GamificationState.level = data.data.newLevel;
            GamificationState.xpToNextLevel = data.data.xpToNextLevel;
            
            if (data.data.leveledUp) {
                showLevelUp(oldLevel, data.data.newLevel);
                playSound('level-up');
            }
            
            updateUI();
            saveToLocalStorage();
            
            // Show XP notification
            showXPNotification(amount, source);
            
            return data.data;
        }
        return null;
    } catch (error) {
        console.error('Add XP error:', error);
        return null;
    }
};

/**
 * Update user stats
 */
const updateStats = async (statType, value = 1) => {
    try {
        const response = await fetch('/api/gamification/stats', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${auth?.token || ''}`
            },
            body: JSON.stringify({ statType, value })
        });
        
        const data = await response.json();
        
        if (data.success) {
            GamificationState.stats = data.data;
            updateUI();
            saveToLocalStorage();
            
            // Check for achievements
            checkAchievements();
            
            return data.data;
        }
        return null;
    } catch (error) {
        console.error('Update stats error:', error);
        return null;
    }
};

/**
 * Fetch leaderboard
 */
const fetchLeaderboard = async (type = 'xp', limit = 50) => {
    try {
        const response = await fetch(`/api/gamification/leaderboard?type=${type}&limit=${limit}`, {
            headers: {
                'Authorization': `Bearer ${auth?.token || ''}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            GamificationState.leaderboard = data.data.leaderboard;
            GamificationState.userRank = data.data.userRank;
            return data.data;
        }
        return null;
    } catch (error) {
        console.error('Fetch leaderboard error:', error);
        return null;
    }
};

// ============================================
// State Management
// ============================================

/**
 * Update state from API data
 */
const updateState = (data) => {
    GamificationState.level = data.level;
    GamificationState.xp = data.xp;
    GamificationState.totalXp = data.totalXp;
    GamificationState.xpToNextLevel = data.xpToNextLevel;
    GamificationState.streak = data.streak;
    GamificationState.longestStreak = data.longestStreak;
    GamificationState.badges = data.badges || [];
    GamificationState.achievements = data.achievements || [];
    GamificationState.stats = data.stats || GamificationState.stats;
    if (data.dailyGoal) {
        GamificationState.dailyGoal = data.dailyGoal;
    }
    saveToLocalStorage();
};

/**
 * Save to localStorage
 */
const saveToLocalStorage = () => {
    localStorage.setItem('gamification_state', JSON.stringify({
        level: GamificationState.level,
        xp: GamificationState.xp,
        totalXp: GamificationState.totalXp,
        streak: GamificationState.streak,
        longestStreak: GamificationState.longestStreak,
        badges: GamificationState.badges,
        achievements: GamificationState.achievements,
        stats: GamificationState.stats,
        dailyGoal: GamificationState.dailyGoal
    }));
};

/**
 * Load from localStorage
 */
const loadFromLocalStorage = () => {
    const saved = localStorage.getItem('gamification_state');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            Object.assign(GamificationState, data);
        } catch (e) {
            console.error('Error loading gamification state:', e);
        }
    }
};

// ============================================
// Achievement Checking
// ============================================

/**
 * Check and unlock achievements
 */
const checkAchievements = () => {
    const stats = GamificationState.stats;
    const newAchievements = [];
    
    // Lesson count achievements
    if (stats.totalLessons >= 1 && !hasAchievement('first_lesson')) {
        unlockAchievement('first_lesson', 'First Step', 'Complete your first lesson', '🎯');
        newAchievements.push('first_lesson');
    }
    if (stats.totalLessons >= 10 && !hasAchievement('ten_lessons')) {
        unlockAchievement('ten_lessons', 'Dedicated Learner', 'Complete 10 lessons', '📚');
        newAchievements.push('ten_lessons');
    }
    if (stats.totalLessons >= 50 && !hasAchievement('fifty_lessons')) {
        unlockAchievement('fifty_lessons', 'Language Enthusiast', 'Complete 50 lessons', '⭐');
        newAchievements.push('fifty_lessons');
    }
    if (stats.totalLessons >= 100 && !hasAchievement('hundred_lessons')) {
        unlockAchievement('hundred_lessons', 'Master', 'Complete 100 lessons', '🏆');
        newAchievements.push('hundred_lessons');
    }
    
    // Perfect score achievements
    if (stats.perfectLessons >= 1 && !hasAchievement('perfect_score')) {
        unlockAchievement('perfect_score', 'Perfectionist', 'Get a perfect score in a lesson', '💯');
        newAchievements.push('perfect_score');
    }
    
    // Vocabulary achievements
    if (stats.totalWordsLearned >= 500 && !hasAchievement('vocabulary_master')) {
        unlockAchievement('vocabulary_master', 'Vocabulary Master', 'Learn 500 words', '📖');
        newAchievements.push('vocabulary_master');
    }
    if (stats.totalWordsLearned >= 2000 && !hasAchievement('vocabulary_guru')) {
        unlockAchievement('vocabulary_guru', 'Vocabulary Guru', 'Learn 2000 words', '📚');
        newAchievements.push('vocabulary_guru');
    }
    
    // Streak achievements
    if (GamificationState.streak >= 7 && !hasAchievement('week_warrior')) {
        unlockAchievement('week_warrior', 'Week Warrior', '7-day learning streak', '🔥');
        newAchievements.push('week_warrior');
    }
    if (GamificationState.streak >= 30 && !hasAchievement('monthly_master')) {
        unlockAchievement('monthly_master', 'Monthly Master', '30-day learning streak', '📅');
        newAchievements.push('monthly_master');
    }
    
    if (newAchievements.length > 0) {
        updateUI();
    }
};

/**
 * Check if user has achievement
 */
const hasAchievement = (achievementId) => {
    return GamificationState.achievements.some(a => a.id === achievementId);
};

/**
 * Unlock achievement
 */
const unlockAchievement = async (id, name, description, icon) => {
    const achievement = {
        id,
        name,
        description,
        icon,
        earnedAt: new Date().toISOString()
    };
    
    GamificationState.achievements.push(achievement);
    await addXP(XP_REWARDS.ACHIEVEMENT_UNLOCK, `achievement_${id}`);
    showAchievementUnlocked(achievement);
    playSound('achievement');
    saveToLocalStorage();
};

// ============================================
// UI Updates
// ============================================

/**
 * Update UI
 */
const updateUI = () => {
    updateLevelProgress();
    updateStreakDisplay();
    updateStatsDisplay();
    updateBadgesDisplay();
    updateAchievementsDisplay();
};

/**
 * Update level progress bar
 */
const updateLevelProgress = () => {
    const levelElem = document.getElementById('user-level');
    const xpElem = document.getElementById('user-xp');
    const xpProgress = document.getElementById('xp-progress');
    const xpText = document.getElementById('xp-text');
    
    if (levelElem) levelElem.textContent = GamificationState.level;
    if (xpElem) xpElem.textContent = formatNumber(GamificationState.totalXp);
    
    if (xpProgress && xpText) {
        const xpInLevel = GamificationState.xp - (LEVEL_THRESHOLDS[GamificationState.level] || 0);
        const xpNeeded = GamificationState.xpToNextLevel;
        const percentage = (xpInLevel / xpNeeded) * 100;
        xpProgress.style.width = `${percentage}%`;
        xpText.textContent = `${xpInLevel} / ${xpNeeded} XP`;
    }
};

/**
 * Update streak display
 */
const updateStreakDisplay = () => {
    const streakElem = document.getElementById('current-streak');
    const longestStreakElem = document.getElementById('longest-streak');
    
    if (streakElem) streakElem.textContent = GamificationState.streak;
    if (longestStreakElem) longestStreakElem.textContent = GamificationState.longestStreak;
    
    // Update streak flame
    const streakFlame = document.getElementById('streak-flame');
    if (streakFlame) {
        if (GamificationState.streak >= 7) {
            streakFlame.textContent = '🔥';
            streakFlame.classList.add('active');
        } else {
            streakFlame.textContent = '🕯️';
            streakFlame.classList.remove('active');
        }
    }
    
    // Update next streak bonus
    const nextBonus = Object.keys(STREAK_BONUSES).find(b => parseInt(b) > GamificationState.streak);
    const nextBonusElem = document.getElementById('next-streak-bonus');
    if (nextBonusElem && nextBonus) {
        nextBonusElem.textContent = `${nextBonus} days: +${STREAK_BONUSES[nextBonus].xp} XP`;
    }
};

/**
 * Update stats display
 */
const updateStatsDisplay = () => {
    const stats = GamificationState.stats;
    
    const lessonsElem = document.getElementById('total-lessons');
    const minutesElem = document.getElementById('total-minutes');
    const perfectElem = document.getElementById('perfect-lessons');
    const wordsElem = document.getElementById('total-words');
    const accuracyElem = document.getElementById('accuracy-rate');
    
    if (lessonsElem) lessonsElem.textContent = stats.totalLessons;
    if (minutesElem) minutesElem.textContent = stats.totalMinutes;
    if (perfectElem) perfectElem.textContent = stats.perfectLessons;
    if (wordsElem) wordsElem.textContent = stats.totalWordsLearned;
    
    if (accuracyElem) {
        const total = stats.totalExercisesCorrect + stats.totalExercisesIncorrect;
        const accuracy = total > 0 ? (stats.totalExercisesCorrect / total) * 100 : 0;
        accuracyElem.textContent = `${Math.round(accuracy)}%`;
    }
    
    // Update daily goal
    updateDailyGoalDisplay();
};

/**
 * Update daily goal display
 */
const updateDailyGoalDisplay = () => {
    const goal = GamificationState.dailyGoal;
    const progressElem = document.getElementById('daily-goal-progress');
    const progressText = document.getElementById('daily-goal-text');
    
    if (progressElem && progressText) {
        const percentage = (goal.current / goal.target) * 100;
        progressElem.style.width = `${Math.min(100, percentage)}%`;
        progressText.textContent = `${goal.current} / ${goal.target} ${goal.type}`;
        
        if (goal.completed && !goal.notified) {
            showDailyGoalComplete();
            goal.notified = true;
        }
    }
};

/**
 * Update badges display
 */
const updateBadgesDisplay = () => {
    const container = document.getElementById('badges-container');
    if (!container) return;
    
    if (GamificationState.badges.length === 0) {
        container.innerHTML = '<p class="empty-state">Complete achievements to earn badges!</p>';
        return;
    }
    
    container.innerHTML = `
        <div class="badges-grid">
            ${GamificationState.badges.map(badge => `
                <div class="badge-card" title="${badge.description}">
                    <div class="badge-icon">${badge.icon}</div>
                    <div class="badge-name">${badge.name}</div>
                    <div class="badge-date">${new Date(badge.earnedAt).toLocaleDateString()}</div>
                </div>
            `).join('')}
        </div>
    `;
};

/**
 * Update achievements display
 */
const updateAchievementsDisplay = () => {
    const container = document.getElementById('achievements-container');
    if (!container) return;
    
    if (GamificationState.achievements.length === 0) {
        container.innerHTML = '<p class="empty-state">Complete lessons to earn achievements!</p>';
        return;
    }
    
    container.innerHTML = `
        <div class="achievements-grid">
            ${GamificationState.achievements.map(ach => `
                <div class="achievement-card">
                    <div class="achievement-icon">${ach.icon}</div>
                    <div class="achievement-name">${ach.name}</div>
                    <div class="achievement-description">${ach.description}</div>
                    <div class="achievement-date">${new Date(ach.earnedAt).toLocaleDateString()}</div>
                </div>
            `).join('')}
        </div>
    `;
};

/**
 * Update leaderboard display
 */
const updateLeaderboardDisplay = () => {
    const container = document.getElementById('leaderboard-container');
    if (!container) return;
    
    if (GamificationState.leaderboard.length === 0) {
        container.innerHTML = '<p class="empty-state">No data available</p>';
        return;
    }
    
    container.innerHTML = `
        <div class="leaderboard">
            <div class="leaderboard-header">
                <span>Rank</span>
                <span>User</span>
                <span>Level</span>
                <span>XP</span>
            </div>
            ${GamificationState.leaderboard.map(entry => `
                <div class="leaderboard-item ${entry.userId === GamificationState.userId ? 'current-user' : ''}">
                    <span class="rank">${entry.rank}</span>
                    <span class="name">${entry.userName}</span>
                    <span class="level">${entry.level}</span>
                    <span class="xp">${formatNumber(entry.xp)}</span>
                </div>
            `).join('')}
        </div>
    `;
    
    // Show user rank
    const userRankElem = document.getElementById('user-rank');
    if (userRankElem && GamificationState.userRank) {
        userRankElem.textContent = `#${GamificationState.userRank}`;
    }
};

// ============================================
// Notifications & Animations
// ============================================

/**
 * Show XP notification
 */
const showXPNotification = (amount, source) => {
    const notification = document.createElement('div');
    notification.className = 'xp-notification';
    notification.innerHTML = `
        <span class="xp-icon">⭐</span>
        <span class="xp-amount">+${amount} XP</span>
        <span class="xp-source">${source.replace(/_/g, ' ')}</span>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
};

/**
 * Show level up animation
 */
const showLevelUp = (oldLevel, newLevel) => {
    const modal = document.createElement('div');
    modal.className = 'modal level-up-modal active';
    modal.innerHTML = `
        <div class="modal-content level-up-content">
            <div class="level-up-animation">
                <div class="level-up-icon">🎉</div>
                <h2>LEVEL UP!</h2>
                <div class="level-numbers">
                    <span class="old-level">${oldLevel}</span>
                    <span class="arrow">→</span>
                    <span class="new-level">${newLevel}</span>
                </div>
                <p>You've reached Level ${newLevel}!</p>
                <button class="btn btn-primary" onclick="this.closest('.modal').remove()">Continue</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    setTimeout(() => {
        const closeBtn = modal.querySelector('button');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.classList.remove('active');
                setTimeout(() => modal.remove(), 300);
            });
        }
    }, 100);
};

/**
 * Show achievement unlocked notification
 */
const showAchievementUnlocked = (achievement) => {
    const notification = document.createElement('div');
    notification.className = 'achievement-notification';
    notification.innerHTML = `
        <div class="achievement-icon">${achievement.icon}</div>
        <div class="achievement-info">
            <div class="achievement-title">Achievement Unlocked!</div>
            <div class="achievement-name">${achievement.name}</div>
            <div class="achievement-desc">${achievement.description}</div>
        </div>
        <div class="achievement-xp">+${XP_REWARDS.ACHIEVEMENT_UNLOCK} XP</div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
        playSound('achievement');
    }, 100);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 500);
    }, 5000);
};

/**
 * Show streak bonus notification
 */
const showStreakBonus = (bonus) => {
    const notification = document.createElement('div');
    notification.className = 'streak-bonus-notification';
    notification.innerHTML = `
        <div class="streak-icon">🔥</div>
        <div class="streak-info">
            <div class="streak-title">Streak Bonus!</div>
            <div class="streak-days">${bonus.streak} Day Streak</div>
            <div class="streak-xp">+${bonus.xpBonus} XP</div>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
        playSound('level-up');
    }, 100);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 500);
    }, 4000);
};

/**
 * Show daily reward
 */
const showDailyReward = (reward) => {
    const modal = document.createElement('div');
    modal.className = 'modal daily-reward-modal active';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="daily-reward-icon">🎁</div>
            <h3>Daily Reward!</h3>
            <p>You've claimed your daily login bonus!</p>
            <div class="reward-amount">+${reward.xp} XP</div>
            <button class="btn btn-primary" onclick="this.closest('.modal').remove()">Great!</button>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    setTimeout(() => {
        const closeBtn = modal.querySelector('button');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.classList.remove('active');
                setTimeout(() => modal.remove(), 300);
            });
        }
    }, 100);
};

/**
 * Show daily goal complete
 */
const showDailyGoalComplete = () => {
    const notification = document.createElement('div');
    notification.className = 'daily-goal-notification';
    notification.innerHTML = `
        <div class="goal-icon">✅</div>
        <div class="goal-info">
            <div class="goal-title">Daily Goal Completed!</div>
            <div class="goal-reward">+${XP_REWARDS.COMPLETE_DAILY_GOAL} XP</div>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
        playSound('achievement');
    }, 100);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 500);
    }, 4000);
};

// ============================================
// Dashboard Rendering
// ============================================

/**
 * Render gamification dashboard
 */
const renderDashboard = () => {
    const container = document.getElementById('gamification-dashboard');
    if (!container) return;
    
    container.innerHTML = `
        <div class="gamification-header">
            <div class="level-card">
                <div class="level-badge">Level ${GamificationState.level}</div>
                <div class="xp-bar">
                    <div class="xp-progress" id="xp-progress" style="width: 0%"></div>
                </div>
                <div class="xp-text" id="xp-text"></div>
                <div class="total-xp">Total XP: <span id="user-xp">${formatNumber(GamificationState.totalXp)}</span></div>
            </div>
            
            <div class="streak-card">
                <div class="streak-icon" id="streak-flame">🕯️</div>
                <div class="streak-info">
                    <div class="current-streak"><span id="current-streak">${GamificationState.streak}</span> day streak</div>
                    <div class="longest-streak">Best: <span id="longest-streak">${GamificationState.longestStreak}</span></div>
                    <div class="next-bonus" id="next-streak-bonus"></div>
                </div>
            </div>
        </div>
        
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value" id="total-lessons">${GamificationState.stats.totalLessons}</div>
                <div class="stat-label">Lessons</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="total-minutes">${GamificationState.stats.totalMinutes}</div>
                <div class="stat-label">Minutes</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="perfect-lessons">${GamificationState.stats.perfectLessons}</div>
                <div class="stat-label">Perfect</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="total-words">${GamificationState.stats.totalWordsLearned}</div>
                <div class="stat-label">Words</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="accuracy-rate">${Math.round((GamificationState.stats.totalExercisesCorrect / (GamificationState.stats.totalExercisesCorrect + GamificationState.stats.totalExercisesIncorrect)) * 100)}%</div>
                <div class="stat-label">Accuracy</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="user-rank">#${GamificationState.userRank || '?'}</div>
                <div class="stat-label">Global Rank</div>
            </div>
        </div>
        
        <div class="daily-goal-section">
            <h3>Daily Goal</h3>
            <div class="daily-goal-bar">
                <div class="goal-progress" id="daily-goal-progress" style="width: 0%"></div>
            </div>
            <div class="goal-text" id="daily-goal-text"></div>
        </div>
        
        <div class="badges-section">
            <h3>Badges</h3>
            <div id="badges-container" class="badges-container"></div>
        </div>
        
        <div class="achievements-section">
            <h3>Achievements</h3>
            <div id="achievements-container" class="achievements-container"></div>
        </div>
        
        <div class="leaderboard-section">
            <h3>Leaderboard</h3>
            <div id="leaderboard-container" class="leaderboard-container"></div>
        </div>
    `;
    
    updateUI();
};

// ============================================
// Event Handlers
// ============================================

/**
 * Handle lesson completion
 */
const onLessonComplete = async (score, isPerfect = false) => {
    await updateStats('lesson_complete');
    await addXP(XP_REWARDS.LESSON_COMPLETE, 'lesson_complete');
    
    if (isPerfect) {
        await updateStats('perfect_lesson');
        await addXP(XP_REWARDS.PERFECT_LESSON, 'perfect_lesson');
    }
    
    await updateStreak();
    await checkAchievements();
};

/**
 * Handle exercise completion
 */
const onExerciseComplete = async (isCorrect) => {
    if (isCorrect) {
        await updateStats('exercise_correct');
        await addXP(XP_REWARDS.EXERCISE_CORRECT, 'exercise_correct');
    } else {
        await updateStats('exercise_incorrect');
    }
};

/**
 * Handle word learned
 */
const onWordLearned = async (word) => {
    await updateStats('word_learned');
};

/**
 * Handle minutes practiced
 */
const onMinutesPracticed = async (minutes) => {
    await updateStats('minutes_practiced', minutes);
};

// ============================================
// Initialization
// ============================================

/**
 * Initialize gamification module
 */
const initGamification = async () => {
    if (GamificationState.isInitialized) return;
    
    console.log('Initializing gamification module...');
    
    GamificationState.userId = getUserId();
    
    // Load data
    loadFromLocalStorage();
    await fetchGamificationData();
    await fetchLeaderboard();
    
    // Render dashboard
    renderDashboard();
    
    // Setup event listeners for daily claim
    const claimBtn = document.getElementById('claim-daily-btn');
    if (claimBtn) {
        claimBtn.addEventListener('click', claimDailyReward);
    }
    
    GamificationState.isInitialized = true;
    
    console.log('Gamification module initialized');
};

// ============================================
// Export Gamification Module
// ============================================

const gamification = {
    // State
    get isInitialized() { return GamificationState.isInitialized; },
    get level() { return GamificationState.level; },
    get xp() { return GamificationState.xp; },
    get streak() { return GamificationState.streak; },
    get badges() { return GamificationState.badges; },
    get achievements() { return GamificationState.achievements; },
    
    // API methods
    addXP,
    updateStreak,
    claimDailyReward,
    fetchLeaderboard,
    
    // Event handlers
    onLessonComplete,
    onExerciseComplete,
    onWordLearned,
    onMinutesPracticed,
    
    // UI
    renderDashboard,
    
    // Initialize
    init: initGamification
};

// Make gamification globally available
window.gamification = gamification;

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGamification);
} else {
    initGamification();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = gamification;
}
