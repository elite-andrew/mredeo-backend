const jwt = require('jsonwebtoken');
const config = require('../config/environment');
const db = require('../config/database');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Access token required' 
      });
    }

    const decoded = jwt.verify(token, config.jwt.secret);
    
    // Verify user still exists and is active
    const userQuery = await db.query(
      'SELECT id, username, email, role, is_active, is_deleted FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (userQuery.rows.length === 0 || !userQuery.rows[0].is_active || userQuery.rows[0].is_deleted) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid or expired token' 
      });
    }

    req.user = userQuery.rows[0];
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token' 
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Token expired' 
      });
    }
    
    console.error('Auth middleware error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
};

const generateTokens = (userId, role) => {
  const accessToken = jwt.sign(
    { userId, role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
  
  const refreshToken = jwt.sign(
    { userId, type: 'refresh' },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiresIn }
  );
  
  return { accessToken, refreshToken };
};

const refreshAccessToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token required'
      });
    }

    const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);
    
    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    const userQuery = await db.query(
      'SELECT id, role, is_active, is_deleted FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (userQuery.rows.length === 0 || !userQuery.rows[0].is_active || userQuery.rows[0].is_deleted) {
      return res.status(401).json({
        success: false,
        message: 'User no longer valid'
      });
    }

    const user = userQuery.rows[0];
    const tokens = generateTokens(user.id, user.role);

    res.json({
      success: true,
      data: tokens
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    return res.status(401).json({
      success: false,
      message: 'Invalid refresh token'
    });
  }
};

module.exports = {
  authenticateToken,
  generateTokens,
  refreshAccessToken
};
