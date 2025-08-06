const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken, refreshAccessToken } = require('../middleware/auth');
const { 
  validateSignup, 
  validateLogin, 
  validateOTP, 
  validatePasswordReset 
} = require('../middleware/validation');
const { authLimiter, otpLimiter } = require('../middleware/rateLimiter');
const { auditMiddleware } = require('../middleware/audit');

// Public routes with rate limiting
router.post('/signup', 
  authLimiter, 
  validateSignup, 
  auditMiddleware.userSignup, 
  authController.signup
);

router.post('/verify-otp', 
  otpLimiter, 
  validateOTP, 
  authController.verifyOTP
);

router.post('/login', 
  authLimiter, 
  validateLogin, 
  auditMiddleware.userLogin, 
  authController.login
);

router.post('/forgot-password', 
  authLimiter, 
  authController.forgotPassword
);

router.post('/reset-password', 
  authLimiter, 
  validatePasswordReset, 
  auditMiddleware.passwordReset, 
  authController.resetPassword
);

router.post('/refresh-token', refreshAccessToken);

// Protected routes
router.post('/logout', 
  authenticateToken, 
  auditMiddleware.userLogout, 
  (req, res) => {
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  }
);

module.exports = router;
