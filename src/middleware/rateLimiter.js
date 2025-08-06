const rateLimit = require('express-rate-limit');
const config = require('../config/environment');

const createLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message: message || 'Too many requests, please try again later'
    },
    standardHeaders: true,
    legacyHeaders: false
  });
};

const generalLimiter = createLimiter(
  config.security.rateLimitWindow * 60 * 1000, // 15 minutes
  config.security.rateLimitMax, // 100 requests
  'Too many requests from this IP, please try again later'
);

const authLimiter = createLimiter(
  15 * 60 * 1000, // 15 minutes
  10, // 10 attempts
  'Too many authentication attempts, please try again later'
);

const otpLimiter = createLimiter(
  5 * 60 * 1000, // 5 minutes
  3, // 3 attempts
  'Too many OTP requests, please try again later'
);

module.exports = {
  generalLimiter,
  authLimiter,
  otpLimiter
};
