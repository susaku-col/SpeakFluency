/* ============================================
   SPEAKFLOW - CUSTOMER SUPPORT MODULE
   Version: 1.0.0
   Handles live chat, support tickets, FAQ, and knowledge base
   ============================================ */

// ============================================
// SUPPORT CONFIGURATION
// ============================================

const SupportConfig = {
    // API Endpoints
    api: {
        tickets: '/api/support/tickets',
        messages: '/api/support/messages',
        chat: '/api/support/chat',
        faq: '/api/support/faq',
        knowledgeBase: '/api/support/kb'
    },
    
    // Chat Settings
    chat: {
        wsUrl: 'wss://api.speakflow.com/chat',
        autoResponse: true,
        typingTimeout: 3000,
        sessionTimeout: 30 * 60 * 1000, // 30 minutes
        maxMessageLength: 1000,
        fileAttachmentSize: 5 * 1024 * 1024 // 5MB
    },
    
    // Ticket Settings
    tickets: {
        autoAssign: true,
        priorityLevels: ['low', 'medium', 'high', 'urgent'],
        statuses: ['open', 'in_progress', 'resolved', 'closed'],
        slaHours: {
            low: 48,
            medium: 24,
            high: 12,
            urgent: 4
        }
    },
    
    // FAQ Settings
    faq: {
        categories: ['account', 'billing', 'technical', 'practice', 'premium', 'general'],
        maxResults: 10,
        cacheDuration: 3600000 // 1 hour
    },
    
    // AI Support Settings
    ai: {
        enabled: true,
        confidenceThreshold: 0.7,
        maxTokens: 150,
        model: 'gpt-3.5-turbo'
    }
};

// ============================================
// KNOWLEDGE BASE
// ============================================

class KnowledgeBase {
    constructor() {
        this.articles = [];
        this.faqs = [];
        this.categories = SupportConfig.faq.categories;
        this.init();
    }
    
    init() {
        this.loadFAQs();
        this.loadArticles();
    }
    
    loadFAQs() {
        this.faqs = [
            {
                id: 'faq_001',
                question: 'How do I start practicing?',
                answer: 'Click the microphone button on the practice page, grant microphone access, and start speaking! Our AI will provide instant feedback.',
                category: 'practice',
                helpful: 0,
                views: 0
            },
            {
                id: 'faq_002',
                question: 'What is the daily limit for free users?',
                answer: 'Free users can practice up to 10 sentences per day. Upgrade to Premium for unlimited practice sessions.',
                category: 'billing',
                helpful: 0,
                views: 0
            },
            {
                id: 'faq_003',
                question: 'How does the scoring system work?',
                answer: 'Your score is calculated based on pronunciation (40%), fluency (30%), grammar (20%), and vocabulary (10%).',
                category: 'practice',
                helpful: 0,
                views: 0
            },
            {
                id: 'faq_004',
                question: 'Can I use SpeakFlow on mobile?',
                answer: 'Yes! SpeakFlow is a PWA that works on all devices. You can also install it as a native app.',
                category: 'technical',
                helpful: 0,
                views: 0
            },
            {
                id: 'faq_005',
                question: 'How do I cancel my Premium subscription?',
                answer: 'Go to Settings > Subscription > Cancel. Your premium benefits will continue until the end of the billing period.',
                category: 'billing',
                helpful: 0,
                views: 0
            },
            {
                id: 'faq_006',
                question: 'What browsers are supported?',
                answer: 'SpeakFlow works best on Chrome, Edge, and Safari. Voice recognition requires Chrome or Edge.',
                category: 'technical',
                helpful: 0,
                views: 0
            },
            {
                id: 'faq_007',
                question: 'How is my data protected?',
                answer: 'We use industry-standard encryption for all data. Your practice sessions are private and never shared.',
                category: 'general',
                helpful: 0,
                views: 0
            },
            {
                id: 'faq_008',
                question: 'Can I practice with different accents?',
                answer: 'Yes! Our AI is trained on multiple English accents including US, UK, Australian, and Canadian.',
                category: 'practice',
                helpful: 0,
                views: 0
            }
        ];
    }
    
    loadArticles() {
        this.articles = [
            {
                id: 'article_001',
                title: 'Getting Started with SpeakFlow',
                content: 'Complete guide to setting up your account and first practice session...',
                category: 'general',
                readTime: 5,
                views: 0
            },
            {
                id: 'article_002',
                title: 'Mastering Pronunciation',
                content: 'Tips and techniques to improve your English pronunciation...',
                category: 'practice',
                readTime: 8,
                views: 0
            },
            {
                id: 'article_003',
                title: 'Understanding Your Scores',
                content: 'Detailed explanation of how scores are calculated and how to improve...',
                category: 'practice',
                readTime: 6,
                views: 0
            }
        ];
    }
    
    searchFAQs(query, category = null) {
        const results = [];
        const lowerQuery = query.toLowerCase();
        
        for (const faq of this.faqs) {
            if (category && faq.category !== category) continue;
            
            const questionMatch = faq.question.toLowerCase().includes(lowerQuery);
            const answerMatch = faq.answer.toLowerCase().includes(lowerQuery);
            
            if (questionMatch || answerMatch) {
                results.push({
                    ...faq,
                    relevance: (questionMatch ? 1 : 0) + (answerMatch ? 0.5 : 0)
                });
            }
        }
        
        // Sort by relevance
        results.sort((a, b) => b.relevance - a.relevance);
        
        // Track views
        results.forEach(r => r.views++);
        
        return results.slice(0, SupportConfig.faq.maxResults);
    }
    
    searchArticles(query, category = null) {
        const lowerQuery = query.toLowerCase();
        
        return this.articles.filter(article => {
            if (category && article.category !== category) return false;
            
            return article.title.toLowerCase().includes(lowerQuery) ||
                   article.content.toLowerCase().includes(lowerQuery);
        });
    }
    
    getFAQByCategory(category) {
        return this.faqs.filter(faq => faq.category === category);
    }
    
    getArticle(articleId) {
        const article = this.articles.find(a => a.id === articleId);
        if (article) {
            article.views++;
        }
        return article;
    }
    
    markFAQHelpful(faqId, helpful) {
        const faq = this.faqs.find(f => f.id === faqId);
        if (faq) {
            faq.helpful += helpful ? 1 : -1;
        }
    }
    
    suggestArticles(query) {
        const articles = this.searchArticles(query);
        const faqs = this.searchFAQs(query);
        
        return {
            articles: articles.slice(0, 3),
            faqs: faqs.slice(0, 5),
            total: articles.length + faqs.length
        };
    }
}

// ============================================
// AI SUPPORT AGENT
// ============================================

class AISupportAgent {
    constructor(knowledgeBase) {
        this.kb = knowledgeBase;
        this.conversations = new Map();
        this.intents = this.loadIntents();
    }
    
    loadIntents() {
        return {
            greeting: {
                patterns: ['hello', 'hi', 'hey', 'greetings', 'good morning', 'good afternoon'],
                responses: [
                    "Hello! How can I help you today?",
                    "Hi there! What can I assist you with?",
                    "Greetings! Feel free to ask me anything about SpeakFlow."
                ]
            },
            pricing: {
                patterns: ['price', 'cost', 'premium', 'subscription', 'upgrade', 'payment', 'billing'],
                responses: [
                    "SpeakFlow offers a free tier with 10 daily practices. Premium is $9.99/month for unlimited access.",
                    "You can upgrade to Premium for $9.99/month to get unlimited practice and advanced features.",
                    "Check our pricing page for details on Premium plans and discounts for annual subscriptions."
                ]
            },
            technical: {
                patterns: ['error', 'bug', 'not working', 'issue', 'problem', 'crash', 'microphone'],
                responses: [
                    "I'm sorry you're experiencing issues. Can you describe the problem in more detail?",
                    "Let me help troubleshoot. What exactly is happening?",
                    "For technical issues, please try clearing your cache or using Chrome browser."
                ]
            },
            practice: {
                patterns: ['practice', 'speak', 'speaking', 'exercise', 'lesson', 'score', 'feedback'],
                responses: [
                    "To start practicing, click the microphone button and begin speaking. Our AI will provide instant feedback!",
                    "You can choose from daily challenges, free practice, or guided lessons in the practice section.",
                    "Your scores are based on pronunciation, fluency, grammar, and vocabulary accuracy."
                ]
            },
            account: {
                patterns: ['account', 'login', 'signup', 'register', 'password', 'profile', 'settings'],
                responses: [
                    "You can manage your account settings in the profile section. Need help with something specific?",
                    "To reset your password, click 'Forgot Password' on the login screen.",
                    "Your account dashboard shows your progress, streak, and achievements."
                ]
            },
            goodbye: {
                patterns: ['bye', 'goodbye', 'thanks', 'thank you', 'helpful'],
                responses: [
                    "You're welcome! Come back if you have more questions.",
                    "Happy practicing! Feel free to reach out anytime.",
                    "Glad I could help! Have a great day practicing English!"
                ]
            }
        };
    }
    
    async getResponse(message, userId, conversationHistory = []) {
        const lowerMessage = message.toLowerCase();
        
        // Check knowledge base first
        const kbResults = this.kb.searchFAQs(lowerMessage);
        if (kbResults.length > 0 && kbResults[0].relevance > 0.7) {
            return {
                type: 'faq',
                message: kbResults[0].answer,
                related: kbResults.slice(1, 3),
                confidence: kbResults[0].relevance
            };
        }
        
        // Check for intents
        const intent = this.detectIntent(lowerMessage);
        if (intent && intent.confidence > 0.6) {
            const responses = this.intents[intent.name].responses;
            const response = responses[Math.floor(Math.random() * responses.length)];
            
            return {
                type: 'intent',
                message: response,
                intent: intent.name,
                confidence: intent.confidence
            };
        }
        
        // Default response with suggestions
        return {
            type: 'default',
            message: "I'm here to help! You can ask me about:\n• How to start practicing\n• Premium features and pricing\n• Technical issues\n• Account management\n• Understanding your scores",
            confidence: 0.5
        };
    }
    
    detectIntent(message) {
        let bestMatch = { name: null, confidence: 0 };
        
        for (const [intentName, intent] of Object.entries(this.intents)) {
            for (const pattern of intent.patterns) {
                if (message.includes(pattern)) {
                    const confidence = pattern.length / message.length;
                    if (confidence > bestMatch.confidence) {
                        bestMatch = { name: intentName, confidence };
                    }
                }
            }
        }
        
        return bestMatch.confidence > 0 ? bestMatch : null;
    }
    
    async escalateToHuman(userId, message, conversation) {
        // Create ticket for human agent
        const ticket = {
            id: this.generateTicketId(),
            userId,
            subject: 'Escalated from AI Chat',
            message,
            conversation,
            priority: 'medium',
            status: 'open',
            source: 'chat',
            createdAt: new Date().toISOString()
        };
        
        // In production, save to database and notify agents
        console.log('[Support] Escalated to human:', ticket);
        
        return {
            success: true,
            ticketId: ticket.id,
            message: "I've connected you with a human agent. They'll respond shortly."
        };
    }
    
    generateTicketId() {
        return `TKT_${Date.now()}_${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    }
}

// ============================================
// LIVE CHAT
// ============================================

class LiveChat {
    constructor(aiAgent, knowledgeBase) {
        this.ai = aiAgent;
        this.kb = knowledgeBase;
        this.sessions = new Map();
        this.agents = new Map();
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.loadAgents();
    }
    
    setupEventListeners() {
        // Listen for chat events
        document.addEventListener('chat:message', (e) => this.handleMessage(e.detail));
        document.addEventListener('chat:typing', (e) => this.handleTyping(e.detail));
        document.addEventListener('chat:end', (e) => this.endSession(e.detail.userId));
    }
    
    loadAgents() {
        // Load available support agents
        this.agents.set('agent_001', {
            id: 'agent_001',
            name: 'Sarah',
            status: 'online',
            skills: ['technical', 'billing', 'general']
        });
        
        this.agents.set('agent_002', {
            id: 'agent_002',
            name: 'Mike',
            status: 'online',
            skills: ['practice', 'account', 'general']
        });
    }
    
    startSession(userId, userName) {
        if (this.sessions.has(userId)) {
            return this.sessions.get(userId);
        }
        
        const session = {
            id: this.generateSessionId(),
            userId,
            userName,
            startedAt: new Date().toISOString(),
            lastActive: new Date().toISOString(),
            messages: [],
            status: 'active',
            assignedAgent: null,
            isAIActive: true
        };
        
        this.sessions.set(userId, session);
        
        // Send welcome message
        this.addMessage(userId, {
            sender: 'ai',
            text: "👋 Hi! I'm SpeakFlow's AI assistant. How can I help you today?",
            timestamp: new Date().toISOString()
        });
        
        return session;
    }
    
    async handleMessage(data) {
        const { userId, message, attachments } = data;
        
        let session = this.sessions.get(userId);
        if (!session) {
            session = this.startSession(userId, data.userName);
        }
        
        // Add user message
        this.addMessage(userId, {
            sender: 'user',
            text: message,
            attachments,
            timestamp: new Date().toISOString()
        });
        
        session.lastActive = new Date().toISOString();
        
        // Get response
        let response;
        
        if (session.isAIActive && !session.assignedAgent) {
            response = await this.ai.getResponse(message, userId, session.messages);
            
            // Check if need to escalate
            if (response.type === 'default' && response.confidence < 0.5) {
                const escalation = await this.ai.escalateToHuman(userId, message, session.messages);
                response = {
                    type: 'escalation',
                    message: escalation.message,
                    ticketId: escalation.ticketId
                };
                session.isAIActive = false;
                this.assignAgent(userId);
            }
        } else if (session.assignedAgent) {
            response = await this.getAgentResponse(session.assignedAgent, message);
        } else {
            response = {
                type: 'queued',
                message: "An agent will be with you shortly. Please hold on."
            };
        }
        
        // Add response message
        this.addMessage(userId, {
            sender: session.assignedAgent ? 'agent' : 'ai',
            text: response.message,
            type: response.type,
            timestamp: new Date().toISOString()
        });
        
        return response;
    }
    
    addMessage(userId, message) {
        const session = this.sessions.get(userId);
        if (session) {
            session.messages.push(message);
            this.emitMessage(userId, message);
        }
    }
    
    emitMessage(userId, message) {
        const event = new CustomEvent('chat:newMessage', {
            detail: { userId, message }
        });
        document.dispatchEvent(event);
    }
    
    handleTyping(data) {
        const { userId, isTyping } = data;
        const event = new CustomEvent('chat:typing', {
            detail: { userId, isTyping }
        });
        document.dispatchEvent(event);
    }
    
    assignAgent(userId) {
        const session = this.sessions.get(userId);
        if (!session) return null;
        
        // Find available agent
        const availableAgents = Array.from(this.agents.values())
            .filter(a => a.status === 'online');
        
        if (availableAgents.length > 0) {
            const agent = availableAgents[0];
            session.assignedAgent = agent;
            session.isAIActive = false;
            
            this.addMessage(userId, {
                sender: 'agent',
                text: `Hello! I'm ${agent.name}. I'll be helping you today. How can I assist?`,
                timestamp: new Date().toISOString()
            });
            
            return agent;
        }
        
        return null;
    }
    
    async getAgentResponse(agent, message) {
        // In production, this would be handled by real agents via WebSocket
        // For demo, simulate agent response
        await this.delay(2000);
        
        return {
            type: 'agent',
            message: "Thanks for your message. I'm looking into this for you. Is there anything else you'd like to share about the issue?"
        };
    }
    
    endSession(userId) {
        const session = this.sessions.get(userId);
        if (session) {
            session.status = 'ended';
            session.endedAt = new Date().toISOString();
            this.sessions.delete(userId);
            
            // Send feedback request
            const event = new CustomEvent('chat:feedback', {
                detail: { sessionId: session.id, userId }
            });
            document.dispatchEvent(event);
        }
    }
    
    generateSessionId() {
        return `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    getSession(userId) {
        return this.sessions.get(userId);
    }
    
    getActiveSessions() {
        return Array.from(this.sessions.values()).filter(s => s.status === 'active');
    }
}

// ============================================
// SUPPORT TICKET SYSTEM
// ============================================

class TicketSystem {
    constructor() {
        this.tickets = new Map();
        this.init();
    }
    
    init() {
        this.loadTickets();
    }
    
    loadTickets() {
        const saved = localStorage.getItem('support_tickets');
        if (saved) {
            try {
                const tickets = JSON.parse(saved);
                tickets.forEach(t => this.tickets.set(t.id, t));
            } catch (e) {
                console.error('Failed to load tickets:', e);
            }
        }
    }
    
    saveTickets() {
        const ticketsArray = Array.from(this.tickets.values());
        localStorage.setItem('support_tickets', JSON.stringify(ticketsArray));
    }
    
    createTicket(userId, subject, message, category = 'general', priority = 'medium') {
        const ticket = {
            id: this.generateTicketId(),
            userId,
            subject,
            message,
            category,
            priority,
            status: 'open',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            messages: [],
            attachments: []
        };
        
        this.tickets.set(ticket.id, ticket);
        this.saveTickets();
        
        // Send confirmation email
        this.sendConfirmation(ticket);
        
        return ticket;
    }
    
    addMessage(ticketId, message, sender, isInternal = false) {
        const ticket = this.tickets.get(ticketId);
        if (!ticket) return null;
        
        const msg = {
            id: this.generateMessageId(),
            sender,
            message,
            isInternal,
            timestamp: new Date().toISOString()
        };
        
        ticket.messages.push(msg);
        ticket.updatedAt = new Date().toISOString();
        this.saveTickets();
        
        return msg;
    }
    
    updateStatus(ticketId, status, resolution = null) {
        const ticket = this.tickets.get(ticketId);
        if (!ticket) return null;
        
        ticket.status = status;
        if (resolution) {
            ticket.resolution = resolution;
            ticket.resolvedAt = new Date().toISOString();
        }
        ticket.updatedAt = new Date().toISOString();
        this.saveTickets();
        
        return ticket;
    }
    
    assignAgent(ticketId, agentId) {
        const ticket = this.tickets.get(ticketId);
        if (!ticket) return null;
        
        ticket.assignedTo = agentId;
        ticket.assignedAt = new Date().toISOString();
        this.saveTickets();
        
        return ticket;
    }
    
    getTicket(ticketId) {
        return this.tickets.get(ticketId);
    }
    
    getUserTickets(userId) {
        return Array.from(this.tickets.values())
            .filter(t => t.userId === userId)
            .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    }
    
    getAllTickets(filters = {}) {
        let tickets = Array.from(this.tickets.values());
        
        if (filters.status) {
            tickets = tickets.filter(t => t.status === filters.status);
        }
        if (filters.priority) {
            tickets = tickets.filter(t => t.priority === filters.priority);
        }
        if (filters.assignedTo) {
            tickets = tickets.filter(t => t.assignedTo === filters.assignedTo);
        }
        
        return tickets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    
    getStats() {
        const tickets = Array.from(this.tickets.values());
        
        return {
            total: tickets.length,
            open: tickets.filter(t => t.status === 'open').length,
            inProgress: tickets.filter(t => t.status === 'in_progress').length,
            resolved: tickets.filter(t => t.status === 'resolved').length,
            closed: tickets.filter(t => t.status === 'closed').length,
            averageResponseTime: this.calculateAverageResponseTime(),
            averageResolutionTime: this.calculateAverageResolutionTime()
        };
    }
    
    calculateAverageResponseTime() {
        // Simplified calculation
        return 2.5; // hours
    }
    
    calculateAverageResolutionTime() {
        // Simplified calculation
        return 24; // hours
    }
    
    sendConfirmation(ticket) {
        console.log(`[Ticket] Created: ${ticket.id} for user ${ticket.userId}`);
        // In production, send email
    }
    
    generateTicketId() {
        const prefix = 'TKT';
        const number = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
        return `${prefix}${number}`;
    }
    
    generateMessageId() {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    }
}

// ============================================
// SUPPORT UI CONTROLLER
// ============================================

class SupportUIController {
    constructor(chat, tickets, knowledgeBase) {
        this.chat = chat;
        this.tickets = tickets;
        this.kb = knowledgeBase;
        this.elements = {};
        this.isChatOpen = false;
        this.init();
    }
    
    init() {
        this.bindElements();
        this.bindEvents();
        this.renderFAQ();
        this.setupChatWidget();
    }
    
    bindElements() {
        this.elements = {
            supportFab: document.getElementById('supportFab'),
            supportChat: document.getElementById('supportChat'),
            supportMessages: document.getElementById('supportMessages'),
            supportInput: document.getElementById('supportInput'),
            sendSupportBtn: document.getElementById('sendSupportBtn'),
            closeSupportBtn: document.getElementById('closeSupportBtn'),
            faqContainer: document.getElementById('faqContainer'),
            searchInput: document.getElementById('faqSearch'),
            ticketForm: document.getElementById('ticketForm'),
            createTicketBtn: document.getElementById('createTicketBtn')
        };
    }
    
    bindEvents() {
        if (this.elements.supportFab) {
            this.elements.supportFab.addEventListener('click', () => this.toggleChat());
        }
        
        if (this.elements.closeSupportBtn) {
            this.elements.closeSupportBtn.addEventListener('click', () => this.closeChat());
        }
        
        if (this.elements.sendSupportBtn) {
            this.elements.sendSupportBtn.addEventListener('click', () => this.sendMessage());
        }
        
        if (this.elements.supportInput) {
            this.elements.supportInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.sendMessage();
            });
        }
        
        if (this.elements.searchInput) {
            this.elements.searchInput.addEventListener('input', (e) => {
                this.searchFAQ(e.target.value);
            });
        }
        
        if (this.elements.createTicketBtn) {
            this.elements.createTicketBtn.addEventListener('click', () => this.showTicketForm());
        }
        
        // Listen for chat events
        document.addEventListener('chat:newMessage', (e) => {
            this.displayMessage(e.detail.message);
        });
        
        document.addEventListener('chat:typing', (e) => {
            this.showTypingIndicator(e.detail.isTyping);
        });
    }
    
    setupChatWidget() {
        // Set up auto-response for chat widget
        const userId = localStorage.getItem('userId') || 'anonymous';
        this.currentUserId = userId;
        
        // Start session when chat is opened
        if (this.elements.supportFab) {
            // Session starts on first open
        }
    }
    
    toggleChat() {
        if (this.isChatOpen) {
            this.closeChat();
        } else {
            this.openChat();
        }
    }
    
    openChat() {
        this.isChatOpen = true;
        if (this.elements.supportChat) {
            this.elements.supportChat.style.display = 'flex';
        }
        
        // Start chat session
        const userName = localStorage.getItem('userName') || 'User';
        this.chat.startSession(this.currentUserId, userName);
    }
    
    closeChat() {
        this.isChatOpen = false;
        if (this.elements.supportChat) {
            this.elements.supportChat.style.display = 'none';
        }
        
        // End session
        this.chat.endSession(this.currentUserId);
    }
    
    async sendMessage() {
        const input = this.elements.supportInput;
        const message = input.value.trim();
        
        if (!message) return;
        
        // Display user message
        this.displayMessage({
            sender: 'user',
            text: message,
            timestamp: new Date().toISOString()
        });
        
        input.value = '';
        
        // Show typing indicator
        this.showTypingIndicator(true);
        
        // Send to chat handler
        const response = await this.chat.handleMessage({
            userId: this.currentUserId,
            userName: localStorage.getItem('userName') || 'User',
            message: message
        });
        
        this.showTypingIndicator(false);
    }
    
    displayMessage(message) {
        const container = this.elements.supportMessages;
        if (!container) return;
        
        const isUser = message.sender === 'user';
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isUser ? 'user' : 'support'}`;
        messageDiv.innerHTML = `
            <div class="message-bubble">
                <div class="message-text">${this.escapeHtml(message.text)}</div>
                <div class="message-time">${new Date(message.timestamp).toLocaleTimeString()}</div>
            </div>
        `;
        
        container.appendChild(messageDiv);
        container.scrollTop = container.scrollHeight;
    }
    
    showTypingIndicator(show) {
        const container = this.elements.supportMessages;
        if (!container) return;
        
        const existingIndicator = container.querySelector('.typing-indicator');
        
        if (show && !existingIndicator) {
            const indicator = document.createElement('div');
            indicator.className = 'typing-indicator';
            indicator.innerHTML = `
                <div class="typing-dots">
                    <span></span><span></span><span></span>
                </div>
                <span>AI is typing...</span>
            `;
            container.appendChild(indicator);
            container.scrollTop = container.scrollHeight;
        } else if (!show && existingIndicator) {
            existingIndicator.remove();
        }
    }
    
    renderFAQ() {
        if (!this.elements.faqContainer) return;
        
        const faqsByCategory = {};
        for (const category of SupportConfig.faq.categories) {
            faqsByCategory[category] = this.kb.getFAQByCategory(category);
        }
        
        this.elements.faqContainer.innerHTML = `
            <div class="faq-categories">
                ${Object.entries(faqsByCategory).map(([category, faqs]) => `
                    <div class="faq-category">
                        <h3 class="category-title">${this.capitalize(category)}</h3>
                        <div class="faq-list">
                            ${faqs.map(faq => `
                                <div class="faq-item" data-id="${faq.id}">
                                    <div class="faq-question">
                                        <span class="faq-icon">❓</span>
                                        <span class="faq-text">${this.escapeHtml(faq.question)}</span>
                                        <span class="faq-toggle">▼</span>
                                    </div>
                                    <div class="faq-answer" style="display: none;">
                                        <p>${this.escapeHtml(faq.answer)}</p>
                                        <div class="faq-helpful">
                                            <span>Was this helpful?</span>
                                            <button class="helpful-yes" data-id="${faq.id}">Yes 👍</button>
                                            <button class="helpful-no" data-id="${faq.id}">No 👎</button>
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
        // Attach event listeners for FAQ items
        document.querySelectorAll('.faq-item').forEach(item => {
            const question = item.querySelector('.faq-question');
            const answer = item.querySelector('.faq-answer');
            const toggle = item.querySelector('.faq-toggle');
            
            question?.addEventListener('click', () => {
                const isVisible = answer.style.display === 'block';
                answer.style.display = isVisible ? 'none' : 'block';
                toggle.textContent = isVisible ? '▼' : '▲';
            });
        });
        
        // Helpful buttons
        document.querySelectorAll('.helpful-yes').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = btn.dataset.id;
                this.kb.markFAQHelpful(id, true);
                btn.textContent = '✓ Thanks!';
                btn.disabled = true;
            });
        });
        
        document.querySelectorAll('.helpful-no').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = btn.dataset.id;
                this.kb.markFAQHelpful(id, false);
                btn.textContent = '✓ Feedback recorded';
                btn.disabled = true;
            });
        });
    }
    
    searchFAQ(query) {
        if (!query || query.length < 2) {
            this.renderFAQ();
            return;
        }
        
        const results = this.kb.searchFAQs(query);
        
        if (!this.elements.faqContainer) return;
        
        this.elements.faqContainer.innerHTML = `
            <div class="search-results">
                <h3>Search Results for "${this.escapeHtml(query)}"</h3>
                ${results.length > 0 ? `
                    <div class="faq-list">
                        ${results.map(faq => `
                            <div class="faq-item" data-id="${faq.id}">
                                <div class="faq-question">
                                    <span class="faq-icon">❓</span>
                                    <span class="faq-text">${this.escapeHtml(faq.question)}</span>
                                    <span class="faq-toggle">▼</span>
                                </div>
                                <div class="faq-answer" style="display: none;">
                                    <p>${this.escapeHtml(faq.answer)}</p>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <p>No results found. Try different keywords or <a href="#" id="createTicketFromSearch">contact support</a>.</p>
                `}
            </div>
        `;
        
        // Re-attach event listeners for search results
        document.querySelectorAll('.faq-item').forEach(item => {
            const question = item.querySelector('.faq-question');
            const answer = item.querySelector('.faq-answer');
            const toggle = item.querySelector('.faq-toggle');
            
            question?.addEventListener('click', () => {
                const isVisible = answer.style.display === 'block';
                answer.style.display = isVisible ? 'none' : 'block';
                toggle.textContent = isVisible ? '▼' : '▲';
            });
        });
        
        const createTicketLink = document.getElementById('createTicketFromSearch');
        if (createTicketLink) {
            createTicketLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.showTicketForm();
            });
        }
    }
    
    showTicketForm() {
        const modalHtml = `
            <div class="modal active" id="ticketModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>Create Support Ticket</h2>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label class="form-label">Subject</label>
                            <input type="text" id="ticketSubject" class="form-control" placeholder="Brief description of your issue">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Category</label>
                            <select id="ticketCategory" class="form-control">
                                <option value="general">General</option>
                                <option value="technical">Technical Issue</option>
                                <option value="billing">Billing Question</option>
                                <option value="account">Account Problem</option>
                                <option value="practice">Practice Issue</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Priority</label>
                            <select id="ticketPriority" class="form-control">
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                                <option value="urgent">Urgent</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Description</label>
                            <textarea id="ticketMessage" class="form-control" rows="5" placeholder="Please provide detailed information about your issue..."></textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-primary" id="submitTicketBtn">Submit Ticket</button>
                        <button class="btn btn-outline modal-close">Cancel</button>
                    </div>
                </div>
            </div>
        `;
        
        const modal = document.createElement('div');
        modal.innerHTML
