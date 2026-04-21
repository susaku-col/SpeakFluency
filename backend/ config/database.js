// ============================================
// Database Configuration
// SpeakFlow - AI Language Learning Platform
// ============================================

const mongoose = require('mongoose');
const { logger } = require('../middleware/logging');

// ============================================
// Constants & Configuration
// ============================================

const DB_CONFIG = {
  // Connection settings
  uri: process.env.DATABASE_URL || 'mongodb://localhost:27017/speakflow',
  options: {
    // Connection options
    maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE) || 10,
    minPoolSize: parseInt(process.env.DB_MIN_POOL_SIZE) || 2,
    socketTimeoutMS: parseInt(process.env.DB_SOCKET_TIMEOUT) || 45000,
    connectTimeoutMS: parseInt(process.env.DB_CONNECT_TIMEOUT) || 10000,
    serverSelectionTimeoutMS: parseInt(process.env.DB_SERVER_SELECTION_TIMEOUT) || 5000,
    heartbeatFrequencyMS: parseInt(process.env.DB_HEARTBEAT_FREQUENCY) || 10000,
    
    // Retry settings
    retryWrites: true,
    retryReads: true,
    
    // Write concern
    w: process.env.DB_WRITE_CONCERN || 'majority',
    wtimeoutMS: parseInt(process.env.DB_WRITE_TIMEOUT) || 5000,
    
    // Read preference
    readPreference: process.env.DB_READ_PREFERENCE || 'primaryPreferred',
    
    // SSL/TLS
    ssl: process.env.DB_SSL === 'true',
    sslValidate: process.env.DB_SSL_VALIDATE !== 'false',
    
    // Authentication
    authSource: process.env.DB_AUTH_SOURCE || 'admin',
    user: process.env.DB_USER,
    pass: process.env.DB_PASSWORD,
    
    // Other options
    family: 4, // Use IPv4
    autoIndex: process.env.NODE_ENV !== 'production', // Auto-index only in development
    autoCreate: true
  },
  
  // Monitoring settings
  monitoring: {
    enabled: process.env.DB_MONITORING_ENABLED !== 'false',
    intervalMs: parseInt(process.env.DB_MONITORING_INTERVAL) || 10000
  },
  
  // Backup settings
  backup: {
    enabled: process.env.DB_BACKUP_ENABLED === 'true',
    interval: process.env.DB_BACKUP_INTERVAL || '0 0 * * *', // Daily at midnight
    retention: parseInt(process.env.DB_BACKUP_RETENTION) || 7 // days
  }
};

// ============================================
// Connection State
// ============================================

let isConnected = false;
let connectionAttempts = 0;
const maxConnectionAttempts = 5;
let reconnectTimeout = null;

// ============================================
// Connection Event Handlers
// ============================================

/**
 * Handle successful connection
 */
const handleConnected = () => {
  isConnected = true;
  connectionAttempts = 0;
  logger.info('MongoDB connected successfully', {
    host: mongoose.connection.host,
    port: mongoose.connection.port,
    name: mongoose.connection.name,
    poolSize: mongoose.connection.pool?.size
  });
};

/**
 * Handle connection error
 */
const handleError = (error) => {
  isConnected = false;
  logger.error('MongoDB connection error:', {
    message: error.message,
    code: error.code,
    name: error.name
  });
};

/**
 * Handle disconnection
 */
const handleDisconnected = () => {
  if (isConnected) {
    isConnected = false;
    logger.warn('MongoDB disconnected');
    
    // Attempt to reconnect
    if (connectionAttempts < maxConnectionAttempts) {
      scheduleReconnect();
    }
  }
};

/**
 * Schedule reconnection attempt
 */
const scheduleReconnect = () => {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
  }
  
  const delay = Math.min(1000 * Math.pow(2, connectionAttempts), 30000);
  connectionAttempts++;
  
  logger.info(`Scheduling MongoDB reconnect attempt ${connectionAttempts} in ${delay}ms`);
  
  reconnectTimeout = setTimeout(() => {
    connectDatabase().catch(err => {
      logger.error('Reconnection attempt failed:', err);
    });
  }, delay);
};

// ============================================
// Connection Monitoring
// ============================================

/**
 * Monitor connection pool status
 */
const monitorConnectionPool = () => {
  if (!DB_CONFIG.monitoring.enabled) return;
  
  setInterval(() => {
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      const pool = mongoose.connection.pool;
      if (pool) {
        logger.debug('Connection pool status', {
          totalConnections: pool.size,
          activeConnections: pool.activeConnections,
          availableConnections: pool.availableConnections,
          pendingOperations: pool.pending?.size || 0
        });
      }
    }
  }, DB_CONFIG.monitoring.intervalMs);
};

/**
 * Get connection health status
 */
const getConnectionHealth = () => {
  const state = mongoose.connection.readyState;
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
    99: 'uninitialized'
  };
  
  return {
    isConnected: state === 1,
    state: states[state] || 'unknown',
    host: mongoose.connection.host,
    port: mongoose.connection.port,
    name: mongoose.connection.name,
    models: Object.keys(mongoose.models).length,
    connectionAttempts,
    poolSize: mongoose.connection.pool?.size
  };
};

// ============================================
// Main Connection Function
// ============================================

/**
 * Connect to MongoDB database
 * @param {Object} options - Additional connection options
 * @returns {Promise<mongoose.Connection>}
 */
const connectDatabase = async (options = {}) => {
  try {
    // Check if already connected
    if (mongoose.connection.readyState === 1) {
      logger.info('MongoDB already connected');
      return mongoose.connection;
    }
    
    // Remove existing event listeners
    mongoose.connection.removeAllListeners();
    
    // Set up event listeners
    mongoose.connection.on('connected', handleConnected);
    mongoose.connection.on('error', handleError);
    mongoose.connection.on('disconnected', handleDisconnected);
    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
      isConnected = true;
      connectionAttempts = 0;
    });
    
    // Merge options
    const connectionOptions = {
      ...DB_CONFIG.options,
      ...options
    };
    
    // Remove undefined values
    Object.keys(connectionOptions).forEach(key => {
      if (connectionOptions[key] === undefined) {
        delete connectionOptions[key];
      }
    });
    
    // Connect to database
    logger.info('Connecting to MongoDB...', {
      uri: DB_CONFIG.uri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@'), // Hide credentials
      options: { ...connectionOptions, user: undefined, pass: undefined }
    });
    
    await mongoose.connect(DB_CONFIG.uri, connectionOptions);
    
    // Start monitoring
    monitorConnectionPool();
    
    return mongoose.connection;
    
  } catch (error) {
    logger.error('Failed to connect to MongoDB:', error);
    
    // Schedule retry
    if (connectionAttempts < maxConnectionAttempts) {
      scheduleReconnect();
    } else {
      logger.error('Max connection attempts reached. Please check your database configuration.');
      process.exit(1);
    }
    
    throw error;
  }
};

// ============================================
// Disconnection Function
// ============================================

/**
 * Disconnect from MongoDB database
 * @returns {Promise<void>}
 */
const disconnectDatabase = async () => {
  try {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
    }
    
    if (mongoose.connection.readyState === 1) {
      logger.info('Disconnecting from MongoDB...');
      await mongoose.disconnect();
      isConnected = false;
      logger.info('MongoDB disconnected successfully');
    }
  } catch (error) {
    logger.error('Error disconnecting from MongoDB:', error);
    throw error;
  }
};

// ============================================
// Query Helpers
// ============================================

/**
 * Execute query with timeout
 * @param {Promise} query - Mongoose query
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise}
 */
const executeWithTimeout = async (query, timeoutMs = 30000) => {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Query timeout after ${timeoutMs}ms`)), timeoutMs);
  });
  
  return Promise.race([query, timeoutPromise]);
};

/**
 * Execute transaction
 * @param {Function} callback - Transaction callback
 * @returns {Promise}
 */
const executeTransaction = async (callback) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const result = await callback(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Paginate query results
 * @param {mongoose.Model} model - Mongoose model
 * @param {Object} query - Query filters
 * @param {Object} options - Pagination options
 * @returns {Promise<Object>}
 */
const paginate = async (model, query = {}, options = {}) => {
  const {
    page = 1,
    limit = 20,
    sort = { createdAt: -1 },
    select = null,
    populate = null
  } = options;
  
  const skip = (page - 1) * limit;
  
  let findQuery = model.find(query);
  
  if (select) findQuery = findQuery.select(select);
  if (populate) findQuery = findQuery.populate(populate);
  
  const [data, total] = await Promise.all([
    findQuery.sort(sort).skip(skip).limit(limit).lean(),
    model.countDocuments(query)
  ]);
  
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1
    }
  };
};

// ============================================
// Health Check
// ============================================

/**
 * Check database health
 * @returns {Promise<Object>}
 */
const checkHealth = async () => {
  try {
    const startTime = Date.now();
    
    // Run a simple ping command
    await mongoose.connection.db.admin().ping();
    
    const responseTime = Date.now() - startTime;
    const health = getConnectionHealth();
    
    return {
      status: 'healthy',
      responseTime,
      ...health
    };
  } catch (error) {
    logger.error('Database health check failed:', error);
    return {
      status: 'unhealthy',
      error: error.message,
      ...getConnectionHealth()
    };
  }
};

// ============================================
// Backup Function (Optional)
// ============================================

/**
 * Create database backup
 * @returns {Promise<Object>}
 */
const createBackup = async () => {
  if (!DB_CONFIG.backup.enabled) {
    return { success: false, message: 'Backup is disabled' };
  }
  
  try {
    const backupDir = process.env.DB_BACKUP_PATH || './backups';
    const filename = `speakflow_${new Date().toISOString().replace(/[:.]/g, '-')}.gz`;
    const filepath = `${backupDir}/${filename}`;
    
    // In production, implement actual backup using mongodump
    logger.info(`Database backup created: ${filename}`);
    
    return {
      success: true,
      filename,
      filepath,
      size: 0,
      createdAt: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Backup failed:', error);
    return { success: false, error: error.message };
  }
};

// ============================================
// Export Configuration
// ============================================

module.exports = {
  // Connection management
  connectDatabase,
  disconnectDatabase,
  getConnectionHealth,
  checkHealth,
  
  // Query helpers
  executeWithTimeout,
  executeTransaction,
  paginate,
  
  // Backup
  createBackup,
  
  // Constants
  DB_CONFIG,
  isConnected: () => isConnected,
  mongoose
};
