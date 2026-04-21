// ============================================
// Payment Service
// SpeakFlow - AI Language Learning Platform
// ============================================

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { logger } = require('../middleware/logging');
const { AppError } = require('../middleware/errorHandler');

// ============================================
// Constants & Configuration
// ============================================

// Subscription plans
const SUBSCRIPTION_PLANS = {
  PRO_MONTHLY: {
    id: 'pro_monthly',
    name: 'Pro Monthly',
    price: 12.99,
    currency: 'usd',
    interval: 'month',
    intervalCount: 1,
    stripePriceId: process.env.STRIPE_PRICE_PRO_MONTHLY,
    features: [
      'Unlimited lessons',
      'Advanced pronunciation AI',
      '5000+ vocabulary words',
      'AI conversation partner',
      'Offline mode',
      'Priority support'
    ],
    trialDays: 7
  },
  PRO_YEARLY: {
    id: 'pro_yearly',
    name: 'Pro Yearly',
    price: 99.99,
    currency: 'usd',
    interval: 'year',
    intervalCount: 1,
    stripePriceId: process.env.STRIPE_PRICE_PRO_YEARLY,
    features: [
      'All Pro features',
      'Save 36% compared to monthly',
      '2 months free',
      'Exclusive webinars'
    ],
    trialDays: 7,
    savings: 36
  },
  FAMILY_MONTHLY: {
    id: 'family_monthly',
    name: 'Family Monthly',
    price: 24.99,
    currency: 'usd',
    interval: 'month',
    intervalCount: 1,
    stripePriceId: process.env.STRIPE_PRICE_FAMILY_MONTHLY,
    features: [
      'Up to 5 family members',
      'All Pro features',
      'Family progress tracking',
      'Group practice sessions',
      '1-on-1 tutoring (2x/month)',
      'Premium support'
    ],
    trialDays: 7
  },
  FAMILY_YEARLY: {
    id: 'family_yearly',
    name: 'Family Yearly',
    price: 199.99,
    currency: 'usd',
    interval: 'year',
    intervalCount: 1,
    stripePriceId: process.env.STRIPE_PRICE_FAMILY_YEARLY,
    features: [
      'All Family features',
      'Save 33% compared to monthly',
      '3 months free',
      'Family dashboard',
      'Parent controls'
    ],
    trialDays: 7,
    savings: 33
  }
};

// Payment statuses
const PAYMENT_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  REFUNDED: 'refunded',
  PARTIALLY_REFUNDED: 'partially_refunded',
  DISPUTED: 'disputed'
};

// Invoice statuses
const INVOICE_STATUS = {
  DRAFT: 'draft',
  OPEN: 'open',
  PAID: 'paid',
  UNCOLLECTIBLE: 'uncollectible',
  VOID: 'void'
};

// ============================================
// Helper Functions
// ============================================

/**
 * Format amount for Stripe (cents)
 */
const formatAmountForStripe = (amount) => {
  return Math.round(amount * 100);
};

/**
 * Format amount from Stripe (dollars)
 */
const formatAmountFromStripe = (amount) => {
  return amount / 100;
};

/**
 * Generate unique ID
 */
const generateId = (prefix) => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Log payment event
 */
const logPaymentEvent = (event, data) => {
  logger.info(`Payment event: ${event}`, data);
};

// ============================================
// Customer Management
// ============================================

/**
 * Create or retrieve Stripe customer
 * @param {string} userId - User ID
 * @param {string} email - User email
 * @param {string} name - User name
 */
const getOrCreateCustomer = async (userId, email, name) => {
  try {
    // Check if customer already exists (in production, store customerId in DB)
    // For now, create new customer
    const customer = await stripe.customers.create({
      email,
      name,
      metadata: {
        userId,
        platform: 'speakflow',
        environment: process.env.NODE_ENV || 'development'
      }
    });
    
    logPaymentEvent('customer_created', {
      customerId: customer.id,
      userId,
      email
    });
    
    return customer;
  } catch (error) {
    logger.error('Failed to create customer:', error);
    throw new AppError('Failed to create customer', 500, 'CUSTOMER_CREATION_FAILED');
  }
};

/**
 * Get customer by ID
 */
const getCustomer = async (customerId) => {
  try {
    return await stripe.customers.retrieve(customerId);
  } catch (error) {
    logger.error('Failed to retrieve customer:', error);
    throw new AppError('Customer not found', 404, 'CUSTOMER_NOT_FOUND');
  }
};

/**
 * Update customer
 */
const updateCustomer = async (customerId, updates) => {
  try {
    const customer = await stripe.customers.update(customerId, updates);
    logPaymentEvent('customer_updated', { customerId, updates });
    return customer;
  } catch (error) {
    logger.error('Failed to update customer:', error);
    throw new AppError('Failed to update customer', 500, 'CUSTOMER_UPDATE_FAILED');
  }
};

// ============================================
// Payment Method Management
// ============================================

/**
 * Attach payment method to customer
 */
const attachPaymentMethod = async (customerId, paymentMethodId) => {
  try {
    const paymentMethod = await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId
    });
    
    // Set as default payment method
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId
      }
    });
    
    logPaymentEvent('payment_method_attached', {
      customerId,
      paymentMethodId,
      brand: paymentMethod.card?.brand,
      last4: paymentMethod.card?.last4
    });
    
    return paymentMethod;
  } catch (error) {
    logger.error('Failed to attach payment method:', error);
    throw new AppError('Failed to attach payment method', 500, 'ATTACH_PAYMENT_METHOD_FAILED');
  }
};

/**
 * Detach payment method
 */
const detachPaymentMethod = async (paymentMethodId) => {
  try {
    const paymentMethod = await stripe.paymentMethods.detach(paymentMethodId);
    logPaymentEvent('payment_method_detached', { paymentMethodId });
    return paymentMethod;
  } catch (error) {
    logger.error('Failed to detach payment method:', error);
    throw new AppError('Failed to detach payment method', 500, 'DETACH_PAYMENT_METHOD_FAILED');
  }
};

/**
 * Get customer payment methods
 */
const getPaymentMethods = async (customerId, type = 'card') => {
  try {
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type
    });
    
    return paymentMethods.data;
  } catch (error) {
    logger.error('Failed to get payment methods:', error);
    throw new AppError('Failed to retrieve payment methods', 500, 'GET_PAYMENT_METHODS_FAILED');
  }
};

// ============================================
// Subscription Management
// ============================================

/**
 * Create subscription
 * @param {string} customerId - Stripe customer ID
 * @param {string} priceId - Stripe price ID
 * @param {Object} options - Additional options
 */
const createSubscription = async (customerId, priceId, options = {}) => {
  try {
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      trial_period_days: options.trialDays || 7,
      metadata: {
        userId: options.userId,
        planId: options.planId,
        ...options.metadata
      },
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent']
    });
    
    logPaymentEvent('subscription_created', {
      subscriptionId: subscription.id,
      customerId,
      priceId,
      planId: options.planId
    });
    
    return subscription;
  } catch (error) {
    logger.error('Failed to create subscription:', error);
    throw new AppError('Failed to create subscription', 500, 'SUBSCRIPTION_CREATION_FAILED');
  }
};

/**
 * Get subscription
 */
const getSubscription = async (subscriptionId) => {
  try {
    return await stripe.subscriptions.retrieve(subscriptionId);
  } catch (error) {
    logger.error('Failed to retrieve subscription:', error);
    throw new AppError('Subscription not found', 404, 'SUBSCRIPTION_NOT_FOUND');
  }
};

/**
 * Update subscription
 */
const updateSubscription = async (subscriptionId, updates) => {
  try {
    const subscription = await stripe.subscriptions.update(subscriptionId, updates);
    logPaymentEvent('subscription_updated', { subscriptionId, updates });
    return subscription;
  } catch (error) {
    logger.error('Failed to update subscription:', error);
    throw new AppError('Failed to update subscription', 500, 'SUBSCRIPTION_UPDATE_FAILED');
  }
};

/**
 * Cancel subscription
 */
const cancelSubscription = async (subscriptionId, cancelAtPeriodEnd = true) => {
  try {
    let subscription;
    
    if (cancelAtPeriodEnd) {
      subscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true
      });
    } else {
      subscription = await stripe.subscriptions.cancel(subscriptionId);
    }
    
    logPaymentEvent('subscription_cancelled', {
      subscriptionId,
      cancelAtPeriodEnd,
      effectiveDate: cancelAtPeriodEnd ? subscription.current_period_end : new Date().toISOString()
    });
    
    return subscription;
  } catch (error) {
    logger.error('Failed to cancel subscription:', error);
    throw new AppError('Failed to cancel subscription', 500, 'SUBSCRIPTION_CANCEL_FAILED');
  }
};

/**
 * Resume subscription
 */
const resumeSubscription = async (subscriptionId) => {
  try {
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false
    });
    
    logPaymentEvent('subscription_resumed', { subscriptionId });
    
    return subscription;
  } catch (error) {
    logger.error('Failed to resume subscription:', error);
    throw new AppError('Failed to resume subscription', 500, 'SUBSCRIPTION_RESUME_FAILED');
  }
};

/**
 * Change subscription plan
 */
const changeSubscriptionPlan = async (subscriptionId, newPriceId, prorationBehavior = 'always_invoice') => {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
      items: [{
        id: subscription.items.data[0].id,
        price: newPriceId,
        proration_behavior: prorationBehavior
      }],
      proration_behavior: prorationBehavior
    });
    
    logPaymentEvent('subscription_plan_changed', {
      subscriptionId,
      oldPriceId: subscription.items.data[0].price.id,
      newPriceId,
      prorationBehavior
    });
    
    return updatedSubscription;
  } catch (error) {
    logger.error('Failed to change subscription plan:', error);
    throw new AppError('Failed to change subscription plan', 500, 'PLAN_CHANGE_FAILED');
  }
};

// ============================================
// Payment Intent Management
// ============================================

/**
 * Create payment intent for one-time payment
 */
const createPaymentIntent = async (amount, currency = 'usd', customerId = null, metadata = {}) => {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: formatAmountForStripe(amount),
      currency,
      customer: customerId,
      metadata,
      payment_method_types: ['card']
    });
    
    logPaymentEvent('payment_intent_created', {
      paymentIntentId: paymentIntent.id,
      amount,
      currency,
      customerId
    });
    
    return paymentIntent;
  } catch (error) {
    logger.error('Failed to create payment intent:', error);
    throw new AppError('Failed to create payment intent', 500, 'PAYMENT_INTENT_FAILED');
  }
};

/**
 * Confirm payment intent
 */
const confirmPaymentIntent = async (paymentIntentId, paymentMethodId) => {
  try {
    const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId, {
      payment_method: paymentMethodId
    });
    
    logPaymentEvent('payment_intent_confirmed', {
      paymentIntentId,
      status: paymentIntent.status
    });
    
    return paymentIntent;
  } catch (error) {
    logger.error('Failed to confirm payment intent:', error);
    throw new AppError('Failed to confirm payment', 500, 'PAYMENT_CONFIRM_FAILED');
  }
};

/**
 * Get payment intent
 */
const getPaymentIntent = async (paymentIntentId) => {
  try {
    return await stripe.paymentIntents.retrieve(paymentIntentId);
  } catch (error) {
    logger.error('Failed to retrieve payment intent:', error);
    throw new AppError('Payment intent not found', 404, 'PAYMENT_INTENT_NOT_FOUND');
  }
};

// ============================================
// Refund Management
// ============================================

/**
 * Process refund
 */
const processRefund = async (paymentIntentId, amount = null, reason = 'requested_by_customer') => {
  try {
    const refundParams = {
      payment_intent: paymentIntentId,
      reason
    };
    
    if (amount) {
      refundParams.amount = formatAmountForStripe(amount);
    }
    
    const refund = await stripe.refunds.create(refundParams);
    
    logPaymentEvent('refund_processed', {
      refundId: refund.id,
      paymentIntentId,
      amount: amount || 'full',
      reason
    });
    
    return refund;
  } catch (error) {
    logger.error('Failed to process refund:', error);
    throw new AppError('Failed to process refund', 500, 'REFUND_FAILED');
  }
};

/**
 * Get refund
 */
const getRefund = async (refundId) => {
  try {
    return await stripe.refunds.retrieve(refundId);
  } catch (error) {
    logger.error('Failed to retrieve refund:', error);
    throw new AppError('Refund not found', 404, 'REFUND_NOT_FOUND');
  }
};

// ============================================
// Invoice Management
// ============================================

/**
 * Get customer invoices
 */
const getInvoices = async (customerId, limit = 10) => {
  try {
    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit
    });
    
    return invoices.data;
  } catch (error) {
    logger.error('Failed to retrieve invoices:', error);
    throw new AppError('Failed to retrieve invoices', 500, 'INVOICES_FAILED');
  }
};

/**
 * Get invoice by ID
 */
const getInvoice = async (invoiceId) => {
  try {
    return await stripe.invoices.retrieve(invoiceId);
  } catch (error) {
    logger.error('Failed to retrieve invoice:', error);
    throw new AppError('Invoice not found', 404, 'INVOICE_NOT_FOUND');
  }
};

/**
 * Pay invoice
 */
const payInvoice = async (invoiceId) => {
  try {
    const invoice = await stripe.invoices.pay(invoiceId);
    logPaymentEvent('invoice_paid', { invoiceId });
    return invoice;
  } catch (error) {
    logger.error('Failed to pay invoice:', error);
    throw new AppError('Failed to pay invoice', 500, 'INVOICE_PAY_FAILED');
  }
};

// ============================================
// Webhook Handling
// ============================================

/**
 * Handle Stripe webhook events
 */
const handleWebhook = async (event) => {
  logPaymentEvent('webhook_received', { type: event.type, id: event.id });
  
  switch (event.type) {
    case 'customer.subscription.created':
      await handleSubscriptionCreated(event.data.object);
      break;
      
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object);
      break;
      
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object);
      break;
      
    case 'invoice.payment_succeeded':
      await handleInvoicePaymentSucceeded(event.data.object);
      break;
      
    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(event.data.object);
      break;
      
    case 'payment_intent.succeeded':
      await handlePaymentIntentSucceeded(event.data.object);
      break;
      
    case 'payment_intent.payment_failed':
      await handlePaymentIntentFailed(event.data.object);
      break;
      
    case 'charge.refunded':
      await handleChargeRefunded(event.data.object);
      break;
      
    case 'charge.dispute.created':
      await handleDisputeCreated(event.data.object);
      break;
      
    default:
      logger.info(`Unhandled webhook event type: ${event.type}`);
  }
  
  return { received: true };
};

/**
 * Handle subscription created
 */
const handleSubscriptionCreated = async (subscription) => {
  logger.info('Subscription created', {
    subscriptionId: subscription.id,
    customerId: subscription.customer,
    status: subscription.status
  });
  // In production: update database with subscription status
};

/**
 * Handle subscription updated
 */
const handleSubscriptionUpdated = async (subscription) => {
  logger.info('Subscription updated', {
    subscriptionId: subscription.id,
    status: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end
  });
  // In production: update database
};

/**
 * Handle subscription deleted
 */
const handleSubscriptionDeleted = async (subscription) => {
  logger.info('Subscription deleted', {
    subscriptionId: subscription.id,
    customerId: subscription.customer
  });
  // In production: update database, downgrade user to free plan
};

/**
 * Handle invoice payment succeeded
 */
const handleInvoicePaymentSucceeded = async (invoice) => {
  logger.info('Invoice payment succeeded', {
    invoiceId: invoice.id,
    customerId: invoice.customer,
    amount: formatAmountFromStripe(invoice.amount_paid),
    subscriptionId: invoice.subscription
  });
  // In production: update payment records, send receipt email
};

/**
 * Handle invoice payment failed
 */
const handleInvoicePaymentFailed = async (invoice) => {
  logger.info('Invoice payment failed', {
    invoiceId: invoice.id,
    customerId: invoice.customer,
    subscriptionId: invoice.subscription
  });
  // In production: send payment failed notification, retry logic
};

/**
 * Handle payment intent succeeded
 */
const handlePaymentIntentSucceeded = async (paymentIntent) => {
  logger.info('Payment intent succeeded', {
    paymentIntentId: paymentIntent.id,
    amount: formatAmountFromStripe(paymentIntent.amount),
    customerId: paymentIntent.customer
  });
};

/**
 * Handle payment intent failed
 */
const handlePaymentIntentFailed = async (paymentIntent) => {
  logger.info('Payment intent failed', {
    paymentIntentId: paymentIntent.id,
    error: paymentIntent.last_payment_error?.message
  });
};

/**
 * Handle charge refunded
 */
const handleChargeRefunded = async (charge) => {
  logger.info('Charge refunded', {
    chargeId: charge.id,
    amount: formatAmountFromStripe(charge.amount_refunded),
    paymentIntentId: charge.payment_intent
  });
};

/**
 * Handle dispute created
 */
const handleDisputeCreated = async (dispute) => {
  logger.warn('Dispute created', {
    disputeId: dispute.id,
    chargeId: dispute.charge,
    amount: formatAmountFromStripe(dispute.amount),
    reason: dispute.reason
  });
};

// ============================================
// Plan Management
// ============================================

/**
 * Get all subscription plans
 */
const getPlans = () => {
  return Object.values(SUBSCRIPTION_PLANS);
};

/**
 * Get plan by ID
 */
const getPlanById = (planId) => {
  const plan = SUBSCRIPTION_PLANS[planId.toUpperCase()];
  if (!plan) {
    throw new AppError(`Plan not found: ${planId}`, 404, 'PLAN_NOT_FOUND');
  }
  return plan;
};

/**
 * Calculate prorated amount for plan change
 */
const calculateProratedAmount = (currentPlanId, newPlanId, daysRemaining) => {
  const currentPlan = getPlanById(currentPlanId);
  const newPlan = getPlanById(newPlanId);
  
  const dailyRateCurrent = currentPlan.price / 30;
  const refundAmount = dailyRateCurrent * daysRemaining;
  
  const dailyRateNew = newPlan.price / 30;
  const newAmount = dailyRateNew * daysRemaining;
  
  const proratedAmount = Math.max(0, newAmount - refundAmount);
  
  return {
    amount: Math.round(proratedAmount * 100) / 100,
    refundAmount: Math.round(refundAmount * 100) / 100,
    newAmount: Math.round(newAmount * 100) / 100
  };
};

// ============================================
// Export Service
// ============================================

module.exports = {
  // Customer management
  getOrCreateCustomer,
  getCustomer,
  updateCustomer,
  
  // Payment method management
  attachPaymentMethod,
  detachPaymentMethod,
  getPaymentMethods,
  
  // Subscription management
  createSubscription,
  getSubscription,
  updateSubscription,
  cancelSubscription,
  resumeSubscription,
  changeSubscriptionPlan,
  
  // Payment intent management
  createPaymentIntent,
  confirmPaymentIntent,
  getPaymentIntent,
  
  // Refund management
  processRefund,
  getRefund,
  
  // Invoice management
  getInvoices,
  getInvoice,
  payInvoice,
  
  // Webhook handling
  handleWebhook,
  
  // Plan management
  getPlans,
  getPlanById,
  calculateProratedAmount,
  
  // Constants
  SUBSCRIPTION_PLANS,
  PAYMENT_STATUS,
  INVOICE_STATUS,
  
  // Utilities
  formatAmountForStripe,
  formatAmountFromStripe
};
