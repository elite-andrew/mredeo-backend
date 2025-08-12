const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const { auditMiddleware } = require('../middleware/audit');

// All authentication is handled by Firebase client SDK.
// This backend exposes only protected endpoints that require a valid Firebase ID token.

// Introspection: get current user
router.get('/me', authenticateToken, (req, res) => {
  const { firebase, ...user } = req.user || {};
  res.json({ success: true, data: { user, firebaseClaims: firebase || {} } });
});

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
