/* ============================================
   SPEAKFLOW - ANALYTICS MODULE
   Version: 1.0.0
   Handles user analytics, event tracking, and reporting
   ============================================ */

// ============================================
// ANALYTICS CONFIGURATION
// ============================================

const AnalyticsConfig = {
    // API Endpoints
    api: {
        track: '/api/analytics/track',
        events: '/api/analytics/events',
        metrics: '/api/analytics/metrics',
        export: '/api/analytics/export'
    },
    
    // Tracking Settings
    tracking: {
        enabled: true,
        debug: false,
        batchSize: 10,
        flushInterval: 30000, // 30 seconds
        retryAttempts: 3,
        retryDelay: 5000
    },
    
    // Event Categories
    categories: {
        user: 'user',
        practice: 'practice',
        engagement: 'engagement',
        payment: 'payment',
        feature: 'feature',
        error: 'error',
        performance: 'performance'
    },
    
    // Retention Periods
    retention: {
        events: 90, // days
        sessions: 30,
        metrics: 365
    },
    
    // Metrics Thresholds
    thresholds: {
        good: 70,
        warning: 50,
        critical: 30
    }
};

// ============================================
// EVENT TRACKER
// ============================================

class EventTracker {
    constructor() {
        this.eventQueue = [];
        this.sessionId = this.generateSessionId();
        this.userId = null;
        this.isFlushing = false;
        this.init();
    }
    
    init() {
        this.loadFromStorage();
        this.setupEventListeners();
        this.startFlushInterval();
        this.trackPageView();
    }
    
    generateSessionId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    
    loadFromStorage() {
        const savedQueue = localStorage.getItem('analytics_queue');
        if (savedQueue) {
            try {
                this.eventQueue = JSON.parse(savedQueue);
                console.log(`Loaded ${this.eventQueue.length} events from storage`);
            } catch (e) {
                console.error('Failed to load analytics queue:', e);
            }
        }
    }
    
    saveToStorage() {
        localStorage.setItem('analytics_queue', JSON.stringify(this.eventQueue));
    }
    
    setupEventListeners() {
        // Page visibility
        document.addEventListener('visibilitychange', () => {
            this.trackEvent('page_visibility', {
                state: document.hidden ? 'hidden' : 'visible'
            });
        });
        
        // Before unload
        window.addEventListener('beforeunload', () => {
            this.flush(true);
        });
        
        // Online/offline
        window.addEventListener('online', () => {
            this.trackEvent('connection_restored', {});
            this.flush();
        });
        
        window.addEventListener('offline', () => {
            this.trackEvent('connection_lost', {});
        });
        
        // Page load performance
        window.addEventListener('load', () => {
            this.trackPerformance();
        });
    }
    
    startFlushInterval() {
        setInterval(() => {
            this.flush();
        }, AnalyticsConfig.tracking.flushInterval);
    }
    
    trackEvent(category, action, label = null, value = null, metadata = {}) {
        if (!AnalyticsConfig.tracking.enabled) return;
        
        const event = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            category,
            action,
            label,
            value,
            metadata,
            sessionId: this.sessionId,
            userId: this.userId,
            timestamp: new Date().toISOString(),
            url: window.location.href,
            referrer: document.referrer,
            userAgent: navigator.userAgent,
            screenSize: `${window.innerWidth}x${window.innerHeight}`
        };
        
        this.eventQueue.push(event);
        this.saveToStorage();
        
        if (AnalyticsConfig.tracking.debug) {
            console.log('[Analytics]', event);
        }
        
        // Flush immediately for important events
        if (category === 'payment' || category === 'error') {
            this.flush();
        }
        
        return event;
    }
    
    trackPageView() {
        this.trackEvent('page_view', 'load', document.title, null, {
            path: window.location.pathname,
            search: window.location.search,
            hash: window.location.hash
        });
    }
    
    trackPerformance() {
        const perfData = performance.timing;
        const navigationStart = perfData.navigationStart;
        
        const metrics = {
            pageLoadTime: perfData.loadEventEnd - navigationStart,
            domContentLoaded: perfData.domContentLoadedEventEnd - navigationStart,
            firstPaint: this.getFirstPaint(),
            firstContentfulPaint: this.getFirstContentfulPaint(),
            domInteractive: perfData.domInteractive - navigationStart
        };
        
        this.trackEvent('performance', 'page_metrics', null, null, metrics);
    }
    
    getFirstPaint() {
        if (window.performance && performance.getEntriesByType) {
            const paintEntries = performance.getEntriesByType('paint');
            const firstPaint = paintEntries.find(entry => entry.name === 'first-paint');
            return firstPaint ? firstPaint.startTime : null;
        }
        return null;
    }
    
    getFirstContentfulPaint() {
        if (window.performance && performance.getEntriesByType) {
            const paintEntries = performance.getEntriesByType('paint');
            const fcp = paintEntries.find(entry => entry.name === 'first-contentful-paint');
            return fcp ? fcp.startTime : null;
        }
        return null;
    }
    
    async flush(sync = false) {
        if (this.eventQueue.length === 0) return;
        if (this.isFlushing) return;
        
        this.isFlushing = true;
        const events = [...this.eventQueue];
        
        try {
            const success = await this.sendEvents(events, sync);
            if (success) {
                this.eventQueue = this.eventQueue.filter(e => !events.includes(e));
                this.saveToStorage();
                console.log(`Flushed ${events.length} events`);
            }
        } catch (error) {
            console.error('Failed to flush events:', error);
        } finally {
            this.isFlushing = false;
        }
    }
    
    async sendEvents(events, sync = false) {
        // In production, send to server
        // For demo, simulate API call
        return new Promise((resolve) => {
            setTimeout(() => resolve(true), 100);
        });
        
        // Actual implementation:
        /*
        try {
            const response = await fetch(AnalyticsConfig.api.track, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ events, sync })
            });
            return response.ok;
        } catch (error) {
            return false;
        }
        */
    }
    
    setUserId(userId) {
        this.userId = userId;
        this.trackEvent('user', 'identify', null, null, { userId });
    }
    
    clearUser() {
        this.userId = null;
        this.trackEvent('user', 'logout');
    }
}

// ============================================
// METRICS COLLECTOR
// ============================================

class MetricsCollector {
    constructor(eventTracker) {
        this.tracker = eventTracker;
        this.metrics = new Map();
        this.startCollection();
    }
    
    startCollection() {
        // Collect every minute
        setInterval(() => this.collectMetrics(), 60000);
        
        // Collect immediately
        this.collectMetrics();
    }
    
    collectMetrics() {
        const metrics = {
            timestamp: new Date().toISOString(),
            sessionId: this.tracker.sessionId,
            userId: this.tracker.userId,
            
            // Performance metrics
            memory: this.getMemoryMetrics(),
            network: this.getNetworkMetrics(),
            battery: this.getBatteryMetrics(),
            
            // User metrics
            engagement: this.getEngagementMetrics(),
            scroll: this.getScrollMetrics(),
            clicks: this.getClickMetrics(),
            
            // Device metrics
            device: this.getDeviceMetrics(),
            connection: this.getConnectionMetrics()
        };
        
        this.metrics.set(metrics.timestamp, metrics);
        
        // Keep only last 100 metrics
        if (this.metrics.size > 100) {
            const oldestKey = Array.from(this.metrics.keys())[0];
            this.metrics.delete(oldestKey);
        }
        
        this.tracker.trackEvent('metrics', 'collection', null, null, metrics);
        
        return metrics;
    }
    
    getMemoryMetrics() {
        if (performance.memory) {
            return {
                usedJSHeapSize: performance.memory.usedJSHeapSize,
                totalJSHeapSize: performance.memory.totalJSHeapSize,
                jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
            };
        }
        return null;
    }
    
    getNetworkMetrics() {
        if (navigator.connection) {
            return {
                effectiveType: navigator.connection.effectiveType,
                downlink: navigator.connection.downlink,
                rtt: navigator.connection.rtt,
                saveData: navigator.connection.saveData
            };
        }
        return null;
    }
    
    async getBatteryMetrics() {
        if (navigator.getBattery) {
            try {
                const battery = await navigator.getBattery();
                return {
                    level: battery.level,
                    charging: battery.charging,
                    chargingTime: battery.chargingTime,
                    dischargingTime: battery.dischargingTime
                };
            } catch (e) {
                return null;
            }
        }
        return null;
    }
    
    getEngagementMetrics() {
        return {
            timeOnPage: this.getTimeOnPage(),
            scrollDepth: this.getScrollDepth(),
            activeTime: this.getActiveTime()
        };
    }
    
    getTimeOnPage() {
        const startTime = performance.timing.navigationStart;
        return Date.now() - startTime;
    }
    
    getScrollDepth() {
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        const currentScroll = window.scrollY;
        return maxScroll > 0 ? (currentScroll / maxScroll) * 100 : 0;
    }
    
    getActiveTime() {
        let activeTime = 0;
        let lastActive = Date.now();
        
        const updateActiveTime = () => {
            if (!document.hidden) {
                activeTime += Date.now() - lastActive;
            }
            lastActive = Date.now();
        };
        
        document.addEventListener('visibilitychange', updateActiveTime);
        window.addEventListener('scroll', updateActiveTime);
        window.addEventListener('click', updateActiveTime);
        window.addEventListener('keypress', updateActiveTime);
        
        return activeTime;
    }
    
    getClickMetrics() {
        // Track click heatmap data
        const clicks = JSON.parse(localStorage.getItem('click_heatmap') || '[]');
        return {
            totalClicks: clicks.length,
            lastClick: clicks[clicks.length - 1]
        };
    }
    
    getDeviceMetrics() {
        return {
            screenWidth: window.innerWidth,
            screenHeight: window.innerHeight,
            pixelRatio: window.devicePixelRatio,
            orientation: screen.orientation?.type || 'unknown',
            platform: navigator.platform,
            language: navigator.language
        };
    }
    
    getConnectionMetrics() {
        return {
            online: navigator.onLine,
            type: navigator.connection?.type || 'unknown'
        };
    }
    
    getMetrics() {
        return Array.from(this.metrics.values());
    }
}

// ============================================
// USER BEHAVIOR ANALYZER
// ============================================

class UserBehaviorAnalyzer {
    constructor(eventTracker) {
        this.tracker = eventTracker;
        this.behavior = {
            paths: [],
            funnels: new Map(),
            segments: new Map()
        };
        this.init();
    }
    
    init() {
        this.trackUserJourney();
        this.setupFunnels();
        this.analyzeSegments();
    }
    
    trackUserJourney() {
        // Track page transitions
        let currentPage = window.location.pathname;
        
        const trackTransition = () => {
            const newPage = window.location.pathname;
            if (newPage !== currentPage) {
                this.tracker.trackEvent('user_journey', 'page_transition', null, null, {
                    from: currentPage,
                    to: newPage,
                    timeOnPage: this.getTimeOnPage()
                });
                currentPage = newPage;
            }
        };
        
        // Listen for navigation
        window.addEventListener('popstate', trackTransition);
        
        // Override pushState
        const originalPushState = history.pushState;
        history.pushState = function(...args) {
            originalPushState.apply(this, args);
            trackTransition();
        };
    }
    
    getTimeOnPage() {
        const startTime = performance.timing.navigationStart;
        return Date.now() - startTime;
    }
    
    setupFunnels() {
        // Define conversion funnels
        const funnels = {
            onboarding: ['/welcome', '/onboarding/goal', '/onboarding/level', '/onboarding/persona', '/dashboard'],
            practice: ['/dashboard', '/practice', '/practice/record', '/practice/feedback'],
            premium: ['/dashboard', '/pricing', '/checkout', '/payment/success']
        };
        
        for (const [name, steps] of Object.entries(funnels)) {
            this.behavior.funnels.set(name, {
                steps,
                conversions: new Array(steps.length).fill(0)
            });
        }
    }
    
    analyzeSegments() {
        // Segment users by behavior
        const segments = {
            power_users: { condition: (u) => u.sessions > 10 && u.xp > 1000 },
            casual_users: { condition: (u) => u.sessions <= 5 },
            at_risk: { condition: (u) => u.lastActive > 7 },
            converters: { condition: (u) => u.isPremium }
        };
        
        this.behavior.segments = segments;
    }
    
    trackFunnelStep(funnelName, stepIndex) {
        const funnel = this.behavior.funnels.get(funnelName);
        if (funnel && stepIndex < funnel.steps.length) {
            funnel.conversions[stepIndex]++;
            this.tracker.trackEvent('funnel', funnelName, funnel.steps[stepIndex], stepIndex);
        }
    }
    
    async getUserSegments(userData) {
        const segments = [];
        for (const [name, config] of Object.entries(this.behavior.segments)) {
            if (config.condition(userData)) {
                segments.push(name);
            }
        }
        return segments;
    }
}

// ============================================
// REPORTING ENGINE
// ============================================

class ReportingEngine {
    constructor(eventTracker, metricsCollector, behaviorAnalyzer) {
        this.tracker = eventTracker;
        this.metrics = metricsCollector;
        this.behavior = behaviorAnalyzer;
        this.reports = new Map();
    }
    
    async generateDailyReport(date = new Date()) {
        const report = {
            date: date.toISOString().split('T')[0],
            summary: {},
            metrics: {},
            events: {},
            users: {},
            performance: {}
        };
        
        // Summary metrics
        report.summary = await this.getDailySummary(date);
        
        // User metrics
        report.users = await this.getUserMetrics(date);
        
        // Performance metrics
        report.performance = await this.getPerformanceMetrics(date);
        
        // Event breakdown
        report.events = await this.getEventBreakdown(date);
        
        this.reports.set(report.date, report);
        
        return report;
    }
    
    async getDailySummary(date) {
        // In production, query database
        // For demo, return simulated data
        return {
            totalUsers: 1247 + Math.floor(Math.random() * 100),
            activeUsers: 384 + Math.floor(Math.random() * 50),
            newUsers: 42 + Math.floor(Math.random() * 20),
            totalSessions: 1250 + Math.floor(Math.random() * 200),
            totalPracticeMinutes: 3240 + Math.floor(Math.random() * 500),
            averageScore: 72 + Math.floor(Math.random() * 10),
            conversionRate: 8.5 + Math.random() * 3,
            retentionRate: 65 + Math.random() * 10
        };
    }
    
    async getUserMetrics(date) {
        return {
            total: 5000,
            premium: 425,
            free: 4575,
            premiumRate: 8.5,
            averageStreak: 3.2,
            averageLevel: 4.5,
            averageXP: 1250
        };
    }
    
    async getPerformanceMetrics(date) {
        const metrics = this.metrics.getMetrics();
        const recentMetrics = metrics.slice(-10);
        
        const avgLoadTime = recentMetrics.reduce((sum, m) => {
            const pageLoad = m.performance?.pageLoadTime || 0;
            return sum + pageLoad;
        }, 0) / recentMetrics.length;
        
        return {
            averagePageLoadTime: avgLoadTime,
            averageApiResponseTime: 245,
            errorRate: 2.3,
            crashRate: 0.5
        };
    }
    
    async getEventBreakdown(date) {
        return {
            page_views: 15000,
            practice_sessions: 850,
            upgrades: 32,
            shares: 128,
            errors: 45
        };
    }
    
    async generateWeeklyReport() {
        const reports = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const report = await this.generateDailyReport(date);
            reports.push(report);
        }
        
        return this.aggregateReports(reports);
    }
    
    async generateMonthlyReport() {
        const reports = [];
        for (let i = 0; i < 30; i++) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const report = await this.generateDailyReport(date);
            reports.push(report);
        }
        
        return this.aggregateReports(reports);
    }
    
    aggregateReports(reports) {
        const aggregated = {
            period: {
                start: reports[reports.length - 1].date,
                end: reports[0].date
            },
            totals: {
                users: 0,
                sessions: 0,
                practiceMinutes: 0,
                upgrades: 0
            },
            averages: {
                activeUsers: 0,
                score: 0,
                retention: 0
            },
            trends: {
                users: [],
                engagement: [],
                revenue: []
            }
        };
        
        for (const report of reports) {
            aggregated.totals.users += report.summary.totalUsers;
            aggregated.totals.sessions += report.summary.totalSessions;
            aggregated.totals.practiceMinutes += report.summary.totalPracticeMinutes;
            
            aggregated.averages.activeUsers += report.summary.activeUsers;
            aggregated.averages.score += report.summary.averageScore;
            aggregated.averages.retention += report.summary.retentionRate;
            
            aggregated.trends.users.push({
                date: report.date,
                value: report.summary.activeUsers
            });
        }
        
        aggregated.averages.activeUsers /= reports.length;
        aggregated.averages.score /= reports.length;
        aggregated.averages.retention /= reports.length;
        
        return aggregated;
    }
    
    async exportReport(format = 'csv', report) {
        if (format === 'csv') {
            return this.toCSV(report);
        } else if (format === 'json') {
            return JSON.stringify(report, null, 2);
        } else if (format === 'pdf') {
            return this.toPDF(report);
        }
    }
    
    toCSV(report) {
        const rows = [];
        
        // Headers
        rows.push(['Metric', 'Value'].join(','));
        
        // Add summary
        for (const [key, value] of Object.entries(report.summary)) {
            rows.push([key, value].join(','));
        }
        
        return rows.join('\n');
    }
    
    toPDF(report) {
        // In production, generate PDF
        // For demo, return HTML string
        return `
            <html>
                <head><title>SpeakFlow Report - ${report.date}</title></head>
                <body>
                    <h1>SpeakFlow Analytics Report</h1>
                    <h2>Date: ${report.date}</h2>
                    <h3>Summary</h3>
                    <pre>${JSON.stringify(report.summary, null, 2)}</pre>
                </body>
            </html>
        `;
    }
}

// ============================================
// DASHBOARD ANALYTICS
// ============================================

class DashboardAnalytics {
    constructor(eventTracker, metricsCollector, reportingEngine) {
        this.tracker = eventTracker;
        this.metrics = metricsCollector;
        this.reporting = reportingEngine;
        this.dashboardData = {};
        this.updateInterval = null;
    }
    
    startRealtimeUpdates(interval = 30000) {
        this.updateInterval = setInterval(() => {
            this.updateDashboardData();
        }, interval);
        
        this.updateDashboardData();
    }
    
    stopRealtimeUpdates() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }
    
    async updateDashboardData() {
        this.dashboardData = {
            timestamp: new Date().toISOString(),
            realtime: await this.getRealtimeMetrics(),
            trends: await this.getTrends(),
            topEvents: await this.getTopEvents(),
            userActivity: await this.getUserActivity()
        };
        
        this.tracker.trackEvent('dashboard', 'update', null, null, this.dashboardData);
        
        // Dispatch event for UI update
        const event = new CustomEvent('analytics:update', {
            detail: this.dashboardData
        });
        document.dispatchEvent(event);
    }
    
    async getRealtimeMetrics() {
        return {
            onlineUsers: 234 + Math.floor(Math.random() * 50),
            activePractices: 45 + Math.floor(Math.random() * 20),
            eventsPerMinute: 120 + Math.floor(Math.random() * 40),
            serverLoad: 45 + Math.random() * 30
        };
    }
    
    async getTrends() {
        return {
            users7d: [1240, 1280, 1320, 1350, 1380, 1400, 1420],
            sessions7d: [2450, 2520, 2580, 2650, 2720, 2780, 2850],
            scores7d: [68, 69, 70, 71, 72, 73, 74]
        };
    }
    
    async getTopEvents() {
        return [
            { name: 'page_view', count: 15000, change: '+12%' },
            { name: 'practice_start', count: 3200, change: '+8%' },
            { name: 'share_score', count: 850, change: '+15%' },
            { name: 'upgrade_click', count: 420, change: '+5%' }
        ];
    }
    
    async getUserActivity() {
        return {
            hourByHour: Array(24).fill(0).map(() => Math.floor(Math.random() * 200)),
            dayOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(() => Math.floor(Math.random() * 1000))
        };
    }
    
    getDashboardData() {
        return this.dashboardData;
    }
}

// ============================================
// ANALYTICS UI CONTROLLER
// ============================================

class AnalyticsUIController {
    constructor(dashboardAnalytics, reportingEngine) {
        this.dashboard = dashboardAnalytics;
        this.reporting = reportingEngine;
        this.elements = {};
        this.init();
    }
    
    init() {
        this.bindElements();
        this.bindEvents();
        this.setupListeners();
        this.dashboard.startRealtimeUpdates();
    }
    
    bindElements() {
        this.elements = {
            realtimeUsers: document.getElementById('realtimeUsers'),
            activePractices: document.getElementById('activePractices'),
            eventsPerMinute: document.getElementById('eventsPerMinute'),
            userChart: document.getElementById('userChart'),
            eventList: document.getElementById('eventList'),
            exportBtn: document.getElementById('exportAnalyticsBtn')
        };
    }
    
    bindEvents() {
        if (this.elements.exportBtn) {
            this.elements.exportBtn.addEventListener('click', () => this.exportReport());
        }
    }
    
    setupListeners() {
        document.addEventListener('analytics:update', (e) => {
            this.updateUI(e.detail);
        });
    }
    
    updateUI(data) {
        if (this.elements.realtimeUsers) {
            this.elements.realtimeUsers.textContent = data.realtime?.onlineUsers || 0;
        }
        
        if (this.elements.activePractices) {
            this.elements.activePractices.textContent = data.realtime?.activePractices || 0;
        }
        
        if (this.elements.eventsPerMinute) {
            this.elements.eventsPerMinute.textContent = data.realtime?.eventsPerMinute || 0;
        }
        
        this.updateCharts(data);
        this.updateEventList(data);
    }
    
    updateCharts(data) {
        if (this.elements.userChart && data.trends) {
            // In production, render charts with Chart.js or D3
            console.log('Updating charts with:', data.trends);
        }
    }
    
    updateEventList(data) {
        if (this.elements.eventList && data.topEvents) {
            this.elements.eventList.innerHTML = data.topEvents.map(event => `
                <div class="event-item">
                    <span class="event-name">${event.name}</span>
                    <span class="event-count">${event.count.toLocaleString()}</span>
                    <span class="event-change ${event.change.includes('+') ? 'positive' : 'negative'}">${event.change}</span>
                </div>
            `).join('');
        }
    }
    
    async exportReport() {
        const report = await this.reporting.generateDailyReport();
        const csv = await this.reporting.exportReport('csv', report);
        
        // Download CSV
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `speakflow_report_${report.date}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }
}

// ============================================
// EXPORTS
// ============================================

// Initialize analytics system
const eventTracker = new EventTracker();
const metricsCollector = new MetricsCollector(eventTracker);
const behaviorAnalyzer = new UserBehaviorAnalyzer(eventTracker);
const reportingEngine = new ReportingEngine(eventTracker, metricsCollector, behaviorAnalyzer);
const dashboardAnalytics = new DashboardAnalytics(eventTracker, metricsCollector, reportingEngine);
const analyticsUI = new AnalyticsUIController(dashboardAnalytics, reportingEngine);

// Global exports
window.SpeakFlow = window.SpeakFlow || {};
window.SpeakFlow.Analytics = {
    tracker: eventTracker,
    metrics: metricsCollector,
    behavior: behaviorAnalyzer,
    reporting: reportingEngine,
    dashboard: dashboardAnalytics,
    ui: analyticsUI,
    config: AnalyticsConfig
};

// Module exports
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        AnalyticsConfig,
        EventTracker,
        MetricsCollector,
        UserBehaviorAnalyzer,
        ReportingEngine,
        DashboardAnalytics,
        AnalyticsUIController
    };
}

// ============================================
// AUTO-INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('Analytics module initialized');
    
    // Set user ID if logged in
    const userId = localStorage.getItem('userId');
    if (userId) {
        eventTracker.setUserId(userId);
    }
    
    // Debug mode
    if (window.location.hostname === 'localhost') {
        window.debugAnalytics = {
            tracker: eventTracker,
            metrics: metricsCollector,
            behavior: behaviorAnalyzer
        };
        console.log('Analytics debug mode enabled');
    }
});
