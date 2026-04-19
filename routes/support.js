/* ============================================
   SPEAKFLOW - SUPPORT MODULE
   Version: 1.0.0
   Handles customer support, tickets, live chat, and knowledge base
   ============================================ */

const { validationResult } = require('express-validator');
const { body, param, query } = require('express-validator');
const crypto = require('crypto');

// ============================================
// CONFIGURATION
// ============================================

const SupportConfig = {
    // Ticket Settings
    tickets: {
        autoAssign: true,
        priorityLevels: ['low', 'medium', 'high', 'urgent'],
        statuses: ['open', 'in_progress', 'pending', 'resolved', 'closed'],
        slaHours: {
            low: 48,
            medium: 24,
            high: 12,
            urgent: 4
        },
        maxAttachments: 5,
        maxFileSize: 10 * 1024 * 1024, // 10MB
        allowedFileTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain']
    },
    
    // Chat Settings
    chat: {
        sessionTimeout: 30 * 60 * 1000, // 30 minutes
        maxMessageLength: 1000,
        typingTimeout: 3000,
        offlineMessage: "We're currently offline. Please leave a message and we'll get back to you soon.",
        autoResponseDelay: 1000
    },
    
    // Knowledge Base
    knowledgeBase: {
        maxResults: 10,
        cacheTTL: 3600, // 1 hour
        categories: ['account', 'billing', 'technical', 'practice', 'premium', 'general']
    },
    
    // Feedback
    feedback: {
        maxLength: 1000,
        ratingRange: { min: 1, max: 5 },
        categories: ['general', 'feature', 'bug', 'support', 'billing']
    },
    
    // Pagination
    pagination: {
        defaultLimit: 20,
        maxLimit: 100
    }
};

// ============================================
// DATABASE MODELS (Simulated)
// ============================================

class SupportModel {
    constructor() {
        this.tickets = [];
        this.messages = [];
        this.chatSessions = [];
        this.chatMessages = [];
        this.articles = [];
        this.faqs = [];
        this.feedback = [];
        this.agents = [];
    }
    
    // Ticket Management
    async createTicket(ticketData) {
        const ticket = {
            id: this.tickets.length + 1,
            ticketId: this.generateTicketId(),
            userId: ticketData.userId,
            subject: ticketData.subject,
            description: ticketData.description,
            category: ticketData.category,
            priority: ticketData.priority || 'medium',
            status: ticketData.status || 'open',
            assignedTo: ticketData.assignedTo || null,
            attachments: ticketData.attachments || [],
            metadata: ticketData.metadata || {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            resolvedAt: null,
            closedAt: null
        };
        
        this.tickets.push(ticket);
        
        // Auto-assign if enabled
        if (SupportConfig.tickets.autoAssign && !ticket.assignedTo) {
            await this.autoAssignTicket(ticket.id);
        }
        
        return ticket;
    }
    
    generateTicketId() {
        const year = new Date().getFullYear();
        const month = String(new Date().getMonth() + 1).padStart(2, '0');
        const sequence = String(this.tickets.length + 1).padStart(6, '0');
        return `TKT-${year}${month}-${sequence}`;
    }
    
    async autoAssignTicket(ticketId) {
        const ticket = await this.findTicketById(ticketId);
        if (!ticket) return null;
        
        // Find available agent with least tickets
        const availableAgents = this.agents.filter(a => a.status === 'online');
        if (availableAgents.length > 0) {
            const agent = availableAgents.reduce((min, a) => 
                (a.activeTickets || 0) < (min.activeTickets || 0) ? a : min
            );
            ticket.assignedTo = agent.id;
            agent.activeTickets = (agent.activeTickets || 0) + 1;
        }
        
        return ticket;
    }
    
    async findTicketById(id) {
        return this.tickets.find(t => t.id === parseInt(id));
    }
    
    async findTicketByTicketId(ticketId) {
        return this.tickets.find(t => t.ticketId === ticketId);
    }
    
    async findTicketsByUserId(userId, options = {}) {
        let results = this.tickets.filter(t => t.userId === parseInt(userId));
        
        const sortBy = options.sortBy || 'createdAt';
        const sortOrder = options.sortOrder === 'asc' ? 1 : -1;
        results.sort((a, b) => {
            if (a[sortBy] < b[sortBy]) return -sortOrder;
            if (a[sortBy] > b[sortBy]) return sortOrder;
            return 0;
        });
        
        const page = options.page || 1;
        const limit = Math.min(options.limit || SupportConfig.pagination.defaultLimit, SupportConfig.pagination.maxLimit);
        const start = (page - 1) * limit;
        const end = start + limit;
        
        return {
            tickets: results.slice(start, end),
            total: results.length,
            page,
            limit,
            totalPages: Math.ceil(results.length / limit)
        };
    }
    
    async findAllTickets(filters = {}, options = {}) {
        let results = [...this.tickets];
        
        if (filters.status) {
            results = results.filter(t => t.status === filters.status);
        }
        if (filters.priority) {
            results = results.filter(t => t.priority === filters.priority);
        }
        if (filters.category) {
            results = results.filter(t => t.category === filters.category);
        }
        if (filters.assignedTo) {
            results = results.filter(t => t.assignedTo === parseInt(filters.assignedTo));
        }
        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            results = results.filter(t => 
                t.subject.toLowerCase().includes(searchLower) ||
                t.description.toLowerCase().includes(searchLower)
            );
        }
        
        const sortBy = options.sortBy || 'createdAt';
        const sortOrder = options.sortOrder === 'asc' ? 1 : -1;
        results.sort((a, b) => {
            if (a[sortBy] < b[sortBy]) return -sortOrder;
            if (a[sortBy] > b[sortBy]) return sortOrder;
            return 0;
        });
        
        const page = options.page || 1;
        const limit = Math.min(options.limit || SupportConfig.pagination.defaultLimit, SupportConfig.pagination.maxLimit);
        const start = (page - 1) * limit;
        const end = start + limit;
        
        return {
            tickets: results.slice(start, end),
            total: results.length,
            page,
            limit,
            totalPages: Math.ceil(results.length / limit)
        };
    }
    
    async updateTicket(id, updates) {
        const index = this.tickets.findIndex(t => t.id === parseInt(id));
        if (index === -1) return null;
        
        const allowedUpdates = ['subject', 'description', 'priority', 'status', 'assignedTo'];
        const filteredUpdates = {};
        
        for (const key of allowedUpdates) {
            if (updates[key] !== undefined) {
                filteredUpdates[key] = updates[key];
            }
        }
        
        if (updates.status === 'resolved' && this.tickets[index].status !== 'resolved') {
            filteredUpdates.resolvedAt = new Date().toISOString();
        }
        if (updates.status === 'closed' && this.tickets[index].status !== 'closed') {
            filteredUpdates.closedAt = new Date().toISOString();
        }
        
        this.tickets[index] = {
            ...this.tickets[index],
            ...filteredUpdates,
            updatedAt: new Date().toISOString()
        };
        
        return this.tickets[index];
    }
    
    async addMessage(messageData) {
        const message = {
            id: this.messages.length + 1,
            messageId: this.generateMessageId(),
            ticketId: messageData.ticketId,
            senderId: messageData.senderId,
            senderType: messageData.senderType,
            message: messageData.message,
            attachments: messageData.attachments || [],
            isInternal: messageData.isInternal || false,
            createdAt: new Date().toISOString(),
            readAt: null
        };
        
        this.messages.push(message);
        
        // Update ticket updatedAt
        const ticket = await this.findTicketById(messageData.ticketId);
        if (ticket) {
            ticket.updatedAt = new Date().toISOString();
        }
        
        return message;
    }
    
    generateMessageId() {
        return `msg_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    }
    
    async getTicketMessages(ticketId) {
        return this.messages.filter(m => m.ticketId === parseInt(ticketId))
            .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    }
    
    async markMessageAsRead(messageId) {
        const message = this.messages.find(m => m.id === parseInt(messageId));
        if (message && !message.readAt) {
            message.readAt = new Date().toISOString();
        }
        return message;
    }
    
    // Chat Management
    async createChatSession(userId, userName) {
        const session = {
            id: this.chatSessions.length + 1,
            sessionId: this.generateSessionId(),
            userId,
            userName,
            status: 'active',
            assignedAgent: null,
            startedAt: new Date().toISOString(),
            lastActivityAt: new Date().toISOString(),
            endedAt: null,
            metadata: {}
        };
        
        this.chatSessions.push(session);
        return session;
    }
    
    generateSessionId() {
        return `chat_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    }
    
    async findChatSession(sessionId) {
        return this.chatSessions.find(s => s.sessionId === sessionId);
    }
    
    async findChatSessionByUserId(userId) {
        return this.chatSessions.find(s => s.userId === parseInt(userId) && s.status === 'active');
    }
    
    async updateChatSession(sessionId, updates) {
        const index = this.chatSessions.findIndex(s => s.sessionId === sessionId);
        if (index === -1) return null;
        
        this.chatSessions[index] = {
            ...this.chatSessions[index],
            ...updates,
            lastActivityAt: new Date().toISOString()
        };
        
        return this.chatSessions[index];
    }
    
    async addChatMessage(messageData) {
        const message = {
            id: this.chatMessages.length + 1,
            messageId: this.generateChatMessageId(),
            sessionId: messageData.sessionId,
            senderId: messageData.senderId,
            senderType: messageData.senderType,
            message: messageData.message,
            timestamp: new Date().toISOString()
        };
        
        this.chatMessages.push(message);
        
        // Update session last activity
        await this.updateChatSession(messageData.sessionId, {});
        
        return message;
    }
    
    generateChatMessageId() {
        return `chat_msg_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    }
    
    async getChatMessages(sessionId, limit = 50) {
        return this.chatMessages.filter(m => m.sessionId === sessionId)
            .slice(-limit);
    }
    
    async endChatSession(sessionId) {
        const session = await this.findChatSession(sessionId);
        if (session) {
            session.status = 'ended';
            session.endedAt = new Date().toISOString();
        }
        return session;
    }
    
    // Knowledge Base
    async createArticle(articleData) {
        const article = {
            id: this.articles.length + 1,
            articleId: this.generateArticleId(),
            title: articleData.title,
            content: articleData.content,
            excerpt: articleData.excerpt,
            category: articleData.category,
            tags: articleData.tags || [],
            authorId: articleData.authorId,
            views: 0,
            helpful: 0,
            notHelpful: 0,
            status: articleData.status || 'published',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        this.articles.push(article);
        return article;
    }
    
    generateArticleId() {
        return `art_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    }
    
    async findArticleById(id) {
        const article = this.articles.find(a => a.id === parseInt(id));
        if (article) {
            article.views++;
        }
        return article;
    }
    
    async searchArticles(query, category = null) {
        let results = [...this.articles];
        
        if (category) {
            results = results.filter(a => a.category === category);
        }
        
        const searchLower = query.toLowerCase();
        results = results.filter(a => 
            a.title.toLowerCase().includes(searchLower) ||
            a.content.toLowerCase().includes(searchLower) ||
            a.tags.some(t => t.toLowerCase().includes(searchLower))
        );
        
        // Sort by relevance (simple: title match priority)
        results.sort((a, b) => {
            const aTitleMatch = a.title.toLowerCase().includes(searchLower) ? 1 : 0;
            const bTitleMatch = b.title.toLowerCase().includes(searchLower) ? 1 : 0;
            return bTitleMatch - aTitleMatch;
        });
        
        return results.slice(0, SupportConfig.knowledgeBase.maxResults);
    }
    
    async createFAQ(faqData) {
        const faq = {
            id: this.faqs.length + 1,
            question: faqData.question,
            answer: faqData.answer,
            category: faqData.category,
            order: faqData.order || this.faqs.length + 1,
            helpful: 0,
            notHelpful: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        this.faqs.push(faq);
        return faq;
    }
    
    async getFAQsByCategory(category) {
        return this.faqs.filter(f => f.category === category)
            .sort((a, b) => a.order - b.order);
    }
    
    async markFAQHelpful(faqId, helpful) {
        const faq = this.faqs.find(f => f.id === parseInt(faqId));
        if (faq) {
            if (helpful) {
                faq.helpful++;
            } else {
                faq.notHelpful++;
            }
        }
        return faq;
    }
    
    // Feedback
    async submitFeedback(feedbackData) {
        const feedback = {
            id: this.feedback.length + 1,
            userId: feedbackData.userId,
            rating: feedbackData.rating,
            category: feedbackData.category,
            message: feedbackData.message,
            metadata: feedbackData.metadata || {},
            createdAt: new Date().toISOString()
        };
        
        this.feedback.push(feedback);
        return feedback;
    }
    
    async getFeedbackStats() {
        const stats = {
            total: this.feedback.length,
            averageRating: 0,
            byRating: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
            byCategory: {}
        };
        
        let totalRating = 0;
        for (const fb of this.feedback) {
            totalRating += fb.rating;
            stats.byRating[fb.rating]++;
            
            if (!stats.byCategory[fb.category]) {
                stats.byCategory[fb.category] = { count: 0, totalRating: 0 };
            }
            stats.byCategory[fb.category].count++;
            stats.byCategory[fb.category].totalRating += fb.rating;
        }
        
        stats.averageRating = stats.total > 0 ? totalRating / stats.total : 0;
        
        for (const category in stats.byCategory) {
            stats.byCategory[category].averageRating = 
                stats.byCategory[category].totalRating / stats.byCategory[category].count;
        }
        
        return stats;
    }
    
    // Agent Management
    async addAgent(agentData) {
        const agent = {
            id: this.agents.length + 1,
            userId: agentData.userId,
            name: agentData.name,
            email: agentData.email,
            role: agentData.role || 'agent',
            skills: agentData.skills || [],
            status: agentData.status || 'offline',
            activeTickets: 0,
            activeChats: 0,
            createdAt: new Date().toISOString()
        };
        
        this.agents.push(agent);
        return agent;
    }
    
    async updateAgentStatus(agentId, status) {
        const agent = this.agents.find(a => a.id === parseInt(agentId));
        if (agent) {
            agent.status = status;
        }
        return agent;
    }
    
    async getAvailableAgents() {
        return this.agents.filter(a => a.status === 'online');
    }
}

// ============================================
// SUPPORT SERVICE
// ============================================

class SupportService {
    constructor(supportModel) {
        this.supportModel = supportModel;
        this.init();
    }
    
    init() {
        this.startChatCleanup();
        this.initAgents();
    }
    
    initAgents() {
        // Add default agents for demo
        this.supportModel.addAgent({
            userId: 1,
            name: 'Sarah Johnson',
            email: 'sarah@speakflow.com',
            role: 'senior_agent',
            skills: ['technical', 'billing', 'account'],
            status: 'online'
        });
        
        this.supportModel.addAgent({
            userId: 2,
            name: 'Mike Chen',
            email: 'mike@speakflow.com',
            role: 'agent',
            skills: ['practice', 'general', 'account'],
            status: 'online'
        });
    }
    
    startChatCleanup() {
        setInterval(() => {
            this.cleanupInactiveChats();
        }, 60000);
    }
    
    async cleanupInactiveChats() {
        const now = Date.now();
        const sessions = this.supportModel.chatSessions;
        
        for (const session of sessions) {
            if (session.status === 'active') {
                const lastActivity = new Date(session.lastActivityAt).getTime();
                if (now - lastActivity > SupportConfig.chat.sessionTimeout) {
                    await this.supportModel.endChatSession(session.sessionId);
                }
            }
        }
    }
    
    // Ticket Operations
    async createTicket(userId, ticketData) {
        const ticket = await this.supportModel.createTicket({
            userId,
            ...ticketData
        });
        
        // Send confirmation email
        await this.sendTicketConfirmation(ticket);
        
        return ticket;
    }
    
    async getTicket(ticketId, userId, isAdmin = false) {
        const ticket = await this.supportModel.findTicketById(ticketId);
        
        if (!ticket) {
            throw new Error('Ticket not found');
        }
        
        if (!isAdmin && ticket.userId !== userId) {
            throw new Error('Unauthorized access to ticket');
        }
        
        const messages = await this.supportModel.getTicketMessages(ticketId);
        
        return { ticket, messages };
    }
    
    async getUserTickets(userId, options = {}) {
        return await this.supportModel.findTicketsByUserId(userId, options);
    }
    
    async addTicketMessage(ticketId, userId, messageData, isAdmin = false) {
        const ticket = await this.supportModel.findTicketById(ticketId);
        
        if (!ticket) {
            throw new Error('Ticket not found');
        }
        
        if (!isAdmin && ticket.userId !== userId) {
            throw new Error('Unauthorized access to ticket');
        }
        
        const message = await this.supportModel.addMessage({
            ticketId,
            senderId: userId,
            senderType: isAdmin ? 'agent' : 'user',
            message: messageData.message,
            attachments: messageData.attachments,
            isInternal: messageData.isInternal || false
        });
        
        // Update ticket status if user replied to resolved ticket
        if (!isAdmin && ticket.status === 'resolved') {
            await this.supportModel.updateTicket(ticketId, { status: 'open' });
        }
        
        // Send notification to assigned agent
        if (!isAdmin && ticket.assignedTo) {
            await this.notifyAgent(ticket.assignedTo, ticket, message);
        }
        
        return message;
    }
    
    async updateTicketStatus(ticketId, status, userId, isAdmin = false) {
        const ticket = await this.supportModel.findTicketById(ticketId);
        
        if (!ticket) {
            throw new Error('Ticket not found');
        }
        
        if (!isAdmin && ticket.userId !== userId) {
            throw new Error('Unauthorized access to ticket');
        }
        
        const updated = await this.supportModel.updateTicket(ticketId, { status });
        
        return updated;
    }
    
    // Chat Operations
    async startChat(userId, userName) {
        // Check for existing active session
        let session = await this.supportModel.findChatSessionByUserId(userId);
        
        if (!session) {
            session = await this.supportModel.createChatSession(userId, userName);
            
            // Try to assign an agent
            const availableAgents = await this.supportModel.getAvailableAgents();
            if (availableAgents.length > 0) {
                const agent = availableAgents[0];
                session.assignedAgent = agent;
                await this.supportModel.updateChatSession(session.sessionId, { assignedAgent: agent });
                
                // Send welcome message
                await this.supportModel.addChatMessage({
                    sessionId: session.sessionId,
                    senderId: agent.id,
                    senderType: 'agent',
                    message: `Hello! I'm ${agent.name}. How can I help you today?`
                });
            } else {
                // Send offline message
                await this.supportModel.addChatMessage({
                    sessionId: session.sessionId,
                    senderId: null,
                    senderType: 'system',
                    message: SupportConfig.chat.offlineMessage
                });
            }
        }
        
        const messages = await this.supportModel.getChatMessages(session.sessionId);
        
        return { session, messages };
    }
    
    async sendChatMessage(sessionId, userId, message, isAdmin = false) {
        const session = await this.supportModel.findChatSession(sessionId);
        
        if (!session) {
            throw new Error('Chat session not found');
        }
        
        if (!isAdmin && session.userId !== userId) {
            throw new Error('Unauthorized access to chat');
        }
        
        const chatMessage = await this.supportModel.addChatMessage({
            sessionId,
            senderId: userId,
            senderType: isAdmin ? 'agent' : 'user',
            message: message.substring(0, SupportConfig.chat.maxMessageLength)
        });
        
        // Simulate auto-response if no agent assigned
        if (!isAdmin && !session.assignedAgent) {
            setTimeout(async () => {
                await this.supportModel.addChatMessage({
                    sessionId,
                    senderId: null,
                    senderType: 'system',
                    message: "Thanks for your message! An agent will be with you shortly."
                });
            }, SupportConfig.chat.autoResponseDelay);
        }
        
        return chatMessage;
    }
    
    async endChat(sessionId, userId, isAdmin = false) {
        const session = await this.supportModel.findChatSession(sessionId);
        
        if (!session) {
            throw new Error('Chat session not found');
        }
        
        if (!isAdmin && session.userId !== userId) {
            throw new Error('Unauthorized access to chat');
        }
        
        const ended = await this.supportModel.endChatSession(sessionId);
        
        // Request feedback
        if (!isAdmin) {
            await this.requestChatFeedback(sessionId, userId);
        }
        
        return ended;
    }
    
    async getChatHistory(userId, limit = 50) {
        const sessions = this.supportModel.chatSessions
            .filter(s => s.userId === userId)
            .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
        
        const history = [];
        for (const session of sessions.slice(0, limit)) {
            const messages = await this.supportModel.getChatMessages(session.sessionId, 10);
            history.push({ session, messages });
        }
        
        return history;
    }
    
    // Knowledge Base Operations
    async searchKnowledgeBase(query, category = null) {
        const articles = await this.supportModel.searchArticles(query, category);
        const faqs = await this.supportModel.getFAQsByCategory(category);
        
        // Filter FAQs by query
        const filteredFaqs = faqs.filter(f => 
            f.question.toLowerCase().includes(query.toLowerCase()) ||
            f.answer.toLowerCase().includes(query.toLowerCase())
        );
        
        return {
            articles: articles.slice(0, 5),
            faqs: filteredFaqs.slice(0, 5),
            total: articles.length + filteredFaqs.length
        };
    }
    
    async getArticle(articleId) {
        const article = await this.supportModel.findArticleById(articleId);
        if (!article) {
            throw new Error('Article not found');
        }
        return article;
    }
    
    async getFAQsByCategory(category) {
        return await this.supportModel.getFAQsByCategory(category);
    }
    
    async markFAQHelpful(faqId, helpful) {
        return await this.supportModel.markFAQHelpful(faqId, helpful);
    }
    
    // Feedback Operations
    async submitFeedback(userId, feedbackData) {
        const feedback = await this.supportModel.submitFeedback({
            userId,
            ...feedbackData
        });
        
        return feedback;
    }
    
    async getFeedbackStats() {
        return await this.supportModel.getFeedbackStats();
    }
    
    // Admin Operations
    async getAllTickets(filters = {}, options = {}) {
        return await this.supportModel.findAllTickets(filters, options);
    }
    
    async assignTicket(ticketId, agentId) {
        const ticket = await this.supportModel.updateTicket(ticketId, { assignedTo: agentId });
        return ticket;
    }
    
    async getAgents() {
        return this.supportModel.agents;
    }
    
    async updateAgentStatus(agentId, status) {
        return await this.supportModel.updateAgentStatus(agentId, status);
    }
    
    // Notifications
    async sendTicketConfirmation(ticket) {
        // In production, send email
        console.log(`[Support] Ticket created: ${ticket.ticketId} for user ${ticket.userId}`);
    }
    
    async notifyAgent(agentId, ticket, message) {
        console.log(`[Support] Notifying agent ${agentId} about new message on ticket ${ticket.ticketId}`);
    }
    
    async requestChatFeedback(sessionId, userId) {
        console.log(`[Support] Requesting feedback for chat session ${sessionId}`);
    }
}

// ============================================
// VALIDATION RULES
// ============================================

const SupportValidation = {
    createTicket: [
        body('subject')
            .notEmpty().withMessage('Subject is required')
            .isLength({ min: 3, max: 200 }).withMessage('Subject must be between 3 and 200 characters'),
        
        body('description')
            .notEmpty().withMessage('Description is required')
            .isLength({ min: 10, max: 5000 }).withMessage('Description must be between 10 and 5000 characters'),
        
        body('category')
            .optional()
            .isIn(SupportConfig.knowledgeBase.categories)
            .withMessage('Invalid category'),
        
        body('priority')
            .optional()
            .isIn(SupportConfig.tickets.priorityLevels)
            .withMessage('Invalid priority')
    ],
    
    addMessage: [
        body('message')
            .notEmpty().withMessage('Message is required')
            .isLength({ max: 5000 }).withMessage('Message too long')
    ],
    
    sendChatMessage: [
        body('message')
            .notEmpty().withMessage('Message is required')
            .isLength({ max: SupportConfig.chat.maxMessageLength })
            .withMessage(`Message cannot exceed ${SupportConfig.chat.maxMessageLength} characters`)
    ],
    
    submitFeedback: [
        body('rating')
            .notEmpty().withMessage('Rating is required')
            .isInt({ min: SupportConfig.feedback.ratingRange.min, max: SupportConfig.feedback.ratingRange.max })
            .withMessage(`Rating must be between ${SupportConfig.feedback.ratingRange.min} and ${SupportConfig.feedback.ratingRange.max}`),
        
        body('category')
            .optional()
            .isIn(SupportConfig.feedback.categories)
            .withMessage('Invalid category'),
        
        body('message')
            .optional()
            .isLength({ max: SupportConfig.feedback.maxLength })
            .withMessage(`Message cannot exceed ${SupportConfig.feedback.maxLength} characters`)
    ],
    
    searchKnowledgeBase: [
        query('q')
            .notEmpty().withMessage('Search query is required')
            .isLength({ min: 2 }).withMessage('Search query must be at least 2 characters'),
        
        query('category')
            .optional()
            .isIn(SupportConfig.knowledgeBase.categories)
            .withMessage('Invalid category')
    ]
};

// ============================================
// SUPPORT ROUTES
// ============================================

function createSupportRoutes(supportService, authMiddleware) {
    const router = require('express').Router();
    
    // ============ Tickets ============
    
    // Create ticket
    router.post('/tickets', authMiddleware.authenticate, SupportValidation.createTicket, async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        try {
            const ticket = await supportService.createTicket(req.user.id, req.body);
            res.status(201).json(ticket);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    
    // Get user tickets
    router.get('/tickets', authMiddleware.authenticate, async (req, res) => {
        const options = {
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || SupportConfig.pagination.defaultLimit,
            sortBy: req.query.sortBy || 'createdAt',
            sortOrder: req.query.sortOrder || 'desc'
        };
        
        const tickets = await supportService.getUserTickets(req.user.id, options);
        res.json(tickets);
    });
    
    // Get ticket by ID
    router.get('/tickets/:id', authMiddleware.authenticate, async (req, res) => {
        try {
            const { ticket, messages } = await supportService.getTicket(req.params.id, req.user.id);
            res.json({ ticket, messages });
        } catch (error) {
            res.status(404).json({ error: error.message });
        }
    });
    
    // Add message to ticket
    router.post('/tickets/:id/messages', authMiddleware.authenticate, SupportValidation.addMessage, async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        try {
            const message = await supportService.addTicketMessage(req.params.id, req.user.id, req.body);
            res.status(201).json(message);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    
    // Update ticket status
    router.patch('/tickets/:id/status', authMiddleware.authenticate, async (req, res) => {
        const { status } = req.body;
        
        if (!status || !SupportConfig.tickets.statuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        
        try {
            const ticket = await supportService.updateTicketStatus(req.params.id, status, req.user.id);
            res.json(ticket);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    
    // ============ Live Chat ============
    
    // Start chat session
    router.post('/chat/start', authMiddleware.authenticate, async (req, res) => {
        try {
            const { session, messages } = await supportService.startChat(req.user.id, req.user.name);
            res.json({ session, messages });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    
    // Send chat message
    router.post('/chat/:sessionId/messages', authMiddleware.authenticate, SupportValidation.sendChatMessage, async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        try {
            const message = await supportService.sendChatMessage(req.params.sessionId, req.user.id, req.body.message);
            res.status(201).json(message);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    
    // End chat session
    router.post('/chat/:sessionId/end', authMiddleware.authenticate, async (req, res) => {
        try {
            const session = await supportService.endChat(req.params.sessionId, req.user.id);
            res.json(session);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    
    // Get chat history
    router.get('/chat/history', authMiddleware.authenticate, async (req, res) => {
        const limit = parseInt(req.query.limit) || 50;
        const history = await supportService.getChatHistory(req.user.id, limit);
        res.json(history);
    });
    
    // ============ Knowledge Base ============
    
    // Search knowledge base
    router.get('/kb/search', SupportValidation.searchKnowledgeBase, async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        const results = await supportService.searchKnowledgeBase(req.query.q, req.query.category);
        res.json(results);
    });
    
    // Get article
    router.get('/kb/articles/:id', async (req, res) => {
        try {
            const article = await supportService.getArticle(req.params.id);
            res.json(article);
        } catch (error) {
            res.status(404).json({ error: error.message });
        }
    });
    
    // Get FAQs by category
    router.get('/kb/faqs/:category', async (req, res) => {
        const { category } = req.params;
        if (!SupportConfig.knowledgeBase.categories.includes(category)) {
            return res.status(400).json({ error: 'Invalid category' });
        }
        
        const faqs = await supportService.getFAQsByCategory(category);
        res.json(faqs);
    });
    
    // Mark FAQ as helpful
    router.post('/kb/faqs/:id/helpful', authMiddleware.authenticate, async (req, res) => {
        const { helpful } = req.body;
        
        try {
            const faq = await supportService.markFAQHelpful(req.params.id, helpful);
            res.json(faq);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    
    // ============ Feedback ============
    
    // Submit feedback
    router.post('/feedback', authMiddleware.authenticate, SupportValidation.submitFeedback, async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        try {
            const feedback = await supportService.submitFeedback(req.user.id, req
