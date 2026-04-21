// ============================================
// A/B Test Controller
// SpeakFlow - AI Language Learning Platform
// ============================================

const { validationResult } = require('express-validator');

// ============================================
// Constants & Configuration
// ============================================

const TEST_STATUSES = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  ARCHIVED: 'archived'
};

const EVENT_TYPES = {
  VIEW: 'view',
  CLICK: 'click',
  CONVERSION: 'conversion',
  ENGAGEMENT: 'engagement',
  SIGNUP: 'signup',
  PURCHASE: 'purchase',
  COMPLETED: 'completed',
  DROPOFF: 'dropoff'
};

const DEFAULT_CONFIDENCE_LEVEL = 0.95;
const MIN_SAMPLE_SIZE = 100;
const DEFAULT_SAMPLE_SIZE = 1000;

// ============================================
// Mock Database
// ============================================

// A/B tests storage
const abTests = new Map();

// User assignments (which variant each user sees)
const userAssignments = new Map();

// Test events tracking
const testEvents = new Map();

// Test results cache
const testResults = new Map();

// Test metrics definitions
const testMetrics = new Map();

// ============================================
// Helper Functions
// ============================================

/**
 * Generate unique ID
 */
const generateId = (prefix = 'test') => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Hash function for consistent user assignment
 */
const hashCode = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

/**
 * Assign user to variant based on weights
 */
const assignVariant = (test, userId) => {
  const variants = test.variants;
  const hash = hashCode(`${test.id}:${userId}`);
  const random = (hash % 10000) / 100; // 0-100 range
  
  let cumulativeWeight = 0;
  for (const variant of variants) {
    cumulativeWeight += variant.weight;
    if (random <= cumulativeWeight) {
      return variant.id;
    }
  }
  
  return variants[0].id; // Fallback to first variant
};

/**
 * Get user's variant for a test
 */
const getUserVariant = (testId, userId) => {
  const key = `${testId}:${userId}`;
  
  if (!userAssignments.has(key)) {
    const test = abTests.get(testId);
    if (test && test.status === TEST_STATUSES.ACTIVE) {
      const variant = assignVariant(test, userId);
      userAssignments.set(key, variant);
      return variant;
    }
    return null;
  }
  
  return userAssignments.get(key);
};

/**
 * Track event for A/B test
 */
const trackEvent = (testId, variantId, userId, eventType, metadata = {}) => {
  const key = `${testId}:${variantId}`;
  
  if (!testEvents.has(key)) {
    testEvents.set(key, {
      testId,
      variantId,
      events: [],
      metrics: {
        [EVENT_TYPES.VIEW]: 0,
        [EVENT_TYPES.CLICK]: 0,
        [EVENT_TYPES.CONVERSION]: 0,
        [EVENT_TYPES.ENGAGEMENT]: 0,
        [EVENT_TYPES.SIGNUP]: 0,
        [EVENT_TYPES.PURCHASE]: 0,
        [EVENT_TYPES.COMPLETED]: 0,
        [EVENT_TYPES.DROPOFF]: 0
      }
    });
  }
  
  const testData = testEvents.get(key);
  testData.events.push({
    userId,
    eventType,
    timestamp: new Date().toISOString(),
    metadata
  });
  
  // Update metrics count
  if (testData.metrics[eventType] !== undefined) {
    testData.metrics[eventType]++;
  }
  
  testEvents.set(key, testData);
  
  // Invalidate cached results
  testResults.delete(testId);
};

/**
 * Calculate conversion rate
 */
const calculateConversionRate = (views, conversions) => {
  if (views === 0) return 0;
  return (conversions / views) * 100;
};

/**
 * Calculate statistical significance (z-test for proportions)
 */
const calculateSignificance = (controlViews, controlConversions, variantViews, variantConversions) => {
  const p1 = controlConversions / controlViews;
  const p2 = variantConversions / variantViews;
  const pPool = (controlConversions + variantConversions) / (controlViews + variantViews);
  const se = Math.sqrt(pPool * (1 - pPool) * ((1 / controlViews) + (1 / variantViews)));
  const zScore = Math.abs(p1 - p2) / se;
  
  // Calculate p-value (two-tailed)
  const pValue = 2 * (1 - normalCDF(zScore));
  const isSignificant = pValue < (1 - DEFAULT_CONFIDENCE_LEVEL);
  
  // Calculate confidence interval
  const marginOfError = 1.96 * se;
  const ciLower = (p1 - p2) - marginOfError;
  const ciUpper = (p1 - p2) + marginOfError;
  
  return {
    isSignificant,
    pValue: Math.round(pValue * 10000) / 10000,
    zScore: Math.round(zScore * 100) / 100,
    confidenceLevel: isSignificant ? DEFAULT_CONFIDENCE_LEVEL * 100 : (1 - pValue) * 100,
    confidenceInterval: {
      lower: Math.round(ciLower * 10000) / 10000,
      upper: Math.round(ciUpper * 10000) / 10000
    }
  };
};

/**
 * Normal CDF approximation (Abramowitz & Stegun)
 */
const normalCDF = (x) => {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
};

/**
 * Calculate improvement percentage
 */
const calculateImprovement = (controlRate, variantRate) => {
  if (controlRate === 0) return variantRate > 0 ? 100 : 0;
  return ((variantRate - controlRate) / controlRate) * 100;
};

/**
 * Generate mock results for a test
 */
const generateMockResults = (test) => {
  const results = {
    testId: test.id,
    testName: test.name,
    variants: {},
    summary: {},
    significance: {},
    recommendations: []
  };
  
  // Get control variant (first variant is usually control)
  const controlVariant = test.variants.find(v => v.isControl) || test.variants[0];
  const controlKey = `${test.id}:${controlVariant.id}`;
  const controlEvents = testEvents.get(controlKey);
  
  const controlViews = controlEvents?.metrics[EVENT_TYPES.VIEW] || Math.floor(Math.random() * 5000) + 1000;
  const controlConversions = controlEvents?.metrics[EVENT_TYPES.CONVERSION] || Math.floor(controlViews * (Math.random() * 0.1 + 0.05));
  const controlRate = calculateConversionRate(controlViews, controlConversions);
  
  results.variants[controlVariant.id] = {
    id: controlVariant.id,
    name: controlVariant.name,
    isControl: true,
    metrics: {
      views: controlViews,
      conversions: controlConversions,
      conversionRate: Math.round(controlRate * 100) / 100,
      clicks: controlEvents?.metrics[EVENT_TYPES.CLICK] || Math.floor(controlViews * (Math.random() * 0.3 + 0.1)),
      engagement: controlEvents?.metrics[EVENT_TYPES.ENGAGEMENT] || Math.floor(controlViews * (Math.random() * 0.5 + 0.2)),
      dropoff: controlEvents?.metrics[EVENT_TYPES.DROPOFF] || Math.floor(controlViews * (Math.random() * 0.3 + 0.1))
    }
  };
  
  // Process other variants
  for (const variant of test.variants) {
    if (variant.id === controlVariant.id) continue;
    
    const variantKey = `${test.id}:${variant.id}`;
    const variantEvents = testEvents.get(variantKey);
    
    // Generate realistic mock data if no real data
    const variantViews = variantEvents?.metrics[EVENT_TYPES.VIEW] || Math.floor(Math.random() * 5000) + 1000;
    const improvementFactor = variant.isControl ? 0 : (Math.random() * 0.3 - 0.1); // -10% to +20%
    const variantConversions = variantEvents?.metrics[EVENT_TYPES.CONVERSION] || 
      Math.floor(variantViews * (controlRate / 100 + improvementFactor));
    const variantRate = calculateConversionRate(variantViews, variantConversions);
    
    const improvement = calculateImprovement(controlRate, variantRate);
    const significance = calculateSignificance(
      controlViews, controlConversions,
      variantViews, variantConversions
    );
    
    results.variants[variant.id] = {
      id: variant.id,
      name: variant.name,
      isControl: false,
      metrics: {
        views: variantViews,
        conversions: variantConversions,
        conversionRate: Math.round(variantRate * 100) / 100,
        clicks: variantEvents?.metrics[EVENT_TYPES.CLICK] || Math.floor(variantViews * (Math.random() * 0.3 + 0.1)),
        engagement: variantEvents?.metrics[EVENT_TYPES.ENGAGEMENT] || Math.floor(variantViews * (Math.random() * 0.5 + 0.2)),
        dropoff: variantEvents?.metrics[EVENT_TYPES.DROPOFF] || Math.floor(variantViews * (Math.random() * 0.3 + 0.1))
      },
      improvement: Math.round(improvement * 100) / 100,
      significance
    };
  }
  
  // Determine winner
  let bestVariant = controlVariant.id;
  let bestRate = controlRate;
  
  for (const [variantId, data] of Object.entries(results.variants)) {
    if (data.metrics.conversionRate > bestRate && 
        (!data.significance || data.significance.isSignificant)) {
      bestRate = data.metrics.conversionRate;
      bestVariant = variantId;
    }
  }
  
  const winnerImprovement = bestVariant !== controlVariant.id 
    ? results.variants[bestVariant].improvement 
    : 0;
  
  results.summary = {
    winner: bestVariant,
    winnerName: results.variants[bestVariant]?.name || 'Control',
    winnerImprovement: Math.round(winnerImprovement * 100) / 100,
    totalViews: Object.values(results.variants).reduce((sum, v) => sum + v.metrics.views, 0),
    totalConversions: Object.values(results.variants).reduce((sum, v) => sum + v.metrics.conversions, 0),
    overallConversionRate: Math.round(calculateConversionRate(
      Object.values(results.variants).reduce((sum, v) => sum + v.metrics.views, 0),
      Object.values(results.variants).reduce((sum, v) => sum + v.metrics.conversions, 0)
    ) * 100) / 100
  };
  
  // Generate recommendations
  if (test.status === TEST_STATUSES.COMPLETED) {
    if (bestVariant !== controlVariant.id && winnerImprovement > 5) {
      results.recommendations.push({
        type: 'implement',
        message: `Implement ${results.variants[bestVariant].name} variant - ${Math.abs(winnerImprovement)}% improvement over control`,
        priority: 'high'
      });
    } else if (Math.abs(winnerImprovement) <= 5) {
      results.recommendations.push({
        type: 'inconclusive',
        message: 'No significant difference between variants. Consider running a larger test or trying different variations.',
        priority: 'medium'
      });
    } else if (winnerImprovement < 0) {
      results.recommendations.push({
        type: 'keep_control',
        message: 'Control variant performs better. Keep current design.',
        priority: 'medium'
      });
    }
  } else if (test.status === TEST_STATUSES.ACTIVE) {
    const totalViews = results.summary.totalViews;
    const targetSampleSize = test.sampleSize || DEFAULT_SAMPLE_SIZE;
    const progress = (totalViews / targetSampleSize) * 100;
    
    results.recommendations.push({
      type: 'progress',
      message: `Test is ${Math.round(progress)}% complete (${totalViews}/${targetSampleSize} views)`,
      priority: 'info'
    });
    
    if (progress >= 100) {
      results.recommendations.push({
        type: 'action',
        message: 'Sample size reached. Consider stopping the test.',
        priority: 'high'
      });
    }
  }
  
  return results;
};

/**
 * Check if user should be included in test
 */
const shouldIncludeUser = (test, user) => {
  const targeting = test.targeting;
  
  if (!targeting) return true;
  
  // Check user type (new vs returning)
  if (targeting.userType && targeting.userType.length > 0) {
    const userType = user.isNew ? 'new' : 'returning';
    if (!targeting.userType.includes(userType)) return false;
  }
  
  // Check percentage rollout
  if (targeting.percentage && targeting.percentage < 100) {
    const hash = hashCode(user.id) % 100;
    if (hash >= targeting.percentage) return false;
  }
  
  // Check country
  if (targeting.country && targeting.country.length > 0) {
    if (!targeting.country.includes(user.country || 'US')) return false;
  }
  
  // Check device type
  if (targeting.device && targeting.device.length > 0) {
    if (!targeting.device.includes(user.device || 'desktop')) return false;
  }
  
  // Check user role
  if (targeting.roles && targeting.roles.length > 0) {
    if (!targeting.roles.includes(user.role || 'user')) return false;
  }
  
  return true;
};

/**
 * Validate variant weights sum to 100
 */
const validateWeights = (variants) => {
  const totalWeight = variants.reduce((sum, v) => sum + (v.weight || 0), 0);
  return totalWeight === 100;
};

/**
 * Get test metrics definition
 */
const getTestMetrics = (testId) => {
  if (!testMetrics.has(testId)) {
    testMetrics.set(testId, {
      primaryMetric: EVENT_TYPES.CONVERSION,
      secondaryMetrics: [EVENT_TYPES.CLICK, EVENT_TYPES.ENGAGEMENT],
      minimumDetectableEffect: 0.05,
      significanceLevel: 0.95
    });
  }
  return testMetrics.get(testId);
};

/**
 * Calculate required sample size
 */
const calculateRequiredSampleSize = (baselineRate, minimumDetectableEffect, significanceLevel = 0.95, power = 0.8) => {
  // Simplified calculation
  const zAlpha = 1.96; // for 95% confidence
  const zBeta = 0.84; // for 80% power
  const p = baselineRate / 100;
  const d = minimumDetectableEffect;
  
  const n = (2 * p * (1 - p) * Math.pow(zAlpha + zBeta, 2)) / Math.pow(d, 2);
  return Math.ceil(n);
};

// ============================================
// Predefined A/B Tests
// ============================================

const initializeDefaultTests = () => {
  const defaultTests = [
    {
      id: 'homepage_layout_001',
      name: 'Homepage Layout Optimization',
      description: 'Testing different homepage layouts to improve conversion',
      status: TEST_STATUSES.ACTIVE,
      variants: [
        { id: 'control', name: 'Original Layout', weight: 50, isControl: true, config: { layout: 'original', ctaPosition: 'below_fold' } },
        { id: 'variant_a', name: 'Hero Focus', weight: 25, isControl: false, config: { layout: 'hero_focus', ctaPosition: 'above_fold' } },
        { id: 'variant_b', name: 'Feature Grid', weight: 25, isControl: false, config: { layout: 'feature_grid', ctaPosition: 'sticky' } }
      ],
      targeting: {
        userType: ['new', 'returning'],
        percentage: 100
      },
      startDate: new Date('2024-01-01').toISOString(),
      endDate: new Date('2024-03-31').toISOString(),
      sampleSize: 10000,
      metrics: [EVENT_TYPES.CONVERSION, EVENT_TYPES.CLICK, EVENT_TYPES.ENGAGEMENT],
      createdAt: new Date('2024-01-01').toISOString(),
      createdBy: 'admin',
      hypothesis: 'Hero-focused layout will increase signup conversion by 15%',
      primaryMetric: EVENT_TYPES.CONVERSION
    },
    {
      id: 'pricing_page_002',
      name: 'Pricing Page A/B Test',
      description: 'Testing different pricing page designs to increase purchases',
      status: TEST_STATUSES.ACTIVE,
      variants: [
        { id: 'control', name: 'Original Pricing', weight: 33, isControl: true, config: { layout: 'original', showAnnualToggle: true } },
        { id: 'variant_a', name: 'Simplified Pricing', weight: 33, isControl: false, config: { layout: 'simplified', showAnnualToggle: false } },
        { id: 'variant_b', name: 'Value Highlight', weight: 34, isControl: false, config: { layout: 'value_focus', showAnnualToggle: true, showSavings: true } }
      ],
      targeting: {
        userType: ['new'],
        percentage: 100,
        country: ['US', 'UK', 'CA']
      },
      startDate: new Date('2024-02-01').toISOString(),
      endDate: new Date('2024-04-30').toISOString(),
      sampleSize: 15000,
      metrics: [EVENT_TYPES.PURCHASE, EVENT_TYPES.CLICK, EVENT_TYPES.DROPOFF],
      createdAt: new Date('2024-02-01').toISOString(),
      createdBy: 'admin',
      hypothesis: 'Value-highlighted pricing will increase purchase conversion by 20%',
      primaryMetric: EVENT_TYPES.PURCHASE
    },
    {
      id: 'onboarding_flow_003',
      name: 'Onboarding Flow Test',
      description: 'Testing different onboarding experiences for new users',
      status: TEST_STATUSES.DRAFT,
      variants: [
        { id: 'control', name: 'Standard Onboarding', weight: 50, isControl: true, config: { steps: 5, showProgress: true, requiredFields: ['name', 'email', 'level'] } },
        { id: 'variant_a', name: 'Quick Onboarding', weight: 50, isControl: false, config: { steps: 3, showProgress: true, skipOptional: true, requiredFields: ['email'] } }
      ],
      targeting: {
        userType: ['new'],
        percentage: 100
      },
      startDate: null,
      endDate: null,
      sampleSize: 5000,
      metrics: [EVENT_TYPES.COMPLETED, EVENT_TYPES.DROPOFF, EVENT_TYPES.ENGAGEMENT],
      createdAt: new Date('2024-03-01').toISOString(),
      createdBy: 'admin',
      hypothesis: 'Shorter onboarding will increase completion rate by 25%',
      primaryMetric: EVENT_TYPES.COMPLETED
    },
    {
      id: 'cta_button_004',
      name: 'CTA Button Color Test',
      description: 'Testing different CTA button colors for conversion optimization',
      status: TEST_STATUSES.COMPLETED,
      variants: [
        { id: 'control', name: 'Blue Button', weight: 25, isControl: true, config: { color: '#4F46E5', text: 'Get Started' } },
        { id: 'variant_a', name: 'Green Button', weight: 25, isControl: false, config: { color: '#10B981', text: 'Get Started' } },
        { id: 'variant_b', name: 'Orange Button', weight: 25, isControl: false, config: { color: '#F59E0B', text: 'Start Free' } },
        { id: 'variant_c', name: 'Red Button', weight: 25, isControl: false, config: { color: '#EF4444', text: 'Join Now' } }
      ],
      targeting: {
        percentage: 100
      },
      startDate: new Date('2024-01-15').toISOString(),
      endDate: new Date('2024-02-15').toISOString(),
      sampleSize: 20000,
      metrics: [EVENT_TYPES.CLICK, EVENT_TYPES.CONVERSION],
      createdAt: new Date('2024-01-10').toISOString(),
      createdBy: 'admin',
      hypothesis: 'Green button will have highest click-through rate',
      primaryMetric: EVENT_TYPES.CLICK
    }
  ];
  
  for (const test of defaultTests) {
    if (!abTests.has(test.id)) {
      abTests.set(test.id, test);
      
      // Generate some mock events for active/completed tests
      if (test.status === TEST_STATUSES.ACTIVE || test.status === TEST_STATUSES.COMPLETED) {
        for (const variant of test.variants) {
          const mockViewCount = Math.floor(Math.random() * 5000) + 500;
          for (let i = 0; i < mockViewCount; i++) {
            const mockUserId = `mock_user_${Math.floor(Math.random() * 1000)}`;
            trackEvent(test.id, variant.id, mockUserId, EVENT_TYPES.VIEW);
            
            // Randomly add other events
            if (Math.random() < 0.3) {
              trackEvent(test.id, variant.id, mockUserId, EVENT_TYPES.CLICK);
            }
            if (Math.random() < 0.1) {
              trackEvent(test.id, variant.id, mockUserId, EVENT_TYPES.CONVERSION);
            }
          }
        }
      }
    }
  }
};

// Initialize default tests
initializeDefaultTests();

// ============================================
// Controller Methods
// ============================================

/**
 * Get active A/B tests for current user
 * GET /api/ab-test/active
 */
exports.getActiveTests = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = req.user;
    
    const activeTests = [];
    const now = new Date();
    
    for (const [testId, test] of abTests.entries()) {
      // Check if test is active
      if (test.status !== TEST_STATUSES.ACTIVE) continue;
      
      // Check date range
      const startDate = test.startDate ? new Date(test.startDate) : null;
      const endDate = test.endDate ? new Date(test.endDate) : null;
      
      if (startDate && now < startDate) continue;
      if (endDate && now > endDate) {
        // Auto-complete expired test
        test.status = TEST_STATUSES.COMPLETED;
        abTests.set(testId, test);
        continue;
      }
      
      // Check if user should be included
      if (!shouldIncludeUser(test, user)) continue;
      
      // Get user's variant
      const variantId = getUserVariant(testId, userId);
      const variant = test.variants.find(v => v.id === variantId);
      
      if (variant) {
        activeTests.push({
          testId: test.id,
          testName: test.name,
          description: test.description,
          variantId: variant.id,
          variantName: variant.name,
          config: variant.config,
          primaryMetric: test.primaryMetric,
          hypothesis: test.hypothesis
        });
      }
    }
    
    // Track view events for active tests
    for (const test of activeTests) {
      trackEvent(test.testId, test.variantId, userId, EVENT_TYPES.VIEW, {
        page: req.path,
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({
      success: true,
      data: activeTests
    });
    
  } catch (error) {
    console.error('Get active tests error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve active A/B tests',
      code: 'ACTIVE_TESTS_FAILED'
    });
  }
};

/**
 * Track event for A/B test
 * POST /api/ab-test/track
 */
exports.trackEvent = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }
    
    const { testId, variantId, eventType, metadata } = req.body;
    const userId = req.user.id;
    
    // Verify test exists
    const test = abTests.get(testId);
    if (!test) {
      return res.status(404).json({
        success: false,
        error: 'Test not found',
        code: 'TEST_NOT_FOUND'
      });
    }
    
    // Verify test is active
    if (test.status !== TEST_STATUSES.ACTIVE) {
      return res.status(400).json({
        success: false,
        error: 'Test is not active',
        code: 'TEST_NOT_ACTIVE'
      });
    }
    
    // Verify variant exists
    const variant = test.variants.find(v => v.id === variantId);
    if (!variant) {
      return res.status(400).json({
        success: false,
        error: 'Invalid variant ID',
        code: 'INVALID_VARIANT'
      });
    }
    
    // Verify user is assigned to this variant
    const assignedVariant = getUserVariant(testId, userId);
    if (assignedVariant !== variantId) {
      return res.status(403).json({
        success: false,
        error: 'User not assigned to this variant',
        code: 'WRONG_VARIANT'
      });
    }
    
    // Track event
    trackEvent(testId, variantId, userId, eventType, metadata);
    
    res.json({
      success: true,
      message: 'Event tracked successfully'
    });
    
  } catch (error) {
    console.error('Track event error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to track event',
      code: 'TRACK_EVENT_FAILED'
    });
  }
};

/**
 * Get test results
 * GET /api/ab-test/results/:testId
 */
exports.getTestResults = async (req, res) => {
  try {
    const { testId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;
    
    const test = abTests.get(testId);
    
    if (!test) {
      return res.status(404).json({
        success: false,
        error: 'Test not found',
        code: 'TEST_NOT_FOUND'
      });
    }
    
    // Check authorization (only admin or test creator can view results)
    if (userRole !== 'admin' && test.createdBy !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Admin access required.',
        code: 'ACCESS_DENIED'
      });
    }
    
    // Get cached results or generate new
    let results = testResults.get(testId);
    if (!results) {
      results = generateMockResults(test);
      testResults.set(testId, results);
    }
    
    // Add test metadata
    const testInfo = {
      id: test.id,
      name: test.name,
      description: test.description,
      status: test.status,
      hypothesis: test.hypothesis,
      primaryMetric: test.primaryMetric,
      startDate: test.startDate,
      endDate: test.endDate,
      sampleSize: test.sampleSize,
      targeting: test.targeting,
      createdAt: test.createdAt,
      createdBy: test.createdBy
    };
    
    res.json({
      success: true,
      data: {
        test: testInfo,
        results,
        recommendations: results.recommendations
      }
    });
    
  } catch (error) {
    console.error('Get test results error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve test results',
      code: 'RESULTS_FAILED'
    });
  }
};

// ============================================
// Admin Controller Methods
// ============================================

/**
 * Get all A/B tests (admin only)
 * GET /api/ab-test/admin/tests
 */
exports.adminGetTests = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    
    let tests = Array.from(abTests.values());
    
    if (status) {
      tests = tests.filter(t => t.status === status);
    }
    
    // Sort by creation date (newest first)
    tests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Pagination
    const startIndex = (page - 1) * limit;
    const paginatedTests = tests.slice(startIndex, startIndex + limit);
    
    // Add summary stats for each test
    const testsWithStats = paginatedTests.map(test => {
      const results = testResults.get(test.id);
      return {
        ...test,
        summary: results?.summary || null,
        totalEvents: testEvents.get(`${test.id}:${test.variants[0]?.id}`)?.events.length || 0
      };
    });
    
    res.json({
      success: true,
      data: {
        tests: testsWithStats,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: tests.length,
          pages: Math.ceil(tests.length / limit)
        },
        summary: {
          active: tests.filter(t => t.status === TEST_STATUSES.ACTIVE).length,
          completed: tests.filter(t => t.status === TEST_STATUSES.COMPLETED).length,
          draft: tests.filter(t => t.status === TEST_STATUSES.DRAFT).length,
          total: tests.length
        }
      }
    });
    
  } catch (error) {
    console.error('Admin get tests error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve tests',
      code: 'ADMIN_TESTS_FAILED'
    });
  }
};

/**
 * Create new A/B test (admin only)
 * POST /api/ab-test/admin/tests
 */
exports.adminCreateTest = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }
    
    const { 
      name, 
      description, 
      variants, 
      targeting, 
      startDate, 
      endDate, 
      sampleSize, 
      metrics,
      hypothesis,
      primaryMetric 
    } = req.body;
    
    // Validate weights sum to 100
    if (!validateWeights(variants)) {
      return res.status(400).json({
        success: false,
        error: 'Total variant weights must equal 100',
        code: 'INVALID_WEIGHTS'
      });
    }
    
    // Check at least one control variant
    const hasControl = variants.some(v => v.isControl);
    if (!hasControl) {
      return res.status(400).json({
        success: false,
        error: 'At least one variant must be marked as control',
        code: 'NO_CONTROL_VARIANT'
      });
    }
    
    const testId = generateId('test');
    const newTest = {
      id: testId,
      name,
      description: description || '',
      status: TEST_STATUSES.DRAFT,
      variants: variants.map((v, index) => ({
        id: v.id || `variant_${index + 1}`,
        name: v.name,
        weight: v.weight,
        isControl: v.isControl || false,
        config: v.config || {}
      })),
      targeting: targeting || {},
      startDate: startDate || null,
      endDate: endDate || null,
      sampleSize: sampleSize || DEFAULT_SAMPLE_SIZE,
      metrics: metrics || [EVENT_TYPES.CONVERSION],
      hypothesis: hypothesis || '',
      primaryMetric: primaryMetric || EVENT_TYPES.CONVERSION,
      createdAt: new Date().toISOString(),
      createdBy: req.user.id
    };
    
    abTests.set(testId, newTest);
    
    res.status(201).json({
      success: true,
      message: 'A/B test created successfully',
      data: newTest
    });
    
  } catch (error) {
    console.error('Create test error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create A/B test',
      code: 'CREATE_TEST_FAILED'
    });
  }
};

/**
 * Update A/B test (admin only)
 * PUT /api/ab-test/admin/tests/:testId
 */
exports.adminUpdateTest = async (req, res) => {
  try {
    const { testId } = req.params;
    const updates = req.body;
    
    const test = abTests.get(testId);
    
    if (!test) {
      return res.status(404).json({
        success: false,
        error: 'Test not found',
        code: 'TEST_NOT_FOUND'
      });
    }
    
    // Cannot modify active or completed tests
    if (test.status === TEST_STATUSES.ACTIVE || test.status === TEST_STATUSES.COMPLETED) {
      return res.status(400).json({
        success: false,
        error: `Cannot modify test in ${test.status} status`,
        code: 'TEST_IN_PROGRESS'
      });
    }
    
    // Validate weights if variants are being updated
    if (updates.variants && !validateWeights(updates.variants)) {
      return res.status(400).json({
        success: false,
        error: 'Total variant weights must equal 100',
        code: 'INVALID_WEIGHTS'
      });
    }
    
    const updatedTest = {
      ...test,
      ...updates,
      updatedAt: new Date().toISOString(),
      updatedBy: req.user.id
    };
    
    abTests.set(testId, updatedTest);
    
    // Clear results cache
    testResults.delete(testId);
    
    res.json({
      success: true,
      message: 'Test updated successfully',
      data: updatedTest
    });
    
  } catch (error) {
    console.error('Update test error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update test',
      code: 'UPDATE_TEST_FAILED'
    });
  }
};

/**
 * Start an A/B test (admin only)
 * POST /api/ab-test/admin/tests/:testId/start
 */
exports.adminStartTest = async (req, res) => {
  try {
    const { testId } = req.params;
    
    const test = abTests.get(testId);
    
    if (!test) {
      return res.status(404).json
