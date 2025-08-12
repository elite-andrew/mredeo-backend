const { body, param, query, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

const validateSignup = [
  body('full_name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be 2-100 characters'),
  body('username')
    .trim()
    .isLength({ min: 3, max: 50 })
    .isAlphanumeric()
    .withMessage('Username must be 3-50 alphanumeric characters'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email required'),
  body('phone_number')
    .optional()
    .isMobilePhone()
    .withMessage('Valid phone number required'),
  body('password')
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must be at least 8 characters with uppercase, lowercase, number, and special character'),
  // Custom validation to ensure either email or phone is provided
  body().custom((value, { req }) => {
    if (!req.body.email && !req.body.phone_number) {
      throw new Error('Either email or phone number must be provided');
    }
    return true;
  }),
  handleValidationErrors
];

const validateLogin = [
  body('identifier')
    .notEmpty()
    .withMessage('Phone number or email required')
    .custom(value => {
      // Check if it's either an email or phone number format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const phoneRegex = /^\+?[1-9]\d{1,14}$/;
      
      if (!emailRegex.test(value) && !phoneRegex.test(value)) {
        throw new Error('Identifier must be a valid email or phone number');
      }
      return true;
    }),
  body('password')
    .notEmpty()
    .withMessage('Password required'),
  handleValidationErrors
];

const validateOTP = [
  body('otp_code')
    .isLength({ min: 6, max: 6 })
    .isNumeric()
    .withMessage('OTP must be 6 digits'),
  body('identifier')
    .notEmpty()
    .withMessage('Phone number or email required')
    .custom(value => {
      // Check if it's either an email or phone number format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const phoneRegex = /^\+?[1-9]\d{1,14}$/;
      
      if (!emailRegex.test(value) && !phoneRegex.test(value)) {
        throw new Error('Identifier must be a valid email or phone number');
      }
      return true;
    }),
  handleValidationErrors
];

const validatePasswordReset = [
  body('new_password')
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must be at least 8 characters with uppercase, lowercase, number, and special character'),
  body('otp_code')
    .isLength({ min: 6, max: 6 })
    .isNumeric()
    .withMessage('OTP must be 6 digits'),
  handleValidationErrors
];

const validatePayment = [
  body('contribution_type_id')
    .isUUID()
    .withMessage('Valid contribution type ID required'),
  body('amount_paid')
    .isNumeric()
    .withMessage('Valid amount required'),
  body('telco')
    .isIn(['vodacom', 'tigo', 'airtel', 'halotel', 'zantel', 'other'])
    .withMessage('Valid telco provider required'),
  body('phone_number_used')
    .isMobilePhone()
    .withMessage('Valid phone number required'),
  handleValidationErrors
];

const validateNotification = [
  body('title')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Title must be 1-100 characters'),
  body('message')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Message must be 1-1000 characters'),
  handleValidationErrors
];

const validateProfileUpdate = [
  body('full_name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be 2-100 characters'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email required'),
  handleValidationErrors
];

module.exports = {
  validateSignup,
  validateLogin,
  validateOTP,
  validatePasswordReset,
  validatePayment,
  validateNotification,
  validateProfileUpdate,
  handleValidationErrors
};
