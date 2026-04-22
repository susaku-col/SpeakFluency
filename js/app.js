// ============ MAIN APPLICATION ============

let currentPracticeAccuracy = 0;
let currentTargetSentence = "The weather is beautiful today";
let lastAIResponse = null;

// DOM Elements
const elements = {
    startSpeakingBtn: document.getElementById('startSpeakingBtn'),
    ctaStartBtn: document.getElementById('ctaStartBtn'),
    watchDemoBtn: document.getElementById('watchDemoBtn'),
    navHome: document.getElementById('navHome'),
    navFeatures: document.getElementById('navFeatures'),
    navPricing: document.getElementById('navPricing'),
    navAbout: document.getElementById('navAbout'),
    navContact: document.getElementById('navContact'),
    logoHome: document.getElementById('logoHome'),
    btnLogin: document.getElementById('btnLogin'),
    btnSignup: document.getElementById('btnSignup'),
    mobileToggle: document.getElementById('mobileToggle'),
    navLinks: document.getElementById('navLinks'),
    featurePronunciation: document.getElementById('featurePronunciation'),
    featureAIChat: document.getElementById('featureAIChat'),
    featureLearningPath: document.getElementById('featureLearningPath'),
    featureGamification: document.getElementById('featureGamification'),
    featureOffline: document.getElementById('featureOffline'),
    featureCommunity: document.getElementById('featureCommunity'),
    sentenceSelect: document.getElementById('sentenceSelect'),
    listenBtn: document.getElementById('listenBtn'),
    micBtn: document.getElementById('micBtn'),
    completePracticeBtn: document.getElementById('completePracticeBtn'),
    voiceRecordBtn: document.getElementById('voiceRecordBtn'),
    stopRecordBtn: document.getElementById('stopRecordBtn'),
    clearChatBtn: document.getElementById('clearChatBtn'),
    endVoiceChatBtn: document.getElementById('endVoiceChatBtn'),
    submitQuizBtn: document.getElementById('submitQuizBtn'),
    downloadBasicBtn: document.getElementById('downloadBasicBtn'),
    downloadInterBtn: document.getElementById('downloadInterBtn'),
    pricingFreeBtn: document.querySelector('.pricingFreeBtn'),
    pricingProBtn: document.querySelector('.pricingProBtn'),
    loginForm: document.getElementById('loginForm'),
    signupForm: document.getElementById('signupForm'),
    q1: document.getElementById('q1'),
    q2: document.getElementById('q2')
};

// Modal functions
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'flex';
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
}

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.style.display = 'block';
    setTimeout(() => toast.style.display = 'none', 3000);
}

function scrollToSection(id) {
    const element = document.getElementById(id);
    if (element) element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (window.innerWidth <= 768 && elements.navLinks) {
        elements.navLinks.classList.remove('show');
    }
}

// ============ PRONUNCIATION PRACTICE ============
function setupPronunciationPractice() {
    if (elements.sentenceSelect) {
        elements.sentenceSelect.onchange = () => {
            currentTargetSentence = elements.sentenceSelect.value;
            const targetSpan = document.getElementById('targetSentence');
            if (targetSpan) targetSpan.innerText = `"${currentTargetSentence}"`;
            const resultDiv = document.getElementById('recognitionResult');
            if (resultDiv) resultDiv.innerHTML = '💡 Click "Start Speaking" and say the sentence above';
            currentPracticeAccuracy = 0;
        };
    }
    
    if (elements.listenBtn) {
        elements.listenBtn.onclick = () => {
            speakSimple(currentTargetSentence);
            showToast("🔊 Listening to correct pronunciation...");
        };
    }
    
    if (elements.micBtn) {
        elements.micBtn.onclick = () => {
            startPronunciationRecording();
            const resultDiv = document.getElementById('recognitionResult');
            if (resultDiv) resultDiv.innerHTML = "🎤 Listening... Speak now!";
        };
    }
    
    if (elements.completePracticeBtn) {
        elements.completePracticeBtn.onclick = () => {
            if (currentPracticeAccuracy >= 80) {
                addXP(25);
                showToast(`🎉 Perfect! +25 XP!`);
                closeModal('practiceModal');
            } else if (currentPracticeAccuracy >= 60) {
                addXP(15);
                showToast(`👍 Good! +15 XP!`);
                closeModal('practiceModal');
            } else if (currentPracticeAccuracy > 0) {
                addXP(10);
                showToast(`📖 Keep practicing! +10 XP!`);
                closeModal('practiceModal');
            } else {
                showToast(`💡 Speak first to earn XP!`);
            }
        };
    }
    
    setPronunciationCallbacks(
        (transcript) => {
            const targetWords = currentTargetSentence.toLowerCase().split(' ');
            const spokenWords = transcript.toLowerCase().split(' ');
            let correct = 0;
            targetWords.forEach((word, i) => {
                if (spokenWords[i] === word) correct++;
            });
            currentPracticeAccuracy = Math.round((correct / targetWords.length) * 100);
            
            let message = '';
            if (currentPracticeAccuracy >= 80) message = '🎉 Excellent! Perfect pronunciation!';
            else if (currentPracticeAccuracy >= 60) message = '👍 Good job! Very close!';
            else if (currentPracticeAccuracy >= 40) message = '📖 Good try! Listen again.';
            else message = '🎧 Listen to the example first, then speak slowly.';
            
            const resultDiv = document.getElementById('recognitionResult');
            if (resultDiv) {
                resultDiv.innerHTML = `
                    <strong>You said:</strong> "${transcript}"<br><br>
                    <strong>🎯 Accuracy:</strong> ${currentPracticeAccuracy}%<br><br>
                    <strong>💬 ${message}</strong>
                `;
            }
        },
        (error) => {
            const resultDiv = document.getElementById('recognitionResult');
            if (resultDiv) resultDiv.innerHTML = `⚠️ Error: ${error}. Please try again.`;
        }
    );
}

// ============ AI VOICE CONVERSATION ============
let voiceStatusDiv, conversationDiv, resultDiv, userSpeechSpan, correctionSpan, alternativeSpan;

function setupVoiceConversation() {
    voiceStatusDiv = document.getElementById('voiceStatus');
    conversationDiv = document.getElementById('voiceConversation');
    resultDiv = document.getElementById('voiceResult');
    userSpeechSpan = document.getElementById('userSpeechText');
    correctionSpan = document.getElementById('correctionText');
    alternativeSpan = document.getElementById('alternativeText');
    
    // Setup accent buttons
    const accentButtonsDiv = document.getElementById('accentButtons');
    if (accentButtonsDiv) {
        for (const [key, accent] of Object.entries(CONFIG.ACCENTS)) {
            const btn = document.createElement('button');
            btn.className = 'accent-btn';
            btn.innerHTML = `${accent.flag} ${accent.name}`;
            btn.onclick = async () => {
                currentAccent = key;
                document.querySelectorAll('.accent-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const infoDiv = document.getElementById('selectedAccentInfo');
                if (infoDiv) infoDiv.innerHTML = `${accent.flag} Selected: ${accent.name} accent`;
                await setVoiceForAccentAndGender(currentAccent, currentGender);
                testAccent(currentAccent, currentGender);
                showToast(`${accent.name} accent activated!`);
                
                // Update welcome message
                if (conversationDiv && conversationDiv.children[0]) {
                    conversationDiv.children[0].innerHTML = `🤖 AI (${accent.flag} ${accent.name}): Hello! I now speak with ${accent.name} accent! Click the red button to start.`;
                }
            };
            accentButtonsDiv.appendChild(btn);
        }
        
        // Set default active
        const defaultBtn = accentButtonsDiv.children[0];
        if (defaultBtn) defaultBtn.classList.add('active');
    }
    
    // Initialize voice recognition
    initVoiceChatRecognition(
        async (userText) => {
            if (!conversationDiv) return;
            
            conversationDiv.innerHTML += `<div class="user-bubble voice-bubble">🗣️ You: ${userText}</div>`;
            conversationDiv.scrollTop = conversationDiv.scrollHeight;
            
            const aiData = await getAIResponse(userText, false);
            lastAIResponse = aiData;
            
            if (resultDiv) resultDiv.style.display = 'block';
            if (userSpeechSpan) userSpeechSpan.innerHTML = `📝 You said: "${userText}"`;
            
            if (aiData.grammarCorrection.hasCorrection && correctionSpan) {
                correctionSpan.innerHTML = `✅ Correction: ${aiData.grammarCorrection.correctedText}<br>📖 ${aiData.grammarCorrection.messages.join(', ')}`;
            } else if (correctionSpan) {
                correctionSpan.innerHTML = `✅ Grammar is correct! Great job!`;
            }
            
            if (alternativeSpan) {
                alternativeSpan.innerHTML = `💡 Alternative ways to say this:<br>• ${aiData.alternatives.join('<br>• ')}`;
            }
            
            showTypingIndicator();
            isThinking = true;
            if (voiceStatusDiv) {
                voiceStatusDiv.innerHTML = '💭 AI is thinking and preparing voice response...';
                voiceStatusDiv.style.background = '#fef3c7';
            }
            
            setTimeout(() => {
                hideTypingIndicator();
                conversationDiv.innerHTML += `<div class="ai-bubble voice-bubble">🤖 AI (${CONFIG.ACCENTS[currentAccent].flag} ${CONFIG.ACCENTS[currentAccent].name}): ${aiData.response}</div>`;
                conversationDiv.scrollTop = conversationDiv.scrollHeight;
                
                speakWithAccent(aiData.response, currentAccent, currentGender, () => {
                    isThinking = false;
                    if (voiceStatusDiv && !isRecording) {
                        voiceStatusDiv.innerHTML = '🎤 Ready. Click red button to speak again!';
                        voiceStatusDiv.style.background = '#f0f4f8';
                    }
                });
                
                setTimeout(() => {
                    if (resultDiv) resultDiv.style.display = 'none';
                }, 8000);
            }, 600);
        },
        (error) => {
            if (voiceStatusDiv) {
                voiceStatusDiv.innerHTML = `⚠️ Error: ${error}. Please try again.`;
                voiceStatusDiv.style.background = '#fee2e2';
            }
            setTimeout(() => {
                if (voiceStatusDiv && !isRecording && !isThinking) {
                    voiceStatusDiv.innerHTML = '⚪ Ready. Click red button to start.';
                    voiceStatusDiv.style.background = '#f0f4f8';
                }
            }, 2000);
            if (elements.voiceRecordBtn) elements.voiceRecordBtn.style.display = 'block';
            if (elements.stopRecordBtn) elements.stopRecordBtn.style.display = 'none';
            isRecording = false;
        },
        () => {
            isRecording = true;
            if (voiceStatusDiv) {
                voiceStatusDiv.innerHTML = '🔴 Recording... Speak clearly';
                voiceStatusDiv.style.background = '#fee2e2';
            }
            if (elements.voiceRecordBtn) {
                elements.voiceRecordBtn.style.display = 'none';
                elements.voiceRecordBtn.classList.add('recording-animation');
            }
            if (elements.stopRecordBtn) elements.stopRecordBtn.style.display = 'block';
        },
        () => {
            isRecording = false;
            if (voiceStatusDiv && !isThinking) {
                voiceStatusDiv.innerHTML = '⚪ Ready. Click red button to start.';
                voiceStatusDiv.style.background = '#f0f4f8';
            }
            if (elements.voiceRecordBtn) {
                elements.voiceRecordBtn.style.display = 'block';
                elements.voiceRecordBtn.classList.remove('recording-animation');
            }
            if (elements.stopRecordBtn) elements.stopRecordBtn.style.display = 'none';
        }
    );
    
    if (elements.voiceRecordBtn) {
        elements.voiceRecordBtn.onclick = () => {
            if (isThinking) {
                showToast('⏳ AI is speaking, please wait...');
                return;
            }
            startVoiceRecording();
        };
    }
    
    if (elements.stopRecordBtn) {
        elements.stopRecordBtn.onclick = stopVoiceRecording;
    }
    
    if (elements.clearChatBtn) {
        elements.clearChatBtn.onclick = () => {
            if (conversationDiv) {
                conversationDiv.innerHTML = `<div class="ai-bubble voice-bubble">🤖 AI (${CONFIG.ACCENTS[currentAccent].flag} ${CONFIG.ACCENTS[currentAccent].name}): Hello! Click the red button and start speaking!</div>`;
            }
            clearMemory();
            if (resultDiv) resultDiv.style.display = 'none';
            showToast('Chat and memory cleared!');
        };
    }
    
    if (elements.endVoiceChatBtn) {
        elements.endVoiceChatBtn.onclick = () => {
            if (window.speechSynthesis.speaking) window.speechSynthesis.cancel();
            addXP(CONFIG.XP_PER_CONVERSATION);
            closeModal('aiChatModal');
            showToast(`+${CONFIG.XP_PER_CONVERSATION} XP earned!`);
            clearMemory();
            if (conversationDiv) {
                conversationDiv.innerHTML = `<div class="ai-bubble voice-bubble">🤖 AI: Session ended. Come back anytime!</div>`;
            }
        };
    }
}

function showTypingIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.id = 'typingIndicator';
    indicator.innerHTML = '<span></span><span></span><span></span>';
    if (conversationDiv) conversationDiv.appendChild(indicator);
    if (conversationDiv) conversationDiv.scrollTop = conversationDiv.scrollHeight;
}

function hideTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) indicator.remove();
}

// ============ LEARNING PATH ============
function setupLearningPath() {
    if (elements.submitQuizBtn) {
        elements.submitQuizBtn.onclick = () => {
            const level = elements.q1 ? elements.q1.value : 'Beginner';
            const goal = elements.q2 ? elements.q2.value : 'Daily conversation';
            const resultDiv = document.getElementById('quizResult');
            if (resultDiv) {
                resultDiv.innerHTML = `📚 Your personalized path is ready!<br>📍 Level: ${level}<br>🎯 Goal: ${goal}<br>📖 Recommended: 15 minutes daily practice.`;
            }
            addXP(20);
            setTimeout(() => closeModal('learningPathModal'), 2000);
        };
    }
}

// ============ OFFLINE MODE ============
function setupOfflineMode() {
    if (elements.downloadBasicBtn) {
        elements.downloadBasicBtn.onclick = () => downloadLesson('Basic');
    }
    if (elements.downloadInterBtn) {
        elements.downloadInterBtn.onclick = () => downloadLesson('Intermediate');
    }
}

function downloadLesson(level) {
    const statusDiv = document.getElementById('downloadStatus');
    if (statusDiv) {
        statusDiv.innerHTML = '📥 Downloading ' + level + ' lessons...';
        setTimeout(() => {
            statusDiv.innerHTML = '✅ ' + level + ' lessons downloaded! Available offline.';
            addXP(5);
            setTimeout(() => statusDiv.innerHTML = '', 2000);
        }, 2000);
    }
}

// ============ COMMUNITY ============
function setupCommunity() {
    document.querySelectorAll('.joinSessionBtn').forEach(btn => {
        btn.onclick = () => {
            const sessionName = btn.getAttribute('data-session');
            showToast(`🎉 Joined ${sessionName}! +25 XP`);
            addXP(25);
            closeModal('communityModal');
        };
    });
}

// ============ EVENT LISTENERS ============
function setupEventListeners() {
    if (elements.startSpeakingBtn) elements.startSpeakingBtn.onclick = () => openModal('practiceModal');
    if (elements.ctaStartBtn) elements.ctaStartBtn.onclick = () => openModal('practiceModal');
    if (elements.watchDemoBtn) elements.watchDemoBtn.onclick = () => showToast('▶️ Demo: AI pronunciation analysis');
    
    if (elements.navHome) elements.navHome.onclick = () => scrollToSection('home');
    if (elements.navFeatures) elements.navFeatures.onclick = () => scrollToSection('features');
    if (elements.navPricing) elements.navPricing.onclick = () => scrollToSection('pricing');
    if (elements.navAbout) elements.navAbout.onclick = () => scrollToSection('about');
    if (elements.navContact) elements.navContact.onclick = () => scrollToSection('contact');
    if (elements.logoHome) elements.logoHome.onclick = () => scrollToSection('home');
    
    if (elements.btnLogin) elements.btnLogin.onclick = () => openModal('loginModal');
    if (elements.btnSignup) elements.btnSignup.onclick = () => openModal('signupModal');
    
    if (elements.mobileToggle && elements.navLinks) {
        elements.mobileToggle.onclick = () => elements.navLinks.classList.toggle('show');
    }
    
    if (elements.featurePronunciation) elements.featurePronunciation.onclick = () => openModal('practiceModal');
    if (elements.featureAIChat) elements.featureAIChat.onclick = () => openModal('aiChatModal');
    if (elements.featureLearningPath) elements.featureLearningPath.onclick = () => openModal('learningPathModal');
    if (elements.featureGamification) elements.featureGamification.onclick = () => { updateDisplay(); checkAchievements(); openModal('gamificationModal'); };
    if (elements.featureOffline) elements.featureOffline.onclick = () => openModal('offlineModal');
    if (elements.featureCommunity) elements.featureCommunity.onclick = () => openModal('communityModal');
    
    if (elements.pricingFreeBtn) elements.pricingFreeBtn.onclick = () => showToast('Free plan activated!');
    if (elements.pricingProBtn) elements.pricingProBtn.onclick = () => showToast('Start 7-day Pro trial!');
    
    if (elements.loginForm) {
        elements.loginForm.onsubmit = (e) => {
            e.preventDefault();
            showToast('Login successful!');
            closeModal('loginModal');
        };
    }
    
    if (elements.signupForm) {
        elements.signupForm.onsubmit = (e) => {
            e.preventDefault();
            showToast('Account created! Start learning now!');
            closeModal('signupModal');
        };
    }
    
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.onclick = () => {
            const modalId = btn.getAttribute('data-modal');
            if (modalId) closeModal(modalId);
        };
    });
    
    window.onclick = (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    };
}

// ============ INITIALIZATION ============
async function init() {
    await loadVoices();
    await setVoiceForAccentAndGender(currentAccent, currentGender);
    
    initPronunciationRecognition();
    setupPronunciationPractice();
    setupVoiceConversation();
    setupLearningPath();
    setupOfflineMode();
    setupCommunity();
    setupEventListeners();
    
    checkStreak();
    updateDisplay();
    
    console.log('SpeakFlow initialized!');
    console.log('Available voices:', availableVoices.length);
}

// Start the app
init();
