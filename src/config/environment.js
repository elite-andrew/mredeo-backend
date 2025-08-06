require('dotenv').config();

module.exports = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || 3000,
  API_VERSION: process.env.API_VERSION || 'v1',
  
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'mredeo_db',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    url: process.env.DATABASE_URL
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
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX) || 100
  },
  
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 5242880, // 5MB
    path: process.env.UPLOAD_PATH || './uploads'
  }
};
