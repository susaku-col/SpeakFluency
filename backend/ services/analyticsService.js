// ============================================
// Analytics Service
// SpeakFlow - AI Language Learning Platform
// ============================================

const { logger } = require('../middleware/logging');
const { AppError } = require('../middleware/errorHandler');

// ============================================
// Constants & Configuration
// ============================================

// Event types
const EVENT_TYPES = {
  // User events
  USER_SIGNUP: 'user_signup',
  USER_LOGIN: 'user_login',
  USER_LOGOUT: 'user_logout',
  USER_UPDATE: 'user_update',
  USER_DELETE: 'user_delete',
  
  // Session events
  SESSION_START: 'session_start',
  SESSION_COMPLETE: 'session_complete',
  SESSION_ABANDON: 'session_abandon',
  
  // Learning events
  LESSON_COMPLETE: 'lesson_complete',
  EXERCISE_SUBMIT: 'exercise_submit',
  PERFECT_SCORE: 'perfect_score',
  STREAK_MILESTONE: 'streak_milestone',
  LEVEL_UP: 'level_up',
  ACHIEVEMENT_UNLOCKED: 'achievement_unlocked',
  
  // Payment events
  SUBSCRIPTION_START: 'subscription_start',
  SUBSCRIPTION_CANCEL: 'subscription_cancel',
  SUBSCRIPTION_RENEW: 'subscription_renew',
  PAYMENT_SUCCESS: 'payment_success',
  PAYMENT_FAIL: 'payment_fail',
  
  // Engagement events
  FEATURE_USED: 'feature_used',
  CONTENT_VIEWED: 'content_viewed',
  SEARCH_PERFORMED: 'search_performed',
  SHARE_PERFORMED: 'share_performed',
  
  // Support events
  TICKET_CREATED: 'ticket_created',
  TICKET_RESOLVED: 'ticket_resolved',
  FEEDBACK_SUBMITTED: 'feedback_submitted'
};

// Metric types
const METRIC_TYPES = {
  COUNTER: 'counter',
  GAUGE: 'gauge',
  HISTOGRAM: 'histogram',
  TIMING: 'timing'
};

// Time intervals
const TIME_INTERVALS = {
  HOUR: 'hour',
  DAY: 'day',
  WEEK: 'week',
  MONTH: 'month',
  QUARTER: 'quarter',
  YEAR: 'year'
};

// ============================================
// Mock Data Storage (In production, use Redis/InfluxDB/PostgreSQL)
// ============================================

// Event storage
const eventStore = new Map();

// Metric storage
const metricStore = new Map();

// User activity tracking
const userActivity = new Map();

// Daily aggregates
const dailyAggregates = new Map();

// Weekly aggregates
const weeklyAggregates = new Map();

// Monthly aggregates
const monthlyAggregates = new Map();

// ============================================
// Helper Functions
// ============================================

/**
 * Generate timestamp ID
 */
const generateTimestampId = () => {
  return Date.now();
};

/**
 * Get date key for aggregation
 */
const getDateKey = (date, interval = TIME_INTERVALS.DAY) => {
  const d = new Date(date);
  
  switch (interval) {
    case TIME_INTERVALS.HOUR:
      return `${d.toISOString().split('T')[0]}-${d.getHours()}`;
    case TIME_INTERVALS.DAY:
      return d.toISOString().split('T')[0];
    case TIME_INTERVALS.WEEK:
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      return weekStart.toISOString().split('T')[0];
    case TIME_INTERVALS.MONTH:
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    default:
      return d.toISOString().split('T')[0];
  }
};

/**
 * Aggregate events by time period
 */
const aggregateEvents = (events, metric, interval = TIME_INTERVALS.DAY) => {
  const aggregated = new Map();
  
  for (const event of events) {
    const key = getDateKey(event.timestamp, interval);
    const value = metric === 'count' ? 1 : event.value || 1;
    
    aggregated.set(key, (aggregated.get(key) || 0) + value);
  }
  
  return Array.from(aggregated.entries())
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));
};

/**
 * Calculate percentage change
 */
const calculatePercentageChange = (current, previous) => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
};

/**
 * Calculate moving average
 */
const calculateMovingAverage = (data, windowSize = 7) => {
  const averages = [];
  
  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - windowSize + 1);
    const window = data.slice(start, i + 1);
    const avg = window.reduce((sum, val) => sum + val, 0) / window.length;
    averages.push(Math.round(avg * 100) / 100);
  }
  
  return averages;
};

/**
 * Calculate percentile
 */
const calculatePercentile = (values, percentile) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
};

// ============================================
// Event Tracking
// ============================================

/**
 * Track an event
 * @param {string} eventType - Type of event
 * @param {string} userId - User ID
 * @param {Object} metadata - Additional event data
 */
const trackEvent = async (eventType, userId, metadata = {}) => {
  const eventId = generateTimestampId();
  const event = {
    id: eventId,
    type: eventType,
    userId,
    timestamp: new Date().toISOString(),
    metadata,
    value: metadata.value || 1
  };
  
  // Store event
  if (!eventStore.has(eventType)) {
    eventStore.set(eventType, []);
  }
  eventStore.get(eventType).push(event);
  
  // Update user activity
  if (!userActivity.has(userId)) {
    userActivity.set(userId, []);
  }
  userActivity.get(userId).push(event);
  
  // Update daily aggregates
  const dateKey = getDateKey(event.timestamp);
  if (!dailyAggregates.has(dateKey)) {
    dailyAggregates.set(dateKey, new Map());
  }
  const daily = dailyAggregates.get(dateKey);
  daily.set(eventType, (daily.get(eventType) || 0) + 1);
  
  logger.info(`Event tracked: ${eventType}`, { userId, metadata });
  
  return event;
};

/**
 * Get events by type and date range
 */
const getEvents = async (eventType, startDate, endDate, limit = 1000) => {
  const events = eventStore.get(eventType) || [];
  
  const filtered = events.filter(event => {
    const eventDate = new Date(event.timestamp);
    return eventDate >= startDate && eventDate <= endDate;
  });
  
  return filtered.slice(-limit);
};

/**
 * Get event count by type
 */
const getEventCount = async (eventType, startDate, endDate) => {
  const events = await getEvents(eventType, startDate, endDate);
  return events.length;
};

// ============================================
// User Analytics
// ============================================

/**
 * Track user activity
 */
const trackUserActivity = async (userId, activity, metadata = {}) => {
  return await trackEvent(EVENT_TYPES.FEATURE_USED, userId, {
    activity,
    ...metadata
  });
};

/**
 * Get user engagement metrics
 */
const getUserEngagement = async (userId, days = 30) => {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const userEvents = userActivity.get(userId) || [];
  const recentEvents = userEvents.filter(event => {
    const eventDate = new Date(event.timestamp);
    return eventDate >= startDate && eventDate <= endDate;
  });
  
  // Calculate active days
  const activeDays = new Set();
  for (const event of recentEvents) {
    activeDays.add(new Date(event.timestamp).toISOString().split('T')[0]);
  }
  
  // Count by event type
  const eventCounts = {};
  for (const event of recentEvents) {
    eventCounts[event.type] = (eventCounts[event.type] || 0) + 1;
  }
  
  // Calculate session count (approximate)
  const sessionCount = recentEvents.filter(e => e.type === EVENT_TYPES.SESSION_START).length;
  
  // Calculate average session duration (mock - in production, calculate from session data)
  const avgSessionDuration = 15.5; // minutes
  
  return {
    userId,
    period: `${days} days`,
    activeDays: activeDays.size,
    totalEvents: recentEvents.length,
    sessionCount,
    avgSessionDuration,
    eventBreakdown: eventCounts,
    lastActive: recentEvents.length > 0 ? recentEvents[recentEvents.length - 1].timestamp : null
  };
};

/**
 * Get user retention
 */
const getUserRetention = async (cohortStartDate, cohortEndDate) => {
  // Mock retention data - in production, calculate from actual user data
  const retention = {
    day1: 68,
    day7: 45,
    day30: 32,
    day60: 25,
    day90: 18
  };
  
  return retention;
};

// ============================================
// Learning Analytics
// ============================================

/**
 * Track lesson completion
 */
const trackLessonComplete = async (userId, lessonId, score, duration, metadata = {}) => {
  return await trackEvent(EVENT_TYPES.LESSON_COMPLETE, userId, {
    lessonId,
    score,
    duration,
    ...metadata
  });
};

/**
 * Get learning progress metrics
 */
const getLearningMetrics = async (userId, startDate, endDate) => {
  const lessons = await getEvents(EVENT_TYPES.LESSON_COMPLETE, startDate, endDate);
  const userLessons = lessons.filter(l => l.userId === userId);
  
  if (userLessons.length === 0) {
    return {
      totalLessons: 0,
      averageScore: 0,
      totalMinutes: 0,
      perfectScores: 0,
      streak: 0
    };
  }
  
  const totalLessons = userLessons.length;
  const averageScore = userLessons.reduce((sum, l) => sum + (l.metadata.score || 0), 0) / totalLessons;
  const totalMinutes = userLessons.reduce((sum, l) => sum + (l.metadata.duration || 0), 0);
  const perfectScores = userLessons.filter(l => (l.metadata.score || 0) >= 100).length;
  
  return {
    totalLessons,
    averageScore: Math.round(averageScore),
    totalMinutes,
    perfectScores,
    streak: await calculateCurrentStreak(userId)
  };
};

/**
 * Calculate current learning streak
 */
const calculateCurrentStreak = async (userId) => {
  const userEvents = userActivity.get(userId) || [];
  const lessonEvents = userEvents.filter(e => e.type === EVENT_TYPES.LESSON_COMPLETE);
  
  if (lessonEvents.length === 0) return 0;
  
  let streak = 0;
  let currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);
  
  for (let i = 0; i < 30; i++) {
    const dateStr = currentDate.toISOString().split('T')[0];
    const hasLesson = lessonEvents.some(e => e.timestamp.split('T')[0] === dateStr);
    
    if (hasLesson) {
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    } else {
      break;
    }
  }
  
  return streak;
};

/**
 * Get skill progression
 */
const getSkillProgression = async (userId, skill, days = 90) => {
  // Mock skill progression data
  const progression = [];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  for (let i = 0; i <= days; i += 7) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const score = Math.min(100, 50 + (i / days) * 50 + (Math.random() * 10 - 5));
    
    progression.push({
      date: date.toISOString().split('T')[0],
      score: Math.round(score)
    });
  }
  
  return progression;
};

// ============================================
// Business Analytics
// ============================================

/**
 * Get revenue metrics
 */
const getRevenueMetrics = async (startDate, endDate) => {
  const payments = await getEvents(EVENT_TYPES.PAYMENT_SUCCESS, startDate, endDate);
  
  const totalRevenue = payments.reduce((sum, p) => sum + (p.metadata.amount || 0), 0);
  const transactionCount = payments.length;
  const averageOrderValue = transactionCount > 0 ? totalRevenue / transactionCount : 0;
  
  // Group by day
  const dailyRevenue = aggregateEvents(payments, 'amount', TIME_INTERVALS.DAY);
  
  return {
    totalRevenue,
    transactionCount,
    averageOrderValue: Math.round(averageOrderValue * 100) / 100,
    dailyRevenue,
    currency: 'USD'
  };
};

/**
 * Get subscription metrics
 */
const getSubscriptionMetrics = async (startDate, endDate) => {
  const subscriptions = await getEvents(EVENT_TYPES.SUBSCRIPTION_START, startDate, endDate);
  const cancellations = await getEvents(EVENT_TYPES.SUBSCRIPTION_CANCEL, startDate, endDate);
  
  const newSubscribers = subscriptions.length;
  const churned = cancellations.length;
  
  // Mock MRR calculation
  const mrr = 45678.50;
  const arr = mrr * 12;
  const ltv = 124.50;
  const churnRate = (churned / Math.max(1, newSubscribers)) * 100;
  
  return {
    newSubscribers,
    churned,
    mrr,
    arr,
    ltv,
    churnRate: Math.round(churnRate * 100) / 100,
    netGrowth: newSubscribers - churned
  };
};

/**
 * Get user acquisition metrics
 */
const getUserAcquisitionMetrics = async (startDate, endDate) => {
  const signups = await getEvents(EVENT_TYPES.USER_SIGNUP, startDate, endDate);
  
  // Group by source (mock)
  const sources = {
    organic: Math.floor(signups.length * 0.4),
    direct: Math.floor(signups.length * 0.25),
    referral: Math.floor(signups.length * 0.2),
    social: Math.floor(signups.length * 0.1),
    email: Math.floor(signups.length * 0.05)
  };
  
  // Daily signups
  const dailySignups = aggregateEvents(signups, 'count', TIME_INTERVALS.DAY);
  
  // Cost per acquisition (mock)
  const cac = 25.50;
  
  return {
    totalSignups: signups.length,
    dailySignups,
    sources,
    cac,
    conversionRate: 3.2 // percentage
  };
};

// ============================================
// Performance Analytics
// ============================================

/**
 * Track API performance
 */
const trackApiPerformance = async (endpoint, method, duration, statusCode) => {
  const metric = {
    endpoint,
    method,
    duration,
    statusCode,
    timestamp: new Date().toISOString()
  };
  
  if (!metricStore.has('api_performance')) {
    metricStore.set('api_performance', []);
  }
  metricStore.get('api_performance').push(metric);
  
  return metric;
};

/**
 * Get API performance metrics
 */
const getApiPerformanceMetrics = async (startDate, endDate) => {
  const metrics = metricStore.get('api_performance') || [];
  const filtered = metrics.filter(m => {
    const mDate = new Date(m.timestamp);
    return mDate >= startDate && mDate <= endDate;
  });
  
  const durations = filtered.map(m => m.duration);
  const byEndpoint = {};
  
  for (const metric of filtered) {
    const key = `${metric.method} ${metric.endpoint}`;
    if (!byEndpoint[key]) {
      byEndpoint[key] = [];
    }
    byEndpoint[key].push(metric.duration);
  }
  
  const endpointStats = {};
  for (const [endpoint, durations] of Object.entries(byEndpoint)) {
    endpointStats[endpoint] = {
      avg: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
      p95: calculatePercentile(durations, 95),
      p99: calculatePercentile(durations, 99),
      count: durations.length
    };
  }
  
  return {
    totalRequests: filtered.length,
    averageResponseTime: durations.length > 0 
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0,
    p95ResponseTime: calculatePercentile(durations, 95),
    p99ResponseTime: calculatePercentile(durations, 99),
    byEndpoint: endpointStats
  };
};

// ============================================
// Dashboard Analytics
// ============================================

/**
 * Get main dashboard metrics
 */
const getDashboardMetrics = async () => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 7);
  const monthStart = new Date(now);
  monthStart.setMonth(now.getMonth() - 1);
  
  // User metrics
  const signupsToday = await getEventCount(EVENT_TYPES.USER_SIGNUP, todayStart, now);
  const signupsThisWeek = await getEventCount(EVENT_TYPES.USER_SIGNUP, weekStart, now);
  const signupsThisMonth = await getEventCount(EVENT_TYPES.USER_SIGNUP, monthStart, now);
  
  // Session metrics
  const sessionsToday = await getEventCount(EVENT_TYPES.SESSION_COMPLETE, todayStart, now);
  const sessionsThisWeek = await getEventCount(EVENT_TYPES.SESSION_COMPLETE, weekStart, now);
  const sessionsThisMonth = await getEventCount(EVENT_TYPES.SESSION_COMPLETE, monthStart, now);
  
  // Payment metrics
  const revenue = await getRevenueMetrics(monthStart, now);
  
  // Engagement metrics
  const activeUsersToday = new Set();
  const eventsToday = await getEvents(EVENT_TYPES.FEATURE_USED, todayStart, now);
  for (const event of eventsToday) {
    activeUsersToday.add(event.userId);
  }
  
  return {
    users: {
      newToday: signupsToday,
      newThisWeek: signupsThisWeek,
      newThisMonth: signupsThisMonth,
      activeToday: activeUsersToday.size
    },
    learning: {
      sessionsToday,
      sessionsThisWeek,
      sessionsThisMonth,
      averageScore: 76.5
    },
    revenue: {
      monthly: revenue.totalRevenue,
      monthlyTransactions: revenue.transactionCount,
      averageOrderValue: revenue.averageOrderValue
    },
    engagement: {
      retention: await getUserRetention(monthStart, now),
      averageSessionDuration: 15.5
    }
  };
};

/**
 * Get real-time metrics
 */
const getRealtimeMetrics = async () => {
  const now = new Date();
  const lastHour = new Date(now);
  lastHour.setHours(now.getHours() - 1);
  
  const eventsLastHour = [];
  for (const [type, events] of eventStore.entries()) {
    const recent = events.filter(e => new Date(e.timestamp) >= lastHour);
    eventsLastHour.push(...recent);
  }
  
  const activeUsers = new Set(eventsLastHour.map(e => e.userId));
  const eventsByType = {};
  
  for (const event of eventsLastHour) {
    eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
  }
  
  return {
    timestamp: now.toISOString(),
    activeUsers: activeUsers.size,
    eventsPerMinute: Math.round(eventsLastHour.length / 60),
    eventsByType,
    topEvents: Object.entries(eventsByType)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type, count]) => ({ type, count }))
  };
};

// ============================================
// Export Service
// ============================================

module.exports = {
  // Event tracking
  trackEvent,
  getEvents,
  getEventCount,
  
  // User analytics
  trackUserActivity,
  getUserEngagement,
  getUserRetention,
  
  // Learning analytics
  trackLessonComplete,
  getLearningMetrics,
  getSkillProgression,
  calculateCurrentStreak,
  
  // Business analytics
  getRevenueMetrics,
  getSubscriptionMetrics,
  getUserAcquisitionMetrics,
  
  // Performance analytics
  trackApiPerformance,
  getApiPerformanceMetrics,
  
  // Dashboard analytics
  getDashboardMetrics,
  getRealtimeMetrics,
  
  // Utilities
  aggregateEvents,
  calculatePercentageChange,
  calculateMovingAverage,
  calculatePercentile,
  
  // Constants
  EVENT_TYPES,
  METRIC_TYPES,
  TIME_INTERVALS
};
