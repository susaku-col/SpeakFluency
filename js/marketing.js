/* ============================================
   SPEAKFLOW - MARKETING AUTOMATION MODULE
   Version: 1.0.0
   Handles email campaigns, push notifications, and user engagement
   ============================================ */

// ============================================
// MARKETING CONFIGURATION
// ============================================

const MarketingConfig = {
    // API Endpoints
    api: {
        sendEmail: '/api/marketing/email',
        sendPush: '/api/marketing/push',
        campaigns: '/api/marketing/campaigns',
        segments: '/api/marketing/segments',
        analytics: '/api/marketing/analytics'
    },
    
    // Email Settings
    email: {
        fromName: 'SpeakFlow Team',
        fromEmail: 'hello@speakflow.com',
        replyTo: 'support@speakflow.com',
        maxPerDay: 10000,
        rateLimit: 100 // per minute
    },
    
    // Push Notification Settings
    push: {
        vapidPublicKey: 'YOUR_VAPID_PUBLIC_KEY',
        serviceWorkerPath: '/sw.js',
        maxPerDay: 5000
    },
    
    // Campaign Settings
    campaigns: {
        maxConcurrent: 10,
        defaultPriority: 'normal',
        retryAttempts: 3,
        retryDelay: 3600000 // 1 hour
    },
    
    // User Segments
    segments: {
        active: { condition: 'lastActive < 7', priority: 'high' },
        atRisk: { condition: 'lastActive > 7 && lastActive < 14', priority: 'critical' },
        churned: { condition: 'lastActive > 14', priority: 'low' },
        premium: { condition: 'isPremium === true', priority: 'high' },
        newUser: { condition: 'createdAt < 3', priority: 'high' }
    }
};

// ============================================
// EMAIL SERVICE
// ============================================

class EmailService {
    constructor() {
        this.queue = [];
        this.sentCount = 0;
        this.isProcessing = false;
        this.templates = this.loadTemplates();
    }
    
    loadTemplates() {
        return {
            welcome: {
                subject: 'Welcome to SpeakFlow! 🎉',
                template: 'welcome-email',
                variables: ['name', 'onboardingLink']
            },
            streakReminder: {
                subject: '🔥 Don\'t break your streak!',
                template: 'streak-reminder',
                variables: ['name', 'streakDays', 'practiceLink']
            },
            milestone: {
                subject: '🎉 Congratulations on your milestone!',
                template: 'milestone-email',
                variables: ['name', 'milestone', 'xp', 'level']
            },
            premiumOffer: {
                subject: '✨ Unlock Premium Features - Limited Time Offer',
                template: 'premium-offer',
                variables: ['name', 'discountCode', 'expiryDate']
            },
            reengagement: {
                subject: 'We miss you! Come back to SpeakFlow',
                template: 'reengagement',
                variables: ['name', 'challengeLink']
            },
            weeklyDigest: {
                subject: 'Your Weekly SpeakFlow Digest',
                template: 'weekly-digest',
                variables: ['name', 'stats', 'achievements', 'topScore']
            },
            feedback: {
                subject: 'Help us improve SpeakFlow',
                template: 'feedback-request',
                variables: ['name', 'feedbackLink']
            }
        };
    }
    
    async sendEmail(to, templateName, variables, options = {}) {
        const template = this.templates[templateName];
        if (!template) {
            console.error(`Template ${templateName} not found`);
            return false;
        }
        
        const email = {
            id: this.generateId(),
            to,
            subject: this.renderTemplate(template.subject, variables),
            html: await this.renderEmailTemplate(template.template, variables),
            variables,
            template: templateName,
            priority: options.priority || 'normal',
            scheduledFor: options.scheduledFor || new Date(),
            retryCount: 0,
            status: 'pending'
        };
        
        this.queue.push(email);
        this.processQueue();
        
        return email.id;
    }
    
    async sendBulk(recipients, templateName, variablesProvider, options = {}) {
        const emailIds = [];
        
        for (const recipient of recipients) {
            const variables = typeof variablesProvider === 'function' 
                ? variablesProvider(recipient) 
                : variablesProvider;
            
            const emailId = await this.sendEmail(recipient.email, templateName, {
                name: recipient.name,
                ...variables
            }, options);
            
            emailIds.push(emailId);
            
            // Rate limiting
            await this.delay(100);
        }
        
        return emailIds;
    }
    
    async processQueue() {
        if (this.isProcessing) return;
        if (this.queue.length === 0) return;
        
        this.isProcessing = true;
        
        // Sort by priority and scheduled time
        const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
        this.queue.sort((a, b) => {
            if (a.priority !== b.priority) {
                return priorityOrder[a.priority] - priorityOrder[b.priority];
            }
            return new Date(a.scheduledFor) - new Date(b.scheduledFor);
        });
        
        while (this.queue.length > 0 && this.sentCount < MarketingConfig.email.maxPerDay) {
            const email = this.queue.shift();
            
            // Check if scheduled time has arrived
            if (new Date(email.scheduledFor) > new Date()) {
                this.queue.unshift(email);
                break;
            }
            
            const success = await this.sendEmailApi(email);
            
            if (success) {
                this.sentCount++;
                this.logSend(email);
            } else if (email.retryCount < MarketingConfig.campaigns.retryAttempts) {
                email.retryCount++;
                email.scheduledFor = new Date(Date.now() + MarketingConfig.campaigns.retryDelay);
                this.queue.push(email);
            } else {
                console.error(`Failed to send email ${email.id} after ${email.retryCount} attempts`);
                this.logFailure(email);
            }
            
            // Rate limiting
            await this.delay(60000 / MarketingConfig.email.rateLimit);
        }
        
        this.isProcessing = false;
        
        // Reset daily counter
        if (this.sentCount >= MarketingConfig.email.maxPerDay) {
            setTimeout(() => {
                this.sentCount = 0;
                this.processQueue();
            }, 24 * 60 * 60 * 1000);
        }
    }
    
    async sendEmailApi(email) {
        // In production, use SendGrid, AWS SES, etc.
        // For demo, simulate API call
        return new Promise((resolve) => {
            setTimeout(() => {
                console.log(`[Email] Sent to ${email.to}: ${email.subject}`);
                resolve(true);
            }, 100);
        });
        
        // Actual implementation:
        /*
        try {
            const response = await fetch(MarketingConfig.api.sendEmail, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(email)
            });
            return response.ok;
        } catch (error) {
            return false;
        }
        */
    }
    
    async renderEmailTemplate(templateName, variables) {
        // In production, use Handlebars or similar templating
        const templates = {
            'welcome-email': `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { text-align: center; padding: 20px; background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; border-radius: 10px; }
                        .button { display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 5px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>Welcome to SpeakFlow, {{name}}! 🎉</h1>
                        </div>
                        <p>We're excited to have you on board. Start your English speaking journey today!</p>
                        <a href="{{onboardingLink}}" class="button">Start Onboarding</a>
                        <p>Happy learning!<br>The SpeakFlow Team</p>
                    </div>
                </body>
                </html>
            `,
            'streak-reminder': `
                <div class="container">
                    <h2>🔥 Don't break your streak, {{name}}!</h2>
                    <p>You've been practicing for {{streakDays}} days in a row. Keep it going!</p>
                    <a href="{{practiceLink}}" class="button">Practice Now</a>
                </div>
            `,
            'milestone-email': `
                <div class="container">
                    <h2>🎉 Congratulations, {{name}}!</h2>
                    <p>You've reached {{milestone}}! You've earned {{xp}} XP and reached Level {{level}}.</p>
                    <a href="{{practiceLink}}" class="button">Continue Your Journey</a>
                </div>
            `
        };
        
        let html = templates[templateName] || '<p>Email content</p>';
        
        // Replace variables
        for (const [key, value] of Object.entries(variables)) {
            html = html.replace(new RegExp(`{{${key}}}`, 'g'), value);
        }
        
        return html;
    }
    
    renderTemplate(template, variables) {
        let result = template;
        for (const [key, value] of Object.entries(variables)) {
            result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
        }
        return result;
    }
    
    generateId() {
        return `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    logSend(email) {
        const log = {
            type: 'email_sent',
            emailId: email.id,
            to: email.to,
            template: email.template,
            timestamp: new Date().toISOString()
        };
        
        // Store in localStorage for demo
        const logs = JSON.parse(localStorage.getItem('email_logs') || '[]');
        logs.push(log);
        localStorage.setItem('email_logs', JSON.stringify(logs.slice(-100)));
    }
    
    logFailure(email) {
        const log = {
            type: 'email_failed',
            emailId: email.id,
            to: email.to,
            template: email.template,
            retries: email.retryCount,
            timestamp: new Date().toISOString()
        };
        
        const logs = JSON.parse(localStorage.getItem('email_logs') || '[]');
        logs.push(log);
        localStorage.setItem('email_logs', JSON.stringify(logs.slice(-100)));
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    getStats() {
        return {
            queueLength: this.queue.length,
            sentToday: this.sentCount,
            isProcessing: this.isProcessing
        };
    }
}

// ============================================
// PUSH NOTIFICATION SERVICE
// ============================================

class PushNotificationService {
    constructor() {
        this.subscribers = new Map();
        this.queue = [];
        this.permissionGranted = false;
        this.init();
    }
    
    async init() {
        await this.requestPermission();
        this.registerServiceWorker();
    }
    
    async requestPermission() {
        if ('Notification' in window) {
            const permission = await Notification.requestPermission();
            this.permissionGranted = permission === 'granted';
            
            if (this.permissionGranted) {
                console.log('Push notification permission granted');
            }
        }
    }
    
    async registerServiceWorker() {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            try {
                const registration = await navigator.serviceWorker.register(MarketingConfig.push.serviceWorkerPath);
                const subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: MarketingConfig.push.vapidPublicKey
                });
                
                this.subscribers.set('default', subscription);
                await this.saveSubscription(subscription);
                
                console.log('Push notification service worker registered');
            } catch (error) {
                console.error('Failed to register push service worker:', error);
            }
        }
    }
    
    async saveSubscription(subscription) {
        // In production, save to backend
        localStorage.setItem('push_subscription', JSON.stringify(subscription));
    }
    
    async sendNotification(title, body, options = {}) {
        if (!this.permissionGranted) {
            console.warn('Push notifications not permitted');
            return false;
        }
        
        const notification = {
            id: this.generateId(),
            title,
            body,
            icon: options.icon || '/images/icons/icon-192x192.png',
            badge: options.badge || '/images/icons/badge-72x72.png',
            tag: options.tag || 'general',
            data: options.data || {},
            actions: options.actions || [],
            timestamp: new Date().toISOString(),
            status: 'pending'
        };
        
        this.queue.push(notification);
        this.processQueue();
        
        return notification.id;
    }
    
    async sendBulk(notifications) {
        const ids = [];
        for (const notif of notifications) {
            const id = await this.sendNotification(notif.title, notif.body, notif.options);
            ids.push(id);
            await this.delay(100);
        }
        return ids;
    }
    
    async processQueue() {
        while (this.queue.length > 0) {
            const notification = this.queue.shift();
            
            if (document.hidden) {
                // Show system notification
                this.showSystemNotification(notification);
            } else {
                // Show in-app notification
                this.showInAppNotification(notification);
            }
            
            this.logSend(notification);
            await this.delay(1000);
        }
    }
    
    showSystemNotification(notification) {
        if (this.permissionGranted && 'Notification' in window) {
            const n = new Notification(notification.title, {
                body: notification.body,
                icon: notification.icon,
                badge: notification.badge,
                tag: notification.tag,
                data: notification.data,
                actions: notification.actions
            });
            
            n.onclick = () => {
                window.focus();
                if (notification.data.url) {
                    window.location.href = notification.data.url;
                }
                n.close();
            };
        }
    }
    
    showInAppNotification(notification) {
        const event = new CustomEvent('speakflow:notification', {
            detail: notification
        });
        document.dispatchEvent(event);
    }
    
    generateId() {
        return `push_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    logSend(notification) {
        console.log(`[Push] Sent: ${notification.title}`);
        
        const logs = JSON.parse(localStorage.getItem('push_logs') || '[]');
        logs.push({
            id: notification.id,
            title: notification.title,
            timestamp: notification.timestamp
        });
        localStorage.setItem('push_logs', JSON.stringify(logs.slice(-100)));
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    getStats() {
        return {
            queueLength: this.queue.length,
            permissionGranted: this.permissionGranted,
            subscribers: this.subscribers.size
        };
    }
}

// ============================================
// CAMPAIGN MANAGER
// ============================================

class CampaignManager {
    constructor(emailService, pushService) {
        this.email = emailService;
        this.push = pushService;
        this.campaigns = new Map();
        this.activeCampaigns = new Map();
        this.init();
    }
    
    init() {
        this.loadCampaigns();
        this.startScheduler();
    }
    
    loadCampaigns() {
        const saved = localStorage.getItem('marketing_campaigns');
        if (saved) {
            try {
                const campaigns = JSON.parse(saved);
                campaigns.forEach(c => this.campaigns.set(c.id, c));
            } catch (e) {
                console.error('Failed to load campaigns:', e);
            }
        }
        
        if (this.campaigns.size === 0) {
            this.createDefaultCampaigns();
        }
    }
    
    createDefaultCampaigns() {
        const defaultCampaigns = [
            {
                id: 'welcome_series',
                name: 'Welcome Series',
                type: 'email',
                trigger: 'user_registered',
                delay: 0,
                template: 'welcome',
                active: true
            },
            {
                id: 'streak_reminder',
                name: 'Streak Reminder',
                type: 'push',
                trigger: 'streak_at_risk',
                delay: 0,
                template: 'streak_reminder',
                active: true
            },
            {
                id: 'weekly_digest',
                name: 'Weekly Digest',
                type: 'email',
                trigger: 'weekly',
                delay: 7 * 24 * 60 * 60 * 1000,
                template: 'weekly_digest',
                active: true
            },
            {
                id: 'reengagement',
                name: 'Re-engagement Campaign',
                type: 'email',
                trigger: 'inactive_7_days',
                delay: 7 * 24 * 60 * 60 * 1000,
                template: 'reengagement',
                active: true
            },
            {
                id: 'milestone_celebrations',
                name: 'Milestone Celebrations',
                type: 'both',
                trigger: 'milestone_reached',
                delay: 0,
                template: 'milestone',
                active: true
            }
        ];
        
        defaultCampaigns.forEach(c => {
            this.campaigns.set(c.id, c);
        });
        
        this.saveCampaigns();
    }
    
    saveCampaigns() {
        const campaignsArray = Array.from(this.campaigns.values());
        localStorage.setItem('marketing_campaigns', JSON.stringify(campaignsArray));
    }
    
    startScheduler() {
        // Check for scheduled campaigns every minute
        setInterval(() => {
            this.processTriggers();
        }, 60000);
    }
    
    async processTriggers() {
        const now = new Date();
        
        for (const campaign of this.campaigns.values()) {
            if (!campaign.active) continue;
            if (this.activeCampaigns.has(campaign.id)) continue;
            
            const shouldRun = await this.checkTrigger(campaign);
            if (shouldRun) {
                this.executeCampaign(campaign);
            }
        }
    }
    
    async checkTrigger(campaign) {
        // In production, check database for trigger conditions
        // For demo, simulate trigger check
        switch (campaign.trigger) {
            case 'user_registered':
                return this.hasNewUsers();
            case 'streak_at_risk':
                return this.hasStreakAtRisk();
            case 'weekly':
                return this.isWeeklyDigestDay();
            case 'inactive_7_days':
                return this.hasInactiveUsers();
            case 'milestone_reached':
                return this.hasMilestoneReached();
            default:
                return false;
        }
    }
    
    hasNewUsers() {
        // Simulate new users check
        const lastRun = localStorage.getItem('last_welcome_run');
        const now = Date.now();
        if (!lastRun || now - parseInt(lastRun) > 24 * 60 * 60 * 1000) {
            localStorage.setItem('last_welcome_run', now.toString());
            return true;
        }
        return false;
    }
    
    hasStreakAtRisk() {
        // Simulate streak at risk check
        return Math.random() < 0.3;
    }
    
    isWeeklyDigestDay() {
        const today = new Date().getDay();
        return today === 1; // Monday
    }
    
    hasInactiveUsers() {
        return Math.random() < 0.2;
    }
    
    hasMilestoneReached() {
        return Math.random() < 0.1;
    }
    
    async executeCampaign(campaign) {
        this.activeCampaigns.set(campaign.id, {
            campaign,
            startedAt: new Date(),
            status: 'running'
        });
        
        console.log(`[Campaign] Starting: ${campaign.name}`);
        
        // Get target users based on campaign
        const users = await this.getTargetUsers(campaign);
        
        if (users.length === 0) {
            console.log(`[Campaign] No users found for ${campaign.name}`);
            this.activeCampaigns.delete(campaign.id);
            return;
        }
        
        // Execute based on type
        if (campaign.type === 'email' || campaign.type === 'both') {
            await this.email.sendBulk(users, campaign.template, (user) => ({
                name: user.name,
                ...this.getTemplateVariables(campaign, user)
            }));
        }
        
        if (campaign.type === 'push' || campaign.type === 'both') {
            for (const user of users.slice(0, 100)) {
                await this.push.sendNotification(
                    this.getPushTitle(campaign, user),
                    this.getPushBody(campaign, user),
                    { data: { userId: user.id, campaignId: campaign.id } }
                );
            }
        }
        
        this.activeCampaigns.delete(campaign.id);
        
        // Update last run
        campaign.lastRun = new Date().toISOString();
        this.saveCampaigns();
        
        console.log(`[Campaign] Completed: ${campaign.name} (${users.length} users)`);
    }
    
    async getTargetUsers(campaign) {
        // In production, query database for users matching segment
        // For demo, return simulated users
        return [
            { id: 1, name: 'John Doe', email: 'john@example.com', streak: 5, level: 3, xp: 1250 },
            { id: 2, name: 'Jane Smith', email: 'jane@example.com', streak: 12, level: 7, xp: 3400 }
        ];
    }
    
    getTemplateVariables(campaign, user) {
        const variables = {
            name: user.name,
            streakDays: user.streak,
            level: user.level,
            xp: user.xp
        };
        
        switch (campaign.template) {
            case 'welcome':
                variables.onboardingLink = `${window.location.origin}/onboarding`;
                break;
            case 'streak_reminder':
                variables.practiceLink = `${window.location.origin}/practice`;
                break;
            case 'milestone':
                variables.milestone = this.getMilestoneName(user.xp);
                break;
        }
        
        return variables;
    }
    
    getPushTitle(campaign, user) {
        const titles = {
            streak_reminder: `🔥 ${user.name}, don't break your ${user.streak}-day streak!`,
            milestone: `🎉 Congratulations ${user.name}!`,
            reengagement: `👋 We miss you, ${user.name}!`
        };
        return titles[campaign.template] || `SpeakFlow Update for ${user.name}`;
    }
    
    getPushBody(campaign, user) {
        const bodies = {
            streak_reminder: 'Practice today to keep your streak alive!',
            milestone: `You've reached a new milestone! Keep going!`,
            reengagement: 'Come back and practice for bonus XP!'
        };
        return bodies[campaign.template] || 'Check out your latest progress on SpeakFlow.';
    }
    
    getMilestoneName(xp) {
        if (xp >= 10000) return 'English Master';
        if (xp >= 5000) return 'Fluent Speaker';
        if (xp >= 1000) return 'Advanced Learner';
        return 'Dedicated Learner';
    }
    
    createCampaign(campaignData) {
        const id = `campaign_${Date.now()}`;
        const campaign = {
            id,
            ...campaignData,
            createdAt: new Date().toISOString(),
            active: true
        };
        
        this.campaigns.set(id, campaign);
        this.saveCampaigns();
        
        return campaign;
    }
    
    updateCampaign(id, updates) {
        const campaign = this.campaigns.get(id);
        if (!campaign) return null;
        
        Object.assign(campaign, updates);
        this.saveCampaigns();
        
        return campaign;
    }
    
    deleteCampaign(id) {
        const deleted = this.campaigns.delete(id);
        this.saveCampaigns();
        return deleted;
    }
    
    getCampaigns() {
        return Array.from(this.campaigns.values());
    }
    
    getActiveCampaigns() {
        return Array.from(this.activeCampaigns.values());
    }
}

// ============================================
// USER SEGMENTATION
// ============================================

class UserSegmentation {
    constructor() {
        this.segments = MarketingConfig.segments;
        this.userSegments = new Map();
    }
    
    async getUserSegment(userId) {
        if (this.userSegments.has(userId)) {
            return this.userSegments.get(userId);
        }
        
        const user = await this.getUserData(userId);
        const segment = this.determineSegment(user);
        
        this.userSegments.set(userId, segment);
        return segment;
    }
    
    async getUserData(userId) {
        // In production, fetch from database
        return {
            id: userId,
            lastActive: Math.random() * 30,
            isPremium: Math.random() < 0.1,
            createdAt: Math.random() * 60,
            xp: Math.random() * 5000,
            streak: Math.floor(Math.random() * 30)
        };
    }
    
    determineSegment(user) {
        for (const [segmentName, config] of Object.entries(this.segments)) {
            if (this.evaluateCondition(config.condition, user)) {
                return segmentName;
            }
        }
        return 'general';
    }
    
    evaluateCondition(condition, user) {
        // Simple condition evaluator
        // In production, use more robust expression parser
        try {
            // Replace operators
            const expr = condition
                .replace(/lastActive/g, user.lastActive)
                .replace(/isPremium/g, user.isPremium)
                .replace(/createdAt/g, user.createdAt)
                .replace(/xp/g, user.xp)
                .replace(/streak/g, user.streak);
            
            // Handle numeric comparisons
            if (expr.includes('<')) {
                const [left, right] = expr.split('<');
                return parseFloat(left) < parseFloat(right);
            }
            if (expr.includes('>')) {
                const [left, right] = expr.split('>');
                return parseFloat(left) > parseFloat(right);
            }
            if (expr.includes('===')) {
                const [left, right] = expr.split('===');
                return left.trim() === right.trim();
            }
            
            return false;
        } catch (e) {
            return false;
        }
    }
    
    async getUsersInSegment(segmentName) {
        // In production, query database
        // For demo, return count
        const counts = {
            active: 1250,
            atRisk: 340,
            churned: 890,
            premium: 125,
            newUser: 78
        };
        
        return counts[segmentName] || 0;
    }
    
    async getSegmentMetrics(segmentName) {
        const users = await this.getUsersInSegment(segmentName);
        
        return {
            segment: segmentName,
            userCount: users,
            conversionRate: Math.random() * 20,
            retentionRate: 50 + Math.random() * 40,
            averageScore: 60 + Math.random() * 30
        };
    }
}

// ============================================
// MARKETING UI CONTROLLER
// ============================================

class MarketingUIController {
    constructor(campaignManager, segmentation) {
        this.campaignManager = campaignManager;
        this.segmentation = segmentation;
        this.elements = {};
        this.init();
    }
    
    init() {
        this.bindElements();
        this.bindEvents();
        this.renderDashboard();
        this.startAutoRefresh();
    }
    
    bindElements() {
        this.elements = {
            campaignsList: document.getElementById('campaignsList'),
            campaignStats: document.getElementById('campaignStats'),
            createCampaignBtn: document.getElementById('createCampaignBtn'),
            triggerCampaignBtn: document.getElementById('triggerCampaignBtn'),
            editFlowBtn: document.getElementById('editFlowBtn'),
            optimizeBtn: document.getElementById('optimizeBtn')
        };
    }
    
    bindEvents() {
        if (this.elements.createCampaignBtn) {
            this.elements.createCampaignBtn.addEventListener('click', () => this.showCreateCampaignModal());
        }
        
        if (this.elements.triggerCampaignBtn) {
            this.elements.triggerCampaignBtn.addEventListener('click', () => this.triggerManualCampaign());
        }
        
        if (this.elements.editFlowBtn) {
            this.elements.editFlowBtn.addEventListener('click', () => this.showEditFlowModal());
        }
        
        if (this.elements.optimizeBtn) {
            this.elements.optimizeBtn.addEventListener('click', () => this.showOptimizationModal());
        }
    }
    
    renderDashboard() {
        this.renderCampaigns();
        this.renderStats();
    }
    
    renderCampaigns() {
        const campaigns = this.campaignManager.getCampaigns();
        
        if (this.elements.campaignsList) {
            this.elements.campaignsList.innerHTML = campaigns.map(campaign => `
                <div class="campaign-card">
                    <div class="campaign-header">
                        <h3>${campaign.name}</h3>
                        <span class="campaign-status ${campaign.active ? 'active' : 'inactive'}">
                            ${campaign.active ? 'Active' : 'Inactive'}
                        </span>
                    </div>
                    <div class="campaign-details">
                        <div class="detail">
                            <span class="label">Type:</span>
                            <span class="value">${campaign.type}</span>
                        </div>
                        <div class="detail">
                            <span class="label">Trigger:</span>
                            <span class="value">${campaign.trigger}</span>
                        </div>
                        <div class="detail">
                            <span class="label">Template:</span>
                            <span class="value">${campaign.template}</span>
                        </div>
                    </div>
                    <div class="campaign-actions">
                        <button class="btn btn-sm btn-outline edit-campaign" data-id="${campaign.id}">Edit</button>
                        <button class="btn btn-sm ${campaign.active ? 'btn-outline' : 'btn-primary'} toggle-campaign" data-id="${campaign.id}">
                            ${campaign.active ? 'Pause' : 'Activate'}
                        </button>
                        <button class="btn btn-sm btn-danger delete-campaign" data-id="${campaign.id}">Delete</button>
                    </div>
                </div>
            `).join('');
            
            // Attach event listeners
            document.querySelectorAll('.edit-campaign').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = btn.dataset.id;
                    this.showEditCampaignModal(id);
                });
            });
            
            document.querySelectorAll('.toggle-campaign').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = btn.dataset.id;
                    this.toggleCampaign(id);
                });
            });
            
            document.querySelectorAll('.delete-campaign').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = btn.dataset.id;
                    this.deleteCampaign(id);
                });
            });
        }
    }
    
    async renderStats() {
        const activeCampaigns = this.campaignManager.getActiveCampaigns();
        const campaigns = this.campaignManager.getCampaigns();
        
        const stats = {
            totalCampaigns: campaigns.length,
            activeCampaigns: activeCampaigns.length,
            emailsSent: this.getEmailsSentToday(),
            pushSent: this.getPushSentToday(),
            openRate: 42,
            clickRate: 18
        };
        
        if (this.elements.campaignStats) {
            this.elements.campaignStats.innerHTML = `
                <div class="stats-grid">
                    <div class="stat">
                        <div class="stat-value">${stats.totalCampaigns}</div>
                        <div class="stat-label">Total Campaigns</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">${stats.activeCampaigns}</div>
                        <div class="stat-label">Active Now</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">${stats.emailsSent}</div>
                        <div class="stat-label">Emails Today</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">${stats.pushSent}</div>
                        <div class="stat-label">Push Today</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">${stats.openRate}%</div>
                        <div class="stat-label">Open Rate</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">${stats.clickRate}%</div>
                        <div class="stat-label">Click Rate</div>
                    </div>
                </div>
            `;
        }
    }
    
    getEmailsSentToday() {
        const logs = JSON.parse(localStorage.getItem('email_logs') || '[]');
        const today = new Date().toDateString();
        return logs.filter(l => new Date(l.timestamp).toDateString() === today).length;
    }
    
    getPushSentToday() {
        const logs = JSON.parse(localStorage.getItem('push_logs') || '[]');
        const today = new Date().toDateString();
        return logs.filter(l => new Date(l.timestamp).toDateString() === today).length;
    }
    
    showCreateCampaignModal() {
        const modalHtml = `
            <div class="modal active">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>Create Campaign</h2>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label class="form-label">Campaign Name</label>
                            <input type="text" id="campaignName" class="form-control" placeholder="e.g., Welcome Series">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Campaign Type</label>
                            <select id="campaignType" class="form-control">
                                <option value="email">Email</option>
                                <option value="push">Push Notification</option>
                                <option value="both">Both</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Trigger</label>
                            <select id="campaignTrigger" class="form-control">
                                <option value="user_registered">User Registered</option>
                                <option value="streak_at_risk">Streak at Risk</option>
                                <option value="weekly">Weekly Digest</option>
                                <option value="inactive_7_days">Inactive 7 Days</option>
                                <option value="milestone_reached">Milestone Reached</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Template</label>
                            <select id="campaignTemplate" class="form-control">
                                <option value="welcome">Welcome</option>
                                <option value="streak_reminder">Streak Reminder</option>
                                <option value="weekly_digest">Weekly Digest</option>
                                <option value="reengagement">Re-engagement</option>
                                <option value="milestone">Milestone</option>
                            </select>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-primary" id="createCampaignConfirm">Create Campaign</button>
                        <button class="btn btn-outline modal-close">Cancel</button>
                    </div>
                </div>
            </div>
        `;
        
        const modal = document.createElement('div');
        modal.innerHTML = modalHtml;
        document.body.appendChild(modal);
        
        modal.querySelector('#createCampaignConfirm')?.addEventListener('click', () => {
            const name = modal.querySelector('#campaignName').value;
            const type = modal.querySelector('#campaignType').value;
            const trigger = modal.querySelector('#campaignTrigger').value;
            const template = modal.querySelector('#campaignTemplate').value;
            
            if (name) {
                this.campaignManager.createCampaign({
                    name,
                    type,
                    trigger,
                    template,
                    active: true
                });
                
                this.renderCampaigns();
                modal.remove();
                this.showToast('Campaign created successfully!');
            } else {
                alert('Please enter a campaign name');
            }
        });
        
        modal.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => modal.remove());
        });
    }
    
    showEditCampaignModal(campaignId) {
        const campaign = this.campaignManager.campaigns.get(campaignId);
        if (!campaign) return;
        
        const modalHtml = `
            <div class="modal active">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>Edit Campaign: ${campaign.name}</h2>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label class="form-label">Campaign Name</label>
                            <input type="text" id="campaignName" class="form-control" value="${campaign.name}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Campaign Type</label>
                            <select id="campaignType" class="form-control">
                                <option value="email" ${campaign.type === 'email' ? 'selected' : ''}>Email</option>
                                <option value="push" ${campaign.type === 'push' ? 'selected' : ''}>Push Notification</option>
                                <option value="both" ${campaign.type === 'both' ? 'selected' : ''}>Both</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Template</label>
                            <select id="campaignTemplate" class="form-control">
                                <option value="welcome" ${campaign.template === 'welcome' ? 'selected' : ''}>Welcome</option>
                                <option value="streak_reminder" ${campaign.template === 'streak_reminder' ? 'selected' : ''}>Streak Reminder</option>
                                <option value="weekly_digest" ${campaign.template === 'weekly_digest' ? 'selected' : ''}>Weekly Digest</option>
                                <option value="reengagement" ${campaign.template === 'reengagement' ? 'selected' : ''}>Re-engagement</option>
                                <option value="milestone" ${campaign.template === 'milestone' ? 'selected' : ''}>Milestone</option>
                            </select>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-primary" id="saveCampaignBtn">Save Changes</button>
                        <button class="btn btn-outline modal-close">Cancel</button>
                    </div>
                </div>
            </div>
        `;
        
        const modal = document.createElement('div');
        modal.innerHTML = modalHtml;
        document.body.appendChild(modal);
        
        modal.querySelector('#saveCampaignBtn')?.addEventListener('click', () => {
            const updates = {
                name: modal.querySelector('#campaignName').value,
                type: modal.querySelector('#campaignType').value,
                template: modal.querySelector('#campaignTemplate').value
            };
            
            this.campaignManager.updateCampaign(campaignId, updates);
            this.renderCampaigns();
            modal.remove();
            this.showToast('Campaign updated successfully!');
        });
        
        modal.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => modal.remove());
        });
    }
    
    toggleCampaign(campaignId) {
        const campaign = this.campaignManager.campaigns.get(campaignId);
        if (campaign) {
            this.campaignManager.updateCampaign(campaignId, { active: !campaign.active });
            this.renderCampaigns();
            this.showToast(`Campaign ${campaign.active ? 'activated' : 'paused'}!`);
        }
    }
    
    deleteCampaign(campaignId) {
        if (confirm('Are you sure you want to delete this campaign?')) {
            this.campaignManager.deleteCampaign(campaignId);
            this.renderCampaigns();
            this.showToast('Campaign deleted!');
        }
    }
    
    triggerManualCampaign() {
        const modalHtml = `
            <div class="modal active">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>Manual Campaign Trigger</h2>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label class="form-label">Select Campaign</label>
                            <select id="manualCampaign" class="form-control">
                                ${this.campaignManager.getCampaigns().map(c => `
                                    <option value="${c.id}">${c.name}</option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Target Segment</label>
                            <select id="manualSegment" class="form-control">
                                <option value="all">All Users</option>
                                <option value="active">Active Users</option>
                                <option value="atRisk">At Risk Users</option>
                                <option value="premium">Premium Users</option>
                            </select>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-primary" id="triggerNowBtn">Trigger Now</button>
                        <button class="btn btn-outline modal-close">Cancel</button>
                    </div>
                </div>
            </div>
        `;
        
        const modal = document.createElement('div');
        modal.innerHTML = modalHtml;
        document.body.appendChild(modal);
        
        modal.querySelector('#triggerNowBtn')?.addEventListener('click', async () => {
            const campaignId = modal.querySelector('#manualCampaign').value;
            const campaign = this.campaignManager.campaigns.get(campaignId);
            
            if (campaign) {
                await this.campaignManager.executeCampaign(campaign);
                modal.remove();
                this.showToast('Campaign triggered successfully!');
            }
        });
        
        modal.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => modal.remove());
        });
    }
    
    showEditFlowModal() {
        const modalHtml = `
            <div class="modal active">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>Edit Re-engagement Flow</h2>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label class="form-label">Day 7 Message</label>
                            <textarea class="form-control" rows="2">We miss you! Come back and practice.</textarea>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Day 14 Message</label>
                            <textarea class="form-control" rows="2">Your progress is waiting. Don't give up!</textarea>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Day 21 Message</label>
                            <textarea class="form-control" rows="2">Special offer: 30% off Premium for returning users!</textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-primary" id="saveFlowBtn">Save Flow</button>
                        <button class="btn btn-outline modal-close">Cancel</button>
                    </div>
                </div>
            </div>
        `;
        
        const modal = document.createElement('div');
        modal.innerHTML = modalHtml;
        document.body.appendChild(modal);
        
        modal.querySelector('#saveFlowBtn')?.addEventListener('click', () => {
            modal.remove();
            this.showToast('Re-engagement flow updated!');
        });
        
        modal.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => modal.remove());
        });
    }
    
    showOptimizationModal() {
        const modalHtml = `
            <div class="modal active">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>Campaign Optimization</h2>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <h3>AI Recommendations</h3>
                        <ul>
                            <li>📧 Best send time: 10:00 AM (42% open rate)</li>
                            <li>🎯 Highest converting segment: Active users (8.5% conversion)</li>
                            <li>📊 A/B test suggested: Subject line variation</li>
                            <li>⏰ Increase frequency for at-risk users</li>
                        </ul>
                        <button class="btn btn-primary" id="applyOptimizationsBtn">Apply Optimizations</button>
                    </div>
                </div>
            </div>
        `;
        
        const modal = document.createElement('div');
        modal.innerHTML = modalHtml;
        document.body.appendChild(modal);
        
        modal.querySelector('#applyOptimizationsBtn')?.addEventListener('click', () => {
            modal.remove();
            this.showToast('Optimizations applied to active campaigns!');
        });
        
        modal.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => modal.remove());
        });
    }
    
    startAutoRefresh() {
        setInterval(() => {
            this.renderStats();
        }, 30000);
    }
    
    showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => toast.remove(), 3000);
    }
}

// ============================================
// EXPORTS
// ============================================

// Initialize marketing system
const emailService = new EmailService();
const pushService = new PushNotificationService();
const campaignManager = new CampaignManager(emailService, pushService);
const userSegmentation = new UserSegmentation();
const marketingUI = new MarketingUIController(campaignManager, userSegmentation);

// Global exports
window.SpeakFlow = window.SpeakFlow || {};
window.SpeakFlow.Marketing = {
    email: emailService,
    push: pushService,
    campaigns: campaignManager,
    segmentation: userSegmentation,
    ui: marketingUI,
    config: MarketingConfig
};

// Module exports
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        MarketingConfig,
        EmailService,
        PushNotificationService,
        CampaignManager,
        UserSegmentation,
        MarketingUIController
    };
}

// ============================================
// AUTO-INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('Marketing Automation module initialized');
    
    // Debug mode
    if (window.location.hostname === 'localhost') {
        window.debugMarketing = {
            email: emailService,
            push: pushService,
            campaigns: campaignManager,
            segmentation: userSegmentation
        };
        console.log('Marketing debug mode enabled');
    }
});
