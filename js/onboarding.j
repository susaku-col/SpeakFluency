/* ============================================
   SPEAKFLOW - ONBOARDING MODULE
   Version: 1.0.0
   Handles user onboarding, preferences collection, and first-time experience
   ============================================ */

// ============================================
// ONBOARDING CONFIGURATION
// ============================================

const OnboardingConfig = {
    // Steps Configuration
    steps: [
        { id: 'welcome', title: 'Welcome', icon: '👋', required: true },
        { id: 'goal', title: 'Learning Goal', icon: '🎯', required: true },
        { id: 'level', title: 'Current Level', icon: '📊', required: true },
        { id: 'persona', title: 'Tutor Style', icon: '👩‍🏫', required: true },
        { id: 'interests', title: 'Interests', icon: '❤️', required: false },
        { id: 'schedule', title: 'Practice Schedule', icon: '📅', required: false },
        { id: 'complete', title: 'Ready to Start', icon: '🚀', required: true }
    ],
    
    // Goals Options
    goals: [
        { id: 'ielts', name: 'IELTS/TOEFL Preparation', icon: '📚', description: 'Prepare for English proficiency tests' },
        { id: 'business', name: 'Business English', icon: '💼', description: 'Improve professional communication' },
        { id: 'daily', name: 'Daily Conversation', icon: '🗣️', description: 'Everyday English for social situations' },
        { id: 'travel', name: 'Travel English', icon: '✈️', description: 'English for traveling abroad' },
        { id: 'academic', name: 'Academic English', icon: '🎓', description: 'English for studying abroad' },
        { id: 'interview', name: 'Job Interview', icon: '💼', description: 'Prepare for English job interviews' }
    ],
    
    // Level Options
    levels: [
        { id: 'beginner', name: 'Beginner', icon: '🌱', description: 'Can understand basic phrases', proficiency: 1 },
        { id: 'elementary', name: 'Elementary', icon: '📖', description: 'Can communicate in simple tasks', proficiency: 2 },
        { id: 'intermediate', name: 'Intermediate', icon: '⭐', description: 'Can handle most situations', proficiency: 3 },
        { id: 'upper', name: 'Upper Intermediate', icon: '🌟', description: 'Can discuss complex topics', proficiency: 4 },
        { id: 'advanced', name: 'Advanced', icon: '🏆', description: 'Near-native fluency', proficiency: 5 }
    ],
    
    // Tutor Persona Options
    personas: [
        { id: 'friendly', name: 'Friendly Tutor', icon: '😊', description: 'Encouraging and supportive', traits: ['Patient', 'Encouraging', 'Positive'] },
        { id: 'strict', name: 'Strict Coach', icon: '📏', description: 'Demanding and precise', traits: ['Direct', 'Detailed', 'High standards'] },
        { id: 'fun', name: 'Fun Mentor', icon: '🎉', description: 'Energetic and engaging', traits: ['Energetic', 'Humor', 'Creative'] },
        { id: 'professional', name: 'Professional Coach', icon: '👔', description: 'Business-focused and structured', traits: ['Structured', 'Professional', 'Goal-oriented'] }
    ],
    
    // Interest Options
    interests: [
        { id: 'technology', name: 'Technology', icon: '💻', category: 'general' },
        { id: 'business', name: 'Business', icon: '📈', category: 'professional' },
        { id: 'travel', name: 'Travel', icon: '🌍', category: 'lifestyle' },
        { id: 'food', name: 'Food & Cooking', icon: '🍳', category: 'lifestyle' },
        { id: 'sports', name: 'Sports', icon: '⚽', category: 'lifestyle' },
        { id: 'movies', name: 'Movies & TV', icon: '🎬', category: 'entertainment' },
        { id: 'music', name: 'Music', icon: '🎵', category: 'entertainment' },
        { id: 'science', name: 'Science', icon: '🔬', category: 'academic' },
        { id: 'art', name: 'Art & Design', icon: '🎨', category: 'creative' },
        { id: 'health', name: 'Health & Fitness', icon: '🏃', category: 'lifestyle' }
    ],
    
    // Schedule Options (minutes per day)
    schedule: [
        { value: 5, label: '5 minutes', description: 'Quick practice' },
        { value: 10, label: '10 minutes', description: 'Light practice' },
        { value: 15, label: '15 minutes', description: 'Regular practice' },
        { value: 20, label: '20 minutes', description: 'Dedicated practice' },
        { value: 30, label: '30 minutes', description: 'Intensive practice' }
    ],
    
    // Storage Keys
    storage: {
        completed: 'onboarding_completed',
        preferences: 'user_preferences',
        step: 'onboarding_step'
    }
};

// ============================================
// ONBOARDING MANAGER
// ============================================

class OnboardingManager {
    constructor() {
        this.preferences = this.loadPreferences();
        this.currentStep = this.loadCurrentStep();
        this.isCompleted = this.loadCompletionStatus();
        this.stepCallbacks = new Map();
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.autoAdvanceIfNeeded();
    }
    
    loadPreferences() {
        const saved = localStorage.getItem(OnboardingConfig.storage.preferences);
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error('Failed to load preferences:', e);
            }
        }
        
        return {
            goal: null,
            level: null,
            persona: null,
            interests: [],
            schedule: 15,
            completedAt: null,
            version: '1.0'
        };
    }
    
    savePreferences() {
        localStorage.setItem(OnboardingConfig.storage.preferences, JSON.stringify(this.preferences));
    }
    
    loadCurrentStep() {
        const saved = localStorage.getItem(OnboardingConfig.storage.step);
        return saved ? parseInt(saved) : 0;
    }
    
    saveCurrentStep() {
        localStorage.setItem(OnboardingConfig.storage.step, this.currentStep.toString());
    }
    
    loadCompletionStatus() {
        return localStorage.getItem(OnboardingConfig.storage.completed) === 'true';
    }
    
    saveCompletionStatus() {
        localStorage.setItem(OnboardingConfig.storage.completed, this.isCompleted.toString());
    }
    
    setupEventListeners() {
        document.addEventListener('onboarding:next', () => this.nextStep());
        document.addEventListener('onboarding:prev', () => this.prevStep());
        document.addEventListener('onboarding:complete', () => this.complete());
        document.addEventListener('onboarding:skip', () => this.skip());
    }
    
    autoAdvanceIfNeeded() {
        // Check if all required steps are completed
        const requiredSteps = OnboardingConfig.steps.filter(s => s.required);
        const completedSteps = requiredSteps.every(step => {
            switch(step.id) {
                case 'goal': return this.preferences.goal !== null;
                case 'level': return this.preferences.level !== null;
                case 'persona': return this.preferences.persona !== null;
                default: return true;
            }
        });
        
        if (completedSteps && !this.isCompleted) {
            this.complete();
        }
    }
    
    setPreference(key, value) {
        this.preferences[key] = value;
        this.savePreferences();
        
        const event = new CustomEvent('onboarding:preferenceChanged', {
            detail: { key, value }
        });
        document.dispatchEvent(event);
        
        // Auto-advance for required fields
        const requiredStep = OnboardingConfig.steps.find(s => s.id === key && s.required);
        if (requiredStep && value !== null && value !== '') {
            this.nextStep();
        }
    }
    
    addInterest(interestId) {
        if (!this.preferences.interests.includes(interestId)) {
            this.preferences.interests.push(interestId);
            this.savePreferences();
            
            const event = new CustomEvent('onboarding:interestAdded', {
                detail: { interestId }
            });
            document.dispatchEvent(event);
        }
    }
    
    removeInterest(interestId) {
        this.preferences.interests = this.preferences.interests.filter(i => i !== interestId);
        this.savePreferences();
        
        const event = new CustomEvent('onboarding:interestRemoved', {
            detail: { interestId }
        });
        document.dispatchEvent(event);
    }
    
    nextStep() {
        if (this.currentStep < OnboardingConfig.steps.length - 1) {
            this.currentStep++;
            this.saveCurrentStep();
            
            const event = new CustomEvent('onboarding:stepChanged', {
                detail: { step: this.currentStep, stepData: OnboardingConfig.steps[this.currentStep] }
            });
            document.dispatchEvent(event);
        } else {
            this.complete();
        }
    }
    
    prevStep() {
        if (this.currentStep > 0) {
            this.currentStep--;
            this.saveCurrentStep();
            
            const event = new CustomEvent('onboarding:stepChanged', {
                detail: { step: this.currentStep, stepData: OnboardingConfig.steps[this.currentStep] }
            });
            document.dispatchEvent(event);
        }
    }
    
    complete() {
        this.isCompleted = true;
        this.preferences.completedAt = new Date().toISOString();
        this.savePreferences();
        this.saveCompletionStatus();
        
        const event = new CustomEvent('onboarding:completed', {
            detail: { preferences: this.preferences }
        });
        document.dispatchEvent(event);
        
        // Clear current step
        localStorage.removeItem(OnboardingConfig.storage.step);
    }
    
    skip() {
        // Set default preferences
        this.preferences.goal = 'daily';
        this.preferences.level = 'intermediate';
        this.preferences.persona = 'friendly';
        this.preferences.interests = ['technology', 'movies'];
        this.preferences.schedule = 15;
        
        this.complete();
    }
    
    reset() {
        this.preferences = {
            goal: null,
            level: null,
            persona: null,
            interests: [],
            schedule: 15,
            completedAt: null,
            version: '1.0'
        };
        this.currentStep = 0;
        this.isCompleted = false;
        
        this.savePreferences();
        this.saveCurrentStep();
        this.saveCompletionStatus();
        
        const event = new CustomEvent('onboarding:reset');
        document.dispatchEvent(event);
    }
    
    getPreferences() {
        return { ...this.preferences };
    }
    
    getCurrentStep() {
        return this.currentStep;
    }
    
    getStepData(stepId) {
        return OnboardingConfig.steps.find(s => s.id === stepId);
    }
    
    isOnboardingComplete() {
        return this.isCompleted;
    }
    
    onStep(callback) {
        document.addEventListener('onboarding:stepChanged', (e) => callback(e.detail));
    }
    
    onComplete(callback) {
        document.addEventListener('onboarding:completed', (e) => callback(e.detail));
    }
}

// ============================================
// ONBOARDING UI CONTROLLER
// ============================================

class OnboardingUIController {
    constructor(onboardingManager) {
        this.manager = onboardingManager;
        this.elements = {};
        this.currentStepElement = null;
        this.init();
    }
    
    init() {
        this.bindElements();
        this.bindEvents();
        this.renderCurrentStep();
        this.setupStepListeners();
    }
    
    bindElements() {
        this.elements = {
            modal: document.getElementById('onboardingModal'),
            stepContainer: document.getElementById('onboardingSteps'),
            progressBar: document.getElementById('onboardingProgress'),
            progressIndicator: document.querySelector('.progress-indicator'),
            nextBtn: document.getElementById('nextStep'),
            prevBtn: document.getElementById('prevStep'),
            skipBtn: document.getElementById('skipOnboarding'),
            stepTitle: document.getElementById('stepTitle')
        };
    }
    
    bindEvents() {
        if (this.elements.nextBtn) {
            this.elements.nextBtn.addEventListener('click', () => this.next());
        }
        
        if (this.elements.prevBtn) {
            this.elements.prevBtn.addEventListener('click', () => this.prev());
        }
        
        if (this.elements.skipBtn) {
            this.elements.skipBtn.addEventListener('click', () => this.skip());
        }
        
        document.addEventListener('onboarding:stepChanged', (e) => {
            this.renderCurrentStep();
            this.updateProgress();
        });
        
        document.addEventListener('onboarding:completed', () => {
            this.close();
        });
    }
    
    setupStepListeners() {
        // Listen for preference changes to auto-advance
        document.addEventListener('onboarding:preferenceChanged', (e) => {
            const { key, value } = e.detail;
            if (key === 'goal' || key === 'level' || key === 'persona') {
                setTimeout(() => {
                    if (this.manager.preferences[key] !== null) {
                        this.next();
                    }
                }, 500);
            }
        });
    }
    
    renderCurrentStep() {
        const stepIndex = this.manager.getCurrentStep();
        const step = OnboardingConfig.steps[stepIndex];
        
        if (!step) return;
        
        // Update title
        if (this.elements.stepTitle) {
            this.elements.stepTitle.textContent = `${step.icon} ${step.title}`;
        }
        
        // Render step content
        if (this.elements.stepContainer) {
            this.elements.stepContainer.innerHTML = this.renderStepContent(step);
        }
        
        // Update button states
        this.updateButtons(stepIndex);
        
        // Attach step-specific event handlers
        this.attachStepHandlers(step.id);
    }
    
    renderStepContent(step) {
        switch(step.id) {
            case 'welcome':
                return this.renderWelcomeStep();
            case 'goal':
                return this.renderGoalStep();
            case 'level':
                return this.renderLevelStep();
            case 'persona':
                return this.renderPersonaStep();
            case 'interests':
                return this.renderInterestsStep();
            case 'schedule':
                return this.renderScheduleStep();
            case 'complete':
                return this.renderCompleteStep();
            default:
                return '<div>Loading...</div>';
        }
    }
    
    renderWelcomeStep() {
        return `
            <div class="onboarding-welcome">
                <div class="welcome-icon">🎙️</div>
                <h2>Welcome to SpeakFlow!</h2>
                <p>Your personal AI English speaking coach.</p>
                <div class="welcome-features">
                    <div class="feature">
                        <span class="feature-icon">🎤</span>
                        <span>Real-time voice feedback</span>
                    </div>
                    <div class="feature">
                        <span class="feature-icon">🧠</span>
                        <span>Personalized learning</span>
                    </div>
                    <div class="feature">
                        <span class="feature-icon">🏆</span>
                        <span>Gamified experience</span>
                    </div>
                </div>
                <p class="welcome-note">Let's set up your profile in just a few steps!</p>
            </div>
        `;
    }
    
    renderGoalStep() {
        const selectedGoal = this.manager.preferences.goal;
        
        return `
            <div class="onboarding-goal">
                <p class="step-description">What's your primary goal for learning English?</p>
                <div class="options-grid">
                    ${OnboardingConfig.goals.map(goal => `
                        <div class="option-card ${selectedGoal === goal.id ? 'selected' : ''}" data-goal="${goal.id}">
                            <div class="option-icon">${goal.icon}</div>
                            <div class="option-name">${goal.name}</div>
                            <div class="option-desc">${goal.description}</div>
                            ${selectedGoal === goal.id ? '<div class="check-mark">✓</div>' : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    renderLevelStep() {
        const selectedLevel = this.manager.preferences.level;
        
        return `
            <div class="onboarding-level">
                <p class="step-description">How would you rate your current English level?</p>
                <div class="options-list">
                    ${OnboardingConfig.levels.map(level => `
                        <div class="option-item ${selectedLevel === level.id ? 'selected' : ''}" data-level="${level.id}">
                            <div class="option-icon">${level.icon}</div>
                            <div class="option-content">
                                <div class="option-name">${level.name}</div>
                                <div class="option-desc">${level.description}</div>
                            </div>
                            ${selectedLevel === level.id ? '<div class="check-mark">✓</div>' : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    renderPersonaStep() {
        const selectedPersona = this.manager.preferences.persona;
        
        return `
            <div class="onboarding-persona">
                <p class="step-description">Choose your preferred tutor style</p>
                <div class="options-grid">
                    ${OnboardingConfig.personas.map(persona => `
                        <div class="option-card ${selectedPersona === persona.id ? 'selected' : ''}" data-persona="${persona.id}">
                            <div class="option-icon">${persona.icon}</div>
                            <div class="option-name">${persona.name}</div>
                            <div class="option-desc">${persona.description}</div>
                            <div class="persona-traits">
                                ${persona.traits.map(t => `<span class="trait">${t}</span>`).join('')}
                            </div>
                            ${selectedPersona === persona.id ? '<div class="check-mark">✓</div>' : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    renderInterestsStep() {
        const selectedInterests = this.manager.preferences.interests;
        
        return `
            <div class="onboarding-interests">
                <p class="step-description">Select topics you're interested in (optional)</p>
                <p class="step-note">This helps us personalize your practice content</p>
                <div class="interests-grid">
                    ${OnboardingConfig.interests.map(interest => `
                        <div class="interest-chip ${selectedInterests.includes(interest.id) ? 'selected' : ''}" data-interest="${interest.id}">
                            <span class="interest-icon">${interest.icon}</span>
                            <span class="interest-name">${interest.name}</span>
                        </div>
                    `).join('')}
                </div>
                <p class="selected-count">${selectedInterests.length} interests selected</p>
            </div>
        `;
    }
    
    renderScheduleStep() {
        const selectedSchedule = this.manager.preferences.schedule;
        
        return `
            <div class="onboarding-schedule">
                <p class="step-description">How much time can you dedicate daily?</p>
                <div class="schedule-options">
                    ${OnboardingConfig.schedule.map(opt => `
                        <div class="schedule-option ${selectedSchedule === opt.value ? 'selected' : ''}" data-schedule="${opt.value}">
                            <div class="schedule-value">${opt.label}</div>
                            <div class="schedule-desc">${opt.description}</div>
                        </div>
                    `).join('')}
                </div>
                <p class="schedule-note">Don't worry, you can always change this later!</p>
            </div>
        `;
    }
    
    renderCompleteStep() {
        const prefs = this.manager.preferences;
        const goal = OnboardingConfig.goals.find(g => g.id === prefs.goal);
        const level = OnboardingConfig.levels.find(l => l.id === prefs.level);
        const persona = OnboardingConfig.personas.find(p => p.id === prefs.persona);
        
        return `
            <div class="onboarding-complete">
                <div class="complete-icon">🎉</div>
                <h2>You're all set!</h2>
                <div class="complete-summary">
                    <div class="summary-item">
                        <span class="summary-label">Goal:</span>
                        <span class="summary-value">${goal?.name || 'Daily Conversation'}</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">Level:</span>
                        <span class="summary-value">${level?.name || 'Intermediate'}</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">Tutor:</span>
                        <span class="summary-value">${persona?.name || 'Friendly Tutor'}</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">Daily Goal:</span>
                        <span class="summary-value">${prefs.schedule} minutes</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">Interests:</span>
                        <span class="summary-value">${prefs.interests.length} selected</span>
                    </div>
                </div>
                <p>Ready to start your English speaking journey?</p>
                <button class="btn btn-primary start-speaking-btn">Start Speaking Now! 🎤</button>
            </div>
        `;
    }
    
    attachStepHandlers(stepId) {
        switch(stepId) {
            case 'goal':
                this.attachGoalHandlers();
                break;
            case 'level':
                this.attachLevelHandlers();
                break;
            case 'persona':
                this.attachPersonaHandlers();
                break;
            case 'interests':
                this.attachInterestsHandlers();
                break;
            case 'schedule':
                this.attachScheduleHandlers();
                break;
            case 'complete':
                this.attachCompleteHandlers();
                break;
        }
    }
    
    attachGoalHandlers() {
        document.querySelectorAll('[data-goal]').forEach(el => {
            el.addEventListener('click', () => {
                const goalId = el.dataset.goal;
                this.manager.setPreference('goal', goalId);
                this.renderCurrentStep(); // Re-render to show selection
            });
        });
    }
    
    attachLevelHandlers() {
        document.querySelectorAll('[data-level]').forEach(el => {
            el.addEventListener('click', () => {
                const levelId = el.dataset.level;
                this.manager.setPreference('level', levelId);
                this.renderCurrentStep();
            });
        });
    }
    
    attachPersonaHandlers() {
        document.querySelectorAll('[data-persona]').forEach(el => {
            el.addEventListener('click', () => {
                const personaId = el.dataset.persona;
                this.manager.setPreference('persona', personaId);
                this.renderCurrentStep();
            });
        });
    }
    
    attachInterestsHandlers() {
        document.querySelectorAll('.interest-chip').forEach(el => {
            el.addEventListener('click', () => {
                const interestId = el.dataset.interest;
                if (this.manager.preferences.interests.includes(interestId)) {
                    this.manager.removeInterest(interestId);
                } else {
                    this.manager.addInterest(interestId);
                }
                this.renderCurrentStep();
            });
        });
    }
    
    attachScheduleHandlers() {
        document.querySelectorAll('[data-schedule]').forEach(el => {
            el.addEventListener('click', () => {
                const schedule = parseInt(el.dataset.schedule);
                this.manager.setPreference('schedule', schedule);
                this.renderCurrentStep();
            });
        });
    }
    
    attachCompleteHandlers() {
        const startBtn = document.querySelector('.start-speaking-btn');
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                this.manager.complete();
            });
        }
    }
    
    updateButtons(stepIndex) {
        const isFirstStep = stepIndex === 0;
        const isLastStep = stepIndex === OnboardingConfig.steps.length - 1;
        const isRequiredStep = OnboardingConfig.steps[stepIndex].required;
        
        if (this.elements.prevBtn) {
            this.elements.prevBtn.style.display = isFirstStep ? 'none' : 'inline-flex';
        }
        
        if (this.elements.nextBtn) {
            if (isLastStep) {
                this.elements.nextBtn.textContent = 'Complete';
            } else {
                this.elements.nextBtn.textContent = 'Next';
            }
        }
        
        this.updateProgress();
    }
    
    updateProgress() {
        const stepIndex = this.manager.getCurrentStep();
        const totalSteps = OnboardingConfig.steps.length;
        const progress = ((stepIndex + 1) / totalSteps) * 100;
        
        if (this.elements.progressBar) {
            this.elements.progressBar.style.width = `${progress}%`;
        }
        
        if (this.elements.progressIndicator) {
            const steps = ['⚫', '⚫', '⚫', '⚫', '⚫', '⚫', '⚫'];
            for (let i = 0; i <= stepIndex; i++) {
                steps[i] = '🔵';
            }
            this.elements.progressIndicator.innerHTML = steps.join('');
        }
    }
    
    next() {
        const stepId = OnboardingConfig.steps[this.manager.getCurrentStep()].id;
        
        // Validate required fields
        switch(stepId) {
            case 'goal':
                if (!this.manager.preferences.goal) {
                    this.showError('Please select a learning goal');
                    return;
                }
                break;
            case 'level':
                if (!this.manager.preferences.level) {
                    this.showError('Please select your English level');
                    return;
                }
                break;
            case 'persona':
                if (!this.manager.preferences.persona) {
                    this.showError('Please select a tutor style');
                    return;
                }
                break;
        }
        
        this.manager.nextStep();
    }
    
    prev() {
        this.manager.prevStep();
    }
    
    skip() {
        if (confirm('Skip onboarding? You can always set preferences later in settings.')) {
            this.manager.skip();
        }
    }
    
    show() {
        if (this.elements.modal) {
            this.elements.modal.style.display = 'flex';
            this.renderCurrentStep();
        }
    }
    
    close() {
        if (this.elements.modal) {
            this.elements.modal.style.display = 'none';
        }
        
        // Dispatch event that onboarding is complete
        const event = new CustomEvent('onboarding:uiClosed', {
            detail: { preferences: this.manager.getPreferences() }
        });
        document.dispatchEvent(event);
    }
    
    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'onboarding-error';
        errorDiv.textContent = message;
        errorDiv.style.position = 'fixed';
        errorDiv.style.bottom = '20px';
        errorDiv.style.left = '50%';
        errorDiv.style.transform = 'translateX(-50%)';
        errorDiv.style.background = '#ef4444';
        errorDiv.style.color = 'white';
        errorDiv.style.padding = '12px 24px';
        errorDiv.style.borderRadius = '40px';
        errorDiv.style.zIndex = '10000';
        
        document.body.appendChild(errorDiv);
        
        setTimeout(() => errorDiv.remove(), 3000);
    }
}

// ============================================
// EXPORTS
// ============================================

// Initialize onboarding system
const onboardingManager = new OnboardingManager();
const onboardingUI = new OnboardingUIController(onboardingManager);

// Global exports
window.SpeakFlow = window.SpeakFlow || {};
window.SpeakFlow.Onboarding = {
    manager: onboardingManager,
    ui: onboardingUI,
    config: OnboardingConfig
};

// Module exports
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        OnboardingConfig,
        OnboardingManager,
        OnboardingUIController
    };
}

// ============================================
// CSS STYLES
// ============================================

const style = document.createElement('style');
style.textContent = `
    .onboarding-welcome {
        text-align: center;
        padding: 20px;
    }
    
    .welcome-icon {
        font-size: 64px;
        margin-bottom: 20px;
    }
    
    .welcome-features {
        display: flex;
        justify-content: center;
        gap: 20px;
        margin: 30px 0;
        flex-wrap: wrap;
    }
    
    .feature {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        padding: 12px;
        background: var(--bg-secondary);
        border-radius: 12px;
        min-width: 100px;
    }
    
    .feature-icon {
        font-size: 24px;
    }
    
    .step-description {
        font-size: 18px;
        font-weight: 500;
        margin-bottom: 24px;
        text-align: center;
    }
    
    .step-note {
        font-size: 14px;
        color: var(--text-secondary);
        text-align: center;
        margin-bottom: 20px;
    }
    
    .options-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 16px;
        max-height: 400px;
        overflow-y: auto;
        padding: 4px;
    }
    
    .option-card {
        position: relative;
        padding: 20px;
        background: var(--bg-secondary);
        border-radius: 16px;
        cursor: pointer;
        transition: all 0.2s;
        text-align: center;
        border: 2px solid transparent;
    }
    
    .option-card:hover {
        transform: translateY(-2px);
        background: var(--bg-tertiary);
    }
    
    .option-card.selected {
        border-color: var(--color-primary);
        background: var(--primary-50);
    }
    
    .option-icon {
        font-size: 32px;
        margin-bottom: 12px;
    }
    
    .option-name {
        font-weight: 600;
        margin-bottom: 8px;
    }
    
    .option-desc {
        font-size: 12px;
        color: var(--text-secondary);
    }
    
    .check-mark {
        position: absolute;
        top: 8px;
        right: 8px;
        width: 24px;
        height: 24px;
        background: var(--color-primary);
        color: white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
    }
    
    .options-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
        max-height: 400px;
        overflow-y: auto;
    }
    
    .option-item {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 16px;
        background: var(--bg-secondary);
        border-radius: 12px;
        cursor: pointer;
        position: relative;
        border: 2px solid transparent;
    }
    
    .option-item.selected {
        border-color: var(--color-primary);
        background: var(--primary-50);
    }
    
    .persona-traits {
        display: flex;
        gap: 8px;
        margin-top: 12px;
        flex-wrap: wrap;
        justify-content: center;
    }
    
    .trait {
        font-size: 11px;
        padding: 4px 8px;
        background: var(--bg-primary);
        border-radius: 20px;
        color: var(--text-secondary);
    }
    
    .interests-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        justify-content: center;
        max-height: 300px;
        overflow-y: auto;
        padding: 4px;
    }
    
    .interest-chip {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 16px;
        background: var(--bg-secondary);
        border-radius: 40px;
        cursor: pointer;
        transition: all 0.2s;
        border: 1px solid var(--border-light);
    }
    
    .interest-chip.selected {
        background: var(--color-primary);
        color: white;
        border-color: var(--color-primary);
    }
    
    .selected-count {
        text-align: center;
        margin-top: 16px;
        font-size: 14px;
        color: var(--text-secondary);
    }
    
    .schedule-options {
        display: flex;
        flex-direction: column;
        gap: 12px;
        max-width: 300px;
        margin: 0 auto;
    }
    
    .schedule-option {
        padding: 16px;
        background: var(--bg-secondary);
        border-radius: 12px;
        cursor: pointer;
        text-align: center;
        border: 2px solid transparent;
    }
    
    .schedule-option.selected {
        border-color: var(--color-primary);
        background: var(--primary-50);
    }
    
    .schedule-value {
        font-weight: 600;
        margin-bottom: 4px;
    }
    
    .schedule-desc {
        font-size: 12px;
        color: var(--text-secondary);
    }
    
    .schedule-note {
        text-align: center;
        margin-top: 16px;
        font-size: 12px;
        color: var(--text-tertiary);
    }
    
    .onboarding-complete {
        text-align: center;
        padding: 20px;
    }
    
    .complete-icon {
        font-size: 64px;
        margin-bottom: 20px;
    }
    
    .complete-summary {
        background: var(--bg-secondary);
        border-radius: 16px;
        padding: 20px;
        margin: 24px 0;
        text-align: left;
    }
    
    .summary-item {
        display: flex;
        justify-content: space-between;
        padding: 8px 0;
        border-bottom: 1px solid var(--border-light);
    }
    
    .summary-item:last-child {
        border-bottom: none;
    }
    
    .summary-label {
        font-weight: 500;
        color: var(--text-secondary);
    }
    
    .summary-value {
        font-weight: 600;
        color: var(--text-primary);
    }
    
    .start-speaking-btn {
        margin-top: 20px;
        padding: 12px 32px;
        font-size: 16px;
    }
    
    .onboarding-error {
        animation: slideUp 0.3s ease;
    }
`;

document.head.appendChild(style);

// ============================================
// AUTO-INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('Onboarding module initialized');
    
    // Show onboarding if not completed
    if (!onboardingManager.isOnboardingComplete()) {
        setTimeout(() => {
            onboardingUI.show();
        }, 500);
    }
    
    // Debug mode
    if (window.location.hostname === 'localhost') {
        window.debugOnboarding = {
            manager: onboardingManager,
            config: OnboardingConfig
        };
        console.log('Onboarding debug mode enabled');
    }
});
