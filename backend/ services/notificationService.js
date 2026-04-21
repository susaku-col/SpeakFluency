// ============================================
// Notification Service
// SpeakFlow - AI Language Learning Platform
// ============================================

const { logger } = require('../middleware/logging');
const { AppError } = require('../middleware/errorHandler');
const webpush = require('web-push');

// ============================================
// Constants & Configuration
// ============================================

// Notification types
const NOTIFICATION_TYPES = {
  // Learning notifications
  STREAK_REMINDER: 'streak_reminder',
  DAILY_GOAL_COMPLETED: 'daily_goal_completed',
  LEVEL_UP: 'level_up',
  ACHIEVEMENT_UNLOCKED: 'achievement_unlocked',
  LESSON_RECOMMENDATION: 'lesson_recommendation',
  
  // Social notifications
  FRIEND_ACTIVITY: 'friend_activity',
  COMMUNITY_UPDATE: 'community_update',
  MENTION: 'mention',
  
  // System notifications
  MAINTENANCE: 'maintenance',
  FEATURE_UPDATE: 'feature_update',
  TIP_OF_DAY: 'tip_of_day',
  
  // Subscription notifications
  SUBSCRIPTION_RENEWAL: 'subscription_renewal',
  PAYMENT_SUCCESS: 'payment_success',
  PAYMENT_FAILED: 'payment_failed',
  TRIAL_ENDING: 'trial_ending',
  
  // Support notifications
  TICKET_RESPONSE: 'ticket_response',
  TICKET_RESOLVED: 'ticket_resolved'
};

// Notification priorities
const NOTIFICATION_PRIORITIES = {
  HIGH: 'high',
  NORMAL: 'normal',
  LOW: 'low'
};

// Notification channels
const NOTIFICATION_CHANNELS = {
  IN_APP: 'in_app',
  PUSH: 'push',
  EMAIL: 'email',
  SMS: 'sms'
};

// Delivery statuses
const DELIVERY_STATUS = {
  PENDING: 'pending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

// VAPID keys for web push
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:' + (process.env.VAPID_SUBJECT || 'notifications@speakflow.com'),
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// ============================================
// Mock Data Storage
// ============================================

// User notification preferences
const userPreferences = new Map();

// User push subscriptions
const pushSubscriptions = new Map();

// Notifications storage
const notificationsStore = new Map();

// Notification templates
const notificationTemplates = new Map();

// ============================================
// Default Notification Templates
// ============================================

const defaultTemplates = {
  [NOTIFICATION_TYPES.STREAK_REMINDER]: {
    title: '🔥 Don\'t break your streak!',
    body: 'You have a {{streak}}-day streak! Practice for 15 minutes to keep it going.',
    icon: '/icons/streak.png',
    channel: [NOTIFICATION_CHANNELS.IN_APP, NOTIFICATION_CHANNELS.PUSH],
    priority: NOTIFICATION_PRIORITIES.NORMAL
  },
  [NOTIFICATION_TYPES.DAILY_GOAL_COMPLETED]: {
    title: '🎉 Daily Goal Completed!',
    body: 'Congratulations! You\'ve reached your daily goal of {{goalTarget}} {{goalType}}.',
    icon: '/icons/goal.png',
    channel: [NOTIFICATION_CHANNELS.IN_APP, NOTIFICATION_CHANNELS.PUSH],
    priority: NOTIFICATION_PRIORITIES.NORMAL
  },
  [NOTIFICATION_TYPES.LEVEL_UP]: {
    title: '🎯 Level Up!',
    body: 'Congratulations! You\'ve reached Level {{newLevel}}! Keep up the great work!',
    icon: '/icons/level-up.png',
    channel: [NOTIFICATION_CHANNELS.IN_APP, NOTIFICATION_CHANNELS.PUSH, NOTIFICATION_CHANNELS.EMAIL],
    priority: NOTIFICATION_PRIORITIES.HIGH
  },
  [NOTIFICATION_TYPES.ACHIEVEMENT_UNLOCKED]: {
    title: '🏆 Achievement Unlocked!',
    body: 'You\'ve earned the "{{achievementName}}" achievement!',
    icon: '/icons/achievement.png',
    channel: [NOTIFICATION_CHANNELS.IN_APP, NOTIFICATION_CHANNELS.PUSH],
    priority: NOTIFICATION_PRIORITIES.HIGH
  },
  [NOTIFICATION_TYPES.PAYMENT_FAILED]: {
    title: '⚠️ Payment Failed',
    body: 'Your recent payment of {{amount}} failed. Please update your payment method.',
    icon: '/icons/payment-failed.png',
    channel: [NOTIFICATION_CHANNELS.IN_APP, NOTIFICATION_CHANNELS.EMAIL, NOTIFICATION_CHANNELS.PUSH],
    priority: NOTIFICATION_PRIORITIES.HIGH
  },
  [NOTIFICATION_TYPES.SUBSCRIPTION_RENEWAL]: {
    title: '🔄 Subscription Renewed',
    body: 'Your {{planName}} plan has been renewed for {{amount}}.',
    icon: '/icons/subscription.png',
    channel: [NOTIFICATION_CHANNELS.IN_APP, NOTIFICATION_CHANNELS.EMAIL],
    priority: NOTIFICATION_PRIORITIES.NORMAL
  },
  [NOTIFICATION_TYPES.TICKET_RESPONSE]: {
    title: '💬 Support Ticket Update',
    body: 'You have a new response on ticket #{{ticketNumber}}.',
    icon: '/icons/support.png',
    channel: [NOTIFICATION_CHANNELS.IN_APP, NOTIFICATION_CHANNELS.EMAIL],
    priority: NOTIFICATION_PRIORITIES.NORMAL
  },
  [NOTIFICATION_TYPES.FEATURE_UPDATE]: {
    title: '✨ New Feature Available!',
    body: 'Check out our latest feature: {{featureName}}.',
    icon: '/icons/feature.png',
    channel: [NOTIFICATION_CHANNELS.IN_APP, NOTIFICATION_CHANNELS.EMAIL],
    priority: NOTIFICATION_PRIORITIES.LOW
  },
  [NOTIFICATION_TYPES.TIP_OF_DAY]: {
    title: '💡 Tip of the Day',
    body: '{{tip}}',
    icon: '/icons/tip.png',
    channel: [NOTIFICATION_CHANNELS.IN_APP],
    priority: NOTIFICATION_PRIORITIES.LOW
  }
};

// Initialize templates
Object.entries(defaultTemplates).forEach(([key, template]) => {
  notificationTemplates.set(key, template);
});

// ============================================
// Helper Functions
// ============================================

/**
 * Generate unique notification ID
 */
const generateNotificationId = () => {
  return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Get user notification preferences
 */
const getUserPreferences = (userId) => {
  if (!userPreferences.has(userId)) {
    userPreferences.set(userId, {
      userId,
      channels: {
        [NOTIFICATION_CHANNELS.IN_APP]: true,
        [NOTIFICATION_CHANNELS.PUSH]: true,
        [NOTIFICATION_CHANNELS.EMAIL]: true,
        [NOTIFICATION_CHANNELS.SMS]: false
      },
      types: {
        [NOTIFICATION_TYPES.STREAK_REMINDER]: true,
        [NOTIFICATION_TYPES.DAILY_GOAL_COMPLETED]: true,
        [NOTIFICATION_TYPES.LEVEL_UP]: true,
        [NOTIFICATION_TYPES.ACHIEVEMENT_UNLOCKED]: true,
        [NOTIFICATION_TYPES.LESSON_RECOMMENDATION]: true,
        [NOTIFICATION_TYPES.FRIEND_ACTIVITY]: false,
        [NOTIFICATION_TYPES.COMMUNITY_UPDATE]: false,
        [NOTIFICATION_TYPES.MAINTENANCE]: true,
        [NOTIFICATION_TYPES.FEATURE_UPDATE]: true,
        [NOTIFICATION_TYPES.TIP_OF_DAY]: true,
        [NOTIFICATION_TYPES.SUBSCRIPTION_RENEWAL]: true,
        [NOTIFICATION_TYPES.PAYMENT_SUCCESS]: true,
        [NOTIFICATION_TYPES.PAYMENT_FAILED]: true,
        [NOTIFICATION_TYPES.TRIAL_ENDING]: true,
        [NOTIFICATION_TYPES.TICKET_RESPONSE]: true,
        [NOTIFICATION_TYPES.TICKET_RESOLVED]: true
      },
      quietHours: {
        enabled: false,
        start: '22:00',
        end: '08:00',
        timezone: 'UTC'
      },
      emailDigest: {
        enabled: true,
        frequency: 'daily' // daily, weekly
      }
    });
  }
  return userPreferences.get(userId);
};

/**
 * Check if notification should be sent based on preferences
 */
const shouldSendNotification = (userId, notificationType, channel) => {
  const prefs = getUserPreferences(userId);
  
  // Check if channel is enabled
  if (!prefs.channels[channel]) {
    return false;
  }
  
  // Check if notification type is enabled
  if (prefs.types[notificationType] === false) {
    return false;
  }
  
  // Check quiet hours
  if (prefs.quietHours.enabled) {
    const now = new Date();
    const currentHour = now.getHours();
    const [startHour] = prefs.quietHours.start.split(':').map(Number);
    const [endHour] = prefs.quietHours.end.split(':').map(Number);
    
    if (currentHour >= startHour || currentHour < endHour) {
      return false;
    }
  }
  
  return true;
};

/**
 * Process template variables
 */
const processTemplate = (template, variables) => {
  let title = template.title;
  let body = template.body;
  
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    title = title.replace(regex, value);
    body = body.replace(regex, value);
  }
  
  return { title, body };
};

/**
 * Save notification to database
 */
const saveNotification = async (notification) => {
  const id = generateNotificationId();
  const notificationRecord = {
    id,
    ...notification,
    status: DELIVERY_STATUS.PENDING,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    readAt: null,
    deliveredAt: null
  };
  
  if (!notificationsStore.has(notification.userId)) {
    notificationsStore.set(notification.userId, []);
  }
  
  notificationsStore.get(notification.userId).push(notificationRecord);
  
  // Keep only last 500 notifications per user
  const userNotifs = notificationsStore.get(notification.userId);
  if (userNotifs.length > 500) {
    notificationsStore.set(notification.userId, userNotifs.slice(-500));
  }
  
  return notificationRecord;
};

// ============================================
// Push Notification Service
// ============================================

/**
 * Save push subscription for user
 */
const savePushSubscription = async (userId, subscription) => {
  if (!pushSubscriptions.has(userId)) {
    pushSubscriptions.set(userId, []);
  }
  
  const subscriptions = pushSubscriptions.get(userId);
  
  // Check if subscription already exists
  const existingIndex = subscriptions.findIndex(
    sub => sub.endpoint === subscription.endpoint
  );
  
  if (existingIndex >= 0) {
    subscriptions[existingIndex] = subscription;
  } else {
    subscriptions.push(subscription);
  }
  
  pushSubscriptions.set(userId, subscriptions);
  
  logger.info(`Push subscription saved for user ${userId}`);
  
  return { success: true };
};

/**
 * Remove push subscription
 */
const removePushSubscription = async (userId, endpoint) => {
  if (!pushSubscriptions.has(userId)) {
    return { success: false };
  }
  
  const subscriptions = pushSubscriptions.get(userId);
  const filtered = subscriptions.filter(sub => sub.endpoint !== endpoint);
  pushSubscriptions.set(userId, filtered);
  
  logger.info(`Push subscription removed for user ${userId}`);
  
  return { success: true };
};

/**
 * Send push notification to user
 */
const sendPushNotification = async (userId, title, body, data = {}, icon = null) => {
  const subscriptions = pushSubscriptions.get(userId) || [];
  
  if (subscriptions.length === 0) {
    return { success: false, sent: 0, message: 'No push subscriptions' };
  }
  
  const payload = JSON.stringify({
    title,
    body,
    icon: icon || '/icons/notification.png',
    badge: '/icons/badge.png',
    data: {
      url: data.url || '/',
      ...data,
      timestamp: new Date().toISOString()
    },
    vibrate: [200, 100, 200],
    actions: data.actions || []
  });
  
  let sent = 0;
  let failed = 0;
  
  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(subscription, payload);
      sent++;
    } catch (error) {
      failed++;
      logger.error(`Failed to send push notification to ${userId}:`, error);
      
      // Remove invalid subscription
      if (error.statusCode === 410) {
        await removePushSubscription(userId, subscription.endpoint);
      }
    }
  }
  
  logger.info(`Push notification sent to ${userId}: ${sent} sent, ${failed} failed`);
  
  return { success: sent > 0, sent, failed };
};

// ============================================
// In-App Notification Service
// ============================================

/**
 * Send in-app notification
 */
const sendInAppNotification = async (userId, type, variables = {}, metadata = {}) => {
  const template = notificationTemplates.get(type);
  
  if (!template) {
    throw new AppError(`Unknown notification type: ${type}`, 400, 'UNKNOWN_NOTIFICATION_TYPE');
  }
  
  // Check user preferences
  if (!shouldSendNotification(userId, type, NOTIFICATION_CHANNELS.IN_APP)) {
    return { success: false, message: 'Notification disabled by user' };
  }
  
  const { title, body } = processTemplate(template, variables);
  
  const notification = {
    userId,
    type,
    title,
    body,
    data: metadata,
    channel: NOTIFICATION_CHANNELS.IN_APP,
    priority: template.priority,
    read: false
  };
  
  const saved = await saveNotification(notification);
  
  logger.info(`In-app notification sent to ${userId}: ${type}`);
  
  return {
    success: true,
    notification: saved
  };
};

/**
 * Get user notifications
 */
const getUserNotifications = async (userId, options = {}) => {
  const { limit = 50, offset = 0, unreadOnly = false, type = null } = options;
  
  let notifications = notificationsStore.get(userId) || [];
  
  if (unreadOnly) {
    notifications = notifications.filter(n => !n.read);
  }
  
  if (type) {
    notifications = notifications.filter(n => n.type === type);
  }
  
  // Sort by newest first
  notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  const paginated = notifications.slice(offset, offset + limit);
  const unreadCount = notifications.filter(n => !n.read).length;
  
  return {
    notifications: paginated,
    unreadCount,
    total: notifications.length,
    pagination: {
      limit,
      offset,
      hasMore: offset + limit < notifications.length
    }
  };
};

/**
 * Mark notification as read
 */
const markNotificationAsRead = async (userId, notificationId) => {
  const notifications = notificationsStore.get(userId) || [];
  const notification = notifications.find(n => n.id === notificationId);
  
  if (!notification) {
    throw new AppError('Notification not found', 404, 'NOTIFICATION_NOT_FOUND');
  }
  
  notification.read = true;
  notification.readAt = new Date().toISOString();
  notification.status = DELIVERY_STATUS.READ;
  
  notificationsStore.set(userId, notifications);
  
  return { success: true, notification };
};

/**
 * Mark all notifications as read
 */
const markAllNotificationsAsRead = async (userId) => {
  const notifications = notificationsStore.get(userId) || [];
  
  for (const notification of notifications) {
    if (!notification.read) {
      notification.read = true;
      notification.readAt = new Date().toISOString();
      notification.status = DELIVERY_STATUS.READ;
    }
  }
  
  notificationsStore.set(userId, notifications);
  
  return { success: true, count: notifications.filter(n => n.read).length };
};

/**
 * Delete notification
 */
const deleteNotification = async (userId, notificationId) => {
  const notifications = notificationsStore.get(userId) || [];
  const filtered = notifications.filter(n => n.id !== notificationId);
  
  notificationsStore.set(userId, filtered);
  
  return { success: true };
};

/**
 * Clear all notifications
 */
const clearAllNotifications = async (userId) => {
  notificationsStore.set(userId, []);
  return { success: true };
};

// ============================================
// Multi-Channel Notification Service
// ============================================

/**
 * Send notification through multiple channels
 */
const sendNotification = async (userId, type, variables = {}, options = {}) => {
  const template = notificationTemplates.get(type);
  
  if (!template) {
    throw new AppError(`Unknown notification type: ${type}`, 400, 'UNKNOWN_NOTIFICATION_TYPE');
  }
  
  const { title, body } = processTemplate(template, variables);
  const results = {};
  
  // Send to each channel based on template and options
  const channels = options.channels || template.channel;
  
  for (const channel of channels) {
    if (!shouldSendNotification(userId, type, channel)) {
      results[channel] = { success: false, message: 'Disabled by user preferences' };
      continue;
    }
    
    switch (channel) {
      case NOTIFICATION_CHANNELS.IN_APP:
        results[channel] = await sendInAppNotification(userId, type, variables, options.metadata);
        break;
        
      case NOTIFICATION_CHANNELS.PUSH:
        results[channel] = await sendPushNotification(userId, title, body, options.data, template.icon);
        break;
        
      case NOTIFICATION_CHANNELS.EMAIL:
        // Email sending handled by emailService
        results[channel] = { success: true, message: 'Email queued' };
        break;
        
      case NOTIFICATION_CHANNELS.SMS:
        // SMS sending handled by smsService
        results[channel] = { success: true, message: 'SMS queued' };
        break;
    }
  }
  
  logger.info(`Notification sent to ${userId}: ${type}`, results);
  
  return {
    success: true,
    type,
    results
  };
};

// ============================================
// Notification Preferences Management
// ============================================

/**
 * Update user notification preferences
 */
const updateNotificationPreferences = async (userId, updates) => {
  const prefs = getUserPreferences(userId);
  
  if (updates.channels) {
    prefs.channels = { ...prefs.channels, ...updates.channels };
  }
  
  if (updates.types) {
    prefs.types = { ...prefs.types, ...updates.types };
  }
  
  if (updates.quietHours) {
    prefs.quietHours = { ...prefs.quietHours, ...updates.quietHours };
  }
  
  if (updates.emailDigest) {
    prefs.emailDigest = { ...prefs.emailDigest, ...updates.emailDigest };
  }
  
  userPreferences.set(userId, prefs);
  
  logger.info(`Notification preferences updated for user ${userId}`);
  
  return prefs;
};

/**
 * Get user notification preferences
 */
const getNotificationPreferences = async (userId) => {
  return getUserPreferences(userId);
};

// ============================================
// Notification Templates Management
// ============================================

/**
 * Get notification template
 */
const getNotificationTemplate = (type) => {
  return notificationTemplates.get(type);
};

/**
 * Update notification template (admin only)
 */
const updateNotificationTemplate = async (type, updates) => {
  const template = notificationTemplates.get(type);
  
  if (!template) {
    throw new AppError(`Unknown notification type: ${type}`, 404, 'TEMPLATE_NOT_FOUND');
  }
  
  const updated = { ...template, ...updates };
  notificationTemplates.set(type, updated);
  
  logger.info(`Notification template updated: ${type}`);
  
  return updated;
};

// ============================================
// Scheduled Notifications
// ============================================

/**
 * Send streak reminder notifications
 */
const sendStreakReminders = async () => {
  // In production, query users with active streaks
  const users = Array.from(userGamificationData?.keys() || []);
  
  for (const userId of users) {
    await sendNotification(userId, NOTIFICATION_TYPES.STREAK_REMINDER, {
      streak: userData?.streak || 0
    });
  }
  
  logger.info(`Streak reminders sent to ${users.length} users`);
};

/**
 * Send daily tip notifications
 */
const sendDailyTips = async () => {
  const tips = [
    'Practice for 15 minutes every day to build a strong habit!',
    'Use the shadowing technique: listen and repeat immediately after native speakers.',
    'Record yourself speaking and compare with native pronunciation.',
    'Learn new words in context, not in isolation.',
    'Review vocabulary using spaced repetition for better retention.',
    'Join our community practice sessions for real conversation practice.',
    'Set daily goals to track your progress and stay motivated.'
  ];
  
  const tip = tips[Math.floor(Math.random() * tips.length)];
  
  // In production, send to active users only
  const users = Array.from(userGamificationData?.keys() || []);
  
  for (const userId of users) {
    await sendNotification(userId, NOTIFICATION_TYPES.TIP_OF_DAY, { tip });
  }
  
  logger.info(`Daily tips sent to ${users.length} users`);
};

// ============================================
// Export Service
// ============================================

module.exports = {
  // Main send function
  sendNotification,
  sendInAppNotification,
  sendPushNotification,
  
  // Push subscription management
  savePushSubscription,
  removePushSubscription,
  
  // Notification management
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  clearAllNotifications,
  
  // Preferences
  getNotificationPreferences,
  updateNotificationPreferences,
  
  // Templates
  getNotificationTemplate,
  updateNotificationTemplate,
  
  // Scheduled notifications
  sendStreakReminders,
  sendDailyTips,
  
  // Constants
  NOTIFICATION_TYPES,
  NOTIFICATION_PRIORITIES,
  NOTIFICATION_CHANNELS,
  DELIVERY_STATUS
};
