// ============================================
// Campaign Model
// SpeakFlow - AI Language Learning Platform
// ============================================

const mongoose = require('mongoose');

// ============================================
// Constants & Enums
// ============================================

const CAMPAIGN_TYPES = {
  EMAIL: 'email',
  PUSH: 'push',
  IN_APP: 'in_app',
  SMS: 'sms',
  SOCIAL: 'social',
  LANDING_PAGE: 'landing_page',
  REFERRAL: 'referral'
};

const CAMPAIGN_STATUSES = {
  DRAFT: 'draft',
  SCHEDULED: 'scheduled',
  SENDING: 'sending',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  FAILED: 'failed'
};

const CAMPAIGN_CATEGORIES = {
  ONBOARDING: 'onboarding',
  ENGAGEMENT: 'engagement',
  RETENTION: 'retention',
  REACTIVATION: 'reactivation',
  PROMOTIONAL: 'promotional',
  TRANSACTIONAL: 'transactional',
  SEASONAL: 'seasonal',
  BIRTHDAY: 'birthday',
  ANNIVERSARY: 'anniversary'
};

const EMAIL_TEMPLATE_CATEGORIES = {
  WELCOME: 'welcome',
  REMINDER: 'reminder',
  NEWSLETTER: 'newsletter',
  PROMOTION: 'promotion',
  TRANSACTIONAL: 'transactional',
  SURVEY: 'survey',
  ABANDONED_CART: 'abandoned_cart'
};

// ============================================
// Sub-Schemas
// ============================================

/**
 * Audience Targeting Schema
 */
const audienceTargetingSchema = new mongoose.Schema({
  // Segment targeting
  segmentId: {
    type: String,
    index: true
  },
  segmentName: String,
  
  // User attributes
  userTypes: [{
    type: String,
    enum: ['new', 'active', 'inactive', 'all']
  }],
  roles: [{
    type: String,
    enum: ['user', 'premium', 'free', 'all']
  }],
  subscriptionPlans: [{
    type: String,
    enum: ['free', 'pro', 'family', 'enterprise']
  }],
  
  // Behavioral criteria
  minStreak: {
    type: Number,
    min: 0
  },
  maxStreak: {
    type: Number,
    min: 0
  },
  minSessions: {
    type: Number,
    min: 0
  },
  maxSessions: {
    type: Number,
    min: 0
  },
  minScore: {
    type: Number,
    min: 0,
    max: 100
  },
  maxScore: {
    type: Number,
    min: 0,
    max: 100
  },
  
  // Time-based criteria
  daysSinceSignup: {
    min: { type: Number, min: 0 },
    max: { type: Number, min: 0 }
  },
  daysSinceLastActive: {
    min: { type: Number, min: 0 },
    max: { type: Number, min: 0 }
  },
  daysSinceLastSession: {
    min: { type: Number, min: 0 },
    max: { type: Number, min: 0 }
  },
  
  // Geographic criteria
  countries: [{
    type: String,
    uppercase: true,
    length: 2
  }],
  languages: [{
    type: String,
    length: 2
  }],
  timezones: [String],
  
  // Device criteria
  devices: [{
    type: String,
    enum: ['desktop', 'mobile', 'tablet']
  }],
  platforms: [{
    type: String,
    enum: ['ios', 'android', 'web']
  }],
  
  // Custom conditions
  customConditions: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  
  // Limit
  maxRecipients: {
    type: Number,
    min: 1
  }
}, { _id: false });

/**
 * Content Schema
 */
const contentSchema = new mongoose.Schema({
  // Email content
  emailTemplateId: {
    type: String,
    index: true
  },
  subject: {
    type: String,
    maxlength: 200
  },
  preheader: {
    type: String,
    maxlength: 150
  },
  htmlContent: String,
  textContent: String,
  
  // Push notification content
  pushTitle: {
    type: String,
    maxlength: 100
  },
  pushBody: {
    type: String,
    maxlength: 250
  },
  pushIcon: String,
  pushImage: String,
  
  // In-app content
  inAppTitle: String,
  inAppMessage: String,
  inAppButtonText: String,
  
  // SMS content
  smsMessage: {
    type: String,
    maxlength: 160
  },
  
  // Social content
  socialPlatform: {
    type: String,
    enum: ['facebook', 'twitter', 'instagram', 'linkedin']
  },
  socialMessage: String,
  socialImage: String,
  
  // Landing page
  landingPageUrl: String,
  landingPageId: String,
  
  // Call to Action
  ctaText: String,
  ctaUrl: String,
  
  // Dynamic variables
  variables: [{
    name: String,
    defaultValue: String,
    description: String
  }],
  
  // Personalization
  personalization: {
    useName: { type: Boolean, default: true },
    useStreak: { type: Boolean, default: false },
    useLevel: { type: Boolean, default: false },
    useAchievement: { type: Boolean, default: false }
  },
  
  // Attachments
  attachments: [{
    name: String,
    url: String,
    type: String,
    size: Number
  }]
}, { _id: false });

/**
 * Schedule Schema
 */
const scheduleSchema = new mongoose.Schema({
  sendNow: {
    type: Boolean,
    default: false
  },
  scheduledAt: {
    type: Date,
    index: true
  },
  timezone: {
    type: String,
    default: 'UTC'
  },
  repeat: {
    enabled: { type: Boolean, default: false },
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'yearly']
    },
    interval: {
      type: Number,
      default: 1,
      min: 1
    },
    endDate: Date,
    maxSends: Number
  },
  bestTimeSend: {
    enabled: { type: Boolean, default: false },
    basedOn: {
      type: String,
      enum: ['user_timezone', 'engagement_history', 'open_history']
    }
  }
}, { _id: false });

/**
 * Budget Schema
 */
const budgetSchema = new mongoose.Schema({
  amount: {
    type: Number,
    default: 0,
    min: 0
  },
  currency: {
    type: String,
    default: 'USD',
    uppercase: true
  },
  costPerSend: {
    type: Number,
    default: 0
  },
  totalSpent: {
    type: Number,
    default: 0
  },
  dailyLimit: Number,
  monthlyLimit: Number
}, { _id: false });

/**
 * A/B Test Config Schema
 */
const abTestConfigSchema = new mongoose.Schema({
  enabled: {
    type: Boolean,
    default: false
  },
  variants: [{
    name: String,
    percentage: {
      type: Number,
      min: 0,
      max: 100
    },
    content: contentSchema,
    subject: String
  }],
  winningCriteria: {
    type: String,
    enum: ['open_rate', 'click_rate', 'conversion_rate']
  },
  testDuration: {
    type: Number,
    default: 7 // days
  }
}, { _id: false });

/**
 * Analytics Schema
 */
const analyticsSchema = new mongoose.Schema({
  // Delivery stats
  sent: {
    type: Number,
    default: 0
  },
  delivered: {
    type: Number,
    default: 0
  },
  failed: {
    type: Number,
    default: 0
  },
  bounced: {
    type: Number,
    default: 0
  },
  
  // Engagement stats
  opened: {
    type: Number,
    default: 0
  },
  uniqueOpens: {
    type: Number,
    default: 0
  },
  clicked: {
    type: Number,
    default: 0
  },
  uniqueClicks: {
    type: Number,
    default: 0
  },
  converted: {
    type: Number,
    default: 0
  },
  
  // Rates
  openRate: {
    type: Number,
    default: 0
  },
  clickRate: {
    type: Number,
    default: 0
  },
  conversionRate: {
    type: Number,
    default: 0
  },
  bounceRate: {
    type: Number,
    default: 0
  },
  
  // Revenue
  revenue: {
    type: Number,
    default: 0
  },
  revenuePerRecipient: {
    type: Number,
    default: 0
  },
  
  // Unsubscribes
  unsubscribes: {
    type: Number,
    default: 0
  },
  complaints: {
    type: Number,
    default: 0
  },
  
  // Timeline data
  timeline: [{
    date: Date,
    sent: Number,
    opened: Number,
    clicked: Number,
    converted: Number
  }],
  
  // Device stats
  devices: {
    desktop: { type: Number, default: 0 },
    mobile: { type: Number, default: 0 },
    tablet: { type: Number, default: 0 }
  },
  
  // Browser stats
  browsers: {
    type: Map,
    of: Number
  },
  
  // Geographic stats
  countries: {
    type: Map,
    of: Number
  }
}, { _id: false });

/**
 * Recipient Schema
 */
const recipientSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  email: String,
  name: String,
  status: {
    type: String,
    enum: ['pending', 'sent', 'delivered', 'opened', 'clicked', 'converted', 'bounced', 'failed'],
    default: 'pending'
  },
  sentAt: Date,
  deliveredAt: Date,
  openedAt: Date,
  clickedAt: Date,
  convertedAt: Date,
  device: String,
  browser: String,
  country: String,
  ipAddress: String,
  userAgent: String,
  errorMessage: String,
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  }
}, { _id: false });

// ============================================
// Main Campaign Schema
// ============================================

const campaignSchema = new mongoose.Schema({
  // Identification
  campaignId: {
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
    maxlength: 500
  },
  
  // Campaign Type
  type: {
    type: String,
    enum: Object.values(CAMPAIGN_TYPES),
    required: true,
    index: true
  },
  category: {
    type: String,
    enum: Object.values(CAMPAIGN_CATEGORIES),
    default: CAMPAIGN_CATEGORIES.ENGAGEMENT
  },
  status: {
    type: String,
    enum: Object.values(CAMPAIGN_STATUSES),
    default: CAMPAIGN_STATUSES.DRAFT,
    index: true
  },
  
  // Content
  content: {
    type: contentSchema,
    required: true
  },
  
  // Audience
  audience: {
    type: audienceTargetingSchema,
    required: true
  },
  
  // Schedule
  schedule: {
    type: scheduleSchema,
    default: () => ({})
  },
  
  // Budget
  budget: {
    type: budgetSchema,
    default: () => ({})
  },
  
  // A/B Testing
  abTest: {
    type: abTestConfigSchema,
    default: () => ({})
  },
  
  // Analytics
  analytics: {
    type: analyticsSchema,
    default: () => ({})
  },
  
  // Recipients
  recipients: [recipientSchema],
  recipientCount: {
    type: Number,
    default: 0
  },
  
  // Tracking
  tracking: {
    utmSource: String,
    utmMedium: String,
    utmCampaign: String,
    utmTerm: String,
    utmContent: String,
    customTrackingParams: {
      type: Map,
      of: String
    }
  },
  
  // Performance
  performance: {
    estimatedRecipients: { type: Number, default: 0 },
    estimatedOpenRate: { type: Number, default: 0 },
    estimatedClickRate: { type: Number, default: 0 },
    actualPerformance: {
      type: Map,
      of: Number
    }
  },
  
  // Creator
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Timeline
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  sentAt: Date,
  completedAt: Date,
  cancelledAt: Date,
  
  // Metadata
  tags: [{
    type: String,
    index: true
  }],
  notes: [{
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    content: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: new Map()
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ============================================
// Virtual Fields
// ============================================

// Is active campaign
campaignSchema.virtual('isActive').get(function() {
  return this.status === CAMPAIGN_STATUSES.ACTIVE || 
         this.status === CAMPAIGN_STATUSES.SENDING;
});

// Is scheduled
campaignSchema.virtual('isScheduled').get(function() {
  return this.status === CAMPAIGN_STATUSES.SCHEDULED && 
         this.schedule.scheduledAt && 
         this.schedule.scheduledAt > new Date();
});

// Completion rate
campaignSchema.virtual('completionRate').get(function() {
  if (this.recipientCount === 0) return 0;
  return (this.analytics.sent / this.recipientCount) * 100;
});

// ROI (Return on Investment)
campaignSchema.virtual('roi').get(function() {
  if (this.budget.totalSpent === 0) return 0;
  return ((this.analytics.revenue - this.budget.totalSpent) / this.budget.totalSpent) * 100;
});

// Engagement score
campaignSchema.virtual('engagementScore').get(function() {
  const openWeight = 0.3;
  const clickWeight = 0.4;
  const conversionWeight = 0.3;
  
  const openScore = this.analytics.openRate / 100;
  const clickScore = this.analytics.clickRate / 100;
  const conversionScore = this.analytics.conversionRate / 100;
  
  return (openScore * openWeight + clickScore * clickWeight + conversionScore * conversionWeight) * 100;
});

// ============================================
// Instance Methods
// ============================================

/**
 * Schedule the campaign
 */
campaignSchema.methods.schedule = function(scheduledAt, scheduledBy) {
  if (this.status !== CAMPAIGN_STATUSES.DRAFT && this.status !== CAMPAIGN_STATUSES.SCHEDULED) {
    throw new Error(`Cannot schedule campaign with status: ${this.status}`);
  }
  
  this.status = CAMPAIGN_STATUSES.SCHEDULED;
  this.schedule.scheduledAt = scheduledAt;
  this.schedule.sendNow = false;
  this.updatedBy = scheduledBy;
  this.updatedAt = new Date();
  
  return this.save();
};

/**
 * Start the campaign
 */
campaignSchema.methods.start = function(startedBy) {
  if (this.status !== CAMPAIGN_STATUSES.SCHEDULED && this.status !== CAMPAIGN_STATUSES.DRAFT) {
    throw new Error(`Cannot start campaign with status: ${this.status}`);
  }
  
  this.status = CAMPAIGN_STATUSES.SENDING;
  this.sentAt = new Date();
  this.updatedBy = startedBy;
  this.updatedAt = new Date();
  
  return this.save();
};

/**
 * Complete the campaign
 */
campaignSchema.methods.complete = function(completedBy) {
  if (this.status !== CAMPAIGN_STATUSES.SENDING && this.status !== CAMPAIGN_STATUSES.ACTIVE) {
    throw new Error(`Cannot complete campaign with status: ${this.status}`);
  }
  
  this.status = CAMPAIGN_STATUSES.COMPLETED;
  this.completedAt = new Date();
  this.updatedBy = completedBy;
  this.updatedAt = new Date();
  
  // Calculate final analytics
  this.calculateAnalytics();
  
  return this.save();
};

/**
 * Cancel the campaign
 */
campaignSchema.methods.cancel = function(cancelledBy, reason) {
  if (this.status === CAMPAIGN_STATUSES.COMPLETED) {
    throw new Error('Cannot cancel a completed campaign');
  }
  
  this.status = CAMPAIGN_STATUSES.CANCELLED;
  this.cancelledAt = new Date();
  this.updatedBy = cancelledBy;
  this.updatedAt = new Date();
  this.metadata.set('cancelReason', reason);
  
  return this.save();
};

/**
 * Add recipient
 */
campaignSchema.methods.addRecipient = function(userId, userData = {}) {
  const existingRecipient = this.recipients.find(r => r.userId.toString() === userId.toString());
  if (existingRecipient) {
    return existingRecipient;
  }
  
  const recipient = {
    userId,
    email: userData.email,
    name: userData.name,
    status: 'pending',
    metadata: new Map(Object.entries(userData.metadata || {}))
  };
  
  this.recipients.push(recipient);
  this.recipientCount = this.recipients.length;
  
  return this.save();
};

/**
 * Update recipient status
 */
campaignSchema.methods.updateRecipientStatus = function(userId, status, eventData = {}) {
  const recipient = this.recipients.find(r => r.userId.toString() === userId.toString());
  if (!recipient) {
    throw new Error('Recipient not found');
  }
  
  recipient.status = status;
  
  switch (status) {
    case 'sent':
      recipient.sentAt = new Date();
      this.analytics.sent++;
      break;
    case 'delivered':
      recipient.deliveredAt = new Date();
      this.analytics.delivered++;
      break;
    case 'opened':
      recipient.openedAt = new Date();
      this.analytics.opened++;
      this.analytics.uniqueOpens++;
      recipient.device = eventData.device;
      recipient.browser = eventData.browser;
      recipient.country = eventData.country;
      recipient.ipAddress = eventData.ipAddress;
      break;
    case 'clicked':
      recipient.clickedAt = new Date();
      this.analytics.clicked++;
      this.analytics.uniqueClicks++;
      break;
    case 'converted':
      recipient.convertedAt = new Date();
      this.analytics.converted++;
      if (eventData.revenue) {
        this.analytics.revenue += eventData.revenue;
      }
      break;
    case 'bounced':
      recipient.errorMessage = eventData.error;
      this.analytics.bounced++;
      break;
    case 'failed':
      recipient.errorMessage = eventData.error;
      this.analytics.failed++;
      break;
  }
  
  return this.save();
};

/**
 * Calculate analytics
 */
campaignSchema.methods.calculateAnalytics = function() {
  // Calculate rates
  this.analytics.openRate = this.analytics.sent > 0 
    ? (this.analytics.uniqueOpens / this.analytics.sent) * 100 
    : 0;
  
  this.analytics.clickRate = this.analytics.uniqueOpens > 0 
    ? (this.analytics.uniqueClicks / this.analytics.uniqueOpens) * 100 
    : 0;
  
  this.analytics.conversionRate = this.analytics.sent > 0 
    ? (this.analytics.converted / this.analytics.sent) * 100 
    : 0;
  
  this.analytics.bounceRate = this.analytics.sent > 0 
    ? (this.analytics.bounced / this.analytics.sent) * 100 
    : 0;
  
  this.analytics.revenuePerRecipient = this.analytics.sent > 0 
    ? this.analytics.revenue / this.analytics.sent 
    : 0;
  
  // Round to 2 decimal places
  this.analytics.openRate = Math.round(this.analytics.openRate * 100) / 100;
  this.analytics.clickRate = Math.round(this.analytics.clickRate * 100) / 100;
  this.analytics.conversionRate = Math.round(this.analytics.conversionRate * 100) / 100;
  this.analytics.bounceRate = Math.round(this.analytics.bounceRate * 100) / 100;
  this.analytics.revenuePerRecipient = Math.round(this.analytics.revenuePerRecipient * 100) / 100;
};

/**
 * Get campaign summary
 */
campaignSchema.methods.getSummary = function() {
  return {
    campaignId: this.campaignId,
    name: this.name,
    type: this.type,
    status: this.status,
    recipientCount: this.recipientCount,
    analytics: {
      sent: this.analytics.sent,
      delivered: this.analytics.delivered,
      opened: this.analytics.opened,
      clicked: this.analytics.clicked,
      converted: this.analytics.converted,
      openRate: this.analytics.openRate,
      clickRate: this.analytics.clickRate,
      conversionRate: this.analytics.conversionRate,
      revenue: this.analytics.revenue,
      roi: this.roi
    },
    sentAt: this.sentAt,
    completedAt: this.completedAt
  };
};

/**
 * Duplicate campaign
 */
campaignSchema.methods.duplicate = function(newName, duplicatedBy) {
  const campaignData = this.toObject();
  delete campaignData._id;
  delete campaignData.campaignId;
  delete campaignData.createdAt;
  delete campaignData.updatedAt;
  delete campaignData.sentAt;
  delete campaignData.completedAt;
  delete campaignData.cancelledAt;
  delete campaignData.recipients;
  delete campaignData.analytics;
  
  campaignData.name = newName || `${this.name} (Copy)`;
  campaignData.status = CAMPAIGN_STATUSES.DRAFT;
  campaignData.createdBy = duplicatedBy;
  campaignData.recipientCount = 0;
  
  const Campaign = mongoose.model('Campaign');
  const newCampaign = new Campaign(campaignData);
  
  return newCampaign.save();
};

// ============================================
// Static Methods
// ============================================

/**
 * Find campaigns by status
 */
campaignSchema.statics.findByStatus = function(status, limit = 100) {
  return this.find({ status })
    .sort({ createdAt: -1 })
    .limit(limit);
};

/**
 * Find scheduled campaigns
 */
campaignSchema.statics.findScheduledCampaigns = function() {
  return this.find({
    status: CAMPAIGN_STATUSES.SCHEDULED,
    'schedule.scheduledAt': { $lte: new Date() }
  });
};

/**
 * Find campaigns by user
 */
campaignSchema.statics.findByUser = function(userId, options = {}) {
  const { limit = 50, offset = 0, status, type } = options;
  
  let query = this.find({ createdBy: userId });
  
  if (status) {
    query = query.where('status').equals(status);
  }
  if (type) {
    query = query.where('type').equals(type);
  }
  
  return query
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(limit);
};

/**
 * Get campaign statistics
 */
campaignSchema.statics.getCampaignStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalRecipients: { $sum: '$recipientCount' },
        totalSent: { $sum: '$analytics.sent' },
        totalOpened: { $sum: '$analytics.opened' },
        totalClicked: { $sum: '$analytics.clicked' },
        totalConverted: { $sum: '$analytics.converted' },
        totalRevenue: { $sum: '$analytics.revenue' }
      }
    }
  ]);
  
  const result = {
    total: 0,
    byStatus: {},
    overall: {
      totalRecipients: 0,
      totalSent: 0,
      totalOpened: 0,
      totalClicked: 0,
      totalConverted: 0,
      totalRevenue: 0,
      averageOpenRate: 0,
      averageClickRate: 0,
      averageConversionRate: 0
    }
  };
  
  for (const stat of stats) {
    result.byStatus[stat._id] = {
      count: stat.count,
      recipients: stat.totalRecipients,
      sent: stat.totalSent,
      opened: stat.totalOpened,
      clicked: stat.totalClicked,
      converted: stat.totalConverted,
      revenue: stat.totalRevenue
    };
    result.total += stat.count;
    
    result.overall.totalRecipients += stat.totalRecipients;
    result.overall.totalSent += stat.totalSent;
    result.overall.totalOpened += stat.totalOpened;
    result.overall.totalClicked += stat.totalClicked;
    result.overall.totalConverted += stat.totalConverted;
    result.overall.totalRevenue += stat.totalRevenue;
  }
  
  // Calculate overall rates
  result.overall.averageOpenRate = result.overall.totalSent > 0 
    ? (result.overall.totalOpened / result.overall.totalSent) * 100 
    : 0;
  result.overall.averageClickRate = result.overall.totalOpened > 0 
    ? (result.overall.totalClicked / result.overall.totalOpened) * 100 
    : 0;
  result.overall.averageConversionRate = result.overall.totalSent > 0 
    ? (result.overall.totalConverted / result.overall.totalSent) * 100 
    : 0;
  
  return result;
};

/**
 * Get top performing campaigns
 */
campaignSchema.statics.getTopPerforming = async function(limit = 10, metric = 'conversionRate') {
  const sortField = `analytics.${metric}`;
  
  return await this.find({
    status: CAMPAIGN_STATUSES.COMPLETED,
    'analytics.sent': { $gt: 100 }
  })
    .sort({ [sortField]: -1 })
    .limit(limit)
    .select('campaignId name type analytics recipientCount sentAt');
};

// ============================================
// Indexes
// ============================================

campaignSchema.index({ campaignId: 1 });
campaignSchema.index({ name: 1 });
campaignSchema.index({ status: 1, 'schedule.scheduledAt': 1 });
campaignSchema.index({ createdBy: 1, createdAt: -1 });
campaignSchema.index({ type: 1, status: 1 });
campaignSchema.index({ 'audience.segmentId': 1 });
campaignSchema.index({ 'content.emailTemplateId': 1 });
campaignSchema.index({ tags: 1 });
campaignSchema.index({ 'analytics.conversionRate': -1 });
campaignSchema.index({ createdAt: -1 });
campaignSchema.index({ sentAt: -1 });

// Compound indexes
campaignSchema.index({ status: 1, type: 1, createdAt: -1 });
campaignSchema.index({ createdBy: 1, status: 1, createdAt: -1 });

// ============================================
// Pre-save Middleware
// ============================================

// Generate campaign ID if not exists
campaignSchema.pre('save', function(next) {
  if (!this.campaignId) {
    this.campaignId = `camp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  next();
});

// Update timestamps
campaignSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Set default UTM parameters
campaignSchema.pre('save', function(next) {
  if (!this.tracking.utmSource && this.type === CAMPAIGN_TYPES.EMAIL) {
    this.tracking.utmSource = 'email';
    this.tracking.utmMedium = this.type;
    this.tracking.utmCampaign = this.name.toLowerCase().replace(/\s+/g, '_');
  }
  next();
});

// ============================================
// Model Creation
// ============================================

const Campaign = mongoose.model('Campaign', campaignSchema);

module.exports = Campaign;
