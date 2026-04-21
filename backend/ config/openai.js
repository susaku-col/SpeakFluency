// ============================================
// OpenAI Configuration
// SpeakFlow - AI Language Learning Platform
// ============================================

const OpenAI = require('openai');
const { logger } = require('../middleware/logging');

// ============================================
// Constants & Configuration
// ============================================

// Initialize OpenAI client
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_ORG_ID = process.env.OPENAI_ORG_ID;

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
  organization: OPENAI_ORG_ID || undefined,
  maxRetries: 3,
  timeout: 30000
});

// Model configurations
const MODEL_CONFIGS = {
  // GPT-4 Models
  'gpt-4-turbo-preview': {
    name: 'GPT-4 Turbo',
    maxTokens: 4096,
    temperature: 0.7,
    topP: 1,
    frequencyPenalty: 0,
    presencePenalty: 0,
    costPer1KTokens: 0.01 // Input, $0.03 for output
  },
  'gpt-4': {
    name: 'GPT-4',
    maxTokens: 8192,
    temperature: 0.7,
    topP: 1,
    frequencyPenalty: 0,
    presencePenalty: 0,
    costPer1KTokens: 0.03
  },
  'gpt-4-32k': {
    name: 'GPT-4 32K',
    maxTokens: 32768,
    temperature: 0.7,
    topP: 1,
    frequencyPenalty: 0,
    presencePenalty: 0,
    costPer1KTokens: 0.06
  },
  
  // GPT-3.5 Models
  'gpt-3.5-turbo': {
    name: 'GPT-3.5 Turbo',
    maxTokens: 4096,
    temperature: 0.7,
    topP: 1,
    frequencyPenalty: 0,
    presencePenalty: 0,
    costPer1KTokens: 0.001
  },
  'gpt-3.5-turbo-16k': {
    name: 'GPT-3.5 Turbo 16K',
    maxTokens: 16384,
    temperature: 0.7,
    topP: 1,
    frequencyPenalty: 0,
    presencePenalty: 0,
    costPer1KTokens: 0.002
  },
  
  // Embedding Models
  'text-embedding-3-small': {
    name: 'Text Embedding 3 Small',
    dimensions: 1536,
    costPer1KTokens: 0.00002
  },
  'text-embedding-3-large': {
    name: 'Text Embedding 3 Large',
    dimensions: 3072,
    costPer1KTokens: 0.00013
  },
  'text-embedding-ada-002': {
    name: 'Ada Embedding V2',
    dimensions: 1536,
    costPer1KTokens: 0.0001
  },
  
  // Audio Models
  'whisper-1': {
    name: 'Whisper',
    costPerMinute: 0.006
  },
  'tts-1': {
    name: 'TTS Standard',
    costPer1KCharacters: 0.015
  },
  'tts-1-hd': {
    name: 'TTS HD',
    costPer1KCharacters: 0.030
  }
};

// Default model settings
const DEFAULT_MODELS = {
  CHAT: process.env.OPENAI_CHAT_MODEL || 'gpt-3.5-turbo',
  EMBEDDING: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
  TRANSCRIPTION: 'whisper-1',
  TTS: process.env.OPENAI_TTS_MODEL || 'tts-1'
};

// Voice settings for TTS
const VOICE_SETTINGS = {
  alloy: { gender: 'neutral', description: 'Balanced and versatile' },
  echo: { gender: 'male', description: 'Deep and resonant' },
  fable: { gender: 'male', description: 'British English' },
  onyx: { gender: 'male', description: 'Deep and authoritative' },
  nova: { gender: 'female', description: 'Warm and friendly' },
  shimmer: { gender: 'female', description: 'Clear and articulate' }
};

// System prompts for different use cases
const SYSTEM_PROMPTS = {
  // Conversation tutor
  conversation_tutor: `You are a friendly English tutor helping a language learner.
    - Use clear, natural English
    - Correct mistakes gently
    - Encourage the learner to speak
    - Ask follow-up questions
    - Keep responses concise (2-3 sentences)
    - Be patient and supportive`,
  
  // Grammar checker
  grammar_checker: `You are a grammar expert. Analyze the text for errors.
    Return a JSON object with:
    - hasErrors (boolean)
    - errors (array of {original, correction, explanation, type})
    - score (0-100)
    - suggestions (array of improvement tips)
    Keep explanations simple for language learners.`,
  
  // Vocabulary explainer
  vocabulary_explainer: `You are a vocabulary expert. Explain words in simple terms.
    Return a JSON object with:
    - word (string)
    - pronunciation (simple phonetic guide)
    - partOfSpeech (string)
    - definitions (array of {meaning, example})
    - synonyms (array)
    - antonyms (array)
    - commonPhrases (array)
    - tips (memory aid)`,
  
  // Text simplifier
  text_simplifier: `You simplify text for language learners.
    - Use simpler vocabulary
    - Use shorter sentences
    - Keep the main meaning
    - Remove idioms and complex expressions
    - Return only the simplified text`,
  
  // Quiz generator
  quiz_generator: `You generate language learning quizzes.
    Return a JSON object with:
    - questions (array of {question, options, correctAnswer, explanation})
    - difficulty (beginner/intermediate/advanced)
    - topic (string)
    Make questions engaging and educational.`,
  
  // Pronunciation feedback
  pronunciation_feedback: `You provide feedback on pronunciation.
    Based on the transcribed text and expected text:
    - Identify mispronounced words
    - Suggest corrections
    - Provide practice tips
    - Be encouraging
    Return a JSON object with feedback.`
};

// ============================================
// Helper Functions
// ============================================

/**
 * Get model configuration
 */
const getModelConfig = (modelName) => {
  return MODEL_CONFIGS[modelName] || MODEL_CONFIGS[DEFAULT_MODELS.CHAT];
};

/**
 * Estimate token count (rough approximation)
 * 1 token ≈ 4 characters for English
 */
const estimateTokens = (text) => {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
};

/**
 * Calculate cost for API call
 */
const calculateCost = (model, inputTokens, outputTokens = 0) => {
  const config = getModelConfig(model);
  if (!config.costPer1KTokens) return 0;
  
  const inputCost = (inputTokens / 1000) * config.costPer1KTokens;
  const outputCost = (outputTokens / 1000) * (config.costPer1KTokens * 3); // Output costs 3x input
  return inputCost + outputCost;
};

/**
 * Log API call with timing and cost
 */
const logApiCall = async (model, endpoint, inputTokens, outputTokens, startTime, error = null) => {
  const duration = Date.now() - startTime;
  const cost = calculateCost(model, inputTokens, outputTokens);
  
  const logData = {
    model,
    endpoint,
    duration: `${duration}ms`,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    cost: `$${cost.toFixed(6)}`,
    timestamp: new Date().toISOString()
  };
  
  if (error) {
    logData.error = error.message;
    logger.error(`OpenAI API call failed: ${endpoint}`, logData);
  } else {
    logger.info(`OpenAI API call completed: ${endpoint}`, logData);
  }
  
  return { duration, cost };
};

/**
 * Handle API errors
 */
const handleApiError = (error, context = {}) => {
  const errorResponse = {
    success: false,
    error: error.message,
    type: error.type || 'unknown',
    code: error.code || 'API_ERROR'
  };
  
  if (error.status === 429) {
    errorResponse.error = 'Rate limit exceeded. Please try again later.';
    errorResponse.retryAfter = error.headers?.['retry-after'] || 60;
  } else if (error.status === 401) {
    errorResponse.error = 'Invalid API key. Please check your OpenAI configuration.';
  } else if (error.status === 503) {
    errorResponse.error = 'OpenAI service is currently unavailable. Please try again later.';
  }
  
  logger.error('OpenAI API error:', { error: error.message, context });
  
  return errorResponse;
};

/**
 * Validate API key on startup
 */
const validateApiKey = async () => {
  if (!OPENAI_API_KEY) {
    logger.warn('OpenAI API key not configured. AI features will be disabled.');
    return false;
  }
  
  try {
    await openai.models.list();
    logger.info('OpenAI API key validated successfully');
    return true;
  } catch (error) {
    logger.error('OpenAI API key validation failed:', error.message);
    return false;
  }
};

// ============================================
// Chat Completion Functions
// ============================================

/**
 * Send chat completion request
 * @param {Array} messages - Chat messages
 * @param {Object} options - Request options
 * @returns {Promise<Object>}
 */
const chatCompletion = async (messages, options = {}) => {
  const startTime = Date.now();
  const model = options.model || DEFAULT_MODELS.CHAT;
  const config = getModelConfig(model);
  
  try {
    const completion = await openai.chat.completions.create({
      model,
      messages,
      temperature: options.temperature || config.temperature,
      max_tokens: options.maxTokens || config.maxTokens,
      top_p: options.topP || config.topP,
      frequency_penalty: options.frequencyPenalty || config.frequencyPenalty,
      presence_penalty: options.presencePenalty || config.presencePenalty,
      stop: options.stop,
      response_format: options.responseFormat
    });
    
    const usage = completion.usage;
    await logApiCall(model, 'chat.completions', usage.prompt_tokens, usage.completion_tokens, startTime);
    
    return {
      success: true,
      message: completion.choices[0].message,
      usage: {
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens
      },
      model: completion.model,
      finishReason: completion.choices[0].finish_reason
    };
  } catch (error) {
    await logApiCall(model, 'chat.completions', 0, 0, startTime, error);
    return handleApiError(error, { messages, options });
  }
};

/**
 * Send single prompt to GPT
 */
const prompt = async (systemPrompt, userPrompt, options = {}) => {
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];
  
  return await chatCompletion(messages, options);
};

// ============================================
// Specialized AI Functions
// ============================================

/**
 * Grammar check
 * @param {string} text - Text to check
 * @param {string} level - User's language level
 * @returns {Promise<Object>}
 */
const checkGrammar = async (text, level = 'intermediate') => {
  const systemPrompt = SYSTEM_PROMPTS.grammar_checker;
  const userPrompt = `Check this text for a ${level} level learner: "${text}"`;
  
  const result = await prompt(systemPrompt, userPrompt, {
    responseFormat: { type: 'json_object' }
  });
  
  if (result.success) {
    try {
      const parsed = JSON.parse(result.message.content);
      return {
        success: true,
        ...parsed,
        originalText: text
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to parse grammar check response',
        originalText: text
      };
    }
  }
  
  return result;
};

/**
 * Explain vocabulary
 * @param {string} word - Word to explain
 * @param {string} level - User's language level
 * @returns {Promise<Object>}
 */
const explainVocabulary = async (word, level = 'intermediate') => {
  const systemPrompt = SYSTEM_PROMPTS.vocabulary_explainer;
  const userPrompt = `Explain the word "${word}" for a ${level} level English learner.`;
  
  const result = await prompt(systemPrompt, userPrompt, {
    responseFormat: { type: 'json_object' }
  });
  
  if (result.success) {
    try {
      const parsed = JSON.parse(result.message.content);
      return {
        success: true,
        ...parsed
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to parse vocabulary explanation',
        word
      };
    }
  }
  
  return result;
};

/**
 * Simplify text
 * @param {string} text - Text to simplify
 * @param {string} targetLevel - Target difficulty level
 * @returns {Promise<Object>}
 */
const simplifyText = async (text, targetLevel = 'intermediate') => {
  const systemPrompt = SYSTEM_PROMPTS.text_simplifier;
  const userPrompt = `Simplify this text to ${targetLevel} level: "${text}"`;
  
  const result = await prompt(systemPrompt, userPrompt);
  
  if (result.success) {
    return {
      success: true,
      original: text,
      simplified: result.message.content,
      targetLevel
    };
  }
  
  return result;
};

/**
 * Generate conversation response
 * @param {string} userMessage - User's message
 * @param {string} level - User's language level
 * @param {Array} history - Conversation history
 * @returns {Promise<Object>}
 */
const generateConversation = async (userMessage, level = 'intermediate', history = []) => {
  const systemPrompt = SYSTEM_PROMPTS.conversation_tutor;
  
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: userMessage }
  ];
  
  const result = await chatCompletion(messages, {
    temperature: 0.8,
    maxTokens: 150
  });
  
  if (result.success) {
    return {
      success: true,
      response: result.message.content,
      usage: result.usage
    };
  }
  
  return result;
};

/**
 * Generate quiz questions
 * @param {string} topic - Quiz topic
 * @param {Array} words - Vocabulary words to include
 * @param {number} questionCount - Number of questions
 * @param {string} difficulty - Difficulty level
 * @returns {Promise<Object>}
 */
const generateQuiz = async (topic, words = [], questionCount = 5, difficulty = 'intermediate') => {
  const systemPrompt = SYSTEM_PROMPTS.quiz_generator;
  
  let userPrompt = `Generate a ${difficulty} level quiz about ${topic}.`;
  if (words.length > 0) {
    userPrompt += ` Include these words: ${words.join(', ')}.`;
  }
  userPrompt += ` Create ${questionCount} multiple-choice questions.`;
  
  const result = await prompt(systemPrompt, userPrompt, {
    responseFormat: { type: 'json_object' }
  });
  
  if (result.success) {
    try {
      const parsed = JSON.parse(result.message.content);
      return {
        success: true,
        topic,
        difficulty,
        questions: parsed.questions || [],
        totalQuestions: questionCount
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to parse quiz response',
        topic
      };
    }
  }
  
  return result;
};

// ============================================
// Embedding Functions
// ============================================

/**
 * Generate text embedding
 * @param {string} text - Text to embed
 * @param {string} model - Embedding model
 * @returns {Promise<Object>}
 */
const generateEmbedding = async (text, model = DEFAULT_MODELS.EMBEDDING) => {
  const startTime = Date.now();
  
  try {
    const response = await openai.embeddings.create({
      model,
      input: text,
      encoding_format: 'float'
    });
    
    const usage = response.usage;
    await logApiCall(model, 'embeddings.create', usage.prompt_tokens, 0, startTime);
    
    return {
      success: true,
      embedding: response.data[0].embedding,
      dimensions: getModelConfig(model).dimensions,
      usage: {
        promptTokens: usage.prompt_tokens,
        totalTokens: usage.total_tokens
      }
    };
  } catch (error) {
    await logApiCall(model, 'embeddings.create', 0, 0, startTime, error);
    return handleApiError(error, { text: text.substring(0, 100) });
  }
};

/**
 * Generate multiple embeddings
 * @param {Array} texts - Array of texts to embed
 * @returns {Promise<Object>}
 */
const generateBatchEmbeddings = async (texts) => {
  const results = [];
  
  for (const text of texts) {
    const result = await generateEmbedding(text);
    results.push(result);
  }
  
  return results;
};

// ============================================
// Audio Functions
// ============================================

/**
 * Transcribe audio using Whisper
 * @param {Buffer|File} audioFile - Audio file
 * @param {string} language - Language code
 * @returns {Promise<Object>}
 */
const transcribeAudio = async (audioFile, language = 'en') => {
  const startTime = Date.now();
  const model = DEFAULT_MODELS.TRANSCRIPTION;
  
  try {
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model,
      language,
      response_format: 'verbose_json',
      temperature: 0.2
    });
    
    const duration = transcription.segments?.reduce((sum, s) => sum + s.end - s.start, 0) || 0;
    await logApiCall(model, 'audio.transcriptions', 0, 0, startTime);
    
    return {
      success: true,
      text: transcription.text,
      language: transcription.language,
      duration: Math.round(duration),
      segments: transcription.segments,
      confidence: transcription.segments?.[0]?.confidence || 0.85
    };
  } catch (error) {
    await logApiCall(model, 'audio.transcriptions', 0, 0, startTime, error);
    return handleApiError(error);
  }
};

/**
 * Convert text to speech
 * @param {string} text - Text to convert
 * @param {string} voice - Voice to use
 * @param {number} speed - Speech speed (0.25-4.0)
 * @returns {Promise<Object>}
 */
const textToSpeech = async (text, voice = 'nova', speed = 1.0) => {
  const startTime = Date.now();
  const model = DEFAULT_MODELS.TTS;
  
  if (!VOICE_SETTINGS[voice]) {
    voice = 'nova';
  }
  
  try {
    const response = await openai.audio.speech.create({
      model,
      voice,
      input: text,
      speed: Math.min(4.0, Math.max(0.25, speed))
    });
    
    const audioBuffer = Buffer.from(await response.arrayBuffer());
    const duration = estimateAudioDuration(text, speed);
    
    await logApiCall(model, 'audio.speech', 0, 0, startTime);
    
    return {
      success: true,
      audio: audioBuffer.toString('base64'),
      format: 'mp3',
      duration,
      voice,
      text: text.substring(0, 100)
    };
  } catch (error) {
    await logApiCall(model, 'audio.speech', 0, 0, startTime, error);
    return handleApiError(error);
  }
};

/**
 * Estimate audio duration based on text length
 */
const estimateAudioDuration = (text, speed) => {
  const wordsPerMinute = 130;
  const wordCount = text.split(/\s+/).length;
  const durationSeconds = (wordCount / wordsPerMinute) * 60 / speed;
  return Math.ceil(durationSeconds);
};

// ============================================
// Export Configuration
// ============================================

module.exports = {
  // OpenAI client
  openai,
  
  // Configuration
  MODEL_CONFIGS,
  DEFAULT_MODELS,
  VOICE_SETTINGS,
  SYSTEM_PROMPTS,
  
  // Validation
  validateApiKey,
  
  // Chat functions
  chatCompletion,
  prompt,
  
  // Specialized functions
  checkGrammar,
  explainVocabulary,
  simplifyText,
  generateConversation,
  generateQuiz,
  
  // Embedding functions
  generateEmbedding,
  generateBatchEmbeddings,
  
  // Audio functions
  transcribeAudio,
  textToSpeech,
  
  // Utilities
  estimateTokens,
  calculateCost,
  getModelConfig
};
