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

    // Verify Firebase ID token
    const decoded = await admin.auth().verifyIdToken(idToken, true);

    // Find or upsert local user by firebase uid
    const { uid, email, phone_number, name, picture } = decoded;
    let userQuery = await db.query(
      'SELECT id, firebase_uid, full_name, username, email, phone_number, role, is_active, is_deleted FROM users WHERE firebase_uid = $1',
      [uid]
    );

    if (userQuery.rows.length === 0) {
      // Create a lightweight local user record if not exists
      const base = (email || phone_number || uid || '').toString();
      const safe = base.replace(/[^a-zA-Z0-9._-]/g, '');
      const mkUsername = (seed) => {
        if (!seed) return `user_${uid.substring(0, 12)}`;
        if (seed.length <= 50) return seed;
        // Keep both prefix and suffix to minimize collisions
        return `${seed.substring(0, 30)}-${seed.substring(seed.length - 10)}`;
      };
      let username = mkUsername(safe);
      let attempt = 0;
      while (attempt < 3) {
        try {
          const insert = await db.query(
            `INSERT INTO users (firebase_uid, full_name, username, email, phone_number, is_active)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, firebase_uid, full_name, username, email, phone_number, role, is_active, is_deleted`,
            [uid, name || null, username, email || null, phone_number || null, true]
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
