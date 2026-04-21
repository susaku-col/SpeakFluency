// ============================================
// Payment Routes
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

// ============================================
// Rate Limiting
// ============================================

const paymentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 payment attempts per minute
  message: {
    success: false,
    error: 'Too many payment attempts. Please try again later.'
  }
});

const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  skip: (req) => req.ip === 'stripe.com' // Skip rate limit for Stripe
});

// ============================================
// Validation Rules
// ============================================

const createSubscriptionValidation = [
  body('planId')
    .isIn(['free', 'pro_monthly', 'pro_yearly', 'family_monthly', 'family_yearly', 'enterprise'])
    .withMessage('Invalid plan ID'),
  body('paymentMethodId')
    .optional()
    .isString()
    .withMessage('Invalid payment method'),
  body('couponCode')
    .optional()
    .isString()
    .withMessage('Invalid coupon code'),
];

const createPaymentIntentValidation = [
  body('amount')
    .isInt({ min: 100, max: 999999 })
    .withMessage('Amount must be between 100 and 999999'),
  body('currency')
    .optional()
    .isIn(['usd', 'eur', 'gbp', 'idr'])
    .withMessage('Invalid currency'),
  body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata must be an object'),
];

const refundValidation = [
  body('paymentId')
    .notEmpty()
    .withMessage('Payment ID is required'),
  body('amount')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Amount must be positive'),
  body('reason')
    .optional()
    .isString()
    .withMessage('Reason must be a string'),
];

// ============================================
// Subscription Plans Data
// ============================================

const subscriptionPlans = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    currency: 'usd',
    interval: 'forever',
    features: [
      '3 lessons per day',
      'Basic pronunciation feedback',
      '500+ vocabulary words',
      'Community access',
      'Basic analytics'
    ],
    limits: {
      dailyLessons: 3,
      vocabularyWords: 500,
      storageMB: 10,
      aiCallsPerDay: 10
    }
  },
  pro_monthly: {
    id: 'pro_monthly',
    name: 'Pro Monthly',
    price: 12.99,
    currency: 'usd',
    interval: 'month',
    stripePriceId: 'price_pro_monthly',
    features: [
      'Unlimited lessons',
      'Advanced pronunciation AI',
      '5000+ vocabulary words',
      'AI conversation partner',
      'Offline mode',
      'Priority support',
      'Detailed analytics'
    ],
    limits: {
      dailyLessons: -1, // unlimited
      vocabularyWords: 5000,
      storageMB: 500,
      aiCallsPerDay: 100
    }
  },
  pro_yearly: {
    id: 'pro_yearly',
    name: 'Pro Yearly',
    price: 99.99,
    currency: 'usd',
    interval: 'year',
    stripePriceId: 'price_pro_yearly',
    features: [
      'All Pro features',
      'Save 36% compared to monthly',
      '2 months free',
      'Exclusive webinars'
    ],
    limits: {
      dailyLessons: -1,
      vocabularyWords: 5000,
      storageMB: 500,
      aiCallsPerDay: 100
    },
    savings: '36%'
  },
  family_monthly: {
    id: 'family_monthly',
    name: 'Family Monthly',
    price: 24.99,
    currency: 'usd',
    interval: 'month',
    stripePriceId: 'price_family_monthly',
    features: [
      'Up to 5 family members',
      'All Pro features',
      'Family progress tracking',
      'Group practice sessions',
      '1-on-1 tutoring (2x/month)',
      'Premium support'
    ],
    limits: {
      dailyLessons: -1,
      vocabularyWords: 10000,
      storageMB: 2000,
      aiCallsPerDay: 500,
      maxMembers: 5
    }
  },
  family_yearly: {
    id: 'family_yearly',
    name: 'Family Yearly',
    price: 199.99,
    currency: 'usd',
    interval: 'year',
    stripePriceId: 'price_family_yearly',
    features: [
      'All Family features',
      'Save 33% compared to monthly',
      '3 months free',
      'Family dashboard',
      'Parent controls'
    ],
    limits: {
      dailyLessons: -1,
      vocabularyWords: 10000,
      storageMB: 2000,
      aiCallsPerDay: 500,
      maxMembers: 5
    },
    savings: '33%'
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    price: null,
    currency: 'usd',
    interval: 'custom',
    features: [
      'Custom number of users',
      'SSO integration',
      'Advanced analytics',
      'Dedicated account manager',
      'Custom AI model training',
      'SLA guarantee',
      'On-premise deployment option'
    ],
    limits: {
      dailyLessons: -1,
      vocabularyWords: -1,
      storageMB: -1,
      aiCallsPerDay: -1,
      maxMembers: -1
    }
  }
};

// ============================================
// Mock Data Storage
// ============================================

// User subscriptions
const userSubscriptions = new Map();

// Payment history
const paymentHistory = new Map();

// Invoices
const invoices = new Map();

// Coupons
const coupons = new Map([
  ['WELCOME20', { discount: 20, type: 'percentage', validUntil: new Date('2025-12-31') }],
  ['SAVE50', { discount: 50, type: 'percentage', validUntil: new Date('2025-06-30') }],
  ['FLASHSALE', { discount: 30, type: 'percentage', validUntil: new Date('2024-12-31') }]
]);

// ============================================
// Helper Functions
// ============================================

// Generate unique ID
const generateId = (prefix) => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Calculate prorated amount
const calculateProratedAmount = (currentPlan, newPlan, daysRemaining) => {
  if (!currentPlan || currentPlan === 'free') return newPlan.price;
  
  const currentPlanData = subscriptionPlans[currentPlan];
  const newPlanData = subscriptionPlans[newPlan];
  
  if (!currentPlanData || !newPlanData) return newPlanData.price;
  
  const monthlyCurrent = currentPlanData.interval === 'year' 
    ? currentPlanData.price / 12 
    : currentPlanData.price;
  const monthlyNew = newPlanData.interval === 'year' 
    ? newPlanData.price / 12 
    : newPlanData.price;
  
  const refundAmount = (monthlyCurrent / 30) * daysRemaining;
  const newAmount = monthlyNew;
  
  return Math.max(0, newAmount - refundAmount);
};

// Apply coupon discount
const applyCoupon = (amount, couponCode) => {
  const coupon = coupons.get(couponCode);
  if (!coupon) return { amount, discount: 0, couponApplied: null };
  
  if (coupon.validUntil && new Date() > coupon.validUntil) {
    return { amount, discount: 0, couponApplied: null };
  }
  
  let discountAmount = 0;
  if (coupon.type === 'percentage') {
    discountAmount = (amount * coupon.discount) / 100;
  } else {
    discountAmount = Math.min(coupon.discount, amount);
  }
  
  return {
    amount: amount - discountAmount,
    discount: discountAmount,
    couponApplied: couponCode
  };
};

// Get user subscription
const getUserSubscription = (userId) => {
  return userSubscriptions.get(userId) || {
    plan: 'free',
    status: 'active',
    startDate: new Date().toISOString(),
    endDate: null,
    autoRenew: true
  };
};

// Update user subscription
const updateUserSubscription = (userId, subscriptionData) => {
  userSubscriptions.set(userId, subscriptionData);
  return subscriptionData;
};

// Create invoice
const createInvoice = (userId, amount, currency, description, metadata = {}) => {
  const invoice = {
    id: generateId('inv'),
    userId,
    amount,
    currency,
    description,
    status: 'paid',
    createdAt: new Date().toISOString(),
    metadata,
    invoiceUrl: `https://speakflow.com/invoices/${generateId('inv')}`
  };
  
  invoices.set(invoice.id, invoice);
  return invoice;
};

// Record payment
const recordPayment = (userId, amount, currency, paymentMethod, metadata = {}) => {
  const payment = {
    id: generateId('pay'),
    userId,
    amount,
    currency,
    paymentMethod,
    status: 'succeeded',
    createdAt: new Date().toISOString(),
    metadata
  };
  
  if (!paymentHistory.has(userId)) {
    paymentHistory.set(userId, []);
  }
  paymentHistory.get(userId).push(payment);
  
  return payment;
};

// ============================================
// Routes
// ============================================

/**
 * GET /api/payments/plans
 * Get available subscription plans
 */
router.get('/plans', async (req, res) => {
  try {
    const plans = Object.values(subscriptionPlans).map(plan => ({
      id: plan.id,
      name: plan.name,
      price: plan.price,
      currency: plan.currency,
      interval: plan.interval,
      features: plan.features,
      limits: plan.limits,
      savings: plan.savings || null
    }));
    
    res.json({
      success: true,
      data: {
        plans,
        currency: 'usd',
        taxInclusive: true
      }
    });
  } catch (error) {
    console.error('Get plans error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve subscription plans'
    });
  }
});

/**
 * GET /api/payments/current-subscription
 * Get current user subscription
 */
router.get('/current-subscription', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const subscription = getUserSubscription(userId);
    
    const planDetails = subscriptionPlans[subscription.plan];
    
    res.json({
      success: true,
      data: {
        plan: subscription.plan,
        planName: planDetails?.name || 'Free',
        status: subscription.status,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        autoRenew: subscription.autoRenew,
        features: planDetails?.features || [],
        limits: planDetails?.limits || {},
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd || false
      }
    });
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve subscription information'
    });
  }
});

/**
 * POST /api/payments/create-subscription
 * Create new subscription
 */
router.post('/create-subscription', authenticateToken, paymentLimiter, createSubscriptionValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }
    
    const { planId, paymentMethodId, couponCode } = req.body;
    const userId = req.user.id;
    
    // Get plan details
    const plan = subscriptionPlans[planId];
    if (!plan) {
      return res.status(400).json({
        success: false,
        error: 'Invalid plan selected',
        code: 'INVALID_PLAN'
      });
    }
    
    // Check if free plan
    if (planId === 'free') {
      const subscription = {
        plan: 'free',
        status: 'active',
        startDate: new Date().toISOString(),
        endDate: null,
        autoRenew: true
      };
      updateUserSubscription(userId, subscription);
      
      return res.json({
        success: true,
        message: 'Free plan activated',
        data: { subscription }
      });
    }
    
    // Calculate amount with coupon
    let amount = plan.price;
    let couponApplied = null;
    let discount = 0;
    
    if (couponCode) {
      const couponResult = applyCoupon(amount, couponCode);
      amount = couponResult.amount;
      discount = couponResult.discount;
      couponApplied = couponResult.couponApplied;
    }
    
    // Calculate end date
    const startDate = new Date();
    let endDate = new Date();
    if (plan.interval === 'month') {
      endDate.setMonth(endDate.getMonth() + 1);
    } else if (plan.interval === 'year') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }
    
    // Simulate payment processing
    // In production, integrate with Stripe
    const paymentIntent = {
      id: generateId('pi'),
      amount: Math.round(amount * 100), // in cents
      currency: plan.currency,
      status: 'succeeded',
      clientSecret: `pi_${generateId('secret')}`
    };
    
    // Record payment
    const payment = recordPayment(userId, amount, plan.currency, paymentMethodId || 'card', {
      planId,
      couponApplied,
      discount
    });
    
    // Create invoice
    const invoice = createInvoice(userId, amount, plan.currency, `${plan.name} Subscription`, {
      planId,
      interval: plan.interval,
      couponApplied
    });
    
    // Update user subscription
    const subscription = {
      plan: planId,
      status: 'active',
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      autoRenew: true,
      cancelAtPeriodEnd: false,
      paymentMethodId: paymentMethodId,
      couponApplied
    };
    updateUserSubscription(userId, subscription);
    
    res.json({
      success: true,
      message: 'Subscription created successfully',
      data: {
        subscription,
        payment: {
          id: payment.id,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status
        },
        invoice: {
          id: invoice.id,
          amount: invoice.amount,
          url: invoice.invoiceUrl
        },
        discount: discount > 0 ? {
          amount: discount,
          coupon: couponApplied
        } : null
      }
    });
  } catch (error) {
    console.error('Create subscription error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create subscription',
      code: 'SUBSCRIPTION_CREATION_FAILED'
    });
  }
});

/**
 * POST /api/payments/cancel-subscription
 * Cancel current subscription
 */
router.post('/cancel-subscription', authenticateToken, async (req, res) => {
  try {
    const { cancelImmediately = false, reason } = req.body;
    const userId = req.user.id;
    
    const currentSubscription = getUserSubscription(userId);
    
    if (currentSubscription.plan === 'free') {
      return res.status(400).json({
        success: false,
        error: 'No active subscription to cancel',
        code: 'NO_SUBSCRIPTION'
      });
    }
    
    if (cancelImmediately) {
      // Cancel immediately and downgrade to free
      currentSubscription.plan = 'free';
      currentSubscription.status = 'cancelled';
      currentSubscription.endDate = new Date().toISOString();
      currentSubscription.cancelledAt = new Date().toISOString();
      currentSubscription.cancelReason = reason || 'User requested cancellation';
    } else {
      // Cancel at period end
      currentSubscription.cancelAtPeriodEnd = true;
      currentSubscription.cancelReason = reason || 'User requested cancellation';
    }
    
    updateUserSubscription(userId, currentSubscription);
    
    res.json({
      success: true,
      message: cancelImmediately 
        ? 'Subscription cancelled immediately' 
        : 'Subscription will be cancelled at the end of billing period',
      data: {
        effectiveDate: cancelImmediately ? new Date().toISOString() : currentSubscription.endDate,
        plan: currentSubscription.plan
      }
    });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel subscription',
      code: 'CANCELLATION_FAILED'
    });
  }
});

/**
 * POST /api/payments/resume-subscription
 * Resume cancelled subscription
 */
router.post('/resume-subscription', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const currentSubscription = getUserSubscription(userId);
    
    if (!currentSubscription.cancelAtPeriodEnd) {
      return res.status(400).json({
        success: false,
        error: 'Subscription is not scheduled for cancellation',
        code: 'NOT_SCHEDULED_FOR_CANCELLATION'
      });
    }
    
    currentSubscription.cancelAtPeriodEnd = false;
    delete currentSubscription.cancelReason;
    updateUserSubscription(userId, currentSubscription);
    
    res.json({
      success: true,
      message: 'Subscription resumed successfully',
      data: {
        autoRenew: true,
        nextBillingDate: currentSubscription.endDate
      }
    });
  } catch (error) {
    console.error('Resume subscription error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resume subscription'
    });
  }
});

/**
 * POST /api/payments/update-payment-method
 * Update payment method
 */
router.post('/update-payment-method', authenticateToken, async (req, res) => {
  try {
    const { paymentMethodId, setupIntentId } = req.body;
    const userId = req.user.id;
    
    if (!paymentMethodId) {
      return res.status(400).json({
        success: false,
        error: 'Payment method ID is required'
      });
    }
    
    const subscription = getUserSubscription(userId);
    subscription.paymentMethodId = paymentMethodId;
    subscription.paymentMethodUpdatedAt = new Date().toISOString();
    updateUserSubscription(userId, subscription);
    
    res.json({
      success: true,
      message: 'Payment method updated successfully',
      data: {
        paymentMethodId: paymentMethodId.substring(0, 8) + '****',
        updatedAt: subscription.paymentMethodUpdatedAt
      }
    });
  } catch (error) {
    console.error('Update payment method error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update payment method'
    });
  }
});

/**
 * POST /api/payments/create-payment-intent
 * Create payment intent for one-time payment
 */
router.post('/create-payment-intent', authenticateToken, createPaymentIntentValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }
    
    const { amount, currency = 'usd', metadata = {} } = req.body;
    const userId = req.user.id;
    
    const paymentIntent = {
      id: generateId('pi'),
      amount: Math.round(amount * 100),
      currency,
      status: 'requires_payment_method',
      clientSecret: `pi_${generateId('secret')}`,
      metadata: {
        userId,
        ...metadata
      },
      createdAt: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: {
        clientSecret: paymentIntent.clientSecret,
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency
      }
    });
  } catch (error) {
    console.error('Create payment intent error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create payment intent'
    });
  }
});

/**
 * GET /api/payments/payment-history
 * Get user payment history
 */
router.get('/payment-history', authenticateToken, async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const userId = req.user.id;
    
    const payments = paymentHistory.get(userId) || [];
    const paginatedPayments = payments.slice(offset, offset + limit);
    
    res.json({
      success: true,
      data: {
        payments: paginatedPayments,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: payments.length
        }
      }
    });
  } catch (error) {
    console.error('Get payment history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve payment history'
    });
  }
});

/**
 * GET /api/payments/invoices
 * Get user invoices
 */
router.get('/invoices', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userInvoices = Array.from(invoices.values()).filter(
      invoice => invoice.userId === userId
    );
    
    res.json({
      success: true,
      data: {
        invoices: userInvoices.sort((a, b) => 
          new Date(b.createdAt) - new Date(a.createdAt)
        )
      }
    });
  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve invoices'
    });
  }
});

/**
 * GET /api/payments/invoices/:invoiceId
 * Get invoice by ID
 */
router.get('/invoices/:invoiceId', authenticateToken, async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const userId = req.user.id;
    
    const invoice = invoices.get(invoiceId);
    
    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found',
        code: 'INVOICE_NOT_FOUND'
      });
    }
    
    if (invoice.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        code: 'ACCESS_DENIED'
      });
    }
    
    res.json({
      success: true,
      data: invoice
    });
  } catch (error) {
    console.error('Get invoice error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve invoice'
    });
  }
});

/**
 * POST /api/payments/refund
 * Request refund for payment
 */
router.post('/refund', authenticateToken, refundValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }
    
    const { paymentId, amount, reason } = req.body;
    const userId = req.user.id;
    
    // Find payment
    let payment = null;
    const userPayments = paymentHistory.get(userId) || [];
    payment = userPayments.find(p => p.id === paymentId);
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found',
        code: 'PAYMENT_NOT_FOUND'
      });
    }
    
    // Check if already refunded
    if (payment.refunded) {
      return res.status(400).json({
        success: false,
        error: 'Payment already refunded',
        code: 'ALREADY_REFUNDED'
      });
    }
    
    // Calculate refund amount
    const refundAmount = amount || payment.amount;
    if (refundAmount > payment.amount) {
      return res.status(400).json({
        success: false,
        error: 'Refund amount exceeds payment amount',
        code: 'INVALID_REFUND_AMOUNT'
      });
    }
    
    // Process refund
    const refund = {
      id: generateId('ref'),
      paymentId,
      amount: refundAmount,
      currency: payment.currency,
      reason: reason || 'Customer request',
      status: 'succeeded',
      createdAt: new Date().toISOString()
    };
    
    payment.refunded = true;
    payment.refundAmount = refundAmount;
    payment.refundReason = reason;
    payment.refundedAt = refund.createdAt;
    
    res.json({
      success: true,
      message: 'Refund processed successfully',
      data: {
        refundId: refund.id,
        amount: refund.amount,
        currency: refund.currency,
        status: refund.status
      }
    });
  } catch (error) {
    console.error('Refund error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process refund'
    });
  }
});

/**
 * POST /api/payments/validate-coupon
 * Validate coupon code
 */
router.post('/validate-coupon', async (req, res) => {
  try {
    const { couponCode, planId } = req.body;
    
    if (!couponCode) {
      return res.status(400).json({
        success: false,
        error: 'Coupon code is required'
      });
    }
    
    const coupon = coupons.get(couponCode.toUpperCase());
    
    if (!coupon) {
      return res.status(404).json({
        success: false,
        error: 'Invalid coupon code',
        code: 'COUPON_NOT_FOUND'
      });
    }
    
    if (coupon.validUntil && new Date() > coupon.validUntil) {
      return res.status(400).json({
        success: false,
        error: 'Coupon has expired',
        code: 'COUPON_EXPIRED'
      });
    }
    
    let discountAmount = 0;
    if (planId && subscriptionPlans[planId]) {
      const plan = subscriptionPlans[planId];
      if (coupon.type === 'percentage') {
        discountAmount = (plan.price * coupon.discount) / 100;
      } else {
        discountAmount = Math.min(coupon.discount, plan.price);
      }
    }
    
    res.json({
      success: true,
      data: {
        code: couponCode.toUpperCase(),
        discount: coupon.discount,
        type: coupon.type,
        discountAmount: discountAmount > 0 ? discountAmount : null,
        validUntil: coupon.validUntil,
        description: `${coupon.discount}% off your subscription`
      }
    });
  } catch (error) {
    console.error('Validate coupon error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate coupon'
    });
  }
});

/**
 * POST /api/payments/webhook/stripe
 * Stripe webhook handler
 */
router.post('/webhook/stripe', webhookLimiter, express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const sig = req.headers['stripe-signature'];
    const payload = req.body;
    
    // In production: verify webhook signature
    // const event = stripe.webhooks.constructEvent(payload, sig, webhookSecret);
    
    const event = payload; // Mock for development
    
    switch (event.type) {
      case 'invoice.payment_succeeded':
        // Handle successful payment
        console.log('Payment succeeded:', event.data.object);
        break;
      case 'invoice.payment_failed':
        // Handle failed payment
        console.log('Payment failed:', event.data.object);
        break;
      case 'customer.subscription.deleted':
        // Handle subscription cancellation
        console.log('Subscription deleted:', event.data.object);
        break;
      default:
        console.log(`Unhandled event type ${event.type}`);
    }
    
    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).json({
      success: false,
      error: 'Webhook error'
    });
  }
});

// ============================================
// Admin Routes
// ============================================

/**
 * GET /api/payments/admin/subscriptions
 * Get all subscriptions (admin only)
 */
router.get('/admin/subscriptions', authenticateToken, async (req, res) => {
  try {
    // Check admin role
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }
    
    const subscriptions = Array.from(userSubscriptions.entries()).map(([userId, sub]) => ({
      userId,
      ...sub
    }));
    
    res.json({
      success: true,
      data: {
        subscriptions,
        total: subscriptions.length,
        summary: {
          free: subscriptions.filter(s => s.plan === 'free').length,
          pro: subscriptions.filter(s => s.plan.includes('pro')).length,
          family: subscriptions.filter(s => s.plan.includes('family')).length,
          enterprise: subscriptions.filter(s => s.plan === 'enterprise').length,
          monthlyRecurringRevenue: subscriptions.reduce((sum, s) => {
            const plan = subscriptionPlans[s.plan];
            if (plan && plan.price && s.status === 'active') {
              if (plan.interval === 'month') return sum + plan.price;
              if (plan.interval === 'year') return sum + (plan.price / 12);
            }
            return sum;
          }, 0)
        }
      }
    });
  } catch (error) {
    console.error('Admin get subscriptions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve subscriptions'
    });
  }
});

module.exports = router;
