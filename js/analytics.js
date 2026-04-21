// ============================================
// SpeakFlow Analytics Module
// User Activity Tracking & Analytics
// ============================================

// ============================================
// Analytics State Management
// ============================================

const AnalyticsState = {
    isInitialized: false,
    sessionId: null,
    sessionStartTime: null,
    pageViewCount: 0,
    eventQueue: [],
    isSending: false,
    userId: null,
    userProperties: {},
    trackingEnabled: true,
    debugMode: false
};

// ============================================
// Configuration
// ============================================

const ANALYTICS_CONFIG = {
    API_ENDPOINT: '/api/analytics/track',
    BATCH_SIZE: 10,
    BATCH_INTERVAL: 5000, // 5 seconds
    MAX_QUEUE_SIZE: 100,
    SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes
    ENABLE_OUTBOUND_LINKS: true,
    ENABLE_FORM_TRACKING: true,
    ENABLE_ERROR_TRACKING: true,
    ENABLE_PERFORMANCE_TRACKING: true
};

// ============================================
// Event Types
// ============================================

const EVENT_TYPES = {
    // Page events
    PAGE_VIEW: 'page_view',
    PAGE_SCROLL: 'page_scroll',
    PAGE_EXIT: 'page_exit',
    
    // User events
    USER_LOGIN: 'user_login',
    USER_LOGOUT: 'user_logout',
    USER_SIGNUP: 'user_signup',
    USER_UPDATE: 'user_update',
    
    // Learning events
    LESSON_START: 'lesson_start',
    LESSON_COMPLETE: 'lesson_complete',
    LESSON_ABANDON: 'lesson_abandon',
    EXERCISE_SUBMIT: 'exercise_submit',
    PERFECT_SCORE: 'perfect_score',
    
    // Voice events
    RECORDING_START: 'recording_start',
    RECORDING_STOP: 'recording_stop',
    VOICE_ANALYSIS: 'voice_analysis',
    PRONUNCIATION_SCORE: 'pronunciation_score',
    
    // AI events
    AI_CHAT: 'ai_chat',
    AI_GRAMMAR_CHECK: 'ai_grammar_check',
    AI_TRANSLATION: 'ai_translation',
    
    // Engagement events
    FEATURE_USED: 'feature_used',
    CONTENT_SHARED: 'content_shared',
    SEARCH_PERFORMED: 'search_performed',
    FILTER_APPLIED: 'filter_applied',
    
    // Payment events
    SUBSCRIPTION_VIEW: 'subscription_view',
    SUBSCRIPTION_START: 'subscription_start',
    SUBSCRIPTION_CANCEL: 'subscription_cancel',
    PAYMENT_SUCCESS: 'payment_success',
    PAYMENT_FAIL: 'payment_fail',
    
    // Support events
    TICKET_CREATED: 'ticket_created',
    FEEDBACK_SUBMITTED: 'feedback_submitted',
    
    // System events
    ERROR_OCCURRED: 'error_occurred',
    PERFORMANCE_METRIC: 'performance_metric',
    OUTBOUND_CLICK: 'outbound_click'
};

// ============================================
// Helper Functions
// ============================================

/**
 * Generate unique session ID
 */
const generateSessionId = () => {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
};

/**
 * Get or create session ID
 */
const getSessionId = () => {
    let sessionId = sessionStorage.getItem('analytics_session_id');
    let sessionStart = sessionStorage.getItem('analytics_session_start');
    const now = Date.now();
    
    if (!sessionId || !sessionStart || (now - parseInt(sessionStart)) > ANALYTICS_CONFIG.SESSION_TIMEOUT) {
        sessionId = generateSessionId();
        sessionStart = now.toString();
        sessionStorage.setItem('analytics_session_id', sessionId);
        sessionStorage.setItem('analytics_session_start', sessionStart);
    }
    
    return sessionId;
};

/**
 * Get user ID from auth
 */
const getUserId = () => {
    return auth?.user?.id || localStorage.getItem('user_id') || null;
};

/**
 * Get user properties
 */
const getUserProperties = () => {
    const user = auth?.user;
    if (user) {
        return {
            user_id: user.id,
            user_email: user.email,
            user_name: user.name,
            user_role: user.role,
            user_level: user.stats?.level || 1,
            user_subscription: user.subscription?.plan || 'free'
        };
    }
    return {};
};

/**
 * Get page metadata
 */
const getPageMetadata = () => {
    return {
        url: window.location.href,
        path: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash,
        title: document.title,
        referrer: document.referrer,
        screen_width: window.screen.width,
        screen_height: window.screen.height,
        viewport_width: window.innerWidth,
        viewport_height: window.innerHeight
    };
};

/**
 * Get device info
 */
const getDeviceInfo = () => {
    const ua = navigator.userAgent;
    const isMobile = /Mobile|Android|iPhone|iPad|iPod/i.test(ua);
    const isTablet = /iPad|Android(?!.*Mobile)/i.test(ua);
    const isDesktop = !isMobile && !isTablet;
    
    let platform = 'unknown';
    if (/Windows/i.test(ua)) platform = 'windows';
    else if (/Mac/i.test(ua)) platform = 'mac';
    else if (/Linux/i.test(ua)) platform = 'linux';
    else if (/Android/i.test(ua)) platform = 'android';
    else if (/iPhone|iPad|iPod/i.test(ua)) platform = 'ios';
    
    let browser = 'unknown';
    if (/Chrome/i.test(ua) && !/Edge/i.test(ua)) browser = 'chrome';
    else if (/Firefox/i.test(ua)) browser = 'firefox';
    else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'safari';
    else if (/Edge/i.test(ua)) browser = 'edge';
    else if (/MSIE|Trident/i.test(ua)) browser = 'ie';
    
    return {
        device_type: isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop',
        platform: platform,
        browser: browser,
        browser_version: ua.match(/(Chrome|Firefox|Safari|Edge)\/(\d+)/)?.[2] || 'unknown',
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };
};

/**
 Get performance timing
 */
const getPerformanceTiming = () => {
    if (!window.performance || !window.performance.timing) return {};
    
    const timing = window.performance.timing;
    const navigationStart = timing.navigationStart;
    
    if (!navigationStart) return {};
    
    return {
        page_load_time: timing.loadEventEnd - navigationStart,
        dom_ready_time: timing.domContentLoadedEventEnd - navigationStart,
        response_time: timing.responseEnd - timing.requestStart,
        first_paint: performance.getEntriesByType('paint')?.find(p => p.name === 'first-paint')?.startTime || 0,
        first_contentful_paint: performance.getEntriesByType('paint')?.find(p => p.name === 'first-contentful-paint')?.startTime || 0
    };
};

// ============================================
// Event Tracking Core
// ============================================

/**
 * Add event to queue
 */
const addToQueue = (event) => {
    if (!AnalyticsState.trackingEnabled) return;
    
    AnalyticsState.eventQueue.push({
        ...event,
        timestamp: new Date().toISOString(),
        session_id: AnalyticsState.sessionId,
        user_id: getUserId(),
        user_properties: getUserProperties(),
        page_metadata: getPageMetadata(),
        device_info: getDeviceInfo()
    });
    
    // Trim queue if too large
    if (AnalyticsState.eventQueue.length > ANALYTICS_CONFIG.MAX_QUEUE_SIZE) {
        AnalyticsState.eventQueue = AnalyticsState.eventQueue.slice(-ANALYTICS_CONFIG.MAX_QUEUE_SIZE);
    }
    
    if (AnalyticsState.debugMode) {
        console.log('[Analytics] Event queued:', event);
    }
    
    // Send immediately if batch size reached
    if (AnalyticsState.eventQueue.length >= ANALYTICS_CONFIG.BATCH_SIZE) {
        sendEvents();
    }
};

/**
 * Send events to server
 */
const sendEvents = async () => {
    if (AnalyticsState.isSending || AnalyticsState.eventQueue.length === 0) return;
    
    AnalyticsState.isSending = true;
    const eventsToSend = [...AnalyticsState.eventQueue];
    AnalyticsState.eventQueue = [];
    
    try {
        const response = await fetch(ANALYTICS_CONFIG.API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${auth?.token || ''}`
            },
            body: JSON.stringify({
                events: eventsToSend,
                session_id: AnalyticsState.sessionId
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        if (AnalyticsState.debugMode) {
            console.log(`[Analytics] Sent ${eventsToSend.length} events`);
        }
    } catch (error) {
        console.error('[Analytics] Failed to send events:', error);
        // Re-queue events
        AnalyticsState.eventQueue = [...eventsToSend, ...AnalyticsState.eventQueue];
    } finally {
        AnalyticsState.isSending = false;
    }
};

/**
 * Track event
 */
const trackEvent = (eventType, properties = {}) => {
    addToQueue({
        event_type: eventType,
        properties: properties
    });
};

/**
 * Track page view
 */
const trackPageView = (pageName = null) => {
    AnalyticsState.pageViewCount++;
    trackEvent(EVENT_TYPES.PAGE_VIEW, {
        page_name: pageName || document.title,
        page_url: window.location.href,
        page_path: window.location.pathname,
        page_view_count: AnalyticsState.pageViewCount
    });
};

/**
 * Track user action
 */
const trackUserAction = (action, properties = {}) => {
    trackEvent(EVENT_TYPES.FEATURE_USED, {
        action: action,
        ...properties
    });
};

/**
 * Track error
 */
const trackError = (error, context = {}) => {
    trackEvent(EVENT_TYPES.ERROR_OCCURRED, {
        error_message: error.message,
        error_stack: error.stack,
        error_name: error.name,
        ...context
    });
};

/**
 * Track performance
 */
const trackPerformance = () => {
    if (!ANALYTICS_CONFIG.ENABLE_PERFORMANCE_TRACKING) return;
    
    const timing = getPerformanceTiming();
    if (Object.keys(timing).length > 0) {
        trackEvent(EVENT_TYPES.PERFORMANCE_METRIC, timing);
    }
};

// ============================================
// Specific Event Trackers
// ============================================

/**
 * Track lesson progress
 */
const trackLessonProgress = (lessonId, lessonTitle, progress, score = null) => {
    trackEvent(EVENT_TYPES.LESSON_COMPLETE, {
        lesson_id: lessonId,
        lesson_title: lessonTitle,
        progress: progress,
        score: score,
        duration: calculateLessonDuration(lessonId)
    });
};

/**
 * Track pronunciation score
 */
const trackPronunciationScore = (score, text, duration) => {
    trackEvent(EVENT_TYPES.PRONUNCIATION_SCORE, {
        score: score,
        text_length: text?.length || 0,
        duration: duration
    });
};

/**
 * Track AI interaction
 */
const trackAIInteraction = (type, inputLength, responseLength, duration) => {
    trackEvent(EVENT_TYPES.AI_CHAT, {
        ai_type: type,
        input_length: inputLength,
        response_length: responseLength,
        duration: duration
    });
};

/**
 * Track subscription event
 */
const trackSubscriptionEvent = (action, plan, amount = null) => {
    trackEvent(EVENT_TYPES.SUBSCRIPTION_START, {
        action: action,
        plan: plan,
        amount: amount
    });
};

/**
 * Track search
 */
const trackSearch = (query, resultCount) => {
    trackEvent(EVENT_TYPES.SEARCH_PERFORMED, {
        query: query,
        result_count: resultCount
    });
};

/**
 * Track content share
 */
const trackShare = (contentType, contentId, platform) => {
    trackEvent(EVENT_TYPES.CONTENT_SHARED, {
        content_type: contentType,
        content_id: contentId,
        platform: platform
    });
};

// ============================================
// Session Management
// ============================================

/**
 * Start session
 */
const startSession = () => {
    AnalyticsState.sessionId = getSessionId();
    AnalyticsState.sessionStartTime = Date.now();
    
    trackEvent(EVENT_TYPES.PAGE_VIEW, {
        event: 'session_start',
        session_id: AnalyticsState.sessionId
    });
    
    if (AnalyticsState.debugMode) {
        console.log('[Analytics] Session started:', AnalyticsState.sessionId);
    }
};

/**
 * End session
 */
const endSession = () => {
    const sessionDuration = Date.now() - AnalyticsState.sessionStartTime;
    trackEvent(EVENT_TYPES.PAGE_EXIT, {
        session_duration: sessionDuration,
        page_view_count: AnalyticsState.pageViewCount
    });
    
    sendEvents(); // Send remaining events
};

// ============================================
// User Properties
// ============================================

/**
 * Identify user
 */
const identifyUser = (userId, properties = {}) => {
    AnalyticsState.userId = userId;
    AnalyticsState.userProperties = properties;
    
    trackEvent(EVENT_TYPES.USER_LOGIN, {
        user_id: userId,
        ...properties
    });
};

/**
 * Update user properties
 */
const updateUserProperties = (properties) => {
    AnalyticsState.userProperties = { ...AnalyticsState.userProperties, ...properties };
    trackEvent(EVENT_TYPES.USER_UPDATE, properties);
};

// ============================================
// Auto-Tracking Setup
// ============================================

/**
 * Setup page view tracking
 */
const setupPageViewTracking = () => {
    // Track initial page view
    trackPageView();
    
    // Track navigation for SPA
    let lastUrl = window.location.href;
    const observer = new MutationObserver(() => {
        if (window.location.href !== lastUrl) {
            lastUrl = window.location.href;
            setTimeout(() => trackPageView(), 100);
        }
    });
    observer.observe(document.querySelector('body'), { childList: true, subtree: true });
    
    // Track before unload
    window.addEventListener('beforeunload', () => {
        endSession();
    });
};

/**
 * Setup click tracking
 */
const setupClickTracking = () => {
    document.addEventListener('click', (e) => {
        const target = e.target.closest('[data-track-click]');
        if (target) {
            const eventName = target.dataset.trackClick;
            const properties = {};
            
            // Get all data-track-* attributes
            for (const attr of target.attributes) {
                if (attr.name.startsWith('data-track-')) {
                    const key = attr.name.replace('data-track-', '');
                    properties[key] = attr.value;
                }
            }
            
            trackUserAction(eventName, properties);
        }
        
        // Track outbound links
        if (ANALYTICS_CONFIG.ENABLE_OUTBOUND_LINKS) {
            const link = e.target.closest('a');
            if (link && link.href && !link.href.startsWith(window.location.origin)) {
                trackEvent(EVENT_TYPES.OUTBOUND_CLICK, {
                    link_url: link.href,
                    link_text: link.innerText,
                    link_target: link.target
                });
            }
        }
    });
};

/**
 * Setup form tracking
 */
const setupFormTracking = () => {
    if (!ANALYTICS_CONFIG.ENABLE_FORM_TRACKING) return;
    
    document.addEventListener('submit', (e) => {
        const form = e.target;
        const formId = form.id || form.name;
        
        trackUserAction('form_submit', {
            form_id: formId,
            form_action: form.action,
            form_method: form.method
        });
    });
    
    // Track input focus
    document.addEventListener('focusin', (e) => {
        const input = e.target;
        if (input.matches('input, textarea, select')) {
            const form = input.closest('form');
            trackUserAction('input_focus', {
                input_name: input.name,
                input_type: input.type,
                form_id: form?.id || form?.name
            });
        }
    });
};

/**
 * Setup scroll tracking
 */
const setupScrollTracking = () => {
    let scrollTimeout;
    let maxScrollDepth = 0;
    
    window.addEventListener('scroll', () => {
        if (scrollTimeout) clearTimeout(scrollTimeout);
        
        scrollTimeout = setTimeout(() => {
            const scrollPercent = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
            
            if (scrollPercent > maxScrollDepth) {
                maxScrollDepth = scrollPercent;
                trackEvent(EVENT_TYPES.PAGE_SCROLL, {
                    scroll_depth: Math.round(maxScrollDepth)
                });
            }
        }, 500);
    });
};

/**
 * Setup error tracking
 */
const setupErrorTracking = () => {
    if (!ANALYTICS_CONFIG.ENABLE_ERROR_TRACKING) return;
    
    window.addEventListener('error', (e) => {
        trackError(e.error || new Error(e.message), {
            filename: e.filename,
            lineno: e.lineno,
            colno: e.colno
        });
    });
    
    window.addEventListener('unhandledrejection', (e) => {
        trackError(e.reason, {
            type: 'unhandled_rejection'
        });
    });
};

// ============================================
// Performance Tracking
// ============================================

/**
 * Track web vitals
 */
const trackWebVitals = () => {
    if ('web-vitals' in window) {
        import('web-vitals').then(({ getCLS, getFID, getLCP, getFCP, getTTFB }) => {
            getCLS((metric) => trackPerformanceMetric('CLS', metric.value));
            getFID((metric) => trackPerformanceMetric('FID', metric.value));
            getLCP((metric) => trackPerformanceMetric('LCP', metric.value));
            getFCP((metric) => trackPerformanceMetric('FCP', metric.value));
            getTTFB((metric) => trackPerformanceMetric('TTFB', metric.value));
        });
    }
};

/**
 * Track performance metric
 */
const trackPerformanceMetric = (name, value) => {
    trackEvent(EVENT_TYPES.PERFORMANCE_METRIC, {
        metric_name: name,
        metric_value: value
    });
};

// ============================================
// Helper Functions for Lesson Tracking
// ============================================

let lessonStartTimes = new Map();

/**
 * Start tracking lesson
 */
const startLessonTracking = (lessonId, lessonTitle) => {
    lessonStartTimes.set(lessonId, Date.now());
    trackEvent(EVENT_TYPES.LESSON_START, {
        lesson_id: lessonId,
        lesson_title: lessonTitle
    });
};

/**
 * Calculate lesson duration
 */
const calculateLessonDuration = (lessonId) => {
    const startTime = lessonStartTimes.get(lessonId);
    if (startTime) {
        const duration = Math.round((Date.now() - startTime) / 1000);
        lessonStartTimes.delete(lessonId);
        return duration;
    }
    return null;
};

/**
 * Track lesson abandonment
 */
const trackLessonAbandon = (lessonId, lessonTitle, progress) => {
    trackEvent(EVENT_TYPES.LESSON_ABANDON, {
        lesson_id: lessonId,
        lesson_title: lessonTitle,
        progress: progress,
        duration: calculateLessonDuration(lessonId)
    });
};

// ============================================
// Initialization
// ============================================

/**
 * Initialize analytics module
 */
const initAnalytics = () => {
    if (AnalyticsState.isInitialized) return;
    
    console.log('Initializing analytics module...');
    
    // Check if tracking is enabled
    AnalyticsState.trackingEnabled = localStorage.getItem('analytics_enabled') !== 'false';
    AnalyticsState.debugMode = localStorage.getItem('analytics_debug') === 'true';
    
    // Start session
    startSession();
    
    // Setup auto-tracking
    setupPageViewTracking();
    setupClickTracking();
    setupFormTracking();
    setupScrollTracking();
    setupErrorTracking();
    
    // Track performance after page load
    window.addEventListener('load', () => {
        trackPerformance();
        trackWebVitals();
    });
    
    // Send events periodically
    setInterval(() => {
        if (AnalyticsState.eventQueue.length > 0) {
            sendEvents();
        }
    }, ANALYTICS_CONFIG.BATCH_INTERVAL);
    
    AnalyticsState.isInitialized = true;
    
    console.log('Analytics module initialized');
};

/**
 * Enable/disable tracking
 */
const setTrackingEnabled = (enabled) => {
    AnalyticsState.trackingEnabled = enabled;
    localStorage.setItem('analytics_enabled', enabled);
    
    if (!enabled) {
        AnalyticsState.eventQueue = [];
    }
    
    trackUserAction('tracking_' + (enabled ? 'enabled' : 'disabled'));
};

/**
 * Enable debug mode
 */
const setDebugMode = (enabled) => {
    AnalyticsState.debugMode = enabled;
    localStorage.setItem('analytics_debug', enabled);
};

// ============================================
// Export Analytics Module
// ============================================

const analytics = {
    // State
    get isEnabled() { return AnalyticsState.trackingEnabled; },
    get sessionId() { return AnalyticsState.sessionId; },
    
    // Core
    trackEvent,
    trackPageView,
    trackUserAction,
    trackError,
    
    // Learning
    trackLessonProgress,
    trackLessonAbandon,
    startLessonTracking,
    trackPronunciationScore,
    
    // AI
    trackAIInteraction,
    
    // Business
    trackSubscriptionEvent,
    trackSearch,
    trackShare,
    
    // User
    identifyUser,
    updateUserProperties,
    
    // Settings
    setTrackingEnabled,
    setDebugMode,
    
    // Initialize
    init: initAnalytics
};

// Make analytics globally available
window.analytics = analytics;

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAnalytics);
} else {
    initAnalytics();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = analytics;
}
