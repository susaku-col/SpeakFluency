// ============================================
// SpeakFlow Main Application
// AI-Powered Language Learning Platform
// ============================================

// ============================================
// Application State
// ============================================

const AppState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  currentPage: 'home',
  theme: localStorage.getItem('theme') || 'light',
  language: localStorage.getItem('language') || 'en',
  notifications: [],
  unreadCount: 0
};

// ============================================
// DOM Elements
// ============================================

const DOM = {
  // Navigation
  navbar: document.getElementById('navbar'),
  mobileMenuBtn: document.getElementById('mobile-menu-toggle'),
  navLinks: document.getElementById('nav-menu'),
  
  // Modals
  loginModal: document.getElementById('login-modal'),
  signupModal: document.getElementById('signup-modal'),
  
  // Forms
  loginForm: document.getElementById('login-form'),
  signupForm: document.getElementById('signup-form'),
  
  // Buttons
  loginBtn: document.getElementById('login-btn'),
  signupBtn: document.getElementById('signup-btn'),
  logoutBtn: document.getElementById('logout-btn'),
  themeToggle: document.getElementById('theme-toggle'),
  
  // Toast
  toast: document.getElementById('toast'),
  
  // Loading
  loadingScreen: document.getElementById('loading-screen'),
  
  // Content
  mainContent: document.getElementById('main-content'),
  dashboardContent: document.getElementById('dashboard-content')
};

// ============================================
// Utility Functions
// ============================================

/**
 * Show loading state
 */
const showLoading = () => {
  AppState.isLoading = true;
  if (DOM.loadingScreen) {
    DOM.loadingScreen.style.display = 'flex';
  }
};

/**
 * Hide loading state
 */
const hideLoading = () => {
  AppState.isLoading = false;
  if (DOM.loadingScreen) {
    DOM.loadingScreen.style.opacity = '0';
    setTimeout(() => {
      DOM.loadingScreen.style.display = 'none';
      DOM.loadingScreen.style.opacity = '1';
    }, 500);
  }
};

/**
 * Show toast notification
 */
const showToast = (message, type = 'info', title = null) => {
  const toast = DOM.toast;
  if (!toast) return;
  
  const icons = {
    success: '✓',
    error: '✗',
    warning: '⚠',
    info: 'ℹ'
  };
  
  toast.innerHTML = `
    <div class="toast-icon">${icons[type] || icons.info}</div>
    <div class="toast-content">
      ${title ? `<div class="toast-title">${title}</div>` : ''}
      <div class="toast-message">${message}</div>
    </div>
    <button class="toast-close" onclick="this.parentElement.classList.remove('show')">&times;</button>
  `;
  
  toast.className = `toast toast-${type} show`;
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 5000);
};

/**
 * Format date
 */
const formatDate = (date, format = 'short') => {
  const d = new Date(date);
  if (format === 'short') {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  if (format === 'long') {
    return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }
  if (format === 'time') {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString();
};

/**
 * Format number with K/M suffix
 */
const formatNumber = (num) => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
};

/**
 * Debounce function
 */
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Throttle function
 */
const throttle = (func, limit) => {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

/**
 * Deep clone object
 */
const deepClone = (obj) => {
  return JSON.parse(JSON.stringify(obj));
};

/**
 * Generate random ID
 */
const generateId = () => {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Get query parameter from URL
 */
const getQueryParam = (param) => {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
};

/**
 * Set query parameter in URL
 */
const setQueryParam = (param, value) => {
  const url = new URL(window.location.href);
  url.searchParams.set(param, value);
  window.history.pushState({}, '', url);
};

/**
 * Remove query parameter from URL
 */
const removeQueryParam = (param) => {
  const url = new URL(window.location.href);
  url.searchParams.delete(param);
  window.history.pushState({}, '', url);
};

// ============================================
// Theme Management
// ============================================

/**
 * Apply theme
 */
const applyTheme = (theme) => {
  const themeLink = document.getElementById('theme-stylesheet');
  if (themeLink) {
    themeLink.href = `/css/themes/${theme}.css`;
  }
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  AppState.theme = theme;
  
  // Update theme toggle button
  if (DOM.themeToggle) {
    DOM.themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
  }
};

/**
 * Toggle theme
 */
const toggleTheme = () => {
  const newTheme = AppState.theme === 'light' ? 'dark' : 'light';
  applyTheme(newTheme);
  showToast(`${newTheme === 'dark' ? 'Dark' : 'Light'} mode activated`, 'info');
};

// ============================================
// Navigation
// ============================================

/**
 * Navigate to page
 */
const navigateTo = (page, params = {}) => {
  AppState.currentPage = page;
  
  // Update active nav link
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
    if (link.getAttribute('href') === `#${page}`) {
      link.classList.add('active');
    }
  });
  
  // Load page content
  loadPageContent(page, params);
  
  // Update URL
  window.history.pushState({ page }, '', `#${page}`);
  
  // Close mobile menu if open
  if (DOM.navLinks && DOM.navLinks.classList.contains('mobile-open')) {
    DOM.navLinks.classList.remove('mobile-open');
  }
};

/**
 * Load page content
 */
const loadPageContent = async (page, params = {}) => {
  showLoading();
  
  try {
    let content = '';
    
    switch (page) {
      case 'home':
        content = await loadHomePage();
        break;
      case 'dashboard':
        content = await loadDashboard();
        break;
      case 'practice':
        content = await loadPracticePage();
        break;
      case 'progress':
        content = await loadProgressPage();
        break;
      case 'profile':
        content = await loadProfilePage();
        break;
      case 'settings':
        content = await loadSettingsPage();
        break;
      default:
        content = await loadHomePage();
    }
    
    if (DOM.mainContent) {
      DOM.mainContent.innerHTML = content;
    }
    
    // Execute page-specific scripts
    executePageScripts(page);
    
  } catch (error) {
    console.error('Error loading page:', error);
    showToast('Failed to load page. Please try again.', 'error');
  } finally {
    hideLoading();
  }
};

/**
 * Load home page
 */
const loadHomePage = async () => {
  return `
    <section class="hero-section">
      <div class="hero-container">
        <div class="hero-content">
          <h1 class="hero-title">Master English Speaking with <span class="highlight">AI-Powered</span> Voice Recognition</h1>
          <p class="hero-subtitle">Speak with confidence using real-time pronunciation feedback, personalized lessons, and gamified learning experiences.</p>
          <div class="hero-buttons">
            <button onclick="navigateTo('practice')" class="btn btn-primary btn-lg">Start Speaking Now 🎤</button>
            <button class="btn btn-outline btn-lg" onclick="showDemo()">Watch Demo ▶</button>
          </div>
          <div class="hero-stats">
            <div class="stat"><span class="stat-number">50K+</span><span class="stat-label">Active Learners</span></div>
            <div class="stat"><span class="stat-number">98%</span><span class="stat-label">Satisfaction Rate</span></div>
            <div class="stat"><span class="stat-number">30+</span><span class="stat-label">Languages</span></div>
          </div>
        </div>
      </div>
    </section>
    
    <section class="features-section">
      <div class="container">
        <div class="section-header">
          <h2 class="section-title">Powerful Features for Language Mastery</h2>
        </div>
        <div class="features-grid">
          <div class="feature-card">
            <div class="feature-icon">🎯</div>
            <h3>Real-time Pronunciation</h3>
            <p>AI analyzes your speech and gives instant feedback on pronunciation accuracy.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">🤖</div>
            <h3>AI Conversation Partner</h3>
            <p>Practice real conversations with our advanced AI chatbot that adapts to your level.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">📊</div>
            <h3>Personalized Learning Path</h3>
            <p>AI creates custom lessons based on your strengths and weaknesses.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">🎮</div>
            <h3>Gamified Experience</h3>
            <p>Earn XP, unlock achievements, and maintain streaks while learning.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">📱</div>
            <h3>Offline Mode</h3>
            <p>Download lessons and practice anytime, anywhere without internet.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">👥</div>
            <h3>Community Practice</h3>
            <p>Join live speaking sessions with learners worldwide.</p>
          </div>
        </div>
      </div>
    </section>
    
    <section class="cta-section">
      <div class="container">
        <div class="cta-content">
          <h2>Ready to Start Your Language Journey?</h2>
          <p>Join 50,000+ learners already improving their English with SpeakFlow</p>
          <button onclick="navigateTo('practice')" class="btn btn-primary btn-lg">Start Speaking Free 🎤</button>
        </div>
      </div>
    </section>
  `;
};

/**
 * Load dashboard
 */
const loadDashboard = async () => {
  if (!AppState.isAuthenticated) {
    showLoginModal();
    return '<div class="container"><p>Please login to view your dashboard.</p></div>';
  }
  
  return `
    <div class="dashboard">
      <aside class="dashboard-sidebar">
        <nav class="dashboard-sidebar-nav">
          <a href="#" class="dashboard-sidebar-item active" data-dashboard-tab="overview">
            <span class="dashboard-sidebar-icon">📊</span>
            <span class="dashboard-sidebar-text">Overview</span>
          </a>
          <a href="#" class="dashboard-sidebar-item" data-dashboard-tab="progress">
            <span class="dashboard-sidebar-icon">📈</span>
            <span class="dashboard-sidebar-text">Progress</span>
          </a>
          <a href="#" class="dashboard-sidebar-item" data-dashboard-tab="achievements">
            <span class="dashboard-sidebar-icon">🏆</span>
            <span class="dashboard-sidebar-text">Achievements</span>
          </a>
          <a href="#" class="dashboard-sidebar-item" data-dashboard-tab="settings">
            <span class="dashboard-sidebar-icon">⚙️</span>
            <span class="dashboard-sidebar-text">Settings</span>
          </a>
        </nav>
      </aside>
      <main class="dashboard-main">
        <div id="dashboard-content">
          <div class="loading-spinner">Loading dashboard...</div>
        </div>
      </main>
    </div>
  `;
};

/**
 * Load practice page
 */
const loadPracticePage = async () => {
  return `
    <div class="practice-container">
      <div class="practice-header">
        <h1>Practice Speaking</h1>
        <p>Choose a lesson to start practicing</p>
      </div>
      <div class="practice-grid" id="practice-grid">
        <div class="loading-spinner">Loading lessons...</div>
      </div>
    </div>
  `;
};

/**
 * Load progress page
 */
const loadProgressPage = async () => {
  return `
    <div class="progress-container">
      <div class="progress-header">
        <h1>Your Learning Progress</h1>
        <p>Track your improvement over time</p>
      </div>
      <div class="progress-stats" id="progress-stats">
        <div class="loading-spinner">Loading statistics...</div>
      </div>
    </div>
  `;
};

/**
 * Load profile page
 */
const loadProfilePage = async () => {
  return `
    <div class="profile-container">
      <div class="profile-header">
        <div class="profile-avatar">
          <img src="/api/users/avatar" alt="Profile" id="profile-avatar">
        </div>
        <h1 id="profile-name">Loading...</h1>
        <p id="profile-email"></p>
      </div>
      <div class="profile-content">
        <div class="profile-section">
          <h3>Personal Information</h3>
          <form id="profile-form">
            <div class="form-group">
              <label>Name</label>
              <input type="text" name="name" id="profile-name-input" class="form-input">
            </div>
            <div class="form-group">
              <label>Bio</label>
              <textarea name="bio" id="profile-bio" class="form-textarea" rows="3"></textarea>
            </div>
            <button type="submit" class="btn btn-primary">Save Changes</button>
          </form>
        </div>
      </div>
    </div>
  `;
};

/**
 * Load settings page
 */
const loadSettingsPage = async () => {
  return `
    <div class="settings-container">
      <h1>Settings</h1>
      <div class="settings-section">
        <h3>Appearance</h3>
        <div class="settings-item">
          <div>
            <div class="settings-item-label">Dark Mode</div>
            <div class="settings-item-description">Toggle between light and dark theme</div>
          </div>
          <div class="settings-item-control">
            <label class="switch">
              <input type="checkbox" id="dark-mode-toggle" ${AppState.theme === 'dark' ? 'checked' : ''}>
              <span class="switch-slider"></span>
            </label>
          </div>
        </div>
      </div>
      <div class="settings-section">
        <h3>Notifications</h3>
        <div class="settings-item">
          <div>
            <div class="settings-item-label">Email Notifications</div>
            <div class="settings-item-description">Receive learning reminders via email</div>
          </div>
          <div class="settings-item-control">
            <label class="switch">
              <input type="checkbox" id="email-notifications" checked>
              <span class="switch-slider"></span>
            </label>
          </div>
        </div>
        <div class="settings-item">
          <div>
            <div class="settings-item-label">Push Notifications</div>
            <div class="settings-item-description">Receive practice reminders on your device</div>
          </div>
          <div class="settings-item-control">
            <label class="switch">
              <input type="checkbox" id="push-notifications" checked>
              <span class="switch-slider"></span>
            </label>
          </div>
        </div>
      </div>
    </div>
  `;
};

/**
 * Execute page-specific scripts
 */
const executePageScripts = (page) => {
  switch (page) {
    case 'dashboard':
      initDashboard();
      break;
    case 'practice':
      loadLessons();
      break;
    case 'progress':
      loadProgressStats();
      break;
    case 'profile':
      loadProfileData();
      break;
    case 'settings':
      initSettings();
      break;
  }
};

// ============================================
// Dashboard Functions
// ============================================

/**
 * Initialize dashboard
 */
const initDashboard = async () => {
  // Load overview tab by default
  await loadDashboardOverview();
  
  // Setup tab navigation
  document.querySelectorAll('[data-dashboard-tab]').forEach(tab => {
    tab.addEventListener('click', async (e) => {
      e.preventDefault();
      
      // Update active tab
      document.querySelectorAll('[data-dashboard-tab]').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      const tabName = tab.getAttribute('data-dashboard-tab');
      await loadDashboardTab(tabName);
    });
  });
};

/**
 * Load dashboard tab
 */
const loadDashboardTab = async (tabName) => {
  const dashboardContent = document.getElementById('dashboard-content');
  if (!dashboardContent) return;
  
  switch (tabName) {
    case 'overview':
      await loadDashboardOverview();
      break;
    case 'progress':
      await loadDashboardProgress();
      break;
    case 'achievements':
      await loadDashboardAchievements();
      break;
    case 'settings':
      await loadDashboardSettings();
      break;
  }
};

/**
 * Load dashboard overview
 */
const loadDashboardOverview = async () => {
  const dashboardContent = document.getElementById('dashboard-content');
  if (!dashboardContent) return;
  
  try {
    const response = await fetch('/api/users/stats', {
      headers: {
        'Authorization': `Bearer ${AppState.token}`
      }
    });
    
    const data = await response.json();
    
    if (data.success) {
      dashboardContent.innerHTML = `
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-card-value">${data.data.totalSessions || 0}</div>
            <div class="stat-card-label">Total Sessions</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-value">${data.data.currentStreak || 0}</div>
            <div class="stat-card-label">Current Streak</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-value">${data.data.totalXP || 0}</div>
            <div class="stat-card-label">Total XP</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-value">${data.data.level || 1}</div>
            <div class="stat-card-label">Level</div>
          </div>
        </div>
        <div class="progress-section">
          <h3>Learning Progress</h3>
          <div class="skill-list">
            <div class="skill-item">
              <span class="skill-name">Pronunciation</span>
              <div class="skill-bar"><div class="skill-bar-fill" style="width: ${data.data.pronunciationScore || 0}%"></div></div>
              <span class="skill-score">${data.data.pronunciationScore || 0}%</span>
            </div>
            <div class="skill-item">
              <span class="skill-name">Vocabulary</span>
              <div class="skill-bar"><div class="skill-bar-fill" style="width: ${data.data.vocabularyScore || 0}%"></div></div>
              <span class="skill-score">${data.data.vocabularyScore || 0}%</span>
            </div>
            <div class="skill-item">
              <span class="skill-name">Grammar</span>
              <div class="skill-bar"><div class="skill-bar-fill" style="width: ${data.data.grammarScore || 0}%"></div></div>
              <span class="skill-score">${data.data.grammarScore || 0}%</span>
            </div>
            <div class="skill-item">
              <span class="skill-name">Fluency</span>
              <div class="skill-bar"><div class="skill-bar-fill" style="width: ${data.data.fluencyScore || 0}%"></div></div>
              <span class="skill-score">${data.data.fluencyScore || 0}%</span>
            </div>
          </div>
        </div>
      `;
    }
  } catch (error) {
    console.error('Error loading dashboard:', error);
    dashboardContent.innerHTML = '<p>Failed to load dashboard data. Please try again.</p>';
  }
};

/**
 * Load dashboard progress
 */
const loadDashboardProgress = async () => {
  const dashboardContent = document.getElementById('dashboard-content');
  if (!dashboardContent) return;
  
  dashboardContent.innerHTML = `
    <div class="chart-container">
      <h3>Weekly Activity</h3>
      <canvas id="activity-chart"></canvas>
    </div>
  `;
  
  // Load chart data
  await loadActivityChart();
};

/**
 * Load activity chart
 */
const loadActivityChart = async () => {
  try {
    const response = await fetch('/api/analytics/progress?period=week', {
      headers: {
        'Authorization': `Bearer ${AppState.token}`
      }
    });
    
    const data = await response.json();
    
    if (data.success && window.Chart) {
      const ctx = document.getElementById('activity-chart')?.getContext('2d');
      if (ctx) {
        new Chart(ctx, {
          type: 'line',
          data: {
            labels: data.data.labels || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [{
              label: 'Score',
              data: data.data.values || [0, 0, 0, 0, 0, 0, 0],
              borderColor: '#4F46E5',
              backgroundColor: 'rgba(79, 70, 229, 0.1)',
              tension: 0.4,
              fill: true
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'bottom'
              }
            }
          }
        });
      }
    }
  } catch (error) {
    console.error('Error loading chart:', error);
  }
};

/**
 * Load dashboard achievements
 */
const loadDashboardAchievements = async () => {
  const dashboardContent = document.getElementById('dashboard-content');
  if (!dashboardContent) return;
  
  try {
    const response = await fetch('/api/analytics/achievements', {
      headers: {
        'Authorization': `Bearer ${AppState.token}`
      }
    });
    
    const data = await response.json();
    
    if (data.success) {
      dashboardContent.innerHTML = `
        <div class="achievements-grid">
          ${data.data.achievements.map(ach => `
            <div class="achievement-card ${ach.earned ? '' : 'locked'}">
              <div class="achievement-icon">${ach.icon}</div>
              <div class="achievement-name">${ach.name}</div>
              <div class="achievement-description">${ach.description}</div>
              ${!ach.earned ? `
                <div class="achievement-progress">
                  <div class="achievement-progress-bar">
                    <div class="achievement-progress-fill" style="width: ${ach.progress}%"></div>
                  </div>
                  <div class="achievement-progress-text">${Math.round(ach.progress)}% complete</div>
                </div>
              ` : '<div class="achievement-badge">Earned!</div>'}
            </div>
          `).join('')}
        </div>
      `;
    }
  } catch (error) {
    console.error('Error loading achievements:', error);
    dashboardContent.innerHTML = '<p>Failed to load achievements.</p>';
  }
};

/**
 * Load dashboard settings
 */
const loadDashboardSettings = async () => {
  const dashboardContent = document.getElementById('dashboard-content');
  if (!dashboardContent) return;
  
  dashboardContent.innerHTML = `
    <div class="settings-section">
      <h3>Daily Goal</h3>
      <div class="settings-item">
        <div>
          <div class="settings-item-label">Daily Practice Goal</div>
          <div class="settings-item-description">Set your daily learning target</div>
        </div>
        <div class="settings-item-control">
          <select id="daily-goal" class="form-select">
            <option value="15">15 minutes</option>
            <option value="30">30 minutes</option>
            <option value="45">45 minutes</option>
            <option value="60">60 minutes</option>
          </select>
        </div>
      </div>
    </div>
  `;
  
  // Load user preferences
  try {
    const response = await fetch('/api/users/settings', {
      headers: {
        'Authorization': `Bearer ${AppState.token}`
      }
    });
    
    const data = await response.json();
    
    if (data.success && data.data.preferences?.learning?.dailyGoal) {
      const goalSelect = document.getElementById('daily-goal');
      if (goalSelect) {
        goalSelect.value = data.data.preferences.learning.dailyGoal;
        goalSelect.addEventListener('change', async (e) => {
          await updateDailyGoal(e.target.value);
        });
      }
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
};

/**
 * Update daily goal
 */
const updateDailyGoal = async (minutes) => {
  try {
    const response = await fetch('/api/users/settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AppState.token}`
      },
      body: JSON.stringify({
        category: 'learning',
        updates: { dailyGoal: parseInt(minutes) }
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      showToast('Daily goal updated successfully!', 'success');
    }
  } catch (error) {
    console.error('Error updating daily goal:', error);
    showToast('Failed to update daily goal', 'error');
  }
};

// ============================================
// Practice Functions
// ============================================

/**
 * Load lessons
 */
const loadLessons = async () => {
  const practiceGrid = document.getElementById('practice-grid');
  if (!practiceGrid) return;
  
  try {
    const lessons = [
      { id: 1, title: 'Basic Greetings', type: 'pronunciation', duration: 10, difficulty: 'beginner', xp: 50 },
      { id: 2, title: 'Numbers 1-20', type: 'vocabulary', duration: 15, difficulty: 'beginner', xp: 50 },
      { id: 3, title: 'Present Simple Tense', type: 'grammar', duration: 20, difficulty: 'beginner', xp: 60 },
      { id: 4, title: 'Self Introduction', type: 'speaking', duration: 30, difficulty: 'beginner', xp: 80 },
      { id: 5, title: 'Daily Routines', type: 'vocabulary', duration: 20, difficulty: 'intermediate', xp: 75 },
      { id: 6, title: 'Past Tense Verbs', type: 'grammar', duration: 25, difficulty: 'intermediate', xp: 75 }
    ];
    
    practiceGrid.innerHTML = lessons.map(lesson => `
      <div class="recommendation-card" onclick="startLesson(${lesson.id})">
        <div class="recommendation-content">
          <h3 class="recommendation-title">${lesson.title}</h3>
          <p class="recommendation-description">${lesson.type} • ${lesson.duration} min</p>
          <div class="recommendation-meta">
            <span class="recommendation-difficulty ${lesson.difficulty}">${lesson.difficulty}</span>
            <span>🎯 ${lesson.xp} XP</span>
          </div>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading lessons:', error);
    practiceGrid.innerHTML = '<p>Failed to load lessons. Please try again.</p>';
  }
};

/**
 * Start lesson
 */
const startLesson = async (lessonId) => {
  if (!AppState.isAuthenticated) {
    showToast('Please login to start a lesson', 'warning');
    showLoginModal();
    return;
  }
  
  navigateTo('practice-session', { lessonId });
};

// ============================================
// Progress Functions
// ============================================

/**
 * Load progress stats
 */
const loadProgressStats = async () => {
  const progressStats = document.getElementById('progress-stats');
  if (!progressStats) return;
  
  try {
    const response = await fetch('/api/analytics/progress?period=month', {
      headers: {
        'Authorization': `Bearer ${AppState.token}`
      }
    });
    
    const data = await response.json();
    
    if (data.success) {
      progressStats.innerHTML = `
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-card-value">${data.data.summary.average || 0}</div>
            <div class="stat-card-label">Average Score</div>
            <div class="stat-card-trend ${data.data.summary.trend === 'up' ? 'stat-card-trend-up' : 'stat-card-trend-down'}">
              ${data.data.summary.trend === 'up' ? '↑' : '↓'} ${Math.abs(data.data.summary.change || 0)}%
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-card-value">${data.data.summary.best || 0}</div>
            <div class="stat-card-label">Best Score</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-value">${data.data.summary.total || 0}</div>
            <div class="stat-card-label">Total Points</div>
          </div>
        </div>
        <div class="chart-container">
          <canvas id="progress-chart"></canvas>
        </div>
      `;
      
      // Render chart
      if (window.Chart) {
        const ctx = document.getElementById('progress-chart')?.getContext('2d');
        if (ctx) {
          new Chart(ctx, {
            type: 'line',
            data: {
              labels: data.data.labels,
              datasets: [
                {
                  label: 'Score',
                  data: data.data.values,
                  borderColor: '#4F46E5',
                  backgroundColor: 'rgba(79, 70, 229, 0.1)',
                  tension: 0.4,
                  fill: true
                },
                {
                  label: '7-Day Average',
                  data: data.data.movingAverage,
                  borderColor: '#10B981',
                  borderDash: [5, 5],
                  fill: false
                }
              ]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  position: 'bottom'
                }
              }
            }
          });
        }
      }
    }
  } catch (error) {
    console.error('Error loading progress:', error);
    progressStats.innerHTML = '<p>Failed to load progress data.</p>';
  }
};

// ============================================
// Profile Functions
// ============================================

/**
 * Load profile data
 */
const loadProfileData = async () => {
  try {
    const response = await fetch('/api/users/profile', {
      headers: {
        'Authorization': `Bearer ${AppState.token}`
      }
    });
    
    const data = await response.json();
    
    if (data.success) {
      document.getElementById('profile-name').textContent = data.data.name;
      document.getElementById('profile-email').textContent = data.data.email;
      document.getElementById('profile-name-input').value = data.data.name;
      document.getElementById('profile-bio').value = data.data.bio || '';
      
      if (data.data.avatar) {
        document.getElementById('profile-avatar').src = data.data.avatar;
      }
      
      // Setup form submission
      const profileForm = document.getElementById('profile-form');
      if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          await updateProfile();
        });
      }
    }
  } catch (error) {
    console.error('Error loading profile:', error);
    showToast('Failed to load profile data', 'error');
  }
};

/**
 * Update profile
 */
const updateProfile = async () => {
  const name = document.getElementById('profile-name-input').value;
  const bio = document.getElementById('profile-bio').value;
  
  try {
    const response = await fetch('/api/users/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AppState.token}`
      },
      body: JSON.stringify({ name, bio })
    });
    
    const data = await response.json();
    
    if (data.success) {
      showToast('Profile updated successfully!', 'success');
      document.getElementById('profile-name').textContent = name;
    } else {
      showToast(data.error || 'Failed to update profile', 'error');
    }
  } catch (error) {
    console.error('Error updating profile:', error);
    showToast('Failed to update profile', 'error');
  }
};

// ============================================
// Settings Functions
// ============================================

/**
 * Initialize settings
 */
const initSettings = () => {
  const darkModeToggle = document.getElementById('dark-mode-toggle');
  if (darkModeToggle) {
    darkModeToggle.addEventListener('change', (e) => {
      if (e.target.checked) {
        applyTheme('dark');
      } else {
        applyTheme('light');
      }
    });
  }
  
  const emailNotifications = document.getElementById('email-notifications');
  if (emailNotifications) {
    emailNotifications.addEventListener('change', async (e) => {
      await updateNotificationSettings('email', e.target.checked);
    });
  }
  
  const pushNotifications = document.getElementById('push-notifications');
  if (pushNotifications) {
    pushNotifications.addEventListener('change', async (e) => {
      await updateNotificationSettings('push', e.target.checked);
      if (e.target.checked) {
        requestPushNotificationPermission();
      }
    });
  }
};

/**
 * Update notification settings
 */
const updateNotificationSettings = async (type, enabled) => {
  try {
    const response = await fetch('/api/users/settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AppState.token}`
      },
      body: JSON.stringify({
        category: 'notifications',
        updates: { [type]: enabled }
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      showToast(`${type} notifications ${enabled ? 'enabled' : 'disabled'}`, 'success');
    }
  } catch (error) {
    console.error('Error updating notification settings:', error);
  }
};

/**
 * Request push notification permission
 */
const requestPushNotificationPermission = async () => {
  if ('Notification' in window) {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      showToast('Notifications enabled!', 'success');
      await registerPushSubscription();
    }
  }
};

/**
 * Register push subscription
 */
const registerPushSubscription = async () => {
  if ('serviceWorker' in navigator && 'PushManager' in window) {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.VAPID_PUBLIC_KEY)
      });
      
      await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AppState.token}`
        },
        body: JSON.stringify(subscription)
      });
    } catch (error) {
      console.error('Error registering push subscription:', error);
    }
  }
};

/**
 * Convert base64 to Uint8Array for VAPID
 */
const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

// ============================================
// Authentication Functions
// ============================================

/**
 * Show login modal
 */
const showLoginModal = () => {
  if (DOM.loginModal) {
    DOM.loginModal.classList.add('active');
  }
};

/**
 * Show signup modal
 */
const showSignupModal = () => {
  if (DOM.signupModal) {
    DOM.signupModal.classList.add('active');
  }
};

/**
 * Hide modals
 */
const hideModals = () => {
  if (DOM.loginModal) DOM.loginModal.classList.remove('active');
  if (DOM.signupModal) DOM.signupModal.classList.remove('active');
};

/**
 * Handle login
 */
const handleLogin = async (email, password) => {
  showLoading();
  
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    
    if (data.success) {
      AppState.user = data.data.user;
      AppState.token = data.data.tokens.accessToken;
      AppState.isAuthenticated = true;
      
      localStorage.setItem('token', AppState.token);
      localStorage.setItem('user', JSON.stringify(AppState.user));
      
      showToast('Login successful! Welcome back!', 'success');
      hideModals();
      navigateTo('dashboard');
      updateUIForAuth();
    } else {
      showToast(data.error || 'Login failed', 'error');
    }
  } catch (error) {
    console.error('Login error:', error);
    showToast('Failed to login. Please try again.', 'error');
  } finally {
    hideLoading();
  }
};

/**
 * Handle signup
 */
const handleSignup = async (name, email, password, confirmPassword) => {
  if (password !== confirmPassword) {
    showToast('Passwords do not match', 'error');
    return;
  }
  
  showLoading();
  
  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name, email, password, confirmPassword })
    });
    
    const data = await response.json();
    
    if (data.success) {
      showToast('Account created successfully! Please check your email to verify.', 'success');
      hideModals();
      showLoginModal();
    } else {
      showToast(data.error || 'Registration failed', 'error');
    }
  } catch (error) {
    console.error('Signup error:', error);
    showToast('Failed to create account. Please try again.', 'error');
  } finally {
    hideLoading();
  }
};

/**
 * Handle logout
 */
const handleLogout = async () => {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AppState.token}`
      }
    });
  } catch (error) {
    console.error('Logout error:', error);
  }
  
  AppState.user = null;
  AppState.token = null;
  AppState.isAuthenticated = false;
  
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  
  showToast('Logged out successfully', 'info');
  navigateTo('home');
  updateUIForAuth();
};

/**
 * Update UI based on authentication state
 */
const updateUIForAuth = () => {
  const authButtons = document.querySelectorAll('.auth-required');
  const guestButtons = document.querySelectorAll('.guest-only');
  
  if (AppState.isAuthenticated) {
    authButtons.forEach(btn => btn.style.display = 'block');
    guestButtons.forEach(btn => btn.style.display = 'none');
    
    // Update user menu
    const userMenu = document.getElementById('user-menu');
    if (userMenu) {
      userMenu.innerHTML = `
        <div class="dropdown">
          <button class="dropdown-toggle btn-ghost">
            <span class="avatar-sm">${AppState.user?.name?.charAt(0) || 'U'}</span>
            <span>${AppState.user?.name || 'User'}</span>
          </button>
          <div class="dropdown-menu">
            <a href="#" onclick="navigateTo('profile')" class="dropdown-item">Profile</a>
            <a href="#" onclick="navigateTo('settings')" class="dropdown-item">Settings</a>
            <div class="dropdown-divider"></div>
            <a href="#" onclick="handleLogout()" class="dropdown-item">Logout</a>
          </div>
        </div>
      `;
    }
  } else {
    authButtons.forEach(btn => btn.style.display = 'none');
    guestButtons.forEach(btn => btn.style.display = 'block');
  }
};

/**
 * Check authentication on load
 */
const checkAuth = () => {
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('user');
  
  if (token && user) {
    AppState.token = token;
    AppState.user = JSON.parse(user);
    AppState.isAuthenticated = true;
    updateUIForAuth();
  }
};

// ============================================
// Demo Functions
// ============================================

/**
 * Show demo video
 */
const showDemo = () => {
  showToast('Demo video coming soon!', 'info');
};

// ============================================
// Event Listeners
// ============================================

/**
 * Setup event listeners
 */
const setupEventListeners = () => {
  // Mobile menu toggle
  if (DOM.mobileMenuBtn && DOM.navLinks) {
    DOM.mobileMenuBtn.addEventListener('click', () => {
      DOM.navLinks.classList.toggle('mobile-open');
      DOM.mobileMenuBtn.classList.toggle('active');
    });
  }
  
  // Login button
  if (DOM.loginBtn) {
    DOM.loginBtn.addEventListener('click', showLoginModal);
  }
  
  // Signup button
  if (DOM.signupBtn) {
    DOM.signupBtn.addEventListener('click', showSignupModal);
  }
  
  // Theme toggle
  if (DOM.themeToggle) {
    DOM.themeToggle.addEventListener('click', toggleTheme);
  }
  
  // Modal close buttons
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', hideModals);
  });
  
  // Close modals on outside click
  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
      hideModals();
    }
  });
  
  // Login form
  if (DOM.loginForm) {
    DOM.loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = DOM.loginForm.querySelector('input[type="email"]').value;
      const password = DOM.loginForm.querySelector('input[type="password"]').value;
      handleLogin(email, password);
    });
  }
  
  // Signup form
  if (DOM.signupForm) {
    DOM.signupForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = DOM.signupForm.querySelector('input[type="text"]').value;
      const email = DOM.signupForm.querySelector('input[type="email"]').value;
      const password = DOM.signupForm.querySelector('input[type="password"]').value;
      const confirmPassword = DOM.signupForm.querySelectorAll('input[type="password"]')[1]?.value;
      handleSignup(name, email, password, confirmPassword);
    });
  }
  
  // Navigation links
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = link.getAttribute('href').substring(1);
      navigateTo(page);
    });
  });
  
  // Handle browser back/forward
  window.addEventListener('popstate', (e) => {
    const page = e.state?.page || 'home';
    navigateTo(page);
  });
};

// ============================================
// Initialization
// ============================================

/**
 * Initialize application
 */
const init = () => {
  console.log('SpeakFlow application initializing...');
  
  // Apply saved theme
  applyTheme(AppState.theme);
  
  // Check authentication
  checkAuth();
  
  // Setup event listeners
  setupEventListeners();
  
  // Handle initial page
  const initialPage = window.location.hash.substring(1) || 'home';
  navigateTo(initialPage);
  
  // Hide loading screen after initial load
  setTimeout(() => {
    hideLoading();
  }, 1000);
  
  console.log('SpeakFlow application ready!');
};

// ============================================
// Export for global access
// ============================================

// Make functions globally available
window.AppState = AppState;
window.navigateTo = navigateTo;
window.startLesson = startLesson;
window.showDemo = showDemo;
window.handleLogout = handleLogout;
window.showLoginModal = showLoginModal;
window.showSignupModal = showSignupModal;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
