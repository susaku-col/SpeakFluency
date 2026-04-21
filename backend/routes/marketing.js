// ============================================
// Marketing Routes
// SpeakFlow - AI Language Learning Platform
// ============================================

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { body, query, param, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');

// ============================================
// Middleware Authentication
// ============================================

const authenticateToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No token provided',
        code: 'NO_TOKEN'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token has expired',
        code: 'TOKEN_EXPIRED'
      });
    }
    return res.status(403).json({
      success: false,
      error: 'Invalid token',
      code: 'INVALID_TOKEN'
    });
  }
};

// Admin middleware
const isAdmin = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required',
        code: 'ADMIN_REQUIRED'
      });
    }
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// ============================================
// Rate Limiting
// ============================================

const marketingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: {
    success: false,
    error: 'Too many marketing requests. Please slow down.'
  }
});

const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: {
    success: false,
    error: 'Too many email requests. Please try again later.'
  }
});

// ============================================
// Validation Rules
// ============================================

const createCampaignValidation = [
  body('name')
    .notEmpty()
    .withMessage('Campaign name is required')
    .isLength({ min: 3, max: 100 })
    .withMessage('Campaign name must be between 3 and 100 characters'),
  body('type')
    .isIn(['email', 'push', 'in_app', 'sms', 'social'])
    .withMessage('Invalid campaign type'),
  body('audience')
    .isObject()
    .withMessage('Audience configuration is required'),
  body('content')
    .isObject()
    .withMessage('Content is required'),
  body('schedule')
    .optional()
    .isObject()
    .withMessage('Schedule must be an object'),
];

const createEmailTemplateValidation = [
  body('name')
    .notEmpty()
    .withMessage('Template name is required'),
  body('subject')
    .notEmpty()
    .withMessage('Email subject is required'),
  body('htmlContent')
    .notEmpty()
    .withMessage('HTML content is required'),
  body('textContent')
    .optional()
    .isString()
    .withMessage('Text content must be a string'),
];

// ============================================
// Marketing Data Storage
// ============================================

// Email templates
const emailTemplates = new Map();

// Campaigns
const campaigns = new Map();

// User segments
const userSegments = new Map();

// Campaign analytics
const campaignAnalytics = new Map();

// Subscribers
const subscribers = new Map();

// Referral codes
const referralCodes = new Map();

// ============================================
// Mock Data
// ============================================

// Default email templates
const defaultTemplates = [
  {
    id: 'welcome_email',
    name: 'Welcome Email',
    subject: 'Welcome to SpeakFlow! 🎉',
    htmlContent: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
          .content { padding: 30px; }
          .button { display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 5px; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to SpeakFlow! 🎯</h1>
          </div>
          <div class="content">
            <h2>Hi {{name}},</h2>
            <p>We're excited to have you on board! You've taken the first step towards mastering English speaking.</p>
            <p>Here's what you can do next:</p>
            <ul>
              <li>🎤 Take your first pronunciation assessment</li>
              <li>📚 Explore our library of lessons</li>
              <li>🎮 Start earning XP and achievements</li>
              <li>👥 Join our community practice sessions</li>
            </ul>
            <div style="text-align: center;">
              <a href="{{startUrl}}" class="button">Start Your First Lesson →</a>
            </div>
            <p>Need help? Reply to this email or join our <a href="{{discordUrl}}">Discord community</a>.</p>
            <p>Happy learning!<br>The SpeakFlow Team</p>
          </div>
          <div class="footer">
            <p>© 2024 SpeakFlow. All rights reserved.</p>
            <p><a href="{{unsubscribeUrl}}">Unsubscribe</a> | <a href="{{privacyUrl}}">Privacy Policy</a></p>
          </div>
        </div>
      </body>
      </html>
    `,
    textContent: 'Welcome to SpeakFlow! Take your first lesson today.',
    category: 'onboarding',
    createdAt: new Date().toISOString()
  },
  {
    id: 'daily_reminder',
    name: 'Daily Practice Reminder',
    subject: 'Don\'t break your streak! 🔥',
    htmlContent: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .streak { text-align: center; font-size: 48px; margin: 20px 0; }
          .button { display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Hey {{name}}! 👋</h2>
          <p>Don't let your {{streak}}-day streak break! Take just 15 minutes today to practice.</p>
          <div class="streak">
            🔥 {{streak}} days
          </div>
          <div style="text-align: center;">
            <a href="{{practiceUrl}}" class="button">Practice Now →</a>
          </div>
          <p>You're doing great! Keep going! 💪</p>
        </div>
      </body>
      </html>
    `,
    textContent: 'Practice today to maintain your streak!',
    category: 'engagement',
    createdAt: new Date().toISOString()
  },
  {
    id: 'achievement_unlocked',
    name: 'Achievement Unlocked',
    subject: '🎉 Congratulations! You\'ve unlocked a new achievement!',
    htmlContent: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; text-align: center; }
          .badge { font-size: 64px; margin: 20px 0; }
          .button { display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="badge">
            {{badgeIcon}}
          </div>
          <h2>You've earned: {{badgeName}}! 🏆</h2>
          <p>{{badgeDescription}}</p>
          <div style="margin: 30px 0;">
            <a href="{{shareUrl}}" class="button">Share on Social Media →</a>
          </div>
          <p>Keep up the great work! {{nextBadgeHint}}</p>
        </div>
      </body>
      </html>
    `,
    textContent: 'You\'ve earned a new achievement!',
    category: 'gamification',
    createdAt: new Date().toISOString()
  }
];

// Initialize default templates
defaultTemplates.forEach(template => {
  emailTemplates.set(template.id, template);
});

// User segments
const segments = [
  {
    id: 'new_users',
    name: 'New Users (0-7 days)',
    conditions: { daysSinceSignup: { $lt: 7 } },
    count: 1234
  },
  {
    id: 'active_learners',
    name: 'Active Learners (7+ day streak)',
    conditions: { streak: { $gte: 7 } },
    count: 5678
  },
  {
    id: 'at_risk',
    name: 'At Risk Users (3+ days inactive)',
    conditions: { lastActive: { $gt: 3 } },
    count: 2345
  },
  {
    id: 'premium_users',
    name: 'Premium Subscribers',
    conditions: { subscriptionPlan: { $ne: 'free' } },
    count: 3456
  },
  {
    id: 'inactive_users',
    name: 'Inactive Users (30+ days)',
    conditions: { lastActive: { $gt: 30 } },
    count: 8901
  }
];

segments.forEach(segment => {
  userSegments.set(segment.id, segment);
});

// ============================================
// Helper Functions
// ============================================

// Generate unique ID
const generateId = (prefix) => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Send email (mock)
const sendEmail = async (to, subject, htmlContent, textContent, metadata = {}) => {
  console.log(`[EMAIL] Sending to: ${to}`);
  console.log(`[EMAIL] Subject: ${subject}`);
  console.log(`[EMAIL] Metadata:`, metadata);
  
  // In production, integrate with SendGrid, AWS SES, etc.
  return {
    success: true,
    messageId: generateId('msg'),
    to,
    subject,
    sentAt: new Date().toISOString()
  };
};

// Send push notification (mock)
const sendPushNotification = async (userId, title, body, data = {}) => {
  console.log(`[PUSH] Sending to user: ${userId}`);
  console.log(`[PUSH] Title: ${title}`);
  console.log(`[PUSH] Body: ${body}`);
  
  return {
    success: true,
    notificationId: generateId('notif'),
    userId,
    sentAt: new Date().toISOString()
  };
};

// Process template variables
const processTemplate = (template, variables) => {
  let processedHtml = template.htmlContent;
  let processedText = template.textContent;
  
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    processedHtml = processedHtml.replace(regex, value);
    if (processedText) {
      processedText = processedText.replace(regex, value);
    }
  }
  
  return { html: processedHtml, text: processedText };
};

// Get users by segment (mock)
const getUsersBySegment = async (segmentId) => {
  // In production, query database
  const segment = userSegments.get(segmentId);
  if (!segment) return [];
  
  // Mock user IDs
  const mockUserIds = Array.from({ length: Math.min(segment.count, 100) }, (_, i) => `user_${i + 1}`);
  return mockUserIds;
};

// Track campaign analytics
const trackCampaignAnalytics = (campaignId, eventType, data = {}) => {
  if (!campaignAnalytics.has(campaignId)) {
    campaignAnalytics.set(campaignId, {
      campaignId,
      events: [],
      stats: {
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        converted: 0,
        bounced: 0,
        unsubscribed: 0
      }
    });
  }
  
  const analytics = campaignAnalytics.get(campaignId);
  analytics.events.push({
    eventType,
    timestamp: new Date().toISOString(),
    data
  });
  
  // Update stats
  if (eventType === 'sent') analytics.stats.sent++;
  if (eventType === 'delivered') analytics.stats.delivered++;
  if (eventType === 'open') analytics.stats.opened++;
  if (eventType === 'click') analytics.stats.clicked++;
  if (eventType === 'conversion') analytics.stats.converted++;
  if (eventType === 'bounce') analytics.stats.bounced++;
  if (eventType === 'unsubscribe') analytics.stats.unsubscribed++;
  
  campaignAnalytics.set(campaignId, analytics);
};

// Generate referral code
const generateReferralCode = (userId) => {
  const code = `${userId.substring(0, 4)}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  referralCodes.set(code, {
    code,
    userId,
    createdAt: new Date().toISOString(),
    uses: 0,
    rewards: []
  });
  return code;
};

// ============================================
// Routes
// ============================================

/**
 * GET /api/marketing/campaigns
 * Get all marketing campaigns
 */
router.get('/campaigns', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { status, type, page = 1, limit = 20 } = req.query;
    
    let campaignsList = Array.from(campaigns.values());
    
    if (status) {
      campaignsList = campaignsList.filter(c => c.status === status);
    }
    if (type) {
      campaignsList = campaignsList.filter(c => c.type === type);
    }
    
    // Pagination
    const startIndex = (page - 1) * limit;
    const paginatedCampaigns = campaignsList.slice(startIndex, startIndex + limit);
    
    res.json({
      success: true,
      data: {
        campaigns: paginatedCampaigns,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: campaignsList.length,
          pages: Math.ceil(campaignsList.length / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get campaigns error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve campaigns'
    });
  }
});

/**
 * POST /api/marketing/campaigns
 * Create new marketing campaign
 */
router.post('/campaigns', authenticateToken, isAdmin, createCampaignValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }
    
    const { name, type, audience, content, schedule } = req.body;
    
    const campaignId = generateId('camp');
    const campaign = {
      id: campaignId,
      name,
      type,
      audience,
      content,
      schedule: schedule || { sendNow: true },
      status: 'draft',
      createdAt: new Date().toISOString(),
      createdBy: req.user.id,
      stats: {
        sent: 0,
        opened: 0,
        clicked: 0,
        converted: 0
      }
    };
    
    campaigns.set(campaignId, campaign);
    
    res.status(201).json({
      success: true,
      message: 'Campaign created successfully',
      data: campaign
    });
  } catch (error) {
    console.error('Create campaign error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create campaign'
    });
  }
});

/**
 * POST /api/marketing/campaigns/:campaignId/send
 * Send campaign immediately
 */
router.post('/campaigns/:campaignId/send', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { campaignId } = req.params;
    
    const campaign = campaigns.get(campaignId);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found',
        code: 'CAMPAIGN_NOT_FOUND'
      });
    }
    
    if (campaign.status === 'sending') {
      return res.status(400).json({
        success: false,
        error: 'Campaign is already sending',
        code: 'CAMPAIGN_SENDING'
      });
    }
    
    campaign.status = 'sending';
    campaign.startedAt = new Date().toISOString();
    campaigns.set(campaignId, campaign);
    
    // Get target users
    const users = await getUsersBySegment(campaign.audience.segmentId);
    
    // Send campaign based on type
    let sentCount = 0;
    
    if (campaign.type === 'email') {
      const template = emailTemplates.get(campaign.content.templateId);
      
      for (const user of users.slice(0, 100)) { // Limit for mock
        const processed = processTemplate(template, {
          name: user.name || 'Learner',
          ...campaign.content.variables
        });
        
        await sendEmail(
          user.email,
          processed.subject || template.subject,
          processed.html,
          processed.text,
          { campaignId, userId: user.id }
        );
        sentCount++;
        trackCampaignAnalytics(campaignId, 'sent', { userId: user.id });
      }
    } else if (campaign.type === 'push') {
      for (const user of users.slice(0, 100)) {
        await sendPushNotification(
          user.id,
          campaign.content.title,
          campaign.content.body,
          { campaignId, url: campaign.content.url }
        );
        sentCount++;
        trackCampaignAnalytics(campaignId, 'sent', { userId: user.id });
      }
    }
    
    campaign.status = 'completed';
    campaign.completedAt = new Date().toISOString();
    campaign.stats.sent = sentCount;
    campaigns.set(campaignId, campaign);
    
    res.json({
      success: true,
      message: 'Campaign sent successfully',
      data: {
        campaignId,
        sentCount,
        totalTarget: users.length
      }
    });
  } catch (error) {
    console.error('Send campaign error:', error);
    campaign.status = 'failed';
    campaigns.set(campaign.params, campaign);
    res.status(500).json({
      success: false,
      error: 'Failed to send campaign'
    });
  }
});

/**
 * GET /api/marketing/campaigns/:campaignId/analytics
 * Get campaign analytics
 */
router.get('/campaigns/:campaignId/analytics', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { campaignId } = req.params;
    
    const campaign = campaigns.get(campaignId);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found',
        code: 'CAMPAIGN_NOT_FOUND'
      });
    }
    
    const analytics = campaignAnalytics.get(campaignId) || {
      stats: campaign.stats,
      events: []
    };
    
    // Calculate rates
    const openRate = analytics.stats.sent > 0 
      ? (analytics.stats.opened / analytics.stats.sent) * 100 
      : 0;
    const clickRate = analytics.stats.opened > 0 
      ? (analytics.stats.clicked / analytics.stats.opened) * 100 
      : 0;
    const conversionRate = analytics.stats.sent > 0 
      ? (analytics.stats.converted / analytics.stats.sent) * 100 
      : 0;
    
    res.json({
      success: true,
      data: {
        campaign: {
          id: campaign.id,
          name: campaign.name,
          type: campaign.type,
          status: campaign.status
        },
        stats: {
          ...analytics.stats,
          openRate: Math.round(openRate * 100) / 100,
          clickRate: Math.round(clickRate * 100) / 100,
          conversionRate: Math.round(conversionRate * 100) / 100
        },
        timeline: analytics.events.slice(-50)
      }
    });
  } catch (error) {
    console.error('Get campaign analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve campaign analytics'
    });
  }
});

/**
 * GET /api/marketing/email-templates
 * Get all email templates
 */
router.get('/email-templates', authenticateToken, isAdmin, async (req, res) => {
  try {
    const templates = Array.from(emailTemplates.values());
    
    res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve templates'
    });
  }
});

/**
 * POST /api/marketing/email-templates
 * Create email template
 */
router.post('/email-templates', authenticateToken, isAdmin, createEmailTemplateValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }
    
    const { name, subject, htmlContent, textContent, category } = req.body;
    
    const templateId = generateId('tmpl');
    const template = {
      id: templateId,
      name,
      subject,
      htmlContent,
      textContent: textContent || '',
      category: category || 'general',
      createdAt: new Date().toISOString(),
      createdBy: req.user.id
    };
    
    emailTemplates.set(templateId, template);
    
    res.status(201).json({
      success: true,
      message: 'Email template created successfully',
      data: template
    });
  } catch (error) {
    console.error('Create template error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create email template'
    });
  }
});

/**
 * GET /api/marketing/segments
 * Get user segments
 */
router.get('/segments', authenticateToken, isAdmin, async (req, res) => {
  try {
    const segmentsList = Array.from(userSegments.values());
    
    res.json({
      success: true,
      data: segmentsList
    });
  } catch (error) {
    console.error('Get segments error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve segments'
    });
  }
});

/**
 * POST /api/marketing/segments
 * Create user segment
 */
router.post('/segments', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { name, conditions } = req.body;
    
    if (!name || !conditions) {
      return res.status(400).json({
        success: false,
        error: 'Name and conditions are required'
      });
    }
    
    const segmentId = generateId('seg');
    const segment = {
      id: segmentId,
      name,
      conditions,
      count: 0,
      createdAt: new Date().toISOString(),
      createdBy: req.user.id
    };
    
    userSegments.set(segmentId, segment);
    
    res.status(201).json({
      success: true,
      message: 'Segment created successfully',
      data: segment
    });
  } catch (error) {
    console.error('Create segment error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create segment'
    });
  }
});

/**
 * POST /api/marketing/subscribe
 * Subscribe to newsletter
 */
router.post('/subscribe', emailLimiter, async (req, res) => {
  try {
    const { email, name, preferences } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }
    
    const subscriberId = generateId('sub');
    const subscriber = {
      id: subscriberId,
      email,
      name: name || '',
      preferences: preferences || {
        newsletter: true,
        tips: true,
        offers: true,
        productUpdates: true
      },
      status: 'active',
      subscribedAt: new Date().toISOString(),
      ipAddress: req.ip
    };
    
    subscribers.set(subscriberId, subscriber);
    
    // Send welcome email
    const welcomeTemplate = emailTemplates.get('welcome_email');
    if (welcomeTemplate) {
      const processed = processTemplate(welcomeTemplate, {
        name: name || 'there',
        startUrl: 'https://speakflow.com/get-started',
        discordUrl: 'https://discord.gg/speakflow',
        unsubscribeUrl: `https://speakflow.com/unsubscribe?email=${encodeURIComponent(email)}`,
        privacyUrl: 'https://speakflow.com/privacy'
      });
      
      await sendEmail(email, processed.subject, processed.html, processed.text);
    }
    
    res.json({
      success: true,
      message: 'Successfully subscribed to newsletter',
      data: {
        email,
        preferences: subscriber.preferences
      }
    });
  } catch (error) {
    console.error('Subscribe error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to subscribe'
    });
  }
});

/**
 * POST /api/marketing/unsubscribe
 * Unsubscribe from newsletter
 */
router.post('/unsubscribe', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }
    
    // Find and update subscriber
    let found = false;
    for (const [id, subscriber] of subscribers.entries()) {
      if (subscriber.email === email) {
        subscriber.status = 'unsubscribed';
        subscriber.unsubscribedAt = new Date().toISOString();
        subscribers.set(id, subscriber);
        found = true;
        break;
      }
    }
    
    res.json({
      success: true,
      message: 'Successfully unsubscribed from newsletter'
    });
  } catch (error) {
    console.error('Unsubscribe error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unsubscribe'
    });
  }
});

/**
 * POST /api/marketing/referral/create
 * Create referral code
 */
router.post('/referral/create', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Check if user already has a referral code
    let existingCode = null;
    for (const [code, data] of referralCodes.entries()) {
      if (data.userId === userId) {
        existingCode = code;
        break;
      }
    }
    
    if (existingCode) {
      return res.json({
        success: true,
        data: {
          referralCode: existingCode,
          referralLink: `https://speakflow.com/signup?ref=${existingCode}`,
          isNew: false
        }
      });
    }
    
    const referralCode = generateReferralCode(userId);
    
    res.json({
      success: true,
      data: {
        referralCode,
        referralLink: `https://speakflow.com/signup?ref=${referralCode}`,
        isNew: true
      }
    });
  } catch (error) {
    console.error('Create referral error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create referral code'
    });
  }
});

/**
 * POST /api/marketing/referral/use
 * Use referral code
 */
router.post('/referral/use', authenticateToken, async (req, res) => {
  try {
    const { referralCode } = req.body;
    const userId = req.user.id;
    
    if (!referralCode) {
      return res.status(400).json({
        success: false,
        error: 'Referral code is required'
      });
    }
    
    const referral = referralCodes.get(referralCode);
    if (!referral) {
      return res.status(404).json({
        success: false,
        error: 'Invalid referral code',
        code: 'INVALID_REFERRAL'
      });
    }
    
    // Can't use your own referral code
    if (referral.userId === userId) {
      return res.status(400).json({
        success: false,
        error: 'Cannot use your own referral code',
        code: 'SELF_REFERRAL'
      });
    }
    
    // Update referral usage
    referral.uses++;
    referral.rewards.push({
      userId,
      type: 'signup',
      earnedAt: new Date().toISOString()
    });
    referralCodes.set(referralCode, referral);
    
    // Give rewards to both users (mock)
    const reward = {
      type: 'free_month',
      description: 'One month of Pro subscription',
      appliedAt: new Date().toISOString()
    };
    
    res.json({
      success: true,
      message: 'Referral code applied successfully!',
      data: {
        reward,
        message: 'You\'ve received one free month of Pro!'
      }
    });
  } catch (error) {
    console.error('Use referral error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to apply referral code'
    });
  }
});

/**
 * GET /api/marketing/referral/stats
 * Get referral statistics
 */
router.get('/referral/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    let userReferral = null;
    for (const [code, data] of referralCodes.entries()) {
      if (data.userId === userId) {
        userReferral = { code, ...data };
        break;
      }
    }
    
    res.json({
      success: true,
      data: {
        hasReferralCode: !!userReferral,
        referralCode: userReferral?.code || null,
        totalUses: userReferral?.uses || 0,
        rewardsEarned: userReferral?.rewards?.length || 0,
        referralLink: userReferral 
          ? `https://speakflow.com/signup?ref=${userReferral.code}`
          : null,
        nextRewardAt: userReferral?.uses >= 5 ? null : `${5 - (userReferral?.uses || 0)} more referrals`
      }
    });
  } catch (error) {
    console.error('Get referral stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve referral stats'
    });
  }
});

/**
 * POST /api/marketing/newsletter/preview
 * Preview newsletter template
 */
router.post('/newsletter/preview', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { templateId, variables } = req.body;
    
    const template = emailTemplates.get(templateId);
    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }
    
    const processed = processTemplate(template, variables || {
      name: 'Sample User',
      streak: '7',
      badgeName: 'Week Warrior',
      badgeIcon: '🏆',
      badgeDescription: 'Maintained a 7-day learning streak'
    });
    
    res.json({
      success: true,
      data: {
        subject: processed.subject || template.subject,
        htmlPreview: processed.html,
        textPreview: processed.text
      }
    });
  } catch (error) {
    console.error('Preview error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to preview newsletter'
    });
  }
});

module.exports = router;
