require('dotenv').config();

module.exports = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || 3000,
  API_VERSION: process.env.API_VERSION || 'v1',
  
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'MREDEO',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    url: process.env.DATABASE_URL,
    // Performance optimizations
    pool: {
      max: parseInt(process.env.DB_POOL_MAX) || 50,
      min: parseInt(process.env.DB_POOL_MIN) || 5,
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 5000,
    }
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'fallback-secret-key',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret',
    expiresIn: process.env.JWT_EXPIRE || '24h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRE || '7d'
  },
  
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12,
    rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW) || 15,
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    // Enhanced security settings
    maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5,
    lockoutDuration: parseInt(process.env.LOCKOUT_DURATION) || 15, // minutes
  },
  
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 5242880, // 5MB
    path: process.env.UPLOAD_PATH || './uploads',
    allowedTypes: ['image/jpeg', 'image/png', 'image/jpg'],
    compression: {
      enabled: process.env.ENABLE_IMAGE_COMPRESSION === 'true',
      quality: parseInt(process.env.IMAGE_COMPRESSION_QUALITY) || 80
    }
  },

  // Performance optimizations
  performance: {
    // Caching settings
    cache: {
      ttl: parseInt(process.env.CACHE_TTL) || 300, // 5 minutes
      checkPeriod: parseInt(process.env.CACHE_CHECK_PERIOD) || 600, // 10 minutes
      maxKeys: parseInt(process.env.CACHE_MAX_KEYS) || 1000
    },
    
    // Compression settings
    compression: {
      enabled: process.env.ENABLE_COMPRESSION !== 'false',
      threshold: parseInt(process.env.COMPRESSION_THRESHOLD) || 1024 // 1KB
    },
    
    // Request timeout settings
    timeout: {
      request: parseInt(process.env.REQUEST_TIMEOUT) || 30000, // 30 seconds
      upload: parseInt(process.env.UPLOAD_TIMEOUT) || 60000, // 60 seconds
    },
    
    // Database query optimization
    database: {
      slowQueryThreshold: parseInt(process.env.SLOW_QUERY_THRESHOLD) || 100, // 100ms
      enableQueryLogging: process.env.ENABLE_QUERY_LOGGING === 'true',
      maxBatchSize: parseInt(process.env.MAX_BATCH_SIZE) || 1000
    }
  },

  // Monitoring and logging
  monitoring: {
    enableMetrics: process.env.ENABLE_METRICS === 'true',
    logLevel: process.env.LOG_LEVEL || 'info',
    enableRequestLogging: process.env.ENABLE_REQUEST_LOGGING !== 'false',
    enableErrorTracking: process.env.ENABLE_ERROR_TRACKING === 'true'
  }
};
