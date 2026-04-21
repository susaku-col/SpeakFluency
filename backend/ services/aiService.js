// ============================================
// AI Service
// SpeakFlow - AI Language Learning Platform
// ============================================

const OpenAI = require('openai');
const { logger } = require('../middleware/logging');
const { AppError } = require('../middleware/errorHandler');

// ============================================
// Constants & Configuration
// ============================================

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  organization: process.env.OPENAI_ORG_ID
});

// Model configurations
const MODELS = {
  GPT4: 'gpt-4-turbo-preview',
  GPT35: 'gpt-3.5-turbo',
  WHISPER: 'whisper-1',
  TTS: 'tts-1',
  TTS_HD: 'tts-1-hd',
  EMBEDDING: 'text-embedding-3-small'
};

// Voice settings for TTS
const VOICE_SETTINGS = {
  alloy: { name: 'Alloy', gender: 'neutral', description: 'Balanced and versatile' },
  echo: { name: 'Echo', gender: 'male', description: 'Deep and resonant' },
  fable: { name: 'Fable', gender: 'male', description: 'British English' },
  onyx: { name: 'Onyx', gender: 'male', description: 'Deep and authoritative' },
  nova: { name: 'Nova', gender: 'female', description: 'Warm and friendly' },
  shimmer: { name: 'Shimmer', gender: 'female', description: 'Clear and articulate' }
};

// Pronunciation analysis thresholds
const PRONUNCIATION_THRESHOLDS = {
  EXCELLENT: 90,
  GOOD: 75,
  FAIR: 60,
  NEEDS_IMPROVEMENT: 40
};

// ============================================
// Helper Functions
// ============================================

/**
 * Measure API response time
 */
const measureApiTime = async (apiCall, apiName) => {
  const start = Date.now();
  try {
    const result = await apiCall();
    const duration = Date.now() - start;
    logger.info(`${apiName} completed in ${duration}ms`);
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    logger.error(`${apiName} failed after ${duration}ms:`, error);
    throw error;
  }
};

/**
 * Calculate pronunciation score
 */
const calculatePronunciationScore = (analysis) => {
  let score = 0;
  let totalWeight = 0;
  
  const weights = {
    accuracy: 0.4,
    fluency: 0.25,
    intonation: 0.2,
    pace: 0.15
  };
  
  for (const [key, weight] of Object.entries(weights)) {
    if (analysis[key]) {
      score += analysis[key] * weight;
      totalWeight += weight;
    }
  }
  
  return totalWeight > 0 ? Math.round(score / totalWeight) : 0;
};

/**
 * Get pronunciation level
 */
const getPronunciationLevel = (score) => {
  if (score >= PRONUNCIATION_THRESHOLDS.EXCELLENT) return 'excellent';
  if (score >= PRONUNCIATION_THRESHOLDS.GOOD) return 'good';
  if (score >= PRONUNCIATION_THRESHOLDS.FAIR) return 'fair';
  return 'needs_improvement';
};

/**
 * Generate feedback message based on score
 */
const generateFeedbackMessage = (score, level, details) => {
  if (score >= 90) {
    return "Excellent pronunciation! You sound like a native speaker. Keep up the great work!";
  }
  if (score >= 75) {
    return "Good pronunciation! A few minor improvements will make you sound even more natural.";
  }
  if (score >= 60) {
    return "Fair pronunciation. Focus on the suggested areas to improve your clarity.";
  }
  return "Keep practicing! Your pronunciation will improve with consistent effort.";
};

// ============================================
// Pronunciation Analysis Service
// ============================================

/**
 * Analyze pronunciation using Whisper API
 * @param {Buffer|string} audioData - Audio file buffer or base64 string
 * @param {string} expectedText - Expected text to compare against
 * @param {string} language - Language code (default: 'en')
 */
const analyzePronunciation = async (audioData, expectedText, language = 'en') => {
  try {
    logger.info(`Analyzing pronunciation for text: "${expectedText.substring(0, 50)}..."`);
    
    // Prepare audio for Whisper API
    let audioFile;
    if (typeof audioData === 'string' && audioData.startsWith('data:audio')) {
      // Convert base64 to buffer
      const base64Data = audioData.split(',')[1];
      audioFile = Buffer.from(base64Data, 'base64');
    } else if (Buffer.isBuffer(audioData)) {
      audioFile = audioData;
    } else {
      throw new AppError('Invalid audio data format', 400, 'INVALID_AUDIO');
    }
    
    // Transcribe audio using Whisper
    const transcription = await measureApiTime(async () => {
      const response = await openai.audio.transcriptions.create({
        file: new File([audioFile], 'audio.wav', { type: 'audio/wav' }),
        model: MODELS.WHISPER,
        language,
        response_format: 'verbose_json',
        temperature: 0.2
      });
      return response;
    }, 'Whisper Transcription');
    
    const transcribedText = transcription.text.toLowerCase();
    const expectedLower = expectedText.toLowerCase();
    
    // Calculate accuracy based on word matching
    const expectedWords = expectedLower.split(/\s+/);
    const transcribedWords = transcribedText.split(/\s+/);
    
    let correctWords = 0;
    for (let i = 0; i < Math.min(expectedWords.length, transcribedWords.length); i++) {
      if (expectedWords[i] === transcribedWords[i]) {
        correctWords++;
      }
    }
    
    const wordAccuracy = (correctWords / expectedWords.length) * 100;
    
    // Calculate fluency (based on word count ratio)
    const fluency = Math.min(100, (transcribedWords.length / expectedWords.length) * 100);
    
    // Calculate pace (based on duration - simplified)
    const pace = Math.min(100, Math.max(0, 100 - Math.abs(transcribedWords.length - expectedWords.length) * 5));
    
    // Calculate intonation (simplified - based on punctuation and sentence structure)
    const intonation = calculateIntonationScore(transcribedText, expectedLower);
    
    // Identify mispronounced words
    const mispronouncedWords = [];
    for (let i = 0; i < expectedWords.length; i++) {
      if (i < transcribedWords.length && expectedWords[i] !== transcribedWords[i]) {
        mispronouncedWords.push({
          expected: expectedWords[i],
          actual: transcribedWords[i] || '[missing]',
          suggestion: generatePronunciationSuggestion(expectedWords[i])
        });
      } else if (i >= transcribedWords.length) {
        mispronouncedWords.push({
          expected: expectedWords[i],
          actual: '[not spoken]',
          suggestion: `Try saying "${expectedWords[i]}"`
        });
      }
    }
    
    // Calculate overall score
    const analysis = {
      accuracy: wordAccuracy,
      fluency,
      pace,
      intonation
    };
    
    const overallScore = calculatePronunciationScore(analysis);
    const level = getPronunciationLevel(overallScore);
    
    // Generate feedback
    const feedback = generateFeedbackMessage(overallScore, level, analysis);
    
    // Generate improvement suggestions
    const suggestions = generateImprovementSuggestions(analysis, mispronouncedWords);
    
    const result = {
      success: true,
      transcribedText,
      expectedText: expectedLower,
      overallScore,
      level,
      feedback,
      details: {
        accuracy: Math.round(analysis.accuracy),
        fluency: Math.round(analysis.fluency),
        intonation: Math.round(analysis.intonation),
        pace: Math.round(analysis.pace),
        wordAccuracy: Math.round(wordAccuracy)
      },
      mispronouncedWords: mispronouncedWords.slice(0, 10),
      suggestions,
      confidence: transcription.segments?.[0]?.confidence || 0.85
    };
    
    logger.info(`Pronunciation analysis complete. Score: ${overallScore}, Level: ${level}`);
    return result;
    
  } catch (error) {
    logger.error('Pronunciation analysis error:', error);
    throw new AppError('Failed to analyze pronunciation', 500, 'AI_SERVICE_ERROR');
  }
};

/**
 * Calculate intonation score
 */
const calculateIntonationScore = (transcribed, expected) => {
  // Simplified intonation scoring based on punctuation and sentence structure
  let score = 70; // Base score
  
  // Check for proper punctuation indicators
  if (transcribed.endsWith('?') && expected.endsWith('?')) score += 10;
  if (transcribed.endsWith('!') && expected.endsWith('!')) score += 10;
  if (transcribed.endsWith('.') && expected.endsWith('.')) score += 5;
  
  // Check for sentence length similarity
  const lengthRatio = Math.min(transcribed.length, expected.length) / Math.max(transcribed.length, expected.length);
  score += lengthRatio * 10;
  
  return Math.min(100, score);
};

/**
 * Generate pronunciation suggestion for a word
 */
const generatePronunciationSuggestion = (word) => {
  const suggestions = {
    'hello': 'Say "heh-loh" with stress on the second syllable',
    'world': 'Say "wur-ld" with a slight "r" sound',
    'good': 'Say "guh-d" with a soft "d" at the end',
    'morning': 'Say "mor-ning" - the "g" is soft',
    'thank': 'Say "th-ank" - put your tongue between your teeth for "th"',
    'you': 'Say "y-oo" - round your lips',
    'please': 'Say "pl-ee-z" - the "z" sound at the end',
    'sorry': 'Say "saw-ree" - stress on the first syllable',
    'yes': 'Say "y-eh-s" - short "e" sound',
    'no': 'Say "n-oh" - open your mouth wide'
  };
  
  return suggestions[word.toLowerCase()] || `Practice saying "${word}" slowly, then increase speed`;
};

/**
 * Generate improvement suggestions
 */
const generateImprovementSuggestions = (analysis, mispronouncedWords) => {
  const suggestions = [];
  
  if (analysis.accuracy < 70) {
    suggestions.push({
      area: 'accuracy',
      message: 'Focus on pronouncing each word clearly',
      exercises: ['Repeat after native speakers', 'Use minimal pair exercises']
    });
  }
  
  if (analysis.fluency < 70) {
    suggestions.push({
      area: 'fluency',
      message: 'Practice speaking at a steady pace',
      exercises: ['Read aloud daily', 'Use shadowing technique']
    });
  }
  
  if (analysis.intonation < 70) {
    suggestions.push({
      area: 'intonation',
      message: 'Work on your sentence stress and rhythm',
      exercises: ['Listen and repeat phrases', 'Record and compare']
    });
  }
  
  if (mispronouncedWords.length > 0) {
    suggestions.push({
      area: 'specific_words',
      message: `Practice these words: ${mispronouncedWords.slice(0, 3).map(w => w.expected).join(', ')}`,
      exercises: ['Use flashcards with audio', 'Practice minimal pairs']
    });
  }
  
  return suggestions;
};

// ============================================
// Text-to-Speech Service
// ============================================

/**
 * Convert text to speech using OpenAI TTS
 * @param {string} text - Text to convert to speech
 * @param {string} voice - Voice to use (alloy, echo, fable, onyx, nova, shimmer)
 * @param {string} speed - Speed of speech (0.25 to 4.0)
 * @returns {Promise<Buffer>} Audio buffer
 */
const textToSpeech = async (text, voice = 'nova', speed = 1.0) => {
  try {
    logger.info(`Converting text to speech: "${text.substring(0, 50)}..."`);
    
    if (!VOICE_SETTINGS[voice]) {
      voice = 'nova';
    }
    
    const response = await measureApiTime(async () => {
      const mp3 = await openai.audio.speech.create({
        model: MODELS.TTS,
        voice,
        input: text,
        speed: Math.min(4.0, Math.max(0.25, speed))
      });
      
      // Convert to buffer
      const buffer = Buffer.from(await mp3.arrayBuffer());
      return buffer;
    }, 'TTS Generation');
    
    logger.info(`TTS generated successfully (${response.length} bytes)`);
    
    return {
      success: true,
      audio: response.toString('base64'),
      format: 'mp3',
      duration: estimateAudioDuration(text, speed),
      voice,
      text
    };
    
  } catch (error) {
    logger.error('TTS error:', error);
    throw new AppError('Failed to generate speech', 500, 'TTS_ERROR');
  }
};

/**
 * Estimate audio duration based on text length
 */
const estimateAudioDuration = (text, speed) => {
  const wordsPerMinute = 130; // Average speaking rate
  const wordCount = text.split(/\s+/).length;
  const durationSeconds = (wordCount / wordsPerMinute) * 60 / speed;
  return Math.ceil(durationSeconds);
};

// ============================================
// Conversation AI Service
// ============================================

/**
 * Generate AI conversation response
 * @param {string} userMessage - User's message
 * @param {string} context - Conversation context
 * @param {string} level - User's language level
 */
const generateConversationResponse = async (userMessage, context = '', level = 'intermediate') => {
  try {
    logger.info(`Generating conversation response for level: ${level}`);
    
    const systemPrompt = getConversationSystemPrompt(level);
    const conversationHistory = context || `User is practicing English at ${level} level. Be encouraging and helpful.`;
    
    const response = await measureApiTime(async () => {
      const completion = await openai.chat.completions.create({
        model: MODELS.GPT35,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: conversationHistory },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.7,
        max_tokens: 150,
        presence_penalty: 0.6,
        frequency_penalty: 0.5
      });
      
      return completion.choices[0].message.content;
    }, 'Conversation AI');
    
    // Analyze response for learning opportunities
    const analysis = await analyzeResponseForLearning(response, userMessage, level);
    
    return {
      success: true,
      response: response,
      analysis,
      suggestions: analysis.learningOpportunities
    };
    
  } catch (error) {
    logger.error('Conversation AI error:', error);
    throw new AppError('Failed to generate conversation response', 500, 'AI_SERVICE_ERROR');
  }
};

/**
 * Get system prompt based on user level
 */
const getConversationSystemPrompt = (level) => {
  const prompts = {
    beginner: `You are a friendly English tutor helping a beginner learner.
      - Use simple words and short sentences
      - Speak slowly and clearly
      - Correct mistakes gently
      - Ask simple questions
      - Be encouraging and positive
      - Use basic vocabulary (A1-A2 level)`,
    
    intermediate: `You are a helpful English tutor for an intermediate learner.
      - Use natural but clear English
      - Introduce new vocabulary occasionally
      - Correct significant errors
      - Ask thought-provoking questions
      - Encourage detailed responses
      - Use B1-B2 level vocabulary`,
    
    advanced: `You are an English conversation partner for an advanced learner.
      - Use natural, fluent English
      - Discuss complex topics
      - Introduce idioms and expressions
      - Provide nuanced feedback
      - Challenge the learner
      - Use C1-C2 level vocabulary`
  };
  
  return prompts[level] || prompts.intermediate;
};

/**
 * Analyze response for learning opportunities
 */
const analyzeResponseForLearning = async (response, userMessage, level) => {
  const analysis = {
    vocabularyLevel: level,
    newWords: [],
    grammarPoints: [],
    corrections: [],
    learningOpportunities: []
  };
  
  // Extract potential new vocabulary (simplified)
  const words = response.split(/\s+/);
  const commonWords = new Set(['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'I']);
  
  for (const word of words) {
    const cleanWord = word.toLowerCase().replace(/[^a-z]/g, '');
    if (cleanWord.length > 5 && !commonWords.has(cleanWord)) {
      analysis.newWords.push(cleanWord);
    }
  }
  
  analysis.newWords = [...new Set(analysis.newWords)].slice(0, 5);
  
  if (analysis.newWords.length > 0) {
    analysis.learningOpportunities.push({
      type: 'vocabulary',
      message: `New words to learn: ${analysis.newWords.join(', ')}`,
      items: analysis.newWords
    });
  }
  
  return analysis;
};

// ============================================
// Grammar Check Service
// ============================================

/**
 * Check grammar and provide corrections
 * @param {string} text - Text to check
 * @param {string} level - User's language level
 */
const checkGrammar = async (text, level = 'intermediate') => {
  try {
    logger.info(`Checking grammar for text: "${text.substring(0, 50)}..."`);
    
    const response = await measureApiTime(async () => {
      const completion = await openai.chat.completions.create({
        model: MODELS.GPT35,
        messages: [
          {
            role: 'system',
            content: `You are a grammar expert. Analyze the following text for grammar errors.
              Return a JSON object with:
              - hasErrors (boolean)
              - errors (array of {original, correction, explanation, type})
              - score (0-100)
              - suggestions (array of improvement tips)
              Keep explanations simple for a ${level} level learner.`
          },
          { role: 'user', content: text }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      });
      
      return JSON.parse(completion.choices[0].message.content);
    }, 'Grammar Check');
    
    return {
      success: true,
      originalText: text,
      hasErrors: response.hasErrors,
      errors: response.errors || [],
      score: response.score || 100,
      suggestions: response.suggestions || [],
      level
    };
    
  } catch (error) {
    logger.error('Grammar check error:', error);
    throw new AppError('Failed to check grammar', 500, 'AI_SERVICE_ERROR');
  }
};

// ============================================
// Vocabulary Enhancement Service
// ============================================

/**
 * Generate vocabulary explanations and examples
 * @param {string} word - Word to explain
 * @param {string} level - User's language level
 */
const explainVocabulary = async (word, level = 'intermediate') => {
  try {
    logger.info(`Explaining vocabulary: "${word}"`);
    
    const response = await measureApiTime(async () => {
      const completion = await openai.chat.completions.create({
        model: MODELS.GPT35,
        messages: [
          {
            role: 'system',
            content: `You are a vocabulary expert. Explain the word "${word}" for a ${level} level English learner.
              Return a JSON object with:
              - word (string)
              - pronunciation (simple phonetic guide)
              - partOfSpeech (string)
              - definitions (array of {meaning, example})
              - synonyms (array)
              - antonyms (array)
              - commonPhrases (array of phrases using the word)
              - tips (string - memory aid)`
          }
        ],
        temperature: 0.5,
        response_format: { type: 'json_object' }
      });
      
      return JSON.parse(completion.choices[0].message.content);
    }, 'Vocabulary Explanation');
    
    return {
      success: true,
      ...response
    };
    
  } catch (error) {
    logger.error('Vocabulary explanation error:', error);
    throw new AppError('Failed to explain vocabulary', 500, 'AI_SERVICE_ERROR');
  }
};

/**
 * Generate vocabulary quiz questions
 * @param {Array} words - List of words to quiz on
 * @param {number} questionCount - Number of questions to generate
 */
const generateVocabularyQuiz = async (words, questionCount = 5) => {
  try {
    logger.info(`Generating vocabulary quiz for ${words.length} words`);
    
    const response = await measureApiTime(async () => {
      const completion = await openai.chat.completions.create({
        model: MODELS.GPT35,
        messages: [
          {
            role: 'system',
            content: `Generate a vocabulary quiz with ${questionCount} multiple-choice questions.
              Return a JSON object with:
              - questions (array of {question, options: array of 4, correctAnswer, explanation})
              Make questions engaging and educational.`
          },
          {
            role: 'user',
            content: `Create a quiz for these words: ${words.join(', ')}`
          }
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' }
      });
      
      return JSON.parse(completion.choices[0].message.content);
    }, 'Quiz Generation');
    
    return {
      success: true,
      questions: response.questions || [],
      totalQuestions: questionCount
    };
    
  } catch (error) {
    logger.error('Quiz generation error:', error);
    throw new AppError('Failed to generate quiz', 500, 'AI_SERVICE_ERROR');
  }
};

// ============================================
// Text Simplification Service
// ============================================

/**
 * Simplify text for language learners
 * @param {string} text - Original text
 * @param {string} targetLevel - Target difficulty level
 */
const simplifyText = async (text, targetLevel = 'intermediate') => {
  try {
    logger.info(`Simplifying text to ${targetLevel} level`);
    
    const response = await measureApiTime(async () => {
      const completion = await openai.chat.completions.create({
        model: MODELS.GPT35,
        messages: [
          {
            role: 'system',
            content: `Simplify the following text for a ${targetLevel} level English learner.
              - Use simpler vocabulary
              - Shorter sentences
              - Clear structure
              - Keep the main meaning
              Return the simplified text.`
          },
          { role: 'user', content: text }
        ],
        temperature: 0.5,
        max_tokens: 1000
      });
      
      return completion.choices[0].message.content;
    }, 'Text Simplification');
    
    return {
      success: true,
      original: text,
      simplified: response,
      targetLevel
    };
    
  } catch (error) {
    logger.error('Text simplification error:', error);
    throw new AppError('Failed to simplify text', 500, 'AI_SERVICE_ERROR');
  }
};

// ============================================
// Embedding Service
// ============================================

/**
 * Generate text embedding for similarity search
 * @param {string} text - Text to embed
 */
const generateEmbedding = async (text) => {
  try {
    const response = await measureApiTime(async () => {
      const embedding = await openai.embeddings.create({
        model: MODELS.EMBEDDING,
        input: text,
        encoding_format: 'float'
      });
      
      return embedding.data[0].embedding;
    }, 'Embedding Generation');
    
    return {
      success: true,
      embedding: response,
      dimensions: response.length
    };
    
  } catch (error) {
    logger.error('Embedding generation error:', error);
    throw new AppError('Failed to generate embedding', 500, 'AI_SERVICE_ERROR');
  }
};

// ============================================
// Export Service
// ============================================

module.exports = {
  // Pronunciation
  analyzePronunciation,
  
  // Text-to-Speech
  textToSpeech,
  
  // Conversation
  generateConversationResponse,
  
  // Grammar
  checkGrammar,
  
  // Vocabulary
  explainVocabulary,
  generateVocabularyQuiz,
  
  // Text Processing
  simplifyText,
  generateEmbedding,
  
  // Utilities
  calculatePronunciationScore,
  getPronunciationLevel,
  
  // Constants
  VOICE_SETTINGS,
  MODELS,
  PRONUNCIATION_THRESHOLDS
};
