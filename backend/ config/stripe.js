// ============================================
// Stripe Configuration
// SpeakFlow - AI Language Learning Platform
// ============================================

const Stripe = require('stripe');
const { logger } = require('../middleware/logging');

// ============================================
// Constants & Configuration
// ============================================

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16', // Use latest stable version
  appInfo: {
    name: 'SpeakFlow',
    version: '1.0.0',
    url: 'https://speakflow.com'
  },
  maxNetworkRetries: 3,
  timeout: 30000,
  telemetry: true
});

// Stripe webhook secret
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Subscription plans configuration
const SUBSCRIPTION_PLANS = {
  // Pro Monthly Plan
  pro_monthly: {
    id: 'pro_monthly',
    name: 'Pro Monthly',
    amount: 1299, // $12.99 in cents
    currency: 'usd',
    interval: 'month',
    intervalCount: 1,
    trialPeriodDays: 7,
    description: 'Unlimited lessons, advanced AI features, priority support',
    metadata: {
      plan_type: 'pro',
      billing_period: 'monthly'
    }
  },
  
  // Pro Yearly Plan
  pro_yearly: {
    id: 'pro_yearly',
    name: 'Pro Yearly',
    amount: 9999, // $99.99 in cents
    currency: 'usd',
    interval: 'year',
    intervalCount: 1,
    trialPeriodDays: 7,
    description: 'All Pro features, save 36%',
    metadata: {
      plan_type: 'pro',
      billing_period: 'yearly',
      savings: '36'
    }
  },
  
  // Family Monthly Plan
  family_monthly: {
    id: 'family_monthly',
    name: 'Family Monthly',
    amount: 2499, // $24.99 in cents
    currency: 'usd',
    interval: 'month',
    intervalCount: 1,
    trialPeriodDays: 7,
    description: 'Up to 5 family members, all Pro features',
    metadata: {
      plan_type: 'family',
      billing_period: 'monthly',
      max_members: '5'
    }
  },
  
  // Family Yearly Plan
  family_yearly: {
    id: 'family_yearly',
    name: 'Family Yearly',
    amount: 19999, // $199.99 in cents
    currency: 'usd',
    interval: 'year',
    intervalCount: 1,
    trialPeriodDays: 7,
    description: 'All Family features, save 33%',
    metadata: {
      plan_type: 'family',
      billing_period: 'yearly',
      savings: '33',
      max_members: '5'
    }
  }
};

// Product configuration
const PRODUCT_CONFIG = {
  name: 'SpeakFlow Subscription',
  description: 'AI-powered language learning platform subscription',
  metadata: {
    platform: 'speakflow',
    category: 'education'
  }
};

// Payment method types
const PAYMENT_METHOD_TYPES = ['card', 'paypal', 'google_pay', 'apple_pay'];

// Webhook event types to handle
const WEBHOOK_EVENTS = [
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'charge.refunded',
  'charge.dispute.created',
  'customer.updated',
  'customer.deleted'
];

// ============================================
// Helper Functions
// ============================================

/**
 * Format amount for Stripe (cents to dollars)
 */
const formatAmountFromStripe = (amount) => {
  return amount / 100;
};

/**
 * Format amount for Stripe (dollars to cents)
 */
const formatAmountForStripe = (amount) => {
  return Math.round(amount * 100);
};

/**
 * Validate webhook signature
 */
const validateWebhookSignature = (payload, signature) => {
  if (!webhookSecret) {
    logger.warn('Stripe webhook secret not configured');
    return null;
  }
  
  try {
    return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    logger.error('Webhook signature validation failed:', error);
    return null;
  }
};

/**
 * Log Stripe API calls
 */
const logStripeCall = (method, params, result, error = null) => {
  const logData = {
    method,
    params: sanitizeParams(params),
    timestamp: new Date().toISOString()
  };
  
  if (error) {
    logData.error = {
      message: error.message,
      type: error.type,
      code: error.code
    };
    logger.error(`Stripe API call failed: ${method}`, logData);
  } else {
    logData.result = {
      id: result?.id,
      status: result?.status,
      object: result?.object
    };
    logger.info(`Stripe API call successful: ${method}`, logData);
  }
};

/**
 * Sanitize sensitive parameters for logging
 */
const sanitizeParams = (params) => {
  if (!params) return params;
  
  const sensitive = ['card', 'cvc', 'exp_month', 'exp_year', 'number'];
  const sanitized = { ...params };
  
  for (const key of sensitive) {
    if (sanitized[key]) {
      sanitized[key] = '[REDACTED]';
    }
  }
  
  return sanitized;
};

// ============================================
// Customer Management
// ============================================

/**
 * Create a new customer in Stripe
 * @param {Object} customerData - Customer information
 * @returns {Promise<Stripe.Customer>}
 */
const createCustomer = async (customerData) => {
  try {
    const { email, name, phone, metadata, paymentMethodId } = customerData;
    
    const params = {
      email,
      name,
      phone,
      metadata: {
        ...metadata,
        created_at: new Date().toISOString(),
        source: 'speakflow'
      }
    };
    
    if (paymentMethodId) {
      params.payment_method = paymentMethodId;
    }
    
    const customer = await stripe.customers.create(params);
    
    logStripeCall('customers.create', { email, name }, customer);
    
    return customer;
  } catch (error) {
    logStripeCall('customers.create', customerData, null, error);
    throw error;
  }
};

/**
 * Retrieve a customer by ID
 * @param {string} customerId - Stripe customer ID
 * @returns {Promise<Stripe.Customer>}
 */
const getCustomer = async (customerId) => {
  try {
    const customer = await stripe.customers.retrieve(customerId);
    logStripeCall('customers.retrieve', { customerId }, customer);
    return customer;
  } catch (error) {
    logStripeCall('customers.retrieve', { customerId }, null, error);
    throw error;
  }
};

/**
 * Update customer information
 * @param {string} customerId - Stripe customer ID
 * @param {Object} updates - Customer updates
 * @returns {Promise<Stripe.Customer>}
 */
const updateCustomer = async (customerId, updates) => {
  try {
    const customer = await stripe.customers.update(customerId, updates);
    logStripeCall('customers.update', { customerId, ...updates }, customer);
    return customer;
  } catch (error) {
    logStripeCall('customers.update', { customerId, ...updates }, null, error);
    throw error;
  }
};

/**
 * Delete a customer
 * @param {string} customerId - Stripe customer ID
 * @returns {Promise<Stripe.DeletedCustomer>}
 */
const deleteCustomer = async (customerId) => {
  try {
    const result = await stripe.customers.del(customerId);
    logStripeCall('customers.del', { customerId }, result);
    return result;
  } catch (error) {
    logStripeCall('customers.del', { customerId }, null, error);
    throw error;
  }
};

// ============================================
// Payment Method Management
// ============================================

/**
 * Attach payment method to customer
 * @param {string} customerId - Stripe customer ID
 * @param {string} paymentMethodId - Payment method ID
 * @returns {Promise<Stripe.PaymentMethod>}
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
    
    logStripeCall('paymentMethods.attach', { customerId, paymentMethodId }, paymentMethod);
    
    return paymentMethod;
  } catch (error) {
    logStripeCall('paymentMethods.attach', { customerId, paymentMethodId }, null, error);
    throw error;
  }
};

/**
 * Detach payment method from customer
 * @param {string} paymentMethodId - Payment method ID
 * @returns {Promise<Stripe.PaymentMethod>}
 */
const detachPaymentMethod = async (paymentMethodId) => {
  try {
    const paymentMethod = await stripe.paymentMethods.detach(paymentMethodId);
    logStripeCall('paymentMethods.detach', { paymentMethodId }, paymentMethod);
    return paymentMethod;
  } catch (error) {
    logStripeCall('paymentMethods.detach', { paymentMethodId }, null, error);
    throw error;
  }
};

/**
 * Get customer payment methods
 * @param {string} customerId - Stripe customer ID
 * @param {string} type - Payment method type
 * @returns {Promise<Array<Stripe.PaymentMethod>>}
 */
const getPaymentMethods = async (customerId, type = 'card') => {
  try {
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type
    });
    
    logStripeCall('paymentMethods.list', { customerId, type }, paymentMethods);
    
    return paymentMethods.data;
  } catch (error) {
    logStripeCall('paymentMethods.list', { customerId, type }, null, error);
    throw error;
  }
};

/**
 * Create a SetupIntent for saving payment method
 * @param {string} customerId - Stripe customer ID
 * @returns {Promise<Stripe.SetupIntent>}
 */
const createSetupIntent = async (customerId) => {
  try {
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: PAYMENT_METHOD_TYPES
    });
    
    logStripeCall('setupIntents.create', { customerId }, setupIntent);
    
    return setupIntent;
  } catch (error) {
    logStripeCall('setupIntents.create', { customerId }, null, error);
    throw error;
  }
};

// ============================================
// Subscription Management
// ============================================

/**
 * Create a subscription
 * @param {string} customerId - Stripe customer ID
 * @param {string} priceId - Stripe price ID
 * @param {Object} options - Additional options
 * @returns {Promise<Stripe.Subscription>}
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
    
    logStripeCall('subscriptions.create', { customerId, priceId, options }, subscription);
    
    return subscription;
  } catch (error) {
    logStripeCall('subscriptions.create', { customerId, priceId, options }, null, error);
    throw error;
  }
};

/**
 * Retrieve a subscription
 * @param {string} subscriptionId - Stripe subscription ID
 * @returns {Promise<Stripe.Subscription>}
 */
const getSubscription = async (subscriptionId) => {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    logStripeCall('subscriptions.retrieve', { subscriptionId }, subscription);
    return subscription;
  } catch (error) {
    logStripeCall('subscriptions.retrieve', { subscriptionId }, null, error);
    throw error;
  }
};

/**
 * Update a subscription
 * @param {string} subscriptionId - Stripe subscription ID
 * @param {Object} updates - Subscription updates
 * @returns {Promise<Stripe.Subscription>}
 */
const updateSubscription = async (subscriptionId, updates) => {
  try {
    const subscription = await stripe.subscriptions.update(subscriptionId, updates);
    logStripeCall('subscriptions.update', { subscriptionId, ...updates }, subscription);
    return subscription;
  } catch (error) {
    logStripeCall('subscriptions.update', { subscriptionId, ...updates }, null, error);
    throw error;
  }
};

/**
 * Cancel a subscription
 * @param {string} subscriptionId - Stripe subscription ID
 * @param {boolean} cancelAtPeriodEnd - Cancel at period end or immediately
 * @returns {Promise<Stripe.Subscription>}
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
    
    logStripeCall('subscriptions.cancel', { subscriptionId, cancelAtPeriodEnd }, subscription);
    
    return subscription;
  } catch (error) {
    logStripeCall('subscriptions.cancel', { subscriptionId, cancelAtPeriodEnd }, null, error);
    throw error;
  }
};

/**
 * Resume a subscription
 * @param {string} subscriptionId - Stripe subscription ID
 * @returns {Promise<Stripe.Subscription>}
 */
const resumeSubscription = async (subscriptionId) => {
  try {
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false
    });
    
    logStripeCall('subscriptions.resume', { subscriptionId }, subscription);
    
    return subscription;
  } catch (error) {
    logStripeCall('subscriptions.resume', { subscriptionId }, null, error);
    throw error;
  }
};

// ============================================
// Payment Intent Management
// ============================================

/**
 * Create a payment intent for one-time payment
 * @param {Object} params - Payment intent parameters
 * @returns {Promise<Stripe.PaymentIntent>}
 */
const createPaymentIntent = async (params) => {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: params.amount,
      currency: params.currency || 'usd',
      customer: params.customerId,
      description: params.description,
      metadata: params.metadata,
      payment_method_types: PAYMENT_METHOD_TYPES,
      receipt_email: params.receiptEmail,
      statement_descriptor: params.statementDescriptor?.slice(0, 22),
      confirm: params.confirm || false
    });
    
    logStripeCall('paymentIntents.create', params, paymentIntent);
    
    return paymentIntent;
  } catch (error) {
    logStripeCall('paymentIntents.create', params, null, error);
    throw error;
  }
};

/**
 * Confirm a payment intent
 * @param {string} paymentIntentId - Payment intent ID
 * @param {string} paymentMethodId - Payment method ID
 * @returns {Promise<Stripe.PaymentIntent>}
 */
const confirmPaymentIntent = async (paymentIntentId, paymentMethodId) => {
  try {
    const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId, {
      payment_method: paymentMethodId
    });
    
    logStripeCall('paymentIntents.confirm', { paymentIntentId, paymentMethodId }, paymentIntent);
    
    return paymentIntent;
  } catch (error) {
    logStripeCall('paymentIntents.confirm', { paymentIntentId, paymentMethodId }, null, error);
    throw error;
  }
};

/**
 * Retrieve a payment intent
 * @param {string} paymentIntentId - Payment intent ID
 * @returns {Promise<Stripe.PaymentIntent>}
 */
const getPaymentIntent = async (paymentIntentId) => {
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    logStripeCall('paymentIntents.retrieve', { paymentIntentId }, paymentIntent);
    return paymentIntent;
  } catch (error) {
    logStripeCall('paymentIntents.retrieve', { paymentIntentId }, null, error);
    throw error;
  }
};

// ============================================
// Invoice Management
// ============================================

/**
 * Get customer invoices
 * @param {string} customerId - Stripe customer ID
 * @param {Object} options - Query options
 * @returns {Promise<Array<Stripe.Invoice>>}
 */
const getInvoices = async (customerId, options = {}) => {
  try {
    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit: options.limit || 10,
      status: options.status
    });
    
    logStripeCall('invoices.list', { customerId, options }, invoices);
    
    return invoices.data;
  } catch (error) {
    logStripeCall('invoices.list', { customerId, options }, null, error);
    throw error;
  }
};

/**
 * Get upcoming invoice
 * @param {string} customerId - Stripe customer ID
 * @param {string} subscriptionId - Subscription ID
 * @returns {Promise<Stripe.Invoice>}
 */
const getUpcomingInvoice = async (customerId, subscriptionId) => {
  try {
    const invoice = await stripe.invoices.retrieveUpcoming({
      customer: customerId,
      subscription: subscriptionId
    });
    
    logStripeCall('invoices.retrieveUpcoming', { customerId, subscriptionId }, invoice);
    
    return invoice;
  } catch (error) {
    logStripeCall('invoices.retrieveUpcoming', { customerId, subscriptionId }, null, error);
    throw error;
  }
};

/**
 * Pay an invoice
 * @param {string} invoiceId - Invoice ID
 * @returns {Promise<Stripe.Invoice>}
 */
const payInvoice = async (invoiceId) => {
  try {
    const invoice = await stripe.invoices.pay(invoiceId);
    logStripeCall('invoices.pay', { invoiceId }, invoice);
    return invoice;
  } catch (error) {
    logStripeCall('invoices.pay', { invoiceId }, null, error);
    throw error;
  }
};

// ============================================
// Refund Management
// ============================================

/**
 * Create a refund
 * @param {string} paymentIntentId - Payment intent ID
 * @param {Object} options - Refund options
 * @returns {Promise<Stripe.Refund>}
 */
const createRefund = async (paymentIntentId, options = {}) => {
  try {
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: options.amount ? formatAmountForStripe(options.amount) : undefined,
      reason: options.reason || 'requested_by_customer',
      metadata: options.metadata
    });
    
    logStripeCall('refunds.create', { paymentIntentId, options }, refund);
    
    return refund;
  } catch (error) {
    logStripeCall('refunds.create', { paymentIntentId, options }, null, error);
    throw error;
  }
};

// ============================================
// Price & Product Management
// ============================================

/**
 * Create or get price ID for a plan
 * @param {string} planId - Plan identifier
 * @returns {Promise<string>} Stripe price ID
 */
const getOrCreatePriceId = async (planId) => {
  const plan = SUBSCRIPTION_PLANS[planId];
  
  if (!plan) {
    throw new Error(`Unknown plan: ${planId}`);
  }
  
  // Check if price already exists in environment
  const envKey = `STRIPE_PRICE_${planId.toUpperCase()}`;
  if (process.env[envKey]) {
    return process.env[envKey];
  }
  
  // Create new price
  try {
    const price = await stripe.prices.create({
      unit_amount: plan.amount,
      currency: plan.currency,
      recurring: {
        interval: plan.interval,
        interval_count: plan.intervalCount
      },
      product_data: {
        name: plan.name,
        description: plan.description,
        metadata: plan.metadata
      },
      metadata: {
        plan_id: plan.id,
        ...plan.metadata
      }
    });
    
    logStripeCall('prices.create', { planId }, price);
    
    return price.id;
  } catch (error) {
    logStripeCall('prices.create', { planId }, null, error);
    throw error;
  }
};

// ============================================
// Webhook Handling
// ============================================

/**
 * Handle Stripe webhook events
 * @param {Object} event - Stripe event object
 * @returns {Promise<void>}
 */
const handleWebhookEvent = async (event) => {
  logger.info(`Processing webhook event: ${event.type}`, { eventId: event.id });
  
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
};

/**
 * Handle subscription created
 */
const handleSubscriptionCreated = async (subscription) => {
  logger.info('Subscription created', {
    subscriptionId: subscription.id,
    customerId: subscription.customer,
    status: subscription.status,
    planId: subscription.items.data[0]?.price?.metadata?.plan_id
  });
  // Update database with subscription information
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
  // Update database subscription status
};

/**
 * Handle subscription deleted
 */
const handleSubscriptionDeleted = async (subscription) => {
  logger.info('Subscription deleted', {
    subscriptionId: subscription.id,
    customerId: subscription.customer
  });
  // Downgrade user to free plan
};

/**
 * Handle invoice payment succeeded
 */
const handleInvoicePaymentSucceeded = async (invoice) => {
  logger.info('Invoice payment succeeded', {
    invoiceId: invoice.id,
    customerId: invoice.customer,
    amount: formatAmountFromStripe(invoice.amount_paid)
  });
  // Update payment records, send receipt
};

/**
 * Handle invoice payment failed
 */
const handleInvoicePaymentFailed = async (invoice) => {
  logger.info('Invoice payment failed', {
    invoiceId: invoice.id,
    customerId: invoice.customer,
    amount: formatAmountFromStripe(invoice.amount_due)
  });
  // Send payment failed notification
};

/**
 * Handle payment intent succeeded
 */
const handlePaymentIntentSucceeded = async (paymentIntent) => {
  logger.info('Payment intent succeeded', {
    paymentIntentId: paymentIntent.id,
    amount: formatAmountFromStripe(paymentIntent.amount)
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
    amount: formatAmountFromStripe(charge.amount_refunded)
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
// Export Configuration
// ============================================

module.exports = {
  // Stripe instance
  stripe,
  webhookSecret,
  
  // Configuration
  SUBSCRIPTION_PLANS,
  PAYMENT_METHOD_TYPES,
  WEBHOOK_EVENTS,
  
  // Customer management
  createCustomer,
  getCustomer,
  updateCustomer,
  deleteCustomer,
  
  // Payment method management
  attachPaymentMethod,
  detachPaymentMethod,
  getPaymentMethods,
  createSetupIntent,
  
  // Subscription management
  createSubscription,
  getSubscription,
  updateSubscription,
  cancelSubscription,
  resumeSubscription,
  
  // Payment intent management
  createPaymentIntent,
  confirmPaymentIntent,
  getPaymentIntent,
  
  // Invoice management
  getInvoices,
  getUpcomingInvoice,
  payInvoice,
  
  // Refund management
  createRefund,
  
  // Price & Product
  getOrCreatePriceId,
  
  // Webhook handling
  handleWebhookEvent,
  validateWebhookSignature,
  
  // Utilities
  formatAmountFromStripe,
  formatAmountForStripe
};
