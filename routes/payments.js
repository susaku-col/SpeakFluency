/* ============================================
   SPEAKFLOW - PAYMENTS MODULE
   Version: 1.0.0
   Handles payment processing, subscriptions, invoices, and webhooks
   ============================================ */

const { validationResult } = require('express-validator');
const { body, param, query } = require('express-validator');
const crypto = require('crypto');

// ============================================
// CONFIGURATION
// ============================================

const PaymentsConfig = {
    // Stripe Configuration
    stripe: {
        apiVersion: '2023-10-16',
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
        priceIds: {
            monthly: process.env.STRIPE_PRICE_MONTHLY || 'price_monthly',
            yearly: process.env.STRIPE_PRICE_YEARLY || 'price_yearly',
            lifetime: process.env.STRIPE_PRICE_LIFETIME || 'price_lifetime'
        }
    },
    
    // Plans
    plans: {
        free: {
            id: 'free',
            name: 'Free',
            price: 0,
            currency: 'USD',
            interval: null,
            features: [
                '10 practice sentences/day',
                'Basic AI feedback',
                'Daily streak & XP',
                'Basic achievements'
            ]
        },
        monthly: {
            id: 'monthly',
            name: 'Premium Monthly',
            price: 9.99,
            currency: 'USD',
            interval: 'month',
            intervalCount: 1,
            features: [
                'Unlimited practice sessions',
                'Advanced pronunciation feedback',
                'All tutor personalities',
                'Priority AI response',
                'Custom daily challenges',
                'Download practice sessions'
            ]
        },
        yearly: {
            id: 'yearly',
            name: 'Premium Yearly',
            price: 79.99,
            currency: 'USD',
            interval: 'year',
            intervalCount: 1,
            features: [
                'All Monthly features',
                'Save 33% compared to monthly',
                '1 month free',
                'Early access to new features',
                'Premium support'
            ]
        },
        lifetime: {
            id: 'lifetime',
            name: 'Lifetime Premium',
            price: 299.99,
            currency: 'USD',
            interval: 'lifetime',
            intervalCount: null,
            features: [
                'All Premium features forever',
                'Lifetime updates',
                'Priority support',
                'Exclusive content access'
            ]
        }
    },
    
    // Discount Codes
    discounts: {
        'WELCOME20': { type: 'percentage', value: 20, validFor: ['monthly', 'yearly'], maxUses: 1000, usedCount: 0 },
        'ANNUAL30': { type: 'percentage', value: 30, validFor: ['yearly'], maxUses: 500, usedCount: 0 },
        'STUDENT50': { type: 'percentage', value: 50, validFor: ['monthly', 'yearly'], requiresVerification: true, maxUses: 1000, usedCount: 0 },
        'FLASH20': { type: 'percentage', value: 20, validFor: ['monthly', 'yearly', 'lifetime'], expiresAt: '2024-12-31', maxUses: 5000, usedCount: 0 }
    },
    
    // Tax Rates
    taxRates: {
        'US': { rate: 0, name: 'No Tax' },
        'GB': { rate: 20, name: 'VAT' },
        'EU': { rate: 20, name: 'VAT' },
        'AU': { rate: 10, name: 'GST' },
        'CA': { rate: 5, name: 'GST' }
    },
    
    // Currency Settings
    currency: {
        code: 'USD',
        symbol: '$',
        decimalPlaces: 2
    },
    
    // Invoice Settings
    invoice: {
        prefix: 'INV',
        dueDays: 0,
        notes: 'Thank you for choosing SpeakFlow!'
    },
    
    // Pagination
    pagination: {
        defaultLimit: 20,
        maxLimit: 100
    }
};

// ============================================
// DATABASE MODELS (Simulated)
// ============================================

class PaymentModel {
    constructor() {
        this.payments = [];
        this.subscriptions = [];
        this.invoices = [];
        this.discountUsages = [];
    }
    
    async createPayment(paymentData) {
        const payment = {
            id: this.payments.length + 1,
            paymentId: this.generatePaymentId(),
            userId: paymentData.userId,
            planId: paymentData.planId,
            amount: paymentData.amount,
            currency: paymentData.currency || PaymentsConfig.currency.code,
            status: paymentData.status || 'pending',
            paymentMethod: paymentData.paymentMethod,
            transactionId: paymentData.transactionId,
            discountCode: paymentData.discountCode,
            discountAmount: paymentData.discountAmount || 0,
            taxAmount: paymentData.taxAmount || 0,
            metadata: paymentData.metadata || {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        this.payments.push(payment);
        return payment;
    }
    
    generatePaymentId() {
        return `pay_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    }
    
    async createSubscription(subscriptionData) {
        const subscription = {
            id: this.subscriptions.length + 1,
            subscriptionId: this.generateSubscriptionId(),
            userId: subscriptionData.userId,
            planId: subscriptionData.planId,
            status: subscriptionData.status || 'active',
            currentPeriodStart: subscriptionData.currentPeriodStart,
            currentPeriodEnd: subscriptionData.currentPeriodEnd,
            cancelAtPeriodEnd: subscriptionData.cancelAtPeriodEnd || false,
            cancelledAt: subscriptionData.cancelledAt || null,
            paymentMethodId: subscriptionData.paymentMethodId,
            metadata: subscriptionData.metadata || {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        this.subscriptions.push(subscription);
        return subscription;
    }
    
    generateSubscriptionId() {
        return `sub_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    }
    
    async createInvoice(invoiceData) {
        const invoice = {
            id: this.invoices.length + 1,
            invoiceNumber: this.generateInvoiceNumber(),
            userId: invoiceData.userId,
            paymentId: invoiceData.paymentId,
            subscriptionId: invoiceData.subscriptionId,
            amount: invoiceData.amount,
            currency: invoiceData.currency || PaymentsConfig.currency.code,
            status: invoiceData.status || 'pending',
            dueDate: invoiceData.dueDate || new Date().toISOString(),
            paidAt: invoiceData.paidAt || null,
            items: invoiceData.items || [],
            notes: invoiceData.notes || PaymentsConfig.invoice.notes,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        this.invoices.push(invoice);
        return invoice;
    }
    
    generateInvoiceNumber() {
        const year = new Date().getFullYear();
        const month = String(new Date().getMonth() + 1).padStart(2, '0');
        const sequence = String(this.invoices.length + 1).padStart(6, '0');
        return `${PaymentsConfig.invoice.prefix}-${year}${month}-${sequence}`;
    }
    
    async findPaymentById(id) {
        return this.payments.find(p => p.id === parseInt(id));
    }
    
    async findPaymentByTransactionId(transactionId) {
        return this.payments.find(p => p.transactionId === transactionId);
    }
    
    async findPaymentsByUserId(userId, options = {}) {
        let results = this.payments.filter(p => p.userId === parseInt(userId));
        
        // Apply filters
        if (options.status) {
            results = results.filter(p => p.status === options.status);
        }
        if (options.startDate) {
            results = results.filter(p => new Date(p.createdAt) >= new Date(options.startDate));
        }
        if (options.endDate) {
            results = results.filter(p => new Date(p.createdAt) <= new Date(options.endDate));
        }
        
        // Apply sorting
        const sortBy = options.sortBy || 'createdAt';
        const sortOrder = options.sortOrder === 'asc' ? 1 : -1;
        results.sort((a, b) => {
            if (a[sortBy] < b[sortBy]) return -sortOrder;
            if (a[sortBy] > b[sortBy]) return sortOrder;
            return 0;
        });
        
        // Apply pagination
        const page = options.page || 1;
        const limit = Math.min(options.limit || PaymentsConfig.pagination.defaultLimit, PaymentsConfig.pagination.maxLimit);
        const start = (page - 1) * limit;
        const end = start + limit;
        
        return {
            payments: results.slice(start, end),
            total: results.length,
            page,
            limit,
            totalPages: Math.ceil(results.length / limit)
        };
    }
    
    async findSubscriptionByUserId(userId) {
        return this.subscriptions.find(s => s.userId === parseInt(userId) && s.status === 'active');
    }
    
    async findSubscriptionById(id) {
        return this.subscriptions.find(s => s.id === parseInt(id));
    }
    
    async updateSubscription(id, updates) {
        const index = this.subscriptions.findIndex(s => s.id === parseInt(id));
        if (index === -1) return null;
        
        const allowedUpdates = ['status', 'currentPeriodEnd', 'cancelAtPeriodEnd', 'cancelledAt', 'paymentMethodId'];
        const filteredUpdates = {};
        
        for (const key of allowedUpdates) {
            if (updates[key] !== undefined) {
                filteredUpdates[key] = updates[key];
            }
        }
        
        this.subscriptions[index] = {
            ...this.subscriptions[index],
            ...filteredUpdates,
            updatedAt: new Date().toISOString()
        };
        
        return this.subscriptions[index];
    }
    
    async updatePayment(id, updates) {
        const index = this.payments.findIndex(p => p.id === parseInt(id));
        if (index === -1) return null;
        
        this.payments[index] = {
            ...this.payments[index],
            ...updates,
            updatedAt: new Date().toISOString()
        };
        
        return this.payments[index];
    }
    
    async findInvoiceByPaymentId(paymentId) {
        return this.invoices.find(i => i.paymentId === parseInt(paymentId));
    }
    
    async findInvoicesByUserId(userId, options = {}) {
        let results = this.invoices.filter(i => i.userId === parseInt(userId));
        
        // Apply sorting
        const sortBy = options.sortBy || 'createdAt';
        const sortOrder = options.sortOrder === 'asc' ? 1 : -1;
        results.sort((a, b) => {
            if (a[sortBy] < b[sortBy]) return -sortOrder;
            if (a[sortBy] > b[sortBy]) return sortOrder;
            return 0;
        });
        
        // Apply pagination
        const page = options.page || 1;
        const limit = Math.min(options.limit || PaymentsConfig.pagination.defaultLimit, PaymentsConfig.pagination.maxLimit);
        const start = (page - 1) * limit;
        const end = start + limit;
        
        return {
            invoices: results.slice(start, end),
            total: results.length,
            page,
            limit,
            totalPages: Math.ceil(results.length / limit)
        };
    }
    
    async recordDiscountUsage(discountCode, userId, paymentId) {
        const usage = {
            id: this.discountUsages.length + 1,
            discountCode,
            userId,
            paymentId,
            usedAt: new Date().toISOString()
        };
        
        this.discountUsages.push(usage);
        
        // Update discount usage count
        if (PaymentsConfig.discounts[discountCode]) {
            PaymentsConfig.discounts[discountCode].usedCount++;
        }
        
        return usage;
    }
    
    async getDiscountUsageCount(discountCode) {
        return this.discountUsages.filter(u => u.discountCode === discountCode).length;
    }
    
    async getRevenueStats(options = {}) {
        let payments = [...this.payments];
        
        // Apply date filters
        if (options.startDate) {
            payments = payments.filter(p => new Date(p.createdAt) >= new Date(options.startDate));
        }
        if (options.endDate) {
            payments = payments.filter(p => new Date(p.createdAt) <= new Date(options.endDate));
        }
        
        const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
        const successfulPayments = payments.filter(p => p.status === 'succeeded');
        const successfulRevenue = successfulPayments.reduce((sum, p) => sum + p.amount, 0);
        
        // Group by plan
        const revenueByPlan = {};
        for (const payment of payments) {
            if (!revenueByPlan[payment.planId]) {
                revenueByPlan[payment.planId] = 0;
            }
            revenueByPlan[payment.planId] += payment.amount;
        }
        
        // Monthly breakdown
        const monthlyBreakdown = {};
        for (const payment of payments) {
            const month = payment.createdAt.substring(0, 7); // YYYY-MM
            if (!monthlyBreakdown[month]) {
                monthlyBreakdown[month] = 0;
            }
            monthlyBreakdown[month] += payment.amount;
        }
        
        return {
            totalRevenue,
            successfulRevenue,
            totalPayments: payments.length,
            successfulPayments: successfulPayments.length,
            averagePaymentValue: payments.length > 0 ? totalRevenue / payments.length : 0,
            revenueByPlan,
            monthlyBreakdown
        };
    }
}

// ============================================
// PAYMENT SERVICE
// ============================================

class PaymentService {
    constructor(paymentModel) {
        this.paymentModel = paymentModel;
    }
    
    async createPaymentIntent(userId, planId, paymentMethod, discountCode = null) {
        const plan = PaymentsConfig.plans[planId];
        if (!plan) {
            throw new Error('Invalid plan selected');
        }
        
        let amount = plan.price;
        let discountAmount = 0;
        let discount = null;
        
        // Apply discount if provided
        if (discountCode) {
            discount = await this.validateDiscountCode(discountCode, planId, userId);
            if (discount) {
                discountAmount = this.calculateDiscountAmount(amount, discount);
                amount -= discountAmount;
            }
        }
        
        // Calculate tax
        const taxAmount = await this.calculateTax(userId, amount);
        const totalAmount = amount + taxAmount;
        
        // Create payment record
        const payment = await this.paymentModel.createPayment({
            userId,
            planId,
            amount: totalAmount,
            paymentMethod,
            discountCode,
            discountAmount,
            taxAmount,
            status: 'pending'
        });
        
        // In production, create Stripe PaymentIntent
        // const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        // const paymentIntent = await stripe.paymentIntents.create({
        //     amount: Math.round(totalAmount * 100),
        //     currency: PaymentsConfig.currency.code,
        //     payment_method_types: ['card'],
        //     metadata: {
        //         paymentId: payment.id,
        //         userId,
        //         planId
        //     }
        // });
        
        // Simulate payment intent creation
        const paymentIntent = {
            clientSecret: `pi_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`,
            amount: totalAmount,
            currency: PaymentsConfig.currency.code
        };
        
        return {
            payment,
            clientSecret: paymentIntent.clientSecret,
            amount: totalAmount,
            discountApplied: discount !== null,
            discountAmount
        };
    }
    
    async validateDiscountCode(code, planId, userId) {
        const discount = PaymentsConfig.discounts[code.toUpperCase()];
        
        if (!discount) {
            return null;
        }
        
        // Check if valid for plan
        if (discount.validFor && !discount.validFor.includes(planId)) {
            return null;
        }
        
        // Check expiration
        if (discount.expiresAt && new Date(discount.expiresAt) < new Date()) {
            return null;
        }
        
        // Check usage limit
        if (discount.maxUses && discount.usedCount >= discount.maxUses) {
            return null;
        }
        
        // Check if user already used this discount
        const usageCount = await this.paymentModel.getDiscountUsageCount(code);
        if (usageCount > 0 && discount.maxUsesPerUser === 1) {
            return null;
        }
        
        return discount;
    }
    
    calculateDiscountAmount(amount, discount) {
        if (discount.type === 'percentage') {
            return amount * (discount.value / 100);
        }
        return discount.value;
    }
    
    async calculateTax(userId, amount) {
        // In production, get user country and calculate tax
        // For demo, return 0
        return 0;
    }
    
    async confirmPayment(paymentId, transactionId) {
        const payment = await this.paymentModel.findPaymentById(paymentId);
        if (!payment) {
            throw new Error('Payment not found');
        }
        
        // Update payment status
        const updatedPayment = await this.paymentModel.updatePayment(paymentId, {
            status: 'succeeded',
            transactionId,
            updatedAt: new Date().toISOString()
        });
        
        // Create subscription
        const subscription = await this.createSubscription(payment.userId, payment.planId);
        
        // Create invoice
        await this.createInvoice(payment.userId, payment.id, subscription.id);
        
        // Record discount usage
        if (payment.discountCode) {
            await this.paymentModel.recordDiscountUsage(payment.discountCode, payment.userId, payment.id);
        }
        
        // Update user premium status (call user service)
        await this.updateUserPremiumStatus(payment.userId, true);
        
        return { payment: updatedPayment, subscription };
    }
    
    async createSubscription(userId, planId) {
        const plan = PaymentsConfig.plans[planId];
        const now = new Date();
        let periodEnd = new Date(now);
        
        if (plan.interval === 'month') {
            periodEnd.setMonth(periodEnd.getMonth() + plan.intervalCount);
        } else if (plan.interval === 'year') {
            periodEnd.setFullYear(periodEnd.getFullYear() + plan.intervalCount);
        } else if (plan.interval === 'lifetime') {
            periodEnd = null;
        }
        
        // Cancel existing subscription if any
        await this.cancelSubscription(userId, false);
        
        const subscription = await this.paymentModel.createSubscription({
            userId,
            planId,
            status: 'active',
            currentPeriodStart: now.toISOString(),
            currentPeriodEnd: periodEnd ? periodEnd.toISOString() : null,
            cancelAtPeriodEnd: false
        });
        
        return subscription;
    }
    
    async cancelSubscription(userId, immediate = false) {
        const subscription = await this.paymentModel.findSubscriptionByUserId(userId);
        if (!subscription) {
            return null;
        }
        
        if (immediate) {
            // Cancel immediately
            const updated = await this.paymentModel.updateSubscription(subscription.id, {
                status: 'cancelled',
                cancelledAt: new Date().toISOString()
            });
            await this.updateUserPremiumStatus(userId, false);
            return updated;
        } else {
            // Cancel at period end
            const updated = await this.paymentModel.updateSubscription(subscription.id, {
                cancelAtPeriodEnd: true
            });
            return updated;
        }
    }
    
    async reactivateSubscription(userId) {
        const subscription = await this.paymentModel.findSubscriptionByUserId(userId);
        if (!subscription) {
            throw new Error('No active subscription found');
        }
        
        const updated = await this.paymentModel.updateSubscription(subscription.id, {
            cancelAtPeriodEnd: false
        });
        
        return updated;
    }
    
    async createInvoice(userId, paymentId, subscriptionId) {
        const payment = await this.paymentModel.findPaymentById(paymentId);
        if (!payment) {
            throw new Error('Payment not found');
        }
        
        const plan = PaymentsConfig.plans[payment.planId];
        
        const invoice = await this.paymentModel.createInvoice({
            userId,
            paymentId,
            subscriptionId,
            amount: payment.amount,
            status: 'paid',
            paidAt: new Date().toISOString(),
            items: [
                {
                    description: `${plan.name} Subscription`,
                    quantity: 1,
                    unitPrice: payment.amount - payment.taxAmount,
                    tax: payment.taxAmount,
                    total: payment.amount
                }
            ]
        });
        
        return invoice;
    }
    
    async updateUserPremiumStatus(userId, isPremium) {
        // In production, call user service to update premium status
        console.log(`[Payment] Updating user ${userId} premium status to ${isPremium}`);
        
        // Simulate API call to user service
        // const response = await fetch(`${process.env.USER_SERVICE_URL}/users/${userId}/premium`, {
        //     method: 'PUT',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify({ isPremium })
        // });
    }
    
    async getSubscription(userId) {
        const subscription = await this.paymentModel.findSubscriptionByUserId(userId);
        if (!subscription) {
            return {
                isActive: false,
                plan: PaymentsConfig.plans.free
            };
        }
        
        const plan = PaymentsConfig.plans[subscription.planId];
        const now = new Date();
        const isExpired = subscription.currentPeriodEnd && new Date(subscription.currentPeriodEnd) < now;
        
        if (isExpired && subscription.status === 'active') {
            await this.cancelSubscription(userId, true);
            return {
                isActive: false,
                plan: PaymentsConfig.plans.free
            };
        }
        
        return {
            isActive: subscription.status === 'active' && !isExpired,
            subscription: {
                id: subscription.subscriptionId,
                planId: subscription.planId,
                planName: plan.name,
                status: subscription.status,
                currentPeriodStart: subscription.currentPeriodStart,
                currentPeriodEnd: subscription.currentPeriodEnd,
                cancelAtPeriodEnd: subscription.cancelAtPeriodEnd
            },
            plan
        };
    }
    
    async getPaymentHistory(userId, options = {}) {
        return await this.paymentModel.findPaymentsByUserId(userId, options);
    }
    
    async getInvoice(userId, invoiceId) {
        // In production, get invoice by ID
        const invoices = await this.paymentModel.findInvoicesByUserId(userId);
        return invoices.invoices.find(i => i.id === parseInt(invoiceId));
    }
    
    async getUpcomingInvoice(userId) {
        const subscription = await this.paymentModel.findSubscriptionByUserId(userId);
        if (!subscription || subscription.cancelAtPeriodEnd) {
            return null;
        }
        
        const plan = PaymentsConfig.plans[subscription.planId];
        const nextBillingDate = subscription.currentPeriodEnd;
        
        return {
            amount: plan.price,
            currency: PaymentsConfig.currency.code,
            date: nextBillingDate,
            items: [
                {
                    description: `${plan.name} Subscription Renewal`,
                    amount: plan.price
                }
            ]
        };
    }
    
    async handleWebhook(event) {
        // In production, handle Stripe webhook events
        switch (event.type) {
            case 'payment_intent.succeeded':
                return await this.handlePaymentSuccess(event.data.object);
            case 'payment_intent.payment_failed':
                return await this.handlePaymentFailure(event.data.object);
            case 'customer.subscription.deleted':
                return await this.handleSubscriptionDeletion(event.data.object);
            default:
                console.log(`Unhandled event type: ${event.type}`);
                return { received: true };
        }
    }
    
    async handlePaymentSuccess(paymentIntent) {
        const paymentId = paymentIntent.metadata?.paymentId;
        if (paymentId) {
            await this.confirmPayment(paymentId, paymentIntent.id);
        }
        return { received: true };
    }
    
    async handlePaymentFailure(paymentIntent) {
        const paymentId = paymentIntent.metadata?.paymentId;
        if (paymentId) {
            await this.paymentModel.updatePayment(paymentId, { status: 'failed' });
        }
        return { received: true };
    }
    
    async handleSubscriptionDeletion(subscription) {
        const userId = subscription.metadata?.userId;
        if (userId) {
            await this.updateUserPremiumStatus(userId, false);
        }
        return { received: true };
    }
}

// ============================================
// VALIDATION RULES
// ============================================

const PaymentValidation = {
    createPaymentIntent: [
        body('planId')
            .notEmpty().withMessage('Plan ID is required')
            .isIn(['monthly', 'yearly', 'lifetime'])
            .withMessage('Invalid plan selected'),
        
        body('paymentMethod')
            .notEmpty().withMessage('Payment method is required')
            .isIn(['card', 'paypal', 'crypto'])
            .withMessage('Invalid payment method'),
        
        body('discountCode')
            .optional()
            .isString()
            .isLength({ min: 3, max: 20 })
            .withMessage('Invalid discount code')
    ],
    
    confirmPayment: [
        body('paymentId')
            .notEmpty().withMessage('Payment ID is required')
            .isInt({ min: 1 })
            .withMessage('Invalid payment ID'),
        
        body('transactionId')
            .notEmpty().withMessage('Transaction ID is required')
    ],
    
    getPayments: [
        query('page')
            .optional()
            .isInt({ min: 1 })
            .withMessage('Page must be a positive integer'),
        
        query('limit')
            .optional()
            .isInt({ min: 1, max: PaymentsConfig.pagination.maxLimit })
            .withMessage(`Limit must be between 1 and ${PaymentsConfig.pagination.maxLimit}`),
        
        query('status')
            .optional()
            .isIn(['pending', 'succeeded', 'failed', 'refunded'])
            .withMessage('Invalid status'),
        
        query('startDate')
            .optional()
            .isISO8601()
            .withMessage('Invalid start date'),
        
        query('endDate')
            .optional()
            .isISO8601()
            .withMessage('Invalid end date')
    ]
};

// ============================================
// PAYMENT ROUTES
// ============================================

function createPaymentRoutes(paymentService, authMiddleware) {
    const router = require('express').Router();
    
    // Create payment intent
    router.post('/create-intent', authMiddleware.authenticate, PaymentValidation.createPaymentIntent, async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        try {
            const result = await paymentService.createPaymentIntent(
                req.user.id,
                req.body.planId,
                req.body.paymentMethod,
                req.body.discountCode
            );
            res.json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    
    // Confirm payment
    router.post('/confirm', authMiddleware.authenticate, PaymentValidation.confirmPayment, async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        try {
            const result = await paymentService.confirmPayment(req.body.paymentId, req.body.transactionId);
            res.json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    
    // Get subscription
    router.get('/subscription', authMiddleware.authenticate, async (req, res) => {
        const subscription = await paymentService.getSubscription(req.user.id);
        res.json(subscription);
    });
    
    // Cancel subscription
    router.post('/subscription/cancel', authMiddleware.authenticate, async (req, res) => {
        const immediate = req.body.immediate === true;
        
        try {
            const result = await paymentService.cancelSubscription(req.user.id, immediate);
            res.json({ success: true, subscription: result });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    
    // Reactivate subscription
    router.post('/subscription/reactivate', authMiddleware.authenticate, async (req, res) => {
        try {
            const result = await paymentService.reactivateSubscription(req.user.id);
            res.json({ success: true, subscription: result });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    
    // Get payment history
    router.get('/history', authMiddleware.authenticate, PaymentValidation.getPayments, async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        const options = {
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || PaymentsConfig.pagination.defaultLimit,
            status: req.query.status,
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            sortBy: req.query.sortBy || 'createdAt',
            sortOrder: req.query.sortOrder || 'desc'
        };
        
        const result = await paymentService.getPaymentHistory(req.user.id, options);
        res.json(result);
    });
    
    // Get invoices
    router.get('/invoices', authMiddleware.authenticate, async (req, res) => {
        const options = {
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || PaymentsConfig.pagination.defaultLimit,
            sortBy: req.query.sortBy || 'createdAt',
            sortOrder: req.query.sortOrder || 'desc'
        };
        
        const result = await paymentService.paymentModel.findInvoicesByUserId(req.user.id, options);
        res.json(result);
    });
    
    // Get invoice by ID
    router.get('/invoices/:id', authMiddleware.authenticate, async (req, res) => {
        try {
            const invoice = await paymentService.getInvoice(req.user.id, req.params.id);
            if (!invoice) {
                return res.status(404).json({ error: 'Invoice not found' });
            }
            res.json(invoice);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    
    // Get upcoming invoice
    router.get('/upcoming-invoice', authMiddleware.authenticate, async (req, res) => {
        const invoice = await paymentService.getUpcomingInvoice(req.user.id);
        res.json(invoice || {});
    });
    
    // Validate discount code
    router.post('/validate-discount', authMiddleware.authenticate, async (req, res) => {
        const { discountCode, planId } = req.body;
        
        if (!discountCode || !planId) {
            return res.status(400).json({ error: 'Discount code and plan ID required' });
        }
        
        const discount = await paymentService.validateDiscountCode(discountCode, planId, req.user.id);
        
        if (discount) {
            const amount = PaymentsConfig.plans[planId]?.price || 0;
            const discountAmount = paymentService.calculateDiscountAmount(amount, discount);
            
            res.json({
                valid: true,
                discount: {
                    code: discountCode,
                    type: discount.type,
                    value: discount.value,
                    amount: discountAmount,
                    finalAmount: amount - discountAmount
                }
            });
        } else {
            res.json({ valid: false });
        }
    });
    
    // Webhook endpoint (no auth, Stripe signature verification)
    router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
        const sig = req.headers['stripe-signature'];
        
        try {
            // Verify webhook signature
            // const event = stripe.webhooks.constructEvent(req.body, sig, PaymentsConfig.stripe.webhookSecret);
            // const result = await paymentService.handleWebhook(event);
            
            // For demo, simulate webhook handling
            const result = { received: true };
            res.json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    
    // Get revenue stats (admin only)
    router.get('/admin/revenue', authMiddleware.authenticate, authMiddleware.requireRole('admin'), async (req, res) => {
        const { startDate, endDate } = req.query;
        const stats = await paymentService.paymentModel.getRevenueStats({ startDate, endDate });
        res.json(stats);
    });
    
    return router;
}

// ============================================
// EXPORTS
// ============================================

const paymentModel = new PaymentModel();
const paymentService = new PaymentService(paymentModel);
const paymentRoutes = createPaymentRoutes(paymentService, require('./auth').authMiddleware);

module.exports = {
    paymentModel,
    paymentService,
    paymentRoutes,
    PaymentsConfig,
    PaymentValidation
};
