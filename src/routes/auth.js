const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const { auditMiddleware } = require('../middleware/audit');
const { RobustAuthService } = require('../services/authService');
const db = require('../config/database');

// All authentication is handled by Firebase client SDK.
// This backend exposes only protected endpoints that require a valid Firebase ID token.

// Introspection: get current user
router.get('/me', authenticateToken, (req, res) => {
  const { firebase, ...user } = req.user || {};
  res.json({ success: true, data: { user, firebaseClaims: firebase || {} } });
});

// Session validation endpoint for role consistency
router.get('/validate-session', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get authoritative role from database
    const userQuery = await db.query(
      'SELECT role, is_active, is_deleted FROM users WHERE id = $1',
      [userId]
    );
    
    if (userQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const dbUser = userQuery.rows[0];
    
    if (!dbUser.is_active || dbUser.is_deleted) {
      return res.status(403).json({
        success: false,
        message: 'User account is inactive'
      });
    }
    
    // Check for role inconsistency
    const roleConsistent = req.user.role === dbUser.role;
    
    res.json({
      success: true,
      data: {
        authoritative_role: dbUser.role,
        token_role: req.user.role,
        role_consistent: roleConsistent,
        is_active: dbUser.is_active,
        session_id: req.sessionId,
        user_id: userId
      }
    });
  } catch (error) {
    console.error('Session validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Session validation failed'
    });
  }
});

// Enhanced logout endpoint with comprehensive session cleanup
router.post('/logout', 
  authenticateToken, 
  auditMiddleware.userLogout, 
  async (req, res) => {
    try {
      const userId = req.user?.id;
      const sessionId = req.sessionId || req.headers['x-session-id'];
      const terminateAllSessions = req.body?.terminateAllSessions === true;
      
      console.log(`🔄 Logout initiated for user ${userId}, session ${sessionId}`);
      
      let terminatedCount = 0;
      
      if (sessionId) {
        // Terminate specific session
        const terminated = await RobustAuthService.terminateSession(sessionId, 'LOGOUT');
        if (terminated) terminatedCount++;
        console.log(`🔒 Session terminated: ${sessionId}, success: ${terminated}`);
      }
      
      if (terminateAllSessions && userId) {
        // Terminate all other sessions for this user
        const additionalTerminated = await RobustAuthService.terminateAllUserSessions(
          userId, 
          sessionId, // Exclude current session (already terminated above)
          'LOGOUT_ALL'
        );
        terminatedCount += additionalTerminated;
        console.log(`🔒 Terminated ${additionalTerminated} additional sessions for user ${userId}`);
      }
      
      res.json({
        success: true,
        message: 'Logged out successfully',
        sessionTerminated: sessionId ? true : false,
        totalSessionsTerminated: terminatedCount
      });
    } catch (error) {
      console.error('❌ Logout error:', error);
      res.status(500).json({
        success: false,
        message: 'Logout failed',
        error: error.message
      });
    }
  }
);

module.exports = router;
