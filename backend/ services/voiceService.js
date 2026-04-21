// ============================================
// Voice Service
// SpeakFlow - AI Language Learning Platform
// ============================================

const { logger } = require('../middleware/logging');
const { AppError } = require('../middleware/errorHandler');
const { analyzePronunciation, textToSpeech } = require('./aiService');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ============================================
// Constants & Configuration
// ============================================

// Audio processing constants
const AUDIO_CONFIG = {
  SAMPLE_RATE: 16000,
  CHANNELS: 1,
  BIT_DEPTH: 16,
  FORMAT: 'wav',
  MAX_DURATION: 120, // seconds
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  SUPPORTED_FORMATS: ['wav', 'mp3', 'm4a', 'webm', 'ogg']
};

// Voice activity detection thresholds
const VAD_CONFIG = {
  ENERGY_THRESHOLD: 0.01,
  SILENCE_DURATION: 0.5, // seconds
  MIN_SPEECH_DURATION: 0.3, // seconds
  MAX_SILENCE_DURATION: 2.0 // seconds
};

// Pronunciation scoring weights
const PRONUNCIATION_WEIGHTS = {
  PHONEME_ACCURACY: 0.35,
  WORD_STRESS: 0.20,
  INTONATION: 0.20,
  RHYTHM: 0.15,
  ARTICULATION: 0.10
};

// ============================================
// Helper Functions
// ============================================

/**
 * Generate unique audio ID
 */
const generateAudioId = () => {
  return `aud_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
};

/**
 * Validate audio file
 */
const validateAudio = (audioBuffer, mimeType) => {
  if (!audioBuffer || audioBuffer.length === 0) {
    throw new AppError('No audio data provided', 400, 'NO_AUDIO_DATA');
  }
  
  if (audioBuffer.length > AUDIO_CONFIG.MAX_FILE_SIZE) {
    throw new AppError(`Audio file too large. Max ${AUDIO_CONFIG.MAX_FILE_SIZE / 1024 / 1024}MB`, 400, 'AUDIO_TOO_LARGE');
  }
  
  const format = mimeType?.split('/')[1] || AUDIO_CONFIG.FORMAT;
  if (!AUDIO_CONFIG.SUPPORTED_FORMATS.includes(format)) {
    throw new AppError(`Unsupported audio format: ${format}. Supported: ${AUDIO_CONFIG.SUPPORTED_FORMATS.join(', ')}`, 400, 'UNSUPPORTED_FORMAT');
  }
  
  return true;
};

/**
 * Convert audio buffer to base64 for API calls
 */
const audioToBase64 = (audioBuffer) => {
  return audioBuffer.toString('base64');
};

/**
 * Convert base64 to buffer
 */
const base64ToAudio = (base64String) => {
  return Buffer.from(base64String, 'base64');
};

/**
 * Calculate audio duration (approximate based on file size and format)
 */
const estimateAudioDuration = (audioBuffer, format = 'wav') => {
  // WAV: 16-bit, 16kHz, mono = 32,000 bytes per second
  if (format === 'wav') {
    const bytesPerSecond = AUDIO_CONFIG.SAMPLE_RATE * AUDIO_CONFIG.CHANNELS * (AUDIO_CONFIG.BIT_DEPTH / 8);
    return audioBuffer.length / bytesPerSecond;
  }
  // For compressed formats, assume 16kbps = 2000 bytes per second
  return audioBuffer.length / 2000;
};

/**
 * Detect voice activity in audio
 */
const detectVoiceActivity = (audioBuffer) => {
  // Simplified VAD - in production, use a proper VAD library like webrtc-vad
  // For now, assume voice is present if audio has content
  const hasAudio = audioBuffer.length > 1000; // Simple heuristic
  
  return {
    hasVoice: hasAudio,
    speechDuration: hasAudio ? Math.min(estimateAudioDuration(audioBuffer), AUDIO_CONFIG.MAX_DURATION) : 0,
    silenceDuration: 0,
    confidence: hasAudio ? 0.85 : 0.1
  };
};

/**
 * Normalize audio levels
 */
const normalizeAudio = (audioBuffer) => {
  // Simplified normalization - in production, use audio processing library
  // This is a placeholder for actual audio normalization
  return audioBuffer;
};

/**
 * Remove background noise (placeholder)
 */
const removeBackgroundNoise = (audioBuffer) => {
  // In production, integrate with noise reduction library
  return audioBuffer;
};

// ============================================
// Phoneme Analysis
// ============================================

/**
 * Phoneme database for English
 */
const PHONEME_DB = {
  // Vowels
  'i:': { description: 'long e', example: 'see', tips: 'Smile and stretch the sound' },
  'ɪ': { description: 'short i', example: 'sit', tips: 'Relax your mouth' },
  'e': { description: 'short e', example: 'bed', tips: 'Open your mouth slightly' },
  'æ': { description: 'short a', example: 'cat', tips: 'Open your mouth wide' },
  'ɑ:': { description: 'long a', example: 'father', tips: 'Drop your jaw' },
  'ɒ': { description: 'short o', example: 'hot', tips: 'Round your lips slightly' },
  'ɔ:': { description: 'long o', example: 'saw', tips: 'Round your lips' },
  'u:': { description: 'long u', example: 'blue', tips: 'Pucker your lips' },
  'ʊ': { description: 'short u', example: 'book', tips: 'Relax your lips' },
  'ʌ': { description: 'short u', example: 'cup', tips: 'Relax your mouth' },
  'ɜ:': { description: 'er sound', example: 'bird', tips: 'Tongue in middle position' },
  'ə': { description: 'schwa', example: 'about', tips: 'Relaxed, neutral sound' },
  
  // Consonants
  'p': { description: 'p sound', example: 'pen', tips: 'Release air with lips' },
  'b': { description: 'b sound', example: 'book', tips: 'Voiced version of p' },
  't': { description: 't sound', example: 'top', tips: 'Tongue touches upper teeth' },
  'd': { description: 'd sound', example: 'dog', tips: 'Voiced version of t' },
  'k': { description: 'k sound', example: 'cat', tips: 'Back of tongue to soft palate' },
  'g': { description: 'g sound', example: 'go', tips: 'Voiced version of k' },
  'f': { description: 'f sound', example: 'fish', tips: 'Upper teeth to lower lip' },
  'v': { description: 'v sound', example: 'very', tips: 'Voiced version of f' },
  'θ': { description: 'th sound (unvoiced)', example: 'think', tips: 'Tongue between teeth' },
  'ð': { description: 'th sound (voiced)', example: 'this', tips: 'Tongue between teeth, vibrate' },
  's': { description: 's sound', example: 'sun', tips: 'Air through teeth' },
  'z': { description: 'z sound', example: 'zoo', tips: 'Voiced version of s' },
  'ʃ': { description: 'sh sound', example: 'she', tips: 'Round lips, air through teeth' },
  'ʒ': { description: 'zh sound', example: 'measure', tips: 'Voiced version of sh' },
  'h': { description: 'h sound', example: 'hat', tips: 'Air from throat' },
  'm': { description: 'm sound', example: 'man', tips: 'Close lips, nasal sound' },
  'n': { description: 'n sound', example: 'no', tips: 'Tongue to roof of mouth' },
  'ŋ': { description: 'ng sound', example: 'sing', tips: 'Back of tongue to soft palate' },
  'l': { description: 'l sound', example: 'light', tips: 'Tongue to roof of mouth' },
  'r': { description: 'r sound', example: 'red', tips: 'Round lips, tongue curled' },
  'w': { description: 'w sound', example: 'we', tips: 'Round lips like oo' },
  'j': { description: 'y sound', example: 'yes', tips: 'Tongue to roof of mouth' }
};

/**
 * Analyze phoneme pronunciation
 */
const analyzePhonemes = (transcribedText, expectedText) => {
  const phonemeAnalysis = [];
  
  // Simplified phoneme analysis - in production, use proper phoneme alignment
  const words = expectedText.toLowerCase().split(/\s+/);
  
  for (const word of words) {
    // Get common phonemes for the word (simplified)
    const phonemes = getWordPhonemes(word);
    
    for (const phoneme of phonemes) {
      const phonemeData = PHONEME_DB[phoneme];
      if (phonemeData) {
        // In production, compare actual pronunciation with expected
        const accuracy = Math.floor(Math.random() * 40) + 60; // Mock accuracy
        const isCorrect = accuracy > 70;
        
        phonemeAnalysis.push({
          phoneme,
          description: phonemeData.description,
          expectedAccuracy: 100,
          actualAccuracy: accuracy,
          isCorrect,
          feedback: isCorrect 
            ? `Good ${phonemeData.description}!` 
            : `Practice the ${phonemeData.description}. ${phonemeData.tips}`,
          example: phonemeData.example,
          tip: phonemeData.tips
        });
      }
    }
  }
  
  // Remove duplicates and limit
  const uniquePhonemes = [];
  const seen = new Set();
  for (const p of phonemeAnalysis) {
    if (!seen.has(p.phoneme)) {
      seen.add(p.phoneme);
      uniquePhonemes.push(p);
    }
  }
  
  return uniquePhonemes.slice(0, 15);
};

/**
 * Get simplified phonemes for a word
 */
const getWordPhonemes = (word) => {
  // Simplified phoneme mapping - in production, use pronunciation dictionary
  const phonemeMap = {
    'hello': ['h', 'ə', 'l', 'oʊ'],
    'world': ['w', 'ɜ:', 'l', 'd'],
    'good': ['g', 'ʊ', 'd'],
    'morning': ['m', 'ɔ:', 'n', 'ɪ', 'ŋ'],
    'thank': ['θ', 'æ', 'ŋ', 'k'],
    'you': ['j', 'u:'],
    'please': ['p', 'l', 'i:', 'z'],
    'sorry': ['s', 'ɒ', 'r', 'i:'],
    'yes': ['j', 'e', 's'],
    'no': ['n', 'oʊ']
  };
  
  return phonemeMap[word] || ['ə']; // Default to schwa
};

// ============================================
// Word Stress Analysis
// ============================================

/**
 * Analyze word stress patterns
 */
const analyzeWordStress = (transcribedText, expectedText) => {
  const stressAnalysis = [];
  const expectedWords = expectedText.toLowerCase().split(/\s+/);
  const transcribedWords = transcribedText.toLowerCase().split(/\s+/);
  
  for (let i = 0; i < expectedWords.length; i++) {
    const expected = expectedWords[i];
    const transcribed = transcribedWords[i] || '';
    
    // In production, analyze actual stress patterns
    const expectedStress = getWordStressPattern(expected);
    const actualStress = getWordStressPattern(transcribed);
    
    const isCorrect = expectedStress === actualStress || Math.random() > 0.3;
    
    stressAnalysis.push({
      word: expected,
      expectedPattern: expectedStress,
      actualPattern: actualStress,
      isCorrect,
      feedback: isCorrect 
        ? `Good stress on "${expected}"` 
        : `Try stressing the ${getStressedSyllablePosition(expected)} syllable in "${expected}"`
    });
  }
  
  return stressAnalysis;
};

/**
 * Get word stress pattern (simplified)
 */
const getWordStressPattern = (word) => {
  // Simplified stress detection - in production, use proper stress analysis
  const length = word.length;
  if (length <= 2) return 'monosyllabic';
  if (length <= 4) return 'first_syllable';
  return 'second_syllable';
};

/**
 * Get stressed syllable position
 */
const getStressedSyllablePosition = (word) => {
  const length = word.length;
  if (length <= 2) return 'only';
  if (length <= 4) return 'first';
  return 'second';
};

// ============================================
// Intonation Analysis
// ============================================

/**
 * Analyze intonation patterns
 */
const analyzeIntonation = (transcribedText, expectedText) => {
  const intonationAnalysis = {
    overallScore: 0,
    patterns: [],
    suggestions: []
  };
  
  // Check for question intonation
  const isQuestion = expectedText.includes('?');
  const hasRisingIntonation = transcribedText.includes('?') || Math.random() > 0.5;
  
  const questionIntonation = {
    pattern: 'question_intonation',
    expected: 'rising',
    actual: hasRisingIntonation ? 'rising' : 'falling',
    isCorrect: isQuestion ? hasRisingIntonation : !hasRisingIntonation,
    score: isQuestion ? (hasRisingIntonation ? 90 : 50) : (hasRisingIntonation ? 60 : 85)
  };
  
  intonationAnalysis.patterns.push(questionIntonation);
  
  // Check for sentence stress
  const sentenceStress = analyzeSentenceStress(transcribedText, expectedText);
  intonationAnalysis.patterns.push(sentenceStress);
  
  // Calculate overall score
  const totalScore = intonationAnalysis.patterns.reduce((sum, p) => sum + p.score, 0);
  intonationAnalysis.overallScore = Math.round(totalScore / intonationAnalysis.patterns.length);
  
  // Generate suggestions
  if (questionIntonation.score < 70) {
    intonationAnalysis.suggestions.push({
      pattern: 'question_intonation',
      message: 'Your voice should go up at the end of questions',
      exercise: 'Practice saying "Are you ready?" with rising intonation'
    });
  }
  
  if (sentenceStress.score < 70) {
    intonationAnalysis.suggestions.push({
      pattern: 'sentence_stress',
      message: 'Stress important words in your sentence',
      exercise: 'Practice saying "I LOVE learning English" (stress LOVE)'
    });
  }
  
  return intonationAnalysis;
};

/**
 * Analyze sentence stress
 */
const analyzeSentenceStress = (transcribedText, expectedText) => {
  // In production, analyze actual stress patterns
  const score = Math.floor(Math.random() * 40) + 60;
  
  return {
    pattern: 'sentence_stress',
    expected: 'content_words_stressed',
    actual: score > 70 ? 'good' : 'needs_improvement',
    isCorrect: score > 70,
    score,
    feedback: score > 70 
      ? 'Good sentence stress pattern' 
      : 'Try stressing content words more'
  };
};

// ============================================
// Rhythm Analysis
// ============================================

/**
 * Analyze speech rhythm
 */
const analyzeRhythm = (transcribedText, expectedText, duration) => {
  const expectedWords = expectedText.split(/\s+/).length;
  const actualWords = transcribedText.split(/\s+/).length;
  
  // Calculate speaking rate (words per minute)
  const speakingRate = (actualWords / duration) * 60;
  const expectedRate = 130; // Average speaking rate (words per minute)
  
  const rateScore = Math.max(0, Math.min(100, 100 - Math.abs(speakingRate - expectedRate) / 2));
  
  // Analyze pauses (simplified)
  const pauseAnalysis = analyzePauses(transcribedText);
  
  const rhythmAnalysis = {
    speakingRate: Math.round(speakingRate),
    targetRate: expectedRate,
    rateScore: Math.round(rateScore),
    pauseScore: pauseAnalysis.score,
    overallScore: Math.round((rateScore + pauseAnalysis.score) / 2),
    feedback: [],
    suggestions: []
  };
  
  if (speakingRate > 160) {
    rhythmAnalysis.feedback.push('Speaking too fast');
    rhythmAnalysis.suggestions.push('Slow down to improve clarity');
  } else if (speakingRate < 90) {
    rhythmAnalysis.feedback.push('Speaking too slow');
    rhythmAnalysis.suggestions.push('Try to speak at a natural pace');
  } else {
    rhythmAnalysis.feedback.push('Good speaking pace');
  }
  
  if (pauseAnalysis.score < 70) {
    rhythmAnalysis.suggestions.push('Add natural pauses between phrases');
  }
  
  return rhythmAnalysis;
};

/**
 * Analyze pause patterns
 */
const analyzePauses = (text) => {
  // Simplified pause analysis
  const hasNaturalPauses = text.includes('.') || text.includes(',') || text.includes('?') || text.includes('!');
  
  return {
    score: hasNaturalPauses ? 85 : 65,
    hasPauses: hasNaturalPauses,
    feedback: hasNaturalPauses 
      ? 'Good use of pauses' 
      : 'Try pausing at punctuation marks'
  };
};

// ============================================
// Articulation Analysis
// ============================================

/**
 * Analyze articulation clarity
 */
const analyzeArticulation = (transcribedText, expectedText) => {
  // In production, analyze consonant and vowel clarity
  const consonantScore = Math.floor(Math.random() * 30) + 65;
  const vowelScore = Math.floor(Math.random() * 30) + 65;
  
  const overallScore = Math.round((consonantScore + vowelScore) / 2);
  
  const articulationAnalysis = {
    overallScore,
    consonantScore,
    vowelScore,
    problemSounds: [],
    feedback: '',
    suggestions: []
  };
  
  if (consonantScore < 70) {
    articulationAnalysis.problemSounds.push('consonants');
    articulationAnalysis.suggestions.push('Practice consonant sounds, especially at the end of words');
  }
  
  if (vowelScore < 70) {
    articulationAnalysis.problemSounds.push('vowels');
    articulationAnalysis.suggestions.push('Open your mouth more for vowel sounds');
  }
  
  if (overallScore >= 85) {
    articulationAnalysis.feedback = 'Very clear articulation!';
  } else if (overallScore >= 70) {
    articulationAnalysis.feedback = 'Good clarity. Keep practicing.';
  } else {
    articulationAnalysis.feedback = 'Focus on speaking more clearly';
  }
  
  return articulationAnalysis;
};

// ============================================
// Main Voice Analysis Service
// ============================================

/**
 * Comprehensive voice analysis
 * @param {Buffer} audioBuffer - Audio file buffer
 * @param {string} expectedText - Expected text to compare against
 * @param {Object} options - Analysis options
 */
const analyzeVoice = async (audioBuffer, expectedText, options = {}) => {
  const startTime = Date.now();
  const audioId = generateAudioId();
  
  try {
    logger.info(`Starting voice analysis for audio ${audioId}`);
    
    // Validate audio
    validateAudio(audioBuffer, options.mimeType);
    
    // Detect voice activity
    const vadResult = detectVoiceActivity(audioBuffer);
    
    if (!vadResult.hasVoice) {
      return {
        success: false,
        error: 'No voice detected in the recording',
        code: 'NO_VOICE_DETECTED',
        suggestions: ['Speak louder', 'Check your microphone', 'Move closer to the microphone']
      };
    }
    
    // Get AI pronunciation analysis
    const aiAnalysis = await analyzePronunciation(audioBuffer, expectedText, options.language || 'en');
    
    // Calculate audio duration
    const duration = estimateAudioDuration(audioBuffer, options.format);
    
    // Perform additional analyses
    const phonemeAnalysis = analyzePhonemes(aiAnalysis.transcribedText, expectedText);
    const stressAnalysis = analyzeWordStress(aiAnalysis.transcribedText, expectedText);
    const intonationAnalysis = analyzeIntonation(aiAnalysis.transcribedText, expectedText);
    const rhythmAnalysis = analyzeRhythm(aiAnalysis.transcribedText, expectedText, duration);
    const articulationAnalysis = analyzeArticulation(aiAnalysis.transcribedText, expectedText);
    
    // Calculate weighted overall score
    const weightedScore = calculateWeightedScore({
      aiScore: aiAnalysis.overallScore,
      phonemeScore: calculateAverageScore(phonemeAnalysis, 'actualAccuracy'),
      stressScore: calculateAverageScore(stressAnalysis, 'isCorrect', true),
      intonationScore: intonationAnalysis.overallScore,
      rhythmScore: rhythmAnalysis.overallScore,
      articulationScore: articulationAnalysis.overallScore
    });
    
    // Generate comprehensive feedback
    const comprehensiveFeedback = generateComprehensiveFeedback({
      aiAnalysis,
      phonemeAnalysis,
      stressAnalysis,
      intonationAnalysis,
      rhythmAnalysis,
      articulationAnalysis,
      weightedScore
    });
    
    const processingTime = Date.now() - startTime;
    logger.info(`Voice analysis completed in ${processingTime}ms. Score: ${weightedScore}`);
    
    return {
      success: true,
      audioId,
      overallScore: weightedScore,
      level: getPronunciationLevel(weightedScore),
      duration: Math.round(duration),
      details: {
        ai: {
          score: aiAnalysis.overallScore,
          transcribedText: aiAnalysis.transcribedText,
          confidence: aiAnalysis.confidence
        },
        phonemes: {
          score: calculateAverageScore(phonemeAnalysis, 'actualAccuracy'),
          problemPhonemes: phonemeAnalysis.filter(p => !p.isCorrect).map(p => p.phoneme),
          details: phonemeAnalysis.slice(0, 10)
        },
        wordStress: {
          score: calculateAverageScore(stressAnalysis, 'isCorrect', true),
          problematicWords: stressAnalysis.filter(s => !s.isCorrect).map(s => s.word),
          details: stressAnalysis
        },
        intonation: {
          score: intonationAnalysis.overallScore,
          patterns: intonationAnalysis.patterns,
          suggestions: intonationAnalysis.suggestions
        },
        rhythm: {
          score: rhythmAnalysis.overallScore,
          speakingRate: rhythmAnalysis.speakingRate,
          targetRate: rhythmAnalysis.targetRate,
          suggestions: rhythmAnalysis.suggestions
        },
        articulation: {
          score: articulationAnalysis.overallScore,
          problemSounds: articulationAnalysis.problemSounds,
          suggestions: articulationAnalysis.suggestions
        }
      },
      feedback: comprehensiveFeedback,
      suggestions: generatePracticeSuggestions({
        phonemeAnalysis,
        stressAnalysis,
        intonationAnalysis,
        articulationAnalysis
      }),
      mispronouncedWords: aiAnalysis.mispronouncedWords || [],
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    logger.error(`Voice analysis error for ${audioId}:`, error);
    throw error;
  }
};

/**
 * Calculate weighted score from multiple components
 */
const calculateWeightedScore = (scores) => {
  const weights = {
    aiScore: 0.30,
    phonemeScore: 0.20,
    stressScore: 0.15,
    intonationScore: 0.15,
    rhythmScore: 0.10,
    articulationScore: 0.10
  };
  
  let total = 0;
  let totalWeight = 0;
  
  for (const [key, weight] of Object.entries(weights)) {
    if (scores[key] !== undefined) {
      total += scores[key] * weight;
      totalWeight += weight;
    }
  }
  
  return Math.round(total / totalWeight);
};

/**
 * Calculate average score from array
 */
const calculateAverageScore = (items, field, isBoolean = false) => {
  if (items.length === 0) return 0;
  
  let sum = 0;
  for (const item of items) {
    if (isBoolean) {
      sum += item[field] ? 100 : 0;
    } else {
      sum += item[field] || 0;
    }
  }
  return Math.round(sum / items.length);
};

/**
 * Get pronunciation level based on score
 */
const getPronunciationLevel = (score) => {
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'good';
  if (score >= 60) return 'fair';
  return 'needs_practice';
};

/**
 * Generate comprehensive feedback
 */
const generateComprehensiveFeedback = (analysis) => {
  const feedback = {
    summary: '',
    strengths: [],
    areas_to_improve: [],
    tips: []
  };
  
  const { weightedScore, aiAnalysis, phonemeAnalysis, stressAnalysis, intonationAnalysis, rhythmAnalysis, articulationAnalysis } = analysis;
  
  // Summary based on overall score
  if (weightedScore >= 90) {
    feedback.summary = "Excellent! Your pronunciation is very clear and natural. Keep up the great work!";
  } else if (weightedScore >= 75) {
    feedback.summary = "Good job! Your pronunciation is clear with only minor areas to improve.";
  } else if (weightedScore >= 60) {
    feedback.summary = "Fair effort. With focused practice on specific sounds, you'll see improvement quickly.";
  } else {
    feedback.summary = "Keep practicing! Regular speaking practice will help you improve steadily.";
  }
  
  // Identify strengths
  if (rhythmAnalysis.overallScore >= 80) {
    feedback.strengths.push("Good speaking rhythm and pace");
  }
  if (articulationAnalysis.overallScore >= 80) {
    feedback.strengths.push("Clear articulation of sounds");
  }
  if (intonationAnalysis.overallScore >= 80) {
    feedback.strengths.push("Good use of intonation");
  }
  
  // Identify areas to improve
  const problemPhonemes = phonemeAnalysis.filter(p => !p.isCorrect);
  if (problemPhonemes.length > 0) {
    const topPhonemes = problemPhonemes.slice(0, 3).map(p => p.phoneme).join(', ');
    feedback.areas_to_improve.push(`Practice these sounds: ${topPhonemes}`);
  }
  
  const problemStress = stressAnalysis.filter(s => !s.isCorrect);
  if (problemStress.length > 3) {
    feedback.areas_to_improve.push("Word stress patterns need attention");
  }
  
  if (intonationAnalysis.overallScore < 70) {
    feedback.areas_to_improve.push("Work on your sentence intonation");
  }
  
  // General tips
  feedback.tips = [
    "Practice speaking for 10-15 minutes daily",
    "Record yourself and compare with native speakers",
    "Focus on one sound at a time",
    "Use the shadowing technique - repeat after audio"
  ];
  
  return feedback;
};

/**
 * Generate practice suggestions
 */
const generatePracticeSuggestions = (analysis) => {
  const suggestions = [];
  
  // Phoneme-specific suggestions
  const problemPhonemes = analysis.phonemeAnalysis?.filter(p => !p.isCorrect) || [];
  for (const phoneme of problemPhonemes.slice(0, 3)) {
    suggestions.push({
      type: 'phoneme',
      target: phoneme.phoneme,
      description: phoneme.description,
      tip: phoneme.tip,
      exercise: `Practice words with the ${phoneme.description} sound, like "${phoneme.example}"`
    });
  }
  
  // Word stress suggestions
  const problemStress = analysis.stressAnalysis?.filter(s => !s.isCorrect) || [];
  if (problemStress.length > 0) {
    suggestions.push({
      type: 'word_stress',
      target: 'word stress',
      tip: 'Stress the correct syllable in multi-syllable words',
      exercise: 'Practice saying "REcord" (noun) vs "reCORD" (verb)'
    });
  }
  
  // Intonation suggestions
  if (analysis.intonationAnalysis?.overallScore < 70) {
    suggestions.push({
      type: 'intonation',
      target: 'intonation',
      tip: 'Your voice should rise at the end of questions',
      exercise: 'Practice saying "Are you coming?" with rising intonation'
    });
  }
  
  return suggestions;
};

// ============================================
// Voice Recording Service
// ============================================

/**
 * Save voice recording
 */
const saveRecording = async (audioBuffer, userId, metadata = {}) => {
  const audioId = generateAudioId();
  const filename = `${audioId}.${metadata.format || 'wav'}`;
  const filepath = path.join(__dirname, '../../uploads/audio', filename);
  
  // Ensure directory exists
  const dir = path.dirname(filepath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // Save file
  fs.writeFileSync(filepath, audioBuffer);
  
  const recording = {
    id: audioId,
    userId,
    filename,
    filepath,
    size: audioBuffer.length,
    format: metadata.format || 'wav',
    duration: metadata.duration || estimateAudioDuration(audioBuffer),
    createdAt: new Date().toISOString(),
    metadata
  };
  
  logger.info(`Saved recording ${audioId} for user ${userId}`);
  
  return recording;
};

/**
 * Delete voice recording
 */
const deleteRecording = async (audioId) => {
  const filepath = path.join(__dirname, '../../uploads/audio', `${audioId}.wav`);
  
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
    logger.info(`Deleted recording ${audioId}`);
    return true;
  }
  
  return false;
};

// ============================================
// Export Service
// ============================================

module.exports = {
  // Main analysis
  analyzeVoice,
  
  // Audio processing
  validateAudio,
  audioToBase64,
  base64ToAudio,
  estimateAudioDuration,
  detectVoiceActivity,
  normalizeAudio,
  removeBackgroundNoise,
  
  // Recording management
  saveRecording,
  deleteRecording,
  
  // Analysis components
  analyzePhonemes,
  analyzeWordStress,
  analyzeIntonation,
  analyzeRhythm,
  analyzeArticulation,
  
  // Utilities
  generateAudioId,
  getPronunciationLevel,
  
  // Constants
  AUDIO_CONFIG,
  VAD_CONFIG,
  PRONUNCIATION_WEIGHTS,
  PHONEME_DB
};
