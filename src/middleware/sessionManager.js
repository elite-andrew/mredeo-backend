const admin = require('../config/firebase');

// In-memory session tracking (for production, use Redis or database)
const activeSessions = new Map(); // firebase_uid -> { tokenId, timestamp, deviceInfo }

/**
 * Tracks active sessions and invalidates old ones when new login occurs
 */
const trackSession = async (req, res, next) => {
  try {
    if (!req.user || !req.user.firebase) {
      return next();
    }

    const { uid } = req.user.firebase;
    const tokenId = req.headers['authorization']?.substring(7); // Remove 'Bearer '
    const deviceInfo = req.headers['user-agent'] || 'unknown';
    const currentTime = Date.now();

    // Check if user already has an active session
    const existingSession = activeSessions.get(uid);
    
    if (existingSession && existingSession.tokenId !== tokenId) {
      console.log(`🔄 Session invalidation for user ${uid}: New login detected`);
      
      // Try to revoke the old token (if possible)
      try {
        await admin.auth().revokeRefreshTokens(uid);
        console.log(`🔒 Revoked refresh tokens for user ${uid}`);
      } catch (error) {
        console.warn(`⚠️ Could not revoke refresh tokens for user ${uid}:`, error.message);
      }
    }

    // Update or create session tracking
    activeSessions.set(uid, {
      tokenId,
      timestamp: currentTime,
      deviceInfo,
      userId: req.user.id,
      email: req.user.email
    });

    // Clean up old sessions (older than 24 hours)
    for (const [sessionUid, session] of activeSessions.entries()) {
      if (currentTime - session.timestamp > 24 * 60 * 60 * 1000) {
        activeSessions.delete(sessionUid);
      }
    }

    next();
  } catch (error) {
    console.error('Session tracking error:', error);
    next(); // Continue even if session tracking fails
  }
};

/**
 * Explicitly invalidate a user's session
 */
const invalidateSession = async (req, res) => {
  try {
    const { uid } = req.user.firebase;
    
    // Remove from active sessions
    activeSessions.delete(uid);
    
    // Revoke Firebase refresh tokens
    await admin.auth().revokeRefreshTokens(uid);
    
    console.log(`🔒 Session invalidated for user ${uid}`);
    
    res.json({
      success: true,
      message: 'Session invalidated successfully'
    });
  } catch (error) {
    console.error('Session invalidation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to invalidate session'
    });
  }
};

/**
 * Get active session info
 */
const getSessionInfo = (req, res) => {
  try {
    const { uid } = req.user.firebase;
    const session = activeSessions.get(uid);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'No active session found'
      });
    }
    
    res.json({
      success: true,
      data: {
        userId: session.userId,
        email: session.email,
        deviceInfo: session.deviceInfo,
        loginTime: new Date(session.timestamp).toISOString(),
        isActive: true
      }
    });
  } catch (error) {
    console.error('Get session info error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get session info'
    });
  }
};

/**
 * Check if user has multiple active sessions (for debugging)
 */
const checkMultipleSessions = (req, res) => {
  try {
    const sessions = Array.from(activeSessions.entries()).map(([uid, session]) => ({
      uid,
      userId: session.userId,
      email: session.email,
      deviceInfo: session.deviceInfo,
      loginTime: new Date(session.timestamp).toISOString()
    }));
    
    res.json({
      success: true,
      data: {
        totalSessions: sessions.length,
        sessions
      }
    });
  } catch (error) {
    console.error('Check multiple sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check sessions'
    });
  }
};

module.exports = {
  trackSession,
  invalidateSession,
  getSessionInfo,
  checkMultipleSessions,
  activeSessions // Export for testing
};
