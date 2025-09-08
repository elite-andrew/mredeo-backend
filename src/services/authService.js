const crypto = require('crypto');
const admin = require('../config/firebase');
const db = require('../config/database');

// Generate UUID using crypto for compatibility
const generateUUID = () => {
  return crypto.randomUUID();
};

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const generateSecureToken = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

// Deprecated: Passwords are managed by Firebase Authentication
const hashPassword = async () => {
  throw new Error('hashPassword is deprecated. Use Firebase Authentication.');
};

const verifyPassword = async () => {
  throw new Error('verifyPassword is deprecated. Use Firebase Authentication.');
};

/**
 * Enhanced Robust Authentication Service
 * Provides atomic token verification, user resolution, and session management
 */
class RobustAuthService {
  /**
   * Atomically verify Firebase token and resolve user with improved error handling
   */
  static async verifyTokenAndResolveUser(idToken) {
    if (!idToken) {
      throw new Error('ID_TOKEN_REQUIRED');
    }

    try {
      // Step 1: Verify Firebase token with enhanced retry logic
      let decoded;
      let retries = 3;
      const retryDelay = 1000; // 1 second
      
      while (retries > 0) {
        try {
          // Force refresh token verification to catch revoked tokens
          decoded = await admin.auth().verifyIdToken(idToken, true);
          console.log(`✅ Firebase token verified for UID: ${decoded.uid}`);
          break;
        } catch (error) {
          console.error(`🔥 Firebase token verification error (attempt ${4 - retries}):`, error.code, error.message);
          
          if (error.code === 'auth/id-token-revoked') {
            throw new Error('SESSION_INVALIDATED');
          }
          if (error.code === 'auth/id-token-expired') {
            throw new Error('TOKEN_EXPIRED');
          }
          if (error.code === 'auth/argument-error' || error.code === 'auth/invalid-id-token') {
            throw new Error('INVALID_TOKEN');
          }
          
          // Retry on network errors or server issues
          if ((error.code === 'app/network-error' || 
               error.code === 'auth/internal-error' ||
               error.message?.includes('network')) && retries > 1) {
            console.log(`🔄 Retrying Firebase verification... (${retries - 1} attempts left)`);
            retries--;
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          }
          
          throw error;
        }
      }

      // Step 2: Resolve user atomically with transaction
      const { uid, email, phone_number, name, email_verified, phone_verified } = decoded;
      console.log(`🔍 Resolving user for UID: ${uid}, Email: ${email}`);
      
      const client = await db.connect();
      try {
        await client.query('BEGIN');
        
        let userQuery = await client.query(
          'SELECT id, firebase_uid, full_name, username, email, phone_number, role, is_active, is_deleted, last_login_at FROM users WHERE firebase_uid = $1',
          [uid]
        );

        if (userQuery.rows.length === 0) {
          console.log(`🆕 Creating new user for Firebase UID: ${uid}`);
          
          // Create user if not exists
          const derivedName = (name && String(name).trim().length > 0)
            ? String(name).trim()
            : 'Unknown User';
          const fullName = String(derivedName).substring(0, 100);
          
          let baseUsername = fullName.toLowerCase()
            .trim()
            .replace(/\s+/g, '_')
            .replace(/[^a-zA-Z0-9._-]/g, '');
          
          if (!baseUsername || baseUsername.length < 2) {
            baseUsername = `user_${uid.substring(0, 8)}`;
          }
          
          const mkUsername = (seed) => {
            if (!seed) return `user_${uid.substring(0, 12)}`;
            if (seed.length <= 50) return seed;
            return `${seed.substring(0, 30)}-${seed.substring(seed.length - 10)}`;
          };
          
          let username = mkUsername(baseUsername);
          let attempt = 0;
          
          while (attempt < 3) {
            try {
              const insert = await client.query(
                `INSERT INTO users (firebase_uid, full_name, username, email, phone_number, is_active, last_login_at, login_count)
                 VALUES ($1, $2, $3, $4, $5, $6, NOW(), 1)
                 RETURNING id, firebase_uid, full_name, username, email, phone_number, role, is_active, is_deleted, last_login_at`,
                [uid, fullName, username, email || null, phone_number || null, true]
              );
              userQuery = { rows: [insert.rows[0]] };
              console.log(`✅ User created with ID: ${userQuery.rows[0].id}`);
              break;
            } catch (e) {
              if (e.code === '23505' && /users_username_key/.test(e.detail || '')) {
                attempt++;
                username = mkUsername(`${baseUsername}_${Math.random().toString(36).slice(2, 6)}`);
                continue;
              }
              throw e;
            }
          }
        } else {
          // Update last login for existing user
          await client.query(
            'UPDATE users SET last_login_at = NOW(), login_count = login_count + 1 WHERE id = $1',
            [userQuery.rows[0].id]
          );
          console.log(`✅ Updated login info for user ID: ${userQuery.rows[0].id}`);
        }

        await client.query('COMMIT');
        const user = userQuery.rows[0];
        
        if (!user.is_active || user.is_deleted) {
          throw new Error('USER_INACTIVE_OR_DELETED');
        }

        return {
          user: { ...user, firebase: decoded },
          firebaseData: decoded
        };
        
      } catch (dbError) {
        await client.query('ROLLBACK');
        throw dbError;
      } finally {
        client.release();
      }
      
    } catch (error) {
      console.error('❌ Token verification and user resolution failed:', error);
      throw error;
    }
  }

  /**
   * Create a new session for authenticated user with enhanced validation
   */
  static async createSession(userId, firebaseUid, idToken, ipAddress, userAgent) {
    try {
      const sessionId = generateUUID();
      const client = await db.connect();
      
      try {
        await client.query('BEGIN');
        
        // Terminate any existing active sessions for this user/device combination
        await client.query(
          `UPDATE user_sessions 
           SET is_active = false, ended_at = NOW(), end_reason = 'NEW_LOGIN'
           WHERE user_id = $1 AND firebase_uid = $2 AND is_active = true`,
          [userId, firebaseUid]
        );
        
        // Create new session
        await client.query(
          `INSERT INTO user_sessions (
            session_id, user_id, firebase_uid, 
            ip_address, user_agent, device_info, created_at, last_activity, expires_at, is_active
          ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), NOW() + INTERVAL '7 days', true)`,
          [sessionId, userId, firebaseUid, ipAddress, userAgent, `User-Agent: ${userAgent}`]
        );
        
        await client.query('COMMIT');
        console.log(`✅ Session created: ${sessionId} for user ${userId}`);
        return sessionId;
        
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
      
    } catch (error) {
      console.error('❌ Session creation failed:', error);
      throw new Error('SESSION_CREATION_FAILED');
    }
  }

  /**
   * Enhanced session validation with proper cleanup
   */
  static async validateSession(sessionId, idToken) {
    try {
      if (!sessionId) {
        return { valid: false, reason: 'MISSING_SESSION_ID' };
      }

      const client = await db.connect();
      try {
        await client.query('BEGIN');
        
        // Clean up any expired sessions first
        await client.query(
          `UPDATE user_sessions 
           SET is_active = false, ended_at = NOW(), end_reason = 'EXPIRED'
           WHERE is_active = true AND expires_at < NOW()`
        );

        const sessionQuery = await client.query(
          `SELECT s.*, u.is_active as user_active, u.is_deleted, u.firebase_uid as user_firebase_uid
           FROM user_sessions s 
           JOIN users u ON s.user_id = u.id 
           WHERE s.session_id = $1 AND s.is_active = true AND s.expires_at > NOW()`,
          [sessionId]
        );

        if (sessionQuery.rows.length === 0) {
          await client.query('COMMIT');
          return { valid: false, reason: 'SESSION_NOT_FOUND_OR_EXPIRED' };
        }

        const session = sessionQuery.rows[0];
        
        if (!session.user_active || session.is_deleted) {
          // Mark session as invalid due to user status
          await client.query(
            'UPDATE user_sessions SET is_active = false, ended_at = NOW(), end_reason = $2 WHERE session_id = $1',
            [sessionId, 'USER_INACTIVE']
          );
          await client.query('COMMIT');
          return { valid: false, reason: 'USER_INACTIVE' };
        }

        // Update last activity and extend session
        await client.query(
          'UPDATE user_sessions SET last_activity = NOW(), expires_at = NOW() + INTERVAL \'7 days\' WHERE session_id = $1',
          [sessionId]
        );

        await client.query('COMMIT');
        console.log(`✅ Session validated and refreshed: ${sessionId}`);
        return { valid: true, session };
        
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
      
    } catch (error) {
      console.error('❌ Session validation failed:', error);
      return { valid: false, reason: 'VALIDATION_ERROR' };
    }
  }

  /**
   * Clean up expired sessions with better performance
   */
  static async cleanupExpiredSessions() {
    try {
      const result = await db.query(
        `UPDATE user_sessions 
         SET is_active = false, ended_at = NOW(), end_reason = 'EXPIRED'
         WHERE (expires_at < NOW() OR last_activity < NOW() - INTERVAL '30 days')
         AND is_active = true`
      );
      
      console.log(`🧹 Cleaned up ${result.rowCount} expired sessions`);
      return result.rowCount;
    } catch (error) {
      console.error('❌ Session cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Terminate specific session with proper cleanup
   */
  static async terminateSession(sessionId, reason = 'LOGOUT') {
    try {
      const result = await db.query(
        'UPDATE user_sessions SET is_active = false, ended_at = NOW(), end_reason = $2 WHERE session_id = $1',
        [sessionId, reason]
      );
      
      const terminated = result.rowCount > 0;
      if (terminated) {
        console.log(`✅ Session terminated: ${sessionId} (reason: ${reason})`);
      } else {
        console.log(`⚠️ Session not found for termination: ${sessionId}`);
      }
      return terminated;
    } catch (error) {
      console.error('❌ Session termination failed:', error);
      return false;
    }
  }

  /**
   * Terminate all sessions for a user with transaction safety
   */
  static async terminateAllUserSessions(userId, excludeSessionId = null, reason = 'LOGOUT_ALL') {
    try {
      let query = 'UPDATE user_sessions SET is_active = false, ended_at = NOW(), end_reason = $2 WHERE user_id = $1 AND is_active = true';
      let params = [userId, reason];
      
      if (excludeSessionId) {
        query += ' AND session_id != $3';
        params.push(excludeSessionId);
      }
      
      const result = await db.query(query, params);
      console.log(`✅ Terminated ${result.rowCount} sessions for user ${userId}`);
      return result.rowCount;
    } catch (error) {
      console.error('❌ User session termination failed:', error);
      return 0;
    }
  }

  /**
   * Get active session count for user
   */
  static async getActiveSessionCount(userId) {
    try {
      const result = await db.query(
        'SELECT COUNT(*) as count FROM user_sessions WHERE user_id = $1 AND is_active = true AND expires_at > NOW()',
        [userId]
      );
      return parseInt(result.rows[0].count);
    } catch (error) {
      console.error('❌ Failed to get session count:', error);
      return 0;
    }
  }
}

module.exports = {
  generateOTP,
  generateSecureToken,
  hashPassword,
  verifyPassword,
  RobustAuthService
};
