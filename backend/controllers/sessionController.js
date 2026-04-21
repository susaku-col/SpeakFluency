// ============================================
// Session Controller
// SpeakFlow - AI Language Learning Platform
// ============================================

const { validationResult } = require('express-validator');

// ============================================
// Constants & Configuration
// ============================================

const DEFAULT_SESSION_DURATION = 15; // minutes
const MAX_SESSION_DURATION = 120; // minutes
const MIN_SESSION_DURATION = 5; // minutes

// ============================================
// Mock Database (In production, use real database)
// ============================================

// Active sessions storage
const activeSessions = new Map();

// Completed sessions storage
const completedSessions = new Map();

// Session history by user
const userSessions = new Map();

// Session analytics
const sessionAnalytics = new Map();

// ============================================
// Lesson Templates
// ============================================

const lessons = {
  // Pronunciation Lessons
  'pronunciation_basic_01': {
    id: 'pronunciation_basic_01',
    title: 'Basic Greetings',
    type: 'pronunciation',
    difficulty: 'beginner',
    duration: 15,
    xpReward: 50,
    content: {
      introduction: 'Learn how to pronounce common English greetings correctly.',
      words: [
        { text: 'hello', pronunciation: 'həˈloʊ', tips: 'Stress the second syllable: hel-LO' },
        { text: 'hi', pronunciation: 'haɪ', tips: 'Short and clear sound' },
        { text: 'good morning', pronunciation: 'ɡʊd ˈmɔrnɪŋ', tips: 'Connect "good" and "morning"' },
        { text: 'good afternoon', pronunciation: 'ɡʊd ˌæftərˈnun', tips: 'Stress on "noon"' },
        { text: 'good evening', pronunciation: 'ɡʊd ˈivnɪŋ', tips: 'Soft "v" sound' }
      ],
      phrases: [
        { text: 'How are you?', pronunciation: 'haʊ ɑr ju', tips: 'Connect "are you" -> "r you"' },
        { text: 'Nice to meet you', pronunciation: 'naɪs tə mit ju', tips: 'Soft "t" sound' },
        { text: 'See you later', pronunciation: 'si ju ˈleɪtər', tips: 'Clear "l" sound' }
      ],
      exercises: [
        {
          id: 1,
          type: 'repeat',
          text: 'Hello',
          expectedAudio: 'hello_audio_ref',
          tips: 'Say it with a smile!'
        },
        {
          id: 2,
          type: 'repeat',
          text: 'How are you?',
          expectedAudio: 'how_are_you_audio_ref',
          tips: 'Practice the rhythm'
        }
      ]
    }
  },
  
  'pronunciation_intermediate_01': {
    id: 'pronunciation_intermediate_01',
    title: 'Common Difficult Sounds',
    type: 'pronunciation',
    difficulty: 'intermediate',
    duration: 20,
    xpReward: 75,
    content: {
      introduction: 'Master difficult English sounds like TH, R, and L.',
      sounds: [
        { phoneme: 'θ', examples: ['think', 'thank', 'three'], tips: 'Put tongue between teeth' },
        { phoneme: 'ð', examples: ['the', 'this', 'that'], tips: 'Vibrate vocal cords' },
        { phoneme: 'r', examples: ['red', 'right', 'run'], tips: 'Round your lips' },
        { phoneme: 'l', examples: ['light', 'love', 'learn'], tips: 'Tongue touches roof of mouth' }
      ],
      minimalPairs: [
        { pair: ['think', 'sink'], difference: 'TH vs S' },
        { pair: ['light', 'right'], difference: 'L vs R' },
        { pair: ['free', 'three'], difference: 'F vs TH' }
      ],
      exercises: [
        {
          id: 1,
          type: 'minimal_pair',
          word1: 'think',
          word2: 'sink',
          expectedAudio: 'think_sink_audio_ref'
        }
      ]
    }
  },

  // Vocabulary Lessons
  'vocabulary_daily_01': {
    id: 'vocabulary_daily_01',
    title: 'Daily Routines',
    type: 'vocabulary',
    difficulty: 'beginner',
    duration: 20,
    xpReward: 50,
    content: {
      introduction: 'Learn vocabulary related to daily routines and activities.',
      words: [
        { word: 'wake up', meaning: 'bangun', example: 'I wake up at 7 AM', partOfSpeech: 'verb phrase' },
        { word: 'get dressed', meaning: 'berpakaian', example: 'I get dressed after breakfast', partOfSpeech: 'verb phrase' },
        { word: 'breakfast', meaning: 'sarapan', example: 'I eat breakfast at 8 AM', partOfSpeech: 'noun' },
        { word: 'work', meaning: 'bekerja', example: 'I go to work at 9 AM', partOfSpeech: 'verb/noun' },
        { word: 'lunch', meaning: 'makan siang', example: 'I have lunch at 12 PM', partOfSpeech: 'noun' },
        { word: 'exercise', meaning: 'olahraga', example: 'I exercise after work', partOfSpeech: 'verb/noun' },
        { word: 'dinner', meaning: 'makan malam', example: 'I eat dinner at 7 PM', partOfSpeech: 'noun' },
        { word: 'relax', meaning: 'bersantai', example: 'I relax in the evening', partOfSpeech: 'verb' },
        { word: 'sleep', meaning: 'tidur', example: 'I sleep at 10 PM', partOfSpeech: 'verb' }
      ],
      quiz: [
        { question: 'What do you eat in the morning?', options: ['Lunch', 'Dinner', 'Breakfast', 'Snack'], correct: 2 },
        { question: 'What do you do after work?', options: ['Sleep', 'Exercise', 'Wake up', 'Get dressed'], correct: 1 }
      ],
      exercises: [
        {
          id: 1,
          type: 'matching',
          items: [
            { word: 'wake up', match: 'bangun' },
            { word: 'breakfast', match: 'sarapan' },
            { word: 'exercise', match: 'olahraga' }
          ]
        },
        {
          id: 2,
          type: 'fill_blank',
          sentence: 'I ___ up at 7 AM every day.',
          answer: 'wake',
          options: ['get', 'wake', 'stand', 'rise']
        }
      ]
    }
  },

  'vocabulary_intermediate_01': {
    id: 'vocabulary_intermediate_01',
    title: 'Business English',
    type: 'vocabulary',
    difficulty: 'intermediate',
    duration: 25,
    xpReward: 75,
    content: {
      introduction: 'Essential vocabulary for business and professional settings.',
      words: [
        { word: 'meeting', meaning: 'rapat', example: 'We have a meeting at 10 AM', partOfSpeech: 'noun' },
        { word: 'deadline', meaning: 'batas waktu', example: 'The deadline is Friday', partOfSpeech: 'noun' },
        { word: 'presentation', meaning: 'presentasi', example: 'I have a presentation tomorrow', partOfSpeech: 'noun' },
        { word: 'negotiate', meaning: 'bernegosiasi', example: 'We need to negotiate the contract', partOfSpeech: 'verb' },
        { word: 'proposal', meaning: 'proposal', example: 'The proposal was approved', partOfSpeech: 'noun' }
      ],
      dialogues: [
        {
          context: 'Meeting',
          script: 'A: "Can we schedule a meeting for tomorrow?"\nB: "Sure, what time works for you?"',
          vocabulary: ['schedule', 'meeting', 'works']
        }
      ]
    }
  },

  // Grammar Lessons
  'grammar_present_tense_01': {
    id: 'grammar_present_tense_01',
    title: 'Simple Present Tense',
    type: 'grammar',
    difficulty: 'beginner',
    duration: 25,
    xpReward: 60,
    content: {
      introduction: 'Learn how to use simple present tense for habits and routines.',
      explanation: 'Simple present tense is used for:\n• Habits and routines\n• General facts and truths\n• Scheduled events',
      rules: [
        'I/You/We/They + base verb',
        'He/She/It + verb + s/es',
        'Negative: do/does + not + base verb',
        'Question: Do/Does + subject + base verb?'
      ],
      examples: [
        { sentence: 'I eat breakfast every day.', correct: true, explanation: 'Habit' },
        { sentence: 'She works at a hospital.', correct: true, explanation: 'Fact' },
        { sentence: 'The sun rises in the east.', correct: true, explanation: 'General truth' }
      ],
      exercises: [
        {
          id: 1,
          type: 'fill_blank',
          sentence: 'She ___ (go) to school every day.',
          answer: 'goes',
          hint: 'Third person singular needs "es"'
        },
        {
          id: 2,
          type: 'fill_blank',
          sentence: 'They ___ (play) football on Sundays.',
          answer: 'play',
          hint: 'Third person plural uses base verb'
        },
        {
          id: 3,
          type: 'correction',
          sentence: 'He go to work at 8 AM.',
          correction: 'He goes to work at 8 AM.',
          explanation: 'Add "es" for third person singular'
        }
      ]
    }
  },

  'grammar_past_tense_01': {
    id: 'grammar_past_tense_01',
    title: 'Simple Past Tense',
    type: 'grammar',
    difficulty: 'intermediate',
    duration: 30,
    xpReward: 75,
    content: {
      introduction: 'Learn to talk about completed actions in the past.',
      explanation: 'Simple past tense is used for completed actions in the past.',
      regularVerbs: [
        { base: 'walk', past: 'walked', rule: 'add -ed' },
        { base: 'study', past: 'studied', rule: 'y → ied' },
        { base: 'stop', past: 'stopped', rule: 'double consonant + ed' }
      ],
      irregularVerbs: [
        { base: 'go', past: 'went' },
        { base: 'eat', past: 'ate' },
        { base: 'see', past: 'saw' },
        { base: 'have', past: 'had' },
        { base: 'do', past: 'did' }
      ]
    }
  },

  // Speaking Lessons
  'speaking_introduction_01': {
    id: 'speaking_introduction_01',
    title: 'Self Introduction',
    type: 'speaking',
    difficulty: 'beginner',
    duration: 30,
    xpReward: 80,
    content: {
      introduction: 'Learn how to introduce yourself confidently in English.',
      script: 'Hello, my name is [name]. I am from [country]. I am learning English with SpeakFlow.',
      practicePoints: [
        'Speak clearly and at a moderate pace',
        'Use correct intonation for statements',
        'Smile while speaking for a friendly tone'
      ],
      questions: [
        'What is your name?',
        'Where are you from?',
        'Why are you learning English?',
        'What do you do for work/study?',
        'What are your hobbies?'
      ],
      sampleResponse: 'My name is John. I\'m from the United States. I\'m learning English to improve my career opportunities.',
      exercises: [
        {
          id: 1,
          type: 'speaking',
          prompt: 'Introduce yourself',
          duration: 30,
          tips: ['Start with "Hello"', 'Say your name clearly', 'Mention where you are from']
        }
      ]
    }
  },

  // Listening Lessons
  'listening_basic_01': {
    id: 'listening_basic_01',
    title: 'Understanding Basic Conversations',
    type: 'listening',
    difficulty: 'beginner',
    duration: 20,
    xpReward: 60,
    content: {
      introduction: 'Practice understanding everyday conversations.',
      audioScript: 'A: "Hi, how are you?"\nB: "I\'m good, thanks! And you?"\nA: "Doing great! See you later."\nB: "See you!"',
      comprehensionQuestions: [
        { question: 'How is person B?', options: ['Sad', 'Tired', 'Good', 'Busy'], correct: 2 },
        { question: 'What do they say at the end?', options: ['Goodbye', 'See you later', 'Take care', 'Bye bye'], correct: 1 }
      ],
      vocabulary: [
        { word: 'doing great', meaning: 'very good' },
        { word: 'see you later', meaning: 'goodbye for now' }
      ]
    }
  },

  // Comprehensive Lessons
  'comprehensive_review_01': {
    id: 'comprehensive_review_01',
    title: 'Beginner Review',
    type: 'comprehensive',
    difficulty: 'beginner',
    duration: 45,
    xpReward: 150,
    content: {
      introduction: 'Review all beginner topics: greetings, vocabulary, grammar, and speaking.',
      sections: [
        { name: 'Greetings', items: ['Hello', 'Good morning', 'How are you?'] },
        { name: 'Vocabulary', items: ['Family', 'Food', 'Daily routines'] },
        { name: 'Grammar', items: ['Present tense', 'To be', 'Questions'] },
        { name: 'Speaking', items: ['Self introduction', 'Asking questions'] }
      ],
      finalQuiz: [
        { question: 'How do you say good morning?', type: 'multiple_choice', options: ['Buenos días', 'Bonjour', 'Good morning', 'Guten Morgen'], correct: 2 },
        { question: 'Complete: She ___ to school every day.', type: 'fill_blank', answer: 'goes' }
      ]
    }
  }
};

// ============================================
// Helper Functions
// ============================================

/**
 * Generate unique session ID
 */
const generateSessionId = () => {
  return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Generate unique message ID
 */
const generateMessageId = () => {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Get lesson by ID
 */
const getLesson = (lessonId) => {
  return lessons[lessonId] || null;
};

/**
 * Get all lessons
 */
const getAllLessons = () => {
  return Object.values(lessons);
};

/**
 * Get lessons by type and difficulty
 */
const getLessonsByFilters = (type, difficulty, limit = 10) => {
  let filtered = Object.values(lessons);
  
  if (type) {
    filtered = filtered.filter(l => l.type === type);
  }
  
  if (difficulty) {
    filtered = filtered.filter(l => l.difficulty === difficulty);
  }
  
  return filtered.slice(0, limit);
};

/**
 * Calculate XP earned from session
 */
const calculateXP = (sessionType, score, duration, isPerfect = false) => {
  let baseXP = 50;
  
  // Bonus based on session type
  const typeBonus = {
    'pronunciation': 10,
    'vocabulary': 10,
    'grammar': 10,
    'speaking': 20,
    'listening': 15,
    'comprehensive': 25
  };
  
  // Score multiplier (0.5 to 1.5)
  const scoreMultiplier = 0.5 + (score / 100);
  
  // Duration bonus (max 50 XP)
  const durationBonus = Math.min(Math.floor(duration / 5), 50);
  
  // Perfect score bonus
  const perfectBonus = isPerfect ? 50 : 0;
  
  let totalXP = Math.floor((baseXP + (typeBonus[sessionType] || 0)) * scoreMultiplier + durationBonus + perfectBonus);
  
  return Math.min(totalXP, 250); // Cap at 250 XP per session
};

/**
 * Calculate level from XP
 */
const calculateLevel = (xp) => {
  return Math.floor(Math.sqrt(xp / 100)) + 1;
};

/**
 * Evaluate pronunciation answer
 */
const evaluatePronunciation = (userAudio, expectedText, lesson) => {
  // Mock pronunciation evaluation
  // In production, integrate with speech recognition API (Google Speech, OpenAI Whisper)
  const accuracy = Math.floor(Math.random() * 30) + 65; // 65-95%
  const feedback = accuracy > 85 
    ? 'Excellent pronunciation!' 
    : accuracy > 70 
    ? 'Good job! Keep practicing.' 
    : 'Try again. Focus on the word stress.';
  
  return {
    score: accuracy,
    feedback,
    details: {
      accuracy,
      fluency: Math.floor(Math.random() * 30) + 65,
      intonation: Math.floor(Math.random() * 30) + 65,
      pace: Math.floor(Math.random() * 30) + 65
    },
    suggestions: accuracy < 80 ? [
      'Practice the word stress patterns',
      'Slow down your speaking pace',
      'Listen to native speakers'
    ] : []
  };
};

/**
 * Evaluate vocabulary answer
 */
const evaluateVocabulary = (answer, correctAnswer, questionType) => {
  const isCorrect = String(answer).toLowerCase().trim() === String(correctAnswer).toLowerCase().trim();
  
  return {
    correct: isCorrect,
    score: isCorrect ? 100 : 0,
    feedback: isCorrect ? 'Correct!' : `Incorrect. The correct answer is: ${correctAnswer}`
  };
};

/**
 * Evaluate grammar answer
 */
const evaluateGrammar = (answer, correctAnswer, questionType) => {
  const isCorrect = String(answer).toLowerCase().trim() === String(correctAnswer).toLowerCase().trim();
  
  return {
    correct: isCorrect,
    score: isCorrect ? 100 : 0,
    feedback: isCorrect ? 'Great grammar!' : `Almost there! The correct form is: ${correctAnswer}`,
    explanation: !isCorrect ? `Remember: ${correctAnswer}` : null
  };
};

/**
 * Evaluate speaking answer
 */
const evaluateSpeaking = (userAudio, prompt, lesson) => {
  // Mock speaking evaluation
  const score = Math.floor(Math.random() * 30) + 60; // 60-90%
  const fluency = Math.floor(Math.random() * 30) + 60;
  const coherence = Math.floor(Math.random() * 30) + 60;
  const vocabulary = Math.floor(Math.random() * 30) + 60;
  
  return {
    score,
    fluency,
    coherence,
    vocabulary,
    feedback: score > 80 
      ? 'Excellent response! Very fluent and coherent.' 
      : score > 70 
      ? 'Good response. Keep practicing to improve fluency.'
      : 'Keep practicing! Try to speak more and organize your thoughts.',
    transcript: 'This is a mock transcript of what the user said.',
    suggestions: score < 75 ? [
      'Practice speaking for longer periods',
      'Use more varied vocabulary',
      'Organize your thoughts before speaking'
    ] : []
  };
};

/**
 * Evaluate listening answer
 */
const evaluateListening = (answer, correctAnswer, question) => {
  const isCorrect = String(answer).toLowerCase().trim() === String(correctAnswer).toLowerCase().trim();
  
  return {
    correct: isCorrect,
    score: isCorrect ? 100 : 0,
    feedback: isCorrect ? 'Good listening!' : 'Listen carefully to the audio again.',
    correctAnswer: !isCorrect ? correctAnswer : null
  };
};

/**
 * Generate detailed feedback based on answers
 */
const generateFeedback = (answers, sessionType, score) => {
  const feedback = {
    overall: '',
    strengths: [],
    improvements: [],
    tips: [],
    nextSteps: []
  };
  
  if (score >= 90) {
    feedback.overall = 'Excellent work! You have mastered this material.';
    feedback.nextSteps.push('Try more advanced lessons');
    feedback.nextSteps.push('Challenge yourself with faster pace');
  } else if (score >= 70) {
    feedback.overall = 'Good job! You understand the basics well.';
    feedback.nextSteps.push('Review the incorrect answers');
    feedback.nextSteps.push('Practice the difficult areas');
  } else if (score >= 50) {
    feedback.overall = 'Not bad! Keep practicing to improve.';
    feedback.nextSteps.push('Re-take this lesson');
    feedback.nextSteps.push('Focus on the areas where you made mistakes');
  } else {
    feedback.overall = 'Keep practicing! Learning takes time and effort.';
    feedback.nextSteps.push('Review the lesson materials');
    feedback.nextSteps.push('Try simpler lessons first');
  }
  
  // Session type specific tips
  if (sessionType === 'pronunciation') {
    feedback.tips.push('🎤 Listen to native speakers and repeat after them');
    feedback.tips.push('📱 Record yourself and compare with the correct pronunciation');
    feedback.tips.push('🗣️ Practice minimal pairs (e.g., ship/sheep)');
  } else if (sessionType === 'vocabulary') {
    feedback.tips.push('📝 Use flashcards to memorize new words');
    feedback.tips.push('✍️ Try to use new words in sentences');
    feedback.tips.push('📖 Read regularly to encounter words in context');
  } else if (sessionType === 'grammar') {
    feedback.tips.push('📚 Study the grammar rules and practice with examples');
    feedback.tips.push('✏️ Write your own sentences using the grammar pattern');
    feedback.tips.push('🔍 Pay attention to grammar in native content');
  } else if (sessionType === 'speaking') {
    feedback.tips.push('💬 Practice speaking every day, even for 5 minutes');
    feedback.tips.push('🎙️ Use the AI conversation partner feature');
    feedback.tips.push('👥 Join community speaking sessions');
  } else if (sessionType === 'listening') {
    feedback.tips.push('🎧 Listen to English podcasts or songs daily');
    feedback.tips.push('📺 Watch videos with subtitles');
    feedback.tips.push('🔁 Repeat difficult sections multiple times');
  }
  
  return feedback;
};

/**
 * Save session to history
 */
const saveSessionToHistory = (userId, session) => {
  if (!userSessions.has(userId)) {
    userSessions.set(userId, []);
  }
  
  const sessions = userSessions.get(userId);
  sessions.push(session);
  userSessions.set(userId, sessions);
  
  if (!completedSessions.has(session.sessionId)) {
    completedSessions.set(session.sessionId, session);
  }
};

/**
 * Get user sessions from history
 */
const getUserSessions = (userId, limit = 50, offset = 0) => {
  const sessions = userSessions.get(userId) || [];
  return sessions.slice(offset, offset + limit);
};

/**
 * Update user stats after session completion
 */
const updateUserStats = async (userId, session) => {
  // In production, update database
  console.log(`[STATS] Updating stats for user ${userId}: +${session.xpEarned} XP, +1 session`);
  
  // Mock: Update user stats in global users object
  // This would be handled by the user controller in production
};

/**
 * Track session analytics
 */
const trackSessionAnalytics = (sessionId, eventType, data = {}) => {
  if (!sessionAnalytics.has(sessionId)) {
    sessionAnalytics.set(sessionId, {
      sessionId,
      events: [],
      startTime: Date.now()
    });
  }
  
  const analytics = sessionAnalytics.get(sessionId);
  analytics.events.push({
    eventType,
    timestamp: new Date().toISOString(),
    data
  });
  
  sessionAnalytics.set(sessionId, analytics);
};

/**
 * Get session analytics
 */
const getSessionAnalytics = (sessionId) => {
  return sessionAnalytics.get(sessionId) || null;
};

// ============================================
// Controller Methods
// ============================================

/**
 * Start a new practice session
 * POST /api/sessions/start
 */
exports.startSession = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }
    
    const { lessonId, type, difficulty = 'beginner', duration = DEFAULT_SESSION_DURATION } = req.body;
    const userId = req.user.id;
    
    // Validate duration
    if (duration < MIN_SESSION_DURATION || duration > MAX_SESSION_DURATION) {
      return res.status(400).json({
        success: false,
        error: `Duration must be between ${MIN_SESSION_DURATION} and ${MAX_SESSION_DURATION} minutes`,
        code: 'INVALID_DURATION'
      });
    }
    
    // Get lesson data
    let lesson;
    if (lessonId && lessons[lessonId]) {
      lesson = lessons[lessonId];
    } else if (type) {
      // Find appropriate lesson based on type and difficulty
      const availableLesson = Object.values(lessons).find(
        l => l.type === type && l.difficulty === difficulty
      );
      lesson = availableLesson || lessons['pronunciation_basic_01'];
    } else {
      lesson = lessons['pronunciation_basic_01'];
    }
    
    // Create new session
    const sessionId = generateSessionId();
    const session = {
      sessionId,
      userId,
      lessonId: lesson.id,
      type: lesson.type,
      difficulty: lesson.difficulty,
      title: lesson.title,
      duration: duration,
      startedAt: new Date().toISOString(),
      status: 'active',
      content: lesson.content,
      progress: 0,
      currentExercise: 0,
      answers: [],
      xpEarned: 0
    };
    
    // Store active session
    activeSessions.set(sessionId, session);
    trackSessionAnalytics(sessionId, 'session_started', { lessonId: lesson.id, duration });
    
    res.json({
      success: true,
      data: {
        sessionId: session.sessionId,
        lesson: {
          id: lesson.id,
          title: lesson.title,
          type: lesson.type,
          difficulty: lesson.difficulty,
          duration: lesson.duration,
          xpReward: lesson.xpReward
        },
        content: lesson.content,
        startedAt: session.startedAt,
        totalExercises: getTotalExercises(lesson.content)
      }
    });
    
  } catch (error) {
    console.error('Start session error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start session',
      code: 'START_SESSION_FAILED'
    });
  }
};

/**
 * Submit exercise answer
 * POST /api/sessions/submit-exercise
 */
exports.submitExercise = async (req, res) => {
  try {
    const { sessionId, exerciseId, answer, audioData } = req.body;
    const userId = req.user.id;
    
    const session = activeSessions.get(sessionId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found or already completed',
        code: 'SESSION_NOT_FOUND'
      });
    }
    
    if (session.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Session does not belong to user',
        code: 'SESSION_ACCESS_DENIED'
      });
    }
    
    // Get exercise from session content
    const exercise = getExerciseById(session.content, exerciseId);
    if (!exercise) {
      return res.status(404).json({
        success: false,
        error: 'Exercise not found',
        code: 'EXERCISE_NOT_FOUND'
      });
    }
    
    // Evaluate based on exercise type
    let evaluation;
    switch (exercise.type) {
      case 'repeat':
      case 'speaking':
        evaluation = evaluatePronunciation(audioData, exercise.text, session);
        break;
      case 'matching':
      case 'fill_blank':
      case 'multiple_choice':
        evaluation = evaluateVocabulary(answer, exercise.answer, exercise.type);
        break;
      case 'correction':
        evaluation = evaluateGrammar(answer, exercise.correction, exercise.type);
        break;
      case 'minimal_pair':
        evaluation = evaluatePronunciation(audioData, exercise.word1, session);
        break;
      default:
        evaluation = { correct: true, score: 100, feedback: 'Exercise completed' };
    }
    
    // Save answer
    const userAnswer = {
      exerciseId,
      exerciseType: exercise.type,
      userAnswer: answer || audioData,
      correct: evaluation.correct !== undefined ? evaluation.correct : evaluation.score >= 70,
      score: evaluation.score || (evaluation.correct ? 100 : 0),
      feedback: evaluation.feedback,
      submittedAt: new Date().toISOString()
    };
    
    session.answers.push(userAnswer);
    session.currentExercise++;
    
    // Calculate progress
    const totalExercises = getTotalExercises(session.content);
    session.progress = (session.answers.length / totalExercises) * 100;
    
    activeSessions.set(sessionId, session);
    trackSessionAnalytics(sessionId, 'exercise_submitted', { exerciseId, score: userAnswer.score });
    
    res.json({
      success: true,
      data: {
        correct: userAnswer.correct,
        score: userAnswer.score,
        feedback: userAnswer.feedback,
        progress: session.progress,
        nextExercise: getNextExercise(session.content, session.currentExercise),
        explanation: evaluation.explanation || null,
        suggestions: evaluation.suggestions || []
      }
    });
    
  } catch (error) {
    console.error('Submit exercise error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit exercise',
      code: 'SUBMIT_EXERCISE_FAILED'
    });
  }
};

/**
 * Complete session
 * POST /api/sessions/complete
 */
exports.completeSession = async (req, res) => {
  try {
    const { sessionId } = req.body;
    const userId = req.user.id;
    
    const session = activeSessions.get(sessionId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
        code: 'SESSION_NOT_FOUND'
      });
    }
    
    if (session.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Session does not belong to user',
        code: 'SESSION_ACCESS_DENIED'
      });
    }
    
    // Calculate final score
    const totalScore = session.answers.reduce((sum, a) => sum + a.score, 0);
    const averageScore = session.answers.length > 0 ? totalScore / session.answers.length : 0;
    const finalScore = Math.round(averageScore);
    const isPerfect = finalScore === 100;
    
    // Calculate XP earned
    const xpEarned = calculateXP(session.type, finalScore, session.duration, isPerfect);
    
    // Generate feedback
    const feedback = generateFeedback(session.answers, session.type, finalScore);
    
    // Complete session
    const completedAt = new Date().toISOString();
    const completedSession = {
      ...session,
      status: 'completed',
      completedAt,
      finalScore,
      xpEarned,
      feedback,
      isPerfect,
      durationActual: calculateActualDuration(session.startedAt, completedAt)
    };
    
    // Remove from active and save to history
    activeSessions.delete(sessionId);
    saveSessionToHistory(userId, completedSession);
    
    // Update user stats
    await updateUserStats(userId, completedSession);
    
    trackSessionAnalytics(sessionId, 'session_completed', { 
      finalScore, 
      xpEarned, 
      duration: completedSession.durationActual 
    });
    
    res.json({
      success: true,
      message: 'Session completed successfully',
      data: {
        sessionId: completedSession.sessionId,
        finalScore: completedSession.finalScore,
        xpEarned: completedSession.xpEarned,
        isPerfect: completedSession.isPerfect,
        feedback: completedSession.feedback,
        completedAt: completedSession.completedAt,
        duration: completedSession.durationActual,
        answers: completedSession.answers.map(a => ({
          exerciseId: a.exerciseId,
          correct: a.correct,
          score: a.score,
          feedback: a.feedback
        }))
      }
    });
    
  } catch (error) {
    console.error('Complete session error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete session',
      code: 'COMPLETE_SESSION_FAILED'
    });
  }
};

/**
 * Get session history
 * GET /api/sessions/history
 */
exports.getSessionHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 20, offset = 0, type, startDate, endDate } = req.query;
    
    let sessions = getUserSessions(userId, parseInt(limit), parseInt(offset));
    
    // Filter by type
    if (type) {
      sessions = sessions.filter(s => s.type === type);
    }
    
    // Filter by date range
    if (startDate) {
      sessions = sessions.filter(s => s.completedAt >= startDate);
    }
    if (endDate) {
      sessions = sessions.filter(s => s.completedAt <= endDate);
    }
    
    // Format sessions for response
    const formattedSessions = sessions.map(s => ({
      sessionId: s.sessionId,
      title: s.title,
      type: s.type,
      difficulty: s.difficulty,
      duration: s.durationActual || s.duration,
      score: s.finalScore,
      xpEarned: s.xpEarned,
      completedAt: s.completedAt,
      isPerfect: s.isPerfect
    }));
    
    res.json({
      success: true,
      data: {
        sessions: formattedSessions,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: (userSessions.get(userId) || []).length
        },
        summary: {
          totalSessions: (userSessions.get(userId) || []).length,
          averageScore: calculateAverageScore(userId),
          totalXP: calculateTotalXP(userId),
          totalMinutes: calculateTotalMinutes(userId)
        }
      }
    });
    
  } catch (error) {
    console.error('Get session history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve session history',
      code: 'HISTORY_RETRIEVAL_FAILED'
    });
  }
};

/**
 * Get session details
 * GET /api/sessions/:sessionId
 */
exports.getSessionDetails = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;
    
    // Check active sessions first
    let session = activeSessions.get(sessionId);
    
    // If not active, check completed sessions
    if (!session) {
      session = completedSessions.get(sessionId);
    }
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
        code: 'SESSION_NOT_FOUND'
      });
    }
    
    if (session
