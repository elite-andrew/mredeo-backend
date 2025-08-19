const admin = require('../config/firebase');
const db = require('../config/database');

// Verifies Firebase ID token from Authorization: Bearer <token>
const authenticateToken = async (req, res, next) => {
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
    let userQuery = await db.query(
      'SELECT id, firebase_uid, full_name, username, email, phone_number, role, is_active, is_deleted FROM users WHERE firebase_uid = $1',
      [uid]
    );

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
            username = mkUsername(`${safe}_${Math.random().toString(36).slice(2, 6)}`);
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
    next();
  } catch (error) {
    const msg = error?.code === 'auth/id-token-expired' ? 'Token expired' : 'Invalid token';
    const status = error?.code === 'auth/id-token-expired' ? 401 : 401;
    console.error('Auth middleware error:', error);
    return res.status(status).json({ success: false, message: msg });
  }
};

module.exports = { authenticateToken };
