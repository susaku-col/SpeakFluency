// ============================================
// Analytics Controller
// SpeakFlow - AI Language Learning Platform
// ============================================

const { validationResult } = require('express-validator');

// ============================================
// Constants & Configuration
// ============================================

const METRICS = {
  SCORE: 'score',
  SESSIONS: 'sessions',
  MINUTES: 'minutes',
  XP: 'xp',
  WORDS: 'words',
  STREAK: 'streak'
};

const PERIODS = {
  DAY: 'day',
  WEEK: 'week',
  MONTH: 'month',
  YEAR: 'year',
  ALL: 'all'
};

// ============================================
// Mock Database
// ============================================

// User learning data storage
const userLearningData = new Map();

// Daily activity logs
const dailyActivityLogs = new Map();

// Session analytics
const sessionAnalytics = new Map();

// User progress snapshots
const progressSnapshots = new Map();

// Achievement tracking
const achievementTracking = new Map();

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
 * Get date range for queries
 */
const getDateRange = (period, startDate = null, endDate = null) => {
  const end = endDate ? new Date(endDate) : new Date();
  end.setHours(23, 59, 59, 999);
  
  let start = startDate ? new Date(startDate) : new Date();
  
  if (!startDate) {
    switch (period) {
      case PERIODS.DAY:
        start.setHours(0, 0, 0, 0);
        break;
      case PERIODS.WEEK:
        start.setDate(start.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        break;
      case PERIODS.MONTH:
        start.setMonth(start.getMonth() - 1);
        start.setHours(0, 0, 0, 0);
        break;
      case PERIODS.YEAR:
        start.setFullYear(start.getFullYear() - 1);
        start.setHours(0, 0, 0, 0);
        break;
      default:
        start = new Date(0); // Beginning of time
    }
  } else {
    start.setHours(0, 0, 0, 0);
  }
  
  return { start, end };
};

/**
 * Generate dates between range
 */
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
const calculatePercentile = (scores, percentile) => {
  if (!scores.length) return 0;
  const sorted = [...scores].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
};

/**
 * Calculate standard deviation
 */
const calculateStdDev = (values) => {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squareDiffs = values.map(value => Math.pow(value - mean, 2));
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(avgSquareDiff);
};

/**
 * Calculate trend (increasing/decreasing/stable)
 */
const calculateTrend = (data) => {
  if (data.length < 2) return 'stable';
  
  const firstHalf = data.slice(0, Math.floor(data.length / 2));
  const secondHalf = data.slice(Math.floor(data.length / 2));
  
  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  
  const percentChange = ((secondAvg - firstAvg) / firstAvg) * 100;
  
  if (percentChange > 5) return 'increasing';
  if (percentChange < -5) return 'decreasing';
  return 'stable';
};

/**
 * Generate mock learning data for a user
 */
const generateMockLearningData = (userId, days = 90) => {
  const data = [];
  const today = new Date();
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    // Generate realistic patterns (weekday vs weekend)
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const activityFactor = isWeekend ? 0.7 : 1;
    
    const hasSession = Math.random() < (0.8 * activityFactor); // 80% chance of session on weekdays
    
    if (hasSession) {
      const sessions = Math.floor(Math.random() * 3) + 1;
      const minutes = Math.floor(Math.random() * 45) + 10;
      const score = Math.floor(Math.random() * 25) + 65; // 65-90%
      const xp = Math.floor(Math.random() * 80) + 20;
      const wordsLearned = Math.floor(Math.random() * 12) + 1;
      
      data.push({
        date: date.toISOString().split('T')[0],
        sessions,
        minutes,
        score,
        xp,
        wordsLearned,
        timestamp: date.toISOString()
      });
    } else {
      data.push({
        date: date.toISOString().split('T')[0],
        sessions: 0,
        minutes: 0,
        score: 0,
        xp: 0,
        wordsLearned: 0,
        timestamp: date.toISOString()
      });
    }
  }
  
  return data;
};

/**
 * Generate skill scores
 */
const generateSkillScores = (learningData) => {
  const recentSessions = learningData.filter(d => d.sessions > 0).slice(-30);
  const avgScore = recentSessions.length > 0 
    ? recentSessions.reduce((sum, d) => sum + d.score, 0) / recentSessions.length 
    : 65;
  
  // Base scores with variations
  return {
    pronunciation: Math.min(100, Math.max(0, avgScore + (Math.random() * 10 - 5))),
    vocabulary: Math.min(100, Math.max(0, avgScore + (Math.random() * 10 - 3))),
    grammar: Math.min(100, Math.max(0, avgScore + (Math.random() * 10 - 7))),
    fluency: Math.min(100, Math.max(0, avgScore + (Math.random() * 10 - 8))),
    listening: Math.min(100, Math.max(0, avgScore + (Math.random() * 10 - 2))),
    reading: Math.min(100, Math.max(0, avgScore + (Math.random() * 10 - 1)))
  };
};

/**
 * Calculate learning streak
 */
const calculateStreak = (learningData) => {
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
  
  return { current: currentStreak, best: bestStreak };
};

/**
 * Calculate total statistics
 */
const calculateTotalStats = (learningData) => {
  const totalSessions = learningData.reduce((sum, d) => sum + d.sessions, 0);
  const totalMinutes = learningData.reduce((sum, d) => sum + d.minutes, 0);
  const totalXP = learningData.reduce((sum, d) => sum + d.xp, 0);
  const totalWords = learningData.reduce((sum, d) => sum + d.wordsLearned, 0);
  
  const sessionsWithScore = learningData.filter(d => d.score > 0);
  const averageScore = sessionsWithScore.length > 0
    ? sessionsWithScore.reduce((sum, d) => sum + d.score, 0) / sessionsWithScore.length
    : 0;
  
  return {
    totalSessions,
    totalMinutes,
    totalXP,
    totalWords,
    averageScore: Math.round(averageScore),
    activeDays: learningData.filter(d => d.sessions > 0).length
  };
};

/**
 * Calculate period-over-period change
 */
const calculatePeriodChange = (currentData, previousData, metric) => {
  const currentAvg = currentData.length > 0 
    ? currentData.reduce((sum, d) => sum + d[metric], 0) / currentData.length 
    : 0;
  const previousAvg = previousData.length > 0 
    ? previousData.reduce((sum, d) => sum + d[metric], 0) / previousData.length 
    : 0;
  
  const change = previousAvg === 0 ? 0 : ((currentAvg - previousAvg) / previousAvg) * 100;
  
  return {
    current: Math.round(currentAvg * 100) / 100,
    previous: Math.round(previousAvg * 100) / 100,
    change: Math.round(change * 100) / 100,
    trend: change > 0 ? 'up' : change < 0 ? 'down' : 'stable'
  };
};

/**
 * Generate weekly activity data
 */
const generateWeeklyActivity = (learningData, periodDays = 30) => {
  const recentData = learningData.slice(-periodDays);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const activity = days.map(day => ({
    day,
    sessions: 0,
    minutes: 0,
    score: 0,
    count: 0
  }));
  
  for (const data of recentData) {
    const date = new Date(data.date);
    const dayIndex = date.getDay();
    activity[dayIndex].sessions += data.sessions;
    activity[dayIndex].minutes += data.minutes;
    if (data.score > 0) {
      activity[dayIndex].score += data.score;
      activity[dayIndex].count++;
    }
  }
  
  // Calculate averages
  return activity.map(a => ({
    day: a.day,
    sessions: a.sessions,
    minutes: a.minutes,
    averageScore: a.count > 0 ? Math.round(a.score / a.count) : 0
  }));
};

/**
 * Generate hourly activity heatmap
 */
const generateHourlyActivity = (learningData) => {
  const hourlyActivity = Array(24).fill(0);
  
  for (const data of learningData) {
    if (data.timestamp) {
      const hour = new Date(data.timestamp).getHours();
      hourlyActivity[hour] += data.minutes;
    }
  }
  
  return hourlyActivity.map((minutes, hour) => ({
    hour,
    minutes,
    label: `${hour}:00`,
    activity: minutes > 30 ? 'high' : minutes > 10 ? 'medium' : 'low'
  }));
};

/**
 * Generate monthly heatmap data
 */
const generateMonthlyHeatmap = (learningData, year, month) => {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const heatmap = [];
  
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayData = learningData.find(d => d.date === dateStr);
    
    heatmap.push({
      date: dateStr,
      day,
      value: dayData ? dayData.minutes : 0,
      sessions: dayData ? dayData.sessions : 0,
      score: dayData ? dayData.score : 0,
      hasActivity: !!dayData && dayData.sessions > 0
    });
  }
  
  return heatmap;
};

/**
 * Initialize user data
 */
const initUserData = (userId) => {
  if (!userLearningData.has(userId)) {
    const data = generateMockLearningData(userId);
    userLearningData.set(userId, data);
    
    // Take initial snapshot
    takeProgressSnapshot(userId);
  }
  return userLearningData.get(userId);
};

/**
 * Take progress snapshot
 */
const takeProgressSnapshot = (userId) => {
  const learningData = userLearningData.get(userId) || [];
  const stats = calculateTotalStats(learningData);
  const streak = calculateStreak(learningData);
  const skills = generateSkillScores(learningData);
  
  const snapshot = {
    id: generateId('snap'),
    userId,
    timestamp: new Date().toISOString(),
    stats,
    streak,
    skills
  };
  
  if (!progressSnapshots.has(userId)) {
    progressSnapshots.set(userId, []);
  }
  
  const snapshots = progressSnapshots.get(userId);
  snapshots.push(snapshot);
  
  // Keep only last 100 snapshots
  if (snapshots.length > 100) {
    progressSnapshots.set(userId, snapshots.slice(-100));
  }
  
  return snapshot;
};

/**
 * Get progress history
 */
const getProgressHistory = (userId, limit = 30) => {
  const snapshots = progressSnapshots.get(userId) || [];
  return snapshots.slice(-limit);
};

/**
 * Generate personalized recommendations
 */
const generateRecommendations = (learningData, skills) => {
  const recommendations = [];
  const recentSessions = learningData.filter(d => d.sessions > 0).slice(-14);
  const avgRecentScore = recentSessions.length > 0
    ? recentSessions.reduce((sum, d) => sum + d.score, 0) / recentSessions.length
    : 0;
  
  // Find weakest skill
  const weakestSkill = Object.entries(skills).reduce((a, b) => a[1] < b[1] ? a : b);
  
  if (weakestSkill[1] < 65) {
    recommendations.push({
      type: 'skill_improvement',
      skill: weakestSkill[0],
      priority: 'high',
      message: `Your ${weakestSkill[0]} skill needs improvement. Try our specialized ${weakestSkill[0]} exercises.`,
      suggestedLesson: getLessonForSkill(weakestSkill[0]),
      estimatedTime: 15
    });
  }
  
  // Check consistency
  const inactiveDays = recentSessions.filter(d => d.sessions === 0).length;
  if (inactiveDays > 3) {
    recommendations.push({
      type: 'consistency',
      priority: 'medium',
      message: "You've been inactive for several days. A 15-minute daily practice can make a big difference!",
      suggestedAction: "Set a daily reminder",
      estimatedTime: 15
    });
  }
  
  // Check score improvement
  if (avgRecentScore < 70) {
    recommendations.push({
      type: 'practice',
      priority: 'high',
      message: "Review the basics with our beginner-friendly lessons to build a strong foundation.",
      suggestedLesson: "pronunciation_basic_01",
      estimatedTime: 20
    });
  } else if (avgRecentScore > 85) {
    recommendations.push({
      type: 'challenge',
      priority: 'medium',
      message: "You're ready for more advanced content! Challenge yourself with intermediate lessons.",
      suggestedLesson: "pronunciation_intermediate_01",
      estimatedTime: 25
    });
  }
  
  // Streak recommendation
  const streak = calculateStreak(learningData);
  if (streak.current > 0 && streak.current < 7) {
    recommendations.push({
      type: 'streak',
      priority: 'low',
      message: `You're on a ${streak.current}-day streak! Keep it up to earn the Week Warrior badge.`,
      suggestedAction: "Practice today to maintain your streak",
      estimatedTime: 10
    });
  }
  
  return recommendations;
};

/**
 * Get lesson for skill
 */
const getLessonForSkill = (skill) => {
  const lessons = {
    pronunciation: 'pronunciation_intermediate_01',
    vocabulary: 'vocabulary_daily_01',
    grammar: 'grammar_present_tense_01',
    fluency: 'speaking_introduction_01',
    listening: 'listening_basic_01',
    reading: 'vocabulary_daily_01'
  };
  return lessons[skill] || 'pronunciation_basic_01';
};

// ============================================
// Controller Methods
// ============================================

/**
 * Get dashboard analytics
 * GET /api/analytics/dashboard
 */
exports.getDashboard = async (req, res) => {
  try {
    const userId = req.user.id;
    const learningData = initUserData(userId);
    const { period = PERIODS.MONTH } = req.query;
    
    const { start, end } = getDateRange(period);
    
    // Filter data by date range
    const filteredData = learningData.filter(d => {
      const date = new Date(d.date);
      return date >= start && date <= end;
    });
    
    const stats = calculateTotalStats(filteredData);
    const streak = calculateStreak(filteredData);
    const skills = generateSkillScores(filteredData);
    
    // Calculate improvement
    const previousData = learningData.filter(d => {
      const date = new Date(d.date);
      const prevStart = new Date(start);
      prevStart.setDate(prevStart.getDate() - (end - start) / (1000 * 60 * 60 * 24));
      return date >= prevStart && date < start;
    });
    
    const scoreChange = calculatePeriodChange(filteredData, previousData, 'score');
    const sessionChange = calculatePeriodChange(filteredData, previousData, 'sessions');
    
    // Weekly activity
    const weeklyActivity = generateWeeklyActivity(filteredData, 30);
    
    // Recent sessions (last 10)
    const recentSessions = filteredData
      .filter(d => d.sessions > 0)
      .slice(-10)
      .reverse()
      .map(d => ({
        date: d.date,
        score: d.score,
        minutes: d.minutes,
        sessions: d.sessions,
        xp: d.xp
      }));
    
    res.json({
      success: true,
      data: {
        overview: {
          ...stats,
          currentStreak: streak.current,
          bestStreak: streak.best
        },
        skills,
        trends: {
          score: scoreChange,
          sessions: sessionChange
        },
        weeklyActivity,
        recentSessions,
        recommendations: generateRecommendations(filteredData, skills)
      }
    });
    
  } catch (error) {
    console.error('Dashboard analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve dashboard analytics',
      code: 'DASHBOARD_FAILED'
    });
  }
};

/**
 * Get progress over time
 * GET /api/analytics/progress
 */
exports.getProgress = async (req, res) => {
  try {
    const userId = req.user.id;
    const learningData = initUserData(userId);
    const { 
      startDate, 
      endDate, 
      metric = METRICS.SCORE, 
      interval = PERIODS.DAY 
    } = req.query;
    
    const { start, end } = getDateRange(PERIODS.ALL, startDate, endDate);
    
    // Filter data by date range
    let filteredData = learningData.filter(d => {
      const date = new Date(d.date);
      return date >= start && date <= end;
    });
    
    // Group by interval
    let groupedData = [];
    let labels = [];
    
    if (interval === PERIODS.WEEK) {
      const weeks = new Map();
      for (const data of filteredData) {
        const date = new Date(data.date);
        const weekNum = getWeekNumber(date);
        const year = date.getFullYear();
        const weekKey = `${year}-W${weekNum}`;
        
        if (!weeks.has(weekKey)) {
          weeks.set(weekKey, []);
        }
        weeks.get(weekKey).push(data);
      }
      
      for (const [weekKey, weekData] of weeks) {
        const values = weekData.map(d => d[metric]).filter(v => v > 0);
        const avgValue = values.length > 0 
          ? values.reduce((a, b) => a + b, 0) / values.length 
          : 0;
        groupedData.push(avgValue);
        labels.push(weekKey);
      }
    } else if (interval === PERIODS.MONTH) {
      const months = new Map();
      for (const data of filteredData) {
        const date = new Date(data.date);
        const monthKey = date.toLocaleString('default', { month: 'short', year: 'numeric' });
        
        if (!months.has(monthKey)) {
          months.set(monthKey, []);
        }
        months.get(monthKey).push(data);
      }
      
      for (const [monthKey, monthData] of months) {
        const values = monthData.map(d => d[metric]).filter(v => v > 0);
        const avgValue = values.length > 0 
          ? values.reduce((a, b) => a + b, 0) / values.length 
          : 0;
        groupedData.push(avgValue);
        labels.push(monthKey);
      }
    } else {
      // Daily
      groupedData = filteredData.map(d => d[metric]);
      labels = filteredData.map(d => d.date);
    }
    
    // Calculate moving average
    const movingAverage = calculateMovingAverage(groupedData);
    const trend = calculateTrend(groupedData);
    const stdDev = calculateStdDev(groupedData);
    
    // Calculate percentiles
    const nonZeroValues = groupedData.filter(v => v > 0);
    const percentiles = {
      p10: calculatePercentile(nonZeroValues, 10),
      p25: calculatePercentile(nonZeroValues, 25),
      p50: calculatePercentile(nonZeroValues, 50),
      p75: calculatePercentile(nonZeroValues, 75),
      p90: calculatePercentile(nonZeroValues, 90)
    };
    
    res.json({
      success: true,
      data: {
        metric,
        interval,
        labels,
        values: groupedData,
        movingAverage,
        summary: {
          start: groupedData[0] || 0,
          end: groupedData[groupedData.length - 1] || 0,
          min: Math.min(...groupedData),
          max: Math.max(...groupedData),
          average: groupedData.reduce((a, b) => a + b, 0) / groupedData.length,
          total: groupedData.reduce((a, b) => a + b, 0),
          trend,
          standardDeviation: Math.round(stdDev * 100) / 100,
          percentiles
        }
      }
    });
    
  } catch (error) {
    console.error('Progress analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve progress analytics',
      code: 'PROGRESS_FAILED'
    });
  }
};

/**
 * Get skill breakdown
 * GET /api/analytics/skills
 */
exports.getSkills = async (req, res) => {
  try {
    const userId = req.user.id;
    const learningData = initUserData(userId);
    const { period = PERIODS.MONTH } = req.query;
    
    const { start, end } = getDateRange(period);
    
    const filteredData = learningData.filter(d => {
      const date = new Date(d.date);
      return date >= start && date <= end;
    });
    
    const currentSkills = generateSkillScores(filteredData);
    
    // Get previous period for trend
    const prevStart = new Date(start);
    prevStart.setDate(prevStart.getDate() - (end - start) / (1000 * 60 * 60 * 24));
    const prevData = learningData.filter(d => {
      const date = new Date(d.date);
      return date >= prevStart && date < start;
    });
    const previousSkills = generateSkillScores(prevData);
    
    // Calculate trends for each skill
    const skillsWithTrend = {};
    for (const [skill, score] of Object.entries(currentSkills)) {
      const prevScore = previousSkills[skill] || score;
      const change = ((score - prevScore) / prevScore) * 100;
      skillsWithTrend[skill] = {
        score: Math.round(score),
        previousScore: Math.round(prevScore),
        change: Math.round(change * 100) / 100,
        trend: change > 5 ? 'improving' : change < -5 ? 'declining' : 'stable'
      };
    }
    
    // Calculate overall score
    const overallScore = Object.values(currentSkills).reduce((a, b) => a + b, 0) / Object.keys(currentSkills).length;
    
    // Identify strengths and weaknesses
    const sortedSkills = Object.entries(currentSkills).sort((a, b) => b[1] - a[1]);
    const strengths = sortedSkills.slice(0, 3).map(([name, score]) => ({ name, score: Math.round(score) }));
    const weaknesses = sortedSkills.slice(-3).reverse().map(([name, score]) => ({ name, score: Math.round(score) }));
    
    // Get history for each skill
    const skillHistory = {};
    for (const skill of Object.keys(currentSkills)) {
      skillHistory[skill] = [];
    }
    
    // Take last 30 days of snapshots
    const snapshots = getProgressHistory(userId, 30);
    for (const snapshot of snapshots) {
      for (const [skill, score] of Object.entries(snapshot.skills)) {
        if (skillHistory[skill]) {
          skillHistory[skill].push({
            date: snapshot.timestamp.split('T')[0],
            score: Math.round(score)
          });
        }
      }
    }
    
    res.json({
      success: true,
      data: {
        overall: Math.round(overallScore),
        skills: skillsWithTrend,
        strengths,
        weaknesses,
        history: skillHistory,
        recommendations: weaknesses.map(w => ({
          skill: w.name,
          action: `Focus on improving your ${w.name} skills with daily practice`,
          suggestedMinutes: 15,
          priority: w.score < 65 ? 'high' : w.score < 75 ? 'medium' : 'low'
        }))
      }
    });
    
  } catch (error) {
    console.error('Skills analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve skill analytics',
      code: 'SKILLS_FAILED'
    });
  }
};

/**
 * Get activity heatmap
 * GET /api/analytics/activity
 */
exports.getActivity = async (req, res) => {
  try {
    const userId = req.user.id;
    const learningData = initUserData(userId);
    const { year, month, period = PERIODS.MONTH } = req.query;
    
    const { start, end } = getDateRange(period);
    
    let filteredData = learningData.filter(d => {
      const date = new Date(d.date);
      return date >= start && date <= end;
    });
    
    let heatmapData;
    let summary;
    
    if (year && month) {
      // Monthly heatmap
      const targetYear = parseInt(year);
      const targetMonth = parseInt(month) - 1;
      heatmapData = generateMonthlyHeatmap(learningData, targetYear, targetMonth);
      
      const monthData = learningData.filter(d => {
        const date = new Date(d.date);
        return date.getFullYear() === targetYear && date.getMonth() === targetMonth;
      });
      
      const monthStats = calculateTotalStats(monthData);
      summary = {
        totalMinutes: monthStats.totalMinutes,
        totalSessions: monthStats.totalSessions,
        activeDays: monthData.filter(d => d.sessions > 0).length,
        averageScore: monthStats.averageScore,
        bestDay: heatmapData.reduce((best, d) => d.value > best.value ? d : best, { value: 0 })
      };
    } else {
      // Period heatmap
      const dates = getDatesBetween(start, end);
      heatmapData = dates.map(date => {
        const dateStr = date.toISOString().split('T')[0];
        const dayData = filteredData.find(d => d.date === dateStr);
        return {
          date: dateStr,
          value: dayData ? dayData.minutes : 0,
          sessions: dayData ? dayData.sessions : 0,
          score: dayData ? dayData.score : 0
        };
      });
      
      const activeDays = heatmapData.filter(d => d.value > 0).length;
      summary = {
        activeDays,
        totalDays: heatmapData.length,
        consistency: (activeDays / heatmapData.length) * 100,
        totalMinutes: heatmapData.reduce((sum, d) => sum + d.value, 0),
        averageDailyMinutes: activeDays > 0 ? heatmapData.reduce((sum, d) => sum + d.value, 0) / activeDays : 0
      };
    }
    
    const hourlyActivity = generateHourlyActivity(filteredData);
    const weeklyActivity = generateWeeklyActivity(filteredData);
    
    res.json({
      success: true,
      data: {
        heatmap: heatmapData,
        summary,
        hourlyActivity,
        weeklyActivity,
        bestTimeToLearn: hourlyActivity.reduce((best, curr) => curr.minutes > best.minutes ? curr : best, { hour: 0, minutes: 0 })
      }
    });
    
  } catch (error) {
    console.error('Activity analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve activity analytics',
      code: 'ACTIVITY_FAILED'
    });
  }
};

/**
 * Get achievements
 * GET /api/analytics/achievements
 */
exports.getAchievements = async (req, res) => {
  try {
    const userId = req.user.id;
    const learningData = initUserData(userId);
    
    const stats = calculateTotalStats(learningData);
    const streak = calculateStreak(learningData);
    const skills = generateSkillScores(learningData);
    
    // Define all possible achievements
    const allAchievements = [
      { id: 'first_lesson', name: 'First Step', description: 'Complete your first lesson', icon: '🎯', requirement: 1, points: 50 },
      { id: 'ten_lessons', name: 'Dedicated Learner', description: 'Complete 10 lessons', icon: '📚', requirement: 10, points: 100 },
      { id: 'fifty_lessons', name: 'Language Enthusiast', description: 'Complete 50 lessons', icon: '⭐', requirement: 50, points: 250 },
      { id: 'hundred_lessons', name: 'Master', description: 'Complete 100 lessons', icon: '🏆', requirement: 100, points: 500 },
      { id: 'seven_day_streak', name: 'Week Warrior', description: '7-day learning streak', icon: '🔥', requirement: 7, points: 100 },
      { id: 'thirty_day_streak', name: 'Monthly Master', description: '30-day learning streak', icon: '📅', requirement: 30, points: 500 },
      { id: 'ninety_day_streak', name: 'Quarter Champion', description: '90-day learning streak', icon: '👑', requirement: 90, points: 1000 },
      { id: 'perfect_score', name: 'Perfectionist', description: 'Get a perfect score (100%)', icon: '💯', requirement: 1, points: 150 },
      { id: 'early_bird', name: 'Early Bird', description: 'Complete 5 lessons before 8 AM', icon: '🌅', requirement: 5, points: 50 },
      { id: 'night_owl', name: 'Night Owl', description: 'Complete 5 lessons after 10 PM', icon: '🦉', requirement: 5, points: 50 },
      { id: 'vocabulary_master', name: 'Vocabulary Master', description: 'Learn 500 words', icon: '📖', requirement: 500, points: 200 },
      { id: 'vocabulary_guru', name: 'Vocabulary Guru', description: 'Learn 2000 words', icon: '📚', requirement: 2000, points: 500 },
      { id: 'grammar_guru', name: 'Grammar Guru', description: 'Complete all grammar lessons', icon: '✍️', requirement: 20, points: 200 },
      { id: 'pronunciation_pro', name: 'Pronunciation Pro', description: 'Get 90%+ on pronunciation', icon: '🎤', requirement: 10, points: 200 },
      { id: 'fluency_master', name: 'Fluency Master', description: 'Achieve 85%+ fluency score', icon: '🗣️', requirement: 1, points: 300 },
      { id: 'marathon_learner', name: 'Marathon Learner', description: 'Practice 100 hours total', icon: '🏃', requirement: 6000, points: 500 },
      { id: 'social_butterfly', name: 'Social Butterfly', description: 'Join 10 community sessions', icon: '🦋', requirement: 10, points: 100 },
      { id: 'mentor', name: 'Mentor', description: 'Help 5 new learners', icon: '👨‍🏫', requirement: 5, points: 200 }
    ];
    
    // Calculate earned achievements
    const earnedAchievements = [];
    
    for (const achievement of allAchievements) {
      let isEarned = false;
      let progress = 0;
      let currentValue = 0;
      
      switch (achievement.id) {
        case 'first_lesson':
        case 'ten_lessons':
        case 'fifty_lessons':
        case 'hundred_lessons':
          currentValue = stats.totalSessions;
          progress = Math.min(100, (currentValue / achievement.requirement) * 100);
          isEarned = currentValue >= achievement.requirement;
          break;
          
        case 'seven_day_streak':
        case 'thirty_day_streak':
        case 'ninety_day_streak':
          currentValue = streak.best;
          progress = Math.min(100, (currentValue / achievement.requirement) * 100);
          isEarned = currentValue >= achievement.requirement;
          break;
          
        case 'vocabulary_master':
        case 'vocabulary_guru':
          currentValue = stats.totalWords;
          progress = Math.min(100, (currentValue / achievement.requirement) * 100);
          isEarned = currentValue >= achievement.requirement;
          break;
          
        case 'pronunciation_pro':
          currentValue = skills.pronunciation >= 90 ? 1 : 0;
          progress = skills.pronunciation;
          isEarned = skills.pronunciation >= 90;
          break;
          
        case 'fluency_master':
          currentValue = skills.fluency >= 85 ? 1 : 0;
          progress = skills.fluency;
          isEarned = skills.fluency >= 85;
          break;
          
        case 'marathon_learner':
          currentValue = stats.totalMinutes;
          progress = Math.min(100, (currentValue / achievement.requirement) * 100);
          isEarned = currentValue >= achievement.requirement;
          break;
          
        default:
          // Mock for other achievements
          progress = Math.random() * 100;
          isEarned = progress >= 100;
          currentValue = Math.floor((progress / 100) * achievement.requirement);
      }
      
      earnedAchievements.push({
        ...achievement,
        earned: isEarned,
        progress: Math.min(100, Math.round(progress)),
        currentValue,
        requirement: achievement.requirement,
        earnedAt: isEarned ? new Date().toISOString() : null
      });
    }
    
    const earnedCount = earnedAchievements.filter(a => a.earned).length;
    const totalPoints = earnedAchievements.filter(a => a.earned).reduce((sum, a) => sum + a.points, 0);
    const nextMilestones = earnedAchievements
      .filter(a => !a.earned && a.progress > 0)
      .sort((a, b) => b.progress - a.progress)
      .slice(0, 5);
    
    res.json({
      success: true,
      data: {
        summary: {
          earned: earnedCount,
          total: allAchievements.length,
          completionPercentage: (earnedCount / allAchievements.length) * 100,
          totalPoints,
          level: Math.floor(earnedCount / 5) + 1,
          nextLevelAt: Math.ceil((Math.floor(earnedCount / 5) + 1) * 5)
        },
        achievements: earnedAchievements,
        nextMilestones,
        recentEarned: earnedAchievements.filter(a => a.earned).slice(-5)
      }
    });
    
  } catch (error) {
    console.error('Achievements analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve achievements',
      code: 'ACHIEVEMENTS_FAILED'
    });
  }
};

/**
 * Get learning path recommendations
 * GET /api/analytics/learning-path
 */
exports.getLearningPath = async (req, res) => {
  try {
    const userId = req.user.id;
    const learningData = initUserData(userId);
    
    const stats = calculateTotalStats(learningData);
    const skills = generateSkillScores(learningData);
    const streak = calculateStreak(learningData);
    
    // Determine current level
    const avgSkill = Object.values(skills).reduce((a, b) => a + b, 0) / Object.keys(skills).length;
    let currentLevel = 'beginner';
    let nextLevel = 'intermediate';
    let levelThreshold = 65;
    
    if (avgSkill >= 80) {
      currentLevel = 'advanced';
      nextLevel = 'expert';
      levelThreshold = 85;
    } else if (avgSkill >= 65) {
      currentLevel = 'intermediate';
      nextLevel = 'advanced';
      levelThreshold = 80;
    }
    
    const progressToNextLevel = Math.min(100, ((avgSkill - (levelThreshold - 15)) / 15) * 100);
    
    // Generate weekly schedule
    const weeklySchedule = {
      monday: ['Review previous week (15 min)', 'New vocabulary (10 min)'],
      tuesday: ['Pronunciation practice (15 min)', 'Speaking exercise (15 min)'],
      wednesday: ['Grammar lesson (20 min)', 'Writing practice (10 min)'],
      thursday: ['Listening comprehension (15 min)', 'Vocabulary quiz (10 min)'],
      friday: ['Speaking practice (20 min)', 'Review difficult concepts (10 min)'],
      saturday: ['Comprehensive review (25 min)', 'AI conversation (15 min)'],
      sunday: ['Rest or light review (15 min)', 'Plan next week (5 min)']
    };
    
    // Skill-specific recommendations
    const skillRecommendations = [];
    const sortedSkills = Object.entries(skills).sort((a, b) => a[1] - b[1]);
    
    for (const [skill, score] of sortedSkills.slice(0, 3)) {
      let priority = 'medium';
      if (score < 60) priority = 'critical';
      else if (score < 70) priority = 'high';
      else if (score < 80) priority = 'medium';
      else priority = 'low';
      
      skillRecommendations.push({
        skill,
        currentScore: Math.round(score),
        priority,
        recommendedMinutes: priority === 'critical' ? 20 : priority === 'high' ? 15 : 10,
        exercises: getExercisesForSkill(skill),
        estimatedWeeks: priority === 'critical' ? 4 : priority === 'high' ? 3 : 2
      });
    }
    
    // Estimated time to next level
    const sessionsNeeded = Math.ceil((levelThreshold - avgSkill) / 2); // Rough estimate
    const estimatedWeeks = Math.ceil(sessionsNeeded / 5); // 5 sessions per week
    
    res.json({
      success: true,
      data: {
        currentLevel,
        nextLevel,
        progressToNextLevel: Math.round(progressToNextLevel),
        estimatedTimeToNextLevel: `${estimatedWeeks} weeks`,
        sessionsNeeded,
        weeklySchedule,
        skillRecommendations,
        tips: [
          'Practice at the same time every day to build a habit',
          'Focus on one skill at a time for better retention',
          'Use the AI conversation feature for real-time practice',
          'Join community speaking sessions for extra practice',
          'Review your mistakes to learn faster',
          'Set realistic daily goals (15-30 minutes)'
        ],
        resources: [
          { name: 'Pronunciation Guide', type: 'article', url: '/resources/pronunciation-guide' },
          { name: 'Grammar Handbook', type: 'pdf', url: '/resources/grammar-handbook' },
          { name: 'Vocabulary Builder', type: 'tool', url: '/vocabulary-builder' }
        ]
      }
    });
    
  } catch (error) {
    console.error('Learning path error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate learning path',
      code: 'LEARNING_PATH_FAILED'
    });
  }
};

/**
 * Get exercises for skill
 */
const getExercisesForSkill = (skill) => {
  const exercises = {
    pronunciation: ['Minimal pairs', 'Tongue twisters', 'Shadowing technique', 'Phoneme practice'],
    vocabulary: ['Flashcards', 'Word families', 'Context sentences', 'Synonym matching'],
    grammar: ['Sentence correction', 'Fill in blanks', 'Grammar quizzes', 'Error identification'],
    fluency: ['Timed responses', 'Story retelling', 'AI conversations', 'Free speaking'],
    listening: ['Dictation', 'Comprehension questions', 'Transcript matching', 'Audio shadowing'],
    reading: ['Speed reading', 'Comprehension tests', 'Vocabulary in context', 'Summary writing']
  };
  return exercises[skill] || exercises.vocabulary;
};

/**
 * Get week number helper
 */
const getWeekNumber = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
};

// ============================================
// Export all methods
// ============================================

module.exports = exports;
