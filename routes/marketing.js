/* ============================================
   SPEAKFLOW - MARKETING MODULE
   Version: 1.0.0
   Handles marketing automation, campaigns, email, and push notifications
   ============================================ */

const { validationResult } = require('express-validator');
const { body, param, query } = require('express-validator');
const crypto = require('crypto');

// ============================================
// CONFIGURATION
// ============================================

const MarketingConfig = {
    // Email Settings
    email: {
        fromName: 'SpeakFlow Team',
        fromEmail: 'hello@speakflow.com',
        replyTo: 'support@speakflow.com',
        maxPerDay: 10000,
        rateLimit: 100, // per minute
        retryAttempts: 3,
        retryDelay: 300000 // 5 minutes
    },
    
    // Push Notification Settings
    push: {
        vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
        vapidPrivateKey: process.env.VAPID_PRIVATE_KEY,
        maxPerDay: 5000,
        ttl: 86400 // 24 hours
    },
    
    // Campaign Settings
    campaigns: {
        maxConcurrent: 10,
        defaultPriority: 'normal',
        retryAttempts: 3,
        retryDelay: 3600000, // 1 hour
        scheduleInterval: 60000 // 1 minute
    },
    
    // Segmentation
    segments: {
        cacheTTL: 300, // 5 minutes
        maxConditions: 10,
        updateInterval: 3600000 // 1 hour
    },
    
    // Templates
    templates: {
        cacheTTL: 3600, // 1 hour
        maxSize: 50
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

class MarketingModel {
    constructor() {
        this.campaigns = [];
        this.emailQueue = [];
        this.pushQueue = [];
        this.templates = [];
        this.segments = [];
        this.subscribers = [];
        this.analytics = [];
    }
    
    // Campaign Management
    async createCampaign(campaignData) {
        const campaign = {
            id: this.campaigns.length + 1,
            campaignId: this.generateCampaignId(),
            name: campaignData.name,
            description: campaignData.description,
            type: campaignData.type,
            channel: campaignData.channel,
            templateId: campaignData.templateId,
            segmentId: campaignData.segmentId,
            schedule: campaignData.schedule,
            status: campaignData.status || 'draft',
            priority: campaignData.priority || 'normal',
            settings: campaignData.settings || {},
            metadata: campaignData.metadata || {},
            stats: {
                sent: 0,
                delivered: 0,
                opened: 0,
                clicked: 0,
                converted: 0,
                bounced: 0,
                failed: 0
            },
            createdBy: campaignData.createdBy,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            sentAt: null,
            completedAt: null
        };
        
        this.campaigns.push(campaign);
        return campaign;
    }
    
    generateCampaignId() {
        return `camp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    }
    
    async findCampaignById(id) {
        return this.campaigns.find(c => c.id === parseInt(id));
    }
    
    async findCampaignByCampaignId(campaignId) {
        return this.campaigns.find(c => c.campaignId === campaignId);
    }
    
    async findAllCampaigns(filters = {}, options = {}) {
        let results = [...this.campaigns];
        
        if (filters.status) {
            results = results.filter(c => c.status === filters.status);
        }
        if (filters.type) {
            results = results.filter(c => c.type === filters.type);
        }
        if (filters.channel) {
            results = results.filter(c => c.channel === filters.channel);
        }
        
        const sortBy = options.sortBy || 'createdAt';
        const sortOrder = options.sortOrder === 'asc' ? 1 : -1;
        results.sort((a, b) => {
            if (a[sortBy] < b[sortBy]) return -sortOrder;
            if (a[sortBy] > b[sortBy]) return sortOrder;
            return 0;
        });
        
        const page = options.page || 1;
        const limit = Math.min(options.limit || MarketingConfig.pagination.defaultLimit, MarketingConfig.pagination.maxLimit);
        const start = (page - 1) * limit;
        const end = start + limit;
        
        return {
            campaigns: results.slice(start, end),
            total: results.length,
            page,
            limit,
            totalPages: Math.ceil(results.length / limit)
        };
    }
    
    async updateCampaign(id, updates) {
        const index = this.campaigns.findIndex(c => c.id === parseInt(id));
        if (index === -1) return null;
        
        const allowedUpdates = ['name', 'description', 'schedule', 'status', 'priority', 'settings', 'metadata'];
        const filteredUpdates = {};
        
        for (const key of allowedUpdates) {
            if (updates[key] !== undefined) {
                filteredUpdates[key] = updates[key];
            }
        }
        
        this.campaigns[index] = {
            ...this.campaigns[index],
            ...filteredUpdates,
            updatedAt: new Date().toISOString()
        };
        
        return this.campaigns[index];
    }
    
    async updateCampaignStats(campaignId, stats) {
        const campaign = await this.findCampaignById(campaignId);
        if (!campaign) return null;
        
        campaign.stats = { ...campaign.stats, ...stats };
        return campaign;
    }
    
    // Email Queue
    async addToEmailQueue(emailData) {
        const email = {
            id: this.emailQueue.length + 1,
            emailId: this.generateEmailId(),
            campaignId: emailData.campaignId,
            to: emailData.to,
            subject: emailData.subject,
            html: emailData.html,
            text: emailData.text,
            variables: emailData.variables || {},
            attachments: emailData.attachments || [],
            priority: emailData.priority || 'normal',
            status: emailData.status || 'pending',
            attempts: 0,
            scheduledFor: emailData.scheduledFor || new Date().toISOString(),
            metadata: emailData.metadata || {},
            createdAt: new Date().toISOString(),
            sentAt: null
        };
        
        this.emailQueue.push(email);
        return email;
    }
    
    generateEmailId() {
        return `email_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    }
    
    async getPendingEmails(limit = 100) {
        const now = new Date().toISOString();
        return this.emailQueue.filter(e => 
            e.status === 'pending' && 
            e.scheduledFor <= now &&
            e.attempts < MarketingConfig.email.retryAttempts
        ).slice(0, limit);
    }
    
    async updateEmailStatus(emailId, status, metadata = {}) {
        const email = this.emailQueue.find(e => e.emailId === emailId);
        if (!email) return null;
        
        email.status = status;
        if (status === 'sent') {
            email.sentAt = new Date().toISOString();
        }
        if (metadata.error) {
            email.error = metadata.error;
            email.attempts++;
        }
        
        return email;
    }
    
    // Push Queue
    async addToPushQueue(pushData) {
        const push = {
            id: this.pushQueue.length + 1,
            pushId: this.generatePushId(),
            campaignId: pushData.campaignId,
            userId: pushData.userId,
            subscription: pushData.subscription,
            title: pushData.title,
            body: pushData.body,
            icon: pushData.icon,
            url: pushData.url,
            priority: pushData.priority || 'normal',
            status: pushData.status || 'pending',
            attempts: 0,
            scheduledFor: pushData.scheduledFor || new Date().toISOString(),
            metadata: pushData.metadata || {},
            createdAt: new Date().toISOString(),
            sentAt: null
        };
        
        this.pushQueue.push(push);
        return push;
    }
    
    generatePushId() {
        return `push_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    }
    
    async getPendingPushes(limit = 100) {
        const now = new Date().toISOString();
        return this.pushQueue.filter(p => 
            p.status === 'pending' && 
            p.scheduledFor <= now &&
            p.attempts < MarketingConfig.campaigns.retryAttempts
        ).slice(0, limit);
    }
    
    async updatePushStatus(pushId, status, metadata = {}) {
        const push = this.pushQueue.find(p => p.pushId === pushId);
        if (!push) return null;
        
        push.status = status;
        if (status === 'sent') {
            push.sentAt = new Date().toISOString();
        }
        if (metadata.error) {
            push.error = metadata.error;
            push.attempts++;
        }
        
        return push;
    }
    
    // Templates
    async createTemplate(templateData) {
        const template = {
            id: this.templates.length + 1,
            templateId: this.generateTemplateId(),
            name: templateData.name,
            subject: templateData.subject,
            html: templateData.html,
            text: templateData.text,
            variables: templateData.variables || [],
            category: templateData.category,
            tags: templateData.tags || [],
            createdBy: templateData.createdBy,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        this.templates.push(template);
        return template;
    }
    
    generateTemplateId() {
        return `tpl_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    }
    
    async findTemplateById(id) {
        return this.templates.find(t => t.id === parseInt(id));
    }
    
    async findAllTemplates(filters = {}) {
        let results = [...this.templates];
        
        if (filters.category) {
            results = results.filter(t => t.category === filters.category);
        }
        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            results = results.filter(t => 
                t.name.toLowerCase().includes(searchLower) ||
                t.subject.toLowerCase().includes(searchLower)
            );
        }
        
        return results;
    }
    
    // Segments
    async createSegment(segmentData) {
        const segment = {
            id: this.segments.length + 1,
            segmentId: this.generateSegmentId(),
            name: segmentData.name,
            description: segmentData.description,
            conditions: segmentData.conditions,
            size: 0,
            createdBy: segmentData.createdBy,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        this.segments.push(segment);
        return segment;
    }
    
    generateSegmentId() {
        return `seg_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    }
    
    async findSegmentById(id) {
        return this.segments.find(s => s.id === parseInt(id));
    }
    
    async updateSegmentSize(segmentId, size) {
        const segment = await this.findSegmentById(segmentId);
        if (!segment) return null;
        
        segment.size = size;
        segment.updatedAt = new Date().toISOString();
        return segment;
    }
    
    // Subscribers
    async addSubscriber(subscriberData) {
        const existing = this.subscribers.find(s => s.email === subscriberData.email);
        if (existing) {
            return existing;
        }
        
        const subscriber = {
            id: this.subscribers.length + 1,
            email: subscriberData.email,
            name: subscriberData.name,
            userId: subscriberData.userId,
            preferences: subscriberData.preferences || {
                email: true,
                push: true,
                categories: ['general', 'practice', 'premium']
            },
            subscribedAt: new Date().toISOString(),
            unsubscribedAt: null,
            metadata: subscriberData.metadata || {}
        };
        
        this.subscribers.push(subscriber);
        return subscriber;
    }
    
    async unsubscribe(email) {
        const subscriber = this.subscribers.find(s => s.email === email);
        if (!subscriber) return null;
        
        subscriber.unsubscribedAt = new Date().toISOString();
        subscriber.preferences.email = false;
        return subscriber;
    }
    
    // Analytics
    async trackAnalytics(eventData) {
        const event = {
            id: this.analytics.length + 1,
            eventId: this.generateAnalyticsId(),
            campaignId: eventData.campaignId,
            type: eventData.type,
            emailId: eventData.emailId,
            pushId: eventData.pushId,
            userId: eventData.userId,
            metadata: eventData.metadata || {},
            timestamp: new Date().toISOString()
        };
        
        this.analytics.push(event);
        return event;
    }
    
    generateAnalyticsId() {
        return `anl_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    }
    
    async getCampaignAnalytics(campaignId) {
        const events = this.analytics.filter(a => a.campaignId === campaignId);
        
        const stats = {
            sent: events.filter(e => e.type === 'sent').length,
            delivered: events.filter(e => e.type === 'delivered').length,
            opened: events.filter(e => e.type === 'open').length,
            clicked: events.filter(e => e.type === 'click').length,
            converted: events.filter(e => e.type === 'conversion').length,
            bounced: events.filter(e => e.type === 'bounce').length,
            failed: events.filter(e => e.type === 'failed').length
        };
        
        stats.openRate = stats.sent > 0 ? (stats.opened / stats.sent) * 100 : 0;
        stats.clickRate = stats.opened > 0 ? (stats.clicked / stats.opened) * 100 : 0;
        stats.conversionRate = stats.clicked > 0 ? (stats.converted / stats.clicked) * 100 : 0;
        
        return stats;
    }
}

// ============================================
// MARKETING SERVICE
// ============================================

class MarketingService {
    constructor(marketingModel) {
        this.marketingModel = marketingModel;
        this.isProcessing = false;
        this.init();
    }
    
    init() {
        this.startQueueProcessor();
        this.startScheduler();
    }
    
    startQueueProcessor() {
        setInterval(() => {
            this.processEmailQueue();
            this.processPushQueue();
        }, 5000);
    }
    
    startScheduler() {
        setInterval(() => {
            this.checkScheduledCampaigns();
        }, MarketingConfig.campaigns.scheduleInterval);
    }
    
    async createCampaign(campaignData, userId) {
        const campaign = await this.marketingModel.createCampaign({
            ...campaignData,
            createdBy: userId,
            status: 'draft'
        });
        
        return campaign;
    }
    
    async scheduleCampaign(campaignId, scheduleData) {
        const campaign = await this.marketingModel.findCampaignById(campaignId);
        if (!campaign) {
            throw new Error('Campaign not found');
        }
        
        const updated = await this.marketingModel.updateCampaign(campaignId, {
            schedule: scheduleData,
            status: 'scheduled'
        });
        
        return updated;
    }
    
    async startCampaign(campaignId) {
        const campaign = await this.marketingModel.findCampaignById(campaignId);
        if (!campaign) {
            throw new Error('Campaign not found');
        }
        
        if (campaign.status !== 'scheduled' && campaign.status !== 'draft') {
            throw new Error(`Cannot start campaign with status: ${campaign.status}`);
        }
        
        const updated = await this.marketingModel.updateCampaign(campaignId, {
            status: 'running',
            sentAt: new Date().toISOString()
        });
        
        // Process campaign immediately
        await this.processCampaign(campaignId);
        
        return updated;
    }
    
    async pauseCampaign(campaignId) {
        const campaign = await this.marketingModel.findCampaignById(campaignId);
        if (!campaign) {
            throw new Error('Campaign not found');
        }
        
        if (campaign.status !== 'running') {
            throw new Error(`Cannot pause campaign with status: ${campaign.status}`);
        }
        
        const updated = await this.marketingModel.updateCampaign(campaignId, {
            status: 'paused'
        });
        
        return updated;
    }
    
    async stopCampaign(campaignId) {
        const campaign = await this.marketingModel.findCampaignById(campaignId);
        if (!campaign) {
            throw new Error('Campaign not found');
        }
        
        const updated = await this.marketingModel.updateCampaign(campaignId, {
            status: 'completed',
            completedAt: new Date().toISOString()
        });
        
        return updated;
    }
    
    async processCampaign(campaignId) {
        const campaign = await this.marketingModel.findCampaignById(campaignId);
        if (!campaign) return;
        
        const segment = await this.marketingModel.findSegmentById(campaign.segmentId);
        const template = await this.marketingModel.findTemplateById(campaign.templateId);
        
        if (!segment || !template) {
            await this.marketingModel.updateCampaign(campaignId, { status: 'failed' });
            return;
        }
        
        // Get users in segment
        const users = await this.getUsersInSegment(segment);
        
        if (campaign.channel === 'email') {
            await this.sendEmailCampaign(campaign, template, users);
        } else if (campaign.channel === 'push') {
            await this.sendPushCampaign(campaign, template, users);
        } else if (campaign.channel === 'both') {
            await this.sendEmailCampaign(campaign, template, users);
            await this.sendPushCampaign(campaign, template, users);
        }
        
        await this.marketingModel.updateCampaign(campaignId, {
            status: 'completed',
            completedAt: new Date().toISOString()
        });
    }
    
    async sendEmailCampaign(campaign, template, users) {
        for (const user of users) {
            const variables = this.prepareVariables(template, user);
            const subject = this.renderTemplate(template.subject, variables);
            const html = this.renderTemplate(template.html, variables);
            const text = this.renderTemplate(template.text, variables);
            
            await this.marketingModel.addToEmailQueue({
                campaignId: campaign.id,
                to: user.email,
                subject,
                html,
                text,
                variables,
                priority: campaign.priority,
                scheduledFor: campaign.schedule?.sendTime || new Date().toISOString()
            });
        }
    }
    
    async sendPushCampaign(campaign, template, users) {
        for (const user of users) {
            if (!user.pushSubscription) continue;
            
            const variables = this.prepareVariables(template, user);
            const title = this.renderTemplate(template.title || 'SpeakFlow Update', variables);
            const body = this.renderTemplate(template.body || 'Check out your latest progress!', variables);
            
            await this.marketingModel.addToPushQueue({
                campaignId: campaign.id,
                userId: user.id,
                subscription: user.pushSubscription,
                title,
                body,
                url: campaign.settings?.url || 'https://speakflow.com',
                priority: campaign.priority,
                scheduledFor: campaign.schedule?.sendTime || new Date().toISOString()
            });
        }
    }
    
    async processEmailQueue() {
        if (this.isProcessing) return;
        
        this.isProcessing = true;
        
        const emails = await this.marketingModel.getPendingEmails(50);
        
        for (const email of emails) {
            const success = await this.sendEmail(email);
            
            if (success) {
                await this.marketingModel.updateEmailStatus(email.emailId, 'sent');
                await this.marketingModel.trackAnalytics({
                    campaignId: email.campaignId,
                    type: 'sent',
                    emailId: email.emailId,
                    userId: email.metadata?.userId
                });
            } else {
                await this.marketingModel.updateEmailStatus(email.emailId, 'failed', { error: 'Send failed' });
                await this.marketingModel.trackAnalytics({
                    campaignId: email.campaignId,
                    type: 'failed',
                    emailId: email.emailId
                });
            }
            
            // Rate limiting
            await this.delay(60000 / MarketingConfig.email.rateLimit);
        }
        
        this.isProcessing = false;
    }
    
    async processPushQueue() {
        const pushes = await this.marketingModel.getPendingPushes(50);
        
        for (const push of pushes) {
            const success = await this.sendPush(push);
            
            if (success) {
                await this.marketingModel.updatePushStatus(push.pushId, 'sent');
                await this.marketingModel.trackAnalytics({
                    campaignId: push.campaignId,
                    type: 'sent',
                    pushId: push.pushId,
                    userId: push.userId
                });
            } else {
                await this.marketingModel.updatePushStatus(push.pushId, 'failed', { error: 'Send failed' });
            }
            
            await this.delay(100);
        }
    }
    
    async sendEmail(email) {
        // In production, use SendGrid, AWS SES, etc.
        console.log(`[Email] Sending to ${email.to}: ${email.subject}`);
        return true;
    }
    
    async sendPush(push) {
        // In production, use web-push library
        console.log(`[Push] Sending to user ${push.userId}: ${push.title}`);
        return true;
    }
    
    async getUsersInSegment(segment) {
        // In production, query database based on conditions
        // For demo, return simulated users
        const users = [];
        for (let i = 0; i < 100; i++) {
            users.push({
                id: i + 1,
                name: `User ${i + 1}`,
                email: `user${i + 1}@example.com`,
                isPremium: i % 10 === 0,
                xp: i * 100,
                level: Math.floor(i / 10) + 1,
                streak: i % 30,
                lastActive: new Date(Date.now() - (i % 30) * 24 * 60 * 60 * 1000)
            });
        }
        
        await this.marketingModel.updateSegmentSize(segment.id, users.length);
        return users;
    }
    
    prepareVariables(template, user) {
        return {
            name: user.name,
            email: user.email,
            isPremium: user.isPremium,
            xp: user.xp,
            level: user.level,
            streak: user.streak,
            practiceLink: 'https://speakflow.com/practice',
            profileLink: 'https://speakflow.com/profile',
            upgradeLink: 'https://speakflow.com/upgrade',
            unsubscribeLink: `https://speakflow.com/unsubscribe?email=${encodeURIComponent(user.email)}`,
            year: new Date().getFullYear(),
            ...template.variables
        };
    }
    
    renderTemplate(template, variables) {
        let result = template;
        for (const [key, value] of Object.entries(variables)) {
            result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
        }
        return result;
    }
    
    async checkScheduledCampaigns() {
        const campaigns = await this.marketingModel.findAllCampaigns({ status: 'scheduled' });
        
        const now = new Date();
        
        for (const campaign of campaigns.campaigns) {
            if (!campaign.schedule) continue;
            
            const scheduleTime = new Date(campaign.schedule.sendTime);
            if (scheduleTime <= now) {
                await this.startCampaign(campaign.id);
            }
        }
    }
    
    async createTemplate(templateData, userId) {
        const template = await this.marketingModel.createTemplate({
            ...templateData,
            createdBy: userId
        });
        
        return template;
    }
    
    async createSegment(segmentData, userId) {
        const segment = await this.marketingModel.createSegment({
            ...segmentData,
            createdBy: userId
        });
        
        return segment;
    }
    
    async subscribe(email, name, userId = null) {
        const subscriber = await this.marketingModel.addSubscriber({
            email,
            name,
            userId
        });
        
        return subscriber;
    }
    
    async unsubscribe(email) {
        const subscriber = await this.marketingModel.unsubscribe(email);
        return subscriber;
    }
    
    async trackOpen(emailId, campaignId) {
        await this.marketingModel.trackAnalytics({
            campaignId,
            type: 'open',
            emailId
        });
        
        // Update campaign stats
        const campaign = await this.marketingModel.findCampaignById(campaignId);
        if (campaign) {
            campaign.stats.opened++;
        }
    }
    
    async trackClick(emailId, campaignId, url) {
        await this.marketingModel.trackAnalytics({
            campaignId,
            type: 'click',
            emailId,
            metadata: { url }
        });
        
        const campaign = await this.marketingModel.findCampaignById(campaignId);
        if (campaign) {
            campaign.stats.clicked++;
        }
    }
    
    async getCampaignAnalytics(campaignId) {
        const campaign = await this.marketingModel.findCampaignById(campaignId);
        if (!campaign) {
            throw new Error('Campaign not found');
        }
        
        const analytics = await this.marketingModel.getCampaignAnalytics(campaignId);
        
        return {
            campaign: {
                id: campaign.id,
                name: campaign.name,
                status: campaign.status,
                sentAt: campaign.sentAt,
                completedAt: campaign.completedAt
            },
            stats: campaign.stats,
            analytics
        };
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// ============================================
// VALIDATION RULES
// ============================================

const MarketingValidation = {
    createCampaign: [
        body('name')
            .notEmpty().withMessage('Campaign name is required')
            .isLength({ min: 3, max: 100 }).withMessage('Name must be between 3 and 100 characters'),
        
        body('type')
            .notEmpty().withMessage('Campaign type is required')
            .isIn(['onboarding', 'promotional', 'reengagement', 'transactional', 'newsletter'])
            .withMessage('Invalid campaign type'),
        
        body('channel')
            .notEmpty().withMessage('Channel is required')
            .isIn(['email', 'push', 'both'])
            .withMessage('Invalid channel'),
        
        body('templateId')
            .notEmpty().withMessage('Template ID is required')
            .isInt({ min: 1 }).withMessage('Invalid template ID'),
        
        body('segmentId')
            .notEmpty().withMessage('Segment ID is required')
            .isInt({ min: 1 }).withMessage('Invalid segment ID')
    ],
    
    scheduleCampaign: [
        body('sendTime')
            .notEmpty().withMessage('Send time is required')
            .isISO8601().withMessage('Invalid send time'),
        
        body('timezone')
            .optional()
            .isString().withMessage('Timezone must be a string')
    ],
    
    createTemplate: [
        body('name')
            .notEmpty().withMessage('Template name is required')
            .isLength({ min: 3, max: 100 }).withMessage('Name must be between 3 and 100 characters'),
        
        body('subject')
            .notEmpty().withMessage('Subject is required')
            .isLength({ max: 200 }).withMessage('Subject too long'),
        
        body('html')
            .notEmpty().withMessage('HTML content is required'),
        
        body('category')
            .optional()
            .isString().withMessage('Category must be a string')
    ],
    
    createSegment: [
        body('name')
            .notEmpty().withMessage('Segment name is required')
            .isLength({ min: 3, max: 100 }).withMessage('Name must be between 3 and 100 characters'),
        
        body('conditions')
            .isArray({ min: 1 }).withMessage('At least one condition required')
    ],
    
    subscribe: [
        body('email')
            .notEmpty().withMessage('Email is required')
            .isEmail().withMessage('Invalid email format'),
        
        body('name')
            .optional()
            .isString().withMessage('Name must be a string')
    ]
};

// ============================================
// MARKETING ROUTES
// ============================================

function createMarketingRoutes(marketingService, authMiddleware) {
    const router = require('express').Router();
    
    // Campaign Management
    router.post('/campaigns', authMiddleware.authenticate, authMiddleware.requireRole('admin'), MarketingValidation.createCampaign, async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        try {
            const campaign = await marketingService.createCampaign(req.body, req.user.id);
            res.status(201).json(campaign);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    
    router.get('/campaigns', authMiddleware.authenticate, authMiddleware.requireRole('admin'), async (req, res) => {
        const filters = {
            status: req.query.status,
            type: req.query.type,
            channel: req.query.channel
        };
        
        const options = {
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || MarketingConfig.pagination.defaultLimit,
            sortBy: req.query.sortBy || 'createdAt',
            sortOrder: req.query.sortOrder || 'desc'
        };
        
        const campaigns = await marketingService.marketingModel.findAllCampaigns(filters, options);
        res.json(campaigns);
    });
    
    router.get('/campaigns/:id', authMiddleware.authenticate, authMiddleware.requireRole('admin'), async (req, res) => {
        const campaign = await marketingService.marketingModel.findCampaignById(req.params.id);
        if (!campaign) {
            return res.status(404).json({ error: 'Campaign not found' });
        }
        res.json(campaign);
    });
    
    router.put('/campaigns/:id', authMiddleware.authenticate, authMiddleware.requireRole('admin'), async (req, res) => {
        try {
            const updated = await marketingService.marketingModel.updateCampaign(req.params.id, req.body);
            res.json(updated);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    
    router.post('/campaigns/:id/schedule', authMiddleware.authenticate, authMiddleware.requireRole('admin'), MarketingValidation.scheduleCampaign, async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        try {
            const campaign = await marketingService.scheduleCampaign(req.params.id, req.body);
            res.json(campaign);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    
    router.post('/campaigns/:id/start', authMiddleware.authenticate, authMiddleware.requireRole('admin'), async (req, res) => {
        try {
            const campaign = await marketingService.startCampaign(req.params.id);
            res.json(campaign);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    
    router.post('/campaigns/:id/pause', authMiddleware.authenticate, authMiddleware.requireRole('admin'), async (req, res) => {
        try {
            const campaign = await marketingService.pauseCampaign(req.params.id);
            res.json(campaign);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    
    router.post('/campaigns/:id/stop', authMiddleware.authenticate, authMiddleware.requireRole('admin'), async (req, res) => {
        try {
            const campaign = await marketingService.stopCampaign(req.params.id);
            res.json(campaign);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    
    router.get('/campaigns/:id/analytics', authMiddleware.authenticate, authMiddleware.requireRole('admin'), async (req, res) => {
        try {
            const analytics = await marketingService.getCampaignAnalytics(req.params.id);
            res.json(analytics);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    
    // Templates
    router.post('/templates', authMiddleware.authenticate, authMiddleware.requireRole('admin'), MarketingValidation.createTemplate, async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        try {
            const template = await marketingService.createTemplate(req.body, req.user.id);
            res.status(201).json(template);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    
    router.get('/templates', authMiddleware.authenticate, authMiddleware.requireRole('admin'), async (req, res) => {
        const templates = await marketingService.marketingModel.findAllTemplates(req.query);
        res.json(templates);
    });
    
    router.get('/templates/:id', authMiddleware.authenticate, authMiddleware.requireRole('admin'), async (req, res) => {
        const template = await marketingService.marketingModel.findTemplateById(req.params.id);
        if (!template) {
            return res.status(404).json({ error: 'Template not found' });
        }
        res.json(template);
    });
    
    // Segments
    router.post('/segments', authMiddleware.authenticate, authMiddleware.requireRole('admin'), MarketingValidation.createSegment, async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        try {
            const segment = await marketingService.createSegment(req.body, req.user.id);
            res.status(201).json(segment);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    
    router.get('/segments', authMiddleware.authenticate, authMiddleware.requireRole('admin'), async (req, res) => {
        const segments = await marketingService.marketingModel.segments;
        res.json(segments);
    });
    
    router.get('/segments/:id', authMiddleware.authenticate, authMiddleware.requireRole('admin'), async (req, res) => {
        const segment = await marketingService.marketingModel.findSegmentById(req.params.id);
        if (!segment) {
            return res.status(404).json({ error: 'Segment not found' });
        }
        res.json(segment);
    });
    
    // Subscribers
    router.post('/subscribe', MarketingValidation.subscribe, async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        try {
            const subscriber = await marketingService.subscribe(req.body.email, req.body.name, req.user?.id);
            res.json(subscriber);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    
    router.post('/unsubscribe', async (req, res) => {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email is required'
