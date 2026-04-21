// ============================================
// Session Model
// SpeakFlow - AI Language Learning Platform
// ============================================

const mongoose = require('mongoose');

// ============================================
// Session Types & Constants
// ============================================

const SESSION_TYPES = {
  PRONUNCIATION: 'pronunciation',
  VOCABULARY: 'vocabulary',
  GRAMMAR: 'grammar',
  SPEAKING: 'speaking',
  LISTENING: 'listening',
  READING: 'reading',
  COMPREHENSIVE: 'comprehensive',
  QUIZ: 'quiz',
  ASSESSMENT: 'assessment'
};

const SESSION_STATUSES = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  ABANDONED: 'abandoned',
  EXPIRED: 'expired'
};

const DIFFICULTY_LEVELS = {
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate',
  ADVANCED: 'advanced',
  EXPERT: 'expert'
};

// ============================================
// Sub-Schemas
// ============================================

/**
 * Answer Schema - User's answer to an exercise
 */
const answerSchema = new mongoose.Schema({
  exerciseId: {
    type: String,
    required: true
  },
  exerciseType: {
    type: String,
    enum: ['multiple_choice', 'fill_blank', 'matching', 'pronunciation', 'speaking', 'listening', 'drag_drop', 'true_false'],
    required: true
  },
  userAnswer: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  correctAnswer: {
    type: mongoose.Schema.Types.Mixed
  },
  isCorrect: {
    type: Boolean,
    default: false
  },
  score: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  timeSpent: {
    type: Number, // seconds
    default: 0
  },
  attempts: {
    type: Number,
    default: 1
  },
  hintsUsed: {
    type: Number,
    default: 0
  },
  feedback: {
    type: String
  },
  details: {
    type: mongoose.Schema.Types.Mixed
  },
  submittedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

/**
 * Exercise Progress Schema
 */
const exerciseProgressSchema = new mongoose.Schema({
  exerciseId: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'skipped'],
    default: 'pending'
  },
  score: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  startedAt: Date,
  completedAt: Date,
  timeSpent: Number
}, { _id: false });

/**
 * Pronunciation Analysis Schema
 */
const pronunciationAnalysisSchema = new mongoose.Schema({
  overallScore: {
    type: Number,
    min: 0,
    max: 100
  },
  accuracy: {
    type: Number,
    min: 0,
    max: 100
  },
  fluency: {
    type: Number,
    min: 0,
    max: 100
  },
  intonation: {
    type: Number,
    min: 0,
    max: 100
  },
  pace: {
    type: Number,
    min: 0,
    max: 100
  },
  phonemeScores: [{
    phoneme: String,
    score: Number,
    feedback: String
  }],
  mispronouncedWords: [{
    word: String,
    expected: String,
    actual: String,
    feedback: String
  }],
  suggestions: [String],
  transcript: String,
  audioUrl: String
}, { _id: false });

/**
 * Session Metrics Schema
 */
const sessionMetricsSchema = new mongoose.Schema({
  totalTimeSpent: {
    type: Number, // seconds
    default: 0
  },
  averageResponseTime: {
    type: Number, // seconds
    default: 0
  },
  totalAttempts: {
    type: Number,
    default: 0
  },
  hintsUsed: {
    type: Number,
    default: 0
  },
  pauses: {
    type: Number,
    default: 0
  },
  pauseDuration: {
    type: Number, // seconds
    default: 0
  },
  confidenceScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  engagementScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  }
}, { _id: false });

/**
 * Session Feedback Schema
 */
const sessionFeedbackSchema = new mongoose.Schema({
  overall: {
    type: String
  },
  strengths: [String],
  improvements: [String],
  tips: [String],
  nextSteps: [String],
  difficultyRating: {
    type: Number,
    min: 1,
    max: 5
  },
  enjoymentRating: {
    type: Number,
    min: 1,
    max: 5
  },
  userComments: {
    type: String
  },
  aiSuggestions: [String],
  recommendedLessons: [{
    lessonId: String,
    title: String,
    reason: String
  }]
}, { _id: false });

// ============================================
// Main Session Schema
// ============================================

const sessionSchema = new mongoose.Schema({
  // Identification
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Lesson Information
  lessonId: {
    type: String,
    required: true,
    index: true
  },
  lessonTitle: {
    type: String,
    required: true
  },
  lessonType: {
    type: String,
    enum: Object.values(SESSION_TYPES),
    required: true,
    index: true
  },
  difficulty: {
    type: String,
    enum: Object.values(DIFFICULTY_LEVELS),
    default: DIFFICULTY_LEVELS.BEGINNER
  },
  
  // Session Status
  status: {
    type: String,
    enum: Object.values(SESSION_STATUSES),
    default: SESSION_STATUSES.ACTIVE,
    index: true
  },
  
  // Timing
  startedAt: {
    type: Date,
    default: Date.now,
    required: true
  },
  pausedAt: Date,
  resumedAt: Date,
  completedAt: Date,
  duration: {
    type: Number, // seconds
    default: 0
  },
  timeLimit: {
    type: Number, // seconds
    default: null
  },
  
  // Progress
  currentExerciseIndex: {
    type: Number,
    default: 0
  },
  totalExercises: {
    type: Number,
    default: 0
  },
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  exerciseProgress: [exerciseProgressSchema],
  
  // Answers & Results
  answers: [answerSchema],
  totalScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  correctAnswers: {
    type: Number,
    default: 0
  },
  incorrectAnswers: {
    type: Number,
    default: 0
  },
  skippedExercises: {
    type: Number,
    default: 0
  },
  
  // XP & Rewards
  xpEarned: {
    type: Number,
    default: 0
  },
  bonusXp: {
    type: Number,
    default: 0
  },
  streakBonus: {
    type: Number,
    default: 0
  },
  perfectScoreBonus: {
    type: Number,
    default: 0
  },
  timeBonus: {
    type: Number,
    default: 0
  },
  
  // Achievements earned during session
  achievementsEarned: [{
    achievementId: String,
    name: String,
    earnedAt: { type: Date, default: Date.now }
  }],
  
  // Specialized Analysis
  pronunciationAnalysis: pronunciationAnalysisSchema,
  speakingAnalysis: {
    type: mongoose.Schema.Types.Mixed
  },
  
  // Metrics & Analytics
  metrics: {
    type: sessionMetricsSchema,
    default: () => ({})
  },
  
  // Feedback
  feedback: {
    type: sessionFeedbackSchema,
    default: () => ({})
  },
  
  // Session Data (JSON blob for session-specific data)
  sessionData: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Context (device, location, etc.)
  context: {
    deviceId: { type: String },
    deviceType: { type: String, enum: ['mobile', 'tablet', 'desktop', 'web'] },
    platform: { type: String },
    browser: { type: String },
    ipAddress: { type: String },
    userAgent: { type: String },
    referrer: { type: String }
  },
  
  // Tags for categorization
  tags: [{
    type: String,
    index: true
  }],
  
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

// Completion rate
sessionSchema.virtual('completionRate').get(function() {
  if (this.totalExercises === 0) return 0;
  return (this.completedExercises / this.totalExercises) * 100;
});

// Completed exercises count
sessionSchema.virtual('completedExercises').get(function() {
  return this.exerciseProgress.filter(ep => ep.status === 'completed').length;
});

// Is perfect score
sessionSchema.virtual('isPerfectScore').get(function() {
  return this.totalScore === 100 && this.correctAnswers === this.totalExercises;
});

// Is session completed
sessionSchema.virtual('isCompleted').get(function() {
  return this.status === SESSION_STATUSES.COMPLETED;
});

// Time taken in minutes
sessionSchema.virtual('durationMinutes').get(function() {
  return Math.round(this.duration / 60);
});

// Efficiency score (score per minute)
sessionSchema.virtual('efficiencyScore').get(function() {
  if (this.duration === 0) return 0;
  return (this.totalScore / this.duration) * 60;
});

// ============================================
// Instance Methods
// ============================================

/**
 * Start the session
 */
sessionSchema.methods.start = function() {
  this.status = SESSION_STATUSES.ACTIVE;
  this.startedAt = new Date();
  this.currentExerciseIndex = 0;
  return this.save();
};

/**
 * Pause the session
 */
sessionSchema.methods.pause = function() {
  if (this.status !== SESSION_STATUSES.ACTIVE) return false;
  
  this.status = SESSION_STATUSES.PAUSED;
  this.pausedAt = new Date();
  return this.save();
};

/**
 * Resume the session
 */
sessionSchema.methods.resume = function() {
  if (this.status !== SESSION_STATUSES.PAUSED) return false;
  
  this.status = SESSION_STATUSES.ACTIVE;
  this.resumedAt = new Date();
  
  // Calculate pause duration
  if (this.pausedAt) {
    const pauseDuration = (new Date() - this.pausedAt) / 1000;
    this.metrics.pauseDuration += pauseDuration;
    this.metrics.pauses++;
  }
  
  return this.save();
};

/**
 * Submit an answer for an exercise
 */
sessionSchema.methods.submitAnswer = async function(exerciseId, userAnswer, metadata = {}) {
  const exerciseIndex = this.exerciseProgress.findIndex(ep => ep.exerciseId === exerciseId);
  
  if (exerciseIndex === -1) {
    throw new Error('Exercise not found in session');
  }
  
  const exercise = this.exerciseProgress[exerciseIndex];
  const isCorrect = metadata.isCorrect || false;
  const score = metadata.score || (isCorrect ? 100 : 0);
  
  // Record answer
  const answer = {
    exerciseId,
    exerciseType: metadata.exerciseType || 'multiple_choice',
    userAnswer,
    correctAnswer: metadata.correctAnswer,
    isCorrect,
    score,
    timeSpent: metadata.timeSpent || 0,
    attempts: (metadata.attempts || 1),
    hintsUsed: metadata.hintsUsed || 0,
    feedback: metadata.feedback || '',
    details: metadata.details || {},
    submittedAt: new Date()
  };
  
  this.answers.push(answer);
  
  // Update exercise progress
  exercise.status = 'completed';
  exercise.score = score;
  exercise.completedAt = new Date();
  exercise.timeSpent = metadata.timeSpent || 0;
  
  // Update session stats
  if (isCorrect) {
    this.correctAnswers++;
  } else {
    this.incorrectAnswers++;
  }
  
  // Update metrics
  this.metrics.totalAttempts++;
  this.metrics.hintsUsed += (metadata.hintsUsed || 0);
  this.metrics.totalTimeSpent += (metadata.timeSpent || 0);
  
  // Move to next exercise if available
  if (this.currentExerciseIndex < this.totalExercises - 1) {
    this.currentExerciseIndex++;
  }
  
  // Update progress
  this.progress = (this.completedExercises / this.totalExercises) * 100;
  
  await this.save();
  return { answer, isCorrect, score };
};

/**
 * Skip current exercise
 */
sessionSchema.methods.skipExercise = function() {
  const currentExercise = this.exerciseProgress[this.currentExerciseIndex];
  if (currentExercise) {
    currentExercise.status = 'skipped';
    this.skippedExercises++;
  }
  
  if (this.currentExerciseIndex < this.totalExercises - 1) {
    this.currentExerciseIndex++;
  }
  
  this.progress = (this.completedExercises / this.totalExercises) * 100;
  return this.save();
};

/**
 * Complete the session
 */
sessionSchema.methods.complete = async function() {
  if (this.status === SESSION_STATUSES.COMPLETED) return this;
  
  this.status = SESSION_STATUSES.COMPLETED;
  this.completedAt = new Date();
  this.duration = (this.completedAt - this.startedAt) / 1000;
  
  // Calculate total score
  const answeredQuestions = this.answers.length;
  if (answeredQuestions > 0) {
    const totalScoreSum = this.answers.reduce((sum, a) => sum + a.score, 0);
    this.totalScore = Math.round(totalScoreSum / answeredQuestions);
  }
  
  // Calculate XP
  await this.calculateXP();
  
  // Generate feedback
  await this.generateFeedback();
  
  await this.save();
  return this;
};

/**
 * Abandon the session
 */
sessionSchema.methods.abandon = function() {
  this.status = SESSION_STATUSES.ABANDONED;
  this.completedAt = new Date();
  this.duration = (this.completedAt - this.startedAt) / 1000;
  return this.save();
};

/**
 * Calculate XP earned from session
 */
sessionSchema.methods.calculateXP = async function() {
  let xpEarned = 0;
  
  // Base XP
  const baseXP = 50;
  xpEarned += baseXP;
  
  // Score bonus (up to 50 XP)
  const scoreBonus = Math.floor(this.totalScore / 2);
  xpEarned += scoreBonus;
  
  // Perfect score bonus
  if (this.isPerfectScore) {
    this.perfectScoreBonus = 50;
    xpEarned += this.perfectScoreBonus;
  }
  
  // Completion bonus
  if (this.completionRate >= 90) {
    const completionBonus = 30;
    xpEarned += completionBonus;
  }
  
  // Time bonus (faster completion)
  const expectedDuration = this.duration; // In production, compare with expected
  if (expectedDuration < this.duration * 0.8) {
    this.timeBonus = 20;
    xpEarned += this.timeBonus;
  }
  
  // Streak bonus (from user, handled separately)
  
  this.xpEarned = xpEarned;
  return xpEarned;
};

/**
 * Generate feedback for the session
 */
sessionSchema.methods.generateFeedback = async function() {
  const feedback = {
    overall: '',
    strengths: [],
    improvements: [],
    tips: [],
    nextSteps: [],
    recommendedLessons: []
  };
  
  // Overall feedback based on score
  if (this.totalScore >= 90) {
    feedback.overall = 'Excellent work! You have mastered this material.';
    feedback.nextSteps.push('Try more advanced lessons');
  } else if (this.totalScore >= 70) {
    feedback.overall = 'Good job! You understand the basics well.';
    feedback.nextSteps.push('Review the incorrect answers and try again');
  } else if (this.totalScore >= 50) {
    feedback.overall = 'Not bad! Keep practicing to improve.';
    feedback.nextSteps.push('Focus on the areas where you made mistakes');
  } else {
    feedback.overall = 'Keep practicing! Learning takes time and effort.';
    feedback.nextSteps.push('Review the lesson materials before trying again');
  }
  
  // Identify weak areas
  const weakExercises = this.answers.filter(a => a.score < 70);
  if (weakExercises.length > 0) {
    feedback.improvements.push(`You struggled with ${weakExercises.length} exercises. Review them carefully.`);
  }
  
  // Lesson-specific tips
  if (this.lessonType === SESSION_TYPES.PRONUNCIATION) {
    feedback.tips.push('🎤 Listen to native speakers and repeat after them');
    feedback.tips.push('📱 Record yourself and compare with the correct pronunciation');
  } else if (this.lessonType === SESSION_TYPES.VOCABULARY) {
    feedback.tips.push('📝 Use flashcards to memorize new words');
    feedback.tips.push('✍️ Try to use new words in sentences');
  } else if (this.lessonType === SESSION_TYPES.GRAMMAR) {
    feedback.tips.push('📚 Study the grammar rules and practice with examples');
    feedback.tips.push('✏️ Write your own sentences using the grammar pattern');
  } else if (this.lessonType === SESSION_TYPES.SPEAKING) {
    feedback.tips.push('💬 Practice speaking every day, even for 5 minutes');
    feedback.tips.push('🎙️ Use the AI conversation partner feature');
  }
  
  this.feedback = feedback;
};

/**
 * Add pronunciation analysis
 */
sessionSchema.methods.addPronunciationAnalysis = function(analysisData) {
  this.pronunciationAnalysis = {
    overallScore: analysisData.overallScore,
    accuracy: analysisData.accuracy,
    fluency: analysisData.fluency,
    intonation: analysisData.intonation,
    pace: analysisData.pace,
    phonemeScores: analysisData.phonemeScores || [],
    mispronouncedWords: analysisData.mispronouncedWords || [],
    suggestions: analysisData.suggestions || [],
    transcript: analysisData.transcript,
    audioUrl: analysisData.audioUrl
  };
  return this.save();
};

/**
 * Add achievement earned during session
 */
sessionSchema.methods.addAchievement = function(achievementId, name) {
  this.achievementsEarned.push({
    achievementId,
    name,
    earnedAt: new Date()
  });
  return this.save();
};

/**
 * Update session metrics
 */
sessionSchema.methods.updateMetrics = function(metrics) {
  Object.assign(this.metrics, metrics);
  return this.save();
};

/**
 * Get session summary
 */
sessionSchema.methods.getSummary = function() {
  return {
    sessionId: this.sessionId,
    lessonTitle: this.lessonTitle,
    lessonType: this.lessonType,
    difficulty: this.difficulty,
    status: this.status,
    totalScore: this.totalScore,
    xpEarned: this.xpEarned,
    progress: this.progress,
    duration: this.duration,
    durationMinutes: this.durationMinutes,
    completedAt: this.completedAt,
    isPerfectScore: this.isPerfectScore,
    correctAnswers: this.correctAnswers,
    incorrectAnswers: this.incorrectAnswers,
    totalExercises: this.totalExercises
  };
};

// ============================================
// Static Methods
// ============================================

/**
 * Find sessions by user
 */
sessionSchema.statics.findByUser = function(userId, options = {}) {
  const { limit = 50, offset = 0, status, type } = options;
  
  let query = this.find({ userId });
  
  if (status) {
    query = query.where('status').equals(status);
  }
  if (type) {
    query = query.where('lessonType').equals(type);
  }
  
  return query
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(limit);
};

/**
 * Get user session statistics
 */
sessionSchema.statics.getUserStats = async function(userId) {
  const stats = await this.aggregate([
    { $match: { userId: mongoose.Types.ObjectId(userId), status: SESSION_STATUSES.COMPLETED } },
    {
      $group: {
        _id: null,
        totalSessions: { $sum: 1 },
        totalMinutes: { $sum: { $divide: ['$duration', 60] } },
        averageScore: { $avg: '$totalScore' },
        totalXP: { $sum: '$xpEarned' },
        perfectScores: { $sum: { $cond: ['$isPerfectScore', 1, 0] } },
        byType: {
          $push: {
            type: '$lessonType',
            score: '$totalScore',
            xp: '$xpEarned'
          }
        }
      }
    }
  ]);
  
  const result = stats[0] || {
    totalSessions: 0,
    totalMinutes: 0,
    averageScore: 0,
    totalXP: 0,
    perfectScores: 0
  };
  
  // Group by type
  if (result.byType) {
    result.byType = result.byType.reduce((acc, curr) => {
      if (!acc[curr.type]) {
        acc[curr.type] = { count: 0, totalScore: 0, totalXP: 0 };
      }
      acc[curr.type].count++;
      acc[curr.type].totalScore += curr.score;
      acc[curr.type].totalXP += curr.xp;
      return acc;
    }, {});
  }
  
  return result;
};

/**
 * Get active sessions count
 */
sessionSchema.statics.getActiveSessionsCount = async function() {
  return await this.countDocuments({
    status: SESSION_STATUSES.ACTIVE,
    startedAt: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
  });
};

/**
 * Get sessions by date range
 */
sessionSchema.statics.getSessionsByDateRange = async function(userId, startDate, endDate) {
  return await this.find({
    userId,
    completedAt: { $gte: startDate, $lte: endDate },
    status: SESSION_STATUSES.COMPLETED
  }).sort({ completedAt: 1 });
};

/**
 * Get popular lessons
 */
sessionSchema.statics.getPopularLessons = async function(limit = 10) {
  const popular = await this.aggregate([
    { $match: { status: SESSION_STATUSES.COMPLETED } },
    {
      $group: {
        _id: '$lessonId',
        title: { $first: '$lessonTitle' },
        type: { $first: '$lessonType' },
        count: { $sum: 1 },
        averageScore: { $avg: '$totalScore' }
      }
    },
    { $sort: { count: -1 } },
    { $limit: limit }
  ]);
  
  return popular;
};

// ============================================
// Indexes
// ============================================

sessionSchema.index({ sessionId: 1 });
sessionSchema.index({ userId: 1, createdAt: -1 });
sessionSchema.index({ userId: 1, status: 1 });
sessionSchema.index({ lessonId: 1 });
sessionSchema.index({ lessonType: 1 });
sessionSchema.index({ status: 1, startedAt: -1 });
sessionSchema.index({ completedAt: -1 });
sessionSchema.index({ userId: 1, totalScore: -1 });
sessionSchema.index({ 'tags': 1 });

// Compound indexes for common queries
sessionSchema.index({ userId: 1, status: 1, completedAt: -1 });
sessionSchema.index({ userId: 1, lessonType: 1, completedAt: -1 });

// ============================================
// Pre-save Middleware
// ============================================

// Update timestamps
sessionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Calculate progress before save
sessionSchema.pre('save', function(next) {
  if (this.totalExercises > 0) {
    this.progress = (this.completedExercises / this.totalExercises) * 100;
  }
  next();
});

// ============================================
// Model Creation
// ============================================

const Session = mongoose.model('Session', sessionSchema);

module.exports = Session;
