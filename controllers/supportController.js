// ============================================
// Support Controller
// SpeakFlow - AI Language Learning Platform
// ============================================

const { validationResult } = require('express-validator');

// ============================================
// Constants & Configuration
// ============================================

const TICKET_STATUSES = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  WAITING: 'waiting',
  RESOLVED: 'resolved',
  CLOSED: 'closed'
};

const TICKET_PRIORITIES = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent'
};

const TICKET_CATEGORIES = {
  TECHNICAL: 'technical',
  BILLING: 'billing',
  ACCOUNT: 'account',
  FEATURE_REQUEST: 'feature_request',
  BUG_REPORT: 'bug_report',
  GENERAL: 'general',
  OTHER: 'other'
};

const SUPPORT_AGENT_ROLES = {
  AGENT: 'agent',
  SENIOR_AGENT: 'senior_agent',
  SUPERVISOR: 'supervisor',
  ADMIN: 'admin'
};

// ============================================
// Mock Database
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

// Support agents
const supportAgents = new Map();

// Ticket comments
const ticketComments = new Map();

// Ticket attachments
const ticketAttachments = new Map();

// Support templates (canned responses)
const supportTemplates = new Map();

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
 * Get user by ID (mock)
 */
const getUserById = async (userId) => {
  return {
    id: userId,
    email: `${userId}@example.com`,
    name: `User ${userId}`,
    role: 'user',
    status: 'active',
    createdAt: new Date().toISOString(),
    subscription: { plan: 'free', status: 'active' }
  };
};

/**
 * Get support agent by ID
 */
const getSupportAgent = (agentId) => {
  return supportAgents.get(agentId) || null;
};

/**
 * Send email notification (mock)
 */
const sendSupportNotification = async (to, subject, message, metadata = {}) => {
  console.log(`[SUPPORT_NOTIFICATION] To: ${to}`);
  console.log(`[SUPPORT_NOTIFICATION] Subject: ${subject}`);
  console.log(`[SUPPORT_NOTIFICATION] Message: ${message}`);
  return { success: true, messageId: generateId('email') };
};

/**
 * Track support analytics
 */
const trackSupportAnalytics = (eventType, data = {}) => {
  const date = new Date().toISOString().split('T')[0];
  const key = date;
  
  if (!supportAnalytics.has(key)) {
    supportAnalytics.set(key, {
      date: key,
      ticketsCreated: 0,
      ticketsResolved: 0,
      averageResponseTime: 0,
      averageResolutionTime: 0,
      satisfactionScore: 0,
      satisfactionResponses: 0,
      satisfactionTotal: 0
    });
  }
  
  const analytics = supportAnalytics.get(key);
  
  switch (eventType) {
    case 'ticket_created':
      analytics.ticketsCreated++;
      break;
    case 'ticket_resolved':
      analytics.ticketsResolved++;
      break;
    case 'response_time':
      if (data.responseTime) {
        const currentAvg = analytics.averageResponseTime;
        const count = analytics.ticketsResolved || 1;
        analytics.averageResponseTime = (currentAvg * (count - 1) + data.responseTime) / count;
      }
      break;
    case 'satisfaction':
      if (data.score) {
        analytics.satisfactionTotal += data.score;
        analytics.satisfactionResponses++;
        analytics.satisfactionScore = analytics.satisfactionTotal / analytics.satisfactionResponses;
      }
      break;
  }
  
  supportAnalytics.set(key, analytics);
};

/**
 * Calculate response time (in minutes)
 */
const calculateResponseTime = (ticket) => {
  const firstMessage = ticket.messages[0];
  const firstResponse = ticket.messages.find(m => m.senderRole !== 'user');
  
  if (firstMessage && firstResponse) {
    const responseTime = (new Date(firstResponse.createdAt) - new Date(firstMessage.createdAt)) / (1000 * 60);
    return Math.round(responseTime);
  }
  return null;
};

/**
 * Calculate resolution time (in hours)
 */
const calculateResolutionTime = (ticket) => {
  if (!ticket.resolvedAt) return null;
  const resolutionTime = (new Date(ticket.resolvedAt) - new Date(ticket.createdAt)) / (1000 * 60 * 60);
  return Math.round(resolutionTime * 100) / 100;
};

/**
 * Get ticket status color
 */
const getStatusColor = (status) => {
  const colors = {
    [TICKET_STATUSES.OPEN]: '#F59E0B', // Orange
    [TICKET_STATUSES.IN_PROGRESS]: '#3B82F6', // Blue
    [TICKET_STATUSES.WAITING]: '#8B5CF6', // Purple
    [TICKET_STATUSES.RESOLVED]: '#10B981', // Green
    [TICKET_STATUSES.CLOSED]: '#6B7280' // Gray
  };
  return colors[status] || '#6B7280';
};

/**
 * Get priority color
 */
const getPriorityColor = (priority) => {
  const colors = {
    [TICKET_PRIORITIES.LOW]: '#10B981', // Green
    [TICKET_PRIORITIES.MEDIUM]: '#F59E0B', // Orange
    [TICKET_PRIORITIES.HIGH]: '#EF4444', // Red
    [TICKET_PRIORITIES.URGENT]: '#7C3AED' // Purple
  };
  return colors[priority] || '#6B7280';
};

/**
 * Generate ticket summary
 */
const generateTicketSummary = (ticket) => {
  return {
    id: ticket.id,
    subject: ticket.subject,
    category: ticket.category,
    priority: ticket.priority,
    status: ticket.status,
    statusColor: getStatusColor(ticket.status),
    priorityColor: getPriorityColor(ticket.priority),
    createdAt: ticket.createdAt,
    lastUpdated: ticket.updatedAt,
    messageCount: ticket.messages.length,
    hasAttachments: ticket.attachments?.length > 0,
    assignedTo: ticket.assignedTo,
    responseTime: calculateResponseTime(ticket),
    resolutionTime: calculateResolutionTime(ticket)
  };
};

// ============================================
// Default Data Initialization
// ============================================

// Support agents
const defaultAgents = [
  {
    id: 'agent_1',
    name: 'Sarah Johnson',
    email: 'sarah@speakflow.com',
    role: SUPPORT_AGENT_ROLES.SUPERVISOR,
    avatar: 'https://ui-avatars.com/api/?name=Sarah+Johnson&background=4F46E5&color=fff',
    status: 'online',
    skills: ['technical', 'billing', 'account'],
    languages: ['en', 'es'],
    timezone: 'America/New_York',
    createdAt: new Date().toISOString()
  },
  {
    id: 'agent_2',
    name: 'Mike Chen',
    email: 'mike@speakflow.com',
    role: SUPPORT_AGENT_ROLES.SENIOR_AGENT,
    avatar: 'https://ui-avatars.com/api/?name=Mike+Chen&background=10B981&color=fff',
    status: 'online',
    skills: ['technical', 'bug_report'],
    languages: ['en', 'zh'],
    timezone: 'America/Los_Angeles',
    createdAt: new Date().toISOString()
  },
  {
    id: 'agent_3',
    name: 'Emma Wilson',
    email: 'emma@speakflow.com',
    role: SUPPORT_AGENT_ROLES.AGENT,
    avatar: 'https://ui-avatars.com/api/?name=Emma+Wilson&background=8B5CF6&color=fff',
    status: 'away',
    skills: ['billing', 'account', 'general'],
    languages: ['en'],
    timezone: 'Europe/London',
    createdAt: new Date().toISOString()
  }
];

// Support templates (canned responses)
const defaultTemplates = [
  {
    id: 'template_1',
    name: 'Welcome Message',
    category: 'general',
    subject: 'Thank you for contacting SpeakFlow Support',
    body: `Hello {{customer_name}},

Thank you for contacting SpeakFlow Support. I'm {{agent_name}} and I'll be assisting you with your inquiry.

I've received your ticket and will review it shortly. In the meantime, please provide any additional information that might help me resolve your issue faster.

Best regards,
{{agent_name}}
SpeakFlow Support Team`,
    variables: ['customer_name', 'agent_name'],
    createdAt: new Date().toISOString()
  },
  {
    id: 'template_2',
    name: 'Password Reset Assistance',
    category: 'account',
    subject: 'Password Reset Assistance',
    body: `Hello {{customer_name}},

I understand you're having trouble resetting your password. Here are the steps to reset your password:

1. Go to the login page
2. Click on "Forgot Password"
3. Enter your email address
4. Check your inbox for the reset link
5. Follow the link to create a new password

If you're still having issues, please let me know and I'll escalate this to our technical team.

Best regards,
{{agent_name}}
SpeakFlow Support Team`,
    variables: ['customer_name', 'agent_name'],
    createdAt: new Date().toISOString()
  },
  {
    id: 'template_3',
    name: 'Billing Inquiry',
    category: 'billing',
    subject: 'Regarding Your Billing Question',
    body: `Hello {{customer_name}},

Thank you for reaching out about your billing concern. I've reviewed your account and here's what I found:

{{resolution_details}}

If you need further clarification or believe there's an error, please don't hesitate to reply to this message.

Best regards,
{{agent_name}}
SpeakFlow Support Team`,
    variables: ['customer_name', 'agent_name', 'resolution_details'],
    createdAt: new Date().toISOString()
  },
  {
    id: 'template_4',
    name: 'Issue Resolved',
    category: 'general',
    subject: 'Your Issue Has Been Resolved',
    body: `Hello {{customer_name}},

I'm writing to confirm that your issue has been resolved. The solution implemented was:

{{solution_details}}

If you experience any further problems or have additional questions, please don't hesitate to reopen this ticket or create a new one.

Thank you for your patience and understanding.

Best regards,
{{agent_name}}
SpeakFlow Support Team`,
    variables: ['customer_name', 'agent_name', 'solution_details'],
    createdAt: new Date().toISOString()
  }
];

// FAQ Categories
const defaultFaqCategories = [
  { id: 'getting_started', name: 'Getting Started', icon: '🚀', order: 1, description: 'Learn how to start using SpeakFlow' },
  { id: 'account_billing', name: 'Account & Billing', icon: '💳', order: 2, description: 'Manage your account and subscription' },
  { id: 'technical', name: 'Technical Issues', icon: '🔧', order: 3, description: 'Troubleshooting technical problems' },
  { id: 'features', name: 'Features & Usage', icon: '✨', order: 4, description: 'Learn about SpeakFlow features' },
  { id: 'privacy_security', name: 'Privacy & Security', icon: '🔒', order: 5, description: 'Privacy and security information' },
  { id: 'learning_tips', name: 'Learning Tips', icon: '💡', order: 6, description: 'Tips to improve your learning' }
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
      <div class="tip">
        <strong>💡 Tip:</strong> Make sure you have a working microphone for pronunciation exercises!
      </div>
    `,
    helpful: 1245,
    notHelpful: 67,
    views: 15234,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ['beginner', 'first-lesson', 'getting-started']
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ['pricing', 'subscription', 'premium']
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
    `,
    helpful: 987,
    notHelpful: 123,
    views: 12345,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ['microphone', 'audio', 'technical']
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ['cancel', 'subscription', 'billing']
  }
];

// Initialize default data
defaultAgents.forEach(agent => {
  supportAgents.set(agent.id, agent);
});

defaultTemplates.forEach(template => {
  supportTemplates.set(template.id, template);
});

defaultFaqCategories.forEach(category => {
  faqCategories.set(category.id, category);
});

defaultFaqArticles.forEach(article => {
  knowledgeBase.set(article.id, article);
  const category = faqCategories.get(article.categoryId);
  if (category) {
    if (!category.articles) category.articles = [];
    category.articles.push(article.id);
    faqCategories.set(article.categoryId, category);
  }
});

// Mock tickets
const mockTickets = [
  {
    id: 'ticket_001',
    ticketNumber: 'SPK-1001',
    userId: 'user_1',
    userEmail: 'john@example.com',
    userName: 'John Doe',
    subject: 'Cannot access premium features after upgrade',
    category: TICKET_CATEGORIES.TECHNICAL,
    priority: TICKET_PRIORITIES.HIGH,
    status: TICKET_STATUSES.IN_PROGRESS,
    messages: [
      {
        id: 'msg_001',
        senderId: 'user_1',
        senderName: 'John Doe',
        senderRole: 'user',
        message: 'I upgraded to Pro but still see limited features. I can only access 3 lessons per day.',
        attachments: [],
        createdAt: new Date('2024-03-20T10:00:00Z').toISOString(),
        isInternal: false
      },
      {
        id: 'msg_002',
        senderId: 'agent_1',
        senderName: 'Sarah Johnson',
        senderRole: 'agent',
        message: 'I can see your subscription is active. Could you try logging out and back in? Sometimes the system needs a refresh to update permissions.',
        attachments: [],
        createdAt: new Date('2024-03-20T10:30:00Z').toISOString(),
        isInternal: false
      },
      {
        id: 'msg_003',
        senderId: 'user_1',
        senderName: 'John Doe',
        senderRole: 'user',
        message: 'That worked! Thank you for your help!',
        attachments: [],
        createdAt: new Date('2024-03-20T11:00:00Z').toISOString(),
        isInternal: false
      }
    ],
    attachments: [],
    createdAt: new Date('2024-03-20T10:00:00Z').toISOString(),
    updatedAt: new Date('2024-03-20T11:00:00Z').toISOString(),
    assignedTo: 'agent_1',
    tags: ['premium', 'access', 'subscription']
  },
  {
    id: 'ticket_002',
    ticketNumber: 'SPK-1002',
    userId: 'user_2',
    userEmail: 'jane@example.com',
    userName: 'Jane Smith',
    subject: 'Double charge on my credit card',
    category: TICKET_CATEGORIES.BILLING,
    priority: TICKET_PRIORITIES.URGENT,
    status: TICKET_STATUSES.OPEN,
    messages: [
      {
        id: 'msg_004',
        senderId: 'user_2',
        senderName: 'Jane Smith',
        senderRole: 'user',
        message: 'I was charged twice this month for my Pro subscription. Can you please refund one of the charges?',
        attachments: [{ name: 'screenshot.png', url: 'https://example.com/screenshot.png', size: 1024 }],
        createdAt: new Date('2024-03-21T14:00:00Z').toISOString(),
        isInternal: false
      }
    ],
    attachments: [{ name: 'screenshot.png', url: 'https://example.com/screenshot.png', size: 1024 }],
    createdAt: new Date('2024-03-21T14:00:00Z').toISOString(),
    updatedAt: new Date('2024-03-21T14:00:00Z').toISOString(),
    assignedTo: null,
    tags: ['billing', 'refund', 'double-charge']
  }
];

mockTickets.forEach(ticket => {
  tickets.set(ticket.id, ticket);
});

// ============================================
// User Ticket Controller Methods
// ============================================

/**
 * Get user's tickets
 * GET /api/support/tickets
 */
exports.getUserTickets = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, page = 1, limit = 20 } = req.query;
    
    let userTickets = Array.from(tickets.values()).filter(t => t.userId === userId);
    
    if (status) {
      userTickets = userTickets.filter(t => t.status === status);
    }
    
    // Sort by newest first
    userTickets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Pagination
    const startIndex = (page - 1) * limit;
    const paginatedTickets = userTickets.slice(startIndex, startIndex + limit);
    
    res.json({
      success: true,
      data: {
        tickets: paginatedTickets.map(t => generateTicketSummary(t)),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: userTickets.length,
          pages: Math.ceil(userTickets.length / limit)
        },
        summary: {
          open: userTickets.filter(t => t.status === TICKET_STATUSES.OPEN).length,
          inProgress: userTickets.filter(t => t.status === TICKET_STATUSES.IN_PROGRESS).length,
          resolved: userTickets.filter(t => t.status === TICKET_STATUSES.RESOLVED).length,
          closed: userTickets.filter(t => t.status === TICKET_STATUSES.CLOSED).length
        }
      }
    });
    
  } catch (error) {
    console.error('Get user tickets error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve tickets',
      code: 'TICKETS_FAILED'
    });
  }
};

/**
 * Get ticket details
 * GET /api/support/tickets/:ticketId
 */
exports.getTicketDetails = async (req, res) => {
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
    
    // Get agent info if assigned
    let agentInfo = null;
    if (ticket.assignedTo) {
      const agent = getSupportAgent(ticket.assignedTo);
      if (agent) {
        agentInfo = {
          id: agent.id,
          name: agent.name,
          avatar: agent.avatar
        };
      }
    }
    
    res.json({
      success: true,
      data: {
        ...ticket,
        agentInfo,
        responseTime: calculateResponseTime(ticket),
        resolutionTime: calculateResolutionTime(ticket)
      }
    });
    
  } catch (error) {
    console.error('Get ticket details error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve ticket details',
      code: 'TICKET_DETAILS_FAILED'
    });
  }
};

/**
 * Create new ticket
 * POST /api/support/tickets
 */
exports.createTicket = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }
    
    const { subject, category, priority = TICKET_PRIORITIES.MEDIUM, message, attachments = [] } = req.body;
    const userId = req.user.id;
    const user = await getUserById(userId);
    
    const ticketId = generateId('ticket');
    const ticketNumber = `SPK-${Math.floor(Math.random() * 10000)}`;
    
    const ticket = {
      id: ticketId,
      ticketNumber,
      userId,
      userEmail: user.email,
      userName: user.name,
      subject,
      category,
      priority,
      status: TICKET_STATUSES.OPEN,
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
      attachments,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      assignedTo: null,
      tags: []
    };
    
    tickets.set(ticketId, ticket);
    trackSupportAnalytics('ticket_created');
    
    // Notify support team
    await sendSupportNotification(
      'support@speakflow.com',
      `New Support Ticket: ${ticketNumber} - ${subject}`,
      `A new ticket has been created by ${user.name} (${user.email})\n\nPriority: ${priority}\nCategory: ${category}\n\nMessage: ${message}`
    );
    
    res.status(201).json({
      success: true,
      message: 'Ticket created successfully',
      data: ticket
    });
    
  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create ticket',
      code: 'CREATE_TICKET_FAILED'
    });
  }
};

/**
 * Add message to ticket
 * POST /api/support/tickets/:ticketId/messages
 */
exports.addTicketMessage = async (req, res) => {
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
    const userName = req.user.name || (userRole === 'user' ? 'User' : req.user.name || 'Support Agent');
    
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
        error: 'Cannot add internal notes as user',
        code: 'INTERNAL_NOTES_DENIED'
      });
    }
    
    const newMessage = {
      id: generateId('msg'),
      senderId: userId,
      senderName: userName,
      senderRole: userRole === 'user' ? 'user' : 'agent',
      message,
      attachments,
      createdAt: new Date().toISOString(),
      isInternal
    };
    
    ticket.messages.push(newMessage);
    ticket.updatedAt = new Date().toISOString();
    
    // Update status if user replied to resolved/closed ticket
    if (userRole === 'user' && (ticket.status === TICKET_STATUSES.RESOLVED || ticket.status === TICKET_STATUSES.CLOSED)) {
      ticket.status = TICKET_STATUSES.OPEN;
    }
    
    // If support replied, mark as in_progress
    if (userRole !== 'user' && ticket.status === TICKET_STATUSES.OPEN) {
      ticket.status = TICKET_STATUSES.IN_PROGRESS;
    }
    
    tickets.set(ticketId, ticket);
    
    // Calculate and track response time for first response
    if (userRole !== 'user' && ticket.messages.filter(m => m.senderRole !== 'user').length === 1) {
      const responseTime = calculateResponseTime(ticket);
      if (responseTime) {
        trackSupportAnalytics('response_time', { responseTime });
      }
    }
    
    // Send notification to other party
    if (userRole === 'user') {
      await sendSupportNotification(
        'support@speakflow.com',
        `New Reply on Ticket ${ticket.ticketNumber}`,
        `${userName} replied: ${message.substring(0, 200)}`
      );
    } else {
      await sendSupportNotification(
        ticket.userEmail,
        `New Update on Your Support Ticket #${ticket.ticketNumber}`,
        `Support team replied: ${message.substring(0, 200)}`
      );
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
      error: 'Failed to add message',
      code: 'ADD_MESSAGE_FAILED'
    });
  }
};

/**
 * Close ticket
 * PUT /api/support/tickets/:ticketId/close
 */
exports.closeTicket = async (req, res) => {
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
    
    ticket.status = TICKET_STATUSES.CLOSED;
    ticket.closedAt = new Date().toISOString();
    ticket.closedBy = userId;
    ticket.updatedAt = new Date().toISOString();
    
    tickets.set(ticketId, ticket);
    
    res.json({
      success: true,
      message: 'Ticket closed successfully',
      data: { ticketId, status: ticket.status }
    });
    
  } catch (error) {
    console.error('Close ticket error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to close ticket',
      code: 'CLOSE_TICKET_FAILED'
    });
  }
};

/**
 * Reopen ticket
 * PUT /api/support/tickets/:ticketId/reopen
 */
exports.reopenTicket = async (req, res) => {
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
    
    if (ticket.status !== TICKET_STATUSES.CLOSED && ticket.status !== TICKET_STATUSES.RESOLVED) {
      return res.status(400).json({
        success: false,
        error: 'Only closed or resolved tickets can be reopened',
        code: 'CANNOT_REOPEN'
      });
    }
    
    ticket.status = TICKET_STATUSES.OPEN;
    ticket.reopenedAt = new Date().toISOString();
    ticket.reopenedBy = userId;
    ticket.updatedAt = new Date().toISOString();
    
    tickets.set(ticketId, ticket);
    
    res.json({
      success: true,
      message: 'Ticket reopened successfully',
      data: { ticketId, status: ticket.status }
    });
    
  } catch (error) {
    console.error('Reopen ticket error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reopen ticket',
      code: 'REOPEN_TICKET_FAILED'
    });
  }
};

/**
 * Submit ticket satisfaction rating
 * POST /api/support/tickets/:ticketId/satisfaction
 */
exports.submitSatisfaction = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { rating, feedback } = req.body;
    const userId = req.user.id;
    
    const ticket = tickets.get(ticketId);
    
    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: 'Ticket not found',
        code: 'TICKET_NOT_FOUND'
      });
    }
    
    if (ticket.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        code: 'ACCESS_DENIED'
      });
    }
    
    if (ticket.status !== TICKET_STATUSES.RESOLVED && ticket.status !== TICKET_STATUSES.CLOSED) {
      return res.status(400).json({
        success: false,
        error: 'Satisfaction can only be submitted for resolved or closed tickets',
        code: 'INVALID_STATUS'
      });
    }
    
    ticket.satisfaction = {
      rating,
      feedback,
      submittedAt: new Date().toISOString()
    };
    
    tickets.set(ticketId, ticket);
    trackSupportAnalytics('satisfaction', { score: rating });
    
    res.json({
      success: true,
      message: 'Thank you for your feedback!',
      data: ticket.satisfaction
    });
    
  } catch (error) {
    console.error('Submit satisfaction error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit satisfaction rating',
      code: 'SATISFACTION_FAILED'
    });
  }
};

// ============================================
// Knowledge Base Controller Methods
// ============================================

/**
 * Get FAQ categories
 * GET /api/support/faq/categories
 */
exports.getFaqCategories = async (req, res) => {
  try {
    const categories = Array.from(faqCategories.values())
      .sort((a, b) => a.order - b.order)
      .map(cat => ({
        id: cat.id,
        name: cat.name,
        icon: cat.icon,
        description: cat.description,
        articleCount: cat.articles?.length || 0
      }));
    
    res.json({
      success: true,
      data: categories
    });
    
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve categories',
      code: 'CATEGORIES_FAILED'
    });
  }
};

/**
 * Get FAQ articles
 * GET /api/support/faq/articles
 */
exports.getFaqArticles = async (req, res) => {
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
        a.content.toLowerCase().includes(searchLower) ||
        a.tags?.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }
    
    // Sort by helpfulness and views
    articles.sort((a, b) => {
      const aHelpful = a.helpful / (a.helpful + a.notHelpful + 1);
      const bHelpful = b.helpful / (b.helpful + b.notHelpful + 1);
      return bHelpful - aHelpful;
    });
    
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
        helpfulness: a.helpful / (a.helpful + a.notHelpful + 1) * 100,
        tags: a.tags,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt
      }))
    });
    
  } catch (error) {
    console.error('Get articles error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve articles',
      code: 'ARTICLES_FAILED'
    });
  }
};

/**
 * Get FAQ article details
 * GET /api/support/faq/articles/:articleId
 */
exports.getFaqArticle = async (req, res) => {
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
    
    // Get category info
    const category = faqCategories.get(article.categoryId);
    
    // Get related articles
    const relatedArticles = Array.from(knowledgeBase.values())
      .filter(a => a.categoryId === article.categoryId && a.id !== articleId)
      .slice(0, 5)
      .map(a => ({
        id: a.id,
        title: a.title,
        helpfulness: a.helpful / (a.helpful + a.notHelpful + 1) * 100
      }));
    
    res.json({
      success: true,
      data: {
        ...article,
        categoryName: category?.name,
        categoryIcon: category?.icon,
        relatedArticles
      }
    });
    
  } catch (error) {
    console.error('Get article error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve article',
      code: 'ARTICLE_FAILED'
    });
  }
};

/**
 * Submit feedback on article
 * POST /api/support/faq/articles/:articleId/feedback
 */
exports.submitArticleFeedback = async (req, res) => {
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
      error: 'Failed to submit feedback',
      code: 'FEEDBACK_FAILED'
    });
  }
};

/**
 * Search FAQ
 * GET /api/support/faq/search
 */
exports.searchFaq = async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;
    
    if (!q || q.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Search query must be at least 2 characters',
        code: 'INVALID_QUERY'
      });
    }
    
    const searchLower = q.toLowerCase();
    const articles = Array.from(knowledgeBase.values());
    
    // Search in title, content, and tags
    const results = articles
      .filter(a => {
        const titleMatch = a.title.toLowerCase().includes(searchLower);
        const contentMatch = a.content.toLowerCase().includes(searchLower);
        const tagMatch = a.tags?.some(tag => tag.toLowerCase().includes(searchLower));
        return titleMatch || contentMatch || tagMatch;
      })
      .map(a => ({
        id: a.id,
        title: a.title,
        categoryId: a.categoryId,
        excerpt: a.content.substring(0, 200).replace(/<[^>]*>/g, '') + '...',
        relevance: calculateRelevance(a, searchLower),
        helpfulness: a.helpful / (a.helpful + a.notHelpful + 1) * 100
      }))
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit);
    
    res.json({
      success: true,
      data: {
        query: q,
        total: results.length,
        results
      }
    });
    
  } catch (error) {
    console.error('Search FAQ error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search FAQ',
      code: 'SEARCH_FAILED'
    });
  }
};

/**
 * Calculate search relevance
 */
const calculateRelevance = (article, searchTerm) => {
  let score = 0;
  const titleLower = article.title.toLowerCase();
  const contentLower = article.content.toLowerCase();
  
  if (titleLower === searchTerm) score += 100;
  else if (titleLower.includes(searchTerm)) score += 50;
  
  if (contentLower.includes(searchTerm)) {
    const occurrences = (contentLower.match(new RegExp(searchTerm, 'g')) || []).length;
    score += Math.min(occurrences * 10, 50);
  }
  
  if (article.tags?.some(tag => tag.toLowerCase().includes(searchTerm))) {
    score += 30;
  }
  
  return Math.min(score, 100);
};

// ============================================
// Support Agent Controller Methods (Admin)
// ============================================

/**
 * Get all tickets (agent view)
 * GET /api/support/admin/tickets
 */
exports.adminGetTickets = async (req, res) => {
  try {
    const { status, priority, assignedTo, search, page = 1, limit = 50 } = req.query;
    
    let allTickets = Array.from(tickets.values());
    
    if (status) {
      allTickets = allTickets.filter(t => t.status === status);
    }
    if (priority) {
      allTickets = allTickets.filter(t => t.priority === priority);
    }
    if (assignedTo) {
      if (assignedTo === 'unassigned') {
        allTickets = allTickets.filter(t => !t.assignedTo);
      } else {
        allTickets = allTickets.filter(t => t.assignedTo === assignedTo);
      }
    }
    if (search) {
      const searchLower = search.toLowerCase();
      allTickets = allTickets.filter(t => 
        t.ticketNumber?.toLowerCase().includes(searchLower) ||
        t.subject?.toLowerCase().includes(searchLower) ||
        t.userName?.toLowerCase().includes(searchLower) ||
        t.userEmail?.toLowerCase().includes(searchLower)
      );
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
    
    // Add stats to each ticket
    const ticketsWithStats = paginatedTickets.map(t => ({
      ...generateTicketSummary(t),
      userEmail: t.userEmail,
      userName: t.userName,
      lastMessage: t.messages[t.messages.length - 1]?.message.substring(0, 100),
      lastMessageAt: t.messages[t.messages.length - 1]?.createdAt,
      hasUnread: t.messages.some(m => m.senderRole === 'user' && !m.isRead)
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
          open: allTickets.filter(t => t.status === TICKET_STATUSES.OPEN).length,
          inProgress: allTickets.filter(t => t.status === TICKET_STATUSES.IN_PROGRESS).length,
          waiting: allTickets.filter(t => t.status === TICKET_STATUSES.WAITING).length,
          resolved: allTickets.filter(t => t.status === TICKET_STATUSES.RESOLVED).length,
          closed: allTickets.filter(t => t.status === TICKET_STATUSES.CLOSED).length,
          unassigned: allTickets.filter(t => !t.assignedTo).length
        }
      }
    });
    
  } catch (error) {
    console.error('Admin get tickets error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve tickets',
      code: 'ADMIN_TICKETS_FAILED'
    });
  }
};

/**
 * Update ticket status (agent)
 * PUT /api/support/admin/tickets/:ticketId/status
 */
exports.adminUpdateTicketStatus = async (req, res) => {
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
        senderRole: 'agent',
        message: `[System] Status changed from ${oldStatus} to ${status}. Note: ${note}`,
        attachments: [],
        createdAt: new Date().toISOString(),
        isInternal: true
      });
    }
    
    if (status === TICKET_STATUSES.RESOLVED && oldStatus !== TICKET_STATUSES.RESOLVED) {
      ticket.resolvedAt = new Date().toISOString();
      ticket.resolvedBy = req.user.id;
      trackSupportAnalytics('ticket_resolved');
      
      // Notify user
      await sendSupportNotification(
        ticket.userEmail,
        `Your Support Ticket #${ticket.ticketNumber} Has Been Resolved`,
        `Your ticket has been marked as resolved. If you still need help, please reply to reopen.`
      );
    }
    
    tickets.set(ticketId, ticket);
    
    res.json({
      success: true,
      message: 'Ticket status updated',
      data: { ticketId, status: ticket.status }
    });
    
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update ticket status',
      code: 'UPDATE_STATUS_FAILED'
    });
  }
};

/**
 * Assign ticket to agent
 * PUT /api/support/admin/tickets/:ticketId/assign
 */
exports.adminAssignTicket = async (req, res) => {
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
    
    const agent = getSupportAgent(agentId);
    if (agentId && !agent) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found',
        code: 'AGENT_NOT_FOUND'
      });
    }
    
    ticket.assignedTo = agentId || null;
    ticket.assignedAt = agentId ? new Date().toISOString() : null;
    ticket.updatedAt = new Date().toISOString();
    
    tickets.set(ticketId, ticket);
    
    res.json({
      success: true,
      message: agentId ? `Ticket assigned to ${agent?.name || agentId}` : 'Ticket unassigned',
      data: { ticketId, assignedTo: ticket.assignedTo }
    });
    
  } catch (error) {
    console.error('Assign ticket error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to assign ticket',
      code: 'ASSIGN_TICKET_FAILED'
    });
  }
};

/**
 * Get support analytics (admin)
 * GET /api/support/admin/analytics
 */
exports.adminGetAnalytics = async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    const allTickets = Array.from(tickets.values());
    
    // Calculate metrics
    const totalTickets = allTickets.length;
    const openTickets = allTickets.filter(t => t.status === TICKET_STATUSES.OPEN).length;
    const inProgressTickets = allTickets.filter(t => t.status === TICKET_STATUSES.IN_PROGRESS).length;
    const resolvedTickets = allTickets.filter(t => t.status === TICKET_STATUSES.RESOLVED || t.status === TICKET_STATUSES.CLOSED).length;
    const resolutionRate = totalTickets > 0 ? (resolvedTickets / totalTickets) * 100 : 0;
    
    // Average response time
    const responseTimes = allTickets.map(t => calculateResponseTime(t)).filter(rt => rt !== null);
    const avgResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
      : 0;
    
    // Average resolution time
    const resolutionTimes = allTickets.map(t => calculateResolutionTime(t)).filter(rt => rt !== null);
    const avgResolutionTime = resolutionTimes.length > 0 
      ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length 
      : 0;
    
    // Tickets by category
    const ticketsByCategory = {};
    allTickets.forEach(t => {
      ticketsByCategory[t.category] = (ticketsByCategory[t.category] || 0) + 1;
    });
    
    // Tickets by priority
    const ticketsByPriority = {};
    allTickets.forEach(t => {
      ticketsByPriority[t.priority] = (ticketsByPriority[t.priority] || 0) + 1;
    });
    
    // Daily analytics for the period
    const dailyAnalytics = Array.from(supportAnalytics.values()).slice(-30);
    
    // Agent performance
    const agentPerformance = {};
    for (const agent of supportAgents.values()) {
      const assignedTickets = allTickets.filter(t => t.assignedTo === agent.id);
      const resolvedByAgent = assignedTickets.filter(t => t.resolvedBy === agent.id);
      agentPerformance[agent.id] = {
        name: agent.name,
        assigned: assignedTickets.length,
        resolved: resolvedByAgent.length,
        avgResponseTime: calculateAgentAvgResponseTime(assignedTickets),
        avgResolutionTime: calculateAgentAvgResolutionTime(resolvedByAgent)
      };
    }
    
    // Satisfaction score
    const satisfactionRatings = allTickets.filter(t => t.satisfaction).map(t => t.satisfaction.rating);
    const avgSatisfaction = satisfactionRatings.length > 0 
      ? satisfactionRatings.reduce((a, b) => a + b, 0) / satisfactionRatings.length 
      : 0;
    
    res.json({
      success: true,
      data: {
        overview: {
          totalTickets,
          openTickets,
          inProgressTickets,
          resolvedTickets,
          resolutionRate: Math.round(resolutionRate * 100) / 100,
          avgResponseTime: Math.round(avgResponseTime),
          avgResolutionTime: Math.round(avgResolutionTime * 100) / 100,
          avgSatisfaction: Math.round(avgSatisfaction * 100) / 100
        },
        ticketsByCategory,
        ticketsByPriority,
        dailyAnalytics,
        agentPerformance,
        recentTickets: allTickets.slice(-10).map(t => generateTicketSummary(t))
      }
    });
    
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve analytics',
      code: 'ANALYTICS_FAILED'
    });
  }
};

/**
 * Calculate agent average response time
 */
const calculateAgentAvgResponseTime = (tickets) => {
  const responseTimes = tickets.map(t => calculateResponseTime(t)).filter(rt => rt !== null);
  if (responseTimes.length === 0) return 0;
  return Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length);
};

/**
 * Calculate agent average resolution time
 */
const calculateAgentAvgResolutionTime = (tickets) => {
  const resolutionTimes = tickets.map(t => calculateResolutionTime(t)).filter(rt => rt !== null);
  if (resolutionTimes.length === 0) return 0;
  return Math.round(resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length * 100) / 100;
};

/**
 * Get support templates
 * GET /api/support/admin/templates
 */
exports.adminGetTemplates = async (req, res) => {
  try {
    const { category } = req.query;
    
    let templates = Array.from(supportTemplates.values());
    
    if (category) {
      templates = templates.filter(t => t.category === category);
    }
    
    res.json({
      success: true,
      data: templates
    });
    
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve templates',
      code: 'TEMPLATES_FAILED'
    });
  }
};

/**
 * Create support template
 * POST /api/support/admin/templates
 */
exports.adminCreateTemplate = async (req, res) => {
  try {
    const { name, category, subject, body, variables } = req.body;
    
    const templateId = generateId('template');
    const template = {
      id: templateId,
      name,
      category: category || 'general',
      subject: subject || '',
      body,
      variables: variables || [],
      createdAt: new Date().toISOString(),
      createdBy: req.user.id
    };
    
    supportTemplates.set(templateId, template);
    
    res.status(201).json({
      success: true,
      message: 'Template created successfully',
      data: template
    });
    
  } catch (error) {
    console.error('Create template error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create template',
      code: 'CREATE_TEMPLATE_FAILED'
    });
  }
};

/**
 * Update support template
 * PUT /api/support/admin/templates/:templateId
 */
exports.adminUpdateTemplate = async (req, res) => {
  try {
    const { templateId } = req.params;
    const updates = req.body;
    
    const template = supportTemplates.get(templateId);
    
    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found',
        code: 'TEMPLATE_NOT_FOUND'
      });
    }
    
    const updatedTemplate = {
      ...template,
      ...updates,
      updatedAt: new Date().toISOString(),
      updatedBy: req.user.id
    };
    
    supportTemplates.set(templateId, updatedTemplate);
    
    res.json({
      success: true,
      message: 'Template updated successfully',
      data: updatedTemplate
    });
    
  } catch (error) {
    console.error('Update template error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update template',
      code: 'UPDATE_TEMPLATE_FAILED'
    });
  }
};

/**
 * Delete support template
 * DELETE /api/support/admin/templates/:templateId
 */
exports.adminDeleteTemplate = async (req, res) => {
  try {
    const { templateId } = req.params;
    
    const template = supportTemplates.get(templateId);
    
    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found',
        code: 'TEMPLATE_NOT_FOUND'
      });
    }
    
    supportTemplates.delete(templateId);
    
    res.json({
      success: true,
      message: 'Template deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete template error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete template',
      code: 'DELETE_TEMPLATE_FAILED'
    });
  }
};

// ============================================
// Live Chat Controller Methods
// ============================================

/**
 * Start live chat session
 * POST /api/support/chat/start
 */
exports.startChatSession = async (req, res) => {
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
    
    // Find available agent
    const availableAgent = Array.from(supportAgents.values()).find(a => a.status === 'online');
    
    const sessionId = generateId('chat');
    const session = {
      id: sessionId,
      userId,
      userName: user.name,
      userEmail: user.email,
      status: availableAgent ? 'active' : 'waiting',
      messages: [],
      startedAt: new Date().toISOString(),
      assignedTo: availableAgent?.id || null,
      endedAt: null
    };
    
    chatSessions.set(sessionId, session);
    
    // Add system message
    session.messages.push({
      id: generateId('chat_msg'),
      senderId: 'system',
      senderName: 'System',
      message: availableAgent 
        ? `Connected to support agent ${availableAgent.name}. How can we help you today?`
        : 'All agents are currently busy. Please wait... You will be connected shortly.',
      timestamp: new Date().toISOString(),
      type: 'system'
    });
    
    res.json({
      success: true,
      data: session
    });
    
  } catch (error) {
    console.error('Start chat error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start chat session',
      code: 'START_CHAT_FAILED'
    });
  }
};

/**
 * Send chat message
 * POST /api/support/chat/:sessionId/message
 */
exports.sendChatMessage = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { message } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;
    
    const session = chatSessions.get(sessionId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Chat session not found',
        code: 'CHAT_NOT_FOUND'
      });
    }
    
    if (session.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: 'Chat session is not active',
        code: 'CHAT_INACTIVE'
      });
    }
    
    const newMessage = {
      id: generateId('chat_msg'),
      senderId: userId,
      senderName: userRole === 'user' ? session.userName : req.user.name || 'Support Agent',
      senderRole: userRole === 'user' ? 'user' : 'agent',
      message,
      timestamp: new Date().toISOString(),
      type: 'message'
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
      error: 'Failed to send message',
      code: 'SEND_MESSAGE_FAILED'
    });
  }
};

/**
 * End chat session
 * PUT /api/support/chat/:sessionId/end
 */
exports.endChatSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const session = chatSessions.get(sessionId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Chat session not found',
        code: 'CHAT_NOT_FOUND'
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
      error: 'Failed to end chat session',
      code: 'END_CHAT_FAILED'
    });
  }
};

// ============================================
// Export all methods
// ============================================

module.exports = exports;
