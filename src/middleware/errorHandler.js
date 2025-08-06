const config = require('../config/environment');

const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Default error
  let error = {
    success: false,
    message: 'Internal server error'
  };

  // Mongoose/Database validation errors
  if (err.name === 'ValidationError') {
    error.message = 'Validation failed';
    error.details = Object.values(err.errors).map(e => e.message);
    return res.status(400).json(error);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error.message = 'Invalid token';
    return res.status(401).json(error);
  }

  if (err.name === 'TokenExpiredError') {
    error.message = 'Token expired';
    return res.status(401).json(error);
  }

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    error.message = 'File too large';
    return res.status(400).json(error);
  }

  if (err.code === 'LIMIT_FILE_COUNT') {
    error.message = 'Too many files';
    return res.status(400).json(error);
  }

  // PostgreSQL errors
  if (err.code === '23505') { // Unique violation
    error.message = 'Resource already exists';
    return res.status(409).json(error);
  }

  if (err.code === '23503') { // Foreign key violation
    error.message = 'Referenced resource not found';
    return res.status(400).json(error);
  }

  if (err.code === '23502') { // Not null violation
    error.message = 'Required field missing';
    return res.status(400).json(error);
  }

  // Custom operational errors
  if (err.isOperational) {
    error.message = err.message;
    return res.status(err.statusCode || 400).json(error);
  }

  // Development vs Production error details
  if (config.NODE_ENV === 'development') {
    error.stack = err.stack;
    error.details = err.message;
  }

  res.status(500).json(error);
};

module.exports = errorHandler;
