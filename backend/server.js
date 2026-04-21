// ============================================
// SpeakFlow Backend Server
// AI-Powered Language Learning Platform
// ============================================

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

// ============================================
// Initialize Express App
// ============================================
const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';
const isVercel = !!process.env.VERCEL;

// ============================================
// Security & Middleware Configuration
// ============================================

// Helmet for security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.openai.com", "https://api.stripe.com"],
    },
  },
}));

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN?.split(',') || [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://speakflow.vercel.app',
    'https://speakflow.com'
  ],
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

app.use(cors(corsOptions));

// Compression for response bodies
app.use(compression());

// Logging
if (!isProduction) {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================
// Static File Serving
// ============================================

// Serve static files from various directories
app.use('/css', express.static(path.join(__dirname, '../css')));
app.use('/js', express.static(path.join(__dirname, '../js')));
app.use('/public', express.static(path.join(__dirname, '../public')));
app.use('/images', express.static(path.join(__dirname, '../public/images')));
app.use('/audio', express.static(path.join(__dirname, '../public/audio')));
app.use('/fonts', express.static(path.join(__dirname, '../public/fonts')));

// PWA files
app.use('/manifest.json', express.static(path.join(__dirname, '../manifest.json')));
app.use('/sw.js', express.static(path.join(__dirname, '../sw.js')));
app.use('/offline.html', express.static(path.join(__dirname, '../offline.html')));

// ============================================
// Request Logging Middleware
// ============================================
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
  });
  next();
});

// ============================================
// API Routes
// ============================================

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    vercel: isVercel
  });
});

// ============================================
// Authentication Routes
// ============================================

/**
 * POST /api/auth/register
 * Register new user
 */
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    // Validation
    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: email, password, name'
      });
    }
    
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters'
      });
    }
    
    // TODO: Implement actual user registration with database
    // For now, return mock response
    
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: {
        id: 'mock-user-id',
        email,
        name,
        createdAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/auth/login
 * Login user
 */
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password required'
      });
    }
    
    // TODO: Implement actual user authentication with JWT
    // For now, return mock response
    
    res.json({
      success: true,
      message: 'Login successful',
      token: 'mock-jwt-token',
      user: {
        id: 'mock-user-id',
        email,
        name: 'Test User'
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/auth/verify
 * Verify JWT token
 */
app.get('/api/auth/verify', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'No token provided'
    });
  }
  
  // TODO: Implement actual token verification
  res.json({
    success: true,
    valid: true,
    user: {
      id: 'mock-user-id'
    }
  });
});

// ============================================
// Practice Session Routes
// ============================================

/**
 * POST /api/sessions/start
 * Start a new practice session
 */
app.post('/api/sessions/start', async (req, res) => {
  try {
    const { lessonId, type } = req.body;
    
    const session = {
      id: `session_${Date.now()}`,
      lessonId: lessonId || 'basic_01',
      type: type || 'pronunciation',
      startedAt: new Date().toISOString(),
      status: 'active'
    };
    
    res.json({
      success: true,
      session
    });
  } catch (error) {
    console.error('Start session error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start session'
    });
  }
});

/**
 * POST /api/sessions/submit
 * Submit voice recording for analysis
 */
app.post('/api/sessions/submit', async (req, res) => {
  try {
    const { sessionId, audioData, text } = req.body;
    
    if (!sessionId || !audioData) {
      return res.status(400).json({
        success: false,
        error: 'Session ID and audio data required'
      });
    }
    
    // TODO: Integrate with AI voice recognition (OpenAI Whisper)
    // Mock pronunciation analysis
    const accuracy = Math.floor(Math.random() * 30) + 70; // 70-99%
    const feedback = accuracy > 85 
      ? 'Excellent pronunciation!' 
      : accuracy > 70 
      ? 'Good job! Keep practicing.' 
      : 'Try again. Focus on the word stress.';
    
    res.json({
      success: true,
      analysis: {
        accuracy: accuracy,
        feedback: feedback,
        details: {
          pronunciation: accuracy,
          fluency: Math.floor(Math.random() * 30) + 70,
          grammar: Math.floor(Math.random() * 30) + 70,
          vocabulary: Math.floor(Math.random() * 30) + 70
        },
        suggestions: [
          'Practice the word stress patterns',
          'Slow down your speaking pace',
          'Listen to native speakers'
        ]
      }
    });
  } catch (error) {
    console.error('Submit session error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze speech'
    });
  }
});

/**
 * GET /api/sessions/history
 * Get user's practice history
 */
app.get('/api/sessions/history', (req, res) => {
  // Mock session history
  const sessions = [
    {
      id: 'session_1',
      date: new Date().toISOString(),
      lesson: 'Basic Greetings',
      accuracy: 92,
      duration: 300
    },
    {
      id: 'session_2',
      date: new Date(Date.now() - 86400000).toISOString(),
      lesson: 'Numbers 1-20',
      accuracy: 88,
      duration: 240
    }
  ];
  
  res.json({
    success: true,
    sessions,
    total: sessions.length
  });
});

/**
 * GET /api/sessions/stats
 * Get learning statistics
 */
app.get('/api/sessions/stats', (req, res) => {
  res.json({
    success: true,
    stats: {
      totalSessions: 42,
      totalMinutes: 1260,
      averageAccuracy: 85,
      currentStreak: 7,
      longestStreak: 21,
      level: 5,
      xp: 1250,
      nextLevelXp: 2000
    }
  });
});

// ============================================
// Payment Routes
// ============================================

/**
 * POST /api/payments/create-subscription
 * Create Stripe subscription
 */
app.post('/api/payments/create-subscription', async (req, res) => {
  try {
    const { planId, paymentMethodId } = req.body;
    
    // TODO: Integrate with Stripe
    res.json({
      success: true,
      subscription: {
        id: 'sub_mock_123',
        plan: planId || 'pro_monthly',
        status: 'active',
        currentPeriodEnd: new Date(Date.now() + 30 * 86400000).toISOString()
      }
    });
  } catch (error) {
    console.error('Payment error:', error);
    res.status(500).json({
      success: false,
      error: 'Payment processing failed'
    });
  }
});

/**
 * POST /api/payments/cancel
 * Cancel subscription
 */
app.post('/api/payments/cancel', async (req, res) => {
  try {
    const { subscriptionId } = req.body;
    
    res.json({
      success: true,
      message: 'Subscription cancelled successfully',
      effectiveDate: new Date(Date.now() + 30 * 86400000).toISOString()
    });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel subscription'
    });
  }
});

// ============================================
// Gamification Routes
// ============================================

/**
 * GET /api/gamification/profile
 * Get user's gamification profile
 */
app.get('/api/gamification/profile', (req, res) => {
  res.json({
    success: true,
    profile: {
      level: 5,
      xp: 1250,
      xpToNextLevel: 750,
      streak: 7,
      badges: [
        { id: 'first_lesson', name: 'First Step', earned: true, earnedAt: '2024-01-01' },
        { id: 'seven_day_streak', name: 'Week Warrior', earned: true, earnedAt: '2024-01-07' },
        { id: 'perfectionist', name: 'Perfectionist', earned: false, progress: 80 }
      ],
      achievements: {
        totalLessons: 42,
        perfectScores: 8,
        hoursLearned: 21
      }
    }
  });
});

/**
 * POST /api/gamification/claim-reward
 * Claim daily reward
 */
app.post('/api/gamification/claim-reward', (req, res) => {
  res.json({
    success: true,
    reward: {
      type: 'xp',
      amount: 50,
      message: 'Daily login bonus claimed!'
    }
  });
});

// ============================================
// AI Voice Analysis Routes
// ============================================

/**
 * POST /api/voice/analyze
 * Analyze voice recording with AI
 */
app.post('/api/voice/analyze', async (req, res) => {
  try {
    const { audioBase64, text, language = 'en' } = req.body;
    
    if (!audioBase64) {
      return res.status(400).json({
        success: false,
        error: 'Audio data required'
      });
    }
    
    // TODO: Integrate with OpenAI Whisper API
    // For now, return mock analysis
    
    const mockAnalysis = {
      success: true,
      transcription: text || "Hello, how are you today?",
      confidence: 0.92,
      pronunciation_score: 87,
      fluency_score: 85,
      grammar_score: 90,
      overall_score: 87,
      feedback: "Good pronunciation! Try to speak a bit more slowly.",
      phoneme_analysis: [
        { phoneme: "h", correct: true, score: 95 },
        { phoneme: "ɛ", correct: true, score: 88 },
        { phoneme: "l", correct: true, score: 92 },
        { phoneme: "oʊ", correct: false, score: 65, suggestion: "Round your lips more" }
      ],
      suggested_exercises: [
        "Practice the 'th' sound",
        "Work on word stress patterns"
      ]
    };
    
    res.json(mockAnalysis);
  } catch (error) {
    console.error('Voice analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Voice analysis failed'
    });
  }
});

// ============================================
// Vocabulary Routes (SRS - Spaced Repetition)
// ============================================

/**
 * GET /api/vocabulary/words
 * Get vocabulary words for practice
 */
app.get('/api/vocabulary/words', (req, res) => {
  const { limit = 20, level = 'beginner' } = req.query;
  
  const words = [
    { id: 1, word: 'hello', meaning: 'Halo', level: 'beginner', nextReview: new Date() },
    { id: 2, word: 'goodbye', meaning: 'Selamat tinggal', level: 'beginner', nextReview: new Date() },
    { id: 3, word: 'please', meaning: 'Tolong', level: 'beginner', nextReview: new Date(Date.now() + 86400000) },
    { id: 4, word: 'thank you', meaning: 'Terima kasih', level: 'beginner', nextReview: new Date() }
  ];
  
  res.json({
    success: true,
    words: words.slice(0, limit),
    total: words.length
  });
});

/**
 * POST /api/vocabulary/review
 * Submit vocabulary review result
 */
app.post('/api/vocabulary/review', (req, res) => {
  const { wordId, score } = req.body;
  
  // Calculate next review date based on score (Spaced Repetition)
  let nextReview;
  if (score >= 4) {
    nextReview = new Date(Date.now() + 4 * 86400000); // 4 days
  } else if (score >= 3) {
    nextReview = new Date(Date.now() + 2 * 86400000); // 2 days
  } else {
    nextReview = new Date(Date.now() + 86400000); // 1 day
  }
  
  res.json({
    success: true,
    nextReview: nextReview.toISOString(),
    message: score >= 3 ? 'Great! Word saved to memory.' : 'Keep practicing this word.'
  });
});

// ============================================
// Dashboard Routes
// ============================================

/**
 * GET /api/dashboard/stats
 * Get user dashboard statistics
 */
app.get('/api/dashboard/stats', (req, res) => {
  res.json({
    success: true,
    dashboard: {
      weeklyProgress: [65, 72, 80, 78, 85, 88, 92],
      skillLevels: {
        pronunciation: 78,
        vocabulary: 82,
        grammar: 75,
        fluency: 70
      },
      recentActivity: [
        { type: 'lesson', name: 'Basic Greetings', date: '2024-01-15', score: 92 },
        { type: 'quiz', name: 'Vocabulary Quiz', date: '2024-01-14', score: 85 },
        { type: 'speaking', name: 'AI Conversation', date: '2024-01-13', score: 88 }
      ],
      recommendations: [
        { type: 'lesson', name: 'Past Tense Verbs', reason: 'Based on your recent practice' },
        { type: 'exercise', name: 'Minimal Pairs', reason: 'Pronunciation needs improvement' }
      ]
    }
  });
});

// ============================================
// 404 Handler for API Routes
// ============================================
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: `Cannot ${req.method} ${req.originalUrl} - Endpoint not found`
  });
});

// ============================================
// Serve Frontend (SPA Fallback)
// ============================================

// Serve index.html for all other routes (client-side routing)
app.get('*', (req, res) => {
  // Don't serve index.html for API routes (already handled above)
  if (req.path.startsWith('/api/')) {
    return;
  }
  
  // Check if the requested file exists
  const filePath = path.join(__dirname, '..', req.path);
  const fs = require('fs');
  
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return res.sendFile(filePath);
  }
  
  // Otherwise, serve index.html for client-side routing
  res.sendFile(path.join(__dirname, '../index.html'));
});

// ============================================
// Error Handling Middleware
// ============================================

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error:', err.stack);
  
  const status = err.status || 500;
  const message = isProduction && status === 500 
    ? 'Internal server error' 
    : err.message || 'Something went wrong';
  
  res.status(status).json({
    success: false,
    error: message,
    ...(!isProduction && { stack: err.stack })
  });
});

// 404 handler for non-existent routes
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({
      success: false,
      error: `Cannot ${req.method} ${req.path}`
    });
  } else {
    // For frontend routes, serve index.html
    res.status(200).sendFile(path.join(__dirname, '../index.html'));
  }
});

// ============================================
// Start Server (Local Development)
// ============================================

// Export for Vercel (Serverless Function)
module.exports = app;

// Start server only if not in Vercel environment
if (!isVercel) {
  app.listen(PORT, () => {
    console.log(`\n🚀 SpeakFlow Server Started!`);
    console.log(`📍 Running on http://localhost:${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📡 API Health: http://localhost:${PORT}/api/health`);
    console.log(`\n✨ Ready to help you learn languages!\n`);
  });
}

// ============================================
// Graceful Shutdown
// ============================================
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  process.exit(0);
});

// ============================================
// Unhandled Promise Rejections
// ============================================
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Application continues running
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Application continues running
  if (!isProduction) {
    process.exit(1);
  }
});

module.exports = app;
