// ============================================
// SendGrid Configuration
// SpeakFlow - AI Language Learning Platform
// ============================================

const sgMail = require('@sendgrid/mail');
const { logger } = require('../middleware/logging');

// ============================================
// Constants & Configuration
// ============================================

// Initialize SendGrid with API key
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
  sgMail.setSubstitutionWrappers('{{', '}}');
}

// Email configuration
const EMAIL_CONFIG = {
  from: {
    email: process.env.EMAIL_FROM || 'noreply@speakflow.com',
    name: process.env.EMAIL_FROM_NAME || 'SpeakFlow Team'
  },
  replyTo: process.env.EMAIL_REPLY_TO || 'support@speakflow.com',
  
  // Tracking settings
  tracking: {
    clickTracking: { enable: true, enable_text: true },
    openTracking: { enable: true },
    subscriptionTracking: { enable: true },
    ganalytics: { enable: false }
  },
  
  // Categories for email classification
  categories: {
    welcome: 'welcome',
    verification: 'email_verification',
    password: 'password_reset',
    subscription: 'subscription',
    payment: 'payment',
    reminder: 'reminder',
    newsletter: 'newsletter',
    support: 'support_ticket',
    marketing: 'marketing',
    transactional: 'transactional'
  },
  
  // IP pools (optional)
  ipPoolName: process.env.SENDGRID_IP_POOL || null,
  
  // Sandbox mode (for testing)
  sandboxMode: process.env.NODE_ENV === 'development' && process.env.SENDGRID_SANDBOX === 'true'
};

// Template IDs from SendGrid (set in environment variables)
const TEMPLATE_IDS = {
  WELCOME: process.env.SENDGRID_TEMPLATE_WELCOME,
  VERIFY_EMAIL: process.env.SENDGRID_TEMPLATE_VERIFY_EMAIL,
  PASSWORD_RESET: process.env.SENDGRID_TEMPLATE_PASSWORD_RESET,
  PASSWORD_CHANGED: process.env.SENDGRID_TEMPLATE_PASSWORD_CHANGED,
  SUBSCRIPTION_CONFIRM: process.env.SENDGRID_TEMPLATE_SUBSCRIPTION_CONFIRM,
  SUBSCRIPTION_CANCEL: process.env.SENDGRID_TEMPLATE_SUBSCRIPTION_CANCEL,
  PAYMENT_RECEIPT: process.env.SENDGRID_TEMPLATE_PAYMENT_RECEIPT,
  PAYMENT_FAILED: process.env.SENDGRID_TEMPLATE_PAYMENT_FAILED,
  DAILY_REMINDER: process.env.SENDGRID_TEMPLATE_DAILY_REMINDER,
  ACHIEVEMENT: process.env.SENDGRID_TEMPLATE_ACHIEVEMENT,
  NEWSLETTER: process.env.SENDGRID_TEMPLATE_NEWSLETTER,
  SUPPORT_TICKET: process.env.SENDGRID_TEMPLATE_SUPPORT_TICKET,
  SUPPORT_REPLY: process.env.SENDGRID_TEMPLATE_SUPPORT_REPLY,
  ACCOUNT_DELETED: process.env.SENDGRID_TEMPLATE_ACCOUNT_DELETED
};

// Rate limiting configuration
const RATE_LIMIT = {
  maxPerSecond: parseInt(process.env.SENDGRID_RATE_LIMIT) || 10,
  maxPerMinute: 600,
  maxPerHour: 10000
};

// Email validation
const ALLOWED_DOMAINS = process.env.ALLOWED_EMAIL_DOMAINS?.split(',') || [];
const BLOCKED_DOMAINS = process.env.BLOCKED_EMAIL_DOMAINS?.split(',') || [
  'tempmail.com', '10minutemail.com', 'guerrillamail.com'
];

// ============================================
// Rate Limiting Tracker
// ============================================

let emailCounter = 0;
let lastResetTime = Date.now();
const emailQueue = [];
let isProcessingQueue = false;

/**
 * Check rate limit
 */
const checkRateLimit = () => {
  const now = Date.now();
  
  // Reset counter every second
  if (now - lastResetTime >= 1000) {
    emailCounter = 0;
    lastResetTime = now;
  }
  
  if (emailCounter >= RATE_LIMIT.maxPerSecond) {
    return false;
  }
  
  return true;
};

/**
 * Increment rate limit counter
 */
const incrementRateLimit = () => {
  emailCounter++;
};

/**
 * Queue email for sending
 */
const queueEmail = async (msg) => {
  return new Promise((resolve, reject) => {
    emailQueue.push({ msg, resolve, reject });
    
    if (!isProcessingQueue) {
      processEmailQueue();
    }
  });
};

/**
 * Process email queue
 */
const processEmailQueue = async () => {
  if (isProcessingQueue) return;
  isProcessingQueue = true;
  
  while (emailQueue.length > 0) {
    if (!checkRateLimit()) {
      // Wait for next second
      await new Promise(resolve => setTimeout(resolve, 1000));
      continue;
    }
    
    const { msg, resolve, reject } = emailQueue.shift();
    
    try {
      const result = await sgMail.send(msg);
      incrementRateLimit();
      resolve(result);
    } catch (error) {
      reject(error);
    }
  }
  
  isProcessingQueue = false;
};

// ============================================
// Helper Functions
// ============================================

/**
 * Validate email address
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/;
  if (!emailRegex.test(email)) return false;
  
  const domain = email.split('@')[1].toLowerCase();
  
  // Check blocked domains
  if (BLOCKED_DOMAINS.includes(domain)) return false;
  
  // Check allowed domains (if configured)
  if (ALLOWED_DOMAINS.length > 0 && !ALLOWED_DOMAINS.includes(domain)) {
    return false;
  }
  
  return true;
};

/**
 * Validate email content
 */
const validateEmailContent = (msg) => {
  if (!msg.to || !isValidEmail(msg.to)) {
    throw new Error('Invalid recipient email address');
  }
  
  if (!msg.subject) {
    throw new Error('Email subject is required');
  }
  
  if (!msg.html && !msg.text && !msg.templateId) {
    throw new Error('Email content (html, text, or templateId) is required');
  }
  
  return true;
};

/**
 * Sanitize HTML content (basic XSS prevention)
 */
const sanitizeHtml = (html) => {
  if (!html) return html;
  
  // Remove potentially dangerous tags and attributes
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/g, '')
    .replace(/javascript:/gi, '')
    .replace(/vbscript:/gi, '');
};

/**
 * Log email sending
 */
const logEmailSend = (to, subject, category, success, error = null) => {
  const logData = {
    to,
    subject,
    category,
    success,
    timestamp: new Date().toISOString()
  };
  
  if (error) {
    logData.error = error.message;
    logger.error('Email send failed', logData);
  } else {
    logger.info('Email sent successfully', logData);
  }
};

// ============================================
// Main Send Functions
// ============================================

/**
 * Send email using SendGrid
 * @param {Object} options - Email options
 * @returns {Promise<Object>}
 */
const sendEmail = async (options) => {
  try {
    const {
      to,
      from,
      replyTo,
      subject,
      html,
      text,
      templateId,
      dynamicTemplateData,
      attachments,
      categories,
      customArgs,
      trackingSettings,
      sandboxMode
    } = options;
    
    // Validate email
    const msg = {
      to: Array.isArray(to) ? to.map(email => ({ email })) : { email: to },
      from: from || EMAIL_CONFIG.from,
      subject,
      categories: categories || [EMAIL_CONFIG.categories.transactional],
      trackingSettings: trackingSettings || EMAIL_CONFIG.tracking
    };
    
    if (replyTo) {
      msg.replyTo = { email: replyTo };
    } else if (EMAIL_CONFIG.replyTo) {
      msg.replyTo = { email: EMAIL_CONFIG.replyTo };
    }
    
    // Add content
    if (templateId) {
      msg.templateId = templateId;
      if (dynamicTemplateData) {
        msg.dynamicTemplateData = dynamicTemplateData;
      }
    } else {
      if (html) msg.html = sanitizeHtml(html);
      if (text) msg.text = text;
    }
    
    // Add attachments
    if (attachments && attachments.length) {
      msg.attachments = attachments.map(att => ({
        content: att.content.toString('base64'),
        filename: att.filename,
        type: att.type,
        disposition: att.disposition || 'attachment'
      }));
    }
    
    // Add custom arguments
    if (customArgs) {
      msg.customArgs = customArgs;
    }
    
    // IP Pool
    if (EMAIL_CONFIG.ipPoolName) {
      msg.ip_pool_name = EMAIL_CONFIG.ipPoolName;
    }
    
    // Sandbox mode
    if (sandboxMode || EMAIL_CONFIG.sandboxMode) {
      msg.mailSettings = { sandboxMode: { enable: true } };
    }
    
    // Validate before sending
    validateEmailContent(msg);
    
    // Send email (with queue for rate limiting)
    let result;
    if (RATE_LIMIT.maxPerSecond > 0) {
      result = await queueEmail(msg);
    } else {
      result = await sgMail.send(msg);
    }
    
    logEmailSend(to, subject, msg.categories[0], true);
    
    return {
      success: true,
      messageId: result[0]?.headers?.['x-message-id'] || result?.headers?.['x-message-id'],
      statusCode: result[0]?.statusCode || 202
    };
    
  } catch (error) {
    logEmailSend(options.to, options.subject, options.categories?.[0] || 'unknown', false, error);
    throw error;
  }
};

/**
 * Send email using template
 * @param {string} to - Recipient email
 * @param {string} templateName - Template name
 * @param {Object} data - Template data
 * @param {Object} options - Additional options
 * @returns {Promise<Object>}
 */
const sendTemplateEmail = async (to, templateName, data = {}, options = {}) => {
  const templateId = TEMPLATE_IDS[templateName.toUpperCase()];
  
  if (!templateId) {
    throw new Error(`Template not found: ${templateName}`);
  }
  
  return await sendEmail({
    to,
    templateId,
    dynamicTemplateData: data,
    categories: [EMAIL_CONFIG.categories[templateName.toLowerCase()] || EMAIL_CONFIG.categories.transactional],
    ...options
  });
};

// ============================================
// Specific Email Senders
// ============================================

/**
 * Send welcome email
 */
const sendWelcomeEmail = async (to, name, userId = null) => {
  const data = {
    name,
    year: new Date().getFullYear(),
    login_url: `${process.env.FRONTEND_URL}/login`,
    dashboard_url: `${process.env.FRONTEND_URL}/dashboard`,
    guide_url: `${process.env.FRONTEND_URL}/guide`,
    support_email: EMAIL_CONFIG.replyTo
  };
  
  return await sendTemplateEmail(to, 'WELCOME', data, {
    customArgs: { userId, emailType: 'welcome' }
  });
};

/**
 * Send email verification
 */
const sendVerificationEmail = async (to, name, verificationToken, userId = null) => {
  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
  
  const data = {
    name,
    verification_url: verificationUrl,
    support_email: EMAIL_CONFIG.replyTo,
    year: new Date().getFullYear()
  };
  
  return await sendTemplateEmail(to, 'VERIFY_EMAIL', data, {
    customArgs: { userId, emailType: 'verification', verificationToken }
  });
};

/**
 * Send password reset email
 */
const sendPasswordResetEmail = async (to, name, resetToken, userId = null) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
  
  const data = {
    name,
    reset_url: resetUrl,
    expiry_hours: 1,
    support_email: EMAIL_CONFIG.replyTo,
    year: new Date().getFullYear()
  };
  
  return await sendTemplateEmail(to, 'PASSWORD_RESET', data, {
    customArgs: { userId, emailType: 'password_reset', resetToken }
  });
};

/**
 * Send password changed confirmation
 */
const sendPasswordChangedEmail = async (to, name, userId = null) => {
  const data = {
    name,
    login_url: `${process.env.FRONTEND_URL}/login`,
    support_email: EMAIL_CONFIG.replyTo,
    year: new Date().getFullYear()
  };
  
  return await sendTemplateEmail(to, 'PASSWORD_CHANGED', data, {
    customArgs: { userId, emailType: 'password_changed' }
  });
};

/**
 * Send subscription confirmation
 */
const sendSubscriptionConfirmation = async (to, name, plan, amount, interval, userId = null) => {
  const data = {
    name,
    plan,
    amount: `$${amount}`,
    interval,
    dashboard_url: `${process.env.FRONTEND_URL}/dashboard`,
    billing_url: `${process.env.FRONTEND_URL}/settings/billing`,
    support_email: EMAIL_CONFIG.replyTo,
    year: new Date().getFullYear()
  };
  
  return await sendTemplateEmail(to, 'SUBSCRIPTION_CONFIRM', data, {
    customArgs: { userId, emailType: 'subscription_confirm', plan }
  });
};

/**
 * Send subscription cancellation confirmation
 */
const sendSubscriptionCancelEmail = async (to, name, plan, userId = null) => {
  const data = {
    name,
    plan,
    reactivate_url: `${process.env.FRONTEND_URL}/settings/billing`,
    support_email: EMAIL_CONFIG.replyTo,
    year: new Date().getFullYear()
  };
  
  return await sendTemplateEmail(to, 'SUBSCRIPTION_CANCEL', data, {
    customArgs: { userId, emailType: 'subscription_cancel', plan }
  });
};

/**
 * Send payment receipt
 */
const sendPaymentReceipt = async (to, name, amount, currency, invoiceId, items = [], userId = null) => {
  const receiptUrl = `${process.env.FRONTEND_URL}/invoices/${invoiceId}`;
  
  const data = {
    name,
    amount: `$${amount}`,
    currency: currency.toUpperCase(),
    invoice_id: invoiceId,
    receipt_url: receiptUrl,
    items: items.map(item => ({
      description: item.description,
      amount: `$${item.amount}`
    })),
    date: new Date().toLocaleDateString(),
    support_email: EMAIL_CONFIG.replyTo,
    year: new Date().getFullYear()
  };
  
  return await sendTemplateEmail(to, 'PAYMENT_RECEIPT', data, {
    customArgs: { userId, emailType: 'payment_receipt', invoiceId }
  });
};

/**
 * Send payment failed notification
 */
const sendPaymentFailedEmail = async (to, name, amount, reason, userId = null) => {
  const data = {
    name,
    amount: `$${amount}`,
    reason,
    update_payment_url: `${process.env.FRONTEND_URL}/settings/billing`,
    support_email: EMAIL_CONFIG.replyTo,
    year: new Date().getFullYear()
  };
  
  return await sendTemplateEmail(to, 'PAYMENT_FAILED', data, {
    customArgs: { userId, emailType: 'payment_failed' }
  });
};

/**
 * Send daily reminder
 */
const sendDailyReminder = async (to, name, streak, userId = null) => {
  const data = {
    name,
    streak,
    practice_url: `${process.env.FRONTEND_URL}/practice`,
    support_email: EMAIL_CONFIG.replyTo,
    year: new Date().getFullYear()
  };
  
  return await sendTemplateEmail(to, 'DAILY_REMINDER', data, {
    customArgs: { userId, emailType: 'daily_reminder', streak }
  });
};

/**
 * Send achievement unlocked email
 */
const sendAchievementEmail = async (to, name, achievementName, achievementIcon, userId = null) => {
  const data = {
    name,
    achievement_name: achievementName,
    achievement_icon: achievementIcon,
    share_url: `${process.env.FRONTEND_URL}/share?achievement=${encodeURIComponent(achievementName)}`,
    achievements_url: `${process.env.FRONTEND_URL}/profile/achievements`,
    support_email: EMAIL_CONFIG.replyTo,
    year: new Date().getFullYear()
  };
  
  return await sendTemplateEmail(to, 'ACHIEVEMENT', data, {
    customArgs: { userId, emailType: 'achievement', achievementName }
  });
};

/**
 * Send newsletter
 */
const sendNewsletter = async (to, name, subject, content, unsubscribeToken, userId = null) => {
  const data = {
    name,
    subject,
    content,
    unsubscribe_url: `${process.env.FRONTEND_URL}/unsubscribe?token=${unsubscribeToken}`,
    year: new Date().getFullYear()
  };
  
  return await sendTemplateEmail(to, 'NEWSLETTER', data, {
    customArgs: { userId, emailType: 'newsletter', unsubscribeToken }
  });
};

/**
 * Send support ticket confirmation
 */
const sendSupportTicketEmail = async (to, name, ticketNumber, subject, message, userId = null) => {
  const data = {
    name,
    ticket_number: ticketNumber,
    ticket_subject: subject,
    ticket_message: message,
    ticket_url: `${process.env.FRONTEND_URL}/support/tickets/${ticketNumber}`,
    support_email: EMAIL_CONFIG.replyTo,
    year: new Date().getFullYear()
  };
  
  return await sendTemplateEmail(to, 'SUPPORT_TICKET', data, {
    customArgs: { userId, emailType: 'support_ticket', ticketNumber }
  });
};

/**
 * Send support reply notification
 */
const sendSupportReplyEmail = async (to, name, ticketNumber, replyMessage, userId = null) => {
  const data = {
    name,
    ticket_number: ticketNumber,
    reply_message: replyMessage,
    ticket_url: `${process.env.FRONTEND_URL}/support/tickets/${ticketNumber}`,
    support_email: EMAIL_CONFIG.replyTo,
    year: new Date().getFullYear()
  };
  
  return await sendTemplateEmail(to, 'SUPPORT_REPLY', data, {
    customArgs: { userId, emailType: 'support_reply', ticketNumber }
  });
};

/**
 * Send account deletion confirmation
 */
const sendAccountDeletedEmail = async (to, name, userId = null) => {
  const data = {
    name,
    reactivate_url: `${process.env.FRONTEND_URL}/reactivate?email=${encodeURIComponent(to)}`,
    support_email: EMAIL_CONFIG.replyTo,
    year: new Date().getFullYear()
  };
  
  return await sendTemplateEmail(to, 'ACCOUNT_DELETED', data, {
    customArgs: { userId, emailType: 'account_deleted' }
  });
};

// ============================================
// Bulk Email Functions
// ============================================

/**
 * Send bulk emails
 * @param {Array} recipients - Array of recipient objects
 * @param {string} templateName - Template name
 * @param {Function} dataGenerator - Function to generate template data per recipient
 * @param {Object} options - Additional options
 * @returns {Promise<Object>}
 */
const sendBulkEmails = async (recipients, templateName, dataGenerator, options = {}) => {
  const results = {
    total: recipients.length,
    successful: 0,
    failed: 0,
    errors: []
  };
  
  const batchSize = options.batchSize || 50;
  const delayMs = options.delayMs || 1000;
  
  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize);
    const promises = batch.map(async (recipient) => {
      try {
        const data = typeof dataGenerator === 'function'
          ? dataGenerator(recipient)
          : dataGenerator;
        
        await sendTemplateEmail(recipient.email, templateName, data, {
          customArgs: { userId: recipient.userId, ...options.customArgs }
        });
        
        results.successful++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          email: recipient.email,
          error: error.message
        });
      }
    });
    
    await Promise.all(promises);
    
    // Delay between batches
    if (i + batchSize < recipients.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  logger.info(`Bulk email completed: ${results.successful}/${results.total} sent`);
  
  return results;
};

// ============================================
// Email Status & Analytics
// ============================================

/**
 * Get email statistics from SendGrid
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Promise<Object>}
 */
const getEmailStats = async (startDate, endDate) => {
  try {
    // Note: This requires additional SendGrid API calls
    // Implement based on SendGrid's Statistics API
    logger.info('Fetching email statistics', { startDate, endDate });
    
    // Mock response - implement actual API call
    return {
      startDate,
      endDate,
      totalSent: 0,
      totalDelivered: 0,
      totalOpened: 0,
      totalClicked: 0,
      totalBounced: 0,
      totalSpamReports: 0,
      totalUnsubscribes: 0
    };
  } catch (error) {
    logger.error('Failed to fetch email stats:', error);
    throw error;
  }
};

/**
 * Get email bounce list
 * @returns {Promise<Array>}
 */
const getBounceList = async () => {
  try {
    // Implement based on SendGrid's Suppression API
    logger.info('Fetching bounce list');
    return [];
  } catch (error) {
    logger.error('Failed to fetch bounce list:', error);
    throw error;
  }
};

/**
 * Get email blocks list
 * @returns {Promise<Array>}
 */
const getBlocksList = async () => {
  try {
    // Implement based on SendGrid's Suppression API
    logger.info('Fetching blocks list');
    return [];
  } catch (error) {
    logger.error('Failed to fetch blocks list:', error);
    throw error;
  }
};

// ============================================
// Export Configuration
// ============================================

module.exports = {
  // Main send functions
  sendEmail,
  sendTemplateEmail,
  
  // Specific email senders
  sendWelcomeEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  sendSubscriptionConfirmation,
  sendSubscriptionCancelEmail,
  sendPaymentReceipt,
  sendPaymentFailedEmail,
  sendDailyReminder,
  sendAchievementEmail,
  sendNewsletter,
  sendSupportTicketEmail,
  sendSupportReplyEmail,
  sendAccountDeletedEmail,
  
  // Bulk email
  sendBulkEmails,
  
  // Email status
  getEmailStats,
  getBounceList,
  getBlocksList,
  
  // Utilities
  isValidEmail,
  
  // Constants
  EMAIL_CONFIG,
  TEMPLATE_IDS
};
