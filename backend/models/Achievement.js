// ============================================
// Achievement Model
// SpeakFlow - AI Language Learning Platform
// ============================================

const mongoose = require('mongoose');

// ============================================
// Constants & Enums
// ============================================

const ACHIEVEMENT_CATEGORIES = {
  LEARNING: 'learning',
  STREAK: 'streak',
  PERFECT: 'perfect',
  SOCIAL: 'social',
  MASTERY: 'mastery',
  MILESTONE: 'milestone',
  SPECIAL: 'special',
  SEASONAL: 'seasonal'
};

const ACHIEVEMENT_RARITIES = {
  COMMON: 'common',
  RARE: 'rare',
  EPIC: 'epic',
  LEGENDARY: 'legendary'
};

const ACHIEVEMENT_STATUSES = {
  LOCKED: 'locked',
  UNLOCKED: 'unlocked',
  CLAIMED: 'claimed'
};

const BADGE_TYPES = {
  ACHIEVEMENT: 'achievement',
  SKILL: 'skill',
  LEVEL: 'level',
  EVENT: 'event',
  SEASONAL: 'seasonal',
  SPECIAL: 'special'
};

// ============================================
// Sub-Schemas
// ============================================

/**
 * Requirement Schema
 */
const requirementSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: [
      'total_sessions',
      'total_minutes',
      'total_xp',
      'total_words',
      'streak_days',
      'perfect_scores',
      'skill_score',
      'level_reached',
      'lessons_completed',
      'specific_lesson',
      'specific_skill',
      'social_shares',
      'referrals',
      'achievements_count'
    ]
  },
  target: {
    type: Number,
    required: true,
    min: 0
  },
  current: {
    type: Number,
    default: 0
  },
  comparison: {
    type: String,
    enum: ['gte', 'lte', 'eq'],
    default: 'gte'
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  }
}, { _id: false });

/**
 * Reward Schema
 */
const rewardSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['xp', 'badge', 'title', 'cosmetic', 'discount', 'feature_unlock', 'currency'],
    required: true
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  description: String,
  claimedAt: Date
}, { _id: false });

/**
 * Progress Schema (per user)
 */
const progressSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: Object.values(ACHIEVEMENT_STATUSES),
    default: ACHIEVEMENT_STATUSES.LOCKED
  },
  currentValue: {
    type: Number,
    default: 0
  },
  requirements: [requirementSchema],
  unlockedAt: Date,
  claimedAt: Date,
  notifiedAt: Date,
  progressHistory: [{
    value: Number,
    timestamp: { type: Date, default: Date.now }
  }]
}, { _id: false });

/**
 * Badge Schema (for users)
 */
const userBadgeSchema = new mongoose.Schema({
  badgeId: {
    type: String,
    required: true
  },
  earnedAt: {
    type: Date,
    default: Date.now
  },
  equipped: {
    type: Boolean,
    default: false
  },
  displayedOnProfile: {
    type: Boolean,
    default: true
  }
}, { _id: false });

// ============================================
// Main Achievement Schema
// ============================================

const achievementSchema = new mongoose.Schema({
  // Identification
  achievementId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    index: true
  },
  description: {
    type: String,
    required: true
  },
  
  // Categorization
  category: {
    type: String,
    enum: Object.values(ACHIEVEMENT_CATEGORIES),
    required: true,
    index: true
  },
  rarity: {
    type: String,
    enum: Object.values(ACHIEVEMENT_RARITIES),
    default: ACHIEVEMENT_RARITIES.COMMON
  },
  
  // Visuals
  icon: {
    type: String,
    required: true
  },
  iconColor: String,
  backgroundImage: String,
  animation: String,
  
  // Requirements
  requirements: [requirementSchema],
  
  // Rewards
  rewards: [rewardSchema],
  
  // XP reward
  xpReward: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Display
  displayOrder: {
    type: Number,
    default: 0
  },
  hidden: {
    type: Boolean,
    default: false // Hidden achievements (secret)
  },
  
  // Progression
  isProgressive: {
    type: Boolean,
    default: false
  },
  progressionLevels: [{
    level: Number,
    name: String,
    description: String,
    target: Number,
    xpReward: Number,
    icon: String
  }],
  
  // Unlock conditions
  parentAchievementId: {
    type: String,
    ref: 'Achievement'
  },
  requiredAchievements: [{
    type: String,
    ref: 'Achievement'
  }],
  
  // Time constraints
  seasonal: {
    isSeasonal: { type: Boolean, default: false },
    startDate: Date,
    endDate: Date,
    seasonYear: Number,
    seasonName: String
  },
  
  // User progress
  userProgress: [progressSchema],
  
  // Statistics
  globalStats: {
    unlockedCount: { type: Number, default: 0 },
    claimedCount: { type: Number, default: 0 },
    completionRate: { type: Number, default: 0 }
  },
  
  // Status
  status: {
    type: String,
    enum: ['active', 'inactive', 'deprecated'],
    default: 'active'
  },
  
  // Metadata
  version: {
    type: Number,
    default: 1
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ============================================
// Virtual Fields
// ============================================

// Total requirements count
achievementSchema.virtual('requirementsCount').get(function() {
  return this.requirements.length;
});

// Is seasonal and currently active
achievementSchema.virtual('isSeasonalActive').get(function() {
  if (!this.seasonal.isSeasonal) return false;
  const now = new Date();
  return (!this.seasonal.startDate || now >= this.seasonal.startDate) &&
         (!this.seasonal.endDate || now <= this.seasonal.endDate);
});

// Completion percentage (global)
achievementSchema.virtual('globalCompletionPercentage').get(function() {
  return this.globalStats.completionRate || 0;
});

// ============================================
// Instance Methods
// ============================================

/**
 * Get user progress for this achievement
 */
achievementSchema.methods.getUserProgress = function(userId) {
  return this.userProgress.find(p => p.userId.toString() === userId.toString());
};

/**
 * Update user progress
 */
achievementSchema.methods.updateProgress = async function(userId, metricType, value, metadata = {}) {
  let progress = this.getUserProgress(userId);
  
  if (!progress) {
    progress = {
      userId,
      status: ACHIEVEMENT_STATUSES.LOCKED,
      currentValue: 0,
      requirements: this.requirements.map(req => ({ ...req.toObject(), current: 0 })),
      progressHistory: []
    };
    this.userProgress.push(progress);
  }
  
  // Update relevant requirements
  let updated = false;
  for (const req of progress.requirements) {
    if (req.type === metricType) {
      const oldValue = req.current;
      req.current = Math.min(req.target, value);
      if (req.current > oldValue) {
        updated = true;
        progress.progressHistory.push({
          value: req.current,
          timestamp: new Date()
        });
        // Keep only last 100 history entries
        if (progress.progressHistory.length > 100) {
          progress.progressHistory = progress.progressHistory.slice(-100);
        }
      }
    }
  }
  
  // Update current value (legacy)
  progress.currentValue = value;
  
  // Check if all requirements are met
  const allMet = progress.requirements.every(req => req.current >= req.target);
  
  if (allMet && progress.status === ACHIEVEMENT_STATUSES.LOCKED) {
    progress.status = ACHIEVEMENT_STATUSES.UNLOCKED;
    progress.unlockedAt = new Date();
    
    // Update global stats
    this.globalStats.unlockedCount++;
    await this.save();
    
    // Return achievement unlocked data
    return {
      unlocked: true,
      achievement: {
        id: this.achievementId,
        code: this.code,
        name: this.name,
        description: this.description,
        icon: this.icon,
        rarity: this.rarity,
        xpReward: this.xpReward
      }
    };
  }
  
  if (updated) {
    await this.save();
  }
  
  return { unlocked: false, progress: progress.currentValue };
};

/**
 * Claim achievement rewards
 */
achievementSchema.methods.claimRewards = async function(userId) {
  const progress = this.getUserProgress(userId);
  
  if (!progress || progress.status !== ACHIEVEMENT_STATUSES.UNLOCKED) {
    throw new Error('Achievement not unlocked yet');
  }
  
  if (progress.status === ACHIEVEMENT_STATUSES.CLAIMED) {
    throw new Error('Achievement already claimed');
  }
  
  progress.status = ACHIEVEMENT_STATUSES.CLAIMED;
  progress.claimedAt = new Date();
  
  // Process rewards
  const claimedRewards = [];
  
  for (const reward of this.rewards) {
    reward.claimedAt = new Date();
    claimedRewards.push(reward);
  }
  
  // Update global stats
  this.globalStats.claimedCount++;
  this.globalStats.completionRate = (this.globalStats.claimedCount / (this.userProgress.length || 1)) * 100;
  
  await this.save();
  
  return {
    achievementId: this.achievementId,
    name: this.name,
    xpReward: this.xpReward,
    rewards: claimedRewards
  };
};

/**
 * Check if user has unlocked this achievement
 */
achievementSchema.methods.isUnlockedByUser = function(userId) {
  const progress = this.getUserProgress(userId);
  return progress && progress.status !== ACHIEVEMENT_STATUSES.LOCKED;
};

/**
 * Get user's progress percentage
 */
achievementSchema.methods.getUserProgressPercentage = function(userId) {
  const progress = this.getUserProgress(userId);
  if (!progress) return 0;
  
  const totalRequired = progress.requirements.reduce((sum, req) => sum + req.target, 0);
  const totalCurrent = progress.requirements.reduce((sum, req) => sum + req.current, 0);
  
  return totalRequired > 0 ? (totalCurrent / totalRequired) * 100 : 0;
};

// ============================================
// Static Methods
// ============================================

/**
 * Get all achievements for a user
 */
achievementSchema.statics.getUserAchievements = async function(userId, options = {}) {
  const { category, status, limit = 50, offset = 0 } = options;
  
  let query = { status: 'active' };
  if (category) query.category = category;
  
  const achievements = await this.find(query)
    .sort({ displayOrder: 1, rarity: -1 })
    .skip(offset)
    .limit(limit);
  
  const result = achievements.map(ach => {
    const progress = ach.getUserProgress(userId);
    return {
      ...ach.toObject(),
      userStatus: progress?.status || ACHIEVEMENT_STATUSES.LOCKED,
      progressPercentage: ach.getUserProgressPercentage(userId),
      unlockedAt: progress?.unlockedAt,
      claimedAt: progress?.claimedAt
    };
  });
  
  return result;
};

/**
 * Get recently unlocked achievements for a user
 */
achievementSchema.statics.getRecentlyUnlocked = async function(userId, limit = 10) {
  const achievements = await this.find({
    'userProgress.userId': userId,
    'userProgress.status': ACHIEVEMENT_STATUSES.UNLOCKED
  }).sort({ 'userProgress.unlockedAt': -1 }).limit(limit);
  
  return achievements.map(ach => {
    const progress = ach.getUserProgress(userId);
    return {
      id: ach.achievementId,
      code: ach.code,
      name: ach.name,
      description: ach.description,
      icon: ach.icon,
      rarity: ach.rarity,
      xpReward: ach.xpReward,
      unlockedAt: progress?.unlockedAt
    };
  });
};

/**
 * Get user achievement summary
 */
achievementSchema.statics.getUserSummary = async function(userId) {
  const allAchievements = await this.find({ status: 'active' });
  const userProgress = await this.find({
    'userProgress.userId': userId
  });
  
  let unlocked = 0;
  let claimed = 0;
  let totalXP = 0;
  const byCategory = {};
  
  for (const ach of allAchievements) {
    const progress = ach.getUserProgress(userId);
    if (progress && progress.status !== ACHIEVEMENT_STATUSES.LOCKED) {
      unlocked++;
      if (progress.status === ACHIEVEMENT_STATUSES.CLAIMED) {
        claimed++;
        totalXP += ach.xpReward;
      }
    }
    
    if (!byCategory[ach.category]) {
      byCategory[ach.category] = { total: 0, unlocked: 0 };
    }
    byCategory[ach.category].total++;
    if (progress && progress.status !== ACHIEVEMENT_STATUSES.LOCKED) {
      byCategory[ach.category].unlocked++;
    }
  }
  
  return {
    total: allAchievements.length,
    unlocked,
    claimed,
    completionPercentage: allAchievements.length > 0 ? (unlocked / allAchievements.length) * 100 : 0,
    totalXPEarned: totalXP,
    byCategory,
    nextMilestone: await this.getNextMilestone(userId)
  };
};

/**
 * Get next milestone achievement
 */
achievementSchema.statics.getNextMilestone = async function(userId) {
  const achievements = await this.find({
    status: 'active',
    'userProgress.userId': { $ne: userId }
  }).sort({ displayOrder: 1 });
  
  for (const ach of achievements) {
    const progress = ach.getUserProgress(userId);
    if (!progress || progress.status === ACHIEVEMENT_STATUSES.LOCKED) {
      const percentage = ach.getUserProgressPercentage(userId);
      if (percentage > 0) {
        return {
          id: ach.achievementId,
          name: ach.name,
          description: ach.description,
          icon: ach.icon,
          rarity: ach.rarity,
          progressPercentage: percentage,
          requirements: ach.requirements
        };
      }
    }
  }
  
  return null;
};

/**
 * Get leaderboard for an achievement
 */
achievementSchema.statics.getLeaderboard = async function(achievementId, limit = 50) {
  const achievement = await this.findOne({ achievementId });
  if (!achievement) return [];
  
  const sortedProgress = [...achievement.userProgress]
    .filter(p => p.status !== ACHIEVEMENT_STATUSES.LOCKED)
    .sort((a, b) => b.unlockedAt - a.unlockedAt)
    .slice(0, limit);
  
  const User = mongoose.model('User');
  const userIds = sortedProgress.map(p => p.userId);
  const users = await User.find({ _id: { $in: userIds } }).select('name avatar');
  
  return sortedProgress.map((progress, index) => {
    const user = users.find(u => u._id.toString() === progress.userId.toString());
    return {
      rank: index + 1,
      userId: progress.userId,
      userName: user?.name || 'Unknown',
      userAvatar: user?.avatar,
      unlockedAt: progress.unlockedAt
    };
  });
};

/**
 * Check and award achievements for an event
 */
achievementSchema.statics.checkAndAward = async function(userId, eventType, value, metadata = {}) {
  const achievements = await this.find({ status: 'active' });
  const unlocked = [];
  
  for (const achievement of achievements) {
    const hasRelevantRequirement = achievement.requirements.some(req => req.type === eventType);
    if (hasRelevantRequirement) {
      const result = await achievement.updateProgress(userId, eventType, value, metadata);
      if (result.unlocked) {
        unlocked.push(result.achievement);
      }
    }
  }
  
  return unlocked;
};

/**
 * Seed default achievements
 */
achievementSchema.statics.seedDefaultAchievements = async function() {
  const defaultAchievements = [
    {
      code: 'first_lesson',
      name: 'First Step',
      description: 'Complete your first lesson',
      category: ACHIEVEMENT_CATEGORIES.LEARNING,
      rarity: ACHIEVEMENT_RARITIES.COMMON,
      icon: '🎯',
      xpReward: 50,
      requirements: [{ type: 'total_sessions', target: 1 }],
      rewards: [{ type: 'xp', value: 50, description: '50 XP' }]
    },
    {
      code: 'ten_lessons',
      name: 'Dedicated Learner',
      description: 'Complete 10 lessons',
      category: ACHIEVEMENT_CATEGORIES.MILESTONE,
      rarity: ACHIEVEMENT_RARITIES.COMMON,
      icon: '📚',
      xpReward: 100,
      requirements: [{ type: 'total_sessions', target: 10 }],
      rewards: [{ type: 'xp', value: 100, description: '100 XP' }]
    },
    {
      code: 'fifty_lessons',
      name: 'Language Enthusiast',
      description: 'Complete 50 lessons',
      category: ACHIEVEMENT_CATEGORIES.MILESTONE,
      rarity: ACHIEVEMENT_RARITIES.RARE,
      icon: '⭐',
      xpReward: 250,
      requirements: [{ type: 'total_sessions', target: 50 }]
    },
    {
      code: 'hundred_lessons',
      name: 'Master',
      description: 'Complete 100 lessons',
      category: ACHIEVEMENT_CATEGORIES.MILESTONE,
      rarity: ACHIEVEMENT_RARITIES.EPIC,
      icon: '🏆',
      xpReward: 500,
      requirements: [{ type: 'total_sessions', target: 100 }]
    },
    {
      code: 'seven_day_streak',
      name: 'Week Warrior',
      description: 'Maintain a 7-day learning streak',
      category: ACHIEVEMENT_CATEGORIES.STREAK,
      rarity: ACHIEVEMENT_RARITIES.COMMON,
      icon: '🔥',
      xpReward: 100,
      requirements: [{ type: 'streak_days', target: 7 }]
    },
    {
      code: 'thirty_day_streak',
      name: 'Monthly Master',
      description: 'Maintain a 30-day learning streak',
      category: ACHIEVEMENT_CATEGORIES.STREAK,
      rarity: ACHIEVEMENT_RARITIES.RARE,
      icon: '📅',
      xpReward: 500,
      requirements: [{ type: 'streak_days', target: 30 }]
    },
    {
      code: 'ninety_day_streak',
      name: 'Quarter Champion',
      description: 'Maintain a 90-day learning streak',
      category: ACHIEVEMENT_CATEGORIES.STREAK,
      rarity: ACHIEVEMENT_RARITIES.LEGENDARY,
      icon: '👑',
      xpReward: 1500,
      requirements: [{ type: 'streak_days', target: 90 }]
    },
    {
      code: 'perfect_score',
      name: 'Perfectionist',
      description: 'Get a perfect score (100%) in a lesson',
      category: ACHIEVEMENT_CATEGORIES.PERFECT,
      rarity: ACHIEVEMENT_RARITIES.RARE,
      icon: '💯',
      xpReward: 150,
      requirements: [{ type: 'perfect_scores', target: 1 }]
    },
    {
      code: 'vocabulary_master',
      name: 'Vocabulary Master',
      description: 'Learn 500 words',
      category: ACHIEVEMENT_CATEGORIES.MASTERY,
      rarity: ACHIEVEMENT_RARITIES.RARE,
      icon: '📖',
      xpReward: 200,
      requirements: [{ type: 'total_words', target: 500 }]
    },
    {
      code: 'vocabulary_guru',
      name: 'Vocabulary Guru',
      description: 'Learn 2000 words',
      category: ACHIEVEMENT_CATEGORIES.MASTERY,
      rarity: ACHIEVEMENT_RARITIES.EPIC,
      icon: '📚',
      xpReward: 500,
      requirements: [{ type: 'total_words', target: 2000 }]
    },
    {
      code: 'early_bird',
      name: 'Early Bird',
      description: 'Complete 5 lessons before 8 AM',
      category: ACHIEVEMENT_CATEGORIES.SPECIAL,
      rarity: ACHIEVEMENT_RARITIES.RARE,
      icon: '🌅',
      xpReward: 100,
      requirements: [{ type: 'lessons_completed', target: 5, metadata: { timeOfDay: 'morning' } }]
    },
    {
      code: 'night_owl',
      name: 'Night Owl',
      description: 'Complete 5 lessons after 10 PM',
      category: ACHIEVEMENT_CATEGORIES.SPECIAL,
      rarity: ACHIEVEMENT_RARITIES.RARE,
      icon: '🦉',
      xpReward: 100,
      requirements: [{ type: 'lessons_completed', target: 5, metadata: { timeOfDay: 'night' } }]
    }
  ];
  
  for (const ach of defaultAchievements) {
    const exists = await this.findOne({ code: ach.code });
    if (!exists) {
      ach.achievementId = `ach_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await this.create(ach);
    }
  }
};

// ============================================
// Indexes
// ============================================

achievementSchema.index({ achievementId: 1 });
achievementSchema.index({ code: 1 });
achievementSchema.index({ category: 1, displayOrder: 1 });
achievementSchema.index({ rarity: 1 });
achievementSchema.index({ status: 1 });
achievementSchema.index({ 'userProgress.userId': 1 });
achievementSchema.index({ 'userProgress.status': 1 });
achievementSchema.index({ 'userProgress.unlockedAt': -1 });
achievementSchema.index({ seasonal: 1, 'seasonal.startDate': 1, 'seasonal.endDate': 1 });

// Compound indexes
achievementSchema.index({ category: 1, rarity: 1, displayOrder: 1 });
achievementSchema.index({ status: 1, category: 1, displayOrder: 1 });

// ============================================
// Pre-save Middleware
// ============================================

// Generate achievement ID
achievementSchema.pre('save', function(next) {
  if (!this.achievementId) {
    this.achievementId = `ach_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  next();
});

// Update timestamps
achievementSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Update global stats
achievementSchema.pre('save', function(next) {
  if (this.userProgress) {
    this.globalStats.unlockedCount = this.userProgress.filter(p => p.status !== ACHIEVEMENT_STATUSES.LOCKED).length;
    this.globalStats.claimedCount = this.userProgress.filter(p => p.status === ACHIEVEMENT_STATUSES.CLAIMED).length;
    this.globalStats.completionRate = this.userProgress.length > 0 
      ? (this.globalStats.claimedCount / this.userProgress.length) * 100 
      : 0;
  }
  next();
});

// ============================================
// Model Creation
// ============================================

const Achievement = mongoose.model('Achievement', achievementSchema);

module.exports = Achievement;
