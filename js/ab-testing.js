// ============================================
// SpeakFlow A/B Testing Module
// A/B Test Management & Experimentation
// ============================================

// ============================================
// A/B Testing State Management
// ============================================

const ABTestState = {
    isInitialized: false,
    activeTests: [],
    testVariants: new Map(),
    testEvents: [],
    eventQueue: [],
    isSending: false,
    debugMode: false,
    userId: null,
    sessionId: null
};

// ============================================
// Configuration
// ============================================

const ABTEST_CONFIG = {
    API_ENDPOINT: '/api/ab-test',
    EVENT_ENDPOINT: '/api/ab-test/track',
    BATCH_SIZE: 20,
    BATCH_INTERVAL: 3000,
    CACHE_DURATION: 30 * 60 * 1000, // 30 minutes
    LOCAL_STORAGE_KEY: 'ab_test_assignments'
};

// ============================================
// Helper Functions
// ============================================

/**
 * Generate unique user ID
 */
const getUserId = () => {
    let userId = localStorage.getItem('ab_test_user_id');
    if (!userId) {
        userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem('ab_test_user_id', userId);
    }
    return userId;
};

/**
 * Generate session ID
 */
const getSessionId = () => {
    let sessionId = sessionStorage.getItem('ab_test_session_id');
    if (!sessionId) {
        sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        sessionStorage.setItem('ab_test_session_id', sessionId);
    }
    return sessionId;
};

/**
 * Save test assignment to localStorage
 */
const saveAssignment = (testId, variantId) => {
    const assignments = JSON.parse(localStorage.getItem(ABTEST_CONFIG.LOCAL_STORAGE_KEY) || '{}');
    assignments[testId] = {
        variantId,
        assignedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + ABTEST_CONFIG.CACHE_DURATION).toISOString()
    };
    localStorage.setItem(ABTEST_CONFIG.LOCAL_STORAGE_KEY, JSON.stringify(assignments));
};

/**
 * Get test assignment from localStorage
 */
const getAssignment = (testId) => {
    const assignments = JSON.parse(localStorage.getItem(ABTEST_CONFIG.LOCAL_STORAGE_KEY) || '{}');
    const assignment = assignments[testId];
    
    if (assignment && new Date(assignment.expiresAt) > new Date()) {
        return assignment.variantId;
    }
    return null;
};

/**
 * Clear expired assignments
 */
const clearExpiredAssignments = () => {
    const assignments = JSON.parse(localStorage.getItem(ABTEST_CONFIG.LOCAL_STORAGE_KEY) || '{}');
    let changed = false;
    
    for (const [testId, assignment] of Object.entries(assignments)) {
        if (new Date(assignment.expiresAt) <= new Date()) {
            delete assignments[testId];
            changed = true;
        }
    }
    
    if (changed) {
        localStorage.setItem(ABTEST_CONFIG.LOCAL_STORAGE_KEY, JSON.stringify(assignments));
    }
};

// ============================================
// Event Tracking
// ============================================

/**
 * Add event to queue
 */
const addToQueue = (event) => {
    ABTestState.eventQueue.push({
        ...event,
        timestamp: new Date().toISOString(),
        userId: ABTestState.userId,
        sessionId: ABTestState.sessionId
    });
    
    if (ABTestState.debugMode) {
        console.log('[ABTest] Event queued:', event);
    }
    
    if (ABTestState.eventQueue.length >= ABTEST_CONFIG.BATCH_SIZE) {
        sendEvents();
    }
};

/**
 * Send events to server
 */
const sendEvents = async () => {
    if (ABTestState.isSending || ABTestState.eventQueue.length === 0) return;
    
    ABTestState.isSending = true;
    const eventsToSend = [...ABTestState.eventQueue];
    ABTestState.eventQueue = [];
    
    try {
        const response = await fetch(ABTEST_CONFIG.EVENT_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${auth?.token || ''}`
            },
            body: JSON.stringify({ events: eventsToSend })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        if (ABTestState.debugMode) {
            console.log(`[ABTest] Sent ${eventsToSend.length} events`);
        }
    } catch (error) {
        console.error('[ABTest] Failed to send events:', error);
        ABTestState.eventQueue = [...eventsToSend, ...ABTestState.eventQueue];
    } finally {
        ABTestState.isSending = false;
    }
};

/**
 * Track test event
 */
const trackTestEvent = (testId, variantId, eventType, metadata = {}) => {
    const event = {
        testId,
        variantId,
        eventType,
        metadata,
        url: window.location.href,
        referrer: document.referrer
    };
    
    addToQueue(event);
    ABTestState.testEvents.push(event);
    
    // Trigger custom event for listeners
    window.dispatchEvent(new CustomEvent('abtest:event', {
        detail: { testId, variantId, eventType, metadata }
    }));
};

// ============================================
// Test Management
// ============================================

/**
 * Fetch active tests from server
 */
const fetchActiveTests = async () => {
    try {
        const response = await fetch(`${ABTEST_CONFIG.API_ENDPOINT}/active`, {
            headers: {
                'Authorization': `Bearer ${auth?.token || ''}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            ABTestState.activeTests = data.data;
            
            // Process assignments
            for (const test of ABTestState.activeTests) {
                processTestAssignment(test);
            }
            
            if (ABTestState.debugMode) {
                console.log('[ABTest] Active tests loaded:', ABTestState.activeTests);
            }
        }
    } catch (error) {
        console.error('[ABTest] Failed to fetch active tests:', error);
    }
};

/**
 * Process test assignment
 */
const processTestAssignment = (test) => {
    // Check if already assigned
    let variantId = getAssignment(test.testId);
    
    if (!variantId) {
        // New assignment from server
        variantId = test.variantId;
        saveAssignment(test.testId, variantId);
    }
    
    ABTestState.testVariants.set(test.testId, variantId);
    
    // Apply test configuration to DOM
    applyTestVariant(test, variantId);
    
    // Track view event
    trackTestEvent(test.testId, variantId, 'view', {
        testName: test.testName,
        variantName: test.variantName
    });
    
    if (ABTestState.debugMode) {
        console.log(`[ABTest] Applied test ${test.testId}: ${variantId}`);
    }
};

/**
 * Apply test variant to DOM
 */
const applyTestVariant = (test, variantId) => {
    const config = test.config;
    if (!config) return;
    
    // Apply CSS classes
    if (config.cssClass) {
        document.body.classList.add(`ab-test-${test.testId}`);
        document.body.classList.add(`ab-variant-${variantId}`);
    }
    
    // Apply element modifications
    if (config.elements) {
        for (const [selector, modifications] of Object.entries(config.elements)) {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
                applyElementModifications(el, modifications);
            });
        }
    }
    
    // Apply style modifications
    if (config.styles) {
        const styleId = `ab-test-styles-${test.testId}`;
        let styleEl = document.getElementById(styleId);
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = styleId;
            document.head.appendChild(styleEl);
        }
        styleEl.textContent = config.styles;
    }
    
    // Apply JavaScript configuration
    if (config.scripts && typeof config.scripts === 'function') {
        config.scripts();
    }
    
    // Dispatch custom event
    window.dispatchEvent(new CustomEvent('abtest:applied', {
        detail: { testId: test.testId, variantId, config }
    }));
};

/**
 * Apply element modifications
 */
const applyElementModifications = (element, modifications) => {
    if (modifications.text) {
        element.textContent = modifications.text;
    }
    if (modifications.html) {
        element.innerHTML = modifications.html;
    }
    if (modifications.classes) {
        modifications.classes.forEach(className => {
            element.classList.add(className);
        });
    }
    if (modifications.attributes) {
        for (const [attr, value] of Object.entries(modifications.attributes)) {
            element.setAttribute(attr, value);
        }
    }
    if (modifications.style) {
        for (const [prop, value] of Object.entries(modifications.style)) {
            element.style[prop] = value;
        }
    }
};

// ============================================
// Experiment Helpers
// ============================================

/**
 * Track conversion event
 */
const trackConversion = (testId, value = null, metadata = {}) => {
    const variantId = ABTestState.testVariants.get(testId);
    if (variantId) {
        trackTestEvent(testId, variantId, 'conversion', {
            value,
            ...metadata
        });
    }
};

/**
 * Track click on element with data-ab-test attribute
 */
const setupClickTracking = () => {
    document.addEventListener('click', (e) => {
        const target = e.target.closest('[data-ab-track]');
        if (target) {
            const testId = target.dataset.abTest;
            const eventName = target.dataset.abTrack;
            
            if (testId && eventName) {
                const variantId = ABTestState.testVariants.get(testId);
                if (variantId) {
                    trackTestEvent(testId, variantId, eventName, {
                        elementId: target.id,
                        elementClass: target.className,
                        elementText: target.textContent?.substring(0, 100)
                    });
                }
            }
        }
    });
};

/**
 * Track form submission
 */
const setupFormTracking = () => {
    document.addEventListener('submit', (e) => {
        const form = e.target;
        const testId = form.dataset.abTest;
        
        if (testId) {
            const variantId = ABTestState.testVariants.get(testId);
            if (variantId) {
                trackTestEvent(testId, variantId, 'submit', {
                    formId: form.id,
                    formName: form.name,
                    formAction: form.action
                });
            }
        }
    });
};

// ============================================
// Experiment Configuration Builder
// ============================================

/**
 * Create a new experiment configuration
 */
const createExperiment = (config) => {
    return {
        name: config.name,
        description: config.description,
        hypothesis: config.hypothesis,
        variants: config.variants,
        targeting: config.targeting || {},
        metrics: config.metrics || ['conversion'],
        startDate: config.startDate,
        endDate: config.endDate,
        sampleSize: config.sampleSize
    };
};

/**
 * Run local experiment (for development/testing)
 */
const runLocalExperiment = (experiment) => {
    // Random assignment for local testing
    const totalWeight = experiment.variants.reduce((sum, v) => sum + v.weight, 0);
    let random = Math.random() * totalWeight;
    let selectedVariant = experiment.variants[0];
    
    for (const variant of experiment.variants) {
        if (random <= variant.weight) {
            selectedVariant = variant;
            break;
        }
        random -= variant.weight;
    }
    
    // Apply variant
    if (selectedVariant.config) {
        if (selectedVariant.config.cssClass) {
            document.body.classList.add(`local-exp-${experiment.name}`);
            document.body.classList.add(`local-variant-${selectedVariant.id}`);
        }
        
        if (selectedVariant.config.elements) {
            for (const [selector, modifications] of Object.entries(selectedVariant.config.elements)) {
                const elements = document.querySelectorAll(selector);
                elements.forEach(el => {
                    applyElementModifications(el, modifications);
                });
            }
        }
    }
    
    console.log(`[Local Experiment] ${experiment.name}: ${selectedVariant.name}`);
    
    return selectedVariant;
};

// ============================================
// Test Results Display
// ============================================

/**
 * Display test results in admin panel
 */
const displayTestResults = async (testId) => {
    try {
        const response = await fetch(`${ABTEST_CONFIG.API_ENDPOINT}/results/${testId}`, {
            headers: {
                'Authorization': `Bearer ${auth?.token || ''}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            renderResultsTable(data.data);
            return data.data;
        }
    } catch (error) {
        console.error('[ABTest] Failed to fetch results:', error);
    }
};

/**
 * Render results table
 */
const renderResultsTable = (results) => {
    const container = document.getElementById('ab-test-results');
    if (!container) return;
    
    const { test, results: testResults, recommendations } = results;
    
    container.innerHTML = `
        <div class="ab-test-header">
            <h3>${escapeHtml(test.name)}</h3>
            <p>${escapeHtml(test.description || '')}</p>
            <div class="test-status status-${test.status}">${test.status}</div>
        </div>
        
        <div class="results-summary">
            <div class="summary-card">
                <div class="summary-label">Total Views</div>
                <div class="summary-value">${testResults.summary.totalViews.toLocaleString()}</div>
            </div>
            <div class="summary-card">
                <div class="summary-label">Total Conversions</div>
                <div class="summary-value">${testResults.summary.totalConversions.toLocaleString()}</div>
            </div>
            <div class="summary-card">
                <div class="summary-label">Conversion Rate</div>
                <div class="summary-value">${testResults.summary.overallConversionRate}%</div>
            </div>
            <div class="summary-card winner">
                <div class="summary-label">Winner</div>
                <div class="summary-value">${testResults.summary.winnerName}</div>
                <div class="summary-sub">+${testResults.summary.winnerImprovement}% improvement</div>
            </div>
        </div>
        
        <div class="variants-table">
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Variant</th>
                        <th>Views</th>
                        <th>Conversions</th>
                        <th>Conversion Rate</th>
                        <th>Improvement</th>
                        <th>Confidence</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.entries(testResults.variants).map(([id, variant]) => `
                        <tr class="${variant.isSignificant ? 'significant' : ''}">
                            <td><strong>${escapeHtml(variant.name)}</strong> ${variant.isControl ? '(Control)' : ''}</td>
                            <td>${variant.metrics.views.toLocaleString()}</td>
                            <td>${variant.metrics.conversions.toLocaleString()}</td>
                            <td>${variant.metrics.conversionRate}%</td>
                            <td class="${variant.improvement > 0 ? 'positive' : variant.improvement < 0 ? 'negative' : ''}">
                                ${variant.improvement > 0 ? '+' : ''}${variant.improvement}%
                            </td>
                            <td>${variant.significance?.confidenceLevel || 0}%</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        
        ${recommendations && recommendations.length > 0 ? `
            <div class="recommendations">
                <h4>Recommendations</h4>
                <ul>
                    ${recommendations.map(r => `<li class="recommendation-${r.priority}">${escapeHtml(r.message)}</li>`).join('')}
                </ul>
            </div>
        ` : ''}
    `;
};

/**
 * Escape HTML
 */
const escapeHtml = (text) => {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
};

// ============================================
// Initialization
// ============================================

/**
 * Initialize A/B testing module
 */
const initABTesting = async () => {
    if (ABTestState.isInitialized) return;
    
    console.log('Initializing A/B testing module...');
    
    // Set user ID
    ABTestState.userId = getUserId();
    ABTestState.sessionId = getSessionId();
    
    // Clear expired assignments
    clearExpiredAssignments();
    
    // Fetch active tests
    await fetchActiveTests();
    
    // Setup event tracking
    setupClickTracking();
    setupFormTracking();
    
    // Start batch sender
    setInterval(() => {
        if (ABTestState.eventQueue.length > 0) {
            sendEvents();
        }
    }, ABTEST_CONFIG.BATCH_INTERVAL);
    
    ABTestState.isInitialized = true;
    
    console.log('A/B testing module initialized');
};

/**
 * Enable debug mode
 */
const setDebugMode = (enabled) => {
    ABTestState.debugMode = enabled;
    localStorage.setItem('ab_test_debug', enabled);
};

/**
 * Get variant for test
 */
const getVariant = (testId) => {
    return ABTestState.testVariants.get(testId);
};

/**
 * Check if user is in test
 */
const isInTest = (testId) => {
    return ABTestState.testVariants.has(testId);
};

// ============================================
// Export ABTest Module
// ============================================

const abtest = {
    // State
    get isInitialized() { return ABTestState.isInitialized; },
    get activeTests() { return ABTestState.activeTests; },
    get debugMode() { return ABTestState.debugMode; },
    
    // Core
    getVariant,
    isInTest,
    trackConversion,
    trackTestEvent,
    
    // Experiment helpers
    createExperiment,
    runLocalExperiment,
    
    // Results
    displayTestResults,
    
    // Settings
    setDebugMode,
    
    // Initialize
    init: initABTesting
};

// Make abtest globally available
window.abtest = abtest;

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initABTesting);
} else {
    initABTesting();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = abtest;
}
