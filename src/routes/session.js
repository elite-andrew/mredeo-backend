const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { invalidateSession, getSessionInfo, checkMultipleSessions } = require('../middleware/sessionManager');
const { RobustAuthService } = require('../services/authService');

// All session routes require authentication
router.use(authenticateToken);

// Invalidate current session
router.post('/invalidate', invalidateSession);

// Get current session info
router.get('/info', getSessionInfo);

// Check all active sessions (admin/debugging)
router.get('/all', checkMultipleSessions);

// Enhanced logout with comprehensive session cleanup
router.post('/logout', async (req, res) => {
  try {
    // Get session ID from request (prioritize header, fallback to middleware-set value)
    const sessionId = req.headers['x-session-id'] || req.sessionId;
    const userId = req.user?.id;
    
    console.log(`🔄 Logout initiated for user ${userId}, session ${sessionId}`);
    
    if (sessionId) {
      // Terminate specific session
      const terminated = await RobustAuthService.terminateSession(sessionId, 'LOGOUT');
      console.log(`🔒 Session terminated: ${sessionId}, success: ${terminated}`);
    }
    
    if (userId) {
      // Also terminate any other active sessions for this user if requested
      const terminateAll = req.body?.terminateAllSessions === true;
      if (terminateAll) {
        const terminatedCount = await RobustAuthService.terminateAllUserSessions(userId, sessionId, 'LOGOUT_ALL');
        console.log(`🔒 Terminated ${terminatedCount} additional sessions for user ${userId}`);
      }
    }
    
    // Legacy session invalidation for backward compatibility
    try {
      await invalidateSession(req, res, () => {});
    } catch (legacyError) {
      console.warn('⚠️ Legacy session invalidation failed:', legacyError);
    }
    
    res.json({
      success: true,
      message: 'Logout successful',
      sessionTerminated: sessionId ? true : false
    });
  } catch (error) {
    console.error('❌ Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed',
      error: error.message
    });
  }
});

// Get robust session information
router.get('/session-info', async (req, res) => {
  try {
    const sessionId = req.sessionId || req.headers['x-session-id'];
    
    if (!sessionId) {
      return res.json({
        success: true,
        message: 'No active robust session',
        session: null
      });
    }

    // Get session details from database
    const db = require('../config/database');
    const sessionQuery = await db.query(
      `SELECT session_id, user_id, created_at, last_activity, ip_address, user_agent
       FROM user_sessions 
       WHERE session_id = $1 AND is_active = true`,
      [sessionId]
    );

    if (sessionQuery.rows.length === 0) {
      return res.json({
        success: true,
        message: 'Session not found or expired',
        session: null
      });
    }

    const session = sessionQuery.rows[0];
    res.json({
      success: true,
      message: 'Session information retrieved',
      session: {
        sessionId: session.session_id,
        userId: session.user_id,
        createdAt: session.created_at,
        lastActivity: session.last_activity,
        ipAddress: session.ip_address,
        userAgent: session.user_agent
      }
    });
  } catch (error) {
    console.error('Session info error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get session information'
    });
  }
});

// Cleanup expired sessions (admin endpoint)
router.post('/cleanup', async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user || req.user.role !== 'admin_chairperson') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const cleanedCount = await RobustAuthService.cleanupExpiredSessions();
    
    res.json({
      success: true,
      message: 'Session cleanup completed',
      cleanedSessions: cleanedCount
    });
  } catch (error) {
    console.error('Session cleanup error:', error);
    res.status(500).json({
      success: false,
      message: 'Session cleanup failed'
    });
  }
});

// Terminate all sessions for current user
router.post('/terminate-all', async (req, res) => {
  try {
    const userId = req.user.id;
    const terminatedCount = await RobustAuthService.terminateAllUserSessions(userId);
    
    res.json({
      success: true,
      message: 'All sessions terminated',
      terminatedSessions: terminatedCount
    });
  } catch (error) {
    console.error('Session termination error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to terminate sessions'
    });
  }
});

// Refresh session (update last activity)
router.post('/refresh', async (req, res) => {
  try {
    const sessionId = req.sessionId || req.headers['x-session-id'];
    
    if (!sessionId) {
      return res.json({
        success: true,
        message: 'No session to refresh'
      });
    }

    // Session activity is automatically updated in the auth middleware
    // This endpoint just confirms the session is still valid
    res.json({
      success: true,
      message: 'Session refreshed',
      sessionId: sessionId
    });
  } catch (error) {
    console.error('Session refresh error:', error);
    res.status(500).json({
      success: false,
      message: 'Session refresh failed'
    });
  }
});

module.exports = router;
