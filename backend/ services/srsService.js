// ============================================
// SRS (Spaced Repetition System) Service
// SpeakFlow - AI Language Learning Platform
// ============================================

const { logger } = require('../middleware/logging');
const { AppError } = require('../middleware/errorHandler');

// ============================================
// Constants & Configuration
// ============================================

// SM-2 Algorithm constants
const SM2_CONSTANTS = {
  INITIAL_EASE_FACTOR: 2.5,
  MINIMUM_EASE_FACTOR: 1.3,
  MAXIMUM_EASE_FACTOR: 5.0,
  EASE_ADJUSTMENT: {
    EASY: 0.15,
    GOOD: 0.0,
    HARD: -0.2,
    AGAIN: -0.3
  }
};

// Review result types
const REVIEW_RESULTS = {
  AGAIN: 0,
  HARD: 1,
  GOOD: 2,
  EASY: 3
};

// Proficiency levels
const PROFICIENCY_LEVELS = {
  NEW: 0,
  LEARNING: 1,
  REVIEWING: 2,
  FAMILIAR: 3,
  MASTERED: 4
};

// Default intervals (days)
const DEFAULT_INTERVALS = {
  [REVIEW_RESULTS.AGAIN]: 0,
  [REVIEW_RESULTS.HARD]: 1,
  [REVIEW_RESULTS.GOOD]: 3,
  [REVIEW_RESULTS.EASY]: 7
};

// Maximum intervals (days)
const MAX_INTERVALS = {
  [PROFICIENCY_LEVELS.NEW]: 1,
  [PROFICIENCY_LEVELS.LEARNING]: 7,
  [PROFICIENCY_LEVELS.REVIEWING]: 30,
  [PROFICIENCY_LEVELS.FAMILIAR]: 90,
  [PROFICIENCY_LEVELS.MASTERED]: 365
};

// Leech thresholds
const LEECH_THRESHOLDS = {
  LAPSE_COUNT: 5,
  CONSECUTIVE_CORRECT_NEEDED: 3
};

// ============================================
// SM-2 Algorithm Implementation
// ============================================

/**
 * SM-2 Algorithm for spaced repetition
 * @param {Object} card - Card data with current SRS state
 * @param {number} quality - Review quality (0-3: Again, Hard, Good, Easy)
 * @returns {Object} Updated card data
 */
const sm2Algorithm = (card, quality) => {
  const {
    repetitions = 0,
    easeFactor = SM2_CONSTANTS.INITIAL_EASE_FACTOR,
    interval = 0
  } = card;
  
  let newRepetitions = repetitions;
  let newInterval = interval;
  let newEaseFactor = easeFactor;
  
  // Update ease factor based on quality
  let easeAdjustment = 0;
  switch (quality) {
    case REVIEW_RESULTS.EASY:
      easeAdjustment = SM2_CONSTANTS.EASE_ADJUSTMENT.EASY;
      break;
    case REVIEW_RESULTS.GOOD:
      easeAdjustment = SM2_CONSTANTS.EASE_ADJUSTMENT.GOOD;
      break;
    case REVIEW_RESULTS.HARD:
      easeAdjustment = SM2_CONSTANTS.EASE_ADJUSTMENT.HARD;
      break;
    case REVIEW_RESULTS.AGAIN:
      easeAdjustment = SM2_CONSTANTS.EASE_ADJUSTMENT.AGAIN;
      break;
  }
  
  newEaseFactor = easeFactor + easeAdjustment;
  newEaseFactor = Math.max(
    SM2_CONSTANTS.MINIMUM_EASE_FACTOR,
    Math.min(SM2_CONSTANTS.MAXIMUM_EASE_FACTOR, newEaseFactor)
  );
  
  // Calculate new interval
  if (quality === REVIEW_RESULTS.AGAIN) {
    newRepetitions = 0;
    newInterval = DEFAULT_INTERVALS[REVIEW_RESULTS.AGAIN];
  } else {
    if (repetitions === 0) {
      newRepetitions = 1;
      newInterval = DEFAULT_INTERVALS[quality];
    } else if (repetitions === 1) {
      newRepetitions = 2;
      newInterval = DEFAULT_INTERVALS[quality] * 2;
    } else {
      newRepetitions = repetitions + 1;
      newInterval = Math.round(interval * newEaseFactor);
    }
  }
  
  // Cap interval based on quality
  if (quality === REVIEW_RESULTS.HARD) {
    newInterval = Math.max(1, Math.floor(newInterval * 0.8));
  }
  
  // Ensure minimum interval
  newInterval = Math.max(1, newInterval);
  
  // Cap maximum interval
  newInterval = Math.min(newInterval, MAX_INTERVALS[PROFICIENCY_LEVELS.MASTERED]);
  
  return {
    repetitions: newRepetitions,
    easeFactor: newEaseFactor,
    interval: newInterval,
    nextReviewDate: new Date(Date.now() + newInterval * 24 * 60 * 60 * 1000)
  };
};

// ============================================
// Proficiency Calculation
// ============================================

/**
 * Calculate proficiency level based on SRS data
 * @param {Object} srsData - SRS data object
 * @returns {number} Proficiency level
 */
const calculateProficiency = (srsData) => {
  const { repetitions, correctCount, totalReviews, consecutiveCorrect, interval } = srsData;
  
  // Mastered: 5+ repetitions, 90%+ accuracy, 30+ day interval
  if (repetitions >= 5 && interval >= 30 && (correctCount / totalReviews) >= 0.9) {
    return PROFICIENCY_LEVELS.MASTERED;
  }
  
  // Familiar: 3+ repetitions, 80%+ accuracy, 7+ day interval
  if (repetitions >= 3 && interval >= 7 && (correctCount / totalReviews) >= 0.8) {
    return PROFICIENCY_LEVELS.FAMILIAR;
  }
  
  // Reviewing: 1+ repetitions, interval > 1
  if (repetitions >= 1 && interval > 1) {
    return PROFICIENCY_LEVELS.REVIEWING;
  }
  
  // Learning: at least one review
  if (repetitions > 0) {
    return PROFICIENCY_LEVELS.LEARNING;
  }
  
  return PROFICIENCY_LEVELS.NEW;
};

/**
 * Check if card is a leech (frequently forgotten)
 * @param {Object} srsData - SRS data object
 * @returns {boolean} True if card is a leech
 */
const isLeech = (srsData) => {
  const { lapseCount = 0, consecutiveCorrect = 0 } = srsData;
  return lapseCount >= LEECH_THRESHOLDS.LAPSE_COUNT && 
         consecutiveCorrect < LEECH_THRESHOLDS.CONSECUTIVE_CORRECT_NEEDED;
};

// ============================================
// Review Session Management
// ============================================

// Mock storage for review sessions
const reviewSessions = new Map();

/**
 * Create a new review session
 * @param {string} userId - User ID
 * @param {Array} cards - List of cards to review
 * @returns {Object} Review session
 */
const createReviewSession = async (userId, cards) => {
  const sessionId = `review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const session = {
    id: sessionId,
    userId,
    cards: cards.map(card => ({
      cardId: card.id,
      data: card,
      result: null,
      reviewed: false
    })),
    startedAt: new Date().toISOString(),
    completedAt: null,
    status: 'active'
  };
  
  reviewSessions.set(sessionId, session);
  
  logger.info(`Review session created: ${sessionId} for user ${userId}`, {
    cardCount: cards.length
  });
  
  return session;
};

/**
 * Get active review session
 * @param {string} userId - User ID
 * @returns {Object|null} Active review session
 */
const getActiveSession = async (userId) => {
  for (const session of reviewSessions.values()) {
    if (session.userId === userId && session.status === 'active') {
      return session;
    }
  }
  return null;
};

/**
 * Submit review result
 * @param {string} sessionId - Session ID
 * @param {string} cardId - Card ID
 * @param {number} quality - Review quality (0-3)
 * @param {number} responseTime - Response time in ms
 * @returns {Object} Updated card data
 */
const submitReview = async (sessionId, cardId, quality, responseTime = 0) => {
  const session = reviewSessions.get(sessionId);
  
  if (!session) {
    throw new AppError('Review session not found', 404, 'SESSION_NOT_FOUND');
  }
  
  const cardIndex = session.cards.findIndex(c => c.cardId === cardId);
  if (cardIndex === -1) {
    throw new AppError('Card not found in session', 404, 'CARD_NOT_FOUND');
  }
  
  const card = session.cards[cardIndex];
  
  if (card.reviewed) {
    throw new AppError('Card already reviewed', 400, 'ALREADY_REVIEWED');
  }
  
  // Update SRS using SM-2 algorithm
  const updatedSrs = sm2Algorithm(card.data.srsData || {}, quality);
  
  // Update card data
  const updatedCard = {
    ...card.data,
    srsData: {
      ...card.data.srsData,
      ...updatedSrs,
      lastReviewDate: new Date().toISOString(),
      totalReviews: (card.data.srsData?.totalReviews || 0) + 1,
      correctCount: (card.data.srsData?.correctCount || 0) + (quality >= REVIEW_RESULTS.GOOD ? 1 : 0),
      consecutiveCorrect: quality >= REVIEW_RESULTS.GOOD 
        ? (card.data.srsData?.consecutiveCorrect || 0) + 1 
        : 0,
      lapseCount: (card.data.srsData?.lapseCount || 0) + (quality === REVIEW_RESULTS.AGAIN ? 1 : 0),
      averageResponseTime: calculateAverageResponseTime(
        card.data.srsData?.averageResponseTime,
        card.data.srsData?.totalReviews,
        responseTime
      )
    }
  };
  
  // Update proficiency
  updatedCard.srsData.proficiency = calculateProficiency(updatedCard.srsData);
  updatedCard.srsData.isLeech = isLeech(updatedCard.srsData);
  
  // Update session
  session.cards[cardIndex] = {
    ...card,
    result: quality,
    reviewed: true,
    updatedCard,
    responseTime
  };
  
  // Check if session is complete
  const allReviewed = session.cards.every(c => c.reviewed);
  if (allReviewed) {
    session.status = 'completed';
    session.completedAt = new Date().toISOString();
  }
  
  reviewSessions.set(sessionId, session);
  
  logger.info(`Review submitted: ${sessionId} -> ${cardId}`, { quality, responseTime });
  
  return {
    success: true,
    card: updatedCard,
    sessionProgress: {
      reviewed: session.cards.filter(c => c.reviewed).length,
      total: session.cards.length,
      isComplete: allReviewed
    }
  };
};

/**
 * Calculate average response time
 */
const calculateAverageResponseTime = (currentAvg, totalReviews, newResponseTime) => {
  if (!currentAvg || totalReviews === 0) {
    return newResponseTime;
  }
  return (currentAvg * totalReviews + newResponseTime) / (totalReviews + 1);
};

// ============================================
// Card Selection Algorithms
// ============================================

/**
 * Get due cards for review (SM-2 priority)
 * @param {Array} cards - List of cards with SRS data
 * @param {number} limit - Maximum number of cards to return
 * @returns {Array} Due cards sorted by priority
 */
const getDueCards = (cards, limit = 50) => {
  const now = new Date();
  
  // Filter due cards
  const dueCards = cards.filter(card => {
    const nextReview = new Date(card.srsData?.nextReviewDate || 0);
    return nextReview <= now;
  });
  
  // Calculate priority score
  const scoredCards = dueCards.map(card => {
    let priority = 0;
    
    // Priority based on interval (shorter interval = higher priority)
    const interval = card.srsData?.interval || 0;
    priority += Math.max(0, 10 - interval);
    
    // Priority based on lapse count
    const lapseCount = card.srsData?.lapseCount || 0;
    priority += lapseCount * 5;
    
    // Priority based on proficiency (lower proficiency = higher priority)
    const proficiency = card.srsData?.proficiency || PROFICIENCY_LEVELS.NEW;
    priority += (PROFICIENCY_LEVELS.MASTERED - proficiency) * 2;
    
    return { card, priority };
  });
  
  // Sort by priority (highest first)
  scoredCards.sort((a, b) => b.priority - a.priority);
  
  return scoredCards.slice(0, limit).map(sc => sc.card);
};

/**
 * Get new cards to learn (never reviewed)
 * @param {Array} cards - List of cards
 * @param {number} limit - Maximum number of cards to return
 * @returns {Array} New cards
 */
const getNewCards = (cards, limit = 10) => {
  const newCards = cards.filter(card => {
    const totalReviews = card.srsData?.totalReviews || 0;
    return totalReviews === 0;
  });
  
  return newCards.slice(0, limit);
};

/**
 * Get cards for review session (balanced mix)
 * @param {Array} cards - List of all cards
 * @param {Object} options - Session options
 * @returns {Array} Cards for review session
 */
const getReviewSessionCards = (cards, options = {}) => {
  const {
    dueLimit = 30,
    newLimit = 10,
    includeLeeches = false
  } = options;
  
  // Get due cards
  let dueCards = getDueCards(cards, dueLimit);
  
  // Filter leeches if needed
  if (!includeLeeches) {
    dueCards = dueCards.filter(card => !card.srsData?.isLeech);
  }
  
  // Get new cards
  let newCards = getNewCards(cards, newLimit);
  
  // Combine and limit
  let sessionCards = [...dueCards, ...newCards];
  
  // Shuffle for variety (but keep due cards first)
  const shuffledNew = newCards.sort(() => Math.random() - 0.5);
  sessionCards = [...dueCards, ...shuffledNew];
  
  return sessionCards;
};

// ============================================
// Review Statistics
// ============================================

/**
 * Get user review statistics
 * @param {string} userId - User ID
 * @param {Array} cards - User's cards
 * @returns {Object} Review statistics
 */
const getUserReviewStats = async (userId, cards) => {
  const totalCards = cards.length;
  const reviewedCards = cards.filter(c => (c.srsData?.totalReviews || 0) > 0);
  
  const dueCards = getDueCards(cards);
  const masteredCards = cards.filter(c => c.srsData?.proficiency === PROFICIENCY_LEVELS.MASTERED);
  const leechCards = cards.filter(c => c.srsData?.isLeech);
  
  // Calculate retention rate
  const totalReviews = reviewedCards.reduce((sum, c) => sum + (c.srsData?.totalReviews || 0), 0);
  const correctReviews = reviewedCards.reduce((sum, c) => sum + (c.srsData?.correctCount || 0), 0);
  const retentionRate = totalReviews > 0 ? (correctReviews / totalReviews) * 100 : 0;
  
  // Calculate average ease factor
  const avgEaseFactor = reviewedCards.reduce((sum, c) => sum + (c.srsData?.easeFactor || 2.5), 0) / (reviewedCards.length || 1);
  
  // Calculate review forecast for next 7 days
  const forecast = [];
  const now = new Date();
  
  for (let i = 1; i <= 7; i++) {
    const futureDate = new Date(now);
    futureDate.setDate(now.getDate() + i);
    const dueCount = cards.filter(c => {
      const nextReview = new Date(c.srsData?.nextReviewDate || 0);
      return nextReview <= futureDate;
    }).length;
    forecast.push({
      date: futureDate.toISOString().split('T')[0],
      dueCount
    });
  }
  
  return {
    summary: {
      totalCards,
      reviewedCards: reviewedCards.length,
      masteredCards: masteredCards.length,
      dueCards: dueCards.length,
      leechCards: leechCards.length,
      retentionRate: Math.round(retentionRate * 100) / 100,
      avgEaseFactor: Math.round(avgEaseFactor * 100) / 100
    },
    forecast,
    proficiencyBreakdown: {
      [PROFICIENCY_LEVELS.NEW]: cards.filter(c => c.srsData?.proficiency === PROFICIENCY_LEVELS.NEW).length,
      [PROFICIENCY_LEVELS.LEARNING]: cards.filter(c => c.srsData?.proficiency === PROFICIENCY_LEVELS.LEARNING).length,
      [PROFICIENCY_LEVELS.REVIEWING]: cards.filter(c => c.srsData?.proficiency === PROFICIENCY_LEVELS.REVIEWING).length,
      [PROFICIENCY_LEVELS.FAMILIAR]: cards.filter(c => c.srsData?.proficiency === PROFICIENCY_LEVELS.FAMILIAR).length,
      [PROFICIENCY_LEVELS.MASTERED]: masteredCards.length
    }
  };
};

/**
 * Get card review history
 * @param {Object} card - Card with SRS data
 * @returns {Array} Review history
 */
const getCardReviewHistory = (card) => {
  const history = card.srsData?.reviewHistory || [];
  
  return history.map(entry => ({
    date: entry.date,
    result: entry.result,
    responseTime: entry.responseTime,
    interval: entry.interval,
    easeFactor: entry.easeFactor
  }));
};

/**
 * Calculate optimal review limit based on user performance
 * @param {Object} userStats - User statistics
 * @returns {number} Recommended review limit
 */
const getRecommendedReviewLimit = (userStats) => {
  const { retentionRate, avgResponseTime } = userStats;
  
  let limit = 30; // Default
  
  if (retentionRate < 70) {
    // User is struggling, reduce load
    limit = 15;
  } else if (retentionRate > 90 && avgResponseTime < 3000) {
    // User is doing well, increase load
    limit = 50;
  } else if (retentionRate > 85) {
    limit = 40;
  }
  
  return limit;
};

// ============================================
// Export Service
// ============================================

module.exports = {
  // SM-2 Algorithm
  sm2Algorithm,
  
  // Proficiency
  calculateProficiency,
  isLeech,
  
  // Review session management
  createReviewSession,
  getActiveSession,
  submitReview,
  
  // Card selection
  getDueCards,
  getNewCards,
  getReviewSessionCards,
  
  // Statistics
  getUserReviewStats,
  getCardReviewHistory,
  getRecommendedReviewLimit,
  
  // Constants
  REVIEW_RESULTS,
  PROFICIENCY_LEVELS,
  SM2_CONSTANTS,
  DEFAULT_INTERVALS,
  MAX_INTERVALS,
  LEECH_THRESHOLDS
};
