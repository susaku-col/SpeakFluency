// ============================================
// SpeakFlow Onboarding Module
// User Onboarding & First-Time Experience
// ============================================

// ============================================
// Onboarding State Management
// ============================================

const OnboardingState = {
    isInitialized: false,
    hasCompleted: false,
    currentStep: 0,
    steps: [],
    userData: {
        name: '',
        email: '',
        language: 'en',
        level: 'beginner',
        interests: [],
        goals: [],
        dailyGoal: 15,
        notificationPreference: 'email'
    },
    skippable: true,
    isProcessing: false
};

// ============================================
// Configuration
// ============================================

const ONBOARDING_CONFIG = {
    STORAGE_KEY: 'onboarding_completed',
    USER_DATA_KEY: 'onboarding_user_data',
    API_ENDPOINT: '/api/onboarding',
    STEPS: [
        {
            id: 'welcome',
            title: 'Welcome to SpeakFlow!',
            description: 'Your journey to English fluency starts here.',
            icon: '🎉'
        },
        {
            id: 'profile',
            title: 'Tell us about yourself',
            description: 'Help us personalize your learning experience.',
            icon: '👤'
        },
        {
            id: 'level',
            title: 'What\'s your English level?',
            description: 'We\'ll adjust lessons to match your skills.',
            icon: '📊'
        },
        {
            id: 'interests',
            title: 'What are you interested in?',
            description: 'Choose topics you\'d like to learn about.',
            icon: '❤️'
        },
        {
            id: 'goals',
            title: 'Set your learning goals',
            description: 'What do you want to achieve?',
            icon: '🎯'
        },
        {
            id: 'preferences',
            title: 'Learning preferences',
            description: 'Customize your learning experience.',
            icon: '⚙️'
        },
        {
            id: 'complete',
            title: 'You\'re all set!',
            description: 'Let\'s start your learning journey.',
            icon: '🚀'
        }
    ]
};

// ============================================
// Helper Functions
// ============================================

/**
 * Show toast notification
 */
const showToast = (message, type = 'info', title = null) => {
    if (window.showToast) {
        window.showToast(message, type, title);
    } else {
        console.log(`[Onboarding] ${type}: ${message}`);
    }
};

/**
 * Save onboarding data to localStorage
 */
const saveToLocalStorage = () => {
    localStorage.setItem(ONBOARDING_CONFIG.STORAGE_KEY, 'true');
    localStorage.setItem(ONBOARDING_CONFIG.USER_DATA_KEY, JSON.stringify(OnboardingState.userData));
};

/**
 * Load onboarding data from localStorage
 */
const loadFromLocalStorage = () => {
    const completed = localStorage.getItem(ONBOARDING_CONFIG.STORAGE_KEY);
    const userData = localStorage.getItem(ONBOARDING_CONFIG.USER_DATA_KEY);
    
    OnboardingState.hasCompleted = completed === 'true';
    
    if (userData) {
        try {
            OnboardingState.userData = { ...OnboardingState.userData, ...JSON.parse(userData) };
        } catch (e) {
            console.error('Error loading user data:', e);
        }
    }
};

/**
 * Check if onboarding should be shown
 */
const shouldShowOnboarding = () => {
    // Check if user is new (no completed onboarding)
    if (OnboardingState.hasCompleted) return false;
    
    // Check if user is authenticated and new
    if (window.auth?.isAuthenticated) {
        const user = window.auth.user;
        if (user && user.onboardingCompleted) return false;
    }
    
    return true;
};

// ============================================
// API Calls
// ============================================

/**
 * Complete onboarding on server
 */
const completeOnboarding = async () => {
    try {
        const response = await fetch(`${ONBOARDING_CONFIG.API_ENDPOINT}/complete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${window.auth?.token || ''}`
            },
            body: JSON.stringify(OnboardingState.userData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            OnboardingState.hasCompleted = true;
            saveToLocalStorage();
            return true;
        }
        return false;
    } catch (error) {
        console.error('Complete onboarding error:', error);
        return false;
    }
};

/**
 * Save onboarding progress
 */
const saveProgress = async () => {
    try {
        await fetch(`${ONBOARDING_CONFIG.API_ENDPOINT}/progress`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${window.auth?.token || ''}`
            },
            body: JSON.stringify({
                step: OnboardingState.currentStep,
                data: OnboardingState.userData
            })
        });
    } catch (error) {
        console.error('Save progress error:', error);
    }
};

// ============================================
// Step Rendering
// ============================================

/**
 * Render current step
 */
const renderStep = () => {
    const step = ONBOARDING_CONFIG.STEPS[OnboardingState.currentStep];
    const container = document.getElementById('onboarding-container');
    if (!container) return;
    
    let content = '';
    
    switch (step.id) {
        case 'welcome':
            content = renderWelcomeStep(step);
            break;
        case 'profile':
            content = renderProfileStep(step);
            break;
        case 'level':
            content = renderLevelStep(step);
            break;
        case 'interests':
            content = renderInterestsStep(step);
            break;
        case 'goals':
            content = renderGoalsStep(step);
            break;
        case 'preferences':
            content = renderPreferencesStep(step);
            break;
        case 'complete':
            content = renderCompleteStep(step);
            break;
        default:
            content = renderWelcomeStep(step);
    }
    
    container.innerHTML = `
        <div class="onboarding-step" data-step="${step.id}">
            <div class="step-header">
                <div class="step-icon">${step.icon}</div>
                <h2>${step.title}</h2>
                <p>${step.description}</p>
            </div>
            
            <div class="step-content">
                ${content}
            </div>
            
            <div class="step-footer">
                <div class="step-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${((OnboardingState.currentStep + 1) / ONBOARDING_CONFIG.STEPS.length) * 100}%"></div>
                    </div>
                    <span class="step-count">Step ${OnboardingState.currentStep + 1} of ${ONBOARDING_CONFIG.STEPS.length}</span>
                </div>
                <div class="step-buttons">
                    ${OnboardingState.currentStep > 0 ? '<button class="btn btn-outline" id="prev-step">Back</button>' : ''}
                    ${OnboardingState.skippable && OnboardingState.currentStep < ONBOARDING_CONFIG.STEPS.length - 1 ? '<button class="btn btn-ghost" id="skip-step">Skip</button>' : ''}
                    <button class="btn btn-primary" id="next-step">${OnboardingState.currentStep === ONBOARDING_CONFIG.STEPS.length - 1 ? 'Get Started' : 'Continue'}</button>
                </div>
            </div>
        </div>
    `;
    
    // Attach event listeners
    attachStepListeners();
    
    // Initialize step-specific functionality
    initStepFeatures();
};

/**
 * Render welcome step
 */
const renderWelcomeStep = (step) => {
    return `
        <div class="welcome-content">
            <div class="welcome-animation">
                <div class="welcome-emoji">🎤</div>
                <div class="welcome-text">Speak with confidence!</div>
            </div>
            <div class="features-preview">
                <div class="feature">
                    <span class="feature-icon">🤖</span>
                    <span>AI-powered pronunciation feedback</span>
                </div>
                <div class="feature">
                    <span class="feature-icon">🎮</span>
                    <span>Gamified learning experience</span>
                </div>
                <div class="feature">
                    <span class="feature-icon">📱</span>
                    <span>Learn anywhere, even offline</span>
                </div>
                <div class="feature">
                    <span class="feature-icon">👥</span>
                    <span>Practice with community</span>
                </div>
            </div>
        </div>
    `;
};

/**
 * Render profile step
 */
const renderProfileStep = (step) => {
    return `
        <form id="profile-form" class="onboarding-form">
            <div class="form-group">
                <label class="form-label">What's your name?</label>
                <input type="text" name="name" class="form-input" value="${escapeHtml(OnboardingState.userData.name)}" 
                       placeholder="Enter your name" required autofocus>
            </div>
            <div class="form-group">
                <label class="form-label">Your email</label>
                <input type="email" name="email" class="form-input" value="${escapeHtml(OnboardingState.userData.email)}" 
                       placeholder="Enter your email" required>
            </div>
            <div class="form-group">
                <label class="form-label">Preferred language</label>
                <select name="language" class="form-select">
                    <option value="en" ${OnboardingState.userData.language === 'en' ? 'selected' : ''}>English</option>
                    <option value="es" ${OnboardingState.userData.language === 'es' ? 'selected' : ''}>Spanish</option>
                    <option value="fr" ${OnboardingState.userData.language === 'fr' ? 'selected' : ''}>French</option>
                    <option value="ja" ${OnboardingState.userData.language === 'ja' ? 'selected' : ''}>Japanese</option>
                    <option value="ko" ${OnboardingState.userData.language === 'ko' ? 'selected' : ''}>Korean</option>
                </select>
            </div>
        </form>
    `;
};

/**
 * Render level step
 */
const renderLevelStep = (step) => {
    const levels = [
        { id: 'beginner', name: 'Beginner', description: 'I know a few words and basic phrases', icon: '🌱' },
        { id: 'elementary', name: 'Elementary', description: 'I can understand simple sentences', icon: '📘' },
        { id: 'intermediate', name: 'Intermediate', description: 'I can have basic conversations', icon: '📚' },
        { id: 'upper_intermediate', name: 'Upper Intermediate', description: 'I can discuss various topics', icon: '🎓' },
        { id: 'advanced', name: 'Advanced', description: 'I can speak fluently on most topics', icon: '🏆' }
    ];
    
    return `
        <div class="level-options">
            ${levels.map(level => `
                <div class="level-card ${OnboardingState.userData.level === level.id ? 'selected' : ''}" 
                     data-level="${level.id}">
                    <div class="level-icon">${level.icon}</div>
                    <div class="level-name">${level.name}</div>
                    <div class="level-desc">${level.description}</div>
                </div>
            `).join('')}
        </div>
    `;
};

/**
 * Render interests step
 */
const renderInterestsStep = (step) => {
    const interests = [
        { id: 'business', name: 'Business', icon: '💼', description: 'Work, meetings, presentations' },
        { id: 'travel', name: 'Travel', icon: '✈️', description: 'Airports, hotels, directions' },
        { id: 'daily_life', name: 'Daily Life', icon: '🏠', description: 'Shopping, dining, conversations' },
        { id: 'technology', name: 'Technology', icon: '💻', description: 'Tech news, software, gadgets' },
        { id: 'entertainment', name: 'Entertainment', icon: '🎬', description: 'Movies, music, games' },
        { id: 'education', name: 'Education', icon: '📖', description: 'Academic English, writing' },
        { id: 'social', name: 'Social', icon: '👥', description: 'Friends, relationships, slang' },
        { id: 'culture', name: 'Culture', icon: '🎭', description: 'Traditions, holidays, arts' }
    ];
    
    return `
        <div class="interests-grid">
            ${interests.map(interest => `
                <div class="interest-card ${OnboardingState.userData.interests.includes(interest.id) ? 'selected' : ''}" 
                     data-interest="${interest.id}">
                    <div class="interest-icon">${interest.icon}</div>
                    <div class="interest-name">${interest.name}</div>
                    <div class="interest-desc">${interest.description}</div>
                </div>
            `).join('')}
        </div>
        <p class="interests-hint">Select all that apply (you can change later)</p>
    `;
};

/**
 * Render goals step
 */
const renderGoalsStep = (step) => {
    const goals = [
        { id: 'fluency', name: 'Speak Fluently', icon: '🗣️', description: 'Have natural conversations' },
        { id: 'vocabulary', name: 'Expand Vocabulary', icon: '📖', description: 'Learn new words and phrases' },
        { id: 'pronunciation', name: 'Improve Pronunciation', icon: '🎤', description: 'Sound more native-like' },
        { id: 'grammar', name: 'Master Grammar', icon: '✍️', description: 'Write and speak correctly' },
        { id: 'listening', name: 'Better Listening', icon: '👂', description: 'Understand native speakers' },
        { id: 'exam', name: 'Pass Exam', icon: '📝', description: 'IELTS, TOEFL, or other tests' },
        { id: 'career', name: 'Career Advancement', icon: '💼', description: 'Professional English' },
        { id: 'confidence', name: 'Build Confidence', icon: '💪', description: 'Feel comfortable speaking' }
    ];
    
    return `
        <div class="goals-grid">
            ${goals.map(goal => `
                <div class="goal-card ${OnboardingState.userData.goals.includes(goal.id) ? 'selected' : ''}" 
                     data-goal="${goal.id}">
                    <div class="goal-icon">${goal.icon}</div>
                    <div class="goal-name">${goal.name}</div>
                    <div class="goal-desc">${goal.description}</div>
                </div>
            `).join('')}
        </div>
        <p class="goals-hint">Select your top 3 goals</p>
    `;
};

/**
 * Render preferences step
 */
const renderPreferencesStep = (step) => {
    return `
        <form id="preferences-form" class="onboarding-form">
            <div class="form-group">
                <label class="form-label">Daily learning goal</label>
                <div class="daily-goal-slider">
                    <input type="range" name="dailyGoal" min="5" max="60" step="5" 
                           value="${OnboardingState.userData.dailyGoal}">
                    <span class="goal-value">${OnboardingState.userData.dailyGoal} minutes/day</span>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Notification preference</label>
                <div class="notification-options">
                    <label class="radio-label">
                        <input type="radio" name="notificationPreference" value="email" 
                               ${OnboardingState.userData.notificationPreference === 'email' ? 'checked' : ''}>
                        <span>📧 Email</span>
                    </label>
                    <label class="radio-label">
                        <input type="radio" name="notificationPreference" value="push" 
                               ${OnboardingState.userData.notificationPreference === 'push' ? 'checked' : ''}>
                        <span>🔔 Push Notifications</span>
                    </label>
                    <label class="radio-label">
                        <input type="radio" name="notificationPreference" value="none" 
                               ${OnboardingState.userData.notificationPreference === 'none' ? 'checked' : ''}>
                        <span>🔕 None</span>
                    </label>
                </div>
            </div>
            <div class="form-group">
                <label class="checkbox-label">
                    <input type="checkbox" id="accept-terms" required>
                    <span>I agree to the <a href="/terms" target="_blank">Terms of Service</a> and 
                           <a href="/privacy" target="_blank">Privacy Policy</a></span>
                </label>
            </div>
        </form>
    `;
};

/**
 * Render complete step
 */
const renderCompleteStep = (step) => {
    return `
        <div class="complete-content">
            <div class="complete-animation">
                <div class="confetti"></div>
                <div class="complete-icon">🎉</div>
            </div>
            <div class="complete-summary">
                <h3>Your learning plan is ready!</h3>
                <div class="summary-card">
                    <div class="summary-item">
                        <span>Level:</span>
                        <strong>${getLevelName(OnboardingState.userData.level)}</strong>
                    </div>
                    <div class="summary-item">
                        <span>Interests:</span>
                        <strong>${OnboardingState.userData.interests.length} topics selected</strong>
                    </div>
                    <div class="summary-item">
                        <span>Daily goal:</span>
                        <strong>${OnboardingState.userData.dailyGoal} minutes</strong>
                    </div>
                </div>
                <p>We've created a personalized learning path just for you!</p>
            </div>
        </div>
    `;
};

/**
 * Get level name from ID
 */
const getLevelName = (levelId) => {
    const levels = {
        beginner: 'Beginner',
        elementary: 'Elementary',
        intermediate: 'Intermediate',
        upper_intermediate: 'Upper Intermediate',
        advanced: 'Advanced'
    };
    return levels[levelId] || 'Beginner';
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
// Step Event Handlers
// ============================================

/**
 * Attach event listeners for current step
 */
const attachStepListeners = () => {
    // Next button
    const nextBtn = document.getElementById('next-step');
    if (nextBtn) {
        nextBtn.addEventListener('click', nextStep);
    }
    
    // Previous button
    const prevBtn = document.getElementById('prev-step');
    if (prevBtn) {
        prevBtn.addEventListener('click', prevStep);
    }
    
    // Skip button
    const skipBtn = document.getElementById('skip-step');
    if (skipBtn) {
        skipBtn.addEventListener('click', skipOnboarding);
    }
};

/**
 * Initialize step-specific features
 */
const initStepFeatures = () => {
    const step = ONBOARDING_CONFIG.STEPS[OnboardingState.currentStep];
    
    switch (step.id) {
        case 'profile':
            initProfileStep();
            break;
        case 'level':
            initLevelStep();
            break;
        case 'interests':
            initInterestsStep();
            break;
        case 'goals':
            initGoalsStep();
            break;
        case 'preferences':
            initPreferencesStep();
            break;
    }
};

/**
 * Initialize profile step
 */
const initProfileStep = () => {
    const form = document.getElementById('profile-form');
    if (form) {
        const nameInput = form.querySelector('[name="name"]');
        const emailInput = form.querySelector('[name="email"]');
        const languageSelect = form.querySelector('[name="language"]');
        
        if (nameInput && window.auth?.user?.name) {
            nameInput.value = window.auth.user.name;
        }
        if (emailInput && window.auth?.user?.email) {
            emailInput.value = window.auth.user.email;
        }
        
        nameInput?.addEventListener('input', (e) => {
            OnboardingState.userData.name = e.target.value;
        });
        
        emailInput?.addEventListener('input', (e) => {
            OnboardingState.userData.email = e.target.value;
        });
        
        languageSelect?.addEventListener('change', (e) => {
            OnboardingState.userData.language = e.target.value;
        });
    }
};

/**
 * Initialize level step
 */
const initLevelStep = () => {
    const cards = document.querySelectorAll('.level-card');
    cards.forEach(card => {
        card.addEventListener('click', () => {
            cards.forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            OnboardingState.userData.level = card.dataset.level;
        });
    });
};

/**
 * Initialize interests step
 */
const initInterestsStep = () => {
    const cards = document.querySelectorAll('.interest-card');
    cards.forEach(card => {
        card.addEventListener('click', () => {
            const interestId = card.dataset.interest;
            const index = OnboardingState.userData.interests.indexOf(interestId);
            
            if (index === -1) {
                OnboardingState.userData.interests.push(interestId);
                card.classList.add('selected');
            } else {
                OnboardingState.userData.interests.splice(index, 1);
                card.classList.remove('selected');
            }
        });
    });
};

/**
 * Initialize goals step
 */
const initGoalsStep = () => {
    const cards = document.querySelectorAll('.goal-card');
    cards.forEach(card => {
        card.addEventListener('click', () => {
            const goalId = card.dataset.goal;
            const index = OnboardingState.userData.goals.indexOf(goalId);
            
            if (index === -1 && OnboardingState.userData.goals.length < 3) {
                OnboardingState.userData.goals.push(goalId);
                card.classList.add('selected');
            } else if (index !== -1) {
                OnboardingState.userData.goals.splice(index, 1);
                card.classList.remove('selected');
            }
            
            // Update hint text
            const hint = document.querySelector('.goals-hint');
            if (hint) {
                const remaining = 3 - OnboardingState.userData.goals.length;
                hint.textContent = remaining > 0 ? `Select ${remaining} more goal${remaining > 1 ? 's' : ''}` : 'Great! You\'ve selected your goals!';
            }
        });
    });
};

/**
 * Initialize preferences step
 */
const initPreferencesStep = () => {
    const form = document.getElementById('preferences-form');
    if (!form) return;
    
    const slider = form.querySelector('[name="dailyGoal"]');
    const goalValue = form.querySelector('.goal-value');
    const radios = form.querySelectorAll('[name="notificationPreference"]');
    
    if (slider) {
        slider.addEventListener('input', (e) => {
            const value = e.target.value;
            goalValue.textContent = `${value} minutes/day`;
            OnboardingState.userData.dailyGoal = parseInt(value);
        });
    }
    
    radios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.checked) {
                OnboardingState.userData.notificationPreference = e.target.value;
            }
        });
    });
};

// ============================================
// Navigation Functions
// ============================================

/**
 * Go to next step
 */
const nextStep = async () => {
    // Validate current step before proceeding
    if (!validateCurrentStep()) return;
    
    // Save current data
    saveCurrentStepData();
    
    if (OnboardingState.currentStep === ONBOARDING_CONFIG.STEPS.length - 1) {
        // Complete onboarding
        await completeOnboardingFlow();
    } else {
        // Move to next step
        OnboardingState.currentStep++;
        renderStep();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

/**
 * Go to previous step
 */
const prevStep = () => {
    if (OnboardingState.currentStep > 0) {
        OnboardingState.currentStep--;
        renderStep();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

/**
 * Skip onboarding
 */
const skipOnboarding = () => {
    if (confirm('You can always complete your profile later. Continue to dashboard?')) {
        completeOnboardingFlow(true);
    }
};

/**
 * Validate current step
 */
const validateCurrentStep = () => {
    const step = ONBOARDING_CONFIG.STEPS[OnboardingState.currentStep];
    
    switch (step.id) {
        case 'profile':
            if (!OnboardingState.userData.name) {
                showToast('Please enter your name', 'warning');
                return false;
            }
            if (!OnboardingState.userData.email && !window.auth?.isAuthenticated) {
                showToast('Please enter your email', 'warning');
                return false;
            }
            break;
        case 'interests':
            if (OnboardingState.userData.interests.length === 0) {
                showToast('Please select at least one interest', 'warning');
                return false;
            }
            break;
        case 'goals':
            if (OnboardingState.userData.goals.length === 0) {
                showToast('Please select at least one goal', 'warning');
                return false;
            }
            break;
        case 'preferences':
            const termsCheckbox = document.getElementById('accept-terms');
            if (termsCheckbox && !termsCheckbox.checked) {
                showToast('Please accept the Terms of Service', 'warning');
                return false;
            }
            break;
    }
    
    return true;
};

/**
 * Save current step data
 */
const saveCurrentStepData = () => {
    const step = ONBOARDING_CONFIG.STEPS[OnboardingState.currentStep];
    
    switch (step.id) {
        case 'profile':
            // Data already saved via input handlers
            break;
        case 'level':
            // Data already saved via card clicks
            break;
        case 'interests':
            // Data already saved via card clicks
            break;
        case 'goals':
            // Data already saved via card clicks
            break;
        case 'preferences':
            // Data already saved via form handlers
            break;
    }
    
    // Save progress to server
    saveProgress();
};

/**
 * Complete onboarding flow
 */
const completeOnboardingFlow = async (skipped = false) => {
    OnboardingState.isProcessing = true;
    showLoading();
    
    try {
        if (!skipped) {
            await completeOnboarding();
        }
        
        // Mark onboarding as completed
        OnboardingState.hasCompleted = true;
        saveToLocalStorage();
        
        // Update user object if authenticated
        if (window.auth && window.auth.user) {
            window.auth.user.onboardingCompleted = true;
        }
        
        // Hide onboarding modal/container
        const container = document.getElementById('onboarding-container');
        if (container) {
            container.classList.add('fade-out');
            setTimeout(() => {
                container.style.display = 'none';
            }, 500);
        }
        
        // Redirect to dashboard
        showToast(skipped ? 'You can complete your profile later in settings' : 'Welcome to SpeakFlow!', 'success');
        
        setTimeout(() => {
            if (window.location.pathname === '/') {
                window.location.href = '/dashboard';
            } else if (window.navigateTo) {
                window.navigateTo('dashboard');
            }
        }, 1500);
        
    } catch (error) {
        console.error('Complete onboarding error:', error);
        showToast('Something went wrong. Please try again.', 'error');
    } finally {
        OnboardingState.isProcessing = false;
        hideLoading();
    }
};

// ============================================
// Loading Helpers
// ============================================

let loadingOverlay = null;

/**
 * Show loading overlay
 */
const showLoading = () => {
    if (!loadingOverlay) {
        loadingOverlay = document.createElement('div');
        loadingOverlay.className = 'loading-overlay';
        loadingOverlay.innerHTML = '<div class="loading-spinner"></div><p>Setting up your learning path...</p>';
        document.body.appendChild(loadingOverlay);
    }
    loadingOverlay.classList.add('active');
};

/**
 * Hide loading overlay
 */
const hideLoading = () => {
    if (loadingOverlay) {
        loadingOverlay.classList.remove('active');
    }
};

// ============================================
// Onboarding Modal
// ============================================

/**
 * Show onboarding modal
 */
const showOnboardingModal = () => {
    const modal = document.createElement('div');
    modal.id = 'onboarding-modal';
    modal.className = 'modal onboarding-modal active';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-body">
                <div id="onboarding-container" class="onboarding-container"></div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Render first step
    OnboardingState.currentStep = 0;
    renderStep();
};

/**
 * Close onboarding modal
 */
const closeOnboardingModal = () => {
    const modal = document.getElementById('onboarding-modal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
    }
};

// ============================================
// Onboarding Check
// ============================================

/**
 * Check and show onboarding if needed
 */
const checkAndShowOnboarding = () => {
    loadFromLocalStorage();
    
    if (shouldShowOnboarding()) {
        showOnboardingModal();
    }
};

// ============================================
// Initialization
// ============================================

/**
 * Initialize onboarding module
 */
const initOnboarding = () => {
    if (OnboardingState.isInitialized) return;
    
    console.log('Initializing onboarding module...');
    
    // Load saved data
    loadFromLocalStorage();
    
    // Check if user is new and show onboarding
    setTimeout(() => {
        checkAndShowOnboarding();
    }, 500);
    
    OnboardingState.isInitialized = true;
    
    console.log('Onboarding module initialized');
};

// ============================================
// Export Onboarding Module
// ============================================

const onboarding = {
    // State
    get hasCompleted() { return OnboardingState.hasCompleted; },
    get currentStep() { return OnboardingState.currentStep; },
    get userData() { return OnboardingState.userData; },
    
    // Methods
    showOnboarding: showOnboardingModal,
    closeOnboarding: closeOnboardingModal,
    checkAndShow: checkAndShowOnboarding,
    completeOnboarding: completeOnboardingFlow,
    skipOnboarding: skipOnboarding,
    
    // Initialize
    init: initOnboarding
};

// Make onboarding globally available
window.onboarding = onboarding;

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOnboarding);
} else {
    initOnboarding();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = onboarding;
}
