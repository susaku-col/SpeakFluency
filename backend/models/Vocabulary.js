// ============================================
// Vocabulary Model
// SpeakFlow - AI Language Learning Platform
// ============================================

const mongoose = require('mongoose');

// ============================================
// Constants & Enums
// ============================================

const DIFFICULTY_LEVELS = {
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate',
  ADVANCED: 'advanced',
  EXPERT: 'expert'
};

const WORD_TYPES = {
  NOUN: 'noun',
  VERB: 'verb',
  ADJECTIVE: 'adjective',
  ADVERB: 'adverb',
  PREPOSITION: 'preposition',
  CONJUNCTION: 'conjunction',
  PRONOUN: 'pronoun',
  INTERJECTION: 'interjection',
  PHRASE: 'phrase',
  IDIOM: 'idiom'
};

const PROFICIENCY_LEVELS = {
  NEW: 0,
  LEARNING: 1,
  REVIEWING: 2,
  FAMILIAR: 3,
  MASTERED: 4
};

const REVIEW_RESULTS = {
  AGAIN: 0,
  HARD: 1,
  GOOD: 2,
  EASY: 3
};

// SRS (Spaced Repetition System) intervals in days
const SRS_INTERVALS = {
  [REVIEW_RESULTS.AGAIN]: 0,    // Review again today
  [REVIEW_RESULTS.HARD]: 1,     // Review in 1 day
  [REVIEW_RESULTS.GOOD]: 3,     // Review in 3 days
  [REVIEW_RESULTS.EASY]: 7      // Review in 7 days
};

// Ease factors for SRS algorithm
const EASE_FACTORS = {
  INITIAL: 2.5,
  MINIMUM: 1.3,
  MAXIMUM: 5.0,
  EASE_ADJUST_GOOD: 0.0,
  EASE_ADJUST_EASY: 0.15,
  EASE_ADJUST_HARD: -0.2,
  EASE_ADJUST_AGAIN: -0.3
};

// ============================================
// Sub-Schemas
// ============================================

/**
 * Word Definition Schema
 */
const definitionSchema = new mongoose.Schema({
  meaning: {
    type: String,
    required: true
  },
  partOfSpeech: {
    type: String,
    enum: Object.values(WORD_TYPES)
  },
  example: String,
  exampleTranslation: String,
  synonyms: [String],
  antonyms: [String],
  notes: String
}, { _id: false });

/**
 * Word Translation Schema
 */
const translationSchema = new mongoose.Schema({
  language: {
    type: String,
    required: true,
    default: 'en'
  },
  word: {
    type: String,
    required: true
  },
  pronunciation: String,
  phonetic: String
}, { _id: false });

/**
 * Word Audio Schema
 */
const audioSchema = new mongoose.Schema({
  url: String,
  dialect: {
    type: String,
    enum: ['us', 'uk', 'au', 'generic']
  },
  duration: Number,
  uploadedAt: Date
}, { _id: false });

/**
 * Word Tag Schema
 */
const tagSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  category: {
    type: String,
    enum: ['topic', 'exam', 'level', 'custom']
  }
}, { _id: false });

// ============================================
// Spaced Repetition Schema (SRS)
// ============================================

const srsDataSchema = new mongoose.Schema({
  // SRS state
  easeFactor: {
    type: Number,
    default: EASE_FACTORS.INITIAL,
    min: EASE_FACTORS.MINIMUM,
    max: EASE_FACTORS.MAXIMUM
  },
  interval: {
    type: Number, // days
    default: 0
  },
  repetitions: {
    type: Number,
    default: 0
  },
  lastReviewDate: Date,
  nextReviewDate: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  // Performance metrics
  consecutiveCorrect: {
    type: Number,
    default: 0
  },
  totalReviews: {
    type: Number,
    default: 0
  },
  correctCount: {
    type: Number,
    default: 0
  },
  incorrectCount: {
    type: Number,
    default: 0
  },
  averageResponseTime: {
    type: Number, // milliseconds
    default: 0
  },
  
  // Lapses (times word was forgotten)
  lapseCount: {
    type: Number,
    default: 0
  },
  lastLapseAt: Date,
  
  // Proficiency level
  proficiency: {
    type: Number,
    enum: Object.values(PROFICIENCY_LEVELS),
    default: PROFICIENCY_LEVELS.NEW
  },
  
  // Review history
  reviewHistory: [{
    date: { type: Date, default: Date.now },
    result: { type: Number, enum: Object.values(REVIEW_RESULTS) },
    responseTime: Number, // milliseconds
    easeFactor: Number,
    interval: Number
  }]
}, { _id: false });

/**
 * User Progress Schema
 */
const userProgressSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  srsData: {
    type: srsDataSchema,
    default: () => ({})
  },
  bookmarked: {
    type: Boolean,
    default: false
  },
  notes: String,
  masteredAt: Date,
  lastPracticedAt: Date,
  timesPracticed: {
    type: Number,
    default: 0
  }
}, { _id: false });

// ============================================
// Main Vocabulary Schema
// ============================================

const vocabularySchema = new mongoose.Schema({
  // Identification
  wordId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Core word data
  word: {
    type: String,
    required: true,
    index: true,
    trim: true,
    lowercase: true
  },
  normalized: {
    type: String,
    lowercase: true,
    trim: true,
    index: true
  },
  
  // Translations (multiple languages)
  translations: [translationSchema],
  
  // Definitions
  definitions: [definitionSchema],
  
  // Pronunciation
  pronunciation: {
    ipa: String,
    phonetic: String,
    audio: audioSchema
  },
  
  // Word properties
  wordType: {
    type: String,
    enum: Object.values(WORD_TYPES),
    index: true
  },
  difficulty: {
    type: String,
    enum: Object.values(DIFFICULTY_LEVELS),
    default: DIFFICULTY_LEVELS.BEGINNER,
    index: true
  },
  
  // Frequency (1-100, higher = more common)
  frequencyRank: {
    type: Number,
    min: 1,
    max: 100,
    index: true
  },
  
  // Word families / related words
  wordFamily: {
    root: String,
    variations: [String],
    relatedWords: [{
      word: String,
      relation: {
        type: String,
        enum: ['synonym', 'antonym', 'derived', 'compound', 'idiom']
      }
    }]
  },
  
  // Context and examples
  examples: [{
    sentence: String,
    translation: String,
    source: String,
    difficulty: {
      type: String,
      enum: Object.values(DIFFICULTY_LEVELS)
    }
  }],
  
  // Collocations (common word pairings)
  collocations: [{
    phrase: String,
    meaning: String,
    example: String,
    frequency: Number
  }],
  
  // Categories and tags
  categories: [{
    type: String,
    index: true
  }],
  tags: [tagSchema],
  
  // Exam relevance
  exams: {
    ielts: { type: Boolean, default: false },
    toefl: { type: Boolean, default: false },
    toEic: { type: Boolean, default: false },
    cambridge: { type: Boolean, default: false },
    cefr: {
      type: String,
      enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
    }
  },
  
  // Visual / image
  imageUrl: String,
  imageAlt: String,
  
  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  source: {
    type: String,
    enum: ['system', 'user', 'import', 'api', 'crowdsource']
  },
  status: {
    type: String,
    enum: ['active', 'pending', 'archived', 'deprecated'],
    default: 'active'
  },
  
  // Usage statistics (global)
  globalStats: {
    totalLearners: { type: Number, default: 0 },
    averageMasteryTime: { type: Number, default: 0 }, // days
    masterCount: { type: Number, default: 0 },
    searchCount: { type: Number, default: 0 }
  },
  
  // User-specific progress (embedded, not referenced)
  userProgress: [userProgressSchema],
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  
  // Metadata
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: new Map()
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ============================================
// Virtual Fields
// ============================================

// Full word display (word + pronunciation)
vocabularySchema.virtual('displayWord').get(function() {
  return `${this.word}${this.pronunciation?.phonetic ? ` [${this.pronunciation.phonetic}]` : ''}`;
});

// Primary definition
vocabularySchema.virtual('primaryDefinition').get(function() {
  return this.definitions[0] || null;
});

// Primary translation
vocabularySchema.virtual('primaryTranslation').get(function() {
  return this.translations[0] || null;
});

// Is active
vocabularySchema.virtual('isActive').get(function() {
  return this.status === 'active';
});

// ============================================
// Instance Methods
// ============================================

/**
 * Get user progress for a specific user
 */
vocabularySchema.methods.getUserProgress = function(userId) {
  return this.userProgress.find(p => p.userId.toString() === userId.toString());
};

/**
 * Update user progress with SRS algorithm
 */
vocabularySchema.methods.updateUserProgress = async function(userId, result, responseTime = 0) {
  let progress = this.getUserProgress(userId);
  
  if (!progress) {
    progress = {
      userId,
      srsData: {},
      timesPracticed: 0
    };
    this.userProgress.push(progress);
  }
  
  const srs = progress.srsData;
  
  // Record review
  srs.totalReviews++;
  if (result === REVIEW_RESULTS.AGAIN) {
    srs.incorrectCount++;
    srs.lapseCount++;
    srs.lastLapseAt = new Date();
    srs.consecutiveCorrect = 0;
  } else {
    srs.correctCount++;
    srs.consecutiveCorrect++;
  }
  
  // Update average response time
  if (responseTime > 0) {
    srs.averageResponseTime = (srs.averageResponseTime * (srs.totalReviews - 1) + responseTime) / srs.totalReviews;
  }
  
  // Apply SRS algorithm (modified SM-2)
  if (result === REVIEW_RESULTS.AGAIN) {
    // Reset repetitions and interval
    srs.repetitions = 0;
    srs.interval = SRS_INTERVALS[REVIEW_RESULTS.AGAIN];
    srs.easeFactor = Math.max(
      EASE_FACTORS.MINIMUM,
      srs.easeFactor + EASE_FACTORS.EASE_ADJUST_AGAIN
    );
  } else {
    // Update repetitions count
    srs.repetitions++;
    
    // Calculate new interval
    if (srs.repetitions === 1) {
      srs.interval = SRS_INTERVALS[result];
    } else if (srs.repetitions === 2) {
      srs.interval = SRS_INTERVALS[result] * 2;
    } else {
      srs.interval = Math.round(srs.interval * srs.easeFactor);
    }
    
    // Adjust ease factor based on result
    let easeAdjustment = 0;
    switch (result) {
      case REVIEW_RESULTS.HARD:
        easeAdjustment = EASE_FACTORS.EASE_ADJUST_HARD;
        break;
      case REVIEW_RESULTS.GOOD:
        easeAdjustment = EASE_FACTORS.EASE_ADJUST_GOOD;
        break;
      case REVIEW_RESULTS.EASY:
        easeAdjustment = EASE_FACTORS.EASE_ADJUST_EASY;
        break;
    }
    srs.easeFactor = Math.max(
      EASE_FACTORS.MINIMUM,
      Math.min(EASE_FACTORS.MAXIMUM, srs.easeFactor + easeAdjustment)
    );
  }
  
  // Update dates
  srs.lastReviewDate = new Date();
  srs.nextReviewDate = new Date();
  srs.nextReviewDate.setDate(srs.nextReviewDate.getDate() + srs.interval);
  
  // Update proficiency level
  if (srs.repetitions >= 10 && srs.consecutiveCorrect >= 5 && srs.correctCount / srs.totalReviews >= 0.9) {
    srs.proficiency = PROFICIENCY_LEVELS.MASTERED;
    progress.masteredAt = new Date();
  } else if (srs.repetitions >= 5 && srs.correctCount / srs.totalReviews >= 0.8) {
    srs.proficiency = PROFICIENCY_LEVELS.FAMILIAR;
  } else if (srs.repetitions >= 2) {
    srs.proficiency = PROFICIENCY_LEVELS.REVIEWING;
  } else if (srs.repetitions > 0) {
    srs.proficiency = PROFICIENCY_LEVELS.LEARNING;
  } else {
    srs.proficiency = PROFICIENCY_LEVELS.NEW;
  }
  
  // Add to review history
  srs.reviewHistory.push({
    date: new Date(),
    result,
    responseTime,
    easeFactor: srs.easeFactor,
    interval: srs.interval
  });
  
  // Keep only last 50 reviews
  if (srs.reviewHistory.length > 50) {
    srs.reviewHistory = srs.reviewHistory.slice(-50);
  }
  
  // Update times practiced
  progress.timesPracticed++;
  progress.lastPracticedAt = new Date();
  
  // Update global stats
  this.globalStats.totalLearners = new Set(this.userProgress.map(p => p.userId.toString())).size;
  this.globalStats.masterCount = this.userProgress.filter(p => p.srsData.proficiency === PROFICIENCY_LEVELS.MASTERED).length;
  
  await this.save();
  
  return {
    word: this.word,
    proficiency: srs.proficiency,
    nextReviewDate: srs.nextReviewDate,
    interval: srs.interval,
    easeFactor: srs.easeFactor,
    repetitions: srs.repetitions
  };
};

/**
 * Get words due for review for a user
 */
vocabularySchema.statics.getDueWords = async function(userId, limit = 50) {
  const now = new Date();
  
  const words = await this.find({
    'userProgress.userId': userId,
    'userProgress.srsData.nextReviewDate': { $lte: now },
    status: 'active'
  }).limit(limit);
  
  return words.map(word => {
    const progress = word.getUserProgress(userId);
    return {
      wordId: word.wordId,
      word: word.word,
      definitions: word.definitions,
      pronunciation: word.pronunciation,
      difficulty: word.difficulty,
      proficiency: progress?.srsData.proficiency || PROFICIENCY_LEVELS.NEW,
      lastReviewDate: progress?.srsData.lastReviewDate,
      interval: progress?.srsData.interval
    };
  });
};

/**
 * Get learning stats for a user
 */
vocabularySchema.statics.getUserStats = async function(userId) {
  const userProgress = await this.aggregate([
    { $unwind: '$userProgress' },
    { $match: { 'userProgress.userId': mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: null,
        totalWords: { $sum: 1 },
        mastered: { $sum: { $cond: [{ $eq: ['$userProgress.srsData.proficiency', PROFICIENCY_LEVELS.MASTERED] }, 1, 0] } },
        familiar: { $sum: { $cond: [{ $eq: ['$userProgress.srsData.proficiency', PROFICIENCY_LEVELS.FAMILIAR] }, 1, 0] } },
        learning: { $sum: { $cond: [{ $eq: ['$userProgress.srsData.proficiency', PROFICIENCY_LEVELS.LEARNING] }, 1, 0] } },
        new: { $sum: { $cond: [{ $eq: ['$userProgress.srsData.proficiency', PROFICIENCY_LEVELS.NEW] }, 1, 0] } },
        totalReviews: { $sum: '$userProgress.srsData.totalReviews' },
        correctReviews: { $sum: '$userProgress.srsData.correctCount' },
        totalResponseTime: { $sum: '$userProgress.srsData.averageResponseTime' }
      }
    }
  ]);
  
  const result = userProgress[0] || {
    totalWords: 0,
    mastered: 0,
    familiar: 0,
    learning: 0,
    new: 0,
    totalReviews: 0,
    correctReviews: 0,
    totalResponseTime: 0
  };
  
  result.accuracy = result.totalReviews > 0 
    ? (result.correctReviews / result.totalReviews) * 100 
    : 0;
  
  return result;
};

/**
 * Get due count for a user
 */
vocabularySchema.statics.getDueCount = async function(userId) {
  const now = new Date();
  
  const count = await this.countDocuments({
    'userProgress.userId': userId,
    'userProgress.srsData.nextReviewDate': { $lte: now },
    status: 'active'
  });
  
  return count;
};

/**
 * Search vocabulary
 */
vocabularySchema.statics.searchVocabulary = async function(query, options = {}) {
  const { limit = 20, offset = 0, difficulty, category } = options;
  
  let searchQuery = {
    $or: [
      { word: { $regex: query, $options: 'i' } },
      { normalized: { $regex: query.toLowerCase(), $options: 'i' } },
      { 'translations.word': { $regex: query, $options: 'i' } },
      { 'definitions.meaning': { $regex: query, $options: 'i' } }
    ],
    status: 'active'
  };
  
  if (difficulty) {
    searchQuery.difficulty = difficulty;
  }
  
  if (category) {
    searchQuery.categories = category;
  }
  
  const words = await this.find(searchQuery)
    .skip(offset)
    .limit(limit)
    .sort({ frequencyRank: 1, word: 1 });
  
  const total = await this.countDocuments(searchQuery);
  
  return {
    words,
    pagination: {
      limit,
      offset,
      total,
      hasMore: offset + limit < total
    }
  };
};

/**
 * Add word to user's learning list
 */
vocabularySchema.methods.addToUserLearning = async function(userId) {
  const existingProgress = this.getUserProgress(userId);
  
  if (!existingProgress) {
    this.userProgress.push({
      userId,
      srsData: {},
      timesPracticed: 0
    });
    await this.save();
  }
  
  return this;
};

/**
 * Bookmark word for user
 */
vocabularySchema.methods.toggleBookmark = async function(userId) {
  const progress = this.getUserProgress(userId);
  
  if (progress) {
    progress.bookmarked = !progress.bookmarked;
    await this.save();
  }
  
  return progress?.bookmarked || false;
};

/**
 * Get word of the day
 */
vocabularySchema.statics.getWordOfTheDay = async function() {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
  
  const word = await this.findOne({
    status: 'active',
    difficulty: { $ne: DIFFICULTY_LEVELS.EXPERT }
  })
    .skip(dayOfYear % await this.countDocuments({ status: 'active' }))
    .limit(1);
  
  return word;
};

/**
 * Get popular words
 */
vocabularySchema.statics.getPopularWords = async function(limit = 20) {
  return await this.find({ status: 'active' })
    .sort({ 'globalStats.searchCount': -1 })
    .limit(limit)
    .select('word definitions difficulty frequencyRank');
};

/**
 * Get words by difficulty
 */
vocabularySchema.statics.getWordsByDifficulty = async function(difficulty, limit = 50) {
  return await this.find({
    difficulty,
    status: 'active'
  })
    .limit(limit)
    .sort({ frequencyRank: 1 });
};

// ============================================
// Indexes
// ============================================

vocabularySchema.index({ wordId: 1 });
vocabularySchema.index({ word: 1 });
vocabularySchema.index({ normalized: 1 });
vocabularySchema.index({ difficulty: 1, frequencyRank: -1 });
vocabularySchema.index({ categories: 1 });
vocabularySchema.index({ 'tags.name': 1 });
vocabularySchema.index({ status: 1 });
vocabularySchema.index({ 'userProgress.userId': 1 });
vocabularySchema.index({ 'userProgress.srsData.nextReviewDate': 1 });
vocabularySchema.index({ 'userProgress.srsData.proficiency': 1 });
vocabularySchema.index({ createdAt: -1 });
vocabularySchema.index({ frequencyRank: -1 });
vocabularySchema.index({ 'exams.cefr': 1 });

// Compound indexes
vocabularySchema.index({ difficulty: 1, frequencyRank: -1 });
vocabularySchema.index({ status: 1, difficulty: 1, frequencyRank: -1 });
vocabularySchema.index({ 'userProgress.userId': 1, 'userProgress.srsData.nextReviewDate': 1 });

// Text search index
vocabularySchema.index({
  word: 'text',
  normalized: 'text',
  'translations.word': 'text',
  'definitions.meaning': 'text'
});

// ============================================
// Pre-save Middleware
// ============================================

// Generate word ID
vocabularySchema.pre('save', function(next) {
  if (!this.wordId) {
    this.wordId = `voc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  next();
});

// Normalize word
vocabularySchema.pre('save', function(next) {
  this.normalized = this.word.toLowerCase().trim();
  next();
});

// Update timestamps
vocabularySchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Update global stats
vocabularySchema.pre('save', function(next) {
  if (this.isModified('userProgress')) {
    this.globalStats.totalLearners = new Set(this.userProgress.map(p => p.userId.toString())).size;
    this.globalStats.masterCount = this.userProgress.filter(p => p.srsData.proficiency === PROFICIENCY_LEVELS.MASTERED).length;
  }
  next();
});

// ============================================
// Model Creation
// ============================================

const Vocabulary = mongoose.model('Vocabulary', vocabularySchema);

module.exports = Vocabulary;
