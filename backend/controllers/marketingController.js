// ============================================
// Marketing Controller
// SpeakFlow - AI Language Learning Platform
// ============================================

const { validationResult } = require('express-validator');

// ============================================
// Constants & Configuration
// ============================================

const CAMPAIGN_TYPES = {
  EMAIL: 'email',
  PUSH: 'push',
  IN_APP: 'in_app',
  SMS: 'sms',
  SOCIAL: 'social'
};

const CAMPAIGN_STATUSES = {
  DRAFT: 'draft',
  SCHEDULED: 'scheduled',
  SENDING: 'sending',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  FAILED: 'failed'
};

const EMAIL_TEMPLATE_CATEGORIES = {
  ONBOARDING: 'onboarding',
  ENGAGEMENT: 'engagement',
  PROMOTIONAL: 'promotional',
  TRANSACTIONAL: 'transactional',
  GAMIFICATION: 'gamification',
  NEWSLETTER: 'newsletter'
};

// ============================================
// Mock Database
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

// Newsletter subscriptions
const newsletterSubscriptions = new Map();

// Marketing automation workflows
const automationWorkflows = new Map();

// ============================================
// Helper Functions
// ============================================

/**
 * Generate unique ID
 */
const generateId = (prefix) => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Send email (mock - integrate with actual email service)
 */
const sendEmail = async (to, subject, htmlContent, textContent, metadata = {}) => {
  console.log(`[EMAIL] Sending to: ${to}`);
  console.log(`[EMAIL] Subject: ${subject}`);
  console.log(`[EMAIL] Metadata:`, metadata);
  
  // In production, integrate with SendGrid, AWS SES, etc.
  return {
    success: true,
    messageId: generateId('email'),
    to,
    subject,
    sentAt: new Date().toISOString()
  };
};

/**
 * Send push notification (mock)
 */
const sendPushNotification = async (userId, title, body, data = {}) => {
  console.log(`[PUSH] Sending to user: ${userId}`);
  console.log(`[PUSH] Title: ${title}`);
  console.log(`[PUSH] Body: ${body}`);
  
  return {
    success: true,
    notificationId: generateId('push'),
    userId,
    sentAt: new Date().toISOString()
  };
};

/**
 * Send SMS (mock)
 */
const sendSMS = async (phoneNumber, message, metadata = {}) => {
  console.log(`[SMS] Sending to: ${phoneNumber}`);
  console.log(`[SMS] Message: ${message}`);
  
  return {
    success: true,
    smsId: generateId('sms'),
    phoneNumber,
    sentAt: new Date().toISOString()
  };
};

/**
 * Process template variables
 */
const processTemplate = (template, variables) => {
  let processedHtml = template.htmlContent;
  let processedText = template.textContent || '';
  let processedSubject = template.subject;
  
  // Replace all {{variable}} placeholders
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    processedHtml = processedHtml.replace(regex, value);
    processedText = processedText.replace(regex, value);
    if (processedSubject) {
      processedSubject = processedSubject.replace(regex, value);
    }
  }
  
  return {
    html: processedHtml,
    text: processedText,
    subject: processedSubject
  };
};

/**
 * Get users by segment (mock)
 */
const getUsersBySegment = async (segmentId, limit = 1000) => {
  const segment = userSegments.get(segmentId);
  if (!segment) return [];
  
  // Mock user IDs based on segment
  const mockUsers = [];
  const count = Math.min(segment.count || 100, limit);
  
  for (let i = 0; i < count; i++) {
    mockUsers.push({
      id: `user_${i + 1}`,
      email: `user${i + 1}@example.com`,
      name: `User ${i + 1}`,
      phone: `+123456789${i}`,
      preferences: {
        email: true,
        push: true,
        sms: i % 2 === 0
      }
    });
  }
  
  return mockUsers;
};

/**
 * Track campaign analytics
 */
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
        unsubscribed: 0,
        complaint: 0
      },
      timeline: []
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
  if (eventType === 'complaint') analytics.stats.complaint++;
  
  campaignAnalytics.set(campaignId, analytics);
};

/**
 * Generate referral code
 */
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

/**
 * Calculate campaign ROI
 */
const calculateCampaignROI = (campaign) => {
  const analytics = campaignAnalytics.get(campaign.id);
  if (!analytics) return null;
  
  const cost = campaign.cost || 0;
  const revenue = (analytics.stats.converted * (campaign.averageOrderValue || 50)) || 0;
  const roi = cost > 0 ? ((revenue - cost) / cost) * 100 : 0;
  
  return {
    cost,
    revenue,
    roi: Math.round(roi * 100) / 100,
    profit: revenue - cost
  };
};

// ============================================
// Default Data Initialization
// ============================================

// Default email templates
const defaultTemplates = [
  {
    id: 'welcome_email',
    name: 'Welcome Email',
    subject: 'Welcome to SpeakFlow! 🎉',
    category: EMAIL_TEMPLATE_CATEGORIES.ONBOARDING,
    htmlContent: `
      <!DOCTYPE html>
      <html>
      <head><style>body{font-family:Arial,sans-serif;}</style></head>
      <body>
        <h2>Welcome {{name}}!</h2>
        <p>We're excited to have you on board! Start your first lesson today.</p>
        <a href="{{startUrl}}">Get Started →</a>
      </body>
      </html>
    `,
    textContent: 'Welcome {{name}}! Start your first lesson today: {{startUrl}}',
    variables: ['name', 'startUrl'],
    createdAt: new Date().toISOString()
  },
  {
    id: 'daily_reminder',
    name: 'Daily Practice Reminder',
    subject: "Don't break your streak! 🔥",
    category: EMAIL_TEMPLATE_CATEGORIES.ENGAGEMENT,
    htmlContent: `
      <!DOCTYPE html>
      <html>
      <head><style>body{font-family:Arial,sans-serif;}</style></head>
      <body>
        <h2>Hey {{name}}!</h2>
        <p>You have a {{streak}}-day streak! Take 15 minutes to practice today.</p>
        <a href="{{practiceUrl}}">Practice Now →</a>
      </body>
      </html>
    `,
    textContent: 'Hey {{name}}! Practice today to maintain your {{streak}}-day streak: {{practiceUrl}}',
    variables: ['name', 'streak', 'practiceUrl'],
    createdAt: new Date().toISOString()
  },
  {
    id: 'achievement_unlocked',
    name: 'Achievement Unlocked',
    subject: '🎉 Congratulations! New achievement unlocked!',
    category: EMAIL_TEMPLATE_CATEGORIES.GAMIFICATION,
    htmlContent: `
      <!DOCTYPE html>
      <html>
      <head><style>body{font-family:Arial,sans-serif;}</style></head>
      <body>
        <div style="text-align:center">
          <div style="font-size:48px">{{badgeIcon}}</div>
          <h2>You earned: {{badgeName}}!</h2>
          <p>{{badgeDescription}}</p>
          <a href="{{shareUrl}}">Share on Social Media →</a>
        </div>
      </body>
      </html>
    `,
    textContent: 'Congratulations! You earned the {{badgeName}} achievement!',
    variables: ['badgeIcon', 'badgeName', 'badgeDescription', 'shareUrl'],
    createdAt: new Date().toISOString()
  },
  {
    id: 'special_offer',
    name: 'Special Offer',
    subject: 'Limited Time: 30% off Pro! 🎁',
    category: EMAIL_TEMPLATE_CATEGORIES.PROMOTIONAL,
    htmlContent: `
      <!DOCTYPE html>
      <html>
      <head><style>body{font-family:Arial,sans-serif;}</style></head>
      <body>
        <h2>Special offer just for you!</h2>
        <p>Upgrade to Pro and get 30% off your first year.</p>
        <p>Use code: <strong>{{couponCode}}</strong></p>
        <a href="{{upgradeUrl}}">Upgrade Now →</a>
        <p>Offer expires: {{expiryDate}}</p>
      </body>
      </html>
    `,
    textContent: 'Special offer: 30% off Pro! Use code {{couponCode}} at {{upgradeUrl}}',
    variables: ['couponCode', 'upgradeUrl', 'expiryDate'],
    createdAt: new Date().toISOString()
  }
];

// Default user segments
const defaultSegments = [
  {
    id: 'new_users',
    name: 'New Users (0-7 days)',
    description: 'Users who joined in the last 7 days',
    conditions: { daysSinceSignup: { $lt: 7 } },
    count: 1234,
    createdAt: new Date().toISOString()
  },
  {
    id: 'active_learners',
    name: 'Active Learners (7+ day streak)',
    description: 'Users with active learning streak',
    conditions: { streak: { $gte: 7 } },
    count: 5678,
    createdAt: new Date().toISOString()
  },
  {
    id: 'at_risk',
    name: 'At Risk Users (3+ days inactive)',
    description: 'Users who haven\'t practiced in 3+ days',
    conditions: { lastActive: { $gt: 3 } },
    count: 2345,
    createdAt: new Date().toISOString()
  },
  {
    id: 'premium_users',
    name: 'Premium Subscribers',
    description: 'Users with paid subscription',
    conditions: { subscriptionPlan: { $ne: 'free' } },
    count: 3456,
    createdAt: new Date().toISOString()
  },
  {
    id: 'inactive_users',
    name: 'Inactive Users (30+ days)',
    description: 'Users inactive for 30+ days',
    conditions: { lastActive: { $gt: 30 } },
    count: 8901,
    createdAt: new Date().toISOString()
  },
  {
    id: 'high_achievers',
    name: 'High Achievers',
    description: 'Users with high engagement and scores',
    conditions: { averageScore: { $gte: 85 }, totalSessions: { $gte: 50 } },
    count: 1234,
    createdAt: new Date().toISOString()
  }
];

// Initialize default data
defaultTemplates.forEach(template => {
  emailTemplates.set(template.id, template);
});

defaultSegments.forEach(segment => {
  userSegments.set(segment.id, segment);
});

// ============================================
// Campaign Controller Methods
// ============================================

/**
 * Get all campaigns
 * GET /api/marketing/campaigns
 */
exports.getCampaigns = async (req, res) => {
  try {
    const { status, type, page = 1, limit = 20 } = req.query;
    
    let campaignsList = Array.from(campaigns.values());
    
    if (status) {
      campaignsList = campaignsList.filter(c => c.status === status);
    }
    if (type) {
      campaignsList = campaignsList.filter(c => c.type === type);
    }
    
    // Sort by creation date (newest first)
    campaignsList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Pagination
    const startIndex = (page - 1) * limit;
    const paginatedCampaigns = campaignsList.slice(startIndex, startIndex + limit);
    
    // Add analytics summary
    const campaignsWithStats = paginatedCampaigns.map(campaign => {
      const analytics = campaignAnalytics.get(campaign.id);
      return {
        ...campaign,
        stats: analytics?.stats || { sent: 0, opened: 0, clicked: 0, converted: 0 },
        roi: calculateCampaignROI(campaign)
      };
    });
    
    res.json({
      success: true,
      data: {
        campaigns: campaignsWithStats,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: campaignsList.length,
          pages: Math.ceil(campaignsList.length / limit)
        },
        summary: {
          total: campaignsList.length,
          active: campaignsList.filter(c => c.status === CAMPAIGN_STATUSES.ACTIVE).length,
          scheduled: campaignsList.filter(c => c.status === CAMPAIGN_STATUSES.SCHEDULED).length,
          completed: campaignsList.filter(c => c.status === CAMPAIGN_STATUSES.COMPLETED).length
        }
      }
    });
    
  } catch (error) {
    console.error('Get campaigns error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve campaigns',
      code: 'CAMPAIGNS_FAILED'
    });
  }
};

/**
 * Get campaign by ID
 * GET /api/marketing/campaigns/:campaignId
 */
exports.getCampaign = async (req, res) => {
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
    
    const analytics = campaignAnalytics.get(campaignId);
    
    res.json({
      success: true,
      data: {
        ...campaign,
        analytics: {
          stats: analytics?.stats || {},
          timeline: analytics?.timeline || [],
          roi: calculateCampaignROI(campaign)
        }
      }
    });
    
  } catch (error) {
    console.error('Get campaign error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve campaign',
      code: 'CAMPAIGN_FAILED'
    });
  }
};

/**
 * Create campaign
 * POST /api/marketing/campaigns
 */
exports.createCampaign = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }
    
    const { name, type, audience, content, schedule, budget } = req.body;
    
    const campaignId = generateId('camp');
    const campaign = {
      id: campaignId,
      name,
      type,
      audience,
      content,
      schedule: schedule || { sendNow: false, scheduledAt: null },
      budget: budget || { amount: 0, currency: 'USD' },
      status: schedule?.scheduledAt ? CAMPAIGN_STATUSES.SCHEDULED : CAMPAIGN_STATUSES.DRAFT,
      createdAt: new Date().toISOString(),
      createdBy: req.user.id,
      updatedAt: new Date().toISOString()
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
      error: 'Failed to create campaign',
      code: 'CREATE_CAMPAIGN_FAILED'
    });
  }
};

/**
 * Update campaign
 * PUT /api/marketing/campaigns/:campaignId
 */
exports.updateCampaign = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const updates = req.body;
    
    const campaign = campaigns.get(campaignId);
    
    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found',
        code: 'CAMPAIGN_NOT_FOUND'
      });
    }
    
    // Cannot modify active or sending campaigns
    if (campaign.status === CAMPAIGN_STATUSES.SENDING || campaign.status === CAMPAIGN_STATUSES.ACTIVE) {
      return res.status(400).json({
        success: false,
        error: 'Cannot modify campaign while it is active or sending',
        code: 'CAMPAIGN_IN_PROGRESS'
      });
    }
    
    const updatedCampaign = {
      ...campaign,
      ...updates,
      updatedAt: new Date().toISOString(),
      updatedBy: req.user.id
    };
    
    campaigns.set(campaignId, updatedCampaign);
    
    res.json({
      success: true,
      message: 'Campaign updated successfully',
      data: updatedCampaign
    });
    
  } catch (error) {
    console.error('Update campaign error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update campaign',
      code: 'UPDATE_CAMPAIGN_FAILED'
    });
  }
};

/**
 * Delete campaign
 * DELETE /api/marketing/campaigns/:campaignId
 */
exports.deleteCampaign = async (req, res) => {
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
    
    // Cannot delete active campaigns
    if (campaign.status === CAMPAIGN_STATUSES.SENDING || campaign.status === CAMPAIGN_STATUSES.ACTIVE) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete campaign while it is active',
        code: 'CAMPAIGN_ACTIVE'
      });
    }
    
    campaigns.delete(campaignId);
    campaignAnalytics.delete(campaignId);
    
    res.json({
      success: true,
      message: 'Campaign deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete campaign error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete campaign',
      code: 'DELETE_CAMPAIGN_FAILED'
    });
  }
};

/**
 * Send campaign
 * POST /api/marketing/campaigns/:campaignId/send
 */
exports.sendCampaign = async (req, res) => {
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
    
    if (campaign.status === CAMPAIGN_STATUSES.SENDING) {
      return res.status(400).json({
        success: false,
        error: 'Campaign is already sending',
        code: 'CAMPAIGN_SENDING'
      });
    }
    
    campaign.status = CAMPAIGN_STATUSES.SENDING;
    campaign.startedAt = new Date().toISOString();
    campaigns.set(campaignId, campaign);
    
    // Get target users
    const users = await getUsersBySegment(campaign.audience.segmentId, campaign.audience.limit || 1000);
    
    let sentCount = 0;
    let failedCount = 0;
    
    // Send campaign based on type
    for (const user of users) {
      try {
        // Check user preferences
        if (campaign.type === CAMPAIGN_TYPES.EMAIL && !user.preferences?.email) continue;
        if (campaign.type === CAMPAIGN_TYPES.PUSH && !user.preferences?.push) continue;
        if (campaign.type === CAMPAIGN_TYPES.SMS && !user.preferences?.sms) continue;
        
        if (campaign.type === CAMPAIGN_TYPES.EMAIL) {
          const template = emailTemplates.get(campaign.content.templateId);
          if (template) {
            const processed = processTemplate(template, {
              name: user.name,
              ...campaign.content.variables
            });
            
            await sendEmail(
              user.email,
              processed.subject,
              processed.html,
              processed.text,
              { campaignId, userId: user.id }
            );
            sentCount++;
            trackCampaignAnalytics(campaignId, 'sent', { userId: user.id });
          }
        } else if (campaign.type === CAMPAIGN_TYPES.PUSH) {
          await sendPushNotification(
            user.id,
            campaign.content.title,
            campaign.content.body,
            { campaignId, url: campaign.content.url }
          );
          sentCount++;
          trackCampaignAnalytics(campaignId, 'sent', { userId: user.id });
        } else if (campaign.type === CAMPAIGN_TYPES.SMS && user.phone) {
          await sendSMS(
            user.phone,
            campaign.content.message,
            { campaignId, userId: user.id }
          );
          sentCount++;
          trackCampaignAnalytics(campaignId, 'sent', { userId: user.id });
        }
      } catch (error) {
        failedCount++;
        console.error(`Failed to send to user ${user.id}:`, error);
      }
    }
    
    campaign.status = CAMPAIGN_STATUSES.COMPLETED;
    campaign.completedAt = new Date().toISOString();
    campaign.stats = {
      sent: sentCount,
      failed: failedCount,
      total: users.length
    };
    campaigns.set(campaignId, campaign);
    
    res.json({
      success: true,
      message: 'Campaign sent successfully',
      data: {
        campaignId,
        sentCount,
        failedCount,
        totalTarget: users.length
      }
    });
    
  } catch (error) {
    console.error('Send campaign error:', error);
    campaign.status = CAMPAIGN_STATUSES.FAILED;
    campaigns.set(campaignId, campaign);
    res.status(500).json({
      success: false,
      error: 'Failed to send campaign',
      code: 'SEND_CAMPAIGN_FAILED'
    });
  }
};

/**
 * Schedule campaign
 * POST /api/marketing/campaigns/:campaignId/schedule
 */
exports.scheduleCampaign = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { scheduledAt, timezone = 'UTC' } = req.body;
    
    const campaign = campaigns.get(campaignId);
    
    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found',
        code: 'CAMPAIGN_NOT_FOUND'
      });
    }
    
    if (!scheduledAt) {
      return res.status(400).json({
        success: false,
        error: 'Scheduled time is required',
        code: 'SCHEDULED_TIME_REQUIRED'
      });
    }
    
    campaign.status = CAMPAIGN_STATUSES.SCHEDULED;
    campaign.schedule = {
      scheduledAt,
      timezone,
      createdAt: new Date().toISOString()
    };
    campaigns.set(campaignId, campaign);
    
    // In production, schedule with a job queue (Bull, Agenda, etc.)
    
    res.json({
      success: true,
      message: `Campaign scheduled for ${scheduledAt}`,
      data: campaign
    });
    
  } catch (error) {
    console.error('Schedule campaign error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to schedule campaign',
      code: 'SCHEDULE_CAMPAIGN_FAILED'
    });
  }
};

/**
 * Cancel campaign
 * POST /api/marketing/campaigns/:campaignId/cancel
 */
exports.cancelCampaign = async (req, res) => {
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
    
    if (campaign.status === CAMPAIGN_STATUSES.COMPLETED) {
      return res.status(400).json({
        success: false,
        error: 'Cannot cancel a completed campaign',
        code: 'CAMPAIGN_COMPLETED'
      });
    }
    
    campaign.status = CAMPAIGN_STATUSES.CANCELLED;
    campaign.cancelledAt = new Date().toISOString();
    campaigns.set(campaignId, campaign);
    
    res.json({
      success: true,
      message: 'Campaign cancelled successfully',
      data: campaign
    });
    
  } catch (error) {
    console.error('Cancel campaign error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel campaign',
      code: 'CANCEL_CAMPAIGN_FAILED'
    });
  }
};

/**
 * Get campaign analytics
 * GET /api/marketing/campaigns/:campaignId/analytics
 */
exports.getCampaignAnalytics = async (req, res) => {
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
      stats: {},
      events: []
    };
    
    // Calculate rates
    const sent = analytics.stats.sent || 0;
    const openRate = sent > 0 ? (analytics.stats.opened / sent) * 100 : 0;
    const clickRate = analytics.stats.opened > 0 ? (analytics.stats.clicked / analytics.stats.opened) * 100 : 0;
    const conversionRate = sent > 0 ? (analytics.stats.converted / sent) * 100 : 0;
    const bounceRate = sent > 0 ? (analytics.stats.bounced / sent) * 100 : 0;
    
    // Get events by day for timeline
    const eventsByDay = {};
    analytics.events.forEach(event => {
      const day = event.timestamp.split('T')[0];
      if (!eventsByDay[day]) {
        eventsByDay[day] = { opens: 0, clicks: 0, conversions: 0 };
      }
      if (event.eventType === 'open') eventsByDay[day].opens++;
      if (event.eventType === 'click') eventsByDay[day].clicks++;
      if (event.eventType === 'conversion') eventsByDay[day].conversions++;
    });
    
    const timeline = Object.entries(eventsByDay).map(([date, metrics]) => ({
      date,
      ...metrics
    }));
    
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
          conversionRate: Math.round(conversionRate * 100) / 100,
          bounceRate: Math.round(bounceRate * 100) / 100
        },
        timeline,
        roi: calculateCampaignROI(campaign)
      }
    });
    
  } catch (error) {
    console.error('Get campaign analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve campaign analytics',
      code: 'CAMPAIGN_ANALYTICS_FAILED'
    });
  }
};

// ============================================
// Email Template Controller Methods
// ============================================

/**
 * Get all email templates
 * GET /api/marketing/email-templates
 */
exports.getEmailTemplates = async (req, res) => {
  try {
    const { category } = req.query;
    
    let templates = Array.from(emailTemplates.values());
    
    if (category) {
      templates = templates.filter(t => t.category === category);
    }
    
    res.json({
      success: true,
      data: templates
    });
    
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve templates',
      code: 'TEMPLATES_FAILED'
    });
  }
};

/**
 * Get email template by ID
 * GET /api/marketing/email-templates/:templateId
 */
exports.getEmailTemplate = async (req, res) => {
  try {
    const { templateId } = req.params;
    
    const template = emailTemplates.get(templateId);
    
    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found',
        code: 'TEMPLATE_NOT_FOUND'
      });
    }
    
    res.json({
      success: true,
      data: template
    });
    
  } catch (error) {
    console.error('Get template error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve template',
      code: 'TEMPLATE_FAILED'
    });
  }
};

/**
 * Create email template
 * POST /api/marketing/email-templates
 */
exports.createEmailTemplate = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }
    
    const { name, subject, htmlContent, textContent, category, variables } = req.body;
    
    const templateId = generateId('tmpl');
    const template = {
      id: templateId,
      name,
      subject,
      htmlContent,
      textContent: textContent || '',
      category: category || EMAIL_TEMPLATE_CATEGORIES.GENERAL,
      variables: variables || [],
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
      error: 'Failed to create email template',
      code: 'CREATE_TEMPLATE_FAILED'
    });
  }
};

/**
 * Update email template
 * PUT /api/marketing/email-templates/:templateId
 */
exports.updateEmailTemplate = async (req, res) => {
  try {
    const { templateId } = req.params;
    const updates = req.body;
    
    const template = emailTemplates.get(templateId);
    
    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found',
        code: 'TEMPLATE_NOT_FOUND'
      });
    }
    
    const updatedTemplate = {
      ...template,
      ...updates,
      updatedAt: new Date().toISOString(),
      updatedBy: req.user.id
    };
    
    emailTemplates.set(templateId, updatedTemplate);
    
    res.json({
      success: true,
      message: 'Template updated successfully',
      data: updatedTemplate
    });
    
  } catch (error) {
    console.error('Update template error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update template',
      code: 'UPDATE_TEMPLATE_FAILED'
    });
  }
};

/**
 * Delete email template
 * DELETE /api/marketing/email-templates/:templateId
 */
exports.deleteEmailTemplate = async (req, res) => {
  try {
    const { templateId } = req.params;
    
    const template = emailTemplates.get(templateId);
    
    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found',
        code: 'TEMPLATE_NOT_FOUND'
      });
    }
    
    emailTemplates.delete(templateId);
    
    res.json({
      success: true,
      message: 'Template deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete template error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete template',
      code: 'DELETE_TEMPLATE_FAILED'
    });
  }
};

/**
 * Preview email template
 * POST /api/marketing/email-templates/:templateId/preview
 */
exports.previewEmailTemplate = async (req, res) => {
  try {
    const { templateId } = req.params;
    const { variables } = req.body;
    
    const template = emailTemplates.get(templateId);
    
    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found',
        code: 'TEMPLATE_NOT_FOUND'
      });
    }
    
    const defaultVariables = {
      name: 'Sample User',
      email: 'user@example.com',
      streak: '7',
      badgeName: 'Week Warrior',
      badgeIcon: '🏆',
      badgeDescription: 'Maintained a 7-day learning streak',
      startUrl: 'https://speakflow.com/get-started',
      practiceUrl: 'https://speakflow.com/practice',
      shareUrl: 'https://speakflow.com/share',
      couponCode: 'SAVE30',
      upgradeUrl: 'https://speakflow.com/upgrade',
      expiryDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
    };
    
    const mergedVariables = { ...defaultVariables, ...variables };
    const processed = processTemplate(template, mergedVariables);
    
    res.json({
      success: true,
      data: {
        subject: processed.subject,
        htmlPreview: processed.html,
        textPreview: processed.text,
        variables: template.variables
      }
    });
    
  } catch (error) {
    console.error('Preview template error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to preview template',
      code: 'PREVIEW_TEMPLATE_FAILED'
    });
  }
};

// ============================================
// Segment Controller Methods
// ============================================

/**
 * Get all user segments
 * GET /api/marketing/segments
 */
exports.getSegments = async (req, res) => {
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
      error: 'Failed to retrieve segments',
      code: 'SEGMENTS_FAILED'
    });
  }
};

/**
 * Get segment by ID
 * GET /api/marketing/segments/:segmentId
 */
exports.getSegment = async (req, res) => {
  try {
    const { segmentId } = req.params;
    
    const segment = userSegments.get(segmentId);
    
    if (!segment) {
      return res.status(404).json({
        success: false,
        error: 'Segment not found',
        code: 'SEGMENT_NOT_FOUND'
      });
    }
    
    // Get sample users in segment
    const sampleUsers = await getUsersBySegment(segmentId, 10);
    
    res.json({
      success: true,
      data: {
        ...segment,
        sampleUsers
      }
    });
    
  } catch (error) {
    console.error('Get segment error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve segment',
      code: 'SEGMENT_FAILED'
    });
  }
};

/**
 * Create user segment
 * POST /api/marketing/segments
 */
exports.createSegment = async (req, res) => {
  try {
    const { name, description, conditions } = req.body;
    
    if (!name || !conditions) {
      return res.status(400).json({
        success: false,
        error: 'Name and conditions are required',
        code: 'MISSING_FIELDS'
      });
    }
    
    const segmentId = generateId('seg');
    const segment = {
      id: segmentId,
      name,
      description: description || '',
      conditions,
      count: 0, // Will be calculated
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
      error: 'Failed to create segment',
      code: 'CREATE_SEGMENT_FAILED'
    });
  }
};

/**
 * Update user segment
 * PUT /api/marketing/segments/:segmentId
 */
exports.updateSegment = async (req, res) => {
  try {
    const { segmentId } = req.params;
    const updates = req.body;
    
    const segment = userSegments.get(segmentId);
    
    if (!segment) {
      return res.status(404).json({
        success: false,
        error: 'Segment not found',
        code: 'SEGMENT_NOT_FOUND'
      });
    }
    
    const updatedSegment = {
      ...segment,
      ...updates,
      updatedAt: new Date().toISOString(),
      updatedBy: req.user.id
    };
    
    userSegments.set(segmentId, updatedSegment);
    
    res.json({
      success: true,
      message: 'Segment updated successfully',
      data: updatedSegment
    });
    
  } catch (error) {
    console.error('Update segment error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update segment',
      code: 'UPDATE_SEGMENT_FAILED'
    });
  }
};

/**
 * Delete user segment
 * DELETE /api/marketing/segments/:segmentId
 */
exports.deleteSegment = async (req, res) => {
  try {
    const { segmentId } = req.params;
    
    const segment = userSegments.get(segmentId);
    
    if (!segment) {
      return res.status(404).json({
        success: false,
        error: 'Segment not found',
        code: 'SEGMENT_NOT_FOUND'
      });
    }
    
    userSegments.delete(segmentId);
    
    res.json({
      success: true,
      message: 'Segment deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete segment error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete segment',
      code: 'DELETE_SEGMENT_FAILED'
    });
  }
};

// ============================================
// Newsletter Controller Methods
// ============================================

/**
 * Subscribe to newsletter
 * POST /api/marketing/subscribe
 */
exports.subscribeNewsletter = async (req, res) => {
  try {
    const { email, name, preferences } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required',
        code: 'EMAIL_REQUIRED'
      });
    }
    
    // Check if already subscribed
    let existingSubscriber = null;
    for (const [id, sub] of newsletterSubscriptions.entries()) {
      if (sub.email === email) {
        existingSubscriber = sub;
        break;
      }
    }
    
    if (existingSubscriber && existingSubscriber.status === 'active') {
      return res.status(400).json({
        success: false,
        error: 'Email already subscribed',
        code: 'ALREADY_SUBSCRIBED'
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
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    };
    
    newsletterSubscriptions.set(subscriberId, subscriber);
    
    // Send welcome email
    const welcomeTemplate = emailTemplates.get('welcome_email');
    if (welcomeTemplate) {
      const processed = processTemplate(welcomeTemplate, {
        name: name || 'there',
        startUrl: 'https://speakflow.com/get-started'
      });
      
      await sendEmail(email, processed.subject, processed.html, processed.text);
    }
    
    res.json({
      success: true,
      message: 'Successfully subscribed to newsletter',
      data: {
        email: subscriber.email,
        preferences: subscriber.preferences
      }
    });
    
  } catch (error) {
    console.error('Subscribe error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to subscribe',
      code: 'SUBSCRIBE_FAILED'
    });
  }
};

/**
 * Unsubscribe from newsletter
 * POST /api/marketing/unsubscribe
 */
exports.unsubscribeNewsletter = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required',
        code: 'EMAIL_REQUIRED'
      });
    }
    
    let found = false;
    for (const [id, subscriber] of newsletterSubscriptions.entries()) {
      if (subscriber.email === email) {
        subscriber.status = 'unsubscribed';
        subscriber.unsubscribedAt = new Date().toISOString();
        newsletterSubscriptions.set(id, subscriber);
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
      error: 'Failed to unsubscribe',
      code: 'UNSUBSCRIBE_FAILED'
    });
  }
};

/**
 * Update newsletter preferences
 * PUT /api/marketing/newsletter/preferences
 */
exports.updateNewsletterPreferences = async (req, res) => {
  try {
    const { email, preferences } = req.body;
    
    if (!email || !preferences) {
      return res.status(400).json({
        success: false,
        error: 'Email and preferences are required',
        code: 'MISSING_FIELDS'
      });
    }
    
    let subscriber = null;
    for (const [id, sub] of newsletterSubscriptions.entries()) {
      if (sub.email === email) {
        subscriber = sub;
        break;
      }
    }
    
    if (!subscriber) {
      return res.status(404).json({
        success: false,
        error: 'Subscriber not found',
        code: 'SUBSCRIBER_NOT_FOUND'
      });
    }
    
    subscriber.preferences = { ...subscriber.preferences, ...preferences };
    subscriber.updatedAt = new Date().toISOString();
    
    res.json({
      success: true,
      message: 'Preferences updated successfully',
      data: subscriber.preferences
    });
    
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update preferences',
      code: 'UPDATE_PREFERENCES_FAILED'
    });
  }
};

// ============================================
// Referral Controller Methods
// ============================================

/**
 * Create referral code
 * POST /api/marketing/referral/create
 */
exports.createReferralCode = async (req, res) => {
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
      const referralData = referralCodes.get(existingCode);
      return res.json({
        success: true,
        data: {
          referralCode: existingCode,
          referralLink: `https://speakflow.com/signup?ref=${existingCode}`,
          stats: {
            uses: referralData.uses,
            rewards: referralData.rewards.length
          },
          isNew: false
        }
      });
    }
    
    const referralCode = generateReferralCode(userId);
    const referralData = referralCodes.get(referralCode);
    
    res.json({
      success: true,
      data: {
        referralCode,
        referralLink: `https://speakflow.com/signup?ref=${referralCode}`,
        stats: {
          uses: 0,
          rewards: 0
        },
        isNew: true
      }
    });
    
  } catch (error) {
    console.error('Create referral error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create referral code',
      code: 'CREATE_REFERRAL_FAILED'
    });
  }
};

/**
 * Use referral code
 * POST /api/marketing/referral/use
 */
exports.useReferralCode = async (req, res) => {
  try {
    const { referralCode } = req.body;
    const userId = req.user.id;
    
    if (!referralCode) {
      return res.status(400).json({
        success: false,
        error: 'Referral code is required',
        code: 'CODE_REQUIRED'
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
    
    // Check if user already used a referral
    let hasUsedReferral = false;
    for (const [code, data] of referralCodes.entries()) {
      if (data.rewards.some(r => r.userId === userId)) {
        hasUsedReferral = true;
        break;
      }
    }
    
    if (hasUsedReferral) {
      return res.status(400).json({
        success: false,
        error: 'You have already used a referral code',
        code: 'ALREADY_USED_REFERRAL'
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
    
    // Give rewards to both users
    const rewards = {
      referrer: {
        type: 'free_month',
        description: 'One month of Pro subscription',
        appliedAt: new Date().toISOString()
      },
      referred: {
        type: 'discount',
        amount: 20,
        description: '20% off your first month',
        appliedAt: new Date().toISOString()
      }
    };
    
    res.json({
      success: true,
      message: 'Referral code applied successfully!',
      data: {
        reward: rewards.referred,
        message: 'You\'ve received 20% off your first month!'
      }
    });
    
  } catch (error) {
    console.error('Use referral error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to apply referral code',
      code: 'USE_REFERRAL_FAILED'
    });
  }
};

/**
 * Get referral statistics
 * GET /api/marketing/referral/stats
 */
exports.getReferralStats = async (req, res) => {
  try {
    const userId = req.user.id;
    
    let userReferral = null;
    for (const [code, data] of referralCodes.entries()) {
      if (data.userId === userId) {
        userReferral = { code, ...data };
        break;
      }
    }
    
    const nextRewardAt = userReferral 
      ? userReferral.uses >= 5 ? null : `${5 - userReferral.uses} more referrals`
      : null;
    
    res.json({
      success: true,
      data: {
        hasReferralCode: !!userReferral,
        referralCode: userReferral?.code || null,
        referralLink: userReferral 
          ? `https://speakflow.com/signup?ref=${userReferral.code}`
          : null,
        totalUses: userReferral?.uses || 0,
        rewardsEarned: userReferral?.rewards?.length || 0,
        nextRewardAt,
        leaderboardPosition: Math.floor(Math.random() * 100) + 1 // Mock
      }
    });
    
  } catch (error) {
    console.error('Get referral stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve referral stats',
      code: 'REFERRAL_STATS_FAILED'
    });
  }
};

// ============================================
// Export all methods
// ============================================

module.exports = exports;
