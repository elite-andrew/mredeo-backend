const winston = require('winston');
const path = require('path');
const config = require('../config/environment');

// Define log levels
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

// Define log colors
const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue'
};

// Add colors to winston
winston.addColors(logColors);

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf((info) => {
    const { timestamp, level, message, stack, ...meta } = info;
    
    let logMessage = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    // Add stack trace for errors
    if (stack) {
      logMessage += `\n${stack}`;
    }
    
    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      logMessage += `\nMetadata: ${JSON.stringify(meta, null, 2)}`;
    }
    
    return logMessage;
  })
);

// Define console format
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf((info) => {
    const { timestamp, level, message } = info;
    return `${timestamp} [${level}]: ${message}`;
  })
);

// Create logger transports
const transports = [
  // Console transport for development
  new winston.transports.Console({
    format: consoleFormat,
    level: config.NODE_ENV === 'production' ? 'info' : 'debug'
  })
];

// Add file transports for production
if (config.NODE_ENV === 'production') {
  // Error log file
  transports.push(
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/error.log'),
      level: 'error',
      format: logFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 5
    })
  );
  
  // Combined log file
  transports.push(
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/combined.log'),
      format: logFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 5
    })
  );
}

// Create winston logger
const logger = winston.createLogger({
  levels: logLevels,
  level: config.LOG_LEVEL || 'info',
  format: logFormat,
  transports,
  exceptionHandlers: [
    new winston.transports.File({ 
      filename: path.join(__dirname, '../../logs/exceptions.log') 
    })
  ],
  rejectionHandlers: [
    new winston.transports.File({ 
      filename: path.join(__dirname, '../../logs/rejections.log') 
    })
  ]
});

// Helper functions for structured logging
const logRequest = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user ? req.user.id : null
    };
    
    if (res.statusCode >= 400) {
      logger.error('HTTP Request Error', logData);
    } else {
      logger.http('HTTP Request', logData);
    }
  });
  
  next();
};

const logError = (error, context = {}) => {
  logger.error(error.message, {
    stack: error.stack,
    ...context
  });
};

const logInfo = (message, meta = {}) => {
  logger.info(message, meta);
};

const logWarn = (message, meta = {}) => {
  logger.warn(message, meta);
};

const logDebug = (message, meta = {}) => {
  logger.debug(message, meta);
};

const logAuth = (action, userId, success = true, meta = {}) => {
  const logData = {
    action,
    userId,
    success,
    timestamp: new Date().toISOString(),
    ...meta
  };
  
  if (success) {
    logger.info(`Auth Success: ${action}`, logData);
  } else {
    logger.warn(`Auth Failed: ${action}`, logData);
  }
};

const logPayment = (action, userId, amount = null, paymentId = null, meta = {}) => {
  const logData = {
    action,
    userId,
    amount,
    paymentId,
    timestamp: new Date().toISOString(),
    ...meta
  };
  
  logger.info(`Payment: ${action}`, logData);
};

const logSecurity = (event, details = {}) => {
  logger.warn(`Security Event: ${event}`, {
    timestamp: new Date().toISOString(),
    ...details
  });
};

// Export logger and helper functions
module.exports = {
  logger,
  logRequest,
  logError,
  logInfo,
  logWarn,
  logDebug,
  logAuth,
  logPayment,
  logSecurity
};
