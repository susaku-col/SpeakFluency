// ============================================
// Support Ticket Model
// SpeakFlow - AI Language Learning Platform
// ============================================

const mongoose = require('mongoose');

// ============================================
// Constants & Enums
// ============================================

const TICKET_STATUSES = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  WAITING: 'waiting',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
  ESCALATED: 'escalated'
};

const TICKET_PRIORITIES = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent',
  CRITICAL: 'critical'
};

const TICKET_CATEGORIES = {
  TECHNICAL: 'technical',
  BILLING: 'billing',
  ACCOUNT: 'account',
  FEATURE_REQUEST: 'feature_request',
  BUG_REPORT: 'bug_report',
  GENERAL: 'general',
  OTHER: 'other',
  PRIVACY: 'privacy',
  SECURITY: 'security',
  FEEDBACK: 'feedback'
};

const TICKET_SOURCES = {
  WEB: 'web',
  EMAIL: 'email',
  IN_APP: 'in_app',
  CHAT: 'chat',
  API: 'api',
  SOCIAL: 'social'
};

const ESCALATION_LEVELS = {
  LEVEL_1: 'level_1', // Standard agent
  LEVEL_2: 'level_2', // Senior agent
  LEVEL_3: 'level_3', // Technical specialist
  LEVEL_4: 'level_4'  // Management
};

// ============================================
// Sub-Schemas
// ============================================

/**
 * Message Schema
 */
const messageSchema = new mongoose.Schema({
  messageId: {
    type: String,
    required: true,
    unique: true
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  senderName: {
    type: String,
    required: true
  },
  senderRole: {
    type: String,
    enum: ['user', 'agent', 'system', 'admin'],
    default: 'user'
  },
  message: {
    type: String,
    required: true,
    maxlength: 10000
  },
  attachments: [{
    id: String,
    name: String,
    url: String,
    type: String,
    size: Number,
    uploadedAt: { type: Date, default: Date.now }
  }],
  isInternal: {
    type: Boolean,
    default: false // Internal notes only visible to agents
  },
  isSystemMessage: {
    type: Boolean,
    default: false
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  readBy: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    readAt: { type: Date, default: Date.now }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

/**
 * Attachment Schema
 */
const attachmentSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  url: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['image', 'video', 'audio', 'document', 'other']
  },
  mimeType: String,
  size: {
    type: Number,
    default: 0
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

/**
 * Ticket Assignment Schema
 */
const assignmentSchema = new mongoose.Schema({
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  agentName: String,
  agentEmail: String,
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  assignedAt: {
    type: Date,
    default: Date.now
  },
  assignedUntil: Date,
  isActive: {
    type: Boolean,
    default: true
  },
  notes: String
}, { _id: false });

/**
 * Escalation Schema
 */
const escalationSchema = new mongoose.Schema({
  level: {
    type: String,
    enum: Object.values(ESCALATION_LEVELS),
    required: true
  },
  reason: {
    type: String,
    required: true
  },
  escalatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  escalatedAt: {
    type: Date,
    default: Date.now
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  resolvedAt: Date,
  notes: String
}, { _id: false });

/**
 * Satisfaction Survey Schema
 */
const satisfactionSchema = new mongoose.Schema({
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  feedback: {
    type: String,
    maxlength: 1000
  },
  categories: {
    responseTime: { type: Number, min: 1, max: 5 },
    resolutionQuality: { type: Number, min: 1, max: 5 },
    agentProfessionalism: { type: Number, min: 1, max: 5 }
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { _id: false });

/**
 * SLA Schema
 */
const slaSchema = new mongoose.Schema({
  priority: {
    type: String,
    enum: Object.values(TICKET_PRIORITIES),
    required: true
  },
  firstResponseTime: {
    type: Number, // in hours
    default: 24
  },
  resolutionTime: {
    type: Number, // in hours
    default: 72
  },
  actualFirstResponseTime: Number,
  actualResolutionTime: Number,
  breached: {
    firstResponse: { type: Boolean, default: false },
    resolution: { type: Boolean, default: false }
  },
  breachedAt: Date,
  breachReason: String
}, { _id: false });

/**
 * Ticket Metrics Schema
 */
const ticketMetricsSchema = new mongoose.Schema({
  timeToFirstResponse: {
    type: Number, // in minutes
    default: null
  },
  timeToResolution: {
    type: Number, // in minutes
    default: null
  },
  totalAgentResponses: {
    type: Number,
    default: 0
  },
  totalUserResponses: {
    type: Number,
    default: 0
  },
  averageResponseTime: {
    type: Number, // in minutes
    default: 0
  },
  messageCount: {
    type: Number,
    default: 0
  },
  reopenedCount: {
    type: Number,
    default: 0
  },
  escalations: {
    type: Number,
    default: 0
  }
}, { _id: false });

/**
 * Tag Schema
 */
const tagSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  addedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

// ============================================
// Main Support Ticket Schema
// ============================================

const supportTicketSchema = new mongoose.Schema({
  // Identification
  ticketId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  ticketNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // User Information
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  userEmail: {
    type: String,
    required: true,
    index: true
  },
  userName: {
    type: String,
    required: true
  },
  userRole: {
    type: String,
    default: 'user'
  },
  
  // Ticket Details
  subject: {
    type: String,
    required: true,
    maxlength: 200,
    index: true
  },
  description: {
    type: String,
    maxlength: 5000
  },
  category: {
    type: String,
    enum: Object.values(TICKET_CATEGORIES),
    required: true,
    index: true
  },
  priority: {
    type: String,
    enum: Object.values(TICKET_PRIORITIES),
    default: TICKET_PRIORITIES.MEDIUM,
    index: true
  },
  status: {
    type: String,
    enum: Object.values(TICKET_STATUSES),
    default: TICKET_STATUSES.OPEN,
    index: true
  },
  source: {
    type: String,
    enum: Object.values(TICKET_SOURCES),
    default: TICKET_SOURCES.WEB
  },
  
  // Messages
  messages: [messageSchema],
  
  // Attachments
  attachments: [attachmentSchema],
  
  // Assignment
  assignment: assignmentSchema,
  
  // Escalation
  escalations: [escalationSchema],
  currentEscalationLevel: {
    type: String,
    enum: Object.values(ESCALATION_LEVELS)
  },
  
  // Satisfaction
  satisfaction: satisfactionSchema,
  
  // SLA
  sla: slaSchema,
  
  // Metrics
  metrics: {
    type: ticketMetricsSchema,
    default: () => ({})
  },
  
  // Tags
  tags: [tagSchema],
  
  // Related Tickets
  relatedTickets: [{
    ticketId: { type: String, ref: 'SupportTicket' },
    relation: {
      type: String,
      enum: ['duplicate', 'related', 'merged', 'parent', 'child']
    }
  }],
  
  // System Information
  systemInfo: {
    browser: String,
    browserVersion: String,
    os: String,
    osVersion: String,
    device: String,
    appVersion: String,
    logs: String,
    screenshots: [String]
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  firstResponseAt: Date,
  resolvedAt: Date,
  closedAt: Date,
  lastActivityAt: {
    type: Date,
    default: Date.now
  },
  
  // Metadata
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: new Map()
  },
  
  // Internal Notes
  internalNotes: [{
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    content: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ============================================
// Virtual Fields
// ============================================

// Is active ticket (not resolved or closed)
supportTicketSchema.virtual('isActive').get(function() {
  return this.status !== TICKET_STATUSES.RESOLVED && 
         this.status !== TICKET_STATUSES.CLOSED;
});

// Is escalated
supportTicketSchema.virtual('isEscalated').get(function() {
  return this.escalations.length > 0 && 
         this.status !== TICKET_STATUSES.RESOLVED;
});

// Is assigned
supportTicketSchema.virtual('isAssigned').get(function() {
  return this.assignment && this.assignment.isActive && this.assignment.agentId;
});

// Age in hours
supportTicketSchema.virtual('ageHours').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60));
});

// Age in days
supportTicketSchema.virtual('ageDays').get(function() {
  return Math.floor(this.ageHours / 24);
});

// Has satisfaction rating
supportTicketSchema.virtual('hasSatisfaction').get(function() {
  return this.satisfaction && this.satisfaction.rating;
});

// Last message preview
supportTicketSchema.virtual('lastMessagePreview').get(function() {
  if (this.messages.length === 0) return null;
  const lastMessage = this.messages[this.messages.length - 1];
  return {
    message: lastMessage.message.substring(0, 100),
    sender: lastMessage.senderName,
    timestamp: lastMessage.createdAt
  };
});

// Unread count for user
supportTicketSchema.virtual('userUnreadCount').get(function() {
  return this.messages.filter(m => 
    m.senderRole !== 'user' && 
    !m.readBy.some(r => r.userId.toString() === this.userId?.toString())
  ).length;
});

// Unread count for agents
supportTicketSchema.virtual('agentUnreadCount').get(function() {
  return this.messages.filter(m => 
    m.senderRole === 'user' && 
    (!this.assignment?.agentId || !m.readBy.some(r => r.userId.toString() === this.assignment.agentId.toString()))
  ).length;
});

// ============================================
// Instance Methods
// ============================================

/**
 * Generate ticket number
 */
supportTicketSchema.methods.generateTicketNumber = function() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const sequence = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `SPK-${year}${month}-${sequence}`;
};

/**
 * Add message to ticket
 */
supportTicketSchema.methods.addMessage = async function(senderId, senderName, senderRole, message, attachments = [], isInternal = false) {
  const messageObj = {
    messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    senderId,
    senderName,
    senderRole,
    message,
    attachments,
    isInternal,
    createdAt: new Date(),
    updatedAt: new Date(),
    readBy: [{ userId: senderId, readAt: new Date() }]
  };
  
  this.messages.push(messageObj);
  this.metrics.messageCount = this.messages.length;
  this.lastActivityAt = new Date();
  this.updatedAt = new Date();
  
  // Update metrics based on sender
  if (senderRole === 'agent') {
    this.metrics.totalAgentResponses++;
  } else if (senderRole === 'user') {
    this.metrics.totalUserResponses++;
  }
  
  // Calculate time to first response
  if (senderRole === 'agent' && !this.firstResponseAt && this.metrics.totalAgentResponses === 1) {
    this.firstResponseAt = new Date();
    this.metrics.timeToFirstResponse = Math.floor((this.firstResponseAt - this.createdAt) / (1000 * 60));
    
    // Update SLA
    if (this.sla && this.sla.firstResponseTime) {
      this.sla.actualFirstResponseTime = this.metrics.timeToFirstResponse / 60; // in hours
      if (this.sla.actualFirstResponseTime > this.sla.firstResponseTime) {
        this.sla.breached.firstResponse = true;
        this.sla.breachedAt = new Date();
        this.sla.breachReason = `First response SLA breached. Expected within ${this.sla.firstResponseTime} hours, took ${Math.round(this.sla.actualFirstResponseTime)} hours.`;
      }
    }
  }
  
  // Auto-resolve if user closes
  if (senderRole === 'user' && message.toLowerCase().includes('close') && this.status !== TICKET_STATUSES.RESOLVED) {
    await this.resolve();
  }
  
  return this.save();
};

/**
 * Assign ticket to agent
 */
supportTicketSchema.methods.assignTo = function(agentId, agentName, agentEmail, assignedBy, notes = '') {
  this.assignment = {
    agentId,
    agentName,
    agentEmail,
    assignedBy,
    assignedAt: new Date(),
    isActive: true,
    notes
  };
  
  if (this.status === TICKET_STATUSES.OPEN) {
    this.status = TICKET_STATUSES.IN_PROGRESS;
  }
  
  this.updatedAt = new Date();
  return this.save();
};

/**
 * Unassign ticket
 */
supportTicketSchema.methods.unassign = function(unassignedBy) {
  if (this.assignment) {
    this.assignment.isActive = false;
    this.assignment.assignedUntil = new Date();
  }
  
  if (this.status === TICKET_STATUSES.IN_PROGRESS) {
    this.status = TICKET_STATUSES.OPEN;
  }
  
  this.updatedAt = new Date();
  return this.save();
};

/**
 * Escalate ticket
 */
supportTicketSchema.methods.escalate = function(level, reason, escalatedBy) {
  const escalation = {
    level,
    reason,
    escalatedBy,
    escalatedAt: new Date()
  };
  
  this.escalations.push(escalation);
  this.currentEscalationLevel = level;
  this.status = TICKET_STATUSES.ESCALATED;
  this.metrics.escalations++;
  this.updatedAt = new Date();
  
  return this.save();
};

/**
 * Resolve ticket
 */
supportTicketSchema.methods.resolve = function(resolvedBy, resolution = '') {
  this.status = TICKET_STATUSES.RESOLVED;
  this.resolvedAt = new Date();
  this.updatedAt = new Date();
  
  // Calculate time to resolution
  this.metrics.timeToResolution = Math.floor((this.resolvedAt - this.createdAt) / (1000 * 60));
  
  // Update SLA
  if (this.sla && this.sla.resolutionTime) {
    this.sla.actualResolutionTime = this.metrics.timeToResolution / 60; // in hours
    if (this.sla.actualResolutionTime > this.sla.resolutionTime) {
      this.sla.breached.resolution = true;
      if (!this.sla.breachedAt) {
        this.sla.breachedAt = new Date();
        this.sla.breachReason = `Resolution SLA breached. Expected within ${this.sla.resolutionTime} hours, took ${Math.round(this.sla.actualResolutionTime)} hours.`;
      }
    }
  }
  
  // Add system message
  const systemMessage = {
    messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    senderId: resolvedBy,
    senderName: 'System',
    senderRole: 'system',
    message: resolution || 'Ticket has been marked as resolved.',
    isSystemMessage: true,
    createdAt: new Date()
  };
  this.messages.push(systemMessage);
  
  return this.save();
};

/**
 * Close ticket
 */
supportTicketSchema.methods.close = function(closedBy) {
  this.status = TICKET_STATUSES.CLOSED;
  this.closedAt = new Date();
  this.updatedAt = new Date();
  
  return this.save();
};

/**
 * Reopen ticket
 */
supportTicketSchema.methods.reopen = function(reopenedBy, reason = '') {
  if (this.status !== TICKET_STATUSES.CLOSED && this.status !== TICKET_STATUSES.RESOLVED) {
    throw new Error('Only closed or resolved tickets can be reopened');
  }
  
  this.status = TICKET_STATUSES.OPEN;
  this.metrics.reopenedCount++;
  this.updatedAt = new Date();
  this.closedAt = null;
  this.resolvedAt = null;
  
  // Add system message
  const systemMessage = {
    messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    senderId: reopenedBy,
    senderName: 'System',
    senderRole: 'system',
    message: reason || 'Ticket has been reopened.',
    isSystemMessage: true,
    createdAt: new Date()
  };
  this.messages.push(systemMessage);
  
  return this.save();
};

/**
 * Submit satisfaction survey
 */
supportTicketSchema.methods.submitSatisfaction = function(rating, feedback = '', categories = {}, submittedBy) {
  this.satisfaction = {
    rating,
    feedback,
    categories: {
      responseTime: categories.responseTime || rating,
      resolutionQuality: categories.resolutionQuality || rating,
      agentProfessionalism: categories.agentProfessionalism || rating
    },
    submittedAt: new Date(),
    submittedBy
  };
  
  return this.save();
};

/**
 * Add tag
 */
supportTicketSchema.methods.addTag = function(tagName, addedBy) {
  const existingTag = this.tags.find(t => t.name === tagName.toLowerCase());
  if (!existingTag) {
    this.tags.push({
      name: tagName.toLowerCase(),
      addedBy,
      addedAt: new Date()
    });
  }
  return this.save();
};

/**
 * Remove tag
 */
supportTicketSchema.methods.removeTag = function(tagName) {
  this.tags = this.tags.filter(t => t.name !== tagName.toLowerCase());
  return this.save();
};

/**
 * Mark message as read
 */
supportTicketSchema.methods.markMessageRead = function(messageId, userId) {
  const message = this.messages.find(m => m.messageId === messageId);
  if (message && !message.readBy.some(r => r.userId.toString() === userId.toString())) {
    message.readBy.push({ userId, readAt: new Date() });
  }
  return this.save();
};

/**
 * Mark all messages as read
 */
supportTicketSchema.methods.markAllRead = function(userId, role) {
  const messagesToMark = role === 'agent' 
    ? this.messages.filter(m => m.senderRole === 'user')
    : this.messages.filter(m => m.senderRole !== 'user');
  
  for (const message of messagesToMark) {
    if (!message.readBy.some(r => r.userId.toString() === userId.toString())) {
      message.readBy.push({ userId, readAt: new Date() });
    }
  }
  
  return this.save();
};

/**
 * Get ticket summary
 */
supportTicketSchema.methods.getSummary = function() {
  return {
    ticketId: this.ticketId,
    ticketNumber: this.ticketNumber,
    subject: this.subject,
    category: this.category,
    priority: this.priority,
    status: this.status,
    createdAt: this.createdAt,
    lastActivityAt: this.lastActivityAt,
    messageCount: this.metrics.messageCount,
    isAssigned: this.isAssigned,
    assignedTo: this.assignment?.agentName,
    hasSatisfaction: this.hasSatisfaction,
    satisfactionRating: this.satisfaction?.rating,
    ageHours: this.ageHours
  };
};

// ============================================
// Static Methods
// ============================================

/**
 * Find tickets by user
 */
supportTicketSchema.statics.findByUser = function(userId, options = {}) {
  const { limit = 50, offset = 0, status, category, priority } = options;
  
  let query = this.find({ userId });
  
  if (status) query = query.where('status').equals(status);
  if (category) query = query.where('category').equals(category);
  if (priority) query = query.where('priority').equals(priority);
  
  return query
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(limit);
};

/**
 * Find tickets by agent
 */
supportTicketSchema.statics.findByAgent = function(agentId, options = {}) {
  const { limit = 50, offset = 0, status, includeUnassigned = false } = options;
  
  let query = this.find({ 'assignment.agentId': agentId, 'assignment.isActive': true });
  
  if (includeUnassigned) {
    query = this.find({
      $or: [
        { 'assignment.agentId': agentId, 'assignment.isActive': true },
        { 'assignment.agentId': { $exists: false } }
      ]
    });
  }
  
  if (status) query = query.where('status').equals(status);
  
  return query
    .sort({ priority: -1, createdAt: 1 })
    .skip(offset)
    .limit(limit);
};

/**
 * Get dashboard stats
 */
supportTicketSchema.statics.getDashboardStats = async function() {
  const stats = await this.aggregate([
    {
      $facet: {
        byStatus: [
          { $group: { _id: '$status', count: { $sum: 1 } } }
        ],
        byPriority: [
          { $group: { _id: '$priority', count: { $sum: 1 } } }
        ],
        byCategory: [
          { $group: { _id: '$category', count: { $sum: 1 } } }
        ],
        averageMetrics: [
          {
            $group: {
              _id: null,
              avgTimeToFirstResponse: { $avg: '$metrics.timeToFirstResponse' },
              avgTimeToResolution: { $avg: '$metrics.timeToResolution' },
              avgSatisfaction: { $avg: '$satisfaction.rating' },
              totalTickets: { $sum: 1 },
              openTickets: { $sum: { $cond: [{ $in: ['$status', ['open', 'in_progress', 'waiting']] }, 1, 0] } },
              resolvedToday: { 
                $sum: { 
                  $cond: [
                    { $and: [
                      { $eq: ['$status', 'resolved'] },
                      { $eq: [{ $dateToString: { format: '%Y-%m-%d', date: '$resolvedAt' } }, new Date().toISOString().split('T')[0]] }
                    ] }, 
                    1, 0
                  ]
                }
              }
            }
          }
        ]
      }
    }
  ]);
  
  const result = stats[0];
  
  return {
    byStatus: result.byStatus.reduce((acc, curr) => ({ ...acc, [curr._id]: curr.count }), {}),
    byPriority: result.byPriority.reduce((acc, curr) => ({ ...acc, [curr._id]: curr.count }), {}),
    byCategory: result.byCategory.reduce((acc, curr) => ({ ...acc, [curr._id]: curr.count }), {}),
    metrics: result.averageMetrics[0] || {
      avgTimeToFirstResponse: 0,
      avgTimeToResolution: 0,
      avgSatisfaction: 0,
      totalTickets: 0,
      openTickets: 0,
      resolvedToday: 0
    }
  };
};

/**
 * Search tickets
 */
supportTicketSchema.statics.searchTickets = async function(searchTerm, options = {}) {
  const { limit = 50, offset = 0 } = options;
  
  const searchRegex = new RegExp(searchTerm, 'i');
  
  return await this.find({
    $or: [
      { ticketNumber: searchRegex },
      { subject: searchRegex },
      { userEmail: searchRegex },
      { userName: searchRegex },
      { 'messages.message': searchRegex }
    ]
  })
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(limit);
};

/**
 * Get unresolved tickets count
 */
supportTicketSchema.statics.getUnresolvedCount = async function() {
  return await this.countDocuments({
    status: { $in: [TICKET_STATUSES.OPEN, TICKET_STATUSES.IN_PROGRESS, TICKET_STATUSES.WAITING, TICKET_STATUSES.ESCALATED] }
  });
};

// ============================================
// Indexes
// ============================================

supportTicketSchema.index({ ticketId: 1 });
supportTicketSchema.index({ ticketNumber: 1 });
supportTicketSchema.index({ userId: 1, createdAt: -1 });
supportTicketSchema.index({ status: 1, priority: 1 });
supportTicketSchema.index({ 'assignment.agentId': 1, status: 1 });
supportTicketSchema.index({ category: 1, status: 1 });
supportTicketSchema.index({ createdAt: -1 });
supportTicketSchema.index({ updatedAt: -1 });
supportTicketSchema.index({ 'tags.name': 1 });
supportTicketSchema.index({ userEmail: 1 });
supportTicketSchema.index({ 'messages.messageId': 1 });

// Compound indexes
supportTicketSchema.index({ status: 1, priority: 1, createdAt: 1 });
supportTicketSchema.index({ userId: 1, status: 1, createdAt: -1 });
supportTicketSchema.index({ 'assignment.agentId': 1, status: 1, priority: 1 });

// ============================================
// Pre-save Middleware
// ============================================

// Generate ticket ID and number
supportTicketSchema.pre('save', async function(next) {
  if (!this.ticketId) {
    this.ticketId = `tkt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  if (!this.ticketNumber) {
    this.ticketNumber = this.generateTicketNumber();
  }
  
  next();
});

// Update timestamps
supportTicketSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Set SLA based on priority
supportTicketSchema.pre('save', function(next) {
  if (!this.sla) {
    const slaConfig = {
      [TICKET_PRIORITIES.LOW]: { firstResponse: 48, resolution: 120 },
      [TICKET_PRIORITIES.MEDIUM]: { firstResponse: 24, resolution: 72 },
      [TICKET_PRIORITIES.HIGH]: { firstResponse: 12, resolution: 48 },
      [TICKET_PRIORITIES.URGENT]: { firstResponse: 4, resolution: 24 },
      [TICKET_PRIORITIES.CRITICAL]: { firstResponse: 1, resolution: 8 }
    };
    
    const config = slaConfig[this.priority] || slaConfig[TICKET_PRIORITIES.MEDIUM];
    
    this.sla = {
      priority: this.priority,
      firstResponseTime: config.firstResponse,
      resolutionTime: config.resolution
    };
  }
  next();
});

// ============================================
// Model Creation
// ============================================

const SupportTicket = mongoose.model('SupportTicket', supportTicketSchema);

module.exports = SupportTicket;
