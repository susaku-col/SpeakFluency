// ============================================
// User Model
// SpeakFlow - AI Language Learning Platform
// ============================================

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// ============================================
// User Schema Definition
// ============================================

/**
 * User Preferences Schema
 */
const userPreferencesSchema = new mongoose.Schema({
  language: {
    type: String,
    default: 'en',
    enum: ['en', 'es', 'fr', 'ja', 'ko', 'zh', 'de', 'it', 'pt', 'ru']
  },
  theme: {
    type: String,
    default: 'light',
    enum: ['light', 'dark', 'system']
  },
  fontSize: {
    type: String,
    default: 'medium',
    enum: ['small', 'medium', 'large']
  },
  reducedMotion: {
    type: Boolean,
    default: false
  },
  highContrast: {
    type: Boolean,
    default: false
  },
  notifications: {
    email: { type: Boolean, default: true },
    push: { type: Boolean, default: true },
    marketing: { type: Boolean, default: false },
    streakReminders: { type: Boolean, default: true },
    achievementAlerts: { type: Boolean, default: true },
    communityUpdates: { type: Boolean, default: false }
  },
  privacy: {
    profileVisibility: {
      type: String,
      default: 'public',
      enum: ['public', 'private', 'friends']
    },
    showProgress: { type: Boolean, default: true },
    showAchievements: { type: Boolean, default: true },
    allowDataCollection: { type: Boolean, default: true }
  },
  learning: {
    dailyGoal: { type: Number, default: 15 }, // minutes
    reminderTime: { type: String, default: '19:00' },
    autoPlayAudio: { type: Boolean, default: true },
    showTranscription: { type: Boolean, default: true },
    difficulty: {
      type: String,
      default: 'auto',
      enum: ['auto', 'beginner', 'intermediate', 'advanced']
    }
  }
}, { _id: false });

/**
 * User Stats Schema
 */
const userStatsSchema = new mongoose.Schema({
  totalSessions: { type: Number, default: 0 },
  totalMinutes: { type: Number, default: 0 },
  totalXP: { type: Number, default: 0 },
  totalWordsLearned: { type: Number, default: 0 },
  averageScore: { type: Number, default: 0 },
  currentStreak: { type: Number, default: 0 },
  longestStreak: { type: Number, default: 0 },
  level: { type: Number, default: 1 },
  
  // Skill scores (0-100)
  pronunciationScore: { type: Number, default: 0 },
  vocabularyScore: { type: Number, default: 0 },
  grammarScore: { type: Number, default: 0 },
  fluencyScore: { type: Number, default: 0 },
  listeningScore: { type: Number, default: 0 },
  readingScore: { type: Number, default: 0 },
  
  // Weekly activity (last 7 days)
  weeklyActivity: [{
    date: { type: Date },
    minutes: { type: Number, default: 0 },
    sessions: { type: Number, default: 0 },
    score: { type: Number, default: 0 }
  }],
  
  // Monthly summary
  monthlySummary: {
    month: { type: String },
    year: { type: Number },
    totalMinutes: { type: Number, default: 0 },
    totalSessions: { type: Number, default: 0 },
    averageScore: { type: Number, default: 0 }
  }
}, { _id: false });

/**
 * User Subscription Schema
 */
const userSubscriptionSchema = new mongoose.Schema({
  planId: {
    type: String,
    default: 'free',
    enum: ['free', 'pro_monthly', 'pro_yearly', 'family_monthly', 'family_yearly', 'enterprise']
  },
  status: {
    type: String,
    default: 'active',
    enum: ['active', 'trialing', 'past_due', 'canceled', 'incomplete', 'incomplete_expired']
  },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date },
  trialEndDate: { type: Date },
  autoRenew: { type: Boolean, default: true },
  cancelAtPeriodEnd: { type: Boolean, default: false },
  cancelReason: { type: String },
  paymentMethodId: { type: String },
  paymentMethodLast4: { type: String },
  paymentMethodBrand: { type: String },
  stripeCustomerId: { type: String },
  stripeSubscriptionId: { type: String }
}, { _id: false });

/**
 * User Social Account Schema
 */
const userSocialAccountSchema = new mongoose.Schema({
  provider: {
    type: String,
    enum: ['google', 'facebook', 'apple', 'github']
  },
  providerId: { type: String },
  email: { type: String },
  name: { type: String },
  avatar: { type: String },
  accessToken: { type: String },
  refreshToken: { type: String },
  connectedAt: { type: Date, default: Date.now }
}, { _id: false });

/**
 * User Device Schema
 */
const userDeviceSchema = new mongoose.Schema({
  deviceId: { type: String, required: true },
  deviceName: { type: String },
  deviceType: {
    type: String,
    enum: ['mobile', 'tablet', 'desktop', 'web']
  },
  platform: { type: String },
  browser: { type: String },
  browserVersion: { type: String },
  os: { type: String },
  osVersion: { type: String },
  lastActive: { type: Date, default: Date.now },
  pushSubscription: {
    endpoint: { type: String },
    keys: {
      p256dh: { type: String },
      auth: { type: String }
    }
  },
  isActive: { type: Boolean, default: true }
}, { _id: false });

/**
 * User Session Schema
 */
const userSessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true },
  token: { type: String },
  refreshToken: { type: String },
  ipAddress: { type: String },
  userAgent: { type: String },
  deviceId: { type: String },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date },
  isActive: { type: Boolean, default: true }
}, { _id: false });

// ============================================
// Main User Schema
// ============================================

const userSchema = new mongoose.Schema({
  // Basic Information
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  password: {
    type: String,
    required: function() {
      return !this.socialAccounts || this.socialAccounts.length === 0;
    }
  },
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 50
  },
  avatar: {
    type: String,
    default: null
  },
  bio: {
    type: String,
    maxlength: 500,
    default: ''
  },
  
  // Contact Information
  phone: {
    type: String,
    sparse: true
  },
  country: {
    type: String,
    default: 'US'
  },
  timezone: {
    type: String,
    default: 'UTC'
  },
  
  // Account Status
  role: {
    type: String,
    default: 'user',
    enum: ['user', 'premium', 'moderator', 'support', 'admin', 'super_admin']
  },
  status: {
    type: String,
    default: 'active',
    enum: ['active', 'inactive', 'suspended', 'banned', 'deleted']
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  isPhoneVerified: {
    type: Boolean,
    default: false
  },
  
  // Security
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorSecret: {
    type: String
  },
  backupCodes: [{
    code: { type: String },
    used: { type: Boolean, default: false }
  }],
  lastPasswordChange: {
    type: Date,
    default: Date.now
  },
  passwordResetToken: {
    type: String
  },
  passwordResetExpires: {
    type: Date
  },
  emailVerificationToken: {
    type: String
  },
  emailVerificationExpires: {
    type: Date
  },
  
  // Login Tracking
  lastLogin: {
    type: Date
  },
  lastLoginIp: {
    type: String
  },
  lastLoginDevice: {
    type: String
  },
  loginCount: {
    type: Number,
    default: 0
  },
  failedLoginAttempts: {
    type: Number,
    default: 0
  },
  lockedUntil: {
    type: Date
  },
  
  // Embedded Documents
  preferences: {
    type: userPreferencesSchema,
    default: () => ({})
  },
  stats: {
    type: userStatsSchema,
    default: () => ({})
  },
  subscription: {
    type: userSubscriptionSchema,
    default: () => ({})
  },
  socialAccounts: [userSocialAccountSchema],
  devices: [userDeviceSchema],
  sessions: [userSessionSchema],
  
  // Referral
  referralCode: {
    type: String,
    unique: true,
    sparse: true
  },
  referredBy: {
    type: String,
    ref: 'User'
  },
  referralCount: {
    type: Number,
    default: 0
  },
  referralRewards: [{
    type: { type: String },
    amount: { type: Number },
    earnedAt: { type: Date, default: Date.now },
    redeemedAt: { type: Date }
  }],
  
  // Achievements & Badges
  achievements: [{
    id: { type: String },
    name: { type: String },
    description: { type: String },
    earnedAt: { type: Date, default: Date.now },
    progress: { type: Number, default: 0 }
  }],
  badges: [{
    id: { type: String },
    name: { type: String },
    icon: { type: String },
    earnedAt: { type: Date, default: Date.now }
  }],
  
  // Notifications
  unreadNotifications: {
    type: Number,
    default: 0
  },
  lastNotificationRead: {
    type: Date
  },
  
  // System Fields
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  deletedAt: {
    type: Date
  },
  termsAcceptedAt: {
    type: Date
  },
  privacyAcceptedAt: {
    type: Date
  },
  
  // Metadata
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: new Map()
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true, transform: transformUser },
  toObject: { virtuals: true }
});

// ============================================
// Transform Function (Remove sensitive data)
// ============================================

function transformUser(doc, ret) {
  delete ret.password;
  delete ret.twoFactorSecret;
  delete ret.backupCodes;
  delete ret.passwordResetToken;
  delete ret.passwordResetExpires;
  delete ret.emailVerificationToken;
  delete ret.emailVerificationExpires;
  delete ret.sessions;
  delete ret.devices;
  delete ret.metadata;
  return ret;
}

// ============================================
// Virtual Fields
// ============================================

// Full name virtual
userSchema.virtual('fullName').get(function() {
  return this.name;
});

// Profile completion percentage
userSchema.virtual('profileCompletion').get(function() {
  let completed = 0;
  let total = 0;
  
  if (this.name && this.name !== '') { completed++; }
  total++;
  
  if (this.avatar) { completed++; }
  total++;
  
  if (this.bio && this.bio !== '') { completed++; }
  total++;
  
  if (this.phone) { completed++; }
  total++;
  
  if (this.country) { completed++; }
  total++;
  
  return Math.round((completed / total) * 100);
});

// Is active account
userSchema.virtual('isActive').get(function() {
  return this.status === 'active' && this.isEmailVerified;
});

// Is locked
userSchema.virtual('isLocked').get(function() {
  return this.lockedUntil && this.lockedUntil > new Date();
});

// Days since joined
userSchema.virtual('daysSinceJoined').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// ============================================
// Instance Methods
// ============================================

/**
 * Compare password
 */
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

/**
 * Generate password reset token
 */
userSchema.methods.generatePasswordResetToken = function() {
  const resetToken = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  this.passwordResetExpires = Date.now() + 60 * 60 * 1000; // 1 hour
  return resetToken;
};

/**
 * Generate email verification token
 */
userSchema.methods.generateEmailVerificationToken = function() {
  const verificationToken = crypto.randomBytes(32).toString('hex');
  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');
  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  return verificationToken;
};

/**
 * Generate backup codes for 2FA
 */
userSchema.methods.generateBackupCodes = function() {
  const codes = [];
  for (let i = 0; i < 10; i++) {
    codes.push({
      code: crypto.randomBytes(4).toString('hex').toUpperCase(),
      used: false
    });
  }
  this.backupCodes = codes;
  return codes.map(c => c.code);
};

/**
 * Add XP and handle level up
 */
userSchema.methods.addXP = async function(xpAmount) {
  this.stats.totalXP += xpAmount;
  
  const newLevel = Math.floor(Math.sqrt(this.stats.totalXP / 100)) + 1;
  const leveledUp = newLevel > this.stats.level;
  
  if (leveledUp) {
    this.stats.level = newLevel;
  }
  
  await this.save();
  return { leveledUp, oldLevel: this.stats.level - (leveledUp ? 1 : 0), newLevel: this.stats.level };
};

/**
 * Update streak
 */
userSchema.methods.updateStreak = async function() {
  const today = new Date().toDateString();
  const lastSessionDate = this.stats.lastSessionDate ? new Date(this.stats.lastSessionDate).toDateString() : null;
  
  if (lastSessionDate === today) {
    // Already updated today
    return;
  }
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayString = yesterday.toDateString();
  
  if (lastSessionDate === yesterdayString) {
    // Consecutive day
    this.stats.currentStreak++;
    if (this.stats.currentStreak > this.stats.longestStreak) {
      this.stats.longestStreak = this.stats.currentStreak;
    }
  } else if (lastSessionDate !== today) {
    // Streak broken
    this.stats.currentStreak = 1;
  }
  
  this.stats.lastSessionDate = new Date();
  await this.save();
  
  return this.stats.currentStreak;
};

/**
 * Add achievement
 */
userSchema.methods.addAchievement = async function(achievementId, achievementName, description) {
  const alreadyHas = this.achievements.some(a => a.id === achievementId);
  if (alreadyHas) return false;
  
  this.achievements.push({
    id: achievementId,
    name: achievementName,
    description: description,
    earnedAt: new Date()
  });
  
  await this.save();
  return true;
};

/**
 * Add badge
 */
userSchema.methods.addBadge = async function(badgeId, badgeName, icon) {
  const alreadyHas = this.badges.some(b => b.id === badgeId);
  if (alreadyHas) return false;
  
  this.badges.push({
    id: badgeId,
    name: badgeName,
    icon: icon,
    earnedAt: new Date()
  });
  
  await this.save();
  return true;
};

/**
 * Add device
 */
userSchema.methods.addDevice = function(deviceData) {
  const existingDevice = this.devices.find(d => d.deviceId === deviceData.deviceId);
  
  if (existingDevice) {
    existingDevice.lastActive = new Date();
    existingDevice.isActive = true;
    if (deviceData.pushSubscription) {
      existingDevice.pushSubscription = deviceData.pushSubscription;
    }
  } else {
    this.devices.push({
      ...deviceData,
      lastActive: new Date(),
      isActive: true
    });
  }
  
  return this.save();
};

/**
 * Remove device
 */
userSchema.methods.removeDevice = function(deviceId) {
  const device = this.devices.find(d => d.deviceId === deviceId);
  if (device) {
    device.isActive = false;
  }
  return this.save();
};

/**
 * Create session
 */
userSchema.methods.createSession = function(sessionData) {
  const session = {
    sessionId: crypto.randomBytes(32).toString('hex'),
    ...sessionData,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    isActive: true
  };
  
  this.sessions.push(session);
  
  // Keep only last 10 sessions
  if (this.sessions.length > 10) {
    this.sessions = this.sessions.slice(-10);
  }
  
  return session;
};

/**
 * Invalidate session
 */
userSchema.methods.invalidateSession = function(sessionId) {
  const session = this.sessions.find(s => s.sessionId === sessionId);
  if (session) {
    session.isActive = false;
  }
  return this.save();
};

/**
 * Invalidate all sessions
 */
userSchema.methods.invalidateAllSessions = function() {
  this.sessions.forEach(session => {
    session.isActive = false;
  });
  return this.save();
};

/**
 * Update last login
 */
userSchema.methods.updateLastLogin = function(ip, userAgent, deviceId) {
  this.lastLogin = new Date();
  this.lastLoginIp = ip;
  this.lastLoginDevice = userAgent;
  this.loginCount++;
  this.failedLoginAttempts = 0;
  this.lockedUntil = null;
  
  if (deviceId) {
    this.addDevice({ deviceId, deviceName: userAgent, deviceType: 'web' });
  }
  
  return this.save();
};

/**
 * Record failed login attempt
 */
userSchema.methods.recordFailedLogin = async function() {
  this.failedLoginAttempts++;
  
  // Lock after 5 failed attempts
  if (this.failedLoginAttempts >= 5) {
    this.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  }
  
  await this.save();
  return this.failedLoginAttempts;
};

/**
 * Generate referral code
 */
userSchema.methods.generateReferralCode = function() {
  if (!this.referralCode) {
    this.referralCode = `${this._id.toString().substring(0, 4)}${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  }
  return this.referralCode;
};

/**
 * Get public profile
 */
userSchema.methods.getPublicProfile = function() {
  return {
    id: this._id,
    name: this.name,
    avatar: this.avatar,
    bio: this.bio,
    country: this.country,
    stats: {
      level: this.stats.level,
      totalXP: this.stats.totalXP,
      currentStreak: this.stats.currentStreak,
      averageScore: this.stats.averageScore
    },
    badges: this.badges.slice(-5),
    joinedAt: this.createdAt
  };
};

// ============================================
// Static Methods
// ============================================

/**
 * Find by email
 */
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

/**
 * Find by referral code
 */
userSchema.statics.findByReferralCode = function(referralCode) {
  return this.findOne({ referralCode });
};

/**
 * Find active users
 */
userSchema.statics.findActiveUsers = function() {
  return this.find({ 
    status: 'active', 
    isEmailVerified: true,
    deletedAt: null 
  });
};

/**
 * Get user statistics
 */
userSchema.statics.getUserStats = async function() {
  const stats = await this.aggregate([
    { $match: { deletedAt: null } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
        premium: { $sum: { $cond: [{ $eq: ['$role', 'premium'] }, 1, 0] } },
        verified: { $sum: { $cond: ['$isEmailVerified', 1, 0] } },
        totalXP: { $sum: '$stats.totalXP' },
        totalSessions: { $sum: '$stats.totalSessions' },
        totalMinutes: { $sum: '$stats.totalMinutes' }
      }
    }
  ]);
  
  return stats[0] || {
    total: 0,
    active: 0,
    premium: 0,
    verified: 0,
    totalXP: 0,
    totalSessions: 0,
    totalMinutes: 0
  };
};

// ============================================
// Indexes
// ============================================

userSchema.index({ email: 1 });
userSchema.index({ referralCode: 1 });
userSchema.index({ status: 1, isEmailVerified: 1 });
userSchema.index({ 'stats.level': -1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ lastLogin: -1 });
userSchema.index({ 'devices.deviceId': 1 });
userSchema.index({ 'sessions.sessionId': 1 });
userSchema.index({ 'sessions.isActive': 1 });

// ============================================
// Pre-save Middleware
// ============================================

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    this.lastPasswordChange = new Date();
    next();
  } catch (error) {
    next(error);
  }
});

// Update timestamps
userSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Generate referral code
userSchema.pre('save', async function(next) {
  if (!this.referralCode && this.isNew) {
    this.generateReferralCode();
  }
  next();
});

// Initialize stats if new
userSchema.pre('save', function(next) {
  if (this.isNew && (!this.stats || Object.keys(this.stats).length === 0)) {
    this.stats = {
      totalSessions: 0,
      totalMinutes: 0,
      totalXP: 0,
      totalWordsLearned: 0,
      averageScore: 0,
      currentStreak: 0,
      longestStreak: 0,
      level: 1,
      pronunciationScore: 0,
      vocabularyScore: 0,
      grammarScore: 0,
      fluencyScore: 0,
      listeningScore: 0,
      readingScore: 0
    };
  }
  next();
});

// ============================================
// Model Creation
// ============================================

const User = mongoose.model('User', userSchema);

module.exports = User;
