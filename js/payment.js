// ============================================
// SpeakFlow Payment Module
// Subscription & Payment Management
// ============================================

// ============================================
// Payment State Management
// ============================================

const PaymentState = {
    isInitialized: false,
    userId: null,
    currentSubscription: null,
    plans: [],
    paymentMethods: [],
    invoices: [],
    selectedPlan: null,
    coupon: null,
    isProcessing: false,
    stripe: null,
    cardElement: null
};

// ============================================
// Configuration
// ============================================

const PAYMENT_CONFIG = {
    API_ENDPOINT: '/api/payments',
    STRIPE_PUBLIC_KEY: process.env.STRIPE_PUBLIC_KEY || '',
    CURRENCY: 'usd',
    SUPPORTED_CURRENCIES: ['usd', 'eur', 'gbp'],
    TAX_RATE: 0.0
};

// ============================================
// Subscription Plans
// ============================================

const SUBSCRIPTION_PLANS = {
    free: {
        id: 'free',
        name: 'Free',
        price: 0,
        interval: 'forever',
        features: [
            '3 lessons per day',
            'Basic pronunciation feedback',
            '500+ vocabulary words',
            'Community access'
        ],
        limits: {
            dailyLessons: 3,
            vocabularyWords: 500
        }
    },
    pro_monthly: {
        id: 'pro_monthly',
        name: 'Pro Monthly',
        price: 12.99,
        interval: 'month',
        stripePriceId: 'price_pro_monthly',
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
    pro_yearly: {
        id: 'pro_yearly',
        name: 'Pro Yearly',
        price: 99.99,
        interval: 'year',
        stripePriceId: 'price_pro_yearly',
        features: [
            'All Pro features',
            'Save 36% compared to monthly',
            '2 months free'
        ],
        trialDays: 7,
        savings: 36
    },
    family_monthly: {
        id: 'family_monthly',
        name: 'Family Monthly',
        price: 24.99,
        interval: 'month',
        stripePriceId: 'price_family_monthly',
        features: [
            'Up to 5 family members',
            'All Pro features',
            'Family progress tracking',
            'Group practice sessions'
        ],
        trialDays: 7
    },
    family_yearly: {
        id: 'family_yearly',
        name: 'Family Yearly',
        price: 199.99,
        interval: 'year',
        stripePriceId: 'price_family_yearly',
        features: [
            'All Family features',
            'Save 33% compared to monthly',
            '3 months free'
        ],
        trialDays: 7,
        savings: 33
    }
};

// ============================================
// Helper Functions
// ============================================

/**
 * Get user ID from auth
 */
const getUserId = () => {
    return auth?.user?.id || localStorage.getItem('user_id') || null;
};

/**
 * Show toast notification
 */
const showToast = (message, type = 'info', title = null) => {
    if (window.showToast) {
        window.showToast(message, type, title);
    } else {
        console.log(`[Payment] ${type}: ${message}`);
    }
};

/**
 * Format currency
 */
const formatCurrency = (amount, currency = PAYMENT_CONFIG.CURRENCY) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency.toUpperCase()
    }).format(amount);
};

/**
 * Format date
 */
const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
};

// ============================================
// API Calls
// ============================================

/**
 * Fetch subscription plans
 */
const fetchPlans = async () => {
    try {
        const response = await fetch(`${PAYMENT_CONFIG.API_ENDPOINT}/plans`);
        const data = await response.json();
        
        if (data.success) {
            PaymentState.plans = data.data.plans;
            return PaymentState.plans;
        }
        return [];
    } catch (error) {
        console.error('Fetch plans error:', error);
        // Fallback to local plans
        PaymentState.plans = Object.values(SUBSCRIPTION_PLANS);
        return PaymentState.plans;
    }
};

/**
 * Fetch current subscription
 */
const fetchCurrentSubscription = async () => {
    try {
        const response = await fetch(`${PAYMENT_CONFIG.API_ENDPOINT}/current-subscription`, {
            headers: {
                'Authorization': `Bearer ${auth?.token || ''}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            PaymentState.currentSubscription = data.data;
            return data.data;
        }
        return null;
    } catch (error) {
        console.error('Fetch subscription error:', error);
        return null;
    }
};

/**
 * Create subscription
 */
const createSubscription = async (planId, paymentMethodId, couponCode = null) => {
    PaymentState.isProcessing = true;
    showLoading();
    
    try {
        const response = await fetch(`${PAYMENT_CONFIG.API_ENDPOINT}/create-subscription`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${auth?.token || ''}`
            },
            body: JSON.stringify({
                planId,
                paymentMethodId,
                couponCode
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            PaymentState.currentSubscription = data.data.subscription;
            showToast('Subscription created successfully!', 'success', 'Welcome to Pro! 🎉');
            
            // Refresh subscription display
            renderSubscriptionDetails();
            
            return data.data;
        } else {
            showToast(data.error || 'Failed to create subscription', 'error');
            return null;
        }
    } catch (error) {
        console.error('Create subscription error:', error);
        showToast('Failed to create subscription', 'error');
        return null;
    } finally {
        PaymentState.isProcessing = false;
        hideLoading();
    }
};

/**
 * Cancel subscription
 */
const cancelSubscription = async (cancelImmediately = false, reason = '') => {
    PaymentState.isProcessing = true;
    showLoading();
    
    try {
        const response = await fetch(`${PAYMENT_CONFIG.API_ENDPOINT}/cancel-subscription`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${auth?.token || ''}`
            },
            body: JSON.stringify({
                cancelImmediately,
                reason
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            PaymentState.currentSubscription = data.data;
            showToast('Subscription cancelled successfully', 'info');
            renderSubscriptionDetails();
            return data.data;
        } else {
            showToast(data.error || 'Failed to cancel subscription', 'error');
            return null;
        }
    } catch (error) {
        console.error('Cancel subscription error:', error);
        showToast('Failed to cancel subscription', 'error');
        return null;
    } finally {
        PaymentState.isProcessing = false;
        hideLoading();
    }
};

/**
 * Resume subscription
 */
const resumeSubscription = async () => {
    PaymentState.isProcessing = true;
    showLoading();
    
    try {
        const response = await fetch(`${PAYMENT_CONFIG.API_ENDPOINT}/resume-subscription`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${auth?.token || ''}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            PaymentState.currentSubscription = data.data;
            showToast('Subscription resumed!', 'success');
            renderSubscriptionDetails();
            return data.data;
        } else {
            showToast(data.error || 'Failed to resume subscription', 'error');
            return null;
        }
    } catch (error) {
        console.error('Resume subscription error:', error);
        showToast('Failed to resume subscription', 'error');
        return null;
    } finally {
        PaymentState.isProcessing = false;
        hideLoading();
    }
};

/**
 * Fetch payment methods
 */
const fetchPaymentMethods = async () => {
    try {
        const response = await fetch(`${PAYMENT_CONFIG.API_ENDPOINT}/payment-methods`, {
            headers: {
                'Authorization': `Bearer ${auth?.token || ''}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            PaymentState.paymentMethods = data.data;
            return data.data;
        }
        return [];
    } catch (error) {
        console.error('Fetch payment methods error:', error);
        return [];
    }
};

/**
 * Fetch invoices
 */
const fetchInvoices = async () => {
    try {
        const response = await fetch(`${PAYMENT_CONFIG.API_ENDPOINT}/invoices`, {
            headers: {
                'Authorization': `Bearer ${auth?.token || ''}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            PaymentState.invoices = data.data;
            return data.data;
        }
        return [];
    } catch (error) {
        console.error('Fetch invoices error:', error);
        return [];
    }
};

/**
 * Validate coupon
 */
const validateCoupon = async (couponCode, planId) => {
    try {
        const response = await fetch(`${PAYMENT_CONFIG.API_ENDPOINT}/validate-coupon`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ couponCode, planId })
        });
        
        const data = await response.json();
        
        if (data.success) {
            PaymentState.coupon = data.data;
            return data.data;
        }
        return null;
    } catch (error) {
        console.error('Validate coupon error:', error);
        return null;
    }
};

// ============================================
// Stripe Integration
// ============================================

/**
 * Initialize Stripe
 */
const initStripe = async () => {
    if (!window.Stripe) {
        console.error('Stripe.js not loaded');
        return false;
    }
    
    try {
        PaymentState.stripe = Stripe(PAYMENT_CONFIG.STRIPE_PUBLIC_KEY);
        
        // Create card element
        const elements = PaymentState.stripe.elements();
        PaymentState.cardElement = elements.create('card', {
            style: {
                base: {
                    fontSize: '16px',
                    color: '#32325d',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    '::placeholder': {
                        color: '#aab7c4'
                    }
                },
                invalid: {
                    color: '#fa755a',
                    iconColor: '#fa755a'
                }
            }
        });
        
        return true;
    } catch (error) {
        console.error('Stripe initialization error:', error);
        return false;
    }
};

/**
 * Mount card element
 */
const mountCardElement = (elementId) => {
    if (PaymentState.cardElement && document.getElementById(elementId)) {
        PaymentState.cardElement.mount(`#${elementId}`);
        
        // Handle validation errors
        PaymentState.cardElement.on('change', (event) => {
            const displayError = document.getElementById('card-errors');
            if (displayError) {
                displayError.textContent = event.error ? event.error.message : '';
            }
        });
    }
};

/**
 * Create payment method from card
 */
const createPaymentMethod = async () => {
    if (!PaymentState.stripe || !PaymentState.cardElement) {
        showToast('Payment system not ready', 'error');
        return null;
    }
    
    try {
        const { paymentMethod, error } = await PaymentState.stripe.createPaymentMethod({
            type: 'card',
            card: PaymentState.cardElement
        });
        
        if (error) {
            showToast(error.message, 'error');
            return null;
        }
        
        return paymentMethod;
    } catch (error) {
        console.error('Create payment method error:', error);
        return null;
    }
};

// ============================================
// UI Rendering
// ============================================

/**
 * Render pricing plans
 */
const renderPricingPlans = () => {
    const container = document.getElementById('pricing-plans');
    if (!container) return;
    
    container.innerHTML = `
        <div class="pricing-grid">
            ${PaymentState.plans.map(plan => `
                <div class="pricing-card ${plan.id === 'pro_monthly' ? 'popular' : ''}">
                    ${plan.id === 'pro_monthly' ? '<div class="popular-badge">Most Popular</div>' : ''}
                    <div class="pricing-header">
                        <h3>${plan.name}</h3>
                        <div class="pricing-price">
                            <span class="currency">$</span>
                            <span class="amount">${plan.price}</span>
                            <span class="period">/${plan.interval}</span>
                        </div>
                        ${plan.savings ? `<div class="savings-badge">Save ${plan.savings}%</div>` : ''}
                    </div>
                    <ul class="pricing-features">
                        ${plan.features.map(feature => `<li>✓ ${feature}</li>`).join('')}
                    </ul>
                    <button class="btn ${plan.price === 0 ? 'btn-outline' : 'btn-primary'} btn-block" 
                            onclick="payment.selectPlan('${plan.id}')">
                        ${plan.price === 0 ? 'Current Plan' : 'Get Started'}
                    </button>
                </div>
            `).join('')}
        </div>
    `;
};

/**
 * Render subscription details
 */
const renderSubscriptionDetails = () => {
    const container = document.getElementById('subscription-details');
    if (!container || !PaymentState.currentSubscription) return;
    
    const sub = PaymentState.currentSubscription;
    const plan = SUBSCRIPTION_PLANS[sub.plan] || { name: sub.plan };
    
    container.innerHTML = `
        <div class="subscription-card">
            <div class="subscription-header">
                <h3>${plan.name} Plan</h3>
                <span class="subscription-status status-${sub.status}">${sub.status}</span>
            </div>
            <div class="subscription-details">
                <div class="detail-row">
                    <span>Started:</span>
                    <span>${formatDate(sub.startDate)}</span>
                </div>
                ${sub.endDate ? `
                    <div class="detail-row">
                        <span>Next Billing:</span>
                        <span>${formatDate(sub.endDate)}</span>
                    </div>
                ` : ''}
                <div class="detail-row">
                    <span>Auto-renew:</span>
                    <span>${sub.autoRenew ? 'Yes' : 'No'}</span>
                </div>
            </div>
            <div class="subscription-actions">
                ${sub.plan !== 'free' ? `
                    ${sub.cancelAtPeriodEnd ? 
                        `<button class="btn btn-success" onclick="payment.resumeSubscription()">Resume Subscription</button>` :
                        `<button class="btn btn-danger" onclick="payment.showCancelModal()">Cancel Subscription</button>`
                    }
                ` : ''}
            </div>
        </div>
    `;
};

/**
 * Render payment methods
 */
const renderPaymentMethods = () => {
    const container = document.getElementById('payment-methods');
    if (!container) return;
    
    if (PaymentState.paymentMethods.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>No payment methods added.</p>
                <button class="btn btn-primary" onclick="payment.showAddPaymentMethodModal()">Add Payment Method</button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <div class="payment-methods-list">
            ${PaymentState.paymentMethods.map(method => `
                <div class="payment-method-item">
                    <div class="method-info">
                        <span class="method-icon">${getCardIcon(method.brand)}</span>
                        <span class="method-details">
                            ${method.brand} •••• ${method.last4}
                        </span>
                        <span class="method-expiry">Expires ${method.expMonth}/${method.expYear}</span>
                        ${method.isDefault ? '<span class="default-badge">Default</span>' : ''}
                    </div>
                    <div class="method-actions">
                        <button class="btn-icon" onclick="payment.setDefaultPaymentMethod('${method.id}')">⭐</button>
                        <button class="btn-icon delete" onclick="payment.deletePaymentMethod('${method.id}')">🗑️</button>
                    </div>
                </div>
            `).join('')}
        </div>
        <button class="btn btn-outline" onclick="payment.showAddPaymentMethodModal()">+ Add New Card</button>
    `;
};

/**
 * Get card icon
 */
const getCardIcon = (brand) => {
    const icons = {
        visa: '💳',
        mastercard: '💳',
        amex: '💳',
        discover: '💳',
        default: '💳'
    };
    return icons[brand] || icons.default;
};

/**
 * Render invoices
 */
const renderInvoices = () => {
    const container = document.getElementById('invoices-list');
    if (!container) return;
    
    if (PaymentState.invoices.length === 0) {
        container.innerHTML = '<p class="empty-state">No invoices yet.</p>';
        return;
    }
    
    container.innerHTML = `
        <table class="invoices-table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                ${PaymentState.invoices.map(invoice => `
                    <tr>
                        <td>${formatDate(invoice.createdAt)}</td>
                        <td>${invoice.description}</td>
                        <td>${formatCurrency(invoice.amount)}</td>
                        <td><span class="status-badge status-${invoice.status}">${invoice.status}</span></td>
                        <td><a href="${invoice.url}" target="_blank" class="btn-link">View</a></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
};

/**
 * Show checkout modal
 */
const showCheckoutModal = (planId) => {
    const plan = SUBSCRIPTION_PLANS[planId];
    PaymentState.selectedPlan = plan;
    
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="modal-title">Subscribe to ${plan.name}</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="checkout-summary">
                    <div class="plan-details">
                        <span class="plan-name">${plan.name}</span>
                        <span class="plan-price">${formatCurrency(plan.price)}/${plan.interval}</span>
                    </div>
                    ${plan.trialDays ? `<div class="trial-info">✨ ${plan.trialDays}-day free trial included</div>` : ''}
                </div>
                
                <div class="payment-section">
                    <h4>Payment Method</h4>
                    <div id="card-element" class="card-element"></div>
                    <div id="card-errors" class="card-errors" role="alert"></div>
                </div>
                
                <div class="coupon-section">
                    <div class="coupon-input">
                        <input type="text" id="coupon-code" class="form-input" placeholder="Coupon code">
                        <button class="btn btn-outline" onclick="payment.applyCoupon()">Apply</button>
                    </div>
                    <div id="coupon-feedback" class="coupon-feedback"></div>
                </div>
                
                <div class="payment-summary">
                    <div class="summary-row">
                        <span>Subtotal:</span>
                        <span id="subtotal">${formatCurrency(plan.price)}</span>
                    </div>
                    <div class="summary-row discount" id="discount-row" style="display: none;">
                        <span>Discount:</span>
                        <span id="discount-amount">-${formatCurrency(0)}</span>
                    </div>
                    <div class="summary-row total">
                        <span>Total:</span>
                        <span id="total-amount">${formatCurrency(plan.price)}</span>
                    </div>
                </div>
                
                <button class="btn btn-primary btn-block" id="confirm-payment" onclick="payment.confirmPayment()">
                    ${plan.price === 0 ? 'Subscribe Free' : `Pay ${formatCurrency(plan.price)}`}
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Mount Stripe card element
    mountCardElement('card-element');
    
    const closeModal = () => {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
    };
    
    modal.querySelector('.modal-close').addEventListener('click', closeModal);
};

/**
 * Show cancel subscription modal
 */
const showCancelModal = () => {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="modal-title">Cancel Subscription</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <p>Are you sure you want to cancel your subscription?</p>
                <p>You will lose access to premium features at the end of your billing period.</p>
                <div class="form-group">
                    <label class="form-label">Reason (optional)</label>
                    <select id="cancel-reason" class="form-select">
                        <option value="">Select a reason...</option>
                        <option value="too_expensive">Too expensive</option>
                        <option value="not_using">Not using enough</option>
                        <option value="technical_issues">Technical issues</option>
                        <option value="found_alternative">Found alternative</option>
                        <option value="other">Other</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-checkbox-label">
                        <input type="checkbox" id="cancel-immediately"> Cancel immediately (no refund)
                    </label>
                </div>
                <div class="modal-buttons">
                    <button class="btn btn-outline" onclick="this.closest('.modal').remove()">Keep Subscription</button>
                    <button class="btn btn-danger" onclick="payment.confirmCancel()">Yes, Cancel</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    window.pendingCancelModal = modal;
    
    const closeModal = () => {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
    };
    
    modal.querySelector('.modal-close').addEventListener('click', closeModal);
};

/**
 * Show add payment method modal
 */
const showAddPaymentMethodModal = () => {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="modal-title">Add Payment Method</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div id="new-card-element" class="card-element"></div>
                <div id="new-card-errors" class="card-errors"></div>
                <button class="btn btn-primary btn-block" onclick="payment.savePaymentMethod()">Add Card</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Create new card element for this modal
    const elements = PaymentState.stripe.elements();
    const newCardElement = elements.create('card', {
        style: {
            base: {
                fontSize: '16px',
                color: '#32325d',
                '::placeholder': { color: '#aab7c4' }
            }
        }
    });
    newCardElement.mount('#new-card-element');
    
    window.tempCardElement = newCardElement;
    
    const closeModal = () => {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
        if (window.tempCardElement) {
            window.tempCardElement.unmount();
            window.tempCardElement = null;
        }
    };
    
    modal.querySelector('.modal-close').addEventListener('click', closeModal);
};

// ============================================
// Payment Actions
// ============================================

/**
 * Select subscription plan
 */
const selectPlan = (planId) => {
    if (planId === 'free') {
        createSubscription('free', null);
    } else {
        showCheckoutModal(planId);
    }
};

/**
 * Apply coupon code
 */
const applyCoupon = async () => {
    const couponInput = document.getElementById('coupon-code');
    const couponCode = couponInput?.value;
    
    if (!couponCode) {
        showToast('Please enter a coupon code', 'warning');
        return;
    }
    
    const result = await validateCoupon(couponCode, PaymentState.selectedPlan?.id);
    
    if (result) {
        const discountRow = document.getElementById('discount-row');
        const discountAmount = document.getElementById('discount-amount');
        const totalAmount = document.getElementById('total-amount');
        
        if (discountRow && discountAmount && totalAmount) {
            discountRow.style.display = 'flex';
            discountAmount.textContent = `-${formatCurrency(result.discountAmount)}`;
            totalAmount.textContent = formatCurrency(result.amount);
        }
        
        const feedback = document.getElementById('coupon-feedback');
        if (feedback) {
            feedback.innerHTML = `<span class="success">✓ Coupon applied! ${result.description}</span>`;
        }
        
        showToast('Coupon applied successfully!', 'success');
    } else {
        const feedback = document.getElementById('coupon-feedback');
        if (feedback) {
            feedback.innerHTML = '<span class="error">✗ Invalid or expired coupon code</span>';
        }
    }
};

/**
 * Confirm payment
 */
const confirmPayment = async () => {
    const plan = PaymentState.selectedPlan;
    if (!plan) return;
    
    const paymentMethod = await createPaymentMethod();
    if (!paymentMethod) return;
    
    const couponInput = document.getElementById('coupon-code');
    const couponCode = couponInput?.value;
    
    await createSubscription(plan.id, paymentMethod.id, couponCode);
    
    // Close modal
    const modal = document.querySelector('.modal.active');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
    }
};

/**
 * Confirm cancellation
 */
const confirmCancel = async () => {
    const cancelImmediately = document.getElementById('cancel-immediately')?.checked || false;
    const reasonSelect = document.getElementById('cancel-reason');
    const reason = reasonSelect?.value || '';
    
    await cancelSubscription(cancelImmediately, reason);
    
    if (window.pendingCancelModal) {
        window.pendingCancelModal.classList.remove('active');
        setTimeout(() => window.pendingCancelModal.remove(), 300);
        window.pendingCancelModal = null;
    }
};

/**
 * Save payment method
 */
const savePaymentMethod = async () => {
    if (!window.tempCardElement) return;
    
    const { paymentMethod, error } = await PaymentState.stripe.createPaymentMethod({
        type: 'card',
        card: window.tempCardElement
    });
    
    if (error) {
        showToast(error.message, 'error');
        return;
    }
    
    // Save to backend
    try {
        const response = await fetch(`${PAYMENT_CONFIG.API_ENDPOINT}/update-payment-method`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${auth?.token || ''}`
            },
            body: JSON.stringify({ paymentMethodId: paymentMethod.id })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Payment method added successfully!', 'success');
            await fetchPaymentMethods();
            renderPaymentMethods();
            
            // Close modal
            const modal = document.querySelector('.modal.active');
            if (modal) {
                modal.classList.remove('active');
                setTimeout(() => modal.remove(), 300);
            }
        }
    } catch (error) {
        console.error('Save payment method error:', error);
        showToast('Failed to save payment method', 'error');
    }
};

/**
 * Set default payment method
 */
const setDefaultPaymentMethod = async (paymentMethodId) => {
    try {
        const response = await fetch(`${PAYMENT_CONFIG.API_ENDPOINT}/set-default-payment-method`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${auth?.token || ''}`
            },
            body: JSON.stringify({ paymentMethodId })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Default payment method updated', 'success');
            await fetchPaymentMethods();
            renderPaymentMethods();
        }
    } catch (error) {
        console.error('Set default payment method error:', error);
        showToast('Failed to update default payment method', 'error');
    }
};

/**
 * Delete payment method
 */
const deletePaymentMethod = async (paymentMethodId) => {
    if (!confirm('Are you sure you want to remove this payment method?')) return;
    
    try {
        const response = await fetch(`${PAYMENT_CONFIG.API_ENDPOINT}/payment-methods/${paymentMethodId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${auth?.token || ''}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Payment method removed', 'info');
            await fetchPaymentMethods();
            renderPaymentMethods();
        }
    } catch (error) {
        console.error('Delete payment method error:', error);
        showToast('Failed to remove payment method', 'error');
    }
};

// ============================================
// Loading Helpers
// ============================================

let loadingOverlay = null;

/**
 * Show loading overlay
 */
const showLoading = () => {
    if (!loadingOverlay) {
        loadingOverlay = document.createElement('div');
        loadingOverlay.className = 'loading-overlay';
        loadingOverlay.innerHTML = '<div class="loading-spinner"></div><p>Processing...</p>';
        document.body.appendChild(loadingOverlay);
    }
    loadingOverlay.classList.add('active');
};

/**
 * Hide loading overlay
 */
const hideLoading = () => {
    if (loadingOverlay) {
        loadingOverlay.classList.remove('active');
    }
};

// ============================================
// Billing Dashboard
// ============================================

/**
 * Render billing dashboard
 */
const renderBillingDashboard = () => {
    const container = document.getElementById('billing-dashboard');
    if (!container) return;
    
    container.innerHTML = `
        <div class="billing-container">
            <div class="billing-header">
                <h2>Billing & Subscription</h2>
                <p>Manage your subscription and payment methods</p>
            </div>
            
            <div class="subscription-section">
                <h3>Current Plan</h3>
                <div id="subscription-details"></div>
            </div>
            
            <div class="payment-methods-section">
                <h3>Payment Methods</h3>
                <div id="payment-methods"></div>
            </div>
            
            <div class="billing-history-section">
                <h3>Billing History</h3>
                <div id="invoices-list"></div>
            </div>
        </div>
    `;
    
    renderSubscriptionDetails();
    renderPaymentMethods();
    renderInvoices();
};

// ============================================
// Initialization
// ============================================

/**
 * Initialize payment module
 */
const initPayment = async () => {
    if (PaymentState.isInitialized) return;
    
    console.log('Initializing payment module...');
    
    PaymentState.userId = getUserId();
    
    // Fetch data
    await fetchPlans();
    
    if (auth?.isAuthenticated) {
        await fetchCurrentSubscription();
        await fetchPaymentMethods();
        await fetchInvoices();
    }
    
    // Initialize Stripe
    if (PAYMENT_CONFIG.STRIPE_PUBLIC_KEY) {
        await initStripe();
    }
    
    // Render pricing plans if on pricing page
    if (document.getElementById('pricing-plans')) {
        renderPricingPlans();
    }
    
    // Render billing dashboard if on billing page
    if (document.getElementById('billing-dashboard')) {
        renderBillingDashboard();
    }
    
    PaymentState.isInitialized = true;
    
    console.log('Payment module initialized');
};

// ============================================
// Export Payment Module
// ============================================

const payment = {
    // State
    get isInitialized() { return PaymentState.isInitialized; },
    get currentSubscription() { return PaymentState.currentSubscription; },
    get plans() { return PaymentState.plans; },
    
    // Subscription methods
    selectPlan,
    createSubscription,
    cancelSubscription,
    resumeSubscription,
    
    // Payment methods
    fetchPaymentMethods,
    setDefaultPaymentMethod,
    deletePaymentMethod,
    showAddPaymentMethodModal,
    savePaymentMethod,
    
    // Checkout
    showCheckoutModal,
    applyCoupon,
    confirmPayment,
    showCancelModal,
    confirmCancel,
    
    // UI
    renderPricingPlans,
    renderBillingDashboard,
    
    // Initialize
    init: initPayment
};

// Make payment globally available
window.payment = payment;

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPayment);
} else {
    initPayment();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = payment;
}
