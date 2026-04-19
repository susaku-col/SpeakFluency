/* ============================================
   SPEAKFLOW - BACKEND SERVER
   Version: 1.0.0
   Express.js server with all API endpoints
   ============================================ */

// ============================================
// DEPENDENCIES
// ============================================

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// ============================================
// CONFIGURATION
// ============================================

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'speakflow_secret_key_2024';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'speakflow_refresh_secret_2024';

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['audio/webm', 'audio/mpeg', 'audio/wav', 'audio/mp3'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only audio files are allowed.'));
        }
    }
});

// ============================================
// MIDDLEWARE
// ============================================

// Security middleware
app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:8080',
    credentials: true
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('combined'));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, '../public')));

// ============================================
// DATABASE SIMULATION (In-memory)
// ============================================

// In production, replace with actual database (PostgreSQL, MongoDB, etc.)
const db = {
    users: [],
    sessions: [],
    payments: [],
    abTests: [],
    supportTickets: [],
    vocabulary: [],
    userVocabulary: [],
    analytics: []
};

// Initialize with demo data
function initDatabase() {
    // Create demo user
    const hashedPassword = bcrypt.hashSync('demo123', 10);
    db.users.push({
        id: 1,
        name: 'Demo User',
        email: 'demo@speakflow.com',
        password: hashedPassword,
        isPremium: false,
        xp: 1250,
        level: 5,
        streak: 3,
        createdAt: new Date().toISOString()
    });
    
    // Add demo vocabulary
    db.vocabulary = [
        { id: 1, word: 'confident', meaning: 'feeling sure about yourself', difficulty: 'medium', category: 'basic' },
        { id: 2, word: 'essential', meaning: 'absolutely necessary', difficulty: 'medium', category: 'basic' },
        { id: 3, word: 'improve', meaning: 'to make something better', difficulty: 'easy', category: 'basic' },
        { id: 4, word: 'opportunity', meaning: 'a chance to do something', difficulty: 'medium', category: 'basic' },
        { id: 5, word: 'challenge', meaning: 'something difficult that tests your abilities', difficulty: 'medium', category: 'basic' }
    ];
}

initDatabase();

// ============================================
// AUTH MIDDLEWARE
// ============================================

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

const generateTokens = (user) => {
    const accessToken = jwt.sign(
        { id: user.id, email: user.email, name: user.name },
        JWT_SECRET,
        { expiresIn: '1h' }
    );
    
    const refreshToken = jwt.sign(
        { id: user.id },
        JWT_REFRESH_SECRET,
        { expiresIn: '7d' }
    );
    
    return { accessToken, refreshToken };
};

// ============================================
// API ROUTES
// ============================================

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================
// AUTH ROUTES
// ============================================

// Register
app.post('/api/auth/register', [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('name').notEmpty().trim()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    
    const { email, password, name } = req.body;
    
    // Check if user exists
    const existingUser = db.users.find(u => u.email === email);
    if (existingUser) {
        return res.status(400).json({ error: 'User already exists' });
    }
    
    // Create new user
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
        id: db.users.length + 1,
        name,
        email,
        password: hashedPassword,
        isPremium: false,
        xp: 0,
        level: 1,
        streak: 0,
        createdAt: new Date().toISOString()
    };
    
    db.users.push(newUser);
    
    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(newUser);
    
    res.status(201).json({
        success: true,
        user: { id: newUser.id, name: newUser.name, email: newUser.email, isPremium: newUser.isPremium },
        accessToken,
        refreshToken
    });
});

// Login
app.post('/api/auth/login', [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    
    const { email, password } = req.body;
    
    const user = db.users.find(u => u.email === email);
    if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const { accessToken, refreshToken } = generateTokens(user);
    
    res.json({
        success: true,
        user: { id: user.id, name: user.name, email: user.email, isPremium: user.isPremium, xp: user.xp, level: user.level, streak: user.streak },
        accessToken,
        refreshToken
    });
});

// Refresh token
app.post('/api/auth/refresh', (req, res) => {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
        return res.status(401).json({ error: 'Refresh token required' });
    }
    
    jwt.verify(refreshToken, JWT_REFRESH_SECRET, (err, userData) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid refresh token' });
        }
        
        const user = db.users.find(u => u.id === userData.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);
        
        res.json({ accessToken, refreshToken: newRefreshToken });
    });
});

// Logout
app.post('/api/auth/logout', authenticateToken, (req, res) => {
    // In production, add token to blacklist
    res.json({ success: true });
});

// ============================================
// USER ROUTES
// ============================================

// Get user profile
app.get('/api/user/profile', authenticateToken, (req, res) => {
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        isPremium: user.isPremium,
        xp: user.xp,
        level: user.level,
        streak: user.streak,
        createdAt: user.createdAt
    });
});

// Update user profile
app.put('/api/user/profile', authenticateToken, [
    body('name').optional().trim().notEmpty(),
    body('goal').optional(),
    body('level').optional(),
    body('persona').optional()
], (req, res) => {
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    const allowedUpdates = ['name', 'goal', 'level', 'persona'];
    allowedUpdates.forEach(field => {
        if (req.body[field] !== undefined) {
            user[field] = req.body[field];
        }
    });
    
    res.json({ success: true, user });
});

// Get user progress
app.get('/api/user/progress', authenticateToken, (req, res) => {
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    const userSessions = db.sessions.filter(s => s.userId === req.user.id);
    const avgScore = userSessions.length > 0 
        ? userSessions.reduce((sum, s) => sum + s.score, 0) / userSessions.length 
        : 0;
    
    res.json({
        xp: user.xp,
        level: user.level,
        streak: user.streak,
        totalSessions: userSessions.length,
        averageScore: Math.round(avgScore),
        sessions: userSessions.slice(-10)
    });
});

// Update user progress (XP, level, streak)
app.post('/api/user/progress', authenticateToken, (req, res) => {
    const { xpGain, score } = req.body;
    const user = db.users.find(u => u.id === req.user.id);
    
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    // Update XP
    user.xp += xpGain || 0;
    
    // Update level based on XP
    const newLevel = Math.floor(user.xp / 100) + 1;
    let leveledUp = false;
    if (newLevel > user.level) {
        leveledUp = true;
        user.level = newLevel;
    }
    
    // Update streak
    const today = new Date().toDateString();
    if (user.lastPracticeDate !== today) {
        if (user.lastPracticeDate && new Date(user.lastPracticeDate).getDate() === new Date().getDate() - 1) {
            user.streak++;
        } else if (!user.lastPracticeDate) {
            user.streak = 1;
        } else {
            user.streak = 1;
        }
        user.lastPracticeDate = today;
    }
    
    res.json({
        success: true,
        xp: user.xp,
        level: user.level,
        streak: user.streak,
        leveledUp
    });
});

// ============================================
// PRACTICE SESSIONS
// ============================================

// Save practice session
app.post('/api/sessions', authenticateToken, (req, res) => {
    const { transcript, score, feedback, duration } = req.body;
    
    const session = {
        id: db.sessions.length + 1,
        userId: req.user.id,
        transcript,
        score,
        feedback,
        duration,
        createdAt: new Date().toISOString()
    };
    
    db.sessions.push(session);
    
    res.status(201).json({ success: true, session });
});

// Get user sessions
app.get('/api/sessions', authenticateToken, (req, res) => {
    const userSessions = db.sessions
        .filter(s => s.userId === req.user.id)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json({ sessions: userSessions });
});

// Get session by ID
app.get('/api/sessions/:id', authenticateToken, (req, res) => {
    const session = db.sessions.find(s => s.id === parseInt(req.params.id));
    
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }
    
    if (session.userId !== req.user.id) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    
    res.json({ session });
});

// Sync offline sessions
app.post('/api/sessions/sync', authenticateToken, (req, res) => {
    const { sessions } = req.body;
    
    if (!sessions || !Array.isArray(sessions)) {
        return res.status(400).json({ error: 'Invalid sessions data' });
    }
    
    const syncedSessions = [];
    for (const session of sessions) {
        const newSession = {
            id: db.sessions.length + 1,
            userId: req.user.id,
            ...session,
            syncedAt: new Date().toISOString()
        };
        db.sessions.push(newSession);
        syncedSessions.push(newSession);
    }
    
    res.json({ success: true, syncedCount: syncedSessions.length });
});

// ============================================
// VOICE ANALYSIS (AI Simulation)
// ============================================

// Analyze pronunciation
app.post('/api/voice/analyze', authenticateToken, upload.single('audio'), async (req, res) => {
    const { transcript, expectedText } = req.body;
    
    // Simulate AI analysis
    // In production, integrate with OpenAI Whisper or similar
    const words = (transcript || '').toLowerCase().split(' ');
    const expectedWords = expectedText ? expectedText.toLowerCase().split(' ') : words;
    
    const pronunciationScore = Math.min(100, Math.max(50, 70 + (words.length * 2) - (transcript?.includes('gonna') ? 10 : 0)));
    const fluencyScore = Math.min(100, Math.max(40, 60 + (words.length * 3)));
    const grammarScore = Math.min(100, Math.max(50, 75 - (transcript?.includes('gonna') ? 15 : 0)));
    const vocabularyScore = Math.min(100, Math.max(40, 65 + (new Set(words).size * 2)));
    
    const totalScore = Math.round(
        pronunciationScore * 0.4 +
        fluencyScore * 0.3 +
        grammarScore * 0.2 +
        vocabularyScore * 0.1
    );
    
    const feedback = generateFeedback(totalScore);
    
    res.json({
        success: true,
        scores: {
            pronunciation: pronunciationScore,
            fluency: fluencyScore,
            grammar: grammarScore,
            vocabulary: vocabularyScore,
            total: totalScore
        },
        feedback,
        transcript: transcript || 'Sample transcript',
        confidence: 0.85
    });
});

function generateFeedback(score) {
    if (score >= 85) {
        return {
            summary: 'Excellent! Your pronunciation is very clear.',
            strengths: ['Clear pronunciation', 'Good fluency', 'Proper grammar'],
            improvements: [],
            tips: ['Continue practicing to maintain your level']
        };
    } else if (score >= 70) {
        return {
            summary: 'Good job! A few areas need improvement.',
            strengths: ['Good effort', 'Understandable speech'],
            improvements: ['Work on word stress', 'Practice difficult sounds'],
            tips: ['Listen to native speakers', 'Record and compare yourself']
        };
    } else {
        return {
            summary: 'Keep practicing! Focus on the basics.',
            strengths: ['Willingness to practice'],
            improvements: ['Basic pronunciation', 'Sentence structure'],
            tips: ['Start with simple sentences', 'Practice daily for 10 minutes']
        };
    }
}

// ============================================
// VOCABULARY (SRS)
// ============================================

// Get all vocabulary
app.get('/api/vocabulary', authenticateToken, (req, res) => {
    res.json({ vocabulary: db.vocabulary });
});

// Get user vocabulary progress
app.get('/api/vocabulary/progress', authenticateToken, (req, res) => {
    const userVocab = db.userVocabulary.filter(uv => uv.userId === req.user.id);
    
    const progress = userVocab.map(uv => {
        const word = db.vocabulary.find(w => w.id === uv.wordId);
        return { ...word, masteryLevel: uv.masteryLevel, reviewCount: uv.reviewCount };
    });
    
    res.json({ progress });
});

// Update vocabulary progress
app.post('/api/vocabulary/progress', authenticateToken, (req, res) => {
    const { wordId, quality } = req.body;
    
    let userVocab = db.userVocabulary.find(uv => uv.userId === req.user.id && uv.wordId === wordId);
    
    if (!userVocab) {
        userVocab = {
            id: db.userVocabulary.length + 1,
            userId: req.user.id,
            wordId,
            masteryLevel: 0,
            reviewCount: 0,
            nextReview: new Date().toISOString()
        };
        db.userVocabulary.push(userVocab);
    }
    
    // Update based on quality (0-5)
    if (quality >= 4) {
        userVocab.masteryLevel = Math.min(3, userVocab.masteryLevel + 1);
    } else if (quality <= 2) {
        userVocab.masteryLevel = Math.max(0, userVocab.masteryLevel - 1);
    }
    
    userVocab.reviewCount++;
    
    // Calculate next review date (simplified SM-2)
    const intervals = [1, 3, 7, 14, 30];
    const nextInterval = intervals[userVocab.masteryLevel] || 30;
    userVocab.nextReview = new Date(Date.now() + nextInterval * 24 * 60 * 60 * 1000).toISOString();
    
    res.json({ success: true, progress: userVocab });
});

// ============================================
// PAYMENTS & SUBSCRIPTION
// ============================================

// Create payment intent
app.post('/api/payments/create', authenticateToken, (req, res) => {
    const { planId, amount, currency } = req.body;
    
    // In production, integrate with Stripe
    const paymentIntent = {
        id: `pi_${Date.now()}`,
        clientSecret: `secret_${Math.random().toString(36).substr(2, 9)}`,
        amount,
        currency,
        status: 'requires_payment_method'
    };
    
    res.json({ success: true, paymentIntent });
});

// Verify payment
app.post('/api/payments/verify', authenticateToken, (req, res) => {
    const { paymentIntentId } = req.body;
    
    // In production, verify with Stripe
    const payment = {
        id: paymentIntentId,
        userId: req.user.id,
        amount: 9.99,
        status: 'succeeded',
        createdAt: new Date().toISOString()
    };
    
    db.payments.push(payment);
    
    // Update user to premium
    const user = db.users.find(u => u.id === req.user.id);
    if (user) {
        user.isPremium = true;
        user.premiumUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    }
    
    res.json({ success: true, payment });
});

// Get subscription status
app.get('/api/payments/subscription', authenticateToken, (req, res) => {
    const user = db.users.find(u => u.id === req.user.id);
    
    res.json({
        isPremium: user?.isPremium || false,
        plan: user?.isPremium ? 'premium' : 'free',
        expiresAt: user?.premiumUntil || null
    });
});

// Cancel subscription
app.post('/api/payments/cancel', authenticateToken, (req, res) => {
    const user = db.users.find(u => u.id === req.user.id);
    
    if (user) {
        user.isPremium = false;
        user.premiumUntil = null;
    }
    
    res.json({ success: true });
});

// ============================================
// ANALYTICS
// ============================================

// Track event
app.post('/api/analytics/track', authenticateToken, (req, res) => {
    const { event, properties } = req.body;
    
    const analyticsEvent = {
        id: db.analytics.length + 1,
        userId: req.user.id,
        event,
        properties,
        timestamp: new Date().toISOString()
    };
    
    db.analytics.push(analyticsEvent);
    
    res.json({ success: true });
});

// Get user analytics
app.get('/api/analytics/user', authenticateToken, (req, res) => {
    const userEvents = db.analytics.filter(a => a.userId === req.user.id);
    
    // Aggregate stats
    const stats = {
        totalSessions: userEvents.filter(e => e.event === 'practice_complete').length,
        totalXP: userEvents.filter(e => e.event === 'xp_gain').reduce((sum, e) => sum + (e.properties?.amount || 0), 0),
        achievements: userEvents.filter(e => e.event === 'achievement_unlocked').length,
        lastActive: userEvents.length > 0 ? userEvents[userEvents.length - 1].timestamp : null
    };
    
    res.json({ stats });
});

// Get global stats (admin only)
app.get('/api/analytics/global', authenticateToken, (req, res) => {
    // Check if admin (simplified)
    const isAdmin = req.user.email === 'admin@speakflow.com';
    if (!isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    
    const totalUsers = db.users.length;
    const premiumUsers = db.users.filter(u => u.isPremium).length;
    const totalSessions = db.sessions.length;
    const totalRevenue = db.payments.reduce((sum, p) => sum + p.amount, 0);
    
    res.json({
        totalUsers,
        premiumUsers,
        premiumRate: (premiumUsers / totalUsers) * 100,
        totalSessions,
        totalRevenue,
        activeUsers: db.users.filter(u => {
            const lastSession = db.sessions.filter(s => s.userId === u.id).pop();
            return lastSession && new Date(lastSession.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        }).length
    });
});

// ============================================
// A/B TESTING
// ============================================

// Get active experiments
app.get('/api/ab-test/experiments', authenticateToken, (req, res) => {
    const activeTests = db.abTests.filter(t => t.status === 'active');
    res.json({ experiments: activeTests });
});

// Assign variant
app.post('/api/ab-test/assign', authenticateToken, (req, res) => {
    const { experimentId } = req.body;
    
    // Simple random assignment
    const variant = Math.random() < 0.5 ? 'A' : 'B';
    
    res.json({ variant });
});

// Track conversion
app.post('/api/ab-test/track', authenticateToken, (req, res) => {
    const { experimentId, variant, metric } = req.body;
    
    // In production, store conversion data
    res.json({ success: true });
});

// ============================================
// SUPPORT
// ============================================

// Create support ticket
app.post('/api/support/tickets', authenticateToken, [
    body('subject').notEmpty().trim(),
    body('message').notEmpty().trim()
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    
    const { subject, message, category, priority } = req.body;
    
    const ticket = {
        id: `TKT${String(db.supportTickets.length + 1).padStart(5, '0')}`,
        userId: req.user.id,
        subject,
        message,
        category: category || 'general',
        priority: priority || 'medium',
        status: 'open',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    db.supportTickets.push(ticket);
    
    res.status(201).json({ success: true, ticket });
});

// Get user tickets
app.get('/api/support/tickets', authenticateToken, (req, res) => {
    const userTickets = db.supportTickets.filter(t => t.userId === req.user.id);
    res.json({ tickets: userTickets });
});

// Get ticket by ID
app.get('/api/support/tickets/:id', authenticateToken, (req, res) => {
    const ticket = db.supportTickets.find(t => t.id === req.params.id);
    
    if (!ticket) {
        return res.status(404).json({ error: 'Ticket not found' });
    }
    
    if (ticket.userId !== req.user.id) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    
    res.json({ ticket });
});

// Add message to ticket
app.post('/api/support/tickets/:id/messages', authenticateToken, (req, res) => {
    const { message } = req.body;
    const ticket = db.supportTickets.find(t => t.id === req.params.id);
    
    if (!ticket) {
        return res.status(404).json({ error: 'Ticket not found' });
    }
    
    if (ticket.userId !== req.user.id) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    
    if (!ticket.messages) ticket.messages = [];
    
    ticket.messages.push({
        id: Date.now(),
        sender: 'user',
        message,
        timestamp: new Date().toISOString()
    });
    
    ticket.updatedAt = new Date().toISOString();
    
    res.json({ success: true });
});

// ============================================
// CHALLENGES
// ============================================

// Get daily challenges
app.get('/api/challenges/daily', authenticateToken, (req, res) => {
    const challenges = [
        {
            id: 1,
            title: 'Morning Routine',
            description: 'Describe your morning routine in 3 sentences',
            difficulty: 'easy',
            xpReward: 30,
            type: 'speaking'
        },
        {
            id: 2,
            title: 'Interview Practice',
            description: 'Answer: "Tell me about yourself"',
            difficulty: 'medium',
            xpReward: 50,
            type: 'speaking'
        },
        {
            id: 3,
            title: 'Opinion Topic',
            description: 'Share your opinion on remote work',
            difficulty: 'hard',
            xpReward: 80,
            type: 'speaking'
        }
    ];
    
    res.json({ challenges, date: new Date().toDateString() });
});

// ============================================
// MARKETING (Email, Push)
// ============================================

// Send marketing email
app.post('/api/marketing/email', authenticateToken, (req, res) => {
    const { to, template, variables } = req.body;
    
    // In production, use SendGrid or similar
    console.log(`[Email] Sending ${template} to ${to}`, variables);
    
    res.json({ success: true, messageId: `msg_${Date.now()}` });
});

// Send push notification
app.post('/api/marketing/push', authenticateToken, (req, res) => {
    const { userId, title, body, data } = req.body;
    
    // In production, use web push API
    console.log(`[Push] Sending to user ${userId}: ${title}`);
    
    res.json({ success: true });
});

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: err.message });
    }
    
    res.status(500).json({ error: 'Internal server error' });
});

// ============================================
// SERVER START
// ============================================

app.listen(PORT, () => {
    console.log(`🚀 SpeakFlow server running on port ${PORT}`);
    console.log(`📡 API available at http://localhost:${PORT}/api`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Export for testing
module.exports = app;
