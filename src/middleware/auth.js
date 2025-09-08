const admin = require('../config/firebase');
const db = require('../config/database');
const { trackSession } = require('./sessionManager');
const { RobustAuthService } = require('../services/authService');

// Enhanced robust authentication middleware with proper session handling
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    const idToken = authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : null;

    if (!idToken) {
      return res.status(401).json({ 
        success: false, 
        message: 'Access token required',
        code: 'TOKEN_REQUIRED'
      });
    }

    // Get session ID from headers
    const sessionId = req.headers['x-session-id'];

    try {
      // Use robust authentication service for atomic verification
      const { user, firebaseData } = await RobustAuthService.verifyTokenAndResolveUser(idToken);
      
      console.log(`🔍 Robust Auth - User ID: ${user.id}, Email: ${user.email}, Role: ${user.role}`);
      console.log(`🔍 Firebase Data - UID: ${firebaseData.uid}, Email: ${firebaseData.email}`);

      // Validate existing session if session ID is provided
      if (sessionId) {
        const sessionValidation = await RobustAuthService.validateSession(sessionId, idToken);
        if (!sessionValidation.valid) {
          console.log(`❌ Session validation failed: ${sessionValidation.reason}`);
          
          // If session is invalid, create a new one automatically
          if (sessionValidation.reason === 'SESSION_NOT_FOUND_OR_EXPIRED') {
            console.log(`🔄 Creating new session to replace expired one`);
          } else {
            return res.status(401).json({
              success: false,
              message: 'Invalid session',
              code: 'SESSION_INVALID',
              reason: sessionValidation.reason
            });
          }
        } else {
          console.log(`✅ Session validated and refreshed: ${sessionId}`);
          req.sessionId = sessionId;
        }
      }

      // Create new session if none provided or previous was invalid
      if (!req.sessionId) {
        const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
        const userAgent = req.headers['user-agent'] || 'unknown';
        
        try {
          const newSessionId = await RobustAuthService.createSession(
            user.id, 
            firebaseData.uid, 
            idToken, 
            ipAddress, 
            userAgent
          );
          
          // Add session ID to response headers for client to use
          res.set('X-Session-Id', newSessionId);
          req.sessionId = newSessionId;
          console.log(`🆕 Created new session: ${newSessionId}`);
        } catch (sessionError) {
          console.warn('⚠️ Failed to create session, continuing without session tracking:', sessionError);
        }
      }

      // Set request context
      req.user = user;
      req.firebaseData = firebaseData;
      
      // Track session for legacy compatibility
      await trackSession(req, res, () => {});
      
      next();
    } catch (authError) {
      console.error('❌ Robust authentication failed:', authError);
      
      // Handle specific authentication errors with proper codes
      switch (authError.message) {
        case 'SESSION_INVALIDATED':
          return res.status(401).json({
            success: false,
            message: 'Session invalidated - please login again',
            code: 'SESSION_INVALIDATED',
            action: 'REQUIRE_LOGIN'
          });
        case 'TOKEN_EXPIRED':
          return res.status(401).json({
            success: false,
            message: 'Token expired - please refresh',
            code: 'TOKEN_EXPIRED',
            action: 'REFRESH_TOKEN'
          });
        case 'INVALID_TOKEN':
          return res.status(401).json({
            success: false,
            message: 'Invalid token format',
            code: 'INVALID_TOKEN',
            action: 'REQUIRE_LOGIN'
          });
        case 'USER_INACTIVE_OR_DELETED':
          return res.status(403).json({
            success: false,
            message: 'User account is inactive or deleted',
            code: 'USER_FORBIDDEN',
            action: 'CONTACT_ADMIN'
          });
        case 'ID_TOKEN_REQUIRED':
          return res.status(401).json({
            success: false,
            message: 'Access token required',
            code: 'TOKEN_REQUIRED',
            action: 'REQUIRE_LOGIN'
          });
        default:
          return res.status(401).json({
            success: false,
            message: 'Authentication failed',
            code: 'AUTH_FAILED',
            action: 'REQUIRE_LOGIN'
          });
      }
    }
  } catch (error) {
    console.error('❌ Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal authentication error',
      code: 'AUTH_INTERNAL_ERROR'
    });
  }
};

// Legacy authenticateToken for backward compatibility
const legacyAuthenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    const idToken = authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : null;

    if (!idToken) {
      return res.status(401).json({ success: false, message: 'Access token required' });
    }

    // Verify Firebase ID token with retry logic
    let decoded;
    let retries = 3;
    while (retries > 0) {
      try {
        decoded = await admin.auth().verifyIdToken(idToken, true);
        break;
      } catch (error) {
        // Handle specific Firebase auth errors
        if (error.code === 'auth/id-token-revoked') {
          console.log('🔒 Firebase ID token has been revoked - session invalidated');
          return res.status(401).json({ 
            success: false, 
            message: 'Session invalidated',
            code: 'SESSION_INVALIDATED'
          });
        }
        if (error.code === 'auth/id-token-expired') {
          console.log('⏰ Firebase ID token has expired');
          return res.status(401).json({ 
            success: false, 
            message: 'Token expired',
            code: 'TOKEN_EXPIRED'
          });
        }
        if (error.code === 'app/network-error' && retries > 1) {
          console.log(`Firebase network error, retrying... (${retries - 1} attempts left)`);
          retries--;
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
          continue;
        }
        throw error;
      }
    }

    // Find or upsert local user by firebase uid
    const { uid, email, phone_number, name, picture } = decoded;
    console.log(`🔍 Auth Middleware Debug - Firebase UID: ${uid}, Email: ${email}`);
    
    let userQuery = await db.query(
      'SELECT id, firebase_uid, full_name, username, email, phone_number, role, is_active, is_deleted FROM users WHERE firebase_uid = $1',
      [uid]
    );

    console.log(`🔍 Database Query Result - Found ${userQuery.rows.length} users for UID: ${uid}`);
    if (userQuery.rows.length > 0) {
      const user = userQuery.rows[0];
      console.log(`🔍 Found User - ID: ${user.id}, Email: ${user.email}, Role: ${user.role}`);
      console.log(`🔍 Database UID check: Expected=${uid}, Found=${user.firebase_uid}, Match=${user.firebase_uid === uid}`);
    } else {
      console.log(`⚠️ No user found in database for Firebase UID: ${uid}`);
    }

    if (userQuery.rows.length === 0) {
      // Create a lightweight local user record if not exists
      // Full name is required during signup, so we can rely on it
      const derivedName = (name && String(name).trim().length > 0)
        ? String(name).trim()
        : 'Unknown User'; // This should rarely happen since full name is required
      const fullName = String(derivedName).substring(0, 100);
      
      // Generate username from full name: "John Doe" -> "john_doe"
      let baseUsername = fullName.toLowerCase()
        .trim()
        .replace(/\s+/g, '_')  // Replace spaces with underscores
        .replace(/[^a-zA-Z0-9._-]/g, ''); // Remove special characters except ._-
      
      // Ensure username is not empty
      if (!baseUsername || baseUsername.length < 2) {
        baseUsername = `user_${uid.substring(0, 8)}`;
      }
      
      const mkUsername = (seed) => {
        if (!seed) return `user_${uid.substring(0, 12)}`;
        if (seed.length <= 50) return seed;
        // Keep both prefix and suffix to minimize collisions
        return `${seed.substring(0, 30)}-${seed.substring(seed.length - 10)}`;
      };
      let username = mkUsername(baseUsername);
      
      let attempt = 0;
      while (attempt < 3) {
        try {
          const insert = await db.query(
            `INSERT INTO users (firebase_uid, full_name, username, email, phone_number, is_active)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, firebase_uid, full_name, username, email, phone_number, role, is_active, is_deleted`,
            [uid, fullName, username, email || null, phone_number || null, true]
          );
          userQuery = { rows: [insert.rows[0]] };
          break;
        } catch (e) {
          // If username uniqueness fails, tweak and retry
          if (e.code === '23505' && /users_username_key/.test(e.detail || '')) {
            attempt++;
            username = mkUsername(`${baseUsername}_${Math.random().toString(36).slice(2, 6)}`);
            continue;
          }
          throw e;
        }
      }
    }

    const user = userQuery.rows[0];
    if (!user.is_active || user.is_deleted) {
      return res.status(403).json({ success: false, message: 'User is inactive or deleted' });
    }

    req.user = { ...user, firebase: decoded };
    
    // Track session and handle session invalidation
    console.log(`🔄 Setting req.user: ID=${user.id}, Email=${user.email}, Firebase UID=${decoded.uid}`);
    await trackSession(req, res, () => {});
    
    next();
  } catch (error) {
    const msg = error?.code === 'auth/id-token-expired' ? 'Token expired' : 'Invalid token';
    const status = error?.code === 'auth/id-token-expired' ? 401 : 401;
    console.error('Auth middleware error:', error);
    return res.status(status).json({ success: false, message: msg });
  }
};

module.exports = { 
  authenticateToken,
  legacyAuthenticateToken 
};
