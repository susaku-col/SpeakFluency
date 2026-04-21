// ============================================
// SpeakFlow Marketing Module
// Marketing Automation & Campaigns
// ============================================

// ============================================
// Marketing State Management
// ============================================

const MarketingState = {
    isInitialized: false,
    userId: null,
    userEmail: null,
    userName: null,
    userPreferences: {
        email: true,
        push: true,
        sms: false,
        marketing: true
    },
    campaigns: [],
    currentCampaigns: [],
    referralCode: null,
    referralStats: null,
    notifications: [],
    lastNotificationCheck: null
};

// ============================================
// Configuration
// ============================================

const MARKETING_CONFIG = {
    API_ENDPOINT: '/api/marketing',
    NEWSLETTER_ENDPOINT: '/api/marketing/subscribe',
    UNSUBSCRIBE_ENDPOINT: '/api/marketing/unsubscribe',
    REFERRAL_ENDPOINT: '/api/marketing/referral',
    CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
    PUSH_ENABLED: true
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
 * Get user email from auth
 */
const getUserEmail = () => {
    return auth?.user?.email || localStorage.getItem('user_email') || null;
};

/**
 * Get user name from auth
 */
const getUserName = () => {
    return auth?.user?.name || localStorage.getItem('user_name') || null;
};

/**
 * Show toast notification
 */
const showToast = (message, type = 'info', title = null) => {
    if (window.showToast) {
        window.showToast(message, type, title);
    } else {
        console.log(`[Marketing] ${type}: ${message}`);
    }
};

// ============================================
// Newsletter Subscription
// ============================================

/**
 * Subscribe to newsletter
 */
const subscribeToNewsletter = async (email, name = null, preferences = {}) => {
    try {
        const response = await fetch(MARKETING_CONFIG.NEWSLETTER_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email,
                name: name || getUserName(),
                preferences: {
                    newsletter: true,
                    tips: true,
                    offers: true,
                    productUpdates: true,
                    ...preferences
                }
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Successfully subscribed to newsletter!', 'success', 'Subscribed');
            localStorage.setItem('newsletter_subscribed', 'true');
            return { success: true };
        } else {
            if (data.code === 'ALREADY_SUBSCRIBED') {
                showToast('You are already subscribed to our newsletter.', 'info');
            } else {
                showToast(data.error || 'Failed to subscribe', 'error');
            }
            return { success: false, error: data.error };
        }
    } catch (error) {
        console.error('Newsletter subscription error:', error);
        showToast('Failed to subscribe. Please try again.', 'error');
        return { success: false, error: error.message };
    }
};

/**
 * Unsubscribe from newsletter
 */
const unsubscribeFromNewsletter = async (email) => {
    try {
        const response = await fetch(MARKETING_CONFIG.UNSUBSCRIBE_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Successfully unsubscribed from newsletter.', 'info', 'Unsubscribed');
            localStorage.removeItem('newsletter_subscribed');
            return { success: true };
        } else {
            showToast(data.error || 'Failed to unsubscribe', 'error');
            return { success: false, error: data.error };
        }
    } catch (error) {
        console.error('Newsletter unsubscribe error:', error);
        showToast('Failed to unsubscribe. Please try again.', 'error');
        return { success: false, error: error.message };
    }
};

/**
 * Update newsletter preferences
 */
const updateNewsletterPreferences = async (preferences) => {
    const email = getUserEmail();
    if (!email) {
        showToast('Please login to update preferences', 'warning');
        return { success: false };
    }
    
    try {
        const response = await fetch(`${MARKETING_CONFIG.API_ENDPOINT}/newsletter/preferences`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${auth?.token || ''}`
            },
            body: JSON.stringify({
                email,
                preferences
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            MarketingState.userPreferences = { ...MarketingState.userPreferences, ...preferences };
            localStorage.setItem('marketing_preferences', JSON.stringify(MarketingState.userPreferences));
            showToast('Preferences updated successfully!', 'success');
            return { success: true };
        } else {
            showToast(data.error || 'Failed to update preferences', 'error');
            return { success: false, error: data.error };
        }
    } catch (error) {
        console.error('Update preferences error:', error);
        showToast('Failed to update preferences', 'error');
        return { success: false, error: error.message };
    }
};

// ============================================
// Referral Program
// ============================================

/**
 * Create referral code
 */
const createReferralCode = async () => {
    if (!auth?.isAuthenticated) {
        showToast('Please login to create referral code', 'warning');
        return null;
    }
    
    try {
        const response = await fetch(`${MARKETING_CONFIG.REFERRAL_ENDPOINT}/create`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${auth.token}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            MarketingState.referralCode = data.data.referralCode;
            MarketingState.referralStats = data.data.stats;
            localStorage.setItem('referral_code', data.data.referralCode);
            localStorage.setItem('referral_stats', JSON.stringify(data.data.stats));
            
            if (data.data.isNew) {
                showToast('Your referral code has been created!', 'success', 'Referral Code Ready');
            }
            
            return data.data;
        } else {
            showToast(data.error || 'Failed to create referral code', 'error');
            return null;
        }
    } catch (error) {
        console.error('Create referral code error:', error);
        showToast('Failed to create referral code', 'error');
        return null;
    }
};

/**
 * Get referral stats
 */
const getReferralStats = async () => {
    if (!auth?.isAuthenticated) {
        return null;
    }
    
    // Check cache
    const cached = localStorage.getItem('referral_stats');
    const cachedTime = localStorage.getItem('referral_stats_time');
    if (cached && cachedTime && (Date.now() - parseInt(cachedTime)) < MARKETING_CONFIG.CACHE_DURATION) {
        return JSON.parse(cached);
    }
    
    try {
        const response = await fetch(`${MARKETING_CONFIG.REFERRAL_ENDPOINT}/stats`, {
            headers: {
                'Authorization': `Bearer ${auth.token}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            MarketingState.referralStats = data.data;
            localStorage.setItem('referral_stats', JSON.stringify(data.data));
            localStorage.setItem('referral_stats_time', Date.now().toString());
            return data.data;
        }
        return null;
    } catch (error) {
        console.error('Get referral stats error:', error);
        return null;
    }
};

/**
 * Use referral code
 */
const useReferralCode = async (code) => {
    if (!code) {
        showToast('Please enter a referral code', 'warning');
        return { success: false };
    }
    
    try {
        const response = await fetch(`${MARKETING_CONFIG.REFERRAL_ENDPOINT}/use`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${auth?.token || ''}`
            },
            body: JSON.stringify({ referralCode: code })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(data.message || 'Referral code applied successfully!', 'success');
            return { success: true, reward: data.data?.reward };
        } else {
            showToast(data.error || 'Invalid referral code', 'error');
            return { success: false, error: data.error };
        }
    } catch (error) {
        console.error('Use referral code error:', error);
        showToast('Failed to apply referral code', 'error');
        return { success: false, error: error.message };
    }
};

/**
 * Copy referral link to clipboard
 */
const copyReferralLink = () => {
    const link = MarketingState.referralCode 
        ? `${window.location.origin}/signup?ref=${MarketingState.referralCode}`
        : window.location.origin;
    
    navigator.clipboard.writeText(link).then(() => {
        showToast('Referral link copied to clipboard!', 'success', 'Link Copied');
    }).catch(() => {
        showToast('Failed to copy link', 'error');
    });
};

/**
 * Share referral link
 */
const shareReferralLink = async () => {
    const link = MarketingState.referralCode 
        ? `${window.location.origin}/signup?ref=${MarketingState.referralCode}`
        : window.location.origin;
    
    if (navigator.share) {
        try {
            await navigator.share({
                title: 'Join SpeakFlow',
                text: 'Learn English with AI-powered voice recognition!',
                url: link
            });
            showToast('Thanks for sharing!', 'success');
            
            // Track share event
            if (window.analytics) {
                analytics.trackShare('referral', MarketingState.referralCode, 'native');
            }
        } catch (error) {
            console.error('Share failed:', error);
        }
    } else {
        copyReferralLink();
    }
};

// ============================================
// Campaign Display
// ============================================

/**
 * Fetch active campaigns
 */
const fetchActiveCampaigns = async () => {
    try {
        const response = await fetch(`${MARKETING_CONFIG.API_ENDPOINT}/campaigns/active`, {
            headers: {
                'Authorization': `Bearer ${auth?.token || ''}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            MarketingState.currentCampaigns = data.data;
            return data.data;
        }
        return [];
    } catch (error) {
        console.error('Fetch campaigns error:', error);
        return [];
    }
};

/**
 * Display campaign banner
 */
const displayCampaignBanner = (campaign) => {
    const bannerContainer = document.getElementById('campaign-banner');
    if (!bannerContainer) return;
    
    const { content, type, ctaText, ctaUrl, backgroundColor, textColor } = campaign;
    
    bannerContainer.innerHTML = `
        <div class="campaign-banner" style="background-color: ${backgroundColor || '#4F46E5'}; color: ${textColor || 'white'};">
            <div class="campaign-content">
                <p>${content}</p>
                ${ctaText && ctaUrl ? `<a href="${ctaUrl}" class="campaign-cta">${ctaText} →</a>` : ''}
            </div>
            <button class="campaign-close" onclick="marketing.dismissCampaign('${campaign.id}')">&times;</button>
        </div>
    `;
    
    bannerContainer.style.display = 'block';
};

/**
 * Dismiss campaign
 */
const dismissCampaign = (campaignId) => {
    const bannerContainer = document.getElementById('campaign-banner');
    if (bannerContainer) {
        bannerContainer.style.display = 'none';
    }
    localStorage.setItem(`campaign_dismissed_${campaignId}`, Date.now().toString());
};

/**
 * Check if campaign was dismissed
 */
const isCampaignDismissed = (campaignId) => {
    const dismissed = localStorage.getItem(`campaign_dismissed_${campaignId}`);
    if (dismissed) {
        const dismissedTime = parseInt(dismissed);
        const oneDay = 24 * 60 * 60 * 1000;
        if (Date.now() - dismissedTime < oneDay) {
            return true;
        }
        localStorage.removeItem(`campaign_dismissed_${campaignId}`);
    }
    return false;
};

/**
 * Show exit intent popup
 */
const setupExitIntent = () => {
    let mouseLeaveCount = 0;
    let exitIntentShown = false;
    
    document.addEventListener('mouseleave', (e) => {
        if (e.clientY <= 0 && !exitIntentShown && !localStorage.getItem('exit_intent_shown')) {
            mouseLeaveCount++;
            if (mouseLeaveCount >= 1) {
                showExitIntentPopup();
                exitIntentShown = true;
                localStorage.setItem('exit_intent_shown', Date.now().toString());
            }
        }
    });
};

/**
 * Show exit intent popup
 */
const showExitIntentPopup = () => {
    const popup = document.createElement('div');
    popup.className = 'modal exit-intent-modal active';
    popup.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="modal-title">Wait! Don't Go! 🎁</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="exit-intent-content">
                    <div class="offer-icon">🎯</div>
                    <h4>Get 30% Off Your First Month!</h4>
                    <p>Subscribe to our newsletter and receive a special discount code for your first month of Pro.</p>
                    <form id="exit-intent-form" class="exit-intent-form">
                        <input type="email" placeholder="Your email address" required>
                        <button type="submit" class="btn btn-primary btn-block">Get Discount →</button>
                    </form>
                    <p class="small-text">No spam, unsubscribe anytime.</p>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(popup);
    
    const closeModal = () => {
        popup.classList.remove('active');
        setTimeout(() => popup.remove(), 300);
    };
    
    popup.querySelector('.modal-close').addEventListener('click', closeModal);
    
    const form = popup.querySelector('#exit-intent-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = form.querySelector('input[type="email"]').value;
        await subscribeToNewsletter(email, null, { offers: true });
        closeModal();
    });
};

// ============================================
// Push Notifications
// ============================================

/**
 * Request push notification permission
 */
const requestPushPermission = async () => {
    if (!('Notification' in window)) {
        console.log('Push notifications not supported');
        return false;
    }
    
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
        registerServiceWorker();
        showToast('Notifications enabled!', 'success');
        return true;
    }
    return false;
};

/**
 * Register service worker for push
 */
const registerServiceWorker = async () => {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(process.env.VAPID_PUBLIC_KEY)
            });
            
            await fetch('/api/notifications/subscribe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${auth?.token || ''}`
                },
                body: JSON.stringify(subscription)
            });
        } catch (error) {
            console.error('Service worker registration failed:', error);
        }
    }
};

/**
 * Convert base64 to Uint8Array
 */
const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
};

// ============================================
// Feedback Collection
// ============================================

/**
 * Show feedback modal
 */
const showFeedbackModal = () => {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="modal-title">We Value Your Feedback! 💬</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <form id="feedback-form">
                    <div class="form-group">
                        <label class="form-label">How would you rate your experience?</label>
                        <div class="rating-stars">
                            ${[1, 2, 3, 4, 5].map(star => `
                                <span class="star" data-rating="${star}">★</span>
                            `).join('')}
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">What do you like most?</label>
                        <textarea class="form-textarea" name="likes" rows="2" placeholder="Tell us what you enjoy..."></textarea>
                    </div>
                    <div class="form-group">
                        <label class="form-label">What could we improve?</label>
                        <textarea class="form-textarea" name="improvements" rows="2" placeholder="Share your suggestions..."></textarea>
                    </div>
                    <div class="form-group">
                        <label class="form-checkbox-label">
                            <input type="checkbox" name="allowContact"> Allow us to contact you about this feedback
                        </label>
                    </div>
                    <button type="submit" class="btn btn-primary btn-block">Submit Feedback</button>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    let selectedRating = 0;
    const stars = modal.querySelectorAll('.star');
    stars.forEach(star => {
        star.addEventListener('click', () => {
            selectedRating = parseInt(star.dataset.rating);
            stars.forEach((s, i) => {
                s.classList.toggle('active', i < selectedRating);
            });
        });
    });
    
    const closeModal = () => {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
    };
    
    modal.querySelector('.modal-close').addEventListener('click', closeModal);
    
    const form = modal.querySelector('#feedback-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const feedback = {
            rating: selectedRating,
            likes: form.querySelector('[name="likes"]').value,
            improvements: form.querySelector('[name="improvements"]').value,
            allowContact: form.querySelector('[name="allowContact"]').checked,
            userId: getUserId(),
            userEmail: getUserEmail(),
            url: window.location.href
        };
        
        await submitFeedback(feedback);
        closeModal();
        showToast('Thank you for your feedback!', 'success');
    });
};

/**
 * Submit feedback to server
 */
const submitFeedback = async (feedback) => {
    try {
        const response = await fetch('/api/feedback', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${auth?.token || ''}`
            },
            body: JSON.stringify(feedback)
        });
        
        const data = await response.json();
        
        if (data.success && window.analytics) {
            analytics.trackEvent('feedback_submitted', { rating: feedback.rating });
        }
    } catch (error) {
        console.error('Submit feedback error:', error);
    }
};

// ============================================
// User Preference Management
// ============================================

/**
 * Load user preferences
 */
const loadUserPreferences = () => {
    const saved = localStorage.getItem('marketing_preferences');
    if (saved) {
        try {
            MarketingState.userPreferences = JSON.parse(saved);
        } catch (e) {
            console.error('Error loading preferences:', e);
        }
    }
};

/**
 * Save user preferences
 */
const saveUserPreferences = () => {
    localStorage.setItem('marketing_preferences', JSON.stringify(MarketingState.userPreferences));
};

/**
 * Update email preference
 */
const setEmailPreference = (enabled) => {
    MarketingState.userPreferences.email = enabled;
    saveUserPreferences();
    updateNewsletterPreferences({ email: enabled });
};

/**
 * Update push preference
 */
const setPushPreference = (enabled) => {
    MarketingState.userPreferences.push = enabled;
    saveUserPreferences();
    
    if (enabled && MARKETING_CONFIG.PUSH_ENABLED) {
        requestPushPermission();
    }
};

// ============================================
// Initialization
// ============================================

/**
 * Initialize marketing module
 */
const initMarketing = async () => {
    if (MarketingState.isInitialized) return;
    
    console.log('Initializing marketing module...');
    
    // Set user data
    MarketingState.userId = getUserId();
    MarketingState.userEmail = getUserEmail();
    MarketingState.userName = getUserName();
    
    // Load preferences
    loadUserPreferences();
    
    // Load referral data if authenticated
    if (auth?.isAuthenticated) {
        const savedCode = localStorage.getItem('referral_code');
        if (savedCode) {
            MarketingState.referralCode = savedCode;
        } else {
            await createReferralCode();
        }
        await getReferralStats();
    }
    
    // Fetch active campaigns
    const campaigns = await fetchActiveCampaigns();
    
    // Show campaign banner if not dismissed
    for (const campaign of campaigns) {
        if (campaign.type === 'banner' && !isCampaignDismissed(campaign.id)) {
            displayCampaignBanner(campaign);
            break;
        }
    }
    
    // Setup exit intent
    setupExitIntent();
    
    // Show feedback modal after 5 visits
    const visitCount = parseInt(localStorage.getItem('visit_count') || '0') + 1;
    localStorage.setItem('visit_count', visitCount);
    if (visitCount === 5 && !localStorage.getItem('feedback_shown')) {
        setTimeout(() => {
            showFeedbackModal();
            localStorage.setItem('feedback_shown', 'true');
        }, 3000);
    }
    
    MarketingState.isInitialized = true;
    
    console.log('Marketing module initialized');
};

// ============================================
// Export Marketing Module
// ============================================

const marketing = {
    // State
    get isInitialized() { return MarketingState.isInitialized; },
    get referralCode() { return MarketingState.referralCode; },
    get referralStats() { return MarketingState.referralStats; },
    get preferences() { return MarketingState.userPreferences; },
    
    // Newsletter
    subscribe: subscribeToNewsletter,
    unsubscribe: unsubscribeFromNewsletter,
    updatePreferences: updateNewsletterPreferences,
    
    // Referral
    createReferralCode,
    getReferralStats,
    useReferralCode,
    copyReferralLink,
    shareReferralLink,
    
    // Campaigns
    fetchActiveCampaigns,
    dismissCampaign,
    
    // Notifications
    requestPushPermission,
    setPushPreference,
    setEmailPreference,
    
    // Feedback
    showFeedbackModal,
    submitFeedback,
    
    // Initialize
    init: initMarketing
};

// Make marketing globally available
window.marketing = marketing;

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMarketing);
} else {
    initMarketing();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = marketing;
}
