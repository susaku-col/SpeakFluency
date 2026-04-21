// ============================================
// Email Service
// SpeakFlow - AI Language Learning Platform
// ============================================

const sgMail = require('@sendgrid/mail');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const handlebars = require('handlebars');
const { logger } = require('../middleware/logging');
const { AppError } = require('../middleware/errorHandler');

// ============================================
// Constants & Configuration
// ============================================

// Email provider configuration
const EMAIL_PROVIDER = process.env.EMAIL_PROVIDER || 'sendgrid'; // sendgrid, smtp, ses
const FROM_EMAIL = process.env.EMAIL_FROM || 'noreply@speakflow.com';
const FROM_NAME = process.env.EMAIL_FROM_NAME || 'SpeakFlow Team';
const REPLY_TO = process.env.EMAIL_REPLY_TO || 'support@speakflow.com';

// Rate limiting
const EMAIL_RATE_LIMIT = {
  maxPerHour: 100,
  maxPerDay: 1000,
  cooldownMinutes: 1
};

// Email categories
const EMAIL_CATEGORIES = {
  WELCOME: 'welcome',
  VERIFICATION: 'verification',
  PASSWORD_RESET: 'password_reset',
  SUBSCRIPTION: 'subscription',
  PAYMENT: 'payment',
  REMINDER: 'reminder',
  ACHIEVEMENT: 'achievement',
  NEWSLETTER: 'newsletter',
  MARKETING: 'marketing',
  SUPPORT: 'support'
};

// Email priorities
const EMAIL_PRIORITIES = {
  HIGH: 'high',
  NORMAL: 'normal',
  LOW: 'low'
};

// Template directory
const TEMPLATE_DIR = path.join(__dirname, '../templates/emails');

// Initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// Email tracking
const emailLogs = new Map();
let emailCounter = 0;

// ============================================
// Helper Functions
// ============================================

/**
 * Generate unique email ID
 */
const generateEmailId = () => {
  emailCounter++;
  return `email_${Date.now()}_${emailCounter}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Log email activity
 */
const logEmail = (emailId, to, subject, status, error = null) => {
  const log = {
    id: emailId,
    to,
    subject,
    status,
    timestamp: new Date().toISOString(),
    error: error?.message
  };
  
  emailLogs.set(emailId, log);
  
  // Keep only last 10000 logs
  if (emailLogs.size > 10000) {
    const firstKey = emailLogs.keys().next().value;
    emailLogs.delete(firstKey);
  }
  
  logger.info(`Email ${status}: ${emailId} -> ${to} | Subject: ${subject}`);
  
  return log;
};

/**
 * Validate email address
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/;
  return emailRegex.test(email);
};

/**
 * Rate limit check
 */
const checkRateLimit = (to) => {
  // Simplified rate limiting - in production, use Redis
  const now = Date.now();
  const hourAgo = now - 60 * 60 * 1000;
  const dayAgo = now - 24 * 60 * 60 * 1000;
  
  const userEmails = Array.from(emailLogs.values()).filter(
    log => log.to === to && log.timestamp > new Date(hourAgo).toISOString()
  );
  
  const userEmailsDay = Array.from(emailLogs.values()).filter(
    log => log.to === to && log.timestamp > new Date(dayAgo).toISOString()
  );
  
  if (userEmails.length >= EMAIL_RATE_LIMIT.maxPerHour) {
    throw new AppError(`Rate limit exceeded for ${to}. Max ${EMAIL_RATE_LIMIT.maxPerHour} emails per hour.`, 429, 'EMAIL_RATE_LIMIT');
  }
  
  if (userEmailsDay.length >= EMAIL_RATE_LIMIT.maxPerDay) {
    throw new AppError(`Daily rate limit exceeded for ${to}. Max ${EMAIL_RATE_LIMIT.maxPerDay} emails per day.`, 429, 'EMAIL_DAILY_LIMIT');
  }
  
  return true;
};

/**
 * Load and compile Handlebars template
 */
const loadTemplate = async (templateName) => {
  const templatePath = path.join(TEMPLATE_DIR, `${templateName}.html`);
  
  if (!fs.existsSync(templatePath)) {
    throw new AppError(`Email template not found: ${templateName}`, 404, 'TEMPLATE_NOT_FOUND');
  }
  
  const templateContent = fs.readFileSync(templatePath, 'utf8');
  return handlebars.compile(templateContent);
};

/**
 * Render email template with variables
 */
const renderTemplate = async (templateName, variables = {}) => {
  try {
    const template = await loadTemplate(templateName);
    const html = template(variables);
    return html;
  } catch (error) {
    logger.error(`Template rendering error: ${templateName}`, error);
    throw error;
  }
};

// ============================================
// Email Provider Implementations
// ============================================

/**
 * Send email via SendGrid
 */
const sendViaSendGrid = async (options) => {
  const msg = {
    to: options.to,
    from: {
      email: options.from || FROM_EMAIL,
      name: options.fromName || FROM_NAME
    },
    subject: options.subject,
    html: options.html,
    text: options.text,
    replyTo: options.replyTo || REPLY_TO,
    categories: [options.category || 'general'],
    customArgs: {
      emailId: options.emailId,
      userId: options.userId || '',
      environment: process.env.NODE_ENV || 'development'
    }
  };
  
  if (options.attachments && options.attachments.length) {
    msg.attachments = options.attachments.map(att => ({
      content: att.content.toString('base64'),
      filename: att.filename,
      type: att.contentType,
      disposition: 'attachment'
    }));
  }
  
  if (options.trackingSettings) {
    msg.tracking_settings = options.trackingSettings;
  }
  
  const response = await sgMail.send(msg);
  return response;
};

/**
 * Send email via SMTP (Nodemailer)
 */
const sendViaSMTP = async (options) => {
  // Create transporter
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD
    }
  });
  
  const mailOptions = {
    from: `"${options.fromName || FROM_NAME}" <${options.from || FROM_EMAIL}>`,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
    replyTo: options.replyTo || REPLY_TO,
    headers: {
      'X-Email-ID': options.emailId,
      'X-User-ID': options.userId || '',
      'X-Environment': process.env.NODE_ENV || 'development'
    }
  };
  
  if (options.attachments && options.attachments.length) {
    mailOptions.attachments = options.attachments;
  }
  
  const info = await transporter.sendMail(mailOptions);
  return info;
};

/**
 * Send email (main dispatcher)
 */
const sendEmail = async (options) => {
  const emailId = generateEmailId();
  const startTime = Date.now();
  
  try {
    // Validate email
    if (!options.to || !isValidEmail(options.to)) {
      throw new AppError('Invalid recipient email address', 400, 'INVALID_EMAIL');
    }
    
    if (!options.subject) {
      throw new AppError('Email subject is required', 400, 'NO_SUBJECT');
    }
    
    if (!options.html && !options.text) {
      throw new AppError('Email content (html or text) is required', 400, 'NO_CONTENT');
    }
    
    // Check rate limit
    checkRateLimit(options.to);
    
    // Add email ID to options
    options.emailId = emailId;
    
    // Send via selected provider
    let response;
    const provider = options.provider || EMAIL_PROVIDER;
    
    switch (provider) {
      case 'sendgrid':
        response = await sendViaSendGrid(options);
        break;
      case 'smtp':
        response = await sendViaSMTP(options);
        break;
      default:
        throw new AppError(`Unknown email provider: ${provider}`, 400, 'UNKNOWN_PROVIDER');
    }
    
    const duration = Date.now() - startTime;
    logEmail(emailId, options.to, options.subject, 'sent');
    
    logger.info(`Email sent successfully in ${duration}ms`, {
      emailId,
      to: options.to,
      subject: options.subject,
      provider,
      duration
    });
    
    return {
      success: true,
      emailId,
      messageId: response?.messageId || response?.[0]?.headers?.['x-message-id'],
      provider,
      duration
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    logEmail(emailId, options.to, options.subject, 'failed', error);
    
    logger.error(`Email sending failed after ${duration}ms:`, error);
    
    throw new AppError(
      error.message || 'Failed to send email',
      error.statusCode || 500,
      error.code || 'EMAIL_SEND_FAILED'
    );
  }
};

// ============================================
// Template-Based Email Senders
// ============================================

/**
 * Send welcome email
 */
const sendWelcomeEmail = async (to, name, userId = null) => {
  const subject = `Welcome to SpeakFlow, ${name}! 🎉`;
  
  const html = await renderTemplate('welcome', {
    name,
    year: new Date().getFullYear(),
    loginUrl: `${process.env.FRONTEND_URL}/login`,
    dashboardUrl: `${process.env.FRONTEND_URL}/dashboard`,
    guideUrl: `${process.env.FRONTEND_URL}/guide`,
    supportEmail: REPLY_TO
  });
  
  const text = `Welcome to SpeakFlow, ${name}! Start your language learning journey today.`;
  
  return await sendEmail({
    to,
    subject,
    html,
    text,
    userId,
    category: EMAIL_CATEGORIES.WELCOME,
    priority: EMAIL_PRIORITIES.HIGH
  });
};

/**
 * Send email verification
 */
const sendVerificationEmail = async (to, name, verificationToken, userId = null) => {
  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
  const subject = 'Verify Your Email Address';
  
  const html = await renderTemplate('verify-email', {
    name,
    verificationUrl,
    supportEmail: REPLY_TO,
    year: new Date().getFullYear()
  });
  
  const text = `Please verify your email address by clicking this link: ${verificationUrl}`;
  
  return await sendEmail({
    to,
    subject,
    html,
    text,
    userId,
    category: EMAIL_CATEGORIES.VERIFICATION,
    priority: EMAIL_PRIORITIES.HIGH
  });
};

/**
 * Send password reset email
 */
const sendPasswordResetEmail = async (to, name, resetToken, userId = null) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
  const subject = 'Reset Your SpeakFlow Password';
  
  const html = await renderTemplate('password-reset', {
    name,
    resetUrl,
    expiryHours: 1,
    supportEmail: REPLY_TO,
    year: new Date().getFullYear()
  });
  
  const text = `Reset your password by clicking this link: ${resetUrl}. This link expires in 1 hour.`;
  
  return await sendEmail({
    to,
    subject,
    html,
    text,
    userId,
    category: EMAIL_CATEGORIES.PASSWORD_RESET,
    priority: EMAIL_PRIORITIES.HIGH
  });
};

/**
 * Send password change confirmation
 */
const sendPasswordChangeConfirmation = async (to, name, userId = null) => {
  const subject = 'Your Password Has Been Changed';
  
  const html = await renderTemplate('password-changed', {
    name,
    supportEmail: REPLY_TO,
    loginUrl: `${process.env.FRONTEND_URL}/login`,
    year: new Date().getFullYear()
  });
  
  const text = `Your SpeakFlow password has been changed. If this wasn't you, please contact support immediately.`;
  
  return await sendEmail({
    to,
    subject,
    html,
    text,
    userId,
    category: EMAIL_CATEGORIES.PASSWORD_RESET,
    priority: EMAIL_PRIORITIES.NORMAL
  });
};

/**
 * Send subscription confirmation
 */
const sendSubscriptionConfirmation = async (to, name, plan, amount, interval, userId = null) => {
  const subject = `Subscription Confirmed: ${plan} Plan`;
  
  const dashboardUrl = `${process.env.FRONTEND_URL}/dashboard`;
  const billingUrl = `${process.env.FRONTEND_URL}/settings/billing`;
  
  const html = await renderTemplate('subscription-confirmation', {
    name,
    plan,
    amount: `$${amount}`,
    interval,
    dashboardUrl,
    billingUrl,
    supportEmail: REPLY_TO,
    year: new Date().getFullYear()
  });
  
  const text = `Your ${plan} subscription has been activated. Thank you for upgrading!`;
  
  return await sendEmail({
    to,
    subject,
    html,
    text,
    userId,
    category: EMAIL_CATEGORIES.SUBSCRIPTION,
    priority: EMAIL_PRIORITIES.HIGH
  });
};

/**
 * Send payment receipt
 */
const sendPaymentReceipt = async (to, name, amount, currency, invoiceId, items = [], userId = null) => {
  const subject = `Payment Receipt - $${amount}`;
  
  const receiptUrl = `${process.env.FRONTEND_URL}/invoices/${invoiceId}`;
  
  const html = await renderTemplate('payment-receipt', {
    name,
    amount: `$${amount}`,
    currency: currency.toUpperCase(),
    invoiceId,
    receiptUrl,
    items,
    date: new Date().toLocaleDateString(),
    supportEmail: REPLY_TO,
    year: new Date().getFullYear()
  });
  
  const text = `Thank you for your payment of $${amount}. View your receipt: ${receiptUrl}`;
  
  return await sendEmail({
    to,
    subject,
    html,
    text,
    userId,
    category: EMAIL_CATEGORIES.PAYMENT,
    priority: EMAIL_PRIORITIES.HIGH
  });
};

/**
 * Send payment failed notification
 */
const sendPaymentFailedNotification = async (to, name, amount, reason, userId = null) => {
  const subject = 'Payment Failed - Please Update Your Payment Method';
  
  const billingUrl = `${process.env.FRONTEND_URL}/settings/billing`;
  
  const html = await renderTemplate('payment-failed', {
    name,
    amount: `$${amount}`,
    reason,
    billingUrl,
    supportEmail: REPLY_TO,
    year: new Date().getFullYear()
  });
  
  const text = `Your payment of $${amount} failed. Please update your payment method to continue using SpeakFlow.`;
  
  return await sendEmail({
    to,
    subject,
    html,
    text,
    userId,
    category: EMAIL_CATEGORIES.PAYMENT,
    priority: EMAIL_PRIORITIES.HIGH
  });
};

/**
 * Send daily practice reminder
 */
const sendDailyReminder = async (to, name, streak, userId = null) => {
  const subject = `Don't break your ${streak}-day streak! 🔥`;
  
  const practiceUrl = `${process.env.FRONTEND_URL}/practice`;
  
  const html = await renderTemplate('daily-reminder', {
    name,
    streak,
    practiceUrl,
    supportEmail: REPLY_TO,
    year: new Date().getFullYear()
  });
  
  const text = `You have a ${streak}-day streak! Practice for 15 minutes today to keep it going.`;
  
  return await sendEmail({
    to,
    subject,
    html,
    text,
    userId,
    category: EMAIL_CATEGORIES.REMINDER,
    priority: EMAIL_PRIORITIES.NORMAL
  });
};

/**
 * Send achievement unlocked email
 */
const sendAchievementEmail = async (to, name, achievementName, achievementIcon, userId = null) => {
  const subject = `🎉 Achievement Unlocked: ${achievementName}!`;
  
  const achievementsUrl = `${process.env.FRONTEND_URL}/profile/achievements`;
  
  const html = await renderTemplate('achievement-unlocked', {
    name,
    achievementName,
    achievementIcon,
    achievementsUrl,
    shareUrl: `${process.env.FRONTEND_URL}/share?achievement=${encodeURIComponent(achievementName)}`,
    supportEmail: REPLY_TO,
    year: new Date().getFullYear()
  });
  
  const text = `Congratulations! You've unlocked the "${achievementName}" achievement.`;
  
  return await sendEmail({
    to,
    subject,
    html,
    text,
    userId,
    category: EMAIL_CATEGORIES.ACHIEVEMENT,
    priority: EMAIL_PRIORITIES.NORMAL
  });
};

/**
 * Send newsletter
 */
const sendNewsletter = async (to, name, subject, content, unsubscribeToken, userId = null) => {
  const unsubscribeUrl = `${process.env.FRONTEND_URL}/unsubscribe?token=${unsubscribeToken}`;
  
  const html = await renderTemplate('newsletter', {
    name,
    content,
    unsubscribeUrl,
    year: new Date().getFullYear()
  });
  
  return await sendEmail({
    to,
    subject,
    html,
    text: content.replace(/<[^>]*>/g, ''),
    userId,
    category: EMAIL_CATEGORIES.NEWSLETTER,
    priority: EMAIL_PRIORITIES.LOW
  });
};

/**
 * Send support ticket confirmation
 */
const sendSupportTicketConfirmation = async (to, name, ticketNumber, subject, message, userId = null) => {
  const emailSubject = `Support Ticket Created: ${ticketNumber}`;
  
  const ticketUrl = `${process.env.FRONTEND_URL}/support/tickets/${ticketNumber}`;
  
  const html = await renderTemplate('support-ticket', {
    name,
    ticketNumber,
    subject,
    message,
    ticketUrl,
    supportEmail: REPLY_TO,
    year: new Date().getFullYear()
  });
  
  const text = `Your support ticket ${ticketNumber} has been created. We'll respond within 24 hours.`;
  
  return await sendEmail({
    to,
    subject: emailSubject,
    html,
    text,
    userId,
    category: EMAIL_CATEGORIES.SUPPORT,
    priority: EMAIL_PRIORITIES.NORMAL
  });
};

/**
 * Send support ticket reply notification
 */
const sendSupportReplyNotification = async (to, name, ticketNumber, replyMessage, userId = null) => {
  const subject = `New Reply on Support Ticket ${ticketNumber}`;
  
  const ticketUrl = `${process.env.FRONTEND_URL}/support/tickets/${ticketNumber}`;
  
  const html = await renderTemplate('support-reply', {
    name,
    ticketNumber,
    replyMessage,
    ticketUrl,
    supportEmail: REPLY_TO,
    year: new Date().getFullYear()
  });
  
  const text = `You have a new reply on support ticket ${ticketNumber}.`;
  
  return await sendEmail({
    to,
    subject,
    html,
    text,
    userId,
    category: EMAIL_CATEGORIES.SUPPORT,
    priority: EMAIL_PRIORITIES.NORMAL
  });
};

/**
 * Send account deletion confirmation
 */
const sendAccountDeletionConfirmation = async (to, name, userId = null) => {
  const subject = 'Your SpeakFlow Account Has Been Deleted';
  
  const reactivateUrl = `${process.env.FRONTEND_URL}/reactivate?email=${encodeURIComponent(to)}`;
  
  const html = await renderTemplate('account-deleted', {
    name,
    reactivateUrl,
    supportEmail: REPLY_TO,
    year: new Date().getFullYear()
  });
  
  const text = `Your SpeakFlow account has been deleted. You have 30 days to reactivate.`;
  
  return await sendEmail({
    to,
    subject,
    html,
    text,
    userId,
    category: EMAIL_CATEGORIES.SUPPORT,
    priority: EMAIL_PRIORITIES.HIGH
  });
};

// ============================================
// Bulk Email Service
// ============================================

/**
 * Send bulk emails (with rate limiting)
 */
const sendBulkEmails = async (recipients, templateName, variablesGenerator, options = {}) => {
  const results = {
    total: recipients.length,
    successful: 0,
    failed: 0,
    errors: []
  };
  
  const batchSize = options.batchSize || 10;
  const delayMs = options.delayMs || 1000;
  
  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize);
    
    const promises = batch.map(async (recipient) => {
      try {
        const variables = typeof variablesGenerator === 'function'
          ? variablesGenerator(recipient)
          : variablesGenerator;
        
        const html = await renderTemplate(templateName, variables);
        
        await sendEmail({
          to: recipient.email,
          subject: options.subject,
          html,
          text: options.text,
          userId: recipient.userId,
          category: options.category || EMAIL_CATEGORIES.NEWSLETTER,
          priority: EMAIL_PRIORITIES.LOW
        });
        
        results.successful++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          email: recipient.email,
          error: error.message
        });
        logger.error(`Bulk email failed for ${recipient.email}:`, error);
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
// Email Analytics
// ============================================

/**
 * Get email statistics
 */
const getEmailStats = async (startDate, endDate) => {
  const logs = Array.from(emailLogs.values());
  
  const filteredLogs = logs.filter(log => {
    const logDate = new Date(log.timestamp);
    return logDate >= startDate && logDate <= endDate;
  });
  
  const stats = {
    total: filteredLogs.length,
    sent: filteredLogs.filter(l => l.status === 'sent').length,
    failed: filteredLogs.filter(l => l.status === 'failed').length,
    byCategory: {},
    byHour: {},
    topRecipients: []
  };
  
  // Group by category
  for (const log of filteredLogs) {
    const category = log.category || 'general';
    stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
    
    const hour = new Date(log.timestamp).getHours();
    stats.byHour[hour] = (stats.byHour[hour] || 0) + 1;
  }
  
  // Top recipients
  const recipientCount = new Map();
  for (const log of filteredLogs) {
    recipientCount.set(log.to, (recipientCount.get(log.to) || 0) + 1);
  }
  
  stats.topRecipients = Array.from(recipientCount.entries())
    .map(([email, count]) => ({ email, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  
  return stats;
};

// ============================================
// Export Service
// ============================================

module.exports = {
  // Main send function
  sendEmail,
  
  // Template-based emails
  sendWelcomeEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordChangeConfirmation,
  sendSubscriptionConfirmation,
  sendPaymentReceipt,
  sendPaymentFailedNotification,
  sendDailyReminder,
  sendAchievementEmail,
  sendNewsletter,
  sendSupportTicketConfirmation,
  sendSupportReplyNotification,
  sendAccountDeletionConfirmation,
  
  // Bulk email
  sendBulkEmails,
  
  // Utilities
  renderTemplate,
  isValidEmail,
  getEmailStats,
  
  // Constants
  EMAIL_CATEGORIES,
  EMAIL_PRIORITIES
};
