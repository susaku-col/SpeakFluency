// ============================================
// A/B Testing Routes
// SpeakFlow - AI Language Learning Platform
// ============================================

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { body, query, param, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');

// ============================================
// Middleware Authentication
// ============================================

const authenticateToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No token provided',
        code: 'NO_TOKEN'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token has expired',
        code: 'TOKEN_EXPIRED'
      });
    }
    return res.status(403).json({
      success: false,
      error: 'Invalid token',
      code: 'INVALID_TOKEN'
    });
  }
};

// Admin middleware
const isAdmin = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required',
        code: 'ADMIN_REQUIRED'
      });
    }
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// ============================================
// Rate Limiting
// ============================================

const abTestLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: {
    success: false,
    error: 'Too many A/B test requests. Please slow down.'
  }
});

// ============================================
// Validation Rules
// ============================================

const createTestValidation = [
  body('name')
    .notEmpty()
    .withMessage('Test name is required')
    .isLength({ min: 3, max: 100 })
    .withMessage('Test name must be between 3 and 100 characters'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  body('variants')
    .isArray()
    .withMessage('Variants must be an array')
    .custom(value => value.length >= 2 && value.length <= 10)
    .withMessage('Must have between 2 and 10 variants'),
  body('targeting')
    .optional()
    .isObject()
    .withMessage('Targeting must be an object'),
  body('startDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid start date format'),
  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid end date format'),
  body('sampleSize')
    .optional()
    .isInt({ min: 100, max: 100000 })
    .withMessage('Sample size must be between 100 and 100,000'),
];

const trackEventValidation = [
  body('testId')
    .notEmpty()
    .withMessage('Test ID is required'),
  body('variantId')
    .notEmpty()
    .withMessage('Variant ID is required'),
  body('eventType')
    .isIn(['view', 'click', 'conversion', 'engagement', 'signup', 'purchase', 'completed'])
    .withMessage('Invalid event type'),
  body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata must be an object'),
];

// ============================================
// A/B Test Data Storage
// ============================================

// Active A/B tests
const abTests = new Map();

// User assignments (which variant each user sees)
const userAssignments = new Map();

// Test events tracking
const testEvents = new Map();

// Test results cache
const testResults = new Map();

// ============================================
// Mock A/B Test Data
// ============================================

// Predefined A/B tests
const defaultTests = [
  {
    id: 'homepage_layout_001',
    name: 'Homepage Layout Optimization',
    description: 'Testing different homepage layouts to improve conversion',
    status: 'active',
    variants: [
      { id: 'control', name: 'Control', weight: 50, config: { layout: 'original' } },
      { id: 'variant_a', name: 'Hero Focus', weight: 25, config: { layout: 'hero_focus', ctaPosition: 'above_fold' } },
      { id: 'variant_b', name: 'Feature Grid', weight: 25, config: { layout: 'feature_grid', ctaPosition: 'bottom' } }
    ],
    targeting: {
      userType: ['new', 'returning'],
      percentage: 100
    },
    startDate: new Date('2024-01-01').toISOString(),
    endDate: new Date('2024-03-31').toISOString(),
    metrics: ['click_through_rate', 'signup_conversion', 'time_on_page'],
    createdAt: new Date('2024-01-01').toISOString(),
    createdBy: 'admin'
  },
  {
    id: 'pricing_page_002',
    name: 'Pricing Page A/B Test',
    description: 'Testing different pricing page designs',
    status: 'active',
    variants: [
      { id: 'control', name: 'Original Pricing', weight: 33, config: { layout: 'original', showAnnualToggle: true } },
      { id: 'variant_a', name: 'Simplified Pricing', weight: 33, config: { layout: 'simplified', showAnnualToggle: false } },
      { id: 'variant_b', name: 'Value Highlight', weight: 34, config: { layout: 'value_focus', showAnnualToggle: true, showSavings: true } }
    ],
    targeting: {
      userType: ['new'],
      percentage: 100,
      country: ['US', 'UK', 'CA']
    },
    startDate: new Date('2024-02-01').toISOString(),
    endDate: new Date('2024-04-30').toISOString(),
    metrics: ['purchase_conversion', 'average_order_value', 'plan_selection'],
    createdAt: new Date('2024-02-01').toISOString(),
    createdBy: 'admin'
  },
  {
    id: 'onboarding_flow_003',
    name: 'Onboarding Flow Test',
    description: 'Testing different onboarding experiences',
    status: 'draft',
    variants: [
      { id: 'control', name: 'Standard Onboarding', weight: 50, config: { steps: 5, showProgress: true } },
      { id: 'variant_a', name: 'Quick Onboarding', weight: 50, config: { steps: 3, showProgress: true, skipOptional: true } }
    ],
    targeting: {
      userType: ['new'],
      percentage: 100
    },
    startDate: null,
    endDate: null,
    metrics: ['completion_rate', 'time_to_complete', 'retention_day7'],
    createdAt: new Date('2024-03-01').toISOString(),
    createdBy: 'admin'
  }
];

// Initialize default tests
defaultTests.forEach(test => {
  abTests.set(test.id, test);
  testResults.set(test.id, generateMockResults(test));
});

// ============================================
// Helper Functions
// ============================================

// Generate unique ID
const generateId = (prefix) => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Assign user to variant based on weights
const assignVariant = (test, userId) => {
  const variants = test.variants;
  const random = Math.random() * 100;
  let cumulativeWeight = 0;
  
  for (const variant of variants) {
    cumulativeWeight += variant.weight;
    if (random <= cumulativeWeight) {
      return variant.id;
    }
  }
  
  return variants[0].id; // Fallback to first variant
};

// Check if user should be included in test
const shouldIncludeUser = (test, user) => {
  const targeting = test.targeting;
  
  if (!targeting) return true;
  
  // Check user type
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
  
  return true;
};

// Simple hash function
const hashCode = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

// Get user's variant for a test
const getUserVariant = (testId, userId) => {
  const key = `${testId}:${userId}`;
  if (!userAssignments.has(key)) {
    const test = abTests.get(testId);
    if (test && test.status === 'active') {
      const variant = assignVariant(test, userId);
      userAssignments.set(key, variant);
      return variant;
    }
    return null;
  }
  return userAssignments.get(key);
};

// Track event for A/B test
const trackEvent = (testId, variantId, userId, eventType, metadata = {}) => {
  const key = `${testId}:${variantId}`;
  
  if (!testEvents.has(key)) {
    testEvents.set(key, {
      testId,
      variantId,
      events: []
    });
  }
  
  const testData = testEvents.get(key);
  testData.events.push({
    userId,
    eventType,
    timestamp: new Date().toISOString(),
    metadata
  });
  
  // Invalidate cached results
  testResults.delete(testId);
};

// Generate mock results for a test
const generateMockResults = (test) => {
  const results = {
    testId: test.id,
    testName: test.name,
    variants: {},
    summary: {},
    significance: {}
  };
  
  test.variants.forEach(variant => {
    const eventCounts = {
      views: Math.floor(Math.random() * 10000) + 1000,
      clicks: Math.floor(Math.random() * 3000) + 500,
      conversions: Math.floor(Math.random() * 500) + 50
    };
    
    results.variants[variant.id] = {
      name: variant.name,
      metrics: {
        views: eventCounts.views,
        clicks: eventCounts.clicks,
        conversions: eventCounts.conversions,
        conversionRate: (eventCounts.conversions / eventCounts.views) * 100,
        clickThroughRate: (eventCounts.clicks / eventCounts.views) * 100
      }
    };
  });
  
  // Calculate improvement vs control
  const controlRate = results.variants.control?.metrics.conversionRate || 0;
  for (const [variantId, data] of Object.entries(results.variants)) {
    if (variantId !== 'control') {
      const improvement = ((data.metrics.conversionRate - controlRate) / controlRate) * 100;
      data.improvement = improvement;
      
      // Calculate statistical significance (mock)
      data.significance = {
        isSignificant: Math.random() > 0.3,
        pValue: Math.random() * 0.1,
        confidenceLevel: 95 - (Math.random() * 10)
      };
    }
  }
  
  // Determine winner
  let bestVariant = 'control';
  let bestRate = controlRate;
  for (const [variantId, data] of Object.entries(results.variants)) {
    if (data.metrics.conversionRate > bestRate) {
      bestRate = data.metrics.conversionRate;
      bestVariant = variantId;
    }
  }
  results.summary.winner = bestVariant;
  results.summary.winnerImprovement = bestVariant !== 'control' 
    ? ((bestRate - controlRate) / controlRate) * 100 
    : 0;
  
  return results;
};

// Calculate statistical significance
const calculateSignificance = (controlEvents, variantEvents) => {
  // Simplified significance calculation
  // In production, use proper statistical methods (chi-square, t-test, etc.)
  const controlRate = controlEvents.conversions / controlEvents.views;
  const variantRate = variantEvents.conversions / variantEvents.views;
  const standardError = Math.sqrt(
    (controlRate * (1 - controlRate) / controlEvents.views) +
    (variantRate * (1 - variantRate) / variantEvents.views)
  );
  const zScore = Math.abs(controlRate - variantRate) / standardError;
  const isSignificant = zScore > 1.96; // 95% confidence
  const pValue = 2 * (1 - normalCDF(zScore));
  
  return {
    isSignificant,
    zScore,
    pValue,
    confidenceLevel: isSignificant ? 95 : 68
  };
};

// Normal CDF approximation
const normalCDF = (x) => {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
};

// ============================================
// Routes
// ============================================

/**
 * GET /api/ab-test/active
 * Get active A/B tests for current user
 */
router.get('/active', authenticateToken, abTestLimiter, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = req.user;
    
    const activeTests = [];
    
    for (const [testId, test] of abTests.entries()) {
      // Check if test is active
      if (test.status !== 'active') continue;
      
      // Check date range
      const now = new Date();
      const startDate = test.startDate ? new Date(test.startDate) : null;
      const endDate = test.endDate ? new Date(test.endDate) : null;
      
      if (startDate && now < startDate) continue;
      if (endDate && now > endDate) continue;
      
      // Check if user should be included
      if (!shouldIncludeUser(test, user)) continue;
      
      // Get user's variant
      const variantId = getUserVariant(testId, userId);
      const variant = test.variants.find(v => v.id === variantId);
      
      if (variant) {
        activeTests.push({
          testId: test.id,
          testName: test.name,
          variantId: variant.id,
          variantName: variant.name,
          config: variant.config
        });
      }
    }
    
    res.json({
      success: true,
      data: activeTests
    });
  } catch (error) {
    console.error('Get active tests error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve active A/B tests'
    });
  }
});

/**
 * POST /api/ab-test/track
 * Track event for A/B test
 */
router.post('/track', authenticateToken, abTestLimiter, trackEventValidation, async (req, res) => {
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
    
    // Verify variant exists
    const variant = test.variants.find(v => v.id === variantId);
    if (!variant) {
      return res.status(400).json({
        success: false,
        error: 'Invalid variant ID',
        code: 'INVALID_VARIANT'
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
      error: 'Failed to track event'
    });
  }
});

/**
 * GET /api/ab-test/results/:testId
 * Get results for a specific test
 */
router.get('/results/:testId', authenticateToken, async (req, res) => {
  try {
    const { testId } = req.params;
    
    const test = abTests.get(testId);
    if (!test) {
      return res.status(404).json({
        success: false,
        error: 'Test not found',
        code: 'TEST_NOT_FOUND'
      });
    }
    
    // Get cached results or generate new
    let results = testResults.get(testId);
    if (!results) {
      results = generateMockResults(test);
      testResults.set(testId, results);
    }
    
    res.json({
      success: true,
      data: {
        test: {
          id: test.id,
          name: test.name,
          description: test.description,
          status: test.status,
          startDate: test.startDate,
          endDate: test.endDate
        },
        results,
        recommendations: generateRecommendations(test, results)
      }
    });
  } catch (error) {
    console.error('Get test results error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve test results'
    });
  }
});

// ============================================
// Admin Routes
// ============================================

/**
 * GET /api/ab-test/admin/tests
 * Get all A/B tests (admin only)
 */
router.get('/admin/tests', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    
    let tests = Array.from(abTests.values());
    
    if (status) {
      tests = tests.filter(t => t.status === status);
    }
    
    // Pagination
    const startIndex = (page - 1) * limit;
    const paginatedTests = tests.slice(startIndex, startIndex + limit);
    
    res.json({
      success: true,
      data: {
        tests: paginatedTests,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: tests.length,
          pages: Math.ceil(tests.length / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get all tests error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve tests'
    });
  }
});

/**
 * POST /api/ab-test/admin/tests
 * Create new A/B test (admin only)
 */
router.post('/admin/tests', authenticateToken, isAdmin, createTestValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }
    
    const { name, description, variants, targeting, startDate, endDate, sampleSize, metrics } = req.body;
    
    // Validate total weight = 100
    const totalWeight = variants.reduce((sum, v) => sum + (v.weight || 0), 0);
    if (totalWeight !== 100) {
      return res.status(400).json({
        success: false,
        error: 'Total variant weights must equal 100',
        code: 'INVALID_WEIGHTS'
      });
    }
    
    const testId = generateId('test');
    const newTest = {
      id: testId,
      name,
      description: description || '',
      status: 'draft',
      variants: variants.map((v, index) => ({
        id: v.id || `variant_${index + 1}`,
        name: v.name,
        weight: v.weight,
        config: v.config || {}
      })),
      targeting: targeting || {},
      startDate: startDate || null,
      endDate: endDate || null,
      sampleSize: sampleSize || null,
      metrics: metrics || ['conversion'],
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
      error: 'Failed to create A/B test'
    });
  }
});

/**
 * PUT /api/ab-test/admin/tests/:testId
 * Update A/B test (admin only)
 */
router.put('/admin/tests/:testId', authenticateToken, isAdmin, async (req, res) => {
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
    
    // Cannot modify active tests
    if (test.status === 'active' && updates.status !== 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Cannot modify active test. Stop the test first.',
        code: 'TEST_ACTIVE'
      });
    }
    
    const updatedTest = {
      ...test,
      ...updates,
      updatedAt: new Date().toISOString(),
      updatedBy: req.user.id
    };
    
    abTests.set(testId, updatedTest);
    
    // Clear results cache if test was modified
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
      error: 'Failed to update test'
    });
  }
});

/**
 * POST /api/ab-test/admin/tests/:testId/start
 * Start an A/B test (admin only)
 */
router.post('/admin/tests/:testId/start', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { testId } = req.params;
    
    const test = abTests.get(testId);
    if (!test) {
      return res.status(404).json({
        success: false,
        error: 'Test not found',
        code: 'TEST_NOT_FOUND'
      });
    }
    
    if (test.status === 'active') {
      return res.status(400).json({
        success: false,
        error: 'Test is already active',
        code: 'TEST_ALREADY_ACTIVE'
      });
    }
    
    test.status = 'active';
    test.activatedAt = new Date().toISOString();
    test.activatedBy = req.user.id;
    
    abTests.set(testId, test);
    
    res.json({
      success: true,
      message: 'Test started successfully',
      data: test
    });
  } catch (error) {
    console.error('Start test error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start test'
    });
  }
});

/**
 * POST /api/ab-test/admin/tests/:testId/stop
 * Stop an A/B test (admin only)
 */
router.post('/admin/tests/:testId/stop', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { testId } = req.params;
    const { reason } = req.body;
    
    const test = abTests.get(testId);
    if (!test) {
      return res.status(404).json({
        success: false,
        error: 'Test not found',
        code: 'TEST_NOT_FOUND'
      });
    }
    
    if (test.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: 'Test is not active',
        code: 'TEST_NOT_ACTIVE'
      });
    }
    
    test.status = 'completed';
    test.completedAt = new Date().toISOString();
    test.completedBy = req.user.id;
    test.stopReason = reason || 'Test completed';
    
    abTests.set(testId, test);
    
    // Generate final results
    const results = generateMockResults(test);
    testResults.set(testId, results);
    
    res.json({
      success: true,
      message: 'Test stopped successfully',
      data: {
        test,
        results
      }
    });
  } catch (error) {
    console.error('Stop test error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to stop test'
    });
  }
});

/**
 * DELETE /api/ab-test/admin/tests/:testId
 * Delete an A/B test (admin only)
 */
router.delete('/admin/tests/:testId', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { testId } = req.params;
    
    const test = abTests.get(testId);
    if (!test) {
      return res.status(404).json({
        success: false,
        error: 'Test not found',
        code: 'TEST_NOT_FOUND'
      });
    }
    
    // Cannot delete active tests
    if (test.status === 'active') {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete active test. Stop the test first.',
        code: 'TEST_ACTIVE'
      });
    }
    
    abTests.delete(testId);
    testResults.delete(testId);
    
    // Clean up user assignments for this test
    for (const [key, value] of userAssignments.entries()) {
      if (key.startsWith(testId)) {
        userAssignments.delete(key);
      }
    }
    
    res.json({
      success: true,
      message: 'Test deleted successfully'
    });
  } catch (error) {
    console.error('Delete test error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete test'
    });
  }
});

/**
 * GET /api/ab-test/admin/analytics/overview
 * Get A/B testing analytics overview (admin only)
 */
router.get('/admin/analytics/overview', authenticateToken, isAdmin, async (req, res) => {
  try {
    const tests = Array.from(abTests.values());
    const activeTests = tests.filter(t => t.status === 'active');
    const completedTests = tests.filter(t => t.status === 'completed');
    
    // Calculate impact of winning tests
    let totalImprovement = 0;
    let winningTestsCount = 0;
    
    for (const test of completedTests) {
      const results = testResults.get(test.id);
      if (results && results.summary.winner !== 'control') {
        totalImprovement += results.summary.winnerImprovement;
        winningTestsCount++;
      }
    }
    
    const averageImprovement = winningTestsCount > 0 ? totalImprovement / winningTestsCount : 0;
    
    res.json({
      success: true,
      data: {
        summary: {
          totalTests: tests.length,
          activeTests: activeTests.length,
          completedTests: completedTests.length,
          draftTests: tests.filter(t => t.status === 'draft').length,
          totalUsersInTests: Math.floor(Math.random() * 50000) + 10000,
          averageImprovement: Math.round(averageImprovement * 100) / 100
        },
        recentTests: tests.slice(-5).map(t => ({
          id: t.id,
          name: t.name,
          status: t.status,
          startDate: t.startDate,
          winner: testResults.get(t.id)?.summary.winner || null
        })),
        topPerformingTests: tests
          .filter(t => t.status === 'completed')
          .map(t => ({
            id: t.id,
            name: t.name,
            improvement: testResults.get(t.id)?.summary.winnerImprovement || 0,
            winner: testResults.get(t.id)?.summary.winner
          }))
          .sort((a, b) => b.improvement - a.improvement)
          .slice(0, 5)
      }
    });
  } catch (error) {
    console.error('Analytics overview error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve analytics overview'
    });
  }
});

// ============================================
// Helper Functions
// ============================================

const generateRecommendations = (test, results) => {
  const recommendations = [];
  
  if (test.status === 'active') {
    const sampleSize = test.sampleSize || 10000;
    const currentViews = results.variants.control?.metrics.views || 0;
    const progress = (currentViews / sampleSize) * 100;
    
    recommendations.push({
      type: 'progress',
      message: `Test is ${Math.round(progress)}% complete`,
      action: progress < 50 ? 'Continue running test' : 'Consider stopping test'
    });
  }
  
  if (test.status === 'completed') {
    const winner = results.summary.winner;
    const improvement = results.summary.winnerImprovement;
    
    if (winner !== 'control' && improvement > 5) {
      recommendations.push({
        type: 'winner',
        message: `${winner} variant is winning with ${Math.round(improvement)}% improvement`,
        action: 'Implement winning variant in production'
      });
    } else if (winner === 'control') {
      recommendations.push({
        type: 'no_winner',
        message: 'No significant improvement found',
        action: 'Try different variations or end test'
      });
    }
  }
  
  return recommendations;
};

module.exports = router;
