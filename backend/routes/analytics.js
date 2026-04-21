// ============================================
// Analytics Routes
// SpeakFlow - AI Language Learning Platform
// ============================================

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { query, param, validationResult } = require('express-validator');
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

const analyticsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: {
    success: false,
    error: 'Too many analytics requests. Please slow down.'
  }
});

// ============================================
// Validation Rules
// ============================================

const dateRangeValidation = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid start date format'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid end date format'),
];

// ============================================
// Mock Data Storage
// ============================================

// User learning data
const userLearningData = new Map();

// Daily activity logs
const dailyActivityLogs = new Map();

// Session analytics
const sessionAnalytics = new Map();

// ============================================
// Helper Functions
// ============================================

// Generate unique ID
const generateId = (prefix) => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Get date range for queries
const getDateRange = (startDate, endDate) => {
  const start = startDate ? new Date(startDate) : new Date();
  start.setHours(0, 0, 0, 0);
  
  const end = endDate ? new Date(endDate) : new Date();
  end.setHours(23, 59, 59, 999);
  
  return { start, end };
};

// Generate dates between range
const getDatesBetween = (startDate, endDate) => {
  const dates = [];
  const currentDate = new Date(startDate);
  const end = new Date(endDate);
  
  while (currentDate <= end) {
    dates.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return dates;
};

// Calculate moving average
const calculateMovingAverage = (data, windowSize = 7) => {
  const averages = [];
  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - windowSize + 1);
    const window = data.slice(start, i + 1);
    const avg = window.reduce((sum, val) => sum + val, 0) / window.length;
    averages.push(Math.round(avg));
  }
  return averages;
};

// Calculate percentile
const calculatePercentile = (scores, percentile) => {
  const sorted = [...scores].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index];
};

// Generate mock learning data for a user
const generateMockLearningData = (userId) => {
  const today = new Date();
  const data = [];
  
  for (let i = 0; i < 90; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    data.push({
      date: date.toISOString().split('T')[0],
      sessions: Math.floor(Math.random() * 5) + 1,
      minutes: Math.floor(Math.random() * 60) + 10,
      score: Math.floor(Math.random() * 30) + 60,
      xp: Math.floor(Math.random() * 100) + 20,
      wordsLearned: Math.floor(Math.random() * 15) + 1
    });
  }
  
  return data.sort((a, b) => new Date(a.date) - new Date(b.date));
};

// Initialize user data
const initUserData = (userId) => {
  if (!userLearningData.has(userId)) {
    userLearningData.set(userId, generateMockLearningData(userId));
  }
  return userLearningData.get(userId);
};

// ============================================
// Routes
// ============================================

/**
 * GET /api/analytics/dashboard
 * Get main analytics dashboard data
 */
router.get('/dashboard', authenticateToken, analyticsLimiter, async (req, res) => {
  try {
    const userId = req.user.id;
    const learningData = initUserData(userId);
    
    // Calculate overview metrics
    const totalSessions = learningData.reduce((sum, d) => sum + d.sessions, 0);
    const totalMinutes = learningData.reduce((sum, d) => sum + d.minutes, 0);
    const totalXP = learningData.reduce((sum, d) => sum + d.xp, 0);
    const totalWordsLearned = learningData.reduce((sum, d) => sum + d.wordsLearned, 0);
    
    const averageScore = learningData.reduce((sum, d) => sum + d.score, 0) / learningData.length;
    
    // Last 30 days data
    const last30Days = learningData.slice(-30);
    const currentPeriodAvg = last30Days.reduce((sum, d) => sum + d.score, 0) / last30Days.length;
    const previousPeriodAvg = learningData.slice(-60, -30).reduce((sum, d) => sum + d.score, 0) / 30;
    const improvement = ((currentPeriodAvg - previousPeriodAvg) / previousPeriodAvg) * 100;
    
    // Calculate streak
    let currentStreak = 0;
    for (let i = learningData.length - 1; i >= 0; i--) {
      if (learningData[i].sessions > 0) {
        currentStreak++;
      } else {
        break;
      }
    }
    
    // Calculate best streak
    let bestStreak = 0;
    let tempStreak = 0;
    for (const day of learningData) {
      if (day.sessions > 0) {
        tempStreak++;
        bestStreak = Math.max(bestStreak, tempStreak);
      } else {
        tempStreak = 0;
      }
    }
    
    // Weekly activity
    const weeklyActivity = [0, 0, 0, 0, 0, 0, 0];
    last30Days.forEach(day => {
      const dayOfWeek = new Date(day.date).getDay();
      weeklyActivity[dayOfWeek] += day.minutes;
    });
    
    res.json({
      success: true,
      data: {
        overview: {
          totalSessions,
          totalMinutes,
          totalXP,
          totalWordsLearned,
          averageScore: Math.round(averageScore),
          currentStreak,
          bestStreak,
          improvement: Math.round(improvement)
        },
        weeklyActivity: weeklyActivity.map(minutes => ({
          day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
          minutes
        })),
        recentTrend: {
          scores: last30Days.map(d => d.score),
          dates: last30Days.map(d => d.date)
        }
      }
    });
  } catch (error) {
    console.error('Dashboard analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve dashboard analytics'
    });
  }
});

/**
 * GET /api/analytics/progress
 * Get learning progress over time
 */
router.get('/progress', authenticateToken, analyticsLimiter, dateRangeValidation, async (req, res) => {
  try {
    const userId = req.user.id;
    const { startDate, endDate, metric = 'score', interval = 'day' } = req.query;
    
    const { start, end } = getDateRange(startDate, endDate);
    const learningData = initUserData(userId);
    
    // Filter by date range
    let filteredData = learningData.filter(d => {
      const date = new Date(d.date);
      return date >= start && date <= end;
    });
    
    // Group by interval
    let groupedData;
    if (interval === 'week') {
      groupedData = [];
      const weeks = {};
      filteredData.forEach(d => {
        const week = getWeekNumber(new Date(d.date));
        if (!weeks[week]) weeks[week] = [];
        weeks[week].push(d);
      });
      for (const [week, data] of Object.entries(weeks)) {
        groupedData.push({
          period: `Week ${week}`,
          value: data.reduce((sum, d) => sum + d[metric], 0) / data.length
        });
      }
    } else if (interval === 'month') {
      groupedData = [];
      const months = {};
      filteredData.forEach(d => {
        const month = new Date(d.date).toLocaleString('default', { month: 'short' });
        if (!months[month]) months[month] = [];
        months[month].push(d);
      });
      for (const [month, data] of Object.entries(months)) {
        groupedData.push({
          period: month,
          value: data.reduce((sum, d) => sum + d[metric], 0) / data.length
        });
      }
    } else {
      // Daily
      groupedData = filteredData.map(d => ({
        period: d.date,
        value: d[metric]
      }));
    }
    
    // Calculate moving average
    const values = groupedData.map(g => g.value);
    const movingAverage = calculateMovingAverage(values);
    
    res.json({
      success: true,
      data: {
        metric,
        interval,
        data: groupedData.map((g, i) => ({
          ...g,
          movingAverage: movingAverage[i]
        })),
        summary: {
          start: values[0] || 0,
          end: values[values.length - 1] || 0,
          change: values.length > 1 ? ((values[values.length - 1] - values[0]) / values[0]) * 100 : 0,
          best: Math.max(...values),
          worst: Math.min(...values),
          average: values.reduce((a, b) => a + b, 0) / values.length
        }
      }
    });
  } catch (error) {
    console.error('Progress analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve progress analytics'
    });
  }
});

/**
 * GET /api/analytics/skills
 * Get skill breakdown analysis
 */
router.get('/skills', authenticateToken, analyticsLimiter, async (req, res) => {
  try {
    const userId = req.user.id;
    const learningData = initUserData(userId);
    
    // Mock skill scores based on learning data
    const skills = {
      pronunciation: {
        score: Math.floor(Math.random() * 30) + 65,
        trend: '+5%',
        history: [68, 70, 72, 75, 73, 76, 78]
      },
      vocabulary: {
        score: Math.floor(Math.random() * 30) + 70,
        trend: '+8%',
        history: [70, 72, 75, 74, 77, 79, 82]
      },
      grammar: {
        score: Math.floor(Math.random() * 30) + 60,
        trend: '+3%',
        history: [62, 64, 63, 66, 65, 68, 70]
      },
      fluency: {
        score: Math.floor(Math.random() * 30) + 55,
        trend: '+12%',
        history: [55, 58, 60, 63, 65, 68, 72]
      },
      listening: {
        score: Math.floor(Math.random() * 30) + 75,
        trend: '+4%',
        history: [76, 78, 77, 79, 80, 81, 83]
      },
      reading: {
        score: Math.floor(Math.random() * 30) + 80,
        trend: '+2%',
        history: [80, 81, 80, 82, 83, 82, 84]
      }
    };
    
    // Calculate overall score
    const overallScore = Object.values(skills).reduce((sum, s) => sum + s.score, 0) / Object.keys(skills).length;
    
    // Identify strengths and weaknesses
    const sortedSkills = Object.entries(skills).sort((a, b) => b[1].score - a[1].score);
    const strengths = sortedSkills.slice(0, 3).map(([name, data]) => ({ name, score: data.score }));
    const weaknesses = sortedSkills.slice(-3).reverse().map(([name, data]) => ({ name, score: data.score }));
    
    res.json({
      success: true,
      data: {
        overall: Math.round(overallScore),
        skills,
        strengths,
        weaknesses,
        recommendations: weaknesses.map(w => ({
          skill: w.name,
          action: `Focus on improving your ${w.name} skills with daily practice`,
          suggestedMinutes: 15
        }))
      }
    });
  } catch (error) {
    console.error('Skills analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve skill analytics'
    });
  }
});

/**
 * GET /api/analytics/activity
 * Get user activity heatmap
 */
router.get('/activity', authenticateToken, analyticsLimiter, dateRangeValidation, async (req, res) => {
  try {
    const userId = req.user.id;
    const { startDate, endDate } = req.query;
    
    const { start, end } = getDateRange(startDate, endDate);
    const learningData = initUserData(userId);
    
    // Filter by date range
    const filteredData = learningData.filter(d => {
      const date = new Date(d.date);
      return date >= start && date <= end;
    });
    
    // Generate heatmap data
    const heatmapData = [];
    const dates = getDatesBetween(start, end);
    
    dates.forEach(date => {
      const dateStr = date.toISOString().split('T')[0];
      const dayData = filteredData.find(d => d.date === dateStr);
      
      heatmapData.push({
        date: dateStr,
        value: dayData ? dayData.minutes : 0,
        sessions: dayData ? dayData.sessions : 0,
        score: dayData ? dayData.score : 0
      });
    });
    
    // Calculate activity summary
    const activeDays = heatmapData.filter(d => d.value > 0).length;
    const totalDays = heatmapData.length;
    const consistency = (activeDays / totalDays) * 100;
    
    // Find most active time (mock data)
    const hourlyActivity = Array(24).fill(0);
    for (let i = 0; i < 24; i++) {
      hourlyActivity[i] = Math.floor(Math.random() * 60) + (i >= 8 && i <= 22 ? 20 : 5);
    }
    
    res.json({
      success: true,
      data: {
        heatmap: heatmapData,
        summary: {
          activeDays,
          totalDays,
          consistency: Math.round(consistency),
          averageDailyMinutes: activeDays > 0 ? heatmapData.reduce((sum, d) => sum + d.value, 0) / activeDays : 0,
          bestDay: heatmapData.reduce((best, d) => d.value > best.value ? d : best, { value: 0 })
        },
        hourlyActivity: hourlyActivity.map((minutes, hour) => ({
          hour,
          minutes,
          label: `${hour}:00`
        })),
        dayOfWeekActivity: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => ({
          day,
          minutes: heatmapData.filter(d => new Date(d.date).getDay() === index).reduce((sum, d) => sum + d.value, 0)
        }))
      }
    });
  } catch (error) {
    console.error('Activity analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve activity analytics'
    });
  }
});

/**
 * GET /api/analytics/achievements
 * Get user achievements and milestones
 */
router.get('/achievements', authenticateToken, analyticsLimiter, async (req, res) => {
  try {
    const userId = req.user.id;
    const learningData = initUserData(userId);
    
    const totalSessions = learningData.reduce((sum, d) => sum + d.sessions, 0);
    const totalMinutes = learningData.reduce((sum, d) => sum + d.minutes, 0);
    const totalXP = learningData.reduce((sum, d) => sum + d.xp, 0);
    const totalWords = learningData.reduce((sum, d) => sum + d.wordsLearned, 0);
    
    // Calculate streaks
    let currentStreak = 0;
    let bestStreak = 0;
    let tempStreak = 0;
    for (const day of learningData) {
      if (day.sessions > 0) {
        tempStreak++;
        bestStreak = Math.max(bestStreak, tempStreak);
        currentStreak = tempStreak;
      } else {
        tempStreak = 0;
      }
    }
    
    // Define achievements
    const achievements = [
      {
        id: 'first_lesson',
        name: 'First Step',
        description: 'Complete your first lesson',
        icon: '🎯',
        requirement: 1,
        current: Math.min(totalSessions, 1),
        earned: totalSessions >= 1,
        earnedAt: totalSessions >= 1 ? new Date().toISOString() : null
      },
      {
        id: 'ten_lessons',
        name: 'Dedicated Learner',
        description: 'Complete 10 lessons',
        icon: '📚',
        requirement: 10,
        current: Math.min(totalSessions, 10),
        earned: totalSessions >= 10,
        progress: (totalSessions / 10) * 100
      },
      {
        id: 'fifty_lessons',
        name: 'Language Enthusiast',
        description: 'Complete 50 lessons',
        icon: '⭐',
        requirement: 50,
        current: Math.min(totalSessions, 50),
        earned: totalSessions >= 50,
        progress: (totalSessions / 50) * 100
      },
      {
        id: 'hundred_lessons',
        name: 'Master',
        description: 'Complete 100 lessons',
        icon: '🏆',
        requirement: 100,
        current: Math.min(totalSessions, 100),
        earned: totalSessions >= 100,
        progress: (totalSessions / 100) * 100
      },
      {
        id: 'seven_day_streak',
        name: 'Week Warrior',
        description: 'Maintain a 7-day learning streak',
        icon: '🔥',
        requirement: 7,
        current: Math.min(bestStreak, 7),
        earned: bestStreak >= 7,
        progress: (bestStreak / 7) * 100
      },
      {
        id: 'thirty_day_streak',
        name: 'Monthly Master',
        description: 'Maintain a 30-day learning streak',
        icon: '📅',
        requirement: 30,
        current: Math.min(bestStreak, 30),
        earned: bestStreak >= 30,
        progress: (bestStreak / 30) * 100
      },
      {
        id: 'hundred_xp',
        name: 'XP Collector',
        description: 'Earn 100 XP',
        icon: '💎',
        requirement: 100,
        current: Math.min(totalXP, 100),
        earned: totalXP >= 100,
        progress: (totalXP / 100) * 100
      },
      {
        id: 'thousand_xp',
        name: 'XP Master',
        description: 'Earn 1,000 XP',
        icon: '👑',
        requirement: 1000,
        current: Math.min(totalXP, 1000),
        earned: totalXP >= 1000,
        progress: (totalXP / 1000) * 100
      },
      {
        id: 'fifty_words',
        name: 'Word Collector',
        description: 'Learn 50 new words',
        icon: '📖',
        requirement: 50,
        current: Math.min(totalWords, 50),
        earned: totalWords >= 50,
        progress: (totalWords / 50) * 100
      },
      {
        id: 'two_hundred_words',
        name: 'Vocabulary Builder',
        description: 'Learn 200 new words',
        icon: '📝',
        requirement: 200,
        current: Math.min(totalWords, 200),
        earned: totalWords >= 200,
        progress: (totalWords / 200) * 100
      },
      {
        id: 'perfect_score',
        name: 'Perfectionist',
        description: 'Get a perfect score (100%) in a lesson',
        icon: '🎯',
        requirement: 1,
        current: 0,
        earned: false,
        progress: 0
      },
      {
        id: 'early_bird',
        name: 'Early Bird',
        description: 'Complete a lesson before 8 AM',
        icon: '🌅',
        requirement: 5,
        current: Math.floor(Math.random() * 5),
        earned: false,
        progress: Math.floor(Math.random() * 100)
      }
    ];
    
    const earnedCount = achievements.filter(a => a.earned).length;
    const totalAchievements = achievements.length;
    const completionPercentage = (earnedCount / totalAchievements) * 100;
    
    // Calculate next milestones
    const nextMilestones = achievements
      .filter(a => !a.earned && a.progress)
      .sort((a, b) => b.progress - a.progress)
      .slice(0, 3);
    
    res.json({
      success: true,
      data: {
        summary: {
          earned: earnedCount,
          total: totalAchievements,
          completionPercentage: Math.round(completionPercentage),
          level: Math.floor(completionPercentage / 10) + 1,
          nextLevelAt: Math.ceil((Math.floor(completionPercentage / 10) + 1) * 10)
        },
        achievements,
        nextMilestones,
        recentEarned: achievements.filter(a => a.earned).slice(-5)
      }
    });
  } catch (error) {
    console.error('Achievements analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve achievements'
    });
  }
});

/**
 * GET /api/analytics/learning-path
 * Get personalized learning path recommendations
 */
router.get('/learning-path', authenticateToken, analyticsLimiter, async (req, res) => {
  try {
    const userId = req.user.id;
    const learningData = initUserData(userId);
    
    // Get skill levels
    const skills = {
      pronunciation: Math.floor(Math.random() * 30) + 65,
      vocabulary: Math.floor(Math.random() * 30) + 70,
      grammar: Math.floor(Math.random() * 30) + 60,
      fluency: Math.floor(Math.random() * 30) + 55
    };
    
    // Determine current level
    const avgSkill = Object.values(skills).reduce((sum, s) => sum + s, 0) / 4;
    let currentLevel = 'beginner';
    if (avgSkill >= 80) currentLevel = 'advanced';
    else if (avgSkill >= 65) currentLevel = 'intermediate';
    
    // Generate learning path
    const learningPath = {
      currentLevel,
      nextLevel: currentLevel === 'beginner' ? 'intermediate' : currentLevel === 'intermediate' ? 'advanced' : 'expert',
      progressToNextLevel: avgSkill % 25,
      recommendations: []
    };
    
    // Add skill-specific recommendations
    if (skills.pronunciation < 70) {
      learningPath.recommendations.push({
        skill: 'pronunciation',
        priority: 'high',
        action: 'Daily pronunciation practice with AI feedback',
        exercises: ['Minimal pairs', 'Tongue twisters', 'Shadowing technique'],
        estimatedWeeks: 2
      });
    }
    
    if (skills.vocabulary < 70) {
      learningPath.recommendations.push({
        skill: 'vocabulary',
        priority: 'medium',
        action: 'Learn 10 new words daily using spaced repetition',
        exercises: ['Flashcards', 'Word families', 'Context sentences'],
        estimatedWeeks: 3
      });
    }
    
    if (skills.grammar < 65) {
      learningPath.recommendations.push({
        skill: 'grammar',
        priority: 'high',
        action: 'Focus on common grammar patterns',
        exercises: ['Sentence correction', 'Fill in blanks', 'Grammar quizzes'],
        estimatedWeeks: 4
      });
    }
    
    if (skills.fluency < 60) {
      learningPath.recommendations.push({
        skill: 'fluency',
        priority: 'critical',
        action: 'Practice speaking without stopping',
        exercises: ['Timed responses', 'Story retelling', 'AI conversations'],
        estimatedWeeks: 3
      });
    }
    
    // Add weekly schedule
    const weeklySchedule = {
      monday: ['Pronunciation practice (15 min)', 'Vocabulary review (10 min)'],
      tuesday: ['Grammar lesson (20 min)', 'Speaking exercise (15 min)'],
      wednesday: ['Listening comprehension (15 min)', 'Vocabulary quiz (10 min)'],
      thursday: ['Pronunciation focus (15 min)', 'Grammar practice (15 min)'],
      friday: ['Review week\'s lessons (20 min)', 'Speaking test (15 min)'],
      saturday: ['Catch-up day (30 min)'],
      sunday: ['Rest or light review (15 min)']
    };
    
    res.json({
      success: true,
      data: {
        ...learningPath,
        weeklySchedule,
        estimatedTimeToNextLevel: `${Math.ceil(learningPath.progressToNextLevel / 5)} weeks`,
        tips: [
          'Practice at the same time every day to build a habit',
          'Focus on one skill at a time for better retention',
          'Use the AI conversation feature for real-time practice',
          'Join community speaking sessions for extra practice'
        ]
      }
    });
  } catch (error) {
    console.error('Learning path error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate learning path'
    });
  }
});

// ============================================
// Admin Routes
// ============================================

/**
 * GET /api/analytics/admin/overview
 * Get platform-wide analytics (admin only)
 */
router.get('/admin/overview', authenticateToken, isAdmin, analyticsLimiter, async (req, res) => {
  try {
    // Mock platform analytics
    const platformAnalytics = {
      users: {
        total: 15234,
        activeToday: 3421,
        activeThisWeek: 8923,
        activeThisMonth: 12456,
        newToday: 234,
        newThisWeek: 1567,
        newThisMonth: 3456,
        premium: 3456,
        premiumPercentage: 22.7
      },
      engagement: {
        totalSessions: 45678,
        totalMinutes: 892345,
        averageSessionMinutes: 19.5,
        averageDailyActiveUsers: 2890,
        retentionRate: {
          day1: 68,
          day7: 45,
          day30: 32
        }
      },
      learning: {
        averageScore: 76.5,
        totalWordsLearned: 892345,
        averageWordsPerUser: 58.6,
        mostPopularLesson: 'Basic Greetings',
        mostActiveHour: 19 // 7 PM
      },
      revenue: {
        mrr: 45678.50,
        annualRunRate: 548142,
        averageRevenuePerUser: 3.45,
        lifetimeValue: 124.50,
        churnRate: 4.2
      },
      trends: {
        sessionsLast30Days: generateTrendData(30, 1000, 5000),
        usersLast30Days: generateTrendData(30, 100, 500),
        revenueLast30Days: generateTrendData(30, 1000, 5000)
      }
    };
    
    res.json({
      success: true,
      data: platformAnalytics
    });
  } catch (error) {
    console.error('Admin analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve platform analytics'
    });
  }
});

/**
 * GET /api/analytics/admin/users/:userId
 * Get user analytics for admin
 */
router.get('/admin/users/:userId', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const learningData = initUserData(userId);
    
    res.json({
      success: true,
      data: {
        userId,
        learningData: learningData.slice(-90),
        summary: {
          totalSessions: learningData.reduce((sum, d) => sum + d.sessions, 0),
          totalMinutes: learningData.reduce((sum, d) => sum + d.minutes, 0),
          averageScore: learningData.reduce((sum, d) => sum + d.score, 0) / learningData.length,
          consistency: calculateConsistency(learningData)
        }
      }
    });
  } catch (error) {
    console.error('Admin user analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve user analytics'
    });
  }
});

// ============================================
// Helper Functions
// ============================================

const getWeekNumber = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
};

const generateTrendData = (days, min, max) => {
  const data = [];
  for (let i = 0; i < days; i++) {
    data.push({
      date: new Date(Date.now() - (days - 1 - i) * 86400000).toISOString().split('T')[0],
      value: Math.floor(Math.random() * (max - min) + min)
    });
  }
  return data;
};

const calculateConsistency = (learningData) => {
  let daysWithActivity = 0;
  for (let i = learningData.length - 30; i < learningData.length; i++) {
    if (learningData[i] && learningData[i].sessions > 0) {
      daysWithActivity++;
    }
  }
  return (daysWithActivity / 30) * 100;
};

module.exports = router;
