const crypto = require('crypto');
const { validationResult } = require('express-validator');

// Generate unique IDs
const generateUniqueId = (prefix = '') => {
  const timestamp = Date.now().toString(36);
  const randomPart = crypto.randomBytes(4).toString('hex');
  return `${prefix}${timestamp}${randomPart}`.toUpperCase();
};

// Format phone numbers to international format
const formatPhoneNumber = (phoneNumber, countryCode = '255') => {
  // Remove any non-digit characters
  let cleaned = phoneNumber.replace(/\D/g, '');
  
  // Remove leading zeros
  cleaned = cleaned.replace(/^0+/, '');
  
  // Add country code if not present
  if (!cleaned.startsWith(countryCode)) {
    cleaned = countryCode + cleaned;
  }
  
  return '+' + cleaned;
};

// Calculate pagination metadata
const calculatePagination = (page, limit, totalCount) => {
  const currentPage = parseInt(page) || 1;
  const perPage = parseInt(limit) || 10;
  const totalPages = Math.ceil(totalCount / perPage);
  const offset = (currentPage - 1) * perPage;
  
  return {
    current_page: currentPage,
    per_page: perPage,
    total_pages: totalPages,
    total_records: totalCount,
    has_next_page: currentPage < totalPages,
    has_prev_page: currentPage > 1,
    offset
  };
};

// Format currency amounts
const formatCurrency = (amount, currency = 'TZS') => {
  const formatter = new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2
  });
  
  return formatter.format(amount);
};

// Generate transaction reference
const generateTransactionRef = (prefix = 'MREDEO', userId = null) => {
  const timestamp = Date.now();
  const userPart = userId ? userId.substring(0, 8) : crypto.randomBytes(4).toString('hex');
  const randomPart = crypto.randomBytes(2).toString('hex').toUpperCase();
  
  return `${prefix}-${timestamp}-${userPart}-${randomPart}`;
};

// Validate and sanitize input data
const sanitizeInput = (data, allowedFields) => {
  const sanitized = {};
  
  Object.keys(data).forEach(key => {
    if (allowedFields.includes(key) && data[key] !== undefined) {
      if (typeof data[key] === 'string') {
        sanitized[key] = data[key].trim();
      } else {
        sanitized[key] = data[key];
      }
    }
  });
  
  return sanitized;
};

// Calculate date ranges
const getDateRange = (period) => {
  const now = new Date();
  let startDate, endDate = now;
  
  switch (period) {
    case 'today':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'quarter':
      const quarter = Math.floor(now.getMonth() / 3);
      startDate = new Date(now.getFullYear(), quarter * 3, 1);
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // Default to 30 days
  }
  
  return { startDate, endDate };
};

// Check if value is empty or null
const isEmpty = (value) => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
};

// Delay execution (for rate limiting, retries, etc.)
const delay = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// Generate OTP with custom length
const generateOTP = (length = 6) => {
  const digits = '0123456789';
  let otp = '';
  
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * digits.length)];
  }
  
  return otp;
};

// Mask sensitive data for logging
const maskSensitiveData = (obj, fieldsToMask = ['password', 'otp', 'token']) => {
  if (!obj || typeof obj !== 'object') return obj;
  
  const masked = { ...obj };
  
  fieldsToMask.forEach(field => {
    if (masked[field]) {
      masked[field] = '*'.repeat(masked[field].toString().length);
    }
  });
  
  return masked;
};

// Validate email format
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validate phone number format (Tanzania)
const isValidPhoneNumber = (phone) => {
  // Tanzania phone number patterns
  const phoneRegex = /^(\+255|255|0)?[67]\d{8}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
};

// Calculate age from date of birth
const calculateAge = (dateOfBirth) => {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
};

// Generate secure random string
const generateSecureString = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

module.exports = {
  generateUniqueId,
  formatPhoneNumber,
  calculatePagination,
  formatCurrency,
  generateTransactionRef,
  sanitizeInput,
  getDateRange,
  isEmpty,
  delay,
  generateOTP,
  maskSensitiveData,
  isValidEmail,
  isValidPhoneNumber,
  calculateAge,
  generateSecureString
};
