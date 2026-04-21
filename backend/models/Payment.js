// ============================================
// Payment Model
// SpeakFlow - AI Language Learning Platform
// ============================================

const mongoose = require('mongoose');

// ============================================
// Constants & Enums
// ============================================

const PAYMENT_STATUSES = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  REFUNDED: 'refunded',
  PARTIALLY_REFUNDED: 'partially_refunded',
  DISPUTED: 'disputed',
  CANCELLED: 'cancelled'
};

const PAYMENT_METHODS = {
  CREDIT_CARD: 'credit_card',
  DEBIT_CARD: 'debit_card',
  PAYPAL: 'paypal',
  STRIPE: 'stripe',
  GOOGLE_PAY: 'google_pay',
  APPLE_PAY: 'apple_pay',
  BANK_TRANSFER: 'bank_transfer',
  CRYPTO: 'crypto'
};

const PAYMENT_CURRENCIES = {
  USD: 'usd',
  EUR: 'eur',
  GBP: 'gbp',
  IDR: 'idr',
  JPY: 'jpy',
  CAD: 'cad',
  AUD: 'aud',
  SGD: 'sgd'
};

const PAYMENT_TYPES = {
  SUBSCRIPTION: 'subscription',
  ONE_TIME: 'one_time',
  RENEWAL: 'renewal',
  UPGRADE: 'upgrade',
  DOWNGRADE: 'downgrade',
  REFUND: 'refund'
};

const SUBSCRIPTION_INTERVALS = {
  MONTHLY: 'month',
  YEARLY: 'year',
  QUARTERLY: 'quarter',
  WEEKLY: 'week',
  ONE_TIME: 'one_time'
};

const SUBSCRIPTION_STATUSES = {
  ACTIVE: 'active',
  PAST_DUE: 'past_due',
  CANCELLED: 'cancelled',
  INCOMPLETE: 'incomplete',
  INCOMPLETE_EXPIRED: 'incomplete_expired',
  TRIALING: 'trialing',
  PAUSED: 'paused'
};

// ============================================
// Sub-Schemas
// ============================================

/**
 * Card Details Schema
 */
const cardDetailsSchema = new mongoose.Schema({
  brand: {
    type: String,
    enum: ['visa', 'mastercard', 'amex', 'discover', 'jcb', 'diners', 'unionpay']
  },
  last4: {
    type: String,
    match: /^[0-9]{4}$/
  },
  expMonth: {
    type: Number,
    min: 1,
    max: 12
  },
  expYear: {
    type: Number,
    min: new Date().getFullYear()
  },
  country: {
    type: String,
    length: 2
  },
  funding: {
    type: String,
    enum: ['credit', 'debit', 'prepaid', 'unknown']
  },
  fingerprint: String
}, { _id: false });

/**
 * Billing Address Schema
 */
const billingAddressSchema = new mongoose.Schema({
  line1: String,
  line2: String,
  city: String,
  state: String,
  postalCode: String,
  country: {
    type: String,
    length: 2,
    uppercase: true
  }
}, { _id: false });

/**
 * Tax Details Schema
 */
const taxDetailsSchema = new mongoose.Schema({
  amount: {
    type: Number,
    min: 0
  },
  rate: {
    type: Number,
    min: 0,
    max: 100
  },
  type: {
    type: String,
    enum: ['vat', 'gst', 'sales_tax', 'none']
  },
  country: String,
  taxId: String,
  taxIdType: String
}, { _id: false });

/**
 * Refund Details Schema
 */
const refundDetailsSchema = new mongoose.Schema({
  refundId: {
    type: String,
    unique: true,
    sparse: true
  },
  amount: {
    type: Number,
    min: 0
  },
  reason: {
    type: String,
    enum: ['duplicate', 'fraudulent', 'requested_by_customer', 'expired_uncaptured_charge']
  },
  status: {
    type: String,
    enum: ['pending', 'succeeded', 'failed']
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  processedAt: Date,
  notes: String
}, { _id: false });

/**
 * Dispute Details Schema
 */
const disputeDetailsSchema = new mongoose.Schema({
  disputeId: String,
  reason: String,
  status: {
    type: String,
    enum: ['needs_response', 'under_review', 'won', 'lost', 'warning_closed']
  },
  amount: Number,
  evidenceDetails: {
    dueBy: Date,
    hasEvidence: Boolean
  },
  createdAt: Date,
  resolvedAt: Date
}, { _id: false });

/**
 * Invoice Line Item Schema
 */
const invoiceLineItemSchema = new mongoose.Schema({
  description: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  quantity: {
    type: Number,
    default: 1,
    min: 1
  },
  unitPrice: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    enum: ['subscription', 'one_time', 'tax', 'discount', 'fee']
  },
  periodStart: Date,
  periodEnd: Date,
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  }
}, { _id: false });

// ============================================
// Main Payment Schema
// ============================================

const paymentSchema = new mongoose.Schema({
  // Identification
  paymentId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  orderId: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  invoiceId: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  
  // Relations
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  subscriptionId: {
    type: String,
    index: true
  },
  
  // Payment Details
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    enum: Object.values(PAYMENT_CURRENCIES),
    default: PAYMENT_CURRENCIES.USD,
    uppercase: true
  },
  type: {
    type: String,
    enum: Object.values(PAYMENT_TYPES),
    required: true
  },
  status: {
    type: String,
    enum: Object.values(PAYMENT_STATUSES),
    default: PAYMENT_STATUSES.PENDING,
    index: true
  },
  
  // Payment Method
  paymentMethod: {
    type: String,
    enum: Object.values(PAYMENT_METHODS),
    required: true
  },
  paymentMethodId: {
    type: String,
    index: true
  },
  cardDetails: cardDetailsSchema,
  
  // Billing Information
  billingAddress: billingAddressSchema,
  taxDetails: taxDetailsSchema,
  
  // Subscription Details (if applicable)
  subscriptionPlanId: {
    type: String
  },
  subscriptionPlanName: String,
  subscriptionInterval: {
    type: String,
    enum: Object.values(SUBSCRIPTION_INTERVALS)
  },
  subscriptionStartDate: Date,
  subscriptionEndDate: Date,
  
  // Gateway Information
  gateway: {
    type: String,
    enum: ['stripe', 'paypal', 'braintree', 'manual'],
    default: 'stripe'
  },
  gatewayTransactionId: {
    type: String,
    index: true
  },
  gatewayPaymentIntentId: String,
  gatewayCustomerId: String,
  gatewaySetupIntentId: String,
  
  // Invoice Details
  invoiceNumber: {
    type: String,
    unique: true,
    sparse: true
  },
  invoiceUrl: String,
  receiptUrl: String,
  invoicePdf: String,
  lineItems: [invoiceLineItemSchema],
  
  // Discounts & Coupons
  couponCode: String,
  discountAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  discountPercentage: {
    type: Number,
    min: 0,
    max: 100
  },
  
  // Refunds
  refunds: [refundDetailsSchema],
  totalRefundedAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Disputes
  dispute: disputeDetailsSchema,
  
  // Payment Timeline
  paymentInitiatedAt: {
    type: Date,
    default: Date.now
  },
  paymentProcessedAt: Date,
  paymentSucceededAt: Date,
  paymentFailedAt: Date,
  paymentFailedReason: String,
  
  // Webhook Data
  webhookReceivedAt: Date,
  webhookEventType: String,
  webhookData: {
    type: mongoose.Schema.Types.Mixed
  },
  
  // Metadata
  description: String,
  customerNote: String,
  internalNote: String,
  
  // Additional Data
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: new Map()
  },
  
  // IP & Location
  ipAddress: String,
  userAgent: String,
  countryCode: String
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ============================================
// Virtual Fields
// ============================================

// Net amount (amount after refunds)
paymentSchema.virtual('netAmount').get(function() {
  return this.amount - this.totalRefundedAmount;
});

// Is fully refunded
paymentSchema.virtual('isFullyRefunded').get(function() {
  return this.totalRefundedAmount >= this.amount;
});

// Is partially refunded
paymentSchema.virtual('isPartiallyRefunded').get(function() {
  return this.totalRefundedAmount > 0 && this.totalRefundedAmount < this.amount;
});

// Formatted amount
paymentSchema.virtual('formattedAmount').get(function() {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: this.currency.toUpperCase()
  }).format(this.amount);
});

// Age of payment in days
paymentSchema.virtual('ageDays').get(function() {
  return Math.floor((Date.now() - this.paymentInitiatedAt) / (1000 * 60 * 60 * 24));
});

// ============================================
// Instance Methods
// ============================================

/**
 * Mark payment as processing
 */
paymentSchema.methods.markProcessing = function() {
  this.status = PAYMENT_STATUSES.PROCESSING;
  this.paymentProcessedAt = new Date();
  return this.save();
};

/**
 * Mark payment as succeeded
 */
paymentSchema.methods.markSucceeded = function(gatewayTransactionId = null) {
  this.status = PAYMENT_STATUSES.SUCCEEDED;
  this.paymentSucceededAt = new Date();
  if (gatewayTransactionId) {
    this.gatewayTransactionId = gatewayTransactionId;
  }
  return this.save();
};

/**
 * Mark payment as failed
 */
paymentSchema.methods.markFailed = function(reason) {
  this.status = PAYMENT_STATUSES.FAILED;
  this.paymentFailedAt = new Date();
  this.paymentFailedReason = reason;
  return this.save();
};

/**
 * Process refund
 */
paymentSchema.methods.processRefund = async function(amount, reason, metadata = {}) {
  if (this.status !== PAYMENT_STATUSES.SUCCEEDED) {
    throw new Error('Cannot refund a payment that is not succeeded');
  }
  
  const refundAmount = amount || this.netAmount;
  
  if (refundAmount > this.netAmount) {
    throw new Error('Refund amount exceeds available amount');
  }
  
  const refund = {
    refundId: `ref_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    amount: refundAmount,
    reason: reason || 'requested_by_customer',
    status: 'pending',
    createdAt: new Date(),
    ...metadata
  };
  
  this.refunds.push(refund);
  this.totalRefundedAmount += refundAmount;
  
  // Update payment status
  if (this.totalRefundedAmount >= this.amount) {
    this.status = PAYMENT_STATUSES.REFUNDED;
  } else if (this.totalRefundedAmount > 0) {
    this.status = PAYMENT_STATUSES.PARTIALLY_REFUNDED;
  }
  
  await this.save();
  return refund;
};

/**
 * Complete refund
 */
paymentSchema.methods.completeRefund = function(refundId, processedAt = new Date()) {
  const refund = this.refunds.find(r => r.refundId === refundId);
  if (!refund) {
    throw new Error('Refund not found');
  }
  
  refund.status = 'succeeded';
  refund.processedAt = processedAt;
  
  return this.save();
};

/**
 * Add dispute
 */
paymentSchema.methods.addDispute = function(disputeData) {
  this.dispute = {
    disputeId: disputeData.disputeId,
    reason: disputeData.reason,
    status: disputeData.status || 'needs_response',
    amount: disputeData.amount,
    evidenceDetails: disputeData.evidenceDetails,
    createdAt: new Date()
  };
  this.status = PAYMENT_STATUSES.DISPUTED;
  return this.save();
};

/**
 * Update dispute status
 */
paymentSchema.methods.updateDisputeStatus = function(status, resolvedAt = null) {
  if (!this.dispute) {
    throw new Error('No dispute found for this payment');
  }
  
  this.dispute.status = status;
  if (resolvedAt || status === 'won' || status === 'lost') {
    this.dispute.resolvedAt = resolvedAt || new Date();
    
    // If dispute is lost, mark payment as failed
    if (status === 'lost') {
      this.status = PAYMENT_STATUSES.FAILED;
    }
  }
  
  return this.save();
};

/**
 * Generate invoice number
 */
paymentSchema.methods.generateInvoiceNumber = function() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const sequence = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  this.invoiceNumber = `INV-${year}${month}-${sequence}`;
  return this.invoiceNumber;
};

/**
 * Generate receipt
 */
paymentSchema.methods.generateReceipt = async function() {
  // In production, generate PDF receipt
  this.receiptUrl = `https://speakflow.com/receipts/${this.paymentId}`;
  return this.receiptUrl;
};

/**
 * Get payment summary
 */
paymentSchema.methods.getSummary = function() {
  return {
    paymentId: this.paymentId,
    amount: this.amount,
    formattedAmount: this.formattedAmount,
    currency: this.currency,
    status: this.status,
    type: this.type,
    paymentMethod: this.paymentMethod,
    createdAt: this.createdAt,
    netAmount: this.netAmount,
    totalRefundedAmount: this.totalRefundedAmount,
    isFullyRefunded: this.isFullyRefunded
  };
};

// ============================================
// Static Methods
// ============================================

/**
 * Find payments by user
 */
paymentSchema.statics.findByUser = function(userId, options = {}) {
  const { limit = 50, offset = 0, status, type } = options;
  
  let query = this.find({ userId });
  
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
 * Get user payment statistics
 */
paymentSchema.statics.getUserStats = async function(userId) {
  const stats = await this.aggregate([
    { $match: { userId: mongoose.Types.ObjectId(userId), status: PAYMENT_STATUSES.SUCCEEDED } },
    {
      $group: {
        _id: null,
        totalSpent: { $sum: '$amount' },
        totalRefunded: { $sum: '$totalRefundedAmount' },
        totalPayments: { $sum: 1 },
        averagePaymentAmount: { $avg: '$amount' },
        lastPaymentDate: { $max: '$paymentSucceededAt' },
        firstPaymentDate: { $min: '$paymentInitiatedAt' },
        byType: {
          $push: {
            type: '$type',
            amount: '$amount'
          }
        },
        byMethod: {
          $push: {
            method: '$paymentMethod',
            amount: '$amount'
          }
        }
      }
    }
  ]);
  
  const result = stats[0] || {
    totalSpent: 0,
    totalRefunded: 0,
    totalPayments: 0,
    averagePaymentAmount: 0
  };
  
  // Group by type
  if (result.byType) {
    result.byType = result.byType.reduce((acc, curr) => {
      if (!acc[curr.type]) {
        acc[curr.type] = { count: 0, total: 0 };
      }
      acc[curr.type].count++;
      acc[curr.type].total += curr.amount;
      return acc;
    }, {});
    delete result.byType;
  }
  
  // Group by method
  if (result.byMethod) {
    result.byMethod = result.byMethod.reduce((acc, curr) => {
      if (!acc[curr.method]) {
        acc[curr.method] = { count: 0, total: 0 };
      }
      acc[curr.method].count++;
      acc[curr.method].total += curr.amount;
      return acc;
    }, {});
    delete result.byMethod;
  }
  
  result.netSpent = result.totalSpent - result.totalRefunded;
  
  return result;
};

/**
 * Get revenue by date range
 */
paymentSchema.statics.getRevenueByDateRange = async function(startDate, endDate) {
  const revenue = await this.aggregate([
    {
      $match: {
        status: PAYMENT_STATUSES.SUCCEEDED,
        paymentSucceededAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$paymentSucceededAt' } },
          currency: '$currency'
        },
        total: { $sum: '$amount' },
        count: { $sum: 1 },
        average: { $avg: '$amount' }
      }
    },
    { $sort: { '_id.date': 1 } }
  ]);
  
  return revenue;
};

/**
 * Get revenue by subscription plan
 */
paymentSchema.statics.getRevenueByPlan = async function(startDate, endDate) {
  const revenue = await this.aggregate([
    {
      $match: {
        status: PAYMENT_STATUSES.SUCCEEDED,
        paymentSucceededAt: { $gte: startDate, $lte: endDate },
        subscriptionPlanId: { $exists: true, $ne: null }
      }
    },
    {
      $group: {
        _id: '$subscriptionPlanId',
        planName: { $first: '$subscriptionPlanName' },
        total: { $sum: '$amount' },
        count: { $sum: 1 },
        subscribers: { $addToSet: '$userId' }
      }
    },
    {
      $project: {
        planId: '$_id',
        planName: 1,
        total: 1,
        count: 1,
        uniqueSubscribers: { $size: '$subscribers' }
      }
    },
    { $sort: { total: -1 } }
  ]);
  
  return revenue;
};

/**
 * Get failed payments
 */
paymentSchema.statics.getFailedPayments = async function(days = 7) {
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - days);
  
  return await this.find({
    status: PAYMENT_STATUSES.FAILED,
    paymentFailedAt: { $gte: sinceDate }
  })
    .populate('userId', 'name email')
    .sort({ paymentFailedAt: -1 });
};

/**
 * Get pending refunds
 */
paymentSchema.statics.getPendingRefunds = async function() {
  return await this.find({
    'refunds.status': 'pending',
    status: { $in: [PAYMENT_STATUSES.SUCCEEDED, PAYMENT_STATUSES.PARTIALLY_REFUNDED] }
  });
};

/**
 * Get monthly recurring revenue (MRR)
 */
paymentSchema.statics.getMRR = async function() {
  const result = await this.aggregate([
    {
      $match: {
        status: PAYMENT_STATUSES.SUCCEEDED,
        type: { $in: [PAYMENT_TYPES.SUBSCRIPTION, PAYMENT_TYPES.RENEWAL] },
        subscriptionInterval: SUBSCRIPTION_INTERVALS.MONTHLY
      }
    },
    {
      $group: {
        _id: null,
        mrr: { $sum: '$amount' }
      }
    }
  ]);
  
  return result[0]?.mrr || 0;
};

/**
 * Get churn rate
 */
paymentSchema.statics.getChurnRate = async function(periodDays = 30) {
  const periodAgo = new Date();
  periodAgo.setDate(periodAgo.getDate() - periodDays);
  
  // Get active subscribers at start of period
  const startActive = await this.distinct('userId', {
    status: PAYMENT_STATUSES.SUCCEEDED,
    type: { $in: [PAYMENT_TYPES.SUBSCRIPTION, PAYMENT_TYPES.RENEWAL] },
    paymentSucceededAt: { $lt: periodAgo }
  });
  
  // Get subscribers who cancelled during period
  const cancelled = await this.distinct('userId', {
    status: PAYMENT_STATUSES.CANCELLED,
    type: PAYMENT_TYPES.CANCELLATION,
    createdAt: { $gte: periodAgo }
  });
  
  const churnCount = cancelled.filter(id => startActive.includes(id)).length;
  const churnRate = startActive.length > 0 ? (churnCount / startActive.length) * 100 : 0;
  
  return {
    churnRate: Math.round(churnRate * 100) / 100,
    churnedCustomers: churnCount,
    totalCustomers: startActive.length,
    periodDays
  };
};

// ============================================
// Indexes
// ============================================

paymentSchema.index({ paymentId: 1 });
paymentSchema.index({ orderId: 1 });
paymentSchema.index({ invoiceId: 1 });
paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ userId: 1, status: 1 });
paymentSchema.index({ gatewayTransactionId: 1 });
paymentSchema.index({ status: 1, paymentInitiatedAt: -1 });
paymentSchema.index({ subscriptionId: 1 });
paymentSchema.index({ paymentSucceededAt: -1 });
paymentSchema.index({ 'refunds.refundId': 1 });
paymentSchema.index({ invoiceNumber: 1 });

// Compound indexes for common queries
paymentSchema.index({ userId: 1, status: 1, createdAt: -1 });
paymentSchema.index({ status: 1, paymentSucceededAt: -1 });
paymentSchema.index({ subscriptionPlanId: 1, paymentSucceededAt: -1 });

// ============================================
// Pre-save Middleware
// ============================================

// Generate payment ID if not exists
paymentSchema.pre('save', function(next) {
  if (!this.paymentId) {
    this.paymentId = `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  if (!this.orderId) {
    this.orderId = `ord_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  next();
});

// Generate invoice number if payment succeeded and no invoice number
paymentSchema.pre('save', function(next) {
  if (this.status === PAYMENT_STATUSES.SUCCEEDED && !this.invoiceNumber) {
    this.generateInvoiceNumber();
  }
  next();
});

// Update timestamps
paymentSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// ============================================
// Model Creation
// ============================================

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;
