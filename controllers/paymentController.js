// ============================================
// Payment Controller
// SpeakFlow - AI Language Learning Platform
// ============================================

const { validationResult } = require('express-validator');

// ============================================
// Constants & Configuration
// ============================================

const CURRENCIES = ['usd', 'eur', 'gbp', 'idr'];
const DEFAULT_CURRENCY = 'usd';

// Tax rates by country (mock)
const TAX_RATES = {
  US: 0.0,      // No VAT for US
  GB: 0.20,     // 20% VAT for UK
  DE: 0.19,     // 19% VAT for Germany
  FR: 0.20,     // 20% VAT for France
  ID: 0.11      // 11% VAT for Indonesia
};

// ============================================
// Subscription Plans
// ============================================

const SUBSCRIPTION_PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    priceId: null,
    currency: 'usd',
    interval: 'forever',
    intervalCount: 1,
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
      aiCallsPerDay: 10,
      maxConcurrentSessions: 1
    },
    isPopular: false,
    trialDays: 0
  },
  pro_monthly: {
    id: 'pro_monthly',
    name: 'Pro Monthly',
    price: 12.99,
    priceId: 'price_pro_monthly',
    currency: 'usd',
    interval: 'month',
    intervalCount: 1,
    features: [
      'Unlimited lessons',
      'Advanced pronunciation AI',
      '5000+ vocabulary words',
      'AI conversation partner',
      'Offline mode',
      'Priority support',
      'Detailed analytics',
      'Export learning data'
    ],
    limits: {
      dailyLessons: -1,
      vocabularyWords: 5000,
      storageMB: 500,
      aiCallsPerDay: 100,
      maxConcurrentSessions: 3
    },
    isPopular: true,
    trialDays: 7
  },
  pro_yearly: {
    id: 'pro_yearly',
    name: 'Pro Yearly',
    price: 99.99,
    priceId: 'price_pro_yearly',
    currency: 'usd',
    interval: 'year',
    intervalCount: 1,
    features: [
      'All Pro features',
      'Save 36% compared to monthly',
      '2 months free',
      'Exclusive webinars',
      'Priority support'
    ],
    limits: {
      dailyLessons: -1,
      vocabularyWords: 5000,
      storageMB: 500,
      aiCallsPerDay: 100,
      maxConcurrentSessions: 3
    },
    isPopular: false,
    trialDays: 7,
    savings: '36'
  },
  family_monthly: {
    id: 'family_monthly',
    name: 'Family Monthly',
    price: 24.99,
    priceId: 'price_family_monthly',
    currency: 'usd',
    interval: 'month',
    intervalCount: 1,
    features: [
      'Up to 5 family members',
      'All Pro features',
      'Family progress tracking',
      'Group practice sessions',
      '1-on-1 tutoring (2x/month)',
      'Premium support',
      'Family dashboard',
      'Parent controls'
    ],
    limits: {
      dailyLessons: -1,
      vocabularyWords: 10000,
      storageMB: 2000,
      aiCallsPerDay: 500,
      maxConcurrentSessions: 10,
      maxMembers: 5
    },
    isPopular: false,
    trialDays: 7
  },
  family_yearly: {
    id: 'family_yearly',
    name: 'Family Yearly',
    price: 199.99,
    priceId: 'price_family_yearly',
    currency: 'usd',
    interval: 'year',
    intervalCount: 1,
    features: [
      'All Family features',
      'Save 33% compared to monthly',
      '3 months free',
      'Family dashboard',
      'Parent controls',
      '24/7 priority support'
    ],
    limits: {
      dailyLessons: -1,
      vocabularyWords: 10000,
      storageMB: 2000,
      aiCallsPerDay: 500,
      maxConcurrentSessions: 10,
      maxMembers: 5
    },
    isPopular: false,
    trialDays: 7,
    savings: '33'
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    price: null,
    priceId: null,
    currency: 'usd',
    interval: 'custom',
    intervalCount: 1,
    features: [
      'Custom number of users',
      'SSO integration',
      'Advanced analytics',
      'Dedicated account manager',
      'Custom AI model training',
      'SLA guarantee',
      'On-premise deployment',
      '24/7 dedicated support',
      'Custom integrations'
    ],
    limits: {
      dailyLessons: -1,
      vocabularyWords: -1,
      storageMB: -1,
      aiCallsPerDay: -1,
      maxMembers: -1
    },
    isPopular: false,
    trialDays: 14
  }
};

// ============================================
// Mock Database
// ============================================

// User subscriptions
const userSubscriptions = new Map();

// Payment history
const paymentHistory = new Map();

// Invoices
const invoices = new Map();

// Coupons
const coupons = new Map([
  ['WELCOME20', { 
    code: 'WELCOME20', 
    discount: 20, 
    type: 'percentage', 
    validUntil: new Date('2025-12-31'),
    maxUses: 10000,
    usedCount: 1234,
    description: '20% off your first subscription'
  }],
  ['SAVE50', { 
    code: 'SAVE50', 
    discount: 50, 
    type: 'percentage', 
    validUntil: new Date('2025-06-30'),
    maxUses: 1000,
    usedCount: 567,
    description: '50% off limited time'
  }],
  ['FLASHSALE', { 
    code: 'FLASHSALE', 
    discount: 30, 
    type: 'percentage', 
    validUntil: new Date('2024-12-31'),
    maxUses: 5000,
    usedCount: 2345,
    description: 'Flash sale - 30% off'
  }],
  ['FREEMONTH', { 
    code: 'FREEMONTH', 
    discount: 12.99, 
    type: 'fixed', 
    validUntil: new Date('2024-06-30'),
    maxUses: 500,
    usedCount: 89,
    description: 'One free month of Pro'
  }]
]);

// Payment methods stored per user
const userPaymentMethods = new Map();

// ============================================
// Helper Functions
// ============================================

/**
 * Generate unique ID
 */
const generateId = (prefix) => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Get plan by ID
 */
const getPlanById = (planId) => {
  return SUBSCRIPTION_PLANS[planId] || null;
};

/**
 * Get all active plans
 */
const getAllPlans = () => {
  return Object.values(SUBSCRIPTION_PLANS).filter(plan => plan.price !== null);
};

/**
 * Calculate prorated amount for plan change
 */
const calculateProratedAmount = (currentPlanId, newPlanId, daysRemainingInCycle) => {
  const currentPlan = getPlanById(currentPlanId);
  const newPlan = getPlanById(newPlanId);
  
  if (!currentPlan || !newPlan || currentPlan.price === 0) {
    return newPlan.price;
  }
  
  // Calculate daily rate for current plan
  let daysInCycle = 30;
  if (currentPlan.interval === 'year') {
    daysInCycle = 365;
  }
  
  const currentDailyRate = currentPlan.price / daysInCycle;
  const refundAmount = currentDailyRate * daysRemainingInCycle;
  
  // Calculate remaining amount for new plan
  const newPlanDailyRate = newPlan.price / daysInCycle;
  const newPlanAmount = newPlanDailyRate * daysRemainingInCycle;
  
  const proratedAmount = Math.max(0, newPlanAmount - refundAmount);
  
  return Math.round(proratedAmount * 100) / 100;
};

/**
 * Apply coupon discount
 */
const applyCoupon = (amount, couponCode, planId) => {
  const coupon = coupons.get(couponCode.toUpperCase());
  
  if (!coupon) {
    return { amount, discount: 0, couponApplied: null, error: 'Invalid coupon code' };
  }
  
  if (coupon.validUntil && new Date() > coupon.validUntil) {
    return { amount, discount: 0, couponApplied: null, error: 'Coupon has expired' };
  }
  
  if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
    return { amount, discount: 0, couponApplied: null, error: 'Coupon has reached maximum uses' };
  }
  
  let discountAmount = 0;
  if (coupon.type === 'percentage') {
    discountAmount = (amount * coupon.discount) / 100;
  } else {
    discountAmount = Math.min(coupon.discount, amount);
  }
  
  discountAmount = Math.round(discountAmount * 100) / 100;
  
  return {
    amount: amount - discountAmount,
    discount: discountAmount,
    couponApplied: coupon.code,
    couponData: coupon,
    error: null
  };
};

/**
 * Calculate tax amount
 */
const calculateTax = (amount, countryCode) => {
  const taxRate = TAX_RATES[countryCode] || 0;
  const taxAmount = amount * taxRate;
  return {
    rate: taxRate,
    amount: Math.round(taxAmount * 100) / 100
  };
};

/**
 * Create invoice
 */
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
    invoiceNumber: `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    invoiceUrl: `https://speakflow.com/invoices/${generateId('inv')}`,
    downloadUrl: `https://speakflow.com/api/invoices/${generateId('inv')}/download`
  };
  
  invoices.set(invoice.id, invoice);
  return invoice;
};

/**
 * Record payment
 */
const recordPayment = (userId, amount, currency, paymentMethod, metadata = {}) => {
  const payment = {
    id: generateId('pay'),
    userId,
    amount,
    currency,
    paymentMethod,
    status: 'succeeded',
    createdAt: new Date().toISOString(),
    metadata,
    receiptUrl: `https://speakflow.com/receipts/${generateId('rec')}`
  };
  
  if (!paymentHistory.has(userId)) {
    paymentHistory.set(userId, []);
  }
  
  paymentHistory.get(userId).push(payment);
  
  return payment;
};

/**
 * Get user subscription
 */
const getUserSubscription = (userId) => {
  if (!userSubscriptions.has(userId)) {
    userSubscriptions.set(userId, {
      userId,
      planId: 'free',
      status: 'active',
      startDate: new Date().toISOString(),
      endDate: null,
      autoRenew: true,
      cancelAtPeriodEnd: false,
      trialEndDate: null,
      paymentMethodId: null
    });
  }
  
  return userSubscriptions.get(userId);
};

/**
 * Update user subscription
 */
const updateUserSubscription = (userId, updates) => {
  const subscription = getUserSubscription(userId);
  const updated = { ...subscription, ...updates, updatedAt: new Date().toISOString() };
  userSubscriptions.set(userId, updated);
  return updated;
};

/**
 * Cancel subscription
 */
const cancelSubscription = (userId, cancelImmediately = false, reason = null) => {
  const subscription = getUserSubscription(userId);
  
  if (subscription.planId === 'free') {
    return { success: false, error: 'No active subscription to cancel' };
  }
  
  if (cancelImmediately) {
    subscription.planId = 'free';
    subscription.status = 'cancelled';
    subscription.endDate = new Date().toISOString();
    subscription.cancelledAt = new Date().toISOString();
  } else {
    subscription.cancelAtPeriodEnd = true;
  }
  
  subscription.cancelReason = reason;
  userSubscriptions.set(userId, subscription);
  
  return { success: true, subscription };
};

/**
 * Get payment history for user
 */
const getUserPaymentHistory = (userId, limit = 50, offset = 0) => {
  const payments = paymentHistory.get(userId) || [];
  return payments.slice(offset, offset + limit);
};

/**
 * Get invoices for user
 */
const getUserInvoices = (userId) => {
  return Array.from(invoices.values()).filter(inv => inv.userId === userId);
};

/**
 * Save payment method for user
 */
const savePaymentMethod = (userId, paymentMethodId, cardDetails) => {
  if (!userPaymentMethods.has(userId)) {
    userPaymentMethods.set(userId, []);
  }
  
  const methods = userPaymentMethods.get(userId);
  const existingIndex = methods.findIndex(m => m.id === paymentMethodId);
  
  const paymentMethod = {
    id: paymentMethodId,
    userId,
    last4: cardDetails.last4,
    brand: cardDetails.brand,
    expMonth: cardDetails.expMonth,
    expYear: cardDetails.expYear,
    isDefault: methods.length === 0 || cardDetails.isDefault,
    createdAt: new Date().toISOString()
  };
  
  if (existingIndex >= 0) {
    methods[existingIndex] = paymentMethod;
  } else {
    methods.push(paymentMethod);
  }
  
  userPaymentMethods.set(userId, methods);
  return paymentMethod;
};

/**
 * Get user payment methods
 */
const getUserPaymentMethods = (userId) => {
  return userPaymentMethods.get(userId) || [];
};

/**
 * Process refund
 */
const processRefund = async (paymentId, amount, reason) => {
  // Find payment
  let payment = null;
  for (const [_, payments] of paymentHistory.entries()) {
    payment = payments.find(p => p.id === paymentId);
    if (payment) break;
  }
  
  if (!payment) {
    return { success: false, error: 'Payment not found' };
  }
  
  if (payment.refunded) {
    return { success: false, error: 'Payment already refunded' };
  }
  
  const refundAmount = amount || payment.amount;
  if (refundAmount > payment.amount) {
    return { success: false, error: 'Refund amount exceeds payment amount' };
  }
  
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
  
  return { success: true, refund };
};

/**
 * Calculate subscription metrics
 */
const calculateSubscriptionMetrics = () => {
  let activeSubscriptions = 0;
  let monthlyRecurringRevenue = 0;
  let yearlyRecurringRevenue = 0;
  
  for (const [_, sub] of userSubscriptions.entries()) {
    if (sub.status === 'active' && sub.planId !== 'free') {
      activeSubscriptions++;
      const plan = getPlanById(sub.planId);
      if (plan) {
        if (plan.interval === 'month') {
          monthlyRecurringRevenue += plan.price;
        } else if (plan.interval === 'year') {
          yearlyRecurringRevenue += plan.price;
          monthlyRecurringRevenue += plan.price / 12;
        }
      }
    }
  }
  
  return {
    activeSubscriptions,
    monthlyRecurringRevenue: Math.round(monthlyRecurringRevenue * 100) / 100,
    yearlyRecurringRevenue,
    averageRevenuePerUser: activeSubscriptions > 0 
      ? monthlyRecurringRevenue / activeSubscriptions 
      : 0
  };
};

// ============================================
// Controller Methods
// ============================================

/**
 * Get all subscription plans
 * GET /api/payments/plans
 */
exports.getPlans = async (req, res) => {
  try {
    const { currency = DEFAULT_CURRENCY } = req.query;
    
    const plans = getAllPlans().map(plan => ({
      id: plan.id,
      name: plan.name,
      price: plan.price,
      priceId: plan.priceId,
      currency: plan.currency,
      interval: plan.interval,
      intervalCount: plan.intervalCount,
      features: plan.features,
      limits: plan.limits,
      isPopular: plan.isPopular,
      trialDays: plan.trialDays,
      savings: plan.savings || null
    }));
    
    res.json({
      success: true,
      data: {
        plans,
        currency,
        taxInclusive: false
      }
    });
    
  } catch (error) {
    console.error('Get plans error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve subscription plans',
      code: 'PLANS_RETRIEVAL_FAILED'
    });
  }
};

/**
 * Get current user subscription
 * GET /api/payments/current-subscription
 */
exports.getCurrentSubscription = async (req, res) => {
  try {
    const userId = req.user.id;
    const subscription = getUserSubscription(userId);
    const plan = getPlanById(subscription.planId);
    
    // Calculate days remaining in trial
    let trialDaysRemaining = 0;
    if (subscription.trialEndDate) {
      const trialEnd = new Date(subscription.trialEndDate);
      const now = new Date();
      if (trialEnd > now) {
        trialDaysRemaining = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));
      }
    }
    
    // Calculate days until next billing
    let daysUntilBilling = 0;
    if (subscription.endDate && subscription.status === 'active') {
      const endDate = new Date(subscription.endDate);
      const now = new Date();
      if (endDate > now) {
        daysUntilBilling = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
      }
    }
    
    res.json({
      success: true,
      data: {
        plan: {
          id: plan.id,
          name: plan.name,
          price: plan.price,
          interval: plan.interval,
          features: plan.features,
          limits: plan.limits
        },
        status: subscription.status,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        autoRenew: subscription.autoRenew && !subscription.cancelAtPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd || false,
        trialEndDate: subscription.trialEndDate,
        trialDaysRemaining,
        daysUntilBilling,
        paymentMethodId: subscription.paymentMethodId
      }
    });
    
  } catch (error) {
    console.error('Get current subscription error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve subscription information',
      code: 'SUBSCRIPTION_RETRIEVAL_FAILED'
    });
  }
};

/**
 * Create new subscription
 * POST /api/payments/create-subscription
 */
exports.createSubscription = async (req, res) => {
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
    const userCountry = req.user.country || 'US';
    
    // Get plan details
    const plan = getPlanById(planId);
    if (!plan) {
      return res.status(400).json({
        success: false,
        error: 'Invalid plan selected',
        code: 'INVALID_PLAN'
      });
    }
    
    // Check if switching from existing subscription
    const currentSubscription = getUserSubscription(userId);
    const isUpgrade = currentSubscription.planId !== 'free' && currentSubscription.planId !== planId;
    
    let amount = plan.price;
    let discount = 0;
    let couponApplied = null;
    let taxAmount = 0;
    
    // Apply proration if upgrading
    if (isUpgrade && currentSubscription.endDate) {
      const daysRemaining = Math.ceil((new Date(currentSubscription.endDate) - new Date()) / (1000 * 60 * 60 * 24));
      amount = calculateProratedAmount(currentSubscription.planId, planId, daysRemaining);
    }
    
    // Apply coupon
    if (couponCode) {
      const couponResult = applyCoupon(amount, couponCode, planId);
      if (couponResult.error) {
        return res.status(400).json({
          success: false,
          error: couponResult.error,
          code: 'COUPON_ERROR'
        });
      }
      amount = couponResult.amount;
      discount = couponResult.discount;
      couponApplied = couponResult.couponApplied;
      
      // Increment coupon usage
      const coupon = coupons.get(couponCode.toUpperCase());
      if (coupon) {
        coupon.usedCount++;
        coupons.set(couponCode.toUpperCase(), coupon);
      }
    }
    
    // Calculate tax
    const tax = calculateTax(amount, userCountry);
    taxAmount = tax.amount;
    const totalAmount = amount + taxAmount;
    
    // Calculate end date
    const startDate = new Date();
    let endDate = new Date();
    if (plan.interval === 'month') {
      endDate.setMonth(endDate.getMonth() + plan.intervalCount);
    } else if (plan.interval === 'year') {
      endDate.setFullYear(endDate.getFullYear() + plan.intervalCount);
    }
    
    // Calculate trial end date
    let trialEndDate = null;
    if (plan.trialDays > 0 && currentSubscription.planId === 'free') {
      trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + plan.trialDays);
    }
    
    // Process payment (mock)
    const payment = recordPayment(userId, totalAmount, plan.currency, paymentMethodId || 'card', {
      planId,
      couponApplied,
      discount,
      tax: taxAmount,
      isUpgrade
    });
    
    // Create invoice
    const invoice = createInvoice(userId, totalAmount, plan.currency, `${plan.name} Subscription`, {
      planId,
      interval: plan.interval,
      couponApplied,
      discount,
      tax: taxAmount
    });
    
    // Update subscription
    const subscription = {
      userId,
      planId,
      status: trialEndDate ? 'trialing' : 'active',
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      trialEndDate: trialEndDate ? trialEndDate.toISOString() : null,
      autoRenew: true,
      cancelAtPeriodEnd: false,
      paymentMethodId,
      couponApplied,
      updatedAt: new Date().toISOString()
    };
    
    userSubscriptions.set(userId, subscription);
    
    res.json({
      success: true,
      message: isUpgrade ? 'Subscription upgraded successfully' : 'Subscription created successfully',
      data: {
        subscription: {
          planId: subscription.planId,
          status: subscription.status,
          startDate: subscription.startDate,
          endDate: subscription.endDate,
          trialEndDate: subscription.trialEndDate
        },
        payment: {
          id: payment.id,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          receiptUrl: payment.receiptUrl
        },
        invoice: {
          id: invoice.id,
          amount: invoice.amount,
          invoiceNumber: invoice.invoiceNumber,
          url: invoice.invoiceUrl
        },
        discount: discount > 0 ? {
          amount: discount,
          coupon: couponApplied,
          type: 'percentage'
        } : null,
        tax: taxAmount > 0 ? {
          amount: taxAmount,
          rate: tax.rate
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
};

/**
 * Cancel subscription
 * POST /api/payments/cancel-subscription
 */
exports.cancelSubscription = async (req, res) => {
  try {
    const { cancelImmediately = false, reason } = req.body;
    const userId = req.user.id;
    
    const result = cancelSubscription(userId, cancelImmediately, reason);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
        code: 'CANCELLATION_FAILED'
      });
    }
    
    res.json({
      success: true,
      message: cancelImmediately 
        ? 'Subscription cancelled immediately' 
        : 'Subscription will be cancelled at the end of billing period',
      data: {
        effectiveDate: cancelImmediately ? new Date().toISOString() : result.subscription.endDate,
        plan: result.subscription.planId,
        cancelAtPeriodEnd: result.subscription.cancelAtPeriodEnd
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
};

/**
 * Resume subscription
 * POST /api/payments/resume-subscription
 */
exports.resumeSubscription = async (req, res) => {
  try {
    const userId = req.user.id;
    const subscription = getUserSubscription(userId);
    
    if (!subscription.cancelAtPeriodEnd) {
      return res.status(400).json({
        success: false,
        error: 'Subscription is not scheduled for cancellation',
        code: 'NOT_SCHEDULED_FOR_CANCELLATION'
      });
    }
    
    subscription.cancelAtPeriodEnd = false;
    delete subscription.cancelReason;
    userSubscriptions.set(userId, subscription);
    
    res.json({
      success: true,
      message: 'Subscription resumed successfully',
      data: {
        autoRenew: true,
        nextBillingDate: subscription.endDate
      }
    });
    
  } catch (error) {
    console.error('Resume subscription error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resume subscription'
    });
  }
};

/**
 * Update payment method
 * POST /api/payments/update-payment-method
 */
exports.updatePaymentMethod = async (req, res) => {
  try {
    const { paymentMethodId, cardDetails } = req.body;
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
    userSubscriptions.set(userId, subscription);
    
    if (cardDetails) {
      savePaymentMethod(userId, paymentMethodId, cardDetails);
    }
    
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
};

/**
 * Get payment methods
 * GET /api/payments/payment-methods
 */
exports.getPaymentMethods = async (req, res) => {
  try {
    const userId = req.user.id;
    const methods = getUserPaymentMethods(userId);
    
    res.json({
      success: true,
      data: methods.map(m => ({
        id: m.id,
        last4: m.last4,
        brand: m.brand,
        expMonth: m.expMonth,
        expYear: m.expYear,
        isDefault: m.isDefault
      }))
    });
    
  } catch (error) {
    console.error('Get payment methods error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve payment methods'
    });
  }
};

/**
 * Get payment history
 * GET /api/payments/payment-history
 */
exports.getPaymentHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 20, offset = 0 } = req.query;
    
    const payments = getUserPaymentHistory(userId, parseInt(limit), parseInt(offset));
    
    res.json({
      success: true,
      data: {
        payments: payments.map(p => ({
          id: p.id,
          amount: p.amount,
          currency: p.currency,
          status: p.status,
          createdAt: p.createdAt,
          receiptUrl: p.receiptUrl,
          description: p.metadata?.planId ? `${p.metadata.planId} subscription` : 'Payment',
          refunded: p.refunded || false,
          refundAmount: p.refundAmount || null
        })),
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: (paymentHistory.get(userId) || []).length
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
};

/**
 * Get invoices
 * GET /api/payments/invoices
 */
exports.getInvoices = async (req, res) => {
  try {
    const userId = req.user.id;
    const invoices = getUserInvoices(userId);
    
    res.json({
      success: true,
      data: invoices.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(inv => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        amount: inv.amount,
        currency: inv.currency,
        status: inv.status,
        createdAt: inv.createdAt,
        description: inv.description,
        url: inv.invoiceUrl,
        downloadUrl: inv.downloadUrl
      }))
    });
    
  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve invoices'
    });
  }
};

/**
 * Get invoice by ID
 * GET /api/payments/invoices/:invoiceId
 */
exports.getInvoiceById = async (req, res) => {
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
};

/**
 * Request refund
 * POST /api/payments/refund
 */
exports.requestRefund = async (req, res) => {
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
    
    const result = await processRefund(paymentId, amount, reason);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
        code: 'REFUND_FAILED'
      });
    }
    
    res.json({
      success: true,
      message: 'Refund processed successfully',
      data: {
        refundId: result.refund.id,
        amount: result.refund.amount,
        currency: result.refund.currency,
        status: result.refund.status
      }
    });
    
  } catch (error) {
    console.error('Refund error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process refund'
    });
  }
};

/**
 * Validate coupon
 * POST /api/payments/validate-coupon
 */
exports.validateCoupon = async (req, res) => {
  try {
    const { couponCode, planId } = req.body;
    
    if (!couponCode) {
      return res.status(400).json({
        success: false,
        error: 'Coupon code is required'
      });
    }
    
    const plan = planId ? getPlanById(planId) : null;
    const amount = plan ? plan.price : 100;
    
    const result = applyCoupon(amount, couponCode, planId);
    
    if (result.error) {
      return res.status(400).json({
        success: false,
        error: result.error,
        code: 'COUPON_INVALID'
      });
    }
    
    res.json({
      success: true,
      data: {
        code: result.couponApplied,
        discount: result.discount,
        type: result.couponData.type,
        discountAmount: result.discount,
        newAmount: result.amount,
        savings: result.discount > 0 ? `${Math.round((result.discount / (result.amount + result.discount)) * 100)}%` : null,
        description: result.couponData.description,
        validUntil: result.couponData.validUntil
      }
    });
    
  } catch (error) {
    console.error('Validate coupon error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate coupon'
    });
  }
};

/**
 * Get billing summary
 * GET /api/payments/billing-summary
 */
exports.getBillingSummary = async (req, res) => {
  try {
    const userId = req.user.id;
    const subscription = getUserSubscription(userId);
    const plan = getPlanById(subscription.planId);
    
    const payments = getUserPaymentHistory(userId);
    const totalSpent = payments.reduce((sum, p) => sum + p.amount, 0);
    
    res.json({
      success: true,
      data: {
        currentPlan: {
          name: plan.name,
          price: plan.price,
          interval: plan.interval,
          nextBillingDate: subscription.endDate,
          status: subscription.status
        },
        billingHistory: {
          totalSpent,
          totalPayments: payments.length,
          firstPayment: payments[payments.length - 1]?.createdAt || null,
          lastPayment: payments[0]?.createdAt || null
        },
        paymentMethod: subscription.paymentMethodId ? {
          id: subscription.paymentMethodId,
          last4: subscription.paymentMethodLast4 || '****'
        } : null
      }
    });
    
  } catch (error) {
    console.error('Get billing summary error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve billing summary'
    });
  }
};

// ============================================
// Admin Controller Methods
// ============================================

/**
 * Get all subscriptions (admin)
 * GET /api/payments/admin/subscriptions
 */
exports.adminGetSubscriptions = async (req, res) => {
  try {
    const subscriptions = Array.from(userSubscriptions.values());
    const metrics = calculateSubscriptionMetrics();
    
    res.json({
      success: true,
      data: {
        subscriptions: subscriptions.map(sub => ({
          ...sub,
          planDetails: getPlanById(sub.planId)
        })),
        metrics,
        total: subscriptions.length
      }
    });
    
  } catch (error) {
    console.error('Admin get subscriptions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve subscriptions'
    });
  }
};

/**
 * Get all payments (admin)
 * GET /api/payments/admin/payments
 */
exports.adminGetPayments = async (req, res) => {
  try {
    const allPayments = [];
    for (const [_, payments] of paymentHistory.entries()) {
      allPayments.push(...payments);
    }
    
    allPayments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json({
      success: true,
      data: {
        payments: allPayments,
        total: allPayments.length,
        totalRevenue: allPayments.reduce((sum, p) => sum + p.amount, 0)
      }
    });
    
  } catch (error) {
    console.error('Admin get payments error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve payments'
    });
  }
};

// ============================================
// Webhook Handler
// ============================================

/**
 * Stripe webhook handler
 * POST /api/payments/webhook/stripe
 */
exports.handleWebhook = async (req, res) => {
  try {
    const signature = req.headers['stripe-signature'];
    const payload = req.body;
    
    // In production: verify webhook signature
    // const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    
    const event = payload;
    
    switch (event.type) {
      case 'invoice.payment_succeeded':
        // Handle successful payment
        console.log('[WEBHOOK] Payment succeeded:', event.data.object);
        break;
        
      case 'invoice.payment_failed':
        // Handle failed payment
        console.log('[WEBHOOK] Payment failed:', event.data.object);
        break;
        
      case 'customer.subscription.deleted':
        // Handle subscription cancellation
        console.log('[WEBHOOK] Subscription deleted:', event.data.object);
        break;
        
      case 'customer.subscription.updated':
        // Handle subscription update
        console.log('[WEBHOOK] Subscription updated:', event.data.object);
        break;
        
      default:
        console.log(`[WEBHOOK] Unhandled event type: ${event.type}`);
    }
    
    res.json({ received: true });
    
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).json({
      success: false,
      error: 'Webhook error'
    });
  }
};

// ============================================
// Export all methods
// ============================================

module.exports = exports;
