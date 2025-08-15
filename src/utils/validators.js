const { body, param, query } = require('express-validator');

// User validation rules
const userValidators = {
  fullName: body('full_name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Full name can only contain letters, spaces, hyphens and apostrophes'),

  username: body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers and underscores')
    .toLowerCase(),

  email: body('email')
    .optional()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),

  phoneNumber: body('phone_number')
    .isMobilePhone('any')
    .withMessage('Please provide a valid phone number'),

  password: body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),

  role: body('role')
    .optional()
    .isIn(['member', 'admin_chairperson', 'admin_secretary', 'admin_signatory', 'admin_treasurer'])
    .withMessage('Invalid role specified')
};

// Payment validation rules
const paymentValidators = {
  contributionTypeId: body('contribution_type_id')
    .isUUID()
    .withMessage('Valid contribution type ID required'),

  amount: body('amount_paid')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be a positive number'),

  telco: body('telco')
    .isIn(['vodacom', 'tigo', 'airtel', 'halotel', 'zantel', 'other'])
    .withMessage('Valid telco provider required'),

  phoneNumberUsed: body('phone_number_used')
    .isMobilePhone('any')
    .withMessage('Valid phone number required for payment'),

  purpose: body('purpose')
    .optional()
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Purpose must be between 3 and 200 characters')
};

// Notification validation rules
const notificationValidators = {
  title: body('title')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Title must be between 1 and 100 characters'),

  message: body('message')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Message must be between 1 and 1000 characters'),

  recipientIds: body('recipient_ids')
    .optional()
    .isArray()
    .withMessage('Recipient IDs must be an array')
    .custom((value) => {
      if (value && value.length > 0) {
        return value.every(id => typeof id === 'string' && id.length > 0);
      }
      return true;
    })
    .withMessage('All recipient IDs must be valid strings')
};

// Contribution type validation rules
const contributionValidators = {
  name: body('name')
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Contribution name must be between 3 and 100 characters'),

  amount: body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be a positive number'),

  description: body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters')
};

// OTP validation rules
const otpValidators = {
  otpCode: body('otp_code')
    .isLength({ min: 6, max: 6 })
    .withMessage('OTP must be exactly 6 digits')
    .isNumeric()
    .withMessage('OTP must contain only numbers'),

  identifier: body('identifier')
    .notEmpty()
    .withMessage('Phone number or email is required')
};

// Query parameter validation rules
const queryValidators = {
  page: query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),

  limit: query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),

  sortBy: query('sort_by')
    .optional()
    .isIn(['created_at', 'updated_at', 'name', 'amount', 'status'])
    .withMessage('Invalid sort field'),

  sortOrder: query('sort_order')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc'),

  startDate: query('start_date')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),

  endDate: query('end_date')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),

  status: query('status')
    .optional()
    .isIn(['pending', 'success', 'failed', 'cancelled'])
    .withMessage('Invalid status value')
};

// Parameter validation rules
const paramValidators = {
  id: param('id')
    .isUUID()
    .withMessage('Invalid ID format'),

  userId: param('userId')
    .isUUID()
    .withMessage('Invalid user ID format'),

  paymentId: param('paymentId')
    .isUUID()
    .withMessage('Invalid payment ID format'),

  notificationId: param('notificationId')
    .isUUID()
    .withMessage('Invalid notification ID format'),

  contributionId: param('contributionId')
    .isUUID()
    .withMessage('Invalid contribution ID format')
};

// File upload validation
const fileValidators = {
  profilePicture: (req, res, next) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: 'Only JPEG, PNG, and GIF images are allowed'
      });
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (req.file.size > maxSize) {
      return res.status(400).json({
        success: false,
        message: 'File size cannot exceed 5MB'
      });
    }

    next();
  }
};

// Custom validators
const customValidators = {
  isValidTanzanianPhone: (value) => {
    const phoneRegex = /^(\+255|255|0)?[67]\d{8}$/;
    return phoneRegex.test(value.replace(/\s/g, ''));
  },

  isStrongPassword: (value) => {
    // At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special char
    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return strongPasswordRegex.test(value);
  },

  isFutureDate: (value) => {
    return new Date(value) > new Date();
  },

  isPastDate: (value) => {
    return new Date(value) < new Date();
  }
};

module.exports = {
  userValidators,
  paymentValidators,
  notificationValidators,
  contributionValidators,
  otpValidators,
  queryValidators,
  paramValidators,
  fileValidators,
  customValidators
};
