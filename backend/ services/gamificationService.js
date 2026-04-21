// ============================================
// Gamification Service
// SpeakFlow - AI Language Learning Platform
// ============================================

const { logger } = require('../middleware/logging');
const { AppError } = require('../middleware/errorHandler');

// ============================================
// Constants & Configuration
// ============================================

// XP thresholds for levels (cumulative XP)
const LEVEL_THRESHOLDS = {
  1: 0,
  2: 100,
  3: 250,
  4: 450,
  5: 700,
  6: 1000,
  7: 1350,
  8: 1750,
  9: 2200,
  10: 2700,
  11: 3250,
  12: 3850,
  13: 4500,
  14: 5200,
  15: 5950,
  16: 6750,
  17: 7600,
  18: 8500,
  19: 9450,
  20: 10450,
  21: 11500,
  22: 12600,
  23: 13750,
  24: 14950,
  25: 16200
};

// XP rewards for different actions
const XP_REWARDS = {
  // Learning actions
  LESSON_COMPLETE: 50,
  PERFECT_LESSON: 100,
  EXERCISE_CORRECT: 10,
  STREAK_BONUS: 25,
  DAILY_LOGIN: 20,
  
  // Practice actions
  PRONUNCIATION_PRACTICE: 30,
  VOCABULARY_PRACTICE: 30,
  GRAMMAR_PRACTICE: 30,
  SPEAKING_PRACTICE: 40,
  LISTENING_PRACTICE: 35,
  
  // Achievement actions
  ACHIEVEMENT_UNLOCK: 100,
  BADGE_EARNED: 50,
  LEVEL_UP: 200,
  
  // Social actions
  SHARE_ACHIEVEMENT: 15,
  REFERRAL: 100,
  REVIEW_LEFT: 25,
  
  // Daily bonuses
  FIRST_LESSON_DAY: 30,
  COMPLETE_DAILY_GOAL: 50,
  WEEKLY_STREAK_BONUS: 150,
  MONTHLY_STREAK_BONUS: 500
};

// Streak bonuses
const STREAK_BONUSES = {
  7: { xp: 100, badge: 'week_warrior' },
  14: { xp: 250, badge: 'fortnight_champion' },
  30: { xp: 500, badge: 'monthly_master' },
  60: { xp: 1000, badge: 'two_month_legend' },
  90: { xp: 2000, badge: 'quarter_king' },
  180: { xp: 5000, badge: 'half_year_hero' },
  365: { xp: 10000, badge: 'yearly_yoda' }
};

// Daily goal types
const DAILY_GOAL_TYPES = {
  LESSONS: 'lessons',
  MINUTES: 'minutes',
  XP: 'xp',
  WORDS: 'words'
};

// Default daily goals
const DEFAULT_DAILY_GOALS = {
  [DAILY_GOAL_TYPES.LESSONS]: 3,
  [DAILY_GOAL_TYPES.MINUTES]: 15,
  [DAILY_GOAL_TYPES.XP]: 100,
  [DAILY_GOAL_TYPES.WORDS]: 10
};

// ============================================
// Mock Data Storage
// ============================================

// User gamification data
const userGamificationData = new Map();

// Daily progress tracking
const dailyProgress = new Map();

// Weekly progress tracking
const weeklyProgress = new Map();

// Monthly progress tracking
const monthlyProgress = new Map();

// Leaderboard cache
const leaderboardCache = new Map();

// ============================================
// Helper Functions
// ============================================

/**
 * Get date key for daily tracking
 */
const getDateKey = (date = new Date()) => {
  return date.toISOString().split('T')[0];
};

/**
 * Get week key for weekly tracking
 */
const getWeekKey = (date = new Date()) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const week = Math.ceil((((d - new Date(year, 0, 1)) / 86400000) + 1) / 7);
  return `${year}-W${week}`;
};

/**
 * Get month key for monthly tracking
 */
const getMonthKey = (date = new Date()) => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

/**
 * Calculate level from XP
 */
const calculateLevel = (xp) => {
  let level = 1;
  for (let i = 1; i <= 25; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) {
      level = i;
    } else {
      break;
    }
  }
  return level;
};

/**
 * Calculate XP needed for next level
 */
const getXpToNextLevel = (currentXp) => {
  const currentLevel = calculateLevel(currentXp);
  const nextLevel = currentLevel + 1;
  
  if (nextLevel > 25) {
    return null; // Max level reached
  }
  
  return LEVEL_THRESHOLDS[nextLevel] - currentXp;
};

/**
 * Get or create user gamification data
 */
const getUserGamificationData = (userId) => {
  if (!userGamificationData.has(userId)) {
    userGamificationData.set(userId, {
      userId,
      level: 1,
      xp: 0,
      totalXp: 0,
      streak: 0,
      longestStreak: 0,
      lastActiveDate: null,
      badges: [],
      achievements: [],
      stats: {
        totalLessons: 0,
        totalMinutes: 0,
        perfectLessons: 0,
        totalWordsLearned: 0,
        totalExercisesCorrect: 0,
        totalExercisesIncorrect: 0
      },
      preferences: {
        dailyGoalType: DAILY_GOAL_TYPES.MINUTES,
        dailyGoalTarget: DEFAULT_DAILY_GOALS[DAILY_GOAL_TYPES.MINUTES],
        notificationsEnabled: true
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }
  
  return userGamificationData.get(userId);
};

/**
 * Update user gamification data
 */
const updateUserGamificationData = (userId, updates) => {
  const userData = getUserGamificationData(userId);
  const updated = { ...userData, ...updates, updatedAt: new Date().toISOString() };
  userGamificationData.set(userId, updated);
  return updated;
};

/**
 * Update daily progress
 */
const updateDailyProgress = (userId, metric, value) => {
  const dateKey = getDateKey();
  
  if (!dailyProgress.has(dateKey)) {
    dailyProgress.set(dateKey, new Map());
  }
  
  const dayProgress = dailyProgress.get(dateKey);
  
  if (!dayProgress.has(userId)) {
    dayProgress.set(userId, {
      userId,
      date: dateKey,
      lessons: 0,
      minutes: 0,
      xp: 0,
      words: 0,
      goalCompleted: false
    });
  }
  
  const userProgress = dayProgress.get(userId);
  
  switch (metric) {
    case DAILY_GOAL_TYPES.LESSONS:
      userProgress.lessons += value;
      break;
    case DAILY_GOAL_TYPES.MINUTES:
      userProgress.minutes += value;
      break;
    case DAILY_GOAL_TYPES.XP:
      userProgress.xp += value;
      break;
    case DAILY_GOAL_TYPES.WORDS:
      userProgress.words += value;
      break;
  }
  
  // Check if daily goal is completed
  const userData = getUserGamificationData(userId);
  const target = userData.preferences.dailyGoalTarget;
  const goalType = userData.preferences.dailyGoalType;
  
  if (!userProgress.goalCompleted && userProgress[goalType] >= target) {
    userProgress.goalCompleted = true;
    userProgress.goalCompletedAt = new Date().toISOString();
    
    // Award daily goal bonus
    addXP(userId, XP_REWARDS.COMPLETE_DAILY_GOAL, 'daily_goal_complete');
  }
  
  dayProgress.set(userId, userProgress);
  dailyProgress.set(dateKey, dayProgress);
  
  return userProgress;
};

// ============================================
// XP & Level Management
// ============================================

/**
 * Add XP to user
 * @param {string} userId - User ID
 * @param {number} amount - XP amount to add
 * @param {string} source - Source of XP (e.g., 'lesson_complete', 'streak_bonus')
 * @returns {Object} XP update result
 */
const addXP = async (userId, amount, source = 'unknown') => {
  const userData = getUserGamificationData(userId);
  const oldLevel = userData.level;
  const newXp = userData.xp + amount;
  const newTotalXp = userData.totalXp + amount;
  const newLevel = calculateLevel(newXp);
  
  const xpData = {
    oldXp: userData.xp,
    newXp,
    amount,
    source,
    leveledUp: newLevel > oldLevel,
    oldLevel,
    newLevel
  };
  
  // Update user data
  userData.xp = newXp;
  userData.totalXp = newTotalXp;
  userData.level = newLevel;
  
  // Update daily progress
  updateDailyProgress(userId, DAILY_GOAL_TYPES.XP, amount);
  
  // Award level up bonus if leveled up
  if (xpData.leveledUp) {
    await addXP(userId, XP_REWARDS.LEVEL_UP, 'level_up');
    xpData.levelUpBonus = XP_REWARDS.LEVEL_UP;
  }
  
  updateUserGamificationData(userId, userData);
  
  logger.info(`XP added to user ${userId}: +${amount} from ${source}`, xpData);
  
  return xpData;
};

/**
 * Get user level and XP information
 * @param {string} userId - User ID
 * @returns {Object} Level and XP info
 */
const getUserLevelInfo = (userId) => {
  const userData = getUserGamificationData(userId);
  
  return {
    level: userData.level,
    currentXp: userData.xp,
    totalXp: userData.totalXp,
    xpToNextLevel: getXpToNextLevel(userData.xp),
    progressPercentage: calculateProgressPercentage(userData.xp, userData.level),
    nextLevelReward: getNextLevelReward(userData.level + 1)
  };
};

/**
 * Calculate progress percentage to next level
 */
const calculateProgressPercentage = (xp, currentLevel) => {
  const currentThreshold = LEVEL_THRESHOLDS[currentLevel];
  const nextThreshold = LEVEL_THRESHOLDS[currentLevel + 1];
  
  if (!nextThreshold) return 100;
  
  const xpInLevel = xp - currentThreshold;
  const xpNeeded = nextThreshold - currentThreshold;
  
  return Math.min(100, Math.floor((xpInLevel / xpNeeded) * 100));
};

/**
 * Get rewards for next level
 */
const getNextLevelReward = (level) => {
  const rewards = {
    2: { xp: 50, badge: 'level_2' },
    5: { xp: 100, badge: 'level_5' },
    10: { xp: 250, badge: 'level_10', title: 'Dedicated Learner' },
    15: { xp: 500, badge: 'level_15', title: 'Advanced Learner' },
    20: { xp: 1000, badge: 'level_20', title: 'Language Master' },
    25: { xp: 2500, badge: 'level_25', title: 'Grand Master' }
  };
  
  return rewards[level] || { xp: 0 };
};

// ============================================
// Streak Management
// ============================================

/**
 * Update user streak
 * @param {string} userId - User ID
 * @returns {Object} Streak update result
 */
const updateStreak = async (userId) => {
  const userData = getUserGamificationData(userId);
  const today = getDateKey();
  const lastActive = userData.lastActiveDate;
  
  let newStreak = userData.streak;
  let streakBonus = 0;
  let streakBadges = [];
  
  if (lastActive === today) {
    // Already updated today
    return { updated: false, streak: newStreak };
  }
  
  const yesterday = getDateKey(new Date(Date.now() - 86400000));
  
  if (lastActive === yesterday) {
    // Consecutive day
    newStreak++;
    
    // Check for streak bonuses
    if (STREAK_BONUSES[newStreak]) {
      const bonus = STREAK_BONUSES[newStreak];
      await addXP(userId, bonus.xp, `streak_bonus_${newStreak}_days`);
      streakBonus = bonus.xp;
      
      if (bonus.badge) {
        await addBadge(userId, bonus.badge, `streak_${newStreak}_days`);
        streakBadges.push(bonus.badge);
      }
    }
  } else if (lastActive !== today) {
    // Streak broken
    newStreak = 1;
  }
  
  // Update longest streak
  const longestStreak = Math.max(newStreak, userData.longestStreak);
  
  userData.streak = newStreak;
  userData.longestStreak = longestStreak;
  userData.lastActiveDate = today;
  
  updateUserGamificationData(userId, userData);
  
  // Update daily progress for streak
  updateDailyProgress(userId, DAILY_GOAL_TYPES.MINUTES, 1);
  
  logger.info(`Streak updated for user ${userId}: ${newStreak} days`);
  
  return {
    updated: true,
    streak: newStreak,
    longestStreak,
    streakBonus,
    streakBadges,
    isNewStreak: lastActive !== yesterday && lastActive !== today
  };
};

/**
 * Get user streak info
 */
const getUserStreakInfo = (userId) => {
  const userData = getUserGamificationData(userId);
  
  const nextStreakBonus = Object.keys(STREAK_BONUSES)
    .map(Number)
    .find(bonus => bonus > userData.streak);
  
  return {
    currentStreak: userData.streak,
    longestStreak: userData.longestStreak,
    nextBonusAt: nextStreakBonus || null,
    nextBonusXp: nextStreakBonus ? STREAK_BONUSES[nextStreakBonus].xp : null,
    lastActiveDate: userData.lastActiveDate
  };
};

// ============================================
// Badge & Achievement Management
// ============================================

/**
 * Add badge to user
 */
const addBadge = async (userId, badgeId, source = 'unknown') => {
  const userData = getUserGamificationData(userId);
  
  // Check if badge already exists
  if (userData.badges.some(b => b.id === badgeId)) {
    return { added: false, badge: null, message: 'Badge already earned' };
  }
  
  const badge = getBadgeInfo(badgeId);
  
  userData.badges.push({
    id: badgeId,
    name: badge.name,
    icon: badge.icon,
    description: badge.description,
    earnedAt: new Date().toISOString(),
    source
  });
  
  updateUserGamificationData(userId, userData);
  
  // Award XP for badge
  await addXP(userId, XP_REWARDS.BADGE_EARNED, `badge_${badgeId}`);
  
  logger.info(`Badge added to user ${userId}: ${badgeId}`);
  
  return { added: true, badge };
};

/**
 * Get badge information
 */
const getBadgeInfo = (badgeId) => {
  const badges = {
    // Streak badges
    week_warrior: { name: 'Week Warrior', icon: '🔥', description: '7-day learning streak' },
    fortnight_champion: { name: 'Fortnight Champion', icon: '⚡', description: '14-day learning streak' },
    monthly_master: { name: 'Monthly Master', icon: '📅', description: '30-day learning streak' },
    two_month_legend: { name: 'Two Month Legend', icon: '🏆', description: '60-day learning streak' },
    quarter_king: { name: 'Quarter King', icon: '👑', description: '90-day learning streak' },
    half_year_hero: { name: 'Half Year Hero', icon: '⭐', description: '180-day learning streak' },
    yearly_yoda: { name: 'Yearly Yoda', icon: '🧘', description: '365-day learning streak' },
    
    // Level badges
    level_2: { name: 'Rising Star', icon: '🌟', description: 'Reached Level 2' },
    level_5: { name: 'Dedicated Learner', icon: '📚', description: 'Reached Level 5' },
    level_10: { name: 'Advanced Learner', icon: '🎓', description: 'Reached Level 10' },
    level_15: { name: 'Language Master', icon: '🏅', description: 'Reached Level 15' },
    level_20: { name: 'Expert', icon: '🎯', description: 'Reached Level 20' },
    level_25: { name: 'Grand Master', icon: '👑', description: 'Reached Level 25' },
    
    // Achievement badges
    perfect_lesson: { name: 'Perfectionist', icon: '💯', description: 'Completed a lesson with perfect score' },
    vocabulary_master: { name: 'Vocabulary Master', icon: '📖', description: 'Learned 500 words' },
    grammar_guru: { name: 'Grammar Guru', icon: '✍️', description: 'Completed all grammar lessons' },
    pronunciation_pro: { name: 'Pronunciation Pro', icon: '🎤', description: '90%+ pronunciation score' },
    
    // Special badges
    early_bird: { name: 'Early Bird', icon: '🌅', description: 'Completed 5 lessons before 8 AM' },
    night_owl: { name: 'Night Owl', icon: '🦉', description: 'Completed 5 lessons after 10 PM' },
    social_butterfly: { name: 'Social Butterfly', icon: '🦋', description: 'Shared 10 achievements' },
    mentor: { name: 'Mentor', icon: '👨‍🏫', description: 'Helped 5 new learners' }
  };
  
  return badges[badgeId] || { name: badgeId, icon: '🏆', description: 'Special achievement' };
};

// ============================================
// Daily Goals
// ============================================

/**
 * Set user daily goal
 */
const setDailyGoal = async (userId, goalType, target) => {
  if (!Object.values(DAILY_GOAL_TYPES).includes(goalType)) {
    throw new AppError('Invalid goal type', 400, 'INVALID_GOAL_TYPE');
  }
  
  if (target < 1 || target > 100) {
    throw new AppError('Goal target must be between 1 and 100', 400, 'INVALID_TARGET');
  }
  
  const userData = getUserGamificationData(userId);
  userData.preferences.dailyGoalType = goalType;
  userData.preferences.dailyGoalTarget = target;
  
  updateUserGamificationData(userId, userData);
  
  return {
    goalType,
    target,
    message: `Daily goal set to ${target} ${goalType} per day`
  };
};

/**
 * Get user daily progress
 */
const getUserDailyProgress = (userId) => {
  const dateKey = getDateKey();
  const dayProgress = dailyProgress.get(dateKey);
  const userProgress = dayProgress?.get(userId);
  const userData = getUserGamificationData(userId);
  
  const goalType = userData.preferences.dailyGoalType;
  const goalTarget = userData.preferences.dailyGoalTarget;
  const currentValue = userProgress ? userProgress[goalType] : 0;
  
  return {
    date: dateKey,
    goalType,
    goalTarget,
    currentValue,
    progressPercentage: Math.min(100, Math.floor((currentValue / goalTarget) * 100)),
    isCompleted: userProgress?.goalCompleted || false,
    completedAt: userProgress?.goalCompletedAt,
    details: userProgress ? {
      lessons: userProgress.lessons,
      minutes: userProgress.minutes,
      xp: userProgress.xp,
      words: userProgress.words
    } : null
  };
};

// ============================================
// Leaderboard
// ============================================

/**
 * Get leaderboard
 * @param {string} type - Leaderboard type (xp, streak, lessons)
 * @param {number} limit - Number of top users to return
 */
const getLeaderboard = async (type = 'xp', limit = 50) => {
  const cacheKey = `${type}_${limit}`;
  const cached = leaderboardCache.get(cacheKey);
  
  // Return cached if less than 5 minutes old
  if (cached && (Date.now() - cached.timestamp) < 300000) {
    return cached.data;
  }
  
  const allUsers = Array.from(userGamificationData.values());
  
  let sortedUsers = [];
  switch (type) {
    case 'xp':
      sortedUsers = allUsers.sort((a, b) => b.totalXp - a.totalXp);
      break;
    case 'streak':
      sortedUsers = allUsers.sort((a, b) => b.streak - a.streak);
      break;
    case 'lessons':
      sortedUsers = allUsers.sort((a, b) => b.stats.totalLessons - a.stats.totalLessons);
      break;
    default:
      sortedUsers = allUsers.sort((a, b) => b.totalXp - a.totalXp);
  }
  
  const leaderboard = sortedUsers.slice(0, limit).map((user, index) => ({
    rank: index + 1,
    userId: user.userId,
    level: user.level,
    [type]: type === 'xp' ? user.totalXp : type === 'streak' ? user.streak : user.stats.totalLessons
  }));
  
  // Cache leaderboard
  leaderboardCache.set(cacheKey, {
    data: leaderboard,
    timestamp: Date.now()
  });
  
  return leaderboard;
};

/**
 * Get user rank
 */
const getUserRank = async (userId, type = 'xp') => {
  const leaderboard = await getLeaderboard(type, 1000);
  const rank = leaderboard.findIndex(entry => entry.userId === userId) + 1;
  
  return {
    userId,
    rank: rank || 0,
    totalUsers: userGamificationData.size,
    percentile: rank ? ((userGamificationData.size - rank) / userGamificationData.size) * 100 : 0
  };
};

// ============================================
// Stats Tracking
// ============================================

/**
 * Update user stats
 */
const updateUserStats = async (userId, statType, value = 1) => {
  const userData = getUserGamificationData(userId);
  
  switch (statType) {
    case 'lesson_complete':
      userData.stats.totalLessons += value;
      await addXP(userId, XP_REWARDS.LESSON_COMPLETE, 'lesson_complete');
      updateDailyProgress(userId, DAILY_GOAL_TYPES.LESSONS, value);
      break;
      
    case 'perfect_lesson':
      userData.stats.perfectLessons += value;
      await addXP(userId, XP_REWARDS.PERFECT_LESSON, 'perfect_lesson');
      await addBadge(userId, 'perfect_lesson', 'perfect_lesson');
      break;
      
    case 'exercise_correct':
      userData.stats.totalExercisesCorrect += value;
      await addXP(userId, XP_REWARDS.EXERCISE_CORRECT, 'exercise_correct');
      break;
      
    case 'exercise_incorrect':
      userData.stats.totalExercisesIncorrect += value;
      break;
      
    case 'word_learned':
      userData.stats.totalWordsLearned += value;
      updateDailyProgress(userId, DAILY_GOAL_TYPES.WORDS, value);
      
      // Check for vocabulary milestones
      if (userData.stats.totalWordsLearned >= 500) {
        await addBadge(userId, 'vocabulary_master', 'words_500');
      }
      if (userData.stats.totalWordsLearned >= 2000) {
        await addBadge(userId, 'vocabulary_guru', 'words_2000');
      }
      break;
      
    case 'minutes_practiced':
      userData.stats.totalMinutes += value;
      updateDailyProgress(userId, DAILY_GOAL_TYPES.MINUTES, value);
      break;
  }
  
  updateUserGamificationData(userId, userData);
  
  return userData.stats;
};

/**
 * Get user stats summary
 */
const getUserStatsSummary = (userId) => {
  const userData = getUserGamificationData(userId);
  
  return {
    level: userData.level,
    xp: userData.xp,
    totalXp: userData.totalXp,
    streak: userData.streak,
    longestStreak: userData.longestStreak,
    badges: userData.badges.length,
    stats: userData.stats,
    dailyProgress: getUserDailyProgress(userId),
    nextLevelXp: getXpToNextLevel(userData.xp)
  };
};

// ============================================
// Export Service
// ============================================

module.exports = {
  // XP & Level
  addXP,
  getUserLevelInfo,
  calculateLevel,
  getXpToNextLevel,
  
  // Streak
  updateStreak,
  getUserStreakInfo,
  
  // Badges
  addBadge,
  getBadgeInfo,
  
  // Daily Goals
  setDailyGoal,
  getUserDailyProgress,
  updateDailyProgress,
  
  // Leaderboard
  getLeaderboard,
  getUserRank,
  
  // Stats
  updateUserStats,
  getUserStatsSummary,
  getUserGamificationData,
  
  // Constants
  XP_REWARDS,
  LEVEL_THRESHOLDS,
  STREAK_BONUSES,
  DAILY_GOAL_TYPES,
  DEFAULT_DAILY_GOALS
};
