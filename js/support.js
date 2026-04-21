// ============================================
// SpeakFlow Support Module
// Customer Support & Ticket Management
// ============================================

// ============================================
// Support State Management
// ============================================

const SupportState = {
    isInitialized: false,
    userId: null,
    tickets: [],
    currentTicket: null,
    activeChat: null,
    isChatOpen: false,
    unreadCount: 0,
    notifications: [],
    knowledgeBase: [],
    faqCategories: [],
    templates: []
};

// ============================================
// Configuration
// ============================================

const SUPPORT_CONFIG = {
    API_ENDPOINT: '/api/support',
    TICKET_ENDPOINT: '/api/support/tickets',
    CHAT_ENDPOINT: '/api/support/chat',
    FAQ_ENDPOINT: '/api/support/faq',
    WS_URL: process.env.WS_URL || 'wss://api.speakflow.com/support/ws',
    AUTO_REFRESH_INTERVAL: 30000, // 30 seconds
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    ALLOWED_FILE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain']
};

// ============================================
// Helper Functions
// ============================================

/**
 * Get user ID from auth
 */
const getUserId = () => {
    return auth?.user?.id || localStorage.getItem('user_id') || null;
};

/**
 * Get user name from auth
 */
const getUserName = () => {
    return auth?.user?.name || localStorage.getItem('user_name') || 'User';
};

/**
 * Get user email from auth
 */
const getUserEmail = () => {
    return auth?.user?.email || localStorage.getItem('user_email') || null;
};

/**
 * Format date
 */
const formatDate = (date) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now - d;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)} days ago`;
    
    return d.toLocaleDateString();
};

/**
 * Show toast notification
 */
const showToast = (message, type = 'info', title = null) => {
    if (window.showToast) {
        window.showToast(message, type, title);
    } else {
        console.log(`[Support] ${type}: ${message}`);
    }
};

/**
 * Escape HTML
 */
const escapeHtml = (text) => {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
};

// ============================================
// File Upload
// ============================================

/**
 * Validate file before upload
 */
const validateFile = (file) => {
    if (file.size > SUPPORT_CONFIG.MAX_FILE_SIZE) {
        showToast(`File too large. Max size: ${SUPPORT_CONFIG.MAX_FILE_SIZE / 1024 / 1024}MB`, 'error');
        return false;
    }
    
    if (!SUPPORT_CONFIG.ALLOWED_FILE_TYPES.includes(file.type)) {
        showToast('File type not supported', 'error');
        return false;
    }
    
    return true;
};

/**
 * Upload file attachment
 */
const uploadAttachment = async (file) => {
    if (!validateFile(file)) return null;
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${auth?.token || ''}`
            },
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            return data.data;
        } else {
            showToast(data.error || 'Upload failed', 'error');
            return null;
        }
    } catch (error) {
        console.error('Upload error:', error);
        showToast('Failed to upload file', 'error');
        return null;
    }
};

// ============================================
// Ticket Management
// ============================================

/**
 * Fetch user tickets
 */
const fetchTickets = async () => {
    try {
        const response = await fetch(`${SUPPORT_CONFIG.TICKET_ENDPOINT}`, {
            headers: {
                'Authorization': `Bearer ${auth?.token || ''}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            SupportState.tickets = data.data.tickets;
            SupportState.unreadCount = data.data.unreadCount || 0;
            updateTicketUI();
            return data.data.tickets;
        }
        return [];
    } catch (error) {
        console.error('Fetch tickets error:', error);
        return [];
    }
};

/**
 * Get ticket details
 */
const getTicket = async (ticketId) => {
    try {
        const response = await fetch(`${SUPPORT_CONFIG.TICKET_ENDPOINT}/${ticketId}`, {
            headers: {
                'Authorization': `Bearer ${auth?.token || ''}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            SupportState.currentTicket = data.data;
            return data.data;
        }
        return null;
    } catch (error) {
        console.error('Get ticket error:', error);
        return null;
    }
};

/**
 * Create new ticket
 */
const createTicket = async (subject, category, message, attachments = []) => {
    try {
        const response = await fetch(SUPPORT_CONFIG.TICKET_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${auth?.token || ''}`
            },
            body: JSON.stringify({
                subject,
                category,
                message,
                attachments
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Ticket created successfully!', 'success', 'Ticket Created');
            await fetchTickets();
            return data.data;
        } else {
            showToast(data.error || 'Failed to create ticket', 'error');
            return null;
        }
    } catch (error) {
        console.error('Create ticket error:', error);
        showToast('Failed to create ticket', 'error');
        return null;
    }
};

/**
 * Add message to ticket
 */
const addTicketMessage = async (ticketId, message, attachments = []) => {
    try {
        const response = await fetch(`${SUPPORT_CONFIG.TICKET_ENDPOINT}/${ticketId}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${auth?.token || ''}`
            },
            body: JSON.stringify({
                message,
                attachments
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Refresh ticket
            await getTicket(ticketId);
            displayTicketMessages(SupportState.currentTicket);
            return data.data;
        } else {
            showToast(data.error || 'Failed to send message', 'error');
            return null;
        }
    } catch (error) {
        console.error('Add message error:', error);
        showToast('Failed to send message', 'error');
        return null;
    }
};

/**
 * Close ticket
 */
const closeTicket = async (ticketId) => {
    try {
        const response = await fetch(`${SUPPORT_CONFIG.TICKET_ENDPOINT}/${ticketId}/close`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${auth?.token || ''}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Ticket closed', 'info');
            await fetchTickets();
            return true;
        } else {
            showToast(data.error || 'Failed to close ticket', 'error');
            return false;
        }
    } catch (error) {
        console.error('Close ticket error:', error);
        showToast('Failed to close ticket', 'error');
        return false;
    }
};

/**
 * Submit satisfaction rating
 */
const submitSatisfaction = async (ticketId, rating, feedback = '') => {
    try {
        const response = await fetch(`${SUPPORT_CONFIG.TICKET_ENDPOINT}/${ticketId}/satisfaction`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${auth?.token || ''}`
            },
            body: JSON.stringify({ rating, feedback })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Thank you for your feedback!', 'success');
            return true;
        }
        return false;
    } catch (error) {
        console.error('Submit satisfaction error:', error);
        return false;
    }
};

// ============================================
// UI Rendering
// ============================================

/**
 * Update ticket UI
 */
const updateTicketUI = () => {
    const container = document.getElementById('tickets-list');
    if (!container) return;
    
    if (SupportState.tickets.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🎫</div>
                <h3 class="empty-state-title">No Tickets Yet</h3>
                <p class="empty-state-description">You haven't created any support tickets.</p>
                <button class="btn btn-primary" onclick="support.showCreateTicketModal()">Create Ticket</button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <div class="tickets-list">
            ${SupportState.tickets.map(ticket => `
                <div class="ticket-item" onclick="support.viewTicket('${ticket.id}')">
                    <div class="ticket-header">
                        <div class="ticket-title">${escapeHtml(ticket.subject)}</div>
                        <div class="ticket-status status-${ticket.status}">${ticket.status}</div>
                    </div>
                    <div class="ticket-meta">
                        <span class="ticket-id">#${ticket.ticketNumber || ticket.id.slice(-6)}</span>
                        <span class="ticket-category">${ticket.category}</span>
                        <span class="ticket-date">${formatDate(ticket.createdAt)}</span>
                    </div>
                    <div class="ticket-preview">${escapeHtml(ticket.lastMessage?.substring(0, 100) || '')}</div>
                </div>
            `).join('')}
        </div>
    `;
    
    // Update unread badge
    const unreadBadge = document.getElementById('support-unread-badge');
    if (unreadBadge) {
        unreadBadge.textContent = SupportState.unreadCount;
        unreadBadge.style.display = SupportState.unreadCount > 0 ? 'inline-flex' : 'none';
    }
};

/**
 * Display ticket messages
 */
const displayTicketMessages = (ticket) => {
    const container = document.getElementById('ticket-messages');
    if (!container) return;
    
    container.innerHTML = `
        <div class="ticket-header-detail">
            <h3>${escapeHtml(ticket.subject)}</h3>
            <div class="ticket-status status-${ticket.status}">${ticket.status}</div>
        </div>
        <div class="ticket-info">
            <span>Ticket #${ticket.ticketNumber || ticket.id.slice(-6)}</span>
            <span>Created: ${formatDate(ticket.createdAt)}</span>
            <span>Category: ${ticket.category}</span>
            <span>Priority: ${ticket.priority}</span>
        </div>
        <div class="messages-container">
            ${ticket.messages.map(msg => `
                <div class="message-item ${msg.senderRole === 'user' ? 'user-message' : 'agent-message'}">
                    <div class="message-header">
                        <span class="message-sender">${escapeHtml(msg.senderName)}</span>
                        <span class="message-time">${formatDate(msg.createdAt)}</span>
                    </div>
                    <div class="message-body">${escapeHtml(msg.message)}</div>
                    ${msg.attachments?.length ? `
                        <div class="message-attachments">
                            ${msg.attachments.map(att => `
                                <a href="${att.url}" target="_blank" class="attachment-link">
                                    📎 ${att.name}
                                </a>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            `).join('')}
        </div>
        ${ticket.status !== 'closed' ? `
            <div class="reply-form">
                <textarea id="reply-message" class="form-textarea" rows="3" placeholder="Type your reply..."></textarea>
                <div class="reply-actions">
                    <button class="btn btn-outline" onclick="support.uploadAndAttach()">📎 Attach File</button>
                    <button class="btn btn-primary" onclick="support.sendReply('${ticket.id}')">Send Reply</button>
                </div>
            </div>
        ` : ''}
        ${ticket.status === 'resolved' && !ticket.satisfaction ? `
            <div class="satisfaction-form">
                <h4>How would you rate your support experience?</h4>
                <div class="rating-stars" id="satisfaction-rating">
                    ${[1, 2, 3, 4, 5].map(star => `
                        <span class="star" data-rating="${star}">★</span>
                    `).join('')}
                </div>
                <textarea id="satisfaction-feedback" class="form-textarea" rows="2" placeholder="Any additional feedback?"></textarea>
                <button class="btn btn-primary" onclick="support.submitRating('${ticket.id}')">Submit Rating</button>
            </div>
        ` : ''}
    `;
    
    // Scroll to bottom
    const messagesContainer = container.querySelector('.messages-container');
    if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    // Setup rating stars
    const ratingStars = container.querySelectorAll('#satisfaction-rating .star');
    if (ratingStars.length) {
        let selectedRating = 0;
        ratingStars.forEach(star => {
            star.addEventListener('click', () => {
                selectedRating = parseInt(star.dataset.rating);
                ratingStars.forEach((s, i) => {
                    s.classList.toggle('active', i < selectedRating);
                });
            });
        });
        window.pendingRating = { get: () => selectedRating };
    }
};

/**
 * Show create ticket modal
 */
const showCreateTicketModal = () => {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="modal-title">Create Support Ticket</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <form id="create-ticket-form">
                    <div class="form-group">
                        <label class="form-label">Subject</label>
                        <input type="text" name="subject" class="form-input" required placeholder="Brief description of your issue">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Category</label>
                        <select name="category" class="form-select" required>
                            <option value="technical">Technical Issue</option>
                            <option value="billing">Billing & Payment</option>
                            <option value="account">Account Management</option>
                            <option value="feature_request">Feature Request</option>
                            <option value="bug_report">Bug Report</option>
                            <option value="general">General Inquiry</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Priority</label>
                        <select name="priority" class="form-select">
                            <option value="low">Low</option>
                            <option value="medium" selected>Medium</option>
                            <option value="high">High</option>
                            <option value="urgent">Urgent</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Message</label>
                        <textarea name="message" class="form-textarea" rows="5" required placeholder="Please provide details about your issue..."></textarea>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Attachments (optional)</label>
                        <input type="file" id="ticket-attachments" multiple accept="image/*,.pdf,.txt">
                        <div id="attachment-list" class="attachment-list"></div>
                    </div>
                    <button type="submit" class="btn btn-primary btn-block">Create Ticket</button>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    const attachments = [];
    const fileInput = modal.querySelector('#ticket-attachments');
    const attachmentList = modal.querySelector('#attachment-list');
    
    fileInput.addEventListener('change', async () => {
        for (const file of fileInput.files) {
            const uploaded = await uploadAttachment(file);
            if (uploaded) {
                attachments.push(uploaded);
                const div = document.createElement('div');
                div.className = 'attachment-item';
                div.innerHTML = `
                    <span>📎 ${file.name}</span>
                    <button type="button" onclick="this.parentElement.remove()">&times;</button>
                `;
                attachmentList.appendChild(div);
            }
        }
        fileInput.value = '';
    });
    
    const closeModal = () => {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
    };
    
    modal.querySelector('.modal-close').addEventListener('click', closeModal);
    
    const form = modal.querySelector('#create-ticket-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const subject = form.querySelector('[name="subject"]').value;
        const category = form.querySelector('[name="category"]').value;
        const priority = form.querySelector('[name="priority"]').value;
        const message = form.querySelector('[name="message"]').value;
        
        await createTicket(subject, category, message, attachments);
        closeModal();
    });
};

/**
 * View ticket details
 */
const viewTicket = async (ticketId) => {
    const ticket = await getTicket(ticketId);
    if (ticket) {
        displayTicketMessages(ticket);
        
        // Show ticket modal
        const modal = document.createElement('div');
        modal.className = 'modal active modal-lg';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title">Ticket Details</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body" id="ticket-detail-body"></div>
                <div class="modal-footer">
                    ${ticket.status !== 'closed' ? `
                        <button class="btn btn-outline" onclick="support.closeTicket('${ticket.id}')">Close Ticket</button>
                    ` : ''}
                    <button class="btn btn-secondary modal-close">Close</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const body = modal.querySelector('#ticket-detail-body');
        body.innerHTML = document.getElementById('ticket-messages').innerHTML;
        
        modal.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                modal.classList.remove('active');
                setTimeout(() => modal.remove(), 300);
            });
        });
    }
};

/**
 * Send reply to ticket
 */
const sendReply = async (ticketId) => {
    const message = document.getElementById('reply-message')?.value;
    if (!message?.trim()) {
        showToast('Please enter a message', 'warning');
        return;
    }
    
    await addTicketMessage(ticketId, message);
    document.getElementById('reply-message').value = '';
};

/**
 * Submit satisfaction rating
 */
const submitRating = async (ticketId) => {
    const rating = window.pendingRating?.get() || 0;
    const feedback = document.getElementById('satisfaction-feedback')?.value || '';
    
    if (rating === 0) {
        showToast('Please select a rating', 'warning');
        return;
    }
    
    await submitSatisfaction(ticketId, rating, feedback);
    await viewTicket(ticketId);
};

// ============================================
// Live Chat
// ============================================

let ws = null;
let chatMessageHandlers = [];

/**
 * Initialize WebSocket connection
 */
const initWebSocket = () => {
    if (ws && ws.readyState === WebSocket.OPEN) return;
    
    ws = new WebSocket(SUPPORT_CONFIG.WS_URL);
    
    ws.onopen = () => {
        console.log('Support chat connected');
        ws.send(JSON.stringify({
            type: 'auth',
            token: auth?.token
        }));
    };
    
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleChatMessage(data);
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
    
    ws.onclose = () => {
        console.log('Support chat disconnected');
        setTimeout(() => initWebSocket(), 5000);
    };
};

/**
 * Handle chat message
 */
const handleChatMessage = (data) => {
    switch (data.type) {
        case 'message':
            addChatMessage(data.message);
            break;
        case 'agent_joined':
            showToast(`${data.agentName} has joined the chat`, 'info');
            break;
        case 'agent_left':
            showToast(`${data.agentName} has left the chat`, 'info');
            break;
        case 'typing':
            showTypingIndicator(data.agentName);
            break;
    }
};

/**
 * Start live chat
 */
const startLiveChat = async () => {
    try {
        const response = await fetch(`${SUPPORT_CONFIG.CHAT_ENDPOINT}/start`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${auth?.token || ''}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            SupportState.activeChat = data.data;
            SupportState.isChatOpen = true;
            initWebSocket();
            showChatModal();
        } else {
            showToast(data.error || 'Failed to start chat', 'error');
        }
    } catch (error) {
        console.error('Start chat error:', error);
        showToast('Failed to start chat', 'error');
    }
};

/**
 * Show chat modal
 */
const showChatModal = () => {
    const modal = document.createElement('div');
    modal.className = 'modal active chat-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="modal-title">Live Support Chat</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="chat-messages" id="chat-messages"></div>
                <div class="chat-input-container">
                    <textarea id="chat-input" class="form-textarea" rows="2" placeholder="Type your message..."></textarea>
                    <button class="btn btn-primary" id="chat-send">Send</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    const messagesContainer = modal.querySelector('#chat-messages');
    const input = modal.querySelector('#chat-input');
    const sendBtn = modal.querySelector('#chat-send');
    
    const sendMessage = () => {
        const message = input.value.trim();
        if (message) {
            ws.send(JSON.stringify({
                type: 'message',
                message: message,
                sessionId: SupportState.activeChat?.id
            }));
            addChatMessage({ message, sender: 'user', timestamp: new Date() });
            input.value = '';
        }
    };
    
    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    modal.querySelector('.modal-close').addEventListener('click', () => {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
        SupportState.isChatOpen = false;
        if (ws) ws.close();
    });
    
    chatMessageHandlers.push((msg) => {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${msg.sender === 'user' ? 'user-message' : 'agent-message'}`;
        messageDiv.innerHTML = `
            <div class="message-sender">${msg.sender === 'user' ? 'You' : 'Support Agent'}</div>
            <div class="message-text">${escapeHtml(msg.message)}</div>
            <div class="message-time">${formatDate(msg.timestamp)}</div>
        `;
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });
};

/**
 * Add chat message
 */
const addChatMessage = (message) => {
    chatMessageHandlers.forEach(handler => handler(message));
};

/**
 * Show typing indicator
 */
const showTypingIndicator = (agentName) => {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) {
        indicator.textContent = `${agentName} is typing...`;
        setTimeout(() => {
            indicator.textContent = '';
        }, 2000);
    }
};

// ============================================
// FAQ & Knowledge Base
// ============================================

/**
 * Fetch FAQ categories
 */
const fetchFaqCategories = async () => {
    try {
        const response = await fetch(`${SUPPORT_CONFIG.FAQ_ENDPOINT}/categories`);
        const data = await response.json();
        
        if (data.success) {
            SupportState.faqCategories = data.data;
            return data.data;
        }
        return [];
    } catch (error) {
        console.error('Fetch categories error:', error);
        return [];
    }
};

/**
 * Fetch FAQ articles
 */
const fetchFaqArticles = async (categoryId = null) => {
    try {
        let url = `${SUPPORT_CONFIG.FAQ_ENDPOINT}/articles`;
        if (categoryId) url += `?categoryId=${categoryId}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success) {
            SupportState.knowledgeBase = data.data;
            return data.data;
        }
        return [];
    } catch (error) {
        console.error('Fetch articles error:', error);
        return [];
    }
};

/**
 * Search FAQ
 */
const searchFaq = async (query) => {
    if (!query || query.length < 2) return [];
    
    try {
        const response = await fetch(`${SUPPORT_CONFIG.FAQ_ENDPOINT}/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        if (data.success) {
            return data.data.results;
        }
        return [];
    } catch (error) {
        console.error('Search FAQ error:', error);
        return [];
    }
};

/**
 * Get article details
 */
const getArticle = async (articleId) => {
    try {
        const response = await fetch(`${SUPPORT_CONFIG.FAQ_ENDPOINT}/articles/${articleId}`);
        const data = await response.json();
        
        if (data.success) {
            return data.data;
        }
        return null;
    } catch (error) {
        console.error('Get article error:', error);
        return null;
    }
};

/**
 * Submit article feedback
 */
const submitArticleFeedback = async (articleId, helpful) => {
    try {
        const response = await fetch(`${SUPPORT_CONFIG.FAQ_ENDPOINT}/articles/${articleId}/feedback`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ helpful })
        });
        
        const data = await response.json();
        return data.success;
    } catch (error) {
        console.error('Submit feedback error:', error);
        return false;
    }
};

/**
 * Display FAQ
 */
const displayFaq = async () => {
    const container = document.getElementById('faq-container');
    if (!container) return;
    
    const categories = await fetchFaqCategories();
    
    container.innerHTML = `
        <div class="faq-search">
            <input type="text" id="faq-search" class="form-input" placeholder="Search for answers...">
        </div>
        <div class="faq-categories">
            ${categories.map(cat => `
                <button class="faq-category-btn" data-category="${cat.id}">
                    <span class="category-icon">${cat.icon}</span>
                    <span class="category-name">${escapeHtml(cat.name)}</span>
                </button>
            `).join('')}
        </div>
        <div id="faq-articles" class="faq-articles"></div>
    `;
    
    // Load initial articles
    await loadFaqArticles();
    
    // Setup search
    const searchInput = document.getElementById('faq-search');
    let searchTimeout;
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(async () => {
            const results = await searchFaq(searchInput.value);
            displaySearchResults(results);
        }, 300);
    });
    
    // Setup category buttons
    document.querySelectorAll('.faq-category-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const categoryId = btn.dataset.category;
            await loadFaqArticles(categoryId);
        });
    });
};

/**
 * Load FAQ articles
 */
const loadFaqArticles = async (categoryId = null) => {
    const articles = await fetchFaqArticles(categoryId);
    const container = document.getElementById('faq-articles');
    
    if (!container) return;
    
    if (articles.length === 0) {
        container.innerHTML = '<p class="no-results">No articles found.</p>';
        return;
    }
    
    container.innerHTML = `
        <div class="articles-grid">
            ${articles.map(article => `
                <div class="article-card" onclick="support.viewArticle('${article.id}')">
                    <h4 class="article-title">${escapeHtml(article.title)}</h4>
                    <p class="article-excerpt">${escapeHtml(article.excerpt || article.content.substring(0, 100))}...</p>
                    <div class="article-meta">
                        <span>👍 ${article.helpful || 0} found helpful</span>
                        <span>👁️ ${article.views || 0} views</span>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
};

/**
 * Display search results
 */
const displaySearchResults = (results) => {
    const container = document.getElementById('faq-articles');
    if (!container) return;
    
    if (results.length === 0) {
        container.innerHTML = '<p class="no-results">No results found. Try different keywords.</p>';
        return;
    }
    
    container.innerHTML = `
        <div class="search-results">
            <h3>Search Results (${results.length})</h3>
            <div class="articles-grid">
                ${results.map(result => `
                    <div class="article-card" onclick="support.viewArticle('${result.id}')">
                        <h4 class="article-title">${escapeHtml(result.title)}</h4>
                        <p class="article-excerpt">${escapeHtml(result.excerpt)}</p>
                        <div class="article-relevance">Relevance: ${Math.round(result.relevance)}%</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
};

/**
 * View article
 */
const viewArticle = async (articleId) => {
    const article = await getArticle(articleId);
    if (!article) return;
    
    const modal = document.createElement('div');
    modal.className = 'modal active modal-lg';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="modal-title">${escapeHtml(article.title)}</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="article-content">${article.content}</div>
                <div class="article-feedback">
                    <p>Was this article helpful?</p>
                    <button class="btn btn-outline" onclick="support.submitArticleFeedback('${article.id}', true)">👍 Yes</button>
                    <button class="btn btn-outline" onclick="support.submitArticleFeedback('${article.id}', false)">👎 No</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelector('.modal-close').addEventListener('click', () => {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
    });
};

// ============================================
// Initialization
// ============================================

/**
 * Initialize support module
 */
const initSupport = async () => {
    if (SupportState.isInitialized) return;
    
    console.log('Initializing support module...');
    
    // Set user data
    SupportState.userId = getUserId();
    
    // Fetch tickets if authenticated
    if (auth?.isAuthenticated) {
        await fetchTickets();
    }
    
    // Setup event listeners
    const supportBtn = document.getElementById('support-chat-btn');
    if (supportBtn) {
        supportBtn.addEventListener('click', startLiveChat);
    }
    
    // Auto-refresh tickets
    setInterval(async () => {
        if (auth?.isAuthenticated) {
            await fetchTickets();
        }
    }, SUPPORT_CONFIG.AUTO_REFRESH_INTERVAL);
    
    SupportState.isInitialized = true;
    
    console.log('Support module initialized');
};

// ============================================
// Export Support Module
// ============================================

const support = {
    // State
    get isInitialized() { return SupportState.isInitialized; },
    get tickets() { return SupportState.tickets; },
    get unreadCount() { return SupportState.unreadCount; },
    
    // Ticket management
    fetchTickets,
    getTicket,
    createTicket,
    addTicketMessage,
    closeTicket,
    submitSatisfaction,
    viewTicket,
    sendReply,
    submitRating,
    showCreateTicketModal,
    
    // Live chat
    startLiveChat,
    
    // FAQ
    displayFaq,
    searchFaq,
    getArticle,
    viewArticle,
    submitArticleFeedback,
    
    // File upload
    uploadAttachment,
    
    // Initialize
    init: initSupport
};

// Make support globally available
window.support = support;

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSupport);
} else {
    initSupport();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = support;
}
