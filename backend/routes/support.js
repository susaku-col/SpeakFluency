// ============================================
// Customer Support Routes
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

// Support agent middleware
const isSupportAgent = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'support') {
      return res.status(403).json({
        success: false,
        error: 'Support agent access required',
        code: 'SUPPORT_AGENT_REQUIRED'
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

const ticketLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 tickets per hour
  message: {
    success: false,
    error: 'Too many tickets created. Please try again later.'
  }
});

const messageLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 messages per minute
  message: {
    success: false,
    error: 'Too many messages. Please slow down.'
  }
});

// ============================================
// Validation Rules
// ============================================

const createTicketValidation = [
  body('subject')
    .notEmpty()
    .withMessage('Subject is required')
    .isLength({ min: 5, max: 200 })
    .withMessage('Subject must be between 5 and 200 characters'),
  body('category')
    .isIn(['technical', 'billing', 'account', 'feature_request', 'bug_report', 'general', 'other'])
    .withMessage('Invalid category'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Invalid priority'),
  body('message')
    .notEmpty()
    .withMessage('Message is required')
    .isLength({ min: 10, max: 5000 })
    .withMessage('Message must be between 10 and 5000 characters'),
  body('attachments')
    .optional()
    .isArray()
    .withMessage('Attachments must be an array'),
];

const addMessageValidation = [
  body('message')
    .notEmpty()
    .withMessage('Message is required')
    .isLength({ min: 1, max: 5000 })
    .withMessage('Message must be between 1 and 5000 characters'),
  body('attachments')
    .optional()
    .isArray()
    .withMessage('Attachments must be an array'),
];

const updateTicketStatusValidation = [
  body('status')
    .isIn(['open', 'in_progress', 'waiting', 'resolved', 'closed'])
    .withMessage('Invalid status'),
  body('note')
    .optional()
    .isString()
    .withMessage('Note must be a string'),
];

// ============================================
// Support Data Storage
// ============================================

// Tickets storage
const tickets = new Map();

// Knowledge base articles
const knowledgeBase = new Map();

// FAQ categories
const faqCategories = new Map();

// Support analytics
const supportAnalytics = new Map();

// Live chat sessions
const chatSessions = new Map();

// ============================================
// Mock Data
// ============================================

// FAQ Categories
const defaultFaqCategories = [
  {
    id: 'getting_started',
    name: 'Getting Started',
    icon: '🚀',
    order: 1,
    articles: []
  },
  {
    id: 'account_billing',
    name: 'Account & Billing',
    icon: '💳',
    order: 2,
    articles: []
  },
  {
    id: 'technical',
    name: 'Technical Issues',
    icon: '🔧',
    order: 3,
    articles: []
  },
  {
    id: 'features',
    name: 'Features & Usage',
    icon: '✨',
    order: 4,
    articles: []
  },
  {
    id: 'privacy_security',
    name: 'Privacy & Security',
    icon: '🔒',
    order: 5,
    articles: []
  }
];

// FAQ Articles
const defaultFaqArticles = [
  {
    id: 'how_to_start',
    categoryId: 'getting_started',
    title: 'How do I start my first lesson?',
    content: `
      <h2>Starting Your First Lesson</h2>
      <p>Getting started with SpeakFlow is easy! Follow these steps:</p>
      <ol>
        <li>Log in to your SpeakFlow account</li>
        <li>Click on "Dashboard" in the navigation menu</li>
        <li>Select "Start Practice" or choose a lesson from the recommendations</li>
        <li>Follow the on-screen instructions to complete your first lesson</li>
      </ol>
      <p>Your first lesson will be a placement test to determine your current level.</p>
      <div class="tip">
        <strong>💡 Tip:</strong> Make sure you have a working microphone for pronunciation exercises!
      </div>
    `,
    helpful: 1245,
    notHelpful: 67,
    views: 15234,
    createdAt: new Date('2024-01-01').toISOString(),
    updatedAt: new Date('2024-01-15').toISOString()
  },
  {
    id: 'subscription_plans',
    categoryId: 'account_billing',
    title: 'What subscription plans are available?',
    content: `
      <h2>SpeakFlow Subscription Plans</h2>
      <p>We offer several plans to fit your learning needs:</p>
      <ul>
        <li><strong>Free</strong> - 3 lessons per day, basic features</li>
        <li><strong>Pro Monthly</strong> - $12.99/month, unlimited lessons, AI features</li>
        <li><strong>Pro Yearly</strong> - $99.99/year, save 36%</li>
        <li><strong>Family</strong> - $24.99/month, up to 5 members</li>
      </ul>
      <p>All paid plans include a 7-day free trial!</p>
    `,
    helpful: 2341,
    notHelpful: 89,
    views: 28765,
    createdAt: new Date('2024-01-01').toISOString(),
    updatedAt: new Date('2024-02-01').toISOString()
  },
  {
    id: 'cancel_subscription',
    categoryId: 'account_billing',
    title: 'How do I cancel my subscription?',
    content: `
      <h2>Canceling Your Subscription</h2>
      <p>You can cancel your subscription at any time:</p>
      <ol>
        <li>Go to Account Settings → Subscription</li>
        <li>Click on "Cancel Subscription"</li>
        <li>Confirm your cancellation</li>
      </ol>
      <p>Your subscription will remain active until the end of your billing period.</p>
    `,
    helpful: 1876,
    notHelpful: 45,
    views: 19876,
    createdAt: new Date('2024-01-05').toISOString(),
    updatedAt: new Date('2024-01-20').toISOString()
  },
  {
    id: 'microphone_not_working',
    categoryId: 'technical',
    title: 'My microphone is not working',
    content: `
      <h2>Microphone Troubleshooting</h2>
      <p>If your microphone isn't working, try these steps:</p>
      <ol>
        <li>Check your browser permissions - allow microphone access</li>
        <li>Test your microphone in another app or website</li>
        <li>Check if your microphone is properly connected</li>
        <li>Try a different browser (Chrome, Firefox, or Edge recommended)</li>
        <li>Restart your browser or computer</li>
      </ol>
      <p>If issues persist, please contact support with your device details.</p>
    `,
    helpful: 987,
    notHelpful: 123,
    views: 12345,
    createdAt: new Date('2024-01-10').toISOString(),
    updatedAt: new Date('2024-02-01').toISOString()
  },
  {
    id: 'pronunciation_feedback',
    categoryId: 'features',
    title: 'How does pronunciation feedback work?',
    content: `
      <h2>Understanding Pronunciation Feedback</h2>
      <p>Our AI analyzes your speech in real-time:</p>
      <ul>
        <li><strong>Green</strong> - Excellent pronunciation</li>
        <li><strong>Yellow</strong> - Good, but can improve</li>
        <li><strong>Red</strong> - Needs practice</li>
      </ul>
      <p>The system provides specific tips on which sounds to improve.</p>
    `,
    helpful: 2345,
    notHelpful: 67,
    views: 18976,
    createdAt: new Date('2024-01-12').toISOString(),
    updatedAt: new Date('2024-01-25').toISOString()
  }
];

// Initialize FAQ data
defaultFaqCategories.forEach(category => {
  faqCategories.set(category.id, category);
});

defaultFaqArticles.forEach(article => {
  knowledgeBase.set(article.id, article);
  const category = faqCategories.get(article.categoryId);
  if (category) {
    category.articles.push(article.id);
    faqCategories.set(article.categoryId, category);
  }
});

// Mock tickets
const mockTickets = [
  {
    id: 'ticket_001',
    userId: 'user_1',
    subject: 'Cannot access premium features',
    category: 'technical',
    priority: 'high',
    status: 'in_progress',
    messages: [
      {
        id: 'msg_001',
        senderId: 'user_1',
        senderName: 'John Doe',
        senderRole: 'user',
        message: 'I upgraded to Pro but still see limited features.',
        attachments: [],
        createdAt: new Date('2024-03-20T10:00:00Z').toISOString(),
        isInternal: false
      },
      {
        id: 'msg_002',
        senderId: 'agent_1',
        senderName: 'Sarah Support',
        senderRole: 'support',
        message: 'I can see your subscription is active. Could you try logging out and back in?',
        attachments: [],
        createdAt: new Date('2024-03-20T10:30:00Z').toISOString(),
        isInternal: false
      }
    ],
    createdAt: new Date('2024-03-20T10:00:00Z').toISOString(),
    updatedAt: new Date('2024-03-20T10:30:00Z').toISOString(),
    assignedTo: 'agent_1',
    tags: ['premium', 'access']
  },
  {
    id: 'ticket_002',
    userId: 'user_2',
    subject: 'Billing question about refund',
    category: 'billing',
    priority: 'medium',
    status: 'open',
    messages: [
      {
        id: 'msg_003',
        senderId: 'user_2',
        senderName: 'Jane Smith',
        senderRole: 'user',
        message: 'I was charged twice this month. Can I get a refund?',
        attachments: [{ name: 'screenshot.png', url: 'https://example.com/screenshot.png', size: 1024 }],
        createdAt: new Date('2024-03-21T14:00:00Z').toISOString(),
        isInternal: false
      }
    ],
    createdAt: new Date('2024-03-21T14:00:00Z').toISOString(),
    updatedAt: new Date('2024-03-21T14:00:00Z').toISOString(),
    assignedTo: null,
    tags: ['refund', 'duplicate_charge']
  }
];

mockTickets.forEach(ticket => {
  tickets.set(ticket.id, ticket);
});

// ============================================
// Helper Functions
// ============================================

// Generate unique ID
const generateId = (prefix) => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Send email notification (mock)
const sendSupportNotification = async (userId, ticketId, message) => {
  console.log(`[SUPPORT_NOTIFICATION] User: ${userId}, Ticket: ${ticketId}`);
  console.log(`[SUPPORT_NOTIFICATION] Message: ${message}`);
  return { success: true };
};

// Get user by ID (mock)
const getUserById = async (userId) => {
  return {
    id: userId,
    name: `User ${userId}`,
    email: `${userId}@example.com`,
    role: 'user'
  };
};

// Track support analytics
const trackSupportAnalytics = (eventType, data = {}) => {
  const key = new Date().toISOString().split('T')[0];
  if (!supportAnalytics.has(key)) {
    supportAnalytics.set(key, {
      date: key,
      ticketsCreated: 0,
      ticketsResolved: 0,
      averageResponseTime: 0,
      satisfactionScore: 0
    });
  }
  
  const analytics = supportAnalytics.get(key);
  
  if (eventType === 'ticket_created') {
    analytics.ticketsCreated++;
  } else if (eventType === 'ticket_resolved') {
    analytics.ticketsResolved++;
  }
  
  supportAnalytics.set(key, analytics);
};

// Calculate response time
const calculateResponseTime = (ticket) => {
  const firstMessage = ticket.messages[0];
  const firstResponse = ticket.messages.find(m => m.senderRole !== 'user');
  
  if (firstMessage && firstResponse) {
    const responseTime = new Date(firstResponse.createdAt) - new Date(firstMessage.createdAt);
    return Math.round(responseTime / (1000 * 60)); // minutes
  }
  return null;
};

// ============================================
// User Routes
// ============================================

/**
 * GET /api/support/tickets
 * Get user's tickets
 */
router.get('/tickets', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, page = 1, limit = 20 } = req.query;
    
    let userTickets = Array.from(tickets.values()).filter(t => t.userId === userId);
    
    if (status) {
      userTickets = userTickets.filter(t => t.status === status);
    }
    
    // Pagination
    const startIndex = (page - 1) * limit;
    const paginatedTickets = userTickets.slice(startIndex, startIndex + limit);
    
    res.json({
      success: true,
      data: {
        tickets: paginatedTickets.map(t => ({
          id: t.id,
          subject: t.subject,
          category: t.category,
          priority: t.priority,
          status: t.status,
          lastMessage: t.messages[t.messages.length - 1]?.message,
          lastUpdated: t.updatedAt,
          createdAt: t.createdAt,
          messageCount: t.messages.length
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: userTickets.length,
          pages: Math.ceil(userTickets.length / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get tickets error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve tickets'
    });
  }
});

/**
 * GET /api/support/tickets/:ticketId
 * Get ticket details
 */
router.get('/tickets/:ticketId', authenticateToken, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const userId = req.user.id;
    
    const ticket = tickets.get(ticketId);
    
    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: 'Ticket not found',
        code: 'TICKET_NOT_FOUND'
      });
    }
    
    // Check authorization
    if (ticket.userId !== userId && req.user.role !== 'admin' && req.user.role !== 'support') {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        code: 'ACCESS_DENIED'
      });
    }
    
    res.json({
      success: true,
      data: ticket
    });
  } catch (error) {
    console.error('Get ticket error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve ticket'
    });
  }
});

/**
 * POST /api/support/tickets
 * Create new support ticket
 */
router.post('/tickets', authenticateToken, ticketLimiter, createTicketValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }
    
    const { subject, category, priority = 'medium', message, attachments = [] } = req.body;
    const userId = req.user.id;
    
    const user = await getUserById(userId);
    
    const ticketId = generateId('ticket');
    const ticket = {
      id: ticketId,
      userId,
      userEmail: user.email,
      userName: user.name,
      subject,
      category,
      priority,
      status: 'open',
      messages: [
        {
          id: generateId('msg'),
          senderId: userId,
          senderName: user.name,
          senderRole: 'user',
          message,
          attachments,
          createdAt: new Date().toISOString(),
          isInternal: false
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      assignedTo: null,
      tags: []
    };
    
    tickets.set(ticketId, ticket);
    trackSupportAnalytics('ticket_created');
    
    // Notify support team (mock)
    await sendSupportNotification('support_team', ticketId, `New ticket: ${subject}`);
    
    res.status(201).json({
      success: true,
      message: 'Ticket created successfully',
      data: ticket
    });
  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create ticket'
    });
  }
});

/**
 * POST /api/support/tickets/:ticketId/messages
 * Add message to ticket
 */
router.post('/tickets/:ticketId/messages', authenticateToken, messageLimiter, addMessageValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }
    
    const { ticketId } = req.params;
    const { message, attachments = [], isInternal = false } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;
    
    const ticket = tickets.get(ticketId);
    
    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: 'Ticket not found',
        code: 'TICKET_NOT_FOUND'
      });
    }
    
    // Check authorization
    if (ticket.userId !== userId && userRole !== 'admin' && userRole !== 'support') {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        code: 'ACCESS_DENIED'
      });
    }
    
    // Internal notes only for support agents
    if (isInternal && userRole === 'user') {
      return res.status(403).json({
        success: false,
        error: 'Cannot add internal notes as user'
      });
    }
    
    const newMessage = {
      id: generateId('msg'),
      senderId: userId,
      senderName: req.user.name || (userRole === 'user' ? 'User' : 'Support Agent'),
      senderRole: userRole === 'user' ? 'user' : 'support',
      message,
      attachments,
      createdAt: new Date().toISOString(),
      isInternal
    };
    
    ticket.messages.push(newMessage);
    ticket.updatedAt = new Date().toISOString();
    
    // Update status if user replied to closed/resolved ticket
    if (userRole === 'user' && (ticket.status === 'resolved' || ticket.status === 'closed')) {
      ticket.status = 'open';
    }
    
    // If support replied, mark as in_progress
    if (userRole !== 'user' && ticket.status === 'open') {
      ticket.status = 'in_progress';
    }
    
    tickets.set(ticketId, ticket);
    
    // Send notification to other party
    if (userRole === 'user') {
      await sendSupportNotification('support_team', ticketId, `New reply from user: ${message.substring(0, 100)}`);
    } else {
      await sendSupportNotification(ticket.userId, ticketId, `New reply from support: ${message.substring(0, 100)}`);
    }
    
    res.json({
      success: true,
      message: 'Message added successfully',
      data: newMessage
    });
  } catch (error) {
    console.error('Add message error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add message'
    });
  }
});

/**
 * PUT /api/support/tickets/:ticketId/close
 * Close ticket
 */
router.put('/tickets/:ticketId/close', authenticateToken, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;
    
    const ticket = tickets.get(ticketId);
    
    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: 'Ticket not found',
        code: 'TICKET_NOT_FOUND'
      });
    }
    
    // Check authorization
    if (ticket.userId !== userId && userRole !== 'admin' && userRole !== 'support') {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        code: 'ACCESS_DENIED'
      });
    }
    
    ticket.status = 'closed';
    ticket.closedAt = new Date().toISOString();
    ticket.closedBy = userId;
    ticket.updatedAt = new Date().toISOString();
    
    tickets.set(ticketId, ticket);
    trackSupportAnalytics('ticket_resolved');
    
    res.json({
      success: true,
      message: 'Ticket closed successfully',
      data: { ticketId, status: ticket.status }
    });
  } catch (error) {
    console.error('Close ticket error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to close ticket'
    });
  }
});

// ============================================
// Knowledge Base Routes
// ============================================

/**
 * GET /api/support/faq/categories
 * Get FAQ categories
 */
router.get('/faq/categories', async (req, res) => {
  try {
    const categories = Array.from(faqCategories.values())
      .sort((a, b) => a.order - b.order)
      .map(cat => ({
        id: cat.id,
        name: cat.name,
        icon: cat.icon,
        articleCount: cat.articles.length
      }));
    
    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve categories'
    });
  }
});

/**
 * GET /api/support/faq/articles
 * Get FAQ articles
 */
router.get('/faq/articles', async (req, res) => {
  try {
    const { categoryId, search, limit = 50 } = req.query;
    
    let articles = Array.from(knowledgeBase.values());
    
    if (categoryId) {
      articles = articles.filter(a => a.categoryId === categoryId);
    }
    
    if (search) {
      const searchLower = search.toLowerCase();
      articles = articles.filter(a => 
        a.title.toLowerCase().includes(searchLower) ||
        a.content.toLowerCase().includes(searchLower)
      );
    }
    
    articles = articles.slice(0, limit);
    
    res.json({
      success: true,
      data: articles.map(a => ({
        id: a.id,
        title: a.title,
        categoryId: a.categoryId,
        helpful: a.helpful,
        notHelpful: a.notHelpful,
        views: a.views,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt
      }))
    });
  } catch (error) {
    console.error('Get articles error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve articles'
    });
  }
});

/**
 * GET /api/support/faq/articles/:articleId
 * Get FAQ article details
 */
router.get('/faq/articles/:articleId', async (req, res) => {
  try {
    const { articleId } = req.params;
    
    const article = knowledgeBase.get(articleId);
    
    if (!article) {
      return res.status(404).json({
        success: false,
        error: 'Article not found',
        code: 'ARTICLE_NOT_FOUND'
      });
    }
    
    // Increment view count
    article.views++;
    knowledgeBase.set(articleId, article);
    
    // Get related articles
    const relatedArticles = Array.from(knowledgeBase.values())
      .filter(a => a.categoryId === article.categoryId && a.id !== articleId)
      .slice(0, 5)
      .map(a => ({
        id: a.id,
        title: a.title
      }));
    
    res.json({
      success: true,
      data: {
        ...article,
        relatedArticles
      }
    });
  } catch (error) {
    console.error('Get article error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve article'
    });
  }
});

/**
 * POST /api/support/faq/articles/:articleId/feedback
 * Submit feedback on article
 */
router.post('/faq/articles/:articleId/feedback', async (req, res) => {
  try {
    const { articleId } = req.params;
    const { helpful } = req.body;
    
    const article = knowledgeBase.get(articleId);
    
    if (!article) {
      return res.status(404).json({
        success: false,
        error: 'Article not found',
        code: 'ARTICLE_NOT_FOUND'
      });
    }
    
    if (helpful === true) {
      article.helpful++;
    } else if (helpful === false) {
      article.notHelpful++;
    }
    
    knowledgeBase.set(articleId, article);
    
    res.json({
      success: true,
      message: 'Feedback submitted successfully'
    });
  } catch (error) {
    console.error('Submit feedback error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit feedback'
    });
  }
});

// ============================================
// Support Agent Routes
// ============================================

/**
 * GET /api/support/admin/tickets
 * Get all tickets (support agents)
 */
router.get('/admin/tickets', authenticateToken, isSupportAgent, async (req, res) => {
  try {
    const { status, priority, assignedTo, page = 1, limit = 50 } = req.query;
    
    let allTickets = Array.from(tickets.values());
    
    if (status) {
      allTickets = allTickets.filter(t => t.status === status);
    }
    if (priority) {
      allTickets = allTickets.filter(t => t.priority === priority);
    }
    if (assignedTo) {
      allTickets = allTickets.filter(t => t.assignedTo === assignedTo);
    }
    
    // Sort by priority and date
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    allTickets.sort((a, b) => {
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    
    // Pagination
    const startIndex = (page - 1) * limit;
    const paginatedTickets = allTickets.slice(startIndex, startIndex + limit);
    
    // Add response time
    const ticketsWithStats = paginatedTickets.map(t => ({
      ...t,
      responseTime: calculateResponseTime(t),
      messageCount: t.messages.length
    }));
    
    res.json({
      success: true,
      data: {
        tickets: ticketsWithStats,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: allTickets.length,
          pages: Math.ceil(allTickets.length / limit)
        },
        summary: {
          open: allTickets.filter(t => t.status === 'open').length,
          inProgress: allTickets.filter(t => t.status === 'in_progress').length,
          waiting: allTickets.filter(t => t.status === 'waiting').length,
          resolved: allTickets.filter(t => t.status === 'resolved').length,
          closed: allTickets.filter(t => t.status === 'closed').length
        }
      }
    });
  } catch (error) {
    console.error('Admin get tickets error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve tickets'
    });
  }
});

/**
 * PUT /api/support/admin/tickets/:ticketId/status
 * Update ticket status (support agents)
 */
router.put('/admin/tickets/:ticketId/status', authenticateToken, isSupportAgent, updateTicketStatusValidation, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { status, note } = req.body;
    
    const ticket = tickets.get(ticketId);
    
    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: 'Ticket not found',
        code: 'TICKET_NOT_FOUND'
      });
    }
    
    const oldStatus = ticket.status;
    ticket.status = status;
    ticket.updatedAt = new Date().toISOString();
    
    if (note) {
      ticket.messages.push({
        id: generateId('msg'),
        senderId: req.user.id,
        senderName: req.user.name || 'Support Agent',
        senderRole: 'support',
        message: `[System] Status changed from ${oldStatus} to ${status}. Note: ${note}`,
        attachments: [],
        createdAt: new Date().toISOString(),
        isInternal: true
      });
    }
    
    if (status === 'resolved' && oldStatus !== 'resolved') {
      ticket.resolvedAt = new Date().toISOString();
      trackSupportAnalytics('ticket_resolved');
    }
    
    tickets.set(ticketId, ticket);
    
    // Notify user
    if (status === 'resolved') {
      await sendSupportNotification(ticket.userId, ticketId, 'Your ticket has been marked as resolved. If you still need help, please reply to reopen.');
    }
    
    res.json({
      success: true,
      message: 'Ticket status updated',
      data: { ticketId, status: ticket.status }
    });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update ticket status'
    });
  }
});

/**
 * PUT /api/support/admin/tickets/:ticketId/assign
 * Assign ticket to agent
 */
router.put('/admin/tickets/:ticketId/assign', authenticateToken, isSupportAgent, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { agentId } = req.body;
    
    const ticket = tickets.get(ticketId);
    
    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: 'Ticket not found',
        code: 'TICKET_NOT_FOUND'
      });
    }
    
    ticket.assignedTo = agentId;
    ticket.assignedAt = new Date().toISOString();
    ticket.updatedAt = new Date().toISOString();
    
    tickets.set(ticketId, ticket);
    
    res.json({
      success: true,
      message: `Ticket assigned to ${agentId || 'unassigned'}`,
      data: { ticketId, assignedTo: ticket.assignedTo }
    });
  } catch (error) {
    console.error('Assign ticket error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to assign ticket'
    });
  }
});

/**
 * GET /api/support/admin/analytics
 * Get support analytics (admin only)
 */
router.get('/admin/analytics', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const allTickets = Array.from(tickets.values());
    
    // Calculate metrics
    const totalTickets = allTickets.length;
    const openTickets = allTickets.filter(t => t.status === 'open').length;
    const resolvedTickets = allTickets.filter(t => t.status === 'resolved' || t.status === 'closed').length;
    const resolutionRate = totalTickets > 0 ? (resolvedTickets / totalTickets) * 100 : 0;
    
    // Average response time
    const responseTimes = allTickets.map(t => calculateResponseTime(t)).filter(rt => rt !== null);
    const avgResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
      : 0;
    
    // Tickets by category
    const ticketsByCategory = {};
    allTickets.forEach(t => {
      ticketsByCategory[t.category] = (ticketsByCategory[t.category] || 0) + 1;
    });
    
    // Daily analytics
    const dailyAnalytics = Array.from(supportAnalytics.values()).slice(-30);
    
    // Satisfaction score
    const satisfactionScore = 4.5; // Mock data
    
    res.json({
      success: true,
      data: {
        overview: {
          totalTickets,
          openTickets,
          resolvedTickets,
          resolutionRate: Math.round(resolutionRate * 100) / 100,
          avgResponseTime: Math.round(avgResponseTime),
          satisfactionScore
        },
        ticketsByCategory,
        dailyAnalytics,
        recentActivity: allTickets.slice(-10).map(t => ({
          id: t.id,
          subject: t.subject,
          status: t.status,
          createdAt: t.createdAt,
          messageCount: t.messages.length
        }))
      }
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve analytics'
    });
  }
});

// ============================================
// Live Chat Routes
// ============================================

/**
 * POST /api/support/chat/start
 * Start live chat session
 */
router.post('/chat/start', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await getUserById(userId);
    
    // Check for existing active session
    let existingSession = null;
    for (const [sessionId, session] of chatSessions.entries()) {
      if (session.userId === userId && session.status === 'active') {
        existingSession = session;
        break;
      }
    }
    
    if (existingSession) {
      return res.json({
        success: true,
        data: existingSession,
        message: 'Existing chat session found'
      });
    }
    
    const sessionId = generateId('chat');
    const session = {
      id: sessionId,
      userId,
      userName: user.name,
      userEmail: user.email,
      status: 'waiting',
      messages: [],
      startedAt: new Date().toISOString(),
      assignedTo: null
    };
    
    chatSessions.set(sessionId, session);
    
    res.json({
      success: true,
      data: session
    });
  } catch (error) {
    console.error('Start chat error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start chat session'
    });
  }
});

/**
 * POST /api/support/chat/:sessionId/message
 * Send chat message
 */
router.post('/chat/:sessionId/message', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { message } = req.body;
    
    const session = chatSessions.get(sessionId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Chat session not found'
      });
    }
    
    const newMessage = {
      id: generateId('chat_msg'),
      senderId: req.user.id,
      senderName: req.user.name || 'User',
      message,
      timestamp: new Date().toISOString()
    };
    
    session.messages.push(newMessage);
    chatSessions.set(sessionId, session);
    
    res.json({
      success: true,
      data: newMessage
    });
  } catch (error) {
    console.error('Send chat message error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send message'
    });
  }
});

/**
 * PUT /api/support/chat/:sessionId/end
 * End chat session
 */
router.put('/chat/:sessionId/end', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const session = chatSessions.get(sessionId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Chat session not found'
      });
    }
    
    session.status = 'ended';
    session.endedAt = new Date().toISOString();
    chatSessions.set(sessionId, session);
    
    res.json({
      success: true,
      message: 'Chat session ended'
    });
  } catch (error) {
    console.error('End chat error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to end chat session'
    });
  }
});

module.exports = router;
