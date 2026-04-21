// ============================================
// Practice Sessions Routes
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

// ============================================
// Rate Limiting
// ============================================

const sessionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 sessions per minute
  message: {
    success: false,
    error: 'Too many session requests. Please slow down.'
  }
});

const submitLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: {
    success: false,
    error: 'Too many submissions. Please wait a moment.'
  }
});

// ============================================
// Validation Rules
// ============================================

const startSessionValidation = [
  body('lessonId')
    .optional()
    .isString()
    .withMessage('Lesson ID must be a string'),
  body('type')
    .isIn(['pronunciation', 'vocabulary', 'grammar', 'speaking', 'listening', 'comprehensive'])
    .withMessage('Invalid session type'),
  body('difficulty')
    .optional()
    .isIn(['beginner', 'intermediate', 'advanced', 'expert'])
    .withMessage('Invalid difficulty level'),
  body('duration')
    .optional()
    .isInt({ min: 1, max: 120 })
    .withMessage('Duration must be between 1 and 120 minutes'),
];

const submitSessionValidation = [
  body('sessionId')
    .notEmpty()
    .withMessage('Session ID is required'),
  body('answers')
    .optional()
    .isArray()
    .withMessage('Answers must be an array'),
  body('audioData')
    .optional(),
  body('duration')
    .isInt({ min: 1 })
    .withMessage('Valid duration is required'),
];

// ============================================
// Mock Data Storage
// ============================================

// Active sessions storage
const activeSessions = new Map();

// Completed sessions storage
const completedSessions = new Map();

// Session history by user
const userSessions = new Map();

// Lesson templates
const lessons = {
  'pronunciation_basic_01': {
    id: 'pronunciation_basic_01',
    title: 'Basic Greetings',
    type: 'pronunciation',
    difficulty: 'beginner',
    duration: 15,
    content: {
      words: ['hello', 'hi', 'good morning', 'good afternoon', 'good evening'],
      phrases: ['How are you?', 'Nice to meet you', 'See you later'],
      exercises: [
        {
          id: 1,
          text: 'Hello',
          expectedPronunciation: 'həˈloʊ',
          tips: 'Stress the second syllable: hel-LO'
        },
        {
          id: 2,
          text: 'How are you?',
          expectedPronunciation: 'haʊ ɑr ju',
          tips: 'Connect "are" and "you" -> "are you" sounds like "r you"'
        }
      ]
    }
  },
  'vocabulary_daily_01': {
    id: 'vocabulary_daily_01',
    title: 'Daily Routines',
    type: 'vocabulary',
    difficulty: 'beginner',
    duration: 20,
    content: {
      words: [
        { word: 'wake up', meaning: 'bangun', example: 'I wake up at 7 AM' },
        { word: 'breakfast', meaning: 'sarapan', example: 'I eat breakfast at 8 AM' },
        { word: 'work', meaning: 'bekerja', example: 'I go to work at 9 AM' }
      ],
      quiz: [
        { question: 'What does "wake up" mean?', options: ['tidur', 'bangun', 'makan', 'bekerja'], correct: 1 },
        { question: 'Complete: I eat ___ at 8 AM', options: ['lunch', 'dinner', 'breakfast', 'snack'], correct: 2 }
      ]
    }
  },
  'grammar_present_tense_01': {
    id: 'grammar_present_tense_01',
    title: 'Simple Present Tense',
    type: 'grammar',
    difficulty: 'beginner',
    duration: 25,
    content: {
      explanation: 'Simple present tense is used for habits, routines, and general truths.',
      rules: [
        'I/You/We/They + verb',
        'He/She/It + verb + s/es'
      ],
      examples: [
        'I eat breakfast every day.',
        'She works at a hospital.',
        'They play football on Sundays.'
      ],
      exercises: [
        { sentence: 'She ___ (go) to school every day.', correct: 'goes' },
        { sentence: 'They ___ (play) tennis on weekends.', correct: 'play' }
      ]
    }
  },
  'speaking_introduction_01': {
    id: 'speaking_introduction_01',
    title: 'Self Introduction',
    type: 'speaking',
    difficulty: 'beginner',
    duration: 30,
    content: {
      script: 'Hello, my name is [name]. I am from [country]. I am learning English with SpeakFlow.',
      practicePoints: [
        'Introduce yourself clearly',
        'Speak at a moderate pace',
        'Use correct intonation'
      ],
      questions: [
        'What is your name?',
        'Where are you from?',
        'Why are you learning English?'
      ]
    }
  }
};

// ============================================
// Helper Functions
// ============================================

// Generate unique session ID
const generateSessionId = () => {
  return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Calculate XP earned from session
const calculateXP = (sessionType, score, duration) => {
  let baseXP = 50;
  
  // Bonus based on session type
  const typeBonus = {
    'pronunciation': 10,
    'vocabulary': 10,
    'grammar': 10,
    'speaking': 20,
    'listening': 15,
    'comprehensive': 25
  };
  
  // Score multiplier (0.5 to 1.5)
  const scoreMultiplier = 0.5 + (score / 100);
  
  // Duration bonus (max 50 XP)
  const durationBonus = Math.min(Math.floor(duration / 5), 50);
  
  const totalXP = Math.floor((baseXP + (typeBonus[sessionType] || 0)) * scoreMultiplier + durationBonus);
  
  return Math.min(totalXP, 200); // Cap at 200 XP per session
};

// Calculate level from XP
const calculateLevel = (xp) => {
  return Math.floor(Math.sqrt(xp / 100)) + 1;
};

// Generate detailed feedback based on answers
const generateFeedback = (answers, sessionType) => {
  const feedback = {
    overall: '',
    strengths: [],
    improvements: [],
    tips: []
  };
  
  const score = answers.reduce((sum, a) => sum + (a.correct ? 1 : 0), 0) / answers.length * 100;
  
  if (score >= 90) {
    feedback.overall = 'Excellent work! You have mastered this material.';
    feedback.tips.push('Try more advanced lessons to continue improving.');
  } else if (score >= 70) {
    feedback.overall = 'Good job! You understand the basics well.';
    feedback.tips.push('Review the incorrect answers and try again.');
  } else if (score >= 50) {
    feedback.overall = 'Not bad! Keep practicing to improve.';
    feedback.tips.push('Focus on the areas where you made mistakes.');
  } else {
    feedback.overall = 'Keep practicing! Learning takes time and effort.';
    feedback.tips.push('Review the lesson materials before trying again.');
  }
  
  if (sessionType === 'pronunciation') {
    feedback.tips.push('Listen to native speakers and repeat after them.');
    feedback.tips.push('Record yourself and compare with the correct pronunciation.');
  } else if (sessionType === 'vocabulary') {
    feedback.tips.push('Use flashcards to memorize new words.');
    feedback.tips.push('Try to use new words in sentences.');
  } else if (sessionType === 'grammar') {
    feedback.tips.push('Study the grammar rules and practice with examples.');
    feedback.tips.push('Write your own sentences using the grammar pattern.');
  }
  
  return feedback;
};

// Save session to history
const saveSessionToHistory = (userId, session) => {
  if (!userSessions.has(userId)) {
    userSessions.set(userId, []);
  }
  userSessions.get(userId).push(session);
  
  if (!completedSessions.has(session.sessionId)) {
    completedSessions.set(session.sessionId, session);
  }
};

// Get user sessions from history
const getUserSessions = (userId, limit = 50, offset = 0) => {
  const sessions = userSessions.get(userId) || [];
  return sessions.slice(offset, offset + limit);
};

// Calculate aggregate statistics
const calculateAggregateStats = (sessions) => {
  if (sessions.length === 0) {
    return {
      totalSessions: 0,
      totalMinutes: 0,
      averageScore: 0,
      totalXP: 0,
      streak: 0,
      bestScore: 0,
      byType: {}
    };
  }
  
  const totalSessions = sessions.length;
  const totalMinutes = sessions.reduce((sum, s) => sum + s.duration, 0);
  const averageScore = sessions.reduce((sum, s) => sum + s.score, 0) / totalSessions;
  const totalXP = sessions.reduce((sum, s) => sum + s.xpEarned, 0);
  const bestScore = Math.max(...sessions.map(s => s.score));
  
  // Group by session type
  const byType = {};
  sessions.forEach(s => {
    if (!byType[s.type]) {
      byType[s.type] = { count: 0, avgScore: 0, totalScore: 0 };
    }
    byType[s.type].count++;
    byType[s.type].totalScore += s.score;
    byType[s.type].avgScore = byType[s.type].totalScore / byType[s.type].count;
  });
  
  return {
    totalSessions,
    totalMinutes,
    averageScore: Math.round(averageScore),
    totalXP,
    bestScore,
    byType
  };
};

// ============================================
// Routes
// ============================================

/**
 * POST /api/sessions/start
 * Start a new practice session
 */
router.post('/start', authenticateToken, sessionLimiter, startSessionValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }
    
    const { lessonId, type, difficulty = 'beginner', duration = 15 } = req.body;
    const userId = req.user.id;
    
    // Get lesson data
    let lesson;
    if (lessonId && lessons[lessonId]) {
      lesson = lessons[lessonId];
    } else {
      // Find appropriate lesson based on type and difficulty
      const availableLesson = Object.values(lessons).find(
        l => l.type === type && l.difficulty === difficulty
      );
      lesson = availableLesson || lessons['pronunciation_basic_01'];
    }
    
    // Create new session
    const sessionId = generateSessionId();
    const session = {
      sessionId,
      userId,
      lessonId: lesson.id,
      type: lesson.type,
      difficulty: lesson.difficulty,
      title: lesson.title,
      duration: duration,
      startedAt: new Date().toISOString(),
      status: 'active',
      content: lesson.content,
      progress: 0
    };
    
    // Store active session
    activeSessions.set(sessionId, session);
    
    res.json({
      success: true,
      data: {
        sessionId: session.sessionId,
        lesson: {
          id: lesson.id,
          title: lesson.title,
          type: lesson.type,
          difficulty: lesson.difficulty,
          duration: lesson.duration
        },
        content: lesson.content,
        startedAt: session.startedAt
      }
    });
  } catch (error) {
    console.error('Start session error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start session',
      code: 'START_SESSION_FAILED'
    });
  }
});

/**
 * POST /api/sessions/submit
 * Submit session answers for evaluation
 */
router.post('/submit', authenticateToken, submitLimiter, submitSessionValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }
    
    const { sessionId, answers, audioData, duration } = req.body;
    const userId = req.user.id;
    
    // Get active session
    const session = activeSessions.get(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found or already completed',
        code: 'SESSION_NOT_FOUND'
      });
    }
    
    // Verify session belongs to user
    if (session.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Session does not belong to user',
        code: 'SESSION_ACCESS_DENIED'
      });
    }
    
    // Calculate score based on answers
    let score = 0;
    let evaluatedAnswers = [];
    
    if (answers && answers.length > 0) {
      // Evaluate each answer
      evaluatedAnswers = answers.map(answer => {
        const isCorrect = evaluateAnswer(answer, session.type);
        return {
          questionId: answer.questionId,
          userAnswer: answer.userAnswer,
          correct: isCorrect,
          correctAnswer: getCorrectAnswer(answer.questionId, session),
          feedback: generateAnswerFeedback(answer, isCorrect, session.type)
        };
      });
      
      const correctCount = evaluatedAnswers.filter(a => a.correct).length;
      score = (correctCount / answers.length) * 100;
    } else if (audioData) {
      // For pronunciation/speaking sessions, evaluate audio
      const audioEvaluation = await evaluateAudio(audioData, session);
      score = audioEvaluation.score;
      evaluatedAnswers = audioEvaluation.details;
    } else {
      // No data submitted
      score = 0;
    }
    
    // Calculate XP earned
    const xpEarned = calculateXP(session.type, score, duration);
    
    // Generate feedback
    const feedback = generateFeedback(evaluatedAnswers, session.type);
    
    // Complete session
    const completedAt = new Date().toISOString();
    const completedSession = {
      ...session,
      status: 'completed',
      completedAt,
      duration: duration || session.duration,
      score: Math.round(score),
      xpEarned,
      answers: evaluatedAnswers,
      feedback,
      audioData: audioData ? '[AUDIO_DATA]' : null
    };
    
    // Remove from active and save to history
    activeSessions.delete(sessionId);
    saveSessionToHistory(userId, completedSession);
    
    // Update user stats (in production, update database)
    await updateUserStats(userId, completedSession);
    
    res.json({
      success: true,
      data: {
        sessionId: completedSession.sessionId,
        score: completedSession.score,
        xpEarned: completedSession.xpEarned,
        totalXP: await getUserTotalXP(userId),
        level: await getUserLevel(userId),
        feedback: completedSession.feedback,
        answers: completedSession.answers,
        completedAt: completedSession.completedAt
      }
    });
  } catch (error) {
    console.error('Submit session error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit session',
      code: 'SUBMIT_SESSION_FAILED'
    });
  }
});

/**
 * GET /api/sessions/history
 * Get user's session history
 */
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const { limit = 20, offset = 0, type, startDate, endDate } = req.query;
    const userId = req.user.id;
    
    let sessions = getUserSessions(userId, parseInt(limit), parseInt(offset));
    
    // Filter by type
    if (type) {
      sessions = sessions.filter(s => s.type === type);
    }
    
    // Filter by date range
    if (startDate) {
      sessions = sessions.filter(s => s.completedAt >= startDate);
    }
    if (endDate) {
      sessions = sessions.filter(s => s.completedAt <= endDate);
    }
    
    // Format sessions for response
    const formattedSessions = sessions.map(s => ({
      sessionId: s.sessionId,
      title: s.title,
      type: s.type,
      difficulty: s.difficulty,
      duration: s.duration,
      score: s.score,
      xpEarned: s.xpEarned,
      completedAt: s.completedAt
    }));
    
    res.json({
      success: true,
      data: {
        sessions: formattedSessions,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: (userSessions.get(userId) || []).length
        }
      }
    });
  } catch (error) {
    console.error('Get session history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve session history',
      code: 'HISTORY_RETRIEVAL_FAILED'
    });
  }
});

/**
 * GET /api/sessions/:sessionId
 * Get specific session details
 */
router.get('/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;
    
    // Check active sessions first
    let session = activeSessions.get(sessionId);
    
    // If not active, check completed sessions
    if (!session) {
      session = completedSessions.get(sessionId);
    }
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
        code: 'SESSION_NOT_FOUND'
      });
    }
    
    // Verify session belongs to user
    if (session.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        code: 'ACCESS_DENIED'
      });
    }
    
    // Remove sensitive data
    const { audioData, ...safeSession } = session;
    
    res.json({
      success: true,
      data: safeSession
    });
  } catch (error) {
    console.error('Get session details error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve session',
      code: 'SESSION_RETRIEVAL_FAILED'
    });
  }
});

/**
 * GET /api/sessions/stats/summary
 * Get session statistics summary
 */
router.get('/stats/summary', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const sessions = userSessions.get(userId) || [];
    
    const stats = calculateAggregateStats(sessions);
    
    // Calculate streak (consecutive days with sessions)
    const streak = calculateStreak(sessions);
    
    // Get recent performance trend
    const recentSessions = sessions.slice(-10);
    const trend = {
      last7Days: sessions.filter(s => {
        const daysDiff = (new Date() - new Date(s.completedAt)) / (1000 * 60 * 60 * 24);
        return daysDiff <= 7;
      }).length,
      averageScoreLast30: sessions.filter(s => {
        const daysDiff = (new Date() - new Date(s.completedAt)) / (1000 * 60 * 60 * 24);
        return daysDiff <= 30;
      }).reduce((sum, s) => sum + s.score, 0) / Math.min(sessions.filter(s => {
        const daysDiff = (new Date() - new Date(s.completedAt)) / (1000 * 60 * 60 * 24);
        return daysDiff <= 30;
      }).length, 1),
      improvement: calculateImprovement(sessions)
    };
    
    res.json({
      success: true,
      data: {
        overview: stats,
        streak,
        trend,
        weeklyActivity: generateWeeklyActivity(sessions),
        strongestArea: getStrongestArea(stats.byType),
        weakestArea: getWeakestArea(stats.byType)
      }
    });
  } catch (error) {
    console.error('Get stats summary error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve statistics',
      code: 'STATS_RETRIEVAL_FAILED'
    });
  }
});

/**
 * GET /api/sessions/recommendations
 * Get personalized session recommendations
 */
router.get('/recommendations', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const sessions = userSessions.get(userId) || [];
    
    // Analyze weak areas
    const weakAreas = analyzeWeakAreas(sessions);
    
    // Generate recommendations
    const recommendations = [];
    
    if (weakAreas.pronunciation < 70) {
      recommendations.push({
        type: 'pronunciation',
        title: 'Improve Your Pronunciation',
        description: 'Practice common sounds that are difficult for you',
        lessonId: 'pronunciation_advanced_01',
        difficulty: 'intermediate',
        estimatedDuration: 15
      });
    }
    
    if (weakAreas.vocabulary < 70) {
      recommendations.push({
        type: 'vocabulary',
        title: 'Expand Your Vocabulary',
        description: 'Learn new words related to your interests',
        lessonId: 'vocabulary_theme_01',
        difficulty: 'beginner',
        estimatedDuration: 20
      });
    }
    
    if (weakAreas.grammar < 70) {
      recommendations.push({
        type: 'grammar',
        title: 'Master English Grammar',
        description: 'Focus on grammar rules you struggle with',
        lessonId: 'grammar_present_perfect',
        difficulty: 'intermediate',
        estimatedDuration: 25
      });
    }
    
    // Add daily recommendation
    recommendations.unshift({
      type: 'daily_practice',
      title: 'Daily Practice Session',
      description: '15 minutes of focused practice to maintain your streak',
      lessonId: 'daily_practice',
      difficulty: getRecommendedDifficulty(sessions),
      estimatedDuration: 15,
      recommended: true
    });
    
    res.json({
      success: true,
      data: {
        recommendations: recommendations.slice(0, 5),
        basedOn: `${sessions.length} completed sessions`,
        nextMilestone: calculateNextMilestone(sessions)
      }
    });
  } catch (error) {
    console.error('Get recommendations error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate recommendations',
      code: 'RECOMMENDATION_FAILED'
    });
  }
});

// ============================================
// Helper Functions Implementation
// ============================================

const evaluateAnswer = (answer, sessionType) => {
  // Mock evaluation logic
  // In production, implement proper answer checking
  return Math.random() > 0.3; // 70% chance of being correct
};

const getCorrectAnswer = (questionId, session) => {
  // Mock: return correct answer
  return 'Sample correct answer';
};

const generateAnswerFeedback = (answer, isCorrect, sessionType) => {
  if (isCorrect) {
    return 'Correct! Great job!';
  }
  return 'Not quite right. Keep practicing!';
};

const evaluateAudio = async (audioData, session) => {
  // Mock audio evaluation
  // In production, integrate with speech recognition API (e.g., Google Speech, OpenAI Whisper)
  return {
    score: Math.floor(Math.random() * 40) + 60, // 60-100
    details: [
      { aspect: 'pronunciation', score: 85, feedback: 'Good clarity' },
      { aspect: 'fluency', score: 78, feedback: 'Speak a bit slower' },
      { aspect: 'intonation', score: 82, feedback: 'Good rhythm' }
    ]
  };
};

const updateUserStats = async (userId, session) => {
  // In production, update database
  console.log(`Updating stats for user ${userId} with session ${session.sessionId}`);
};

const getUserTotalXP = async (userId) => {
  const sessions = userSessions.get(userId) || [];
  return sessions.reduce((sum, s) => sum + (s.xpEarned || 0), 0);
};

const getUserLevel = async (userId) => {
  const totalXP = await getUserTotalXP(userId);
  return calculateLevel(totalXP);
};

const calculateStreak = (sessions) => {
  if (sessions.length === 0) return 0;
  
  const dates = sessions.map(s => new Date(s.completedAt).toDateString());
  const uniqueDates = [...new Set(dates)].sort();
  
  let streak = 1;
  let currentStreak = 1;
  
  for (let i = 1; i < uniqueDates.length; i++) {
    const prevDate = new Date(uniqueDates[i - 1]);
    const currDate = new Date(uniqueDates[i]);
    const diffDays = (currDate - prevDate) / (1000 * 60 * 60 * 24);
    
    if (diffDays === 1) {
      currentStreak++;
      streak = Math.max(streak, currentStreak);
    } else if (diffDays > 1) {
      currentStreak = 1;
    }
  }
  
  return streak;
};

const calculateImprovement = (sessions) => {
  if (sessions.length < 5) return 0;
  
  const firstHalf = sessions.slice(0, Math.floor(sessions.length / 2));
  const secondHalf = sessions.slice(Math.floor(sessions.length / 2));
  
  const firstAvg = firstHalf.reduce((sum, s) => sum + s.score, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, s) => sum + s.score, 0) / secondHalf.length;
  
  return Math.round((secondAvg - firstAvg) / firstAvg * 100);
};

const generateWeeklyActivity = (sessions) => {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const activity = days.map(day => ({
    day,
    sessions: 0,
    minutes: 0
  }));
  
  sessions.forEach(session => {
    const date = new Date(session.completedAt);
    const dayIndex = date.getDay();
    activity[dayIndex].sessions++;
    activity[dayIndex].minutes += session.duration;
  });
  
  return activity;
};

const getStrongestArea = (byType) => {
  let strongest = { type: 'none', avgScore: 0 };
  for (const [type, data] of Object.entries(byType)) {
    if (data.avgScore > strongest.avgScore) {
      strongest = { type, avgScore: data.avgScore };
    }
  }
  return strongest;
};

const getWeakestArea = (byType) => {
  let weakest = { type: 'none', avgScore: 100 };
  for (const [type, data] of Object.entries(byType)) {
    if (data.avgScore < weakest.avgScore && data.count >= 3) {
      weakest = { type, avgScore: data.avgScore };
    }
  }
  return weakest;
};

const analyzeWeakAreas = (sessions) => {
  const scores = {
    pronunciation: [],
    vocabulary: [],
    grammar: [],
    speaking: [],
    listening: []
  };
  
  sessions.forEach(session => {
    if (scores[session.type]) {
      scores[session.type].push(session.score);
    }
  });
  
  const averages = {};
  for (const [type, typeScores] of Object.entries(scores)) {
    if (typeScores.length > 0) {
      averages[type] = typeScores.reduce((sum, s) => sum + s, 0) / typeScores.length;
    } else {
      averages[type] = 75; // Default
    }
  }
  
  return averages;
};

const getRecommendedDifficulty = (sessions) => {
  if (sessions.length < 10) return 'beginner';
  
  const avgScore = sessions.slice(-10).reduce((sum, s) => sum + s.score, 0) / 10;
  
  if (avgScore >= 85) return 'advanced';
  if (avgScore >= 70) return 'intermediate';
  return 'beginner';
};

const calculateNextMilestone = (sessions) => {
  const totalXP = sessions.reduce((sum, s) => sum + (s.xpEarned || 0), 0);
  const currentLevel = calculateLevel(totalXP);
  const nextLevelXP = currentLevel * 1000;
  const xpNeeded = nextLevelXP - totalXP;
  
  return {
    level: currentLevel + 1,
    xpNeeded,
    estimatedSessions: Math.ceil(xpNeeded / 50)
  };
};

// ============================================
// Export Router
// ============================================

module.exports = router;
