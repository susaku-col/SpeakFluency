// ============================================
// A/B Test Model
// SpeakFlow - AI Language Learning Platform
// ============================================

const mongoose = require('mongoose');

// ============================================
// Constants & Enums
// ============================================

const TEST_STATUSES = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  ARCHIVED: 'archived'
};

const TEST_TYPES = {
  LAYOUT: 'layout',
  FEATURE: 'feature',
  PRICING: 'pricing',
  CONTENT: 'content',
  UI: 'ui',
  ALGORITHM: 'algorithm',
  MESSAGING: 'messaging',
  ONBOARDING: 'onboarding'
};

const EVENT_TYPES = {
  VIEW: 'view',
  CLICK: 'click',
  CONVERSION: 'conversion',
  ENGAGEMENT: 'engagement',
  SIGNUP: 'signup',
  PURCHASE: 'purchase',
  COMPLETED: 'completed',
  DROPOFF: 'dropoff',
  SCROLL: 'scroll',
  HOVER: 'hover',
  SUBMIT: 'submit'
};

const TARGETING_CRITERIA = {
  USER_TYPE: 'userType',
  COUNTRY: 'country',
  DEVICE: 'device',
  ROLE: 'role',
  SUBSCRIPTION: 'subscription',
  BEHAVIOR: 'behavior'
};

// ============================================
// Sub-Schemas
// ============================================

/**
 * Variant Schema
 */
const variantSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  description: String,
  weight: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  isControl: {
    type: Boolean,
    default: false
  },
  config: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  }
}, { _id: false });

/**
 * Targeting Criteria Schema
 */
const targetingSchema = new mongoose.Schema({
  userTypes: [{
    type: String,
    enum: ['new', 'returning', 'all']
  }],
  countries: [{
    type: String,
    uppercase: true,
    length: 2
  }],
  devices: [{
    type: String,
    enum: ['desktop', 'mobile', 'tablet', 'all']
  }],
  roles: [{
    type: String,
    enum: ['user', 'premium', 'admin']
  }],
  subscriptionPlans: [{
    type: String,
    enum: ['free', 'pro', 'family', 'enterprise']
  }],
  percentage: {
    type: Number,
    min: 0,
    max: 100,
    default: 100
  },
  customConditions: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  }
}, { _id: false });

/**
 * Metric Definition Schema
 */
const metricDefinitionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  eventType: {
    type: String,
    enum: Object.values(EVENT_TYPES),
    required: true
  },
  isPrimary: {
    type: Boolean,
    default: false
  },
  goal: {
    type: Number,
    min: 0
  },
  unit: {
    type: String,
    enum: ['percentage', 'absolute', 'rate', 'time']
  }
}, { _id: false });

/**
 * Event Schema
 */
const eventSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  sessionId: {
    type: String,
    index: true
  },
  variantId: {
    type: String,
    required: true
  },
  eventType: {
    type: String,
    enum: Object.values(EVENT_TYPES),
    required: true,
    index: true
  },
  value: {
    type: Number,
    default: 1
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: new Map()
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  ipAddress: String,
  userAgent: String,
  referrer: String
}, { _id: false });

/**
 * Statistical Results Schema
 */
const statisticalResultsSchema = new mongoose.Schema({
  variantId: {
    type: String,
    required: true
  },
  sampleSize: {
    type: Number,
    default: 0
  },
  conversions: {
    type: Number,
    default: 0
  },
  conversionRate: {
    type: Number,
    default: 0
  },
  improvement: {
    type: Number,
    default: 0
  },
  pValue: {
    type: Number,
    min: 0,
    max: 1
  },
  zScore: {
    type: Number
  },
  confidenceLevel: {
    type: Number,
    min: 0,
    max: 100
  },
  isSignificant: {
    type: Boolean,
    default: false
  },
  confidenceInterval: {
    lower: { type: Number },
    upper: { type: Number }
  }
}, { _id: false });

/**
 * Result Summary Schema
 */
const resultSummarySchema = new mongoose.Schema({
  winnerVariantId: String,
  winnerVariantName: String,
  winnerImprovement: Number,
  totalViews: Number,
  totalConversions: Number,
  overallConversionRate: Number,
  confidenceLevel: Number,
  isConclusive: {
    type: Boolean,
    default: false
  },
  recommendations: [{
    type: String
  }]
}, { _id: false });

// ============================================
// Main A/B Test Schema
// ============================================

const abTestSchema = new mongoose.Schema({
  // Identification
  testId: {
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
    maxlength: 1000
  },
  
  // Test Configuration
  type: {
    type: String,
    enum: Object.values(TEST_TYPES),
    default: TEST_TYPES.UI
  },
  status: {
    type: String,
    enum: Object.values(TEST_STATUSES),
    default: TEST_STATUSES.DRAFT,
    index: true
  },
  variants: [variantSchema],
  
  // Targeting
  targeting: {
    type: targetingSchema,
    default: () => ({})
  },
  
  // Metrics
  metrics: [metricDefinitionSchema],
  primaryMetric: {
    type: String,
    required: true
  },
  
  // Statistical Configuration
  minimumDetectableEffect: {
    type: Number,
    default: 5, // percentage
    min: 0.1,
    max: 50
  },
  significanceLevel: {
    type: Number,
    default: 0.95, // 95% confidence
    min: 0.8,
    max: 0.99
  },
  powerLevel: {
    type: Number,
    default: 0.8,
    min: 0.7,
    max: 0.95
  },
  
  // Sample Size
  targetSampleSize: {
    type: Number,
    default: 1000,
    min: 100
  },
  currentSampleSize: {
    type: Number,
    default: 0
  },
  
  // Hypothesis
  hypothesis: {
    type: String,
    maxlength: 500
  },
  
  // Timeline
  startDate: {
    type: Date
  },
  endDate: {
    type: Date
  },
  activatedAt: Date,
  pausedAt: Date,
  completedAt: Date,
  archivedAt: Date,
  
  // User tracking
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Events Data
  events: [eventSchema],
  
  // Results
  results: [statisticalResultsSchema],
  summary: resultSummarySchema,
  
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

// Test duration in days
abTestSchema.virtual('durationDays').get(function() {
  if (!this.startDate) return 0;
  const end = this.endDate || new Date();
  return Math.ceil((end - this.startDate) / (1000 * 60 * 60 * 24));
});

// Is test running
abTestSchema.virtual('isRunning').get(function() {
  return this.status === TEST_STATUSES.ACTIVE && 
         (!this.endDate || this.endDate > new Date());
});

// Progress percentage (based on sample size)
abTestSchema.virtual('progressPercentage').get(function() {
  if (this.targetSampleSize === 0) return 0;
  return Math.min(100, (this.currentSampleSize / this.targetSampleSize) * 100);
});

// Number of variants
abTestSchema.virtual('variantCount').get(function() {
  return this.variants.length;
});

// Control variant
abTestSchema.virtual('controlVariant').get(function() {
  return this.variants.find(v => v.isControl);
});

// Winning variant
abTestSchema.virtual('winningVariant').get(function() {
  if (!this.summary || !this.summary.winnerVariantId) return null;
  return this.variants.find(v => v.id === this.summary.winnerVariantId);
});

// ============================================
// Instance Methods
// ============================================

/**
 * Start the A/B test
 */
abTestSchema.methods.start = function(activatedBy) {
  if (this.status !== TEST_STATUSES.DRAFT && this.status !== TEST_STATUSES.PAUSED) {
    throw new Error(`Cannot start test with status: ${this.status}`);
  }
  
  this.status = TEST_STATUSES.ACTIVE;
  this.activatedAt = new Date();
  this.startDate = this.startDate || new Date();
  this.updatedBy = activatedBy;
  
  return this.save();
};

/**
 * Pause the A/B test
 */
abTestSchema.methods.pause = function(pausedBy) {
  if (this.status !== TEST_STATUSES.ACTIVE) {
    throw new Error(`Cannot pause test with status: ${this.status}`);
  }
  
  this.status = TEST_STATUSES.PAUSED;
  this.pausedAt = new Date();
  this.updatedBy = pausedBy;
  
  return this.save();
};

/**
 * Complete the A/B test
 */
abTestSchema.methods.complete = function(completedBy) {
  if (this.status !== TEST_STATUSES.ACTIVE && this.status !== TEST_STATUSES.PAUSED) {
    throw new Error(`Cannot complete test with status: ${this.status}`);
  }
  
  this.status = TEST_STATUSES.COMPLETED;
  this.completedAt = new Date();
  this.endDate = this.endDate || new Date();
  this.updatedBy = completedBy;
  
  // Calculate final results
  this.calculateResults();
  
  return this.save();
};

/**
 * Archive the A/B test
 */
abTestSchema.methods.archive = function(archivedBy) {
  this.status = TEST_STATUSES.ARCHIVED;
  this.archivedAt = new Date();
  this.updatedBy = archivedBy;
  
  return this.save();
};

/**
 * Track an event for the test
 */
abTestSchema.methods.trackEvent = function(userId, variantId, eventType, metadata = {}, sessionData = {}) {
  if (this.status !== TEST_STATUSES.ACTIVE) {
    throw new Error(`Cannot track events for test with status: ${this.status}`);
  }
  
  const event = {
    userId,
    variantId,
    eventType,
    value: 1,
    metadata: new Map(Object.entries(metadata)),
    timestamp: new Date(),
    ipAddress: sessionData.ipAddress,
    userAgent: sessionData.userAgent,
    referrer: sessionData.referrer,
    sessionId: sessionData.sessionId
  };
  
  this.events.push(event);
  
  // Update sample size (count unique users who viewed)
  if (eventType === EVENT_TYPES.VIEW) {
    const uniqueUsers = new Set(
      this.events.filter(e => e.eventType === EVENT_TYPES.VIEW).map(e => e.userId)
    );
    this.currentSampleSize = uniqueUsers.size;
  }
  
  return this.save();
};

/**
 * Calculate statistical results
 */
abTestSchema.methods.calculateResults = function() {
  const controlVariant = this.controlVariant;
  if (!controlVariant) {
    throw new Error('No control variant found');
  }
  
  const results = [];
  
  for (const variant of this.variants) {
    const variantEvents = this.events.filter(e => e.variantId === variant.id);
    const views = variantEvents.filter(e => e.eventType === EVENT_TYPES.VIEW).length;
    const conversions = variantEvents.filter(e => e.eventType === this.primaryMetric).length;
    
    const conversionRate = views > 0 ? (conversions / views) * 100 : 0;
    
    let improvement = 0;
    let pValue = null;
    let zScore = null;
    let confidenceLevel = 0;
    let isSignificant = false;
    let confidenceInterval = { lower: 0, upper: 0 };
    
    if (!variant.isControl && controlVariant) {
      const controlEvents = this.events.filter(e => e.variantId === controlVariant.id);
      const controlViews = controlEvents.filter(e => e.eventType === EVENT_TYPES.VIEW).length;
      const controlConversions = controlEvents.filter(e => e.eventType === this.primaryMetric).length;
      const controlRate = controlViews > 0 ? (controlConversions / controlViews) * 100 : 0;
      
      // Calculate improvement
      improvement = controlRate > 0 ? ((conversionRate - controlRate) / controlRate) * 100 : 0;
      
      // Statistical significance (z-test for proportions)
      if (views > 0 && controlViews > 0) {
        const p1 = conversions / views;
        const p2 = controlConversions / controlViews;
        const pPool = (conversions + controlConversions) / (views + controlViews);
        const se = Math.sqrt(pPool * (1 - pPool) * ((1 / views) + (1 / controlViews)));
        zScore = Math.abs(p1 - p2) / se;
        
        // Calculate p-value (two-tailed)
        pValue = 2 * (1 - this.normalCDF(zScore));
        isSignificant = pValue < (1 - this.significanceLevel);
        confidenceLevel = isSignificant ? this.significanceLevel * 100 : (1 - pValue) * 100;
        
        // Confidence interval
        const marginOfError = 1.96 * se;
        confidenceInterval = {
          lower: (p1 - p2) - marginOfError,
          upper: (p1 - p2) + marginOfError
        };
      }
    }
    
    results.push({
      variantId: variant.id,
      sampleSize: views,
      conversions,
      conversionRate: Math.round(conversionRate * 100) / 100,
      improvement: Math.round(improvement * 100) / 100,
      pValue: pValue ? Math.round(pValue * 10000) / 10000 : null,
      zScore: zScore ? Math.round(zScore * 100) / 100 : null,
      confidenceLevel: Math.round(confidenceLevel * 100) / 100,
      isSignificant,
      confidenceInterval
    });
  }
  
  this.results = results;
  
  // Generate summary
  this.generateSummary();
};

/**
 * Generate test summary
 */
abTestSchema.methods.generateSummary = function() {
  const controlResults = this.results.find(r => {
    const variant = this.variants.find(v => v.id === r.variantId);
    return variant?.isControl;
  });
  
  let bestVariant = null;
  let bestRate = controlResults?.conversionRate || 0;
  
  for (const result of this.results) {
    const variant = this.variants.find(v => v.id === result.variantId);
    if (!variant?.isControl && result.isSignificant && result.conversionRate > bestRate) {
      bestRate = result.conversionRate;
      bestVariant = variant;
    }
  }
  
  const winnerVariant = bestVariant || this.variants.find(v => v.isControl);
  const winnerResults = this.results.find(r => r.variantId === winnerVariant?.id);
  
  const totalViews = this.results.reduce((sum, r) => sum + r.sampleSize, 0);
  const totalConversions = this.results.reduce((sum, r) => sum + r.conversions, 0);
  const overallConversionRate = totalViews > 0 ? (totalConversions / totalViews) * 100 : 0;
  
  const recommendations = [];
  
  if (this.status === TEST_STATUSES.COMPLETED) {
    if (winnerVariant && !winnerVariant.isControl && winnerResults && winnerResults.improvement > 5) {
      recommendations.push(`Implement ${winnerVariant.name} variant - ${Math.abs(winnerResults.improvement)}% improvement over control`);
    } else if (winnerResults && Math.abs(winnerResults.improvement) <= 5) {
      recommendations.push('No significant difference between variants. Consider running a larger test or trying different variations.');
    } else if (winnerResults && winnerResults.improvement < 0) {
      recommendations.push('Control variant performs better. Keep current design.');
    }
    
    if (winnerResults && !winnerResults.isSignificant) {
      recommendations.push('Results are not statistically significant. Consider increasing sample size.');
    }
  } else if (this.status === TEST_STATUSES.ACTIVE) {
    const progress = this.progressPercentage;
    recommendations.push(`Test is ${Math.round(progress)}% complete (${this.currentSampleSize}/${this.targetSampleSize} users)`);
    
    if (progress >= 100) {
      recommendations.push('Sample size reached. Consider stopping the test.');
    }
  }
  
  this.summary = {
    winnerVariantId: winnerVariant?.id,
    winnerVariantName: winnerVariant?.name,
    winnerImprovement: winnerResults?.improvement || 0,
    totalViews,
    totalConversions,
    overallConversionRate: Math.round(overallConversionRate * 100) / 100,
    confidenceLevel: winnerResults?.confidenceLevel || 0,
    isConclusive: winnerResults?.isSignificant || false,
    recommendations
  };
};

/**
 * Normal CDF approximation
 */
abTestSchema.methods.normalCDF = function(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
};

/**
 * Get user's variant
 */
abTestSchema.methods.getUserVariant = function(userId) {
  const userEvents = this.events.filter(e => e.userId === userId);
  if (userEvents.length === 0) return null;
  
  // Return the first variant the user saw
  const viewEvent = userEvents.find(e => e.eventType === EVENT_TYPES.VIEW);
  return viewEvent?.variantId || null;
};

/**
 * Check if user is in test
 */
abTestSchema.methods.isUserInTest = function(userId) {
  return this.events.some(e => e.userId === userId);
};

/**
 * Get test statistics
 */
abTestSchema.methods.getStatistics = function() {
  return {
    testId: this.testId,
    name: this.name,
    status: this.status,
    duration: this.durationDays,
    sampleSize: this.currentSampleSize,
    targetSampleSize: this.targetSampleSize,
    progress: this.progressPercentage,
    variantCount: this.variantCount,
    controlVariant: this.controlVariant?.name,
    winningVariant: this.winningVariant?.name,
    isConclusive: this.summary?.isConclusive || false,
    improvement: this.summary?.winnerImprovement || 0
  };
};

// ============================================
// Static Methods
// ============================================

/**
 * Find active tests
 */
abTestSchema.statics.findActiveTests = function() {
  return this.find({
    status: TEST_STATUSES.ACTIVE,
    $or: [
      { endDate: { $exists: false } },
      { endDate: { $gt: new Date() } }
    ]
  }).sort({ createdAt: -1 });
};

/**
 * Find tests by user
 */
abTestSchema.statics.findByUser = function(userId, options = {}) {
  const { limit = 50, offset = 0, status } = options;
  
  let query = this.find({ createdBy: userId });
  
  if (status) {
    query = query.where('status').equals(status);
  }
  
  return query
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(limit);
};

/**
 * Get test summary stats
 */
abTestSchema.statics.getSummaryStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalUsers: { $sum: '$currentSampleSize' }
      }
    }
  ]);
  
  const result = {
    total: 0,
    active: 0,
    completed: 0,
    draft: 0,
    paused: 0,
    archived: 0,
    totalUsers: 0
  };
  
  for (const stat of stats) {
    result[stat._id] = stat.count;
    result.total += stat.count;
    result.totalUsers += stat.totalUsers || 0;
  }
  
  return result;
};

/**
 * Get top performing tests
 */
abTestSchema.statics.getTopPerformingTests = async function(limit = 10) {
  const tests = await this.find({
    status: TEST_STATUSES.COMPLETED,
    'summary.isConclusive': true
  }).sort({ 'summary.winnerImprovement': -1 }).limit(limit);
  
  return tests.map(test => ({
    id: test.testId,
    name: test.name,
    improvement: test.summary?.winnerImprovement || 0,
    winner: test.summary?.winnerVariantName,
    confidenceLevel: test.summary?.confidenceLevel
  }));
};

// ============================================
// Indexes
// ============================================

abTestSchema.index({ testId: 1 });
abTestSchema.index({ name: 1 });
abTestSchema.index({ status: 1, startDate: -1 });
abTestSchema.index({ createdBy: 1, createdAt: -1 });
abTestSchema.index({ 'events.userId': 1 });
abTestSchema.index({ 'events.timestamp': -1 });
abTestSchema.index({ tags: 1 });
abTestSchema.index({ type: 1, status: 1 });

// Compound indexes
abTestSchema.index({ status: 1, startDate: 1, endDate: 1 });
abTestSchema.index({ createdBy: 1, status: 1, createdAt: -1 });

// ============================================
// Pre-save Middleware
// ============================================

// Generate test ID if not exists
abTestSchema.pre('save', function(next) {
  if (!this.testId) {
    this.testId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  next();
});

// Validate variants
abTestSchema.pre('save', function(next) {
  // Check that at least one control variant exists
  const hasControl = this.variants.some(v => v.isControl);
  if (!hasControl && this.variants.length > 0) {
    // Auto-set first variant as control if none specified
    this.variants[0].isControl = true;
  }
  
  // Validate total weight equals 100
  const totalWeight = this.variants.reduce((sum, v) => sum + v.weight, 0);
  if (totalWeight !== 100 && this.variants.length > 0) {
    // Auto-adjust weights
    const equalWeight = 100 / this.variants.length;
    this.variants.forEach(v => {
      v.weight = equalWeight;
    });
  }
  
  next();
});

// Update timestamps
abTestSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// ============================================
// Model Creation
// ============================================

const ABTest = mongoose.model('ABTest', abTestSchema);

module.exports = ABTest;
