/* ============================================
   SPEAKFLOW - PAYMENT MODULE
   Version: 1.0.0
   Handles payment processing, subscriptions, and invoices
   ============================================ */

// ============================================
// PAYMENT CONFIGURATION
// ============================================

const PaymentConfig = {
    // API Endpoints
    api: {
        createPayment: '/api/payments/create',
        verifyPayment: '/api/payments/verify',
        subscription: '/api/payments/subscription',
        cancelSubscription: '/api/payments/cancel',
        invoices: '/api/payments/invoices',
        webhook: '/api/payments/webhook'
    },
    
    // Payment Methods
    methods: {
        stripe: {
            name: 'Credit Card',
            icon: '💳',
            enabled: true,
            processor: 'stripe'
        },
        paypal: {
            name: 'PayPal',
            icon: '💰',
            enabled: true,
            processor: 'paypal'
        },
        crypto: {
            name: 'Cryptocurrency',
            icon: '₿',
            enabled: false,
            processor: 'coinbase'
        }
    },
    
    // Plans
    plans: {
        free: {
            id: 'free',
            name: 'Free',
            price: 0,
            currency: 'USD',
            interval: 'month',
            features: [
                '10 practice sentences/day',
                'Basic AI feedback',
                'Daily streak & XP',
                'Basic achievements'
            ]
        },
        monthly: {
            id: 'premium_monthly',
            name: 'Premium Monthly',
            price: 9.99,
            currency: 'USD',
            interval: 'month',
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
            id: 'premium_yearly',
            name: 'Premium Yearly',
            price: 79.99,
            currency: 'USD',
            interval: 'year',
            features: [
                'All Monthly features',
                'Save 33% compared to monthly',
                '1 month free',
                'Early access to new features',
                'Premium support'
            ]
        },
        lifetime: {
            id: 'premium_lifetime',
            name: 'Lifetime Premium',
            price: 299.99,
            currency: 'USD',
            interval: 'lifetime',
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
        'WELCOME20': { type: 'percentage', value: 20, validFor: ['monthly', 'yearly'] },
        'ANNUAL30': { type: 'percentage', value: 30, validFor: ['yearly'] },
        'STUDENT50': { type: 'percentage', value: 50, validFor: ['monthly', 'yearly'], requiresVerification: true }
    },
    
    // Currency Settings
    currency: {
        code: 'USD',
        symbol: '$',
        decimalPlaces: 2
    },
    
    // Storage Keys
    storage: {
        subscription: 'payment_subscription',
        paymentHistory: 'payment_history',
        promoCode: 'payment_promo'
    }
};

// ============================================
// SUBSCRIPTION MANAGER
// ============================================

class SubscriptionManager {
    constructor() {
        this.subscription = this.loadSubscription();
        this.paymentHistory = this.loadPaymentHistory();
        this.init();
    }
    
    init() {
        this.checkSubscriptionStatus();
        this.startExpiryCheck();
    }
    
    loadSubscription() {
        const saved = localStorage.getItem(PaymentConfig.storage.subscription);
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error('Failed to load subscription:', e);
            }
        }
        
        return {
            planId: 'free',
            status: 'active',
            startDate: new Date().toISOString(),
            endDate: null,
            autoRenew: false,
            isPremium: false
        };
    }
    
    loadPaymentHistory() {
        const saved = localStorage.getItem(PaymentConfig.storage.paymentHistory);
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error('Failed to load payment history:', e);
            }
        }
        return [];
    }
    
    saveSubscription() {
        localStorage.setItem(PaymentConfig.storage.subscription, JSON.stringify(this.subscription));
    }
    
    savePaymentHistory() {
        localStorage.setItem(PaymentConfig.storage.paymentHistory, JSON.stringify(this.paymentHistory));
    }
    
    checkSubscriptionStatus() {
        if (this.subscription.endDate) {
            const now = new Date();
            const end = new Date(this.subscription.endDate);
            
            if (now > end && this.subscription.status === 'active') {
                this.expireSubscription();
            }
        }
    }
    
    startExpiryCheck() {
        setInterval(() => {
            this.checkSubscriptionStatus();
        }, 3600000); // Check every hour
    }
    
    async createSubscription(planId, paymentMethod, promoCode = null) {
        const plan = PaymentConfig.plans[planId];
        if (!plan) {
            return { success: false, error: 'Invalid plan' };
        }
        
        let amount = plan.price;
        let discount = null;
        
        if (promoCode) {
            discount = await this.validatePromoCode(promoCode, planId);
            if (discount) {
                amount = this.applyDiscount(amount, discount);
            }
        }
        
        // Create payment intent
        const paymentIntent = await this.createPaymentIntent({
            amount,
            currency: PaymentConfig.currency.code,
            planId,
            paymentMethod,
            promoCode
        });
        
        if (!paymentIntent.success) {
            return paymentIntent;
        }
        
        // Process payment
        const paymentResult = await this.processPayment(paymentIntent);
        
        if (paymentResult.success) {
            // Activate subscription
            this.activateSubscription(planId, amount, promoCode);
            
            // Record payment
            this.recordPayment({
                id: paymentResult.transactionId,
                planId,
                amount,
                currency: PaymentConfig.currency.code,
                paymentMethod,
                status: 'completed',
                timestamp: new Date().toISOString()
            });
            
            return {
                success: true,
                subscription: this.subscription,
                transactionId: paymentResult.transactionId
            };
        }
        
        return paymentResult;
    }
    
    async createPaymentIntent(data) {
        // In production, call backend API
        // For demo, simulate payment intent creation
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    success: true,
                    clientSecret: `pi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    amount: data.amount
                });
            }, 1000);
        });
        
        // Actual implementation:
        /*
        try {
            const response = await fetch(PaymentConfig.api.createPayment, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return await response.json();
        } catch (error) {
            return { success: false, error: error.message };
        }
        */
    }
    
    async processPayment(paymentIntent) {
        // In production, confirm payment with Stripe/PayPal
        // For demo, simulate payment processing
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    success: true,
                    transactionId: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
                });
            }, 1500);
        });
    }
    
    activateSubscription(planId, amount, promoCode = null) {
        const plan = PaymentConfig.plans[planId];
        const now = new Date();
        let endDate = null;
        
        if (plan.interval === 'month') {
            endDate = new Date(now.setMonth(now.getMonth() + 1));
        } else if (plan.interval === 'year') {
            endDate = new Date(now.setFullYear(now.getFullYear() + 1));
        } else if (plan.interval === 'lifetime') {
            endDate = null;
        }
        
        this.subscription = {
            planId,
            status: 'active',
            startDate: new Date().toISOString(),
            endDate: endDate ? endDate.toISOString() : null,
            autoRenew: true,
            isPremium: planId !== 'free',
            amount,
            promoCode,
            lastPaymentDate: new Date().toISOString()
        };
        
        this.saveSubscription();
        
        // Dispatch event
        const event = new CustomEvent('payment:subscriptionActivated', {
            detail: { subscription: this.subscription }
        });
        document.dispatchEvent(event);
    }
    
    expireSubscription() {
        this.subscription.status = 'expired';
        this.subscription.isPremium = false;
        this.subscription.planId = 'free';
        this.saveSubscription();
        
        const event = new CustomEvent('payment:subscriptionExpired', {
            detail: { subscription: this.subscription }
        });
        document.dispatchEvent(event);
    }
    
    cancelSubscription() {
        if (this.subscription.status === 'active') {
            this.subscription.status = 'cancelled';
            this.subscription.autoRenew = false;
            this.saveSubscription();
            
            const event = new CustomEvent('payment:subscriptionCancelled', {
                detail: { subscription: this.subscription }
            });
            document.dispatchEvent(event);
            
            return { success: true };
        }
        
        return { success: false, error: 'No active subscription' };
    }
    
    async validatePromoCode(code, planId) {
        const discount = PaymentConfig.discounts[code.toUpperCase()];
        
        if (!discount) {
            return null;
        }
        
        if (discount.validFor && !discount.validFor.includes(planId)) {
            return null;
        }
        
        // In production, check with backend
        return discount;
    }
    
    applyDiscount(amount, discount) {
        if (discount.type === 'percentage') {
            return amount * (1 - discount.value / 100);
        }
        return amount - discount.value;
    }
    
    recordPayment(payment) {
        this.paymentHistory.unshift(payment);
        
        // Keep only last 100 payments
        if (this.paymentHistory.length > 100) {
            this.paymentHistory.pop();
        }
        
        this.savePaymentHistory();
    }
    
    getSubscription() {
        return { ...this.subscription };
    }
    
    getPaymentHistory() {
        return [...this.paymentHistory];
    }
    
    getInvoice(paymentId) {
        const payment = this.paymentHistory.find(p => p.id === paymentId);
        if (!payment) return null;
        
        return {
            invoiceNumber: `INV-${payment.id.slice(-8)}`,
            date: payment.timestamp,
            ...payment,
            plan: PaymentConfig.plans[payment.planId]
        };
    }
    
    getUpcomingInvoice() {
        if (!this.subscription.isPremium || this.subscription.status !== 'active') {
            return null;
        }
        
        const plan = PaymentConfig.plans[this.subscription.planId];
        const nextBillingDate = new Date(this.subscription.endDate);
        
        return {
            amount: this.subscription.amount || plan.price,
            currency: PaymentConfig.currency.code,
            date: nextBillingDate.toISOString(),
            plan: plan.name,
            items: [
                {
                    description: `${plan.name} Subscription`,
                    amount: this.subscription.amount || plan.price
                }
            ]
        };
    }
}

// ============================================
// PAYMENT UI CONTROLLER
// ============================================

class PaymentUIController {
    constructor(subscriptionManager) {
        this.subscriptionManager = subscriptionManager;
        this.elements = {};
        this.init();
    }
    
    init() {
        this.bindElements();
        this.bindEvents();
        this.renderPricing();
        this.renderSubscriptionStatus();
    }
    
    bindElements() {
        this.elements = {
            pricingContainer: document.getElementById('pricingContainer'),
            subscriptionStatus: document.getElementById('subscriptionStatus'),
            paymentModal: document.getElementById('paymentModal'),
            paymentForm: document.getElementById('paymentForm'),
            cardNumber: document.getElementById('cardNumber'),
            cardExpiry: document.getElementById('cardExpiry'),
            cardCvc: document.getElementById('cardCvc'),
            cardName: document.getElementById('cardName'),
            processPaymentBtn: document.getElementById('processPaymentBtn'),
            cancelSubscriptionBtn: document.getElementById('cancelSubscriptionBtn'),
            promoCodeInput: document.getElementById('promoCode'),
            applyPromoBtn: document.getElementById('applyPromoBtn'),
            paymentHistory: document.getElementById('paymentHistory')
        };
    }
    
    bindEvents() {
        if (this.elements.processPaymentBtn) {
            this.elements.processPaymentBtn.addEventListener('click', () => this.processPayment());
        }
        
        if (this.elements.cancelSubscriptionBtn) {
            this.elements.cancelSubscriptionBtn.addEventListener('click', () => this.cancelSubscription());
        }
        
        if (this.elements.applyPromoBtn) {
            this.elements.applyPromoBtn.addEventListener('click', () => this.applyPromoCode());
        }
        
        // Card input formatting
        if (this.elements.cardNumber) {
            this.elements.cardNumber.addEventListener('input', (e) => this.formatCardNumber(e));
        }
        
        if (this.elements.cardExpiry) {
            this.elements.cardExpiry.addEventListener('input', (e) => this.formatCardExpiry(e));
        }
        
        document.addEventListener('payment:subscriptionActivated', () => {
            this.renderSubscriptionStatus();
            this.showToast('Subscription activated! Welcome to Premium! 🎉', 'success');
        });
        
        document.addEventListener('payment:subscriptionCancelled', () => {
            this.renderSubscriptionStatus();
            this.showToast('Subscription cancelled. You will lose premium access at end of period.', 'info');
        });
        
        document.addEventListener('payment:subscriptionExpired', () => {
            this.renderSubscriptionStatus();
            this.showToast('Your premium subscription has expired. Upgrade to continue enjoying premium features.', 'warning');
        });
    }
    
    renderPricing() {
        if (!this.elements.pricingContainer) return;
        
        const plans = Object.values(PaymentConfig.plans).filter(p => p.id !== 'free');
        
        this.elements.pricingContainer.innerHTML = plans.map(plan => `
            <div class="pricing-card ${plan.id === 'yearly' ? 'popular' : ''}" data-plan="${plan.id}">
                ${plan.id === 'yearly' ? '<div class="popular-badge">🔥 BEST VALUE</div>' : ''}
                <h3>${plan.name}</h3>
                <div class="price">
                    ${PaymentConfig.currency.symbol}${plan.price}
                    <small>/${plan.interval === 'month' ? 'month' : plan.interval === 'year' ? 'year' : 'one-time'}</small>
                </div>
                <ul class="feature-list">
                    ${plan.features.map(f => `<li>✅ ${f}</li>`).join('')}
                </ul>
                <button class="btn btn-primary select-plan-btn" data-plan="${plan.id}">
                    ${plan.id === 'free' ? 'Current Plan' : 'Upgrade Now'}
                </button>
            </div>
        `).join('');
        
        // Attach click handlers
        document.querySelectorAll('.select-plan-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const planId = btn.dataset.plan;
                this.showPaymentModal(planId);
            });
        });
    }
    
    renderSubscriptionStatus() {
        const subscription = this.subscriptionManager.getSubscription();
        
        if (this.elements.subscriptionStatus) {
            if (subscription.isPremium) {
                const plan = PaymentConfig.plans[subscription.planId];
                const endDate = subscription.endDate ? new Date(subscription.endDate).toLocaleDateString() : 'Never';
                
                this.elements.subscriptionStatus.innerHTML = `
                    <div class="subscription-active">
                        <div class="subscription-badge premium">⭐ PREMIUM ACTIVE</div>
                        <div class="subscription-details">
                            <p><strong>Plan:</strong> ${plan.name}</p>
                            <p><strong>Status:</strong> ${subscription.status}</p>
                            <p><strong>Renews:</strong> ${subscription.autoRenew ? `on ${endDate}` : 'Cancelled'}</p>
                            ${subscription.autoRenew ? `
                                <button id="cancelSubscriptionBtn" class="btn btn-outline">Cancel Subscription</button>
                            ` : ''}
                        </div>
                    </div>
                `;
                
                // Re-bind cancel button
                const cancelBtn = document.getElementById('cancelSubscriptionBtn');
                if (cancelBtn) {
                    cancelBtn.addEventListener('click', () => this.cancelSubscription());
                }
            } else {
                this.elements.subscriptionStatus.innerHTML = `
                    <div class="subscription-free">
                        <div class="subscription-badge free">FREE ACCOUNT</div>
                        <div class="subscription-details">
                            <p>Upgrade to Premium for unlimited practice and advanced features!</p>
                            <button class="btn btn-primary" id="upgradeFromStatus">Upgrade Now</button>
                        </div>
                    </div>
                `;
                
                const upgradeBtn = document.getElementById('upgradeFromStatus');
                if (upgradeBtn) {
                    upgradeBtn.addEventListener('click', () => this.showPaymentModal('monthly'));
                }
            }
        }
        
        this.renderPaymentHistory();
    }
    
    renderPaymentHistory() {
        if (!this.elements.paymentHistory) return;
        
        const history = this.subscriptionManager.getPaymentHistory();
        
        if (history.length === 0) {
            this.elements.paymentHistory.innerHTML = '<p class="no-history">No payment history yet.</p>';
            return;
        }
        
        this.elements.paymentHistory.innerHTML = `
            <h3>Payment History</h3>
            <div class="history-list">
                ${history.map(payment => `
                    <div class="history-item">
                        <div class="history-date">${new Date(payment.timestamp).toLocaleDateString()}</div>
                        <div class="history-plan">${PaymentConfig.plans[payment.planId]?.name || payment.planId}</div>
                        <div class="history-amount">${PaymentConfig.currency.symbol}${payment.amount}</div>
                        <div class="history-status ${payment.status}">${payment.status}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    showPaymentModal(planId) {
        const plan = PaymentConfig.plans[planId];
        if (!plan) return;
        
        const modal = this.elements.paymentModal;
        if (!modal) return;
        
        // Update modal content
        const modalContent = modal.querySelector('.modal-content');
        if (modalContent) {
            modalContent.innerHTML = `
                <div class="modal-header">
                    <h2>Complete Your Purchase</h2>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="order-summary">
                        <h3>Order Summary</h3>
                        <div class="summary-item">
                            <span>${plan.name}</span>
                            <span>${PaymentConfig.currency.symbol}${plan.price}</span>
                        </div>
                        <div class="summary-item discount-row" style="display: none;">
                            <span>Discount</span>
                            <span class="discount-amount">-${PaymentConfig.currency.symbol}0</span>
                        </div>
                        <div class="summary-item total">
                            <strong>Total</strong>
                            <strong class="total-amount">${PaymentConfig.currency.symbol}${plan.price}</strong>
                        </div>
                    </div>
                    
                    <div class="payment-methods">
                        <h3>Payment Method</h3>
                        <div class="method-selector">
                            ${Object.entries(PaymentConfig.methods).filter(([_, m]) => m.enabled).map(([key, method]) => `
                                <div class="method-option ${key === 'stripe' ? 'active' : ''}" data-method="${key}">
                                    ${method.icon} ${method.name}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div class="card-details">
                        <div class="form-group">
                            <label class="form-label">Card Number</label>
                            <input type="text" id="cardNumber" class="form-control" placeholder="1234 5678 9012 3456" maxlength="19">
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Expiry Date</label>
                                <input type="text" id="cardExpiry" class="form-control" placeholder="MM/YY" maxlength="5">
                            </div>
                            <div class="form-group">
                                <label class="form-label">CVC</label>
                                <input type="text" id="cardCvc" class="form-control" placeholder="123" maxlength="4">
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Cardholder Name</label>
                            <input type="text" id="cardName" class="form-control" placeholder="John Doe">
                        </div>
                    </div>
                    
                    <div class="promo-section">
                        <div class="form-group">
                            <label class="form-label">Promo Code</label>
                            <div class="promo-input-group">
                                <input type="text" id="promoCode" class="form-control" placeholder="Enter code">
                                <button id="applyPromoBtn" class="btn btn-outline">Apply</button>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button id="processPaymentBtn" class="btn btn-primary btn-premium" data-plan="${planId}">
                        Pay ${PaymentConfig.currency.symbol}${plan.price}
                    </button>
                    <button class="btn btn-outline modal-close">Cancel</button>
                </div>
            `;
        }
        
        modal.classList.add('active');
        
        // Re-bind elements
        this.elements.cardNumber = document.getElementById('cardNumber');
        this.elements.cardExpiry = document.getElementById('cardExpiry');
        this.elements.cardCvc = document.getElementById('cardCvc');
        this.elements.cardName = document.getElementById('cardName');
        this.elements.processPaymentBtn = document.getElementById('processPaymentBtn');
        this.elements.promoCodeInput = document.getElementById('promoCode');
        this.elements.applyPromoBtn = document.getElementById('applyPromoBtn');
        
        // Re-bind events
        if (this.elements.cardNumber) {
            this.elements.cardNumber.addEventListener('input', (e) => this.formatCardNumber(e));
        }
        if (this.elements.cardExpiry) {
            this.elements.cardExpiry.addEventListener('input', (e) => this.formatCardExpiry(e));
        }
        if (this.elements.processPaymentBtn) {
            this.elements.processPaymentBtn.addEventListener('click', () => this.processPayment());
        }
        if (this.elements.applyPromoBtn) {
            this.elements.applyPromoBtn.addEventListener('click', () => this.applyPromoCode());
        }
        
        // Method selector
        document.querySelectorAll('.method-option').forEach(opt => {
            opt.addEventListener('click', () => {
                document.querySelectorAll('.method-option').forEach(o => o.classList.remove('active'));
                opt.classList.add('active');
                this.selectedMethod = opt.dataset.method;
                
                // Show/hide card details
                const cardDetails = document.querySelector('.card-details');
                if (cardDetails) {
                    cardDetails.style.display = opt.dataset.method === 'stripe' ? 'block' : 'none';
                }
            });
        });
        
        // Close modal
        modal.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => modal.classList.remove('active'));
        });
    }
    
    async processPayment() {
        const planId = this.elements.processPaymentBtn?.dataset.plan;
        if (!planId) return;
        
        const paymentMethod = this.selectedMethod || 'stripe';
        const promoCode = this.elements.promoCodeInput?.value;
        
        // Validate card details if using card
        if (paymentMethod === 'stripe') {
            if (!this.validateCardDetails()) {
                this.showToast('Please enter valid card details', 'error');
                return;
            }
        }
        
        // Disable button and show loading
        const btn = this.elements.processPaymentBtn;
        const originalText = btn.textContent;
        btn.textContent = 'Processing...';
        btn.disabled = true;
        
        // Process payment
        const result = await this.subscriptionManager.createSubscription(planId, paymentMethod, promoCode);
        
        btn.textContent = originalText;
        btn.disabled = false;
        
        if (result.success) {
            // Close modal
            const modal = this.elements.paymentModal;
            if (modal) modal.classList.remove('active');
            
            // Show success
            this.showToast('Payment successful! Welcome to Premium! 🎉', 'success');
            
            // Refresh UI
            this.renderSubscriptionStatus();
            this.renderPricing();
        } else {
            this.showToast(result.error || 'Payment failed. Please try again.', 'error');
        }
    }
    
    async applyPromoCode() {
        const code = this.elements.promoCodeInput?.value;
        if (!code) return;
        
        const planId = this.elements.processPaymentBtn?.dataset.plan;
        if (!planId) return;
        
        const discount = await this.subscriptionManager.validatePromoCode(code, planId);
        
        if (discount) {
            const plan = PaymentConfig.plans[planId];
            const originalPrice = plan.price;
            const newPrice = this.subscriptionManager.applyDiscount(originalPrice, discount);
            const savings = originalPrice - newPrice;
            
            // Update UI
            const discountRow = document.querySelector('.discount-row');
            const discountAmount = document.querySelector('.discount-amount');
            const totalAmount = document.querySelector('.total-amount');
            
            if (discountRow && discountAmount && totalAmount) {
                discountRow.style.display = 'flex';
                discountAmount.textContent = `-${PaymentConfig.currency.symbol}${savings.toFixed(2)}`;
                totalAmount.textContent = `${PaymentConfig.currency.symbol}${newPrice.toFixed(2)}`;
                
                if (this.elements.processPaymentBtn) {
                    this.elements.processPaymentBtn.textContent = `Pay ${PaymentConfig.currency.symbol}${newPrice.toFixed(2)}`;
                }
            }
            
            this.showToast(`Promo code applied! You saved ${PaymentConfig.currency.symbol}${savings.toFixed(2)}`, 'success');
        } else {
            this.showToast('Invalid or expired promo code', 'error');
        }
    }
    
    async cancelSubscription() {
        if (confirm('Are you sure you want to cancel your subscription? You will lose premium access at the end of your billing period.')) {
            const result = await this.subscriptionManager.cancelSubscription();
            
            if (result.success) {
                this.showToast('Subscription cancelled. You will keep premium access until the end of your billing period.', 'info');
                this.renderSubscriptionStatus();
            }
        }
    }
    
    validateCardDetails() {
        const cardNumber = this.elements.cardNumber?.value.replace(/\s/g, '');
        const cardExpiry = this.elements.cardExpiry?.value;
        const cardCvc = this.elements.cardCvc?.value;
        const cardName = this.elements.cardName?.value;
        
        if (!cardNumber || cardNumber.length < 15 || cardNumber.length > 16) return false;
        if (!cardExpiry || !cardExpiry.match(/^\d{2}\/\d{2}$/)) return false;
        if (!cardCvc || cardCvc.length < 3) return false;
        if (!cardName || cardName.length < 2) return false;
        
        return true;
    }
    
    formatCardNumber(e) {
        let value = e.target.value.replace(/\D/g, '');
        value = value.replace(/(\d{4})(?=\d)/g, '$1 ');
        e.target.value = value.slice(0, 19);
    }
    
    formatCardExpiry(e) {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length >= 2) {
            value = value.slice(0, 2) + '/' + value.slice(2, 4);
        }
        e.target.value = value.slice(0, 5);
    }
    
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `payment-toast toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => toast.remove(), 3000);
    }
}

// ============================================
// EXPORTS
// ============================================

// Initialize payment system
const subscriptionManager = new SubscriptionManager();
const paymentUI = new PaymentUIController(subscriptionManager);

// Global exports
window.SpeakFlow = window.SpeakFlow || {};
window.SpeakFlow.Payment = {
    subscription: subscriptionManager,
    ui: paymentUI,
    config: PaymentConfig,
    plans: PaymentConfig.plans
};

// Module exports
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        PaymentConfig,
        SubscriptionManager,
        PaymentUIController
    };
}

// ============================================
// CSS STYLES
// ============================================

const style = document.createElement('style');
style.textContent = `
    .pricing-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 24px;
        margin: 32px 0;
    }
    
    .pricing-card {
        background: var(--bg-primary);
        border-radius: 24px;
        padding: 32px;
        text-align: center;
        position: relative;
        box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        transition: transform 0.2s;
    }
    
    .pricing-card:hover {
        transform: translateY(-4px);
    }
    
    .pricing-card.popular {
        border: 2px solid var(--color-warning);
        transform: scale(1.02);
    }
    
    .popular-badge {
        position: absolute;
        top: -12px;
        right: 20px;
        background: var(--color-warning);
        color: white;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: bold;
    }
    
    .price {
        font-size: 48px;
        font-weight: bold;
        margin: 20px 0;
    }
    
    .price small {
        font-size: 14px;
        font-weight: normal;
    }
    
    .feature-list {
        list-style: none;
        margin: 24px 0;
        text-align: left;
    }
    
    .feature-list li {
        padding: 8px 0;
        border-bottom: 1px solid var(--border-light);
    }
    
    .method-selector {
        display: flex;
        gap: 12px;
        margin: 16px 0;
    }
    
    .method-option {
        flex: 1;
        padding: 12px;
        text-align: center;
        border: 2px solid var(--border-light);
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.2s;
    }
    
    .method-option.active {
        border-color: var(--color-primary);
        background: var(--primary-50);
    }
    
    .promo-input-group {
        display: flex;
        gap: 8px;
    }
    
    .promo-input-group .form-control {
        flex: 1;
    }
    
    .order-summary {
        background: var(--bg-secondary);
        padding: 16px;
        border-radius: 12px;
        margin-bottom: 24px;
    }
    
    .summary-item {
        display: flex;
        justify-content: space-between;
        padding: 8px 0;
    }
    
    .summary-item.total {
        border-top: 1px solid var(--border-light);
        margin-top: 8px;
        padding-top: 12px;
        font-size: 18px;
    }
    
    .subscription-active, .subscription-free {
        background: var(--bg-secondary);
        border-radius: 16px;
        padding: 20px;
        margin-bottom: 24px;
    }
    
    .subscription-badge {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: bold;
        margin-bottom: 12px;
    }
    
    .subscription-badge.premium {
        background: linear-gradient(135deg, var(--color-warning), var(--color-danger));
        color: white;
    }
    
    .subscription-badge.free {
        background: var(--gray-500);
        color: white;
    }
    
    .history-list {
        max-height: 300px;
        overflow-y: auto;
    }
    
    .history-item {
        display: flex;
        justify-content: space-between;
        padding: 12px;
        border-bottom: 1px solid var(--border-light);
    }
    
    .payment-toast {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        padding: 12px 24px;
        border-radius: 40px;
        color: white;
        font-weight: 600;
        z-index: 1000;
        animation: slideUp 0.3s ease;
    }
    
    .toast-success {
        background: #10b981;
    }
    
    .toast-error {
        background: #ef4444;
    }
    
    .toast-info {
        background: #3b82f6;
    }
    
    .toast-warning {
        background: #f59e0b;
    }
    
    @keyframes slideUp {
        from {
            opacity: 0;
            transform: translateX(-50%) translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }
    }
`;

document.head.appendChild(style);

// ============================================
// AUTO-INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('Payment module initialized');
    
    // Check URL for payment success/cancel
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment_status');
    
    if (paymentStatus === 'success') {
        paymentUI.showToast('Payment successful! Welcome to Premium! 🎉', 'success');
        paymentUI.renderSubscriptionStatus();
    } else if (paymentStatus === 'cancel') {
        paymentUI.showToast('Payment cancelled.', 'info');
    }
    
    // Debug mode
    if (window.location.hostname === 'localhost') {
        window.debugPayment = {
            subscription: subscriptionManager,
            config: PaymentConfig
        };
        console.log('Payment debug mode enabled');
    }
});
