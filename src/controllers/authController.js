const bcrypt = require('bcrypt');
const db = require('../config/database');
const config = require('../config/environment');
const { generateTokens } = require('../middleware/auth');
const authService = require('../services/authService');
const smsService = require('../services/smsService');

const signup = async (req, res) => {
  try {
    const { full_name, username, email, phone_number, password } = req.body;

    // Check if user already exists
    const existingUser = await db.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2 OR phone_number = $3',
      [username, email, phone_number]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'User with this username, email, or phone number already exists'
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, config.security.bcryptRounds);

    // Create user
    const userResult = await db.query(
      `INSERT INTO users (full_name, username, email, phone_number, password_hash) 
       VALUES ($1, $2, $3, $4, $5) RETURNING id, full_name, username, email, phone_number, role`,
      [full_name, username, email, phone_number, passwordHash]
    );

    const user = userResult.rows[0];

    // Generate OTP for verification
    const otpCode = authService.generateOTP();
    await db.query(
      'INSERT INTO otps (user_id, otp_code, purpose, expires_at) VALUES ($1, $2, $3, $4)',
      [user.id, otpCode, 'signup', new Date(Date.now() + 10 * 60 * 1000)] // 10 minutes
    );

    // Send OTP via SMS
    await smsService.sendOTP(phone_number, otpCode);

    res.status(201).json({
      success: true,
      message: 'User registered successfully. Please verify your phone number with the OTP sent.',
      data: {
        user: {
          id: user.id,
          full_name: user.full_name,
          username: user.username,
          email: user.email,
          phone_number: user.phone_number,
          role: user.role
        }
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const verifyOTP = async (req, res) => {
  try {
    const { identifier, otp_code } = req.body;

    // Find user by phone number or email
    const userQuery = await db.query(
      'SELECT id, is_active FROM users WHERE phone_number = $1 OR email = $1',
      [identifier]
    );

    if (userQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = userQuery.rows[0];

    // Verify OTP
    const otpQuery = await db.query(
      'SELECT id, expires_at, verified FROM otps WHERE user_id = $1 AND otp_code = $2 AND verified = false ORDER BY created_at DESC LIMIT 1',
      [user.id, otp_code]
    );

    if (otpQuery.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP'
      });
    }

    const otp = otpQuery.rows[0];

    if (new Date() > new Date(otp.expires_at)) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired'
      });
    }

    // Mark OTP as verified and activate user
    await db.query('UPDATE otps SET verified = true WHERE id = $1', [otp.id]);
    await db.query('UPDATE users SET is_active = true WHERE id = $1', [user.id]);

    res.json({
      success: true,
      message: 'Phone number verified successfully'
    });
  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const login = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    // Find user by phone number or email
    const userQuery = await db.query(
      `SELECT id, full_name, username, email, phone_number, password_hash, role, is_active, is_deleted 
       FROM users WHERE (phone_number = $1 OR email = $1) AND is_deleted = false`,
      [identifier]
    );

    if (userQuery.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const user = userQuery.rows[0];

    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Account is not active. Please verify your phone number.'
      });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate tokens
    const tokens = generateTokens(user.id, user.role);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          full_name: user.full_name,
          username: user.username,
          email: user.email,
          phone_number: user.phone_number,
          role: user.role
        },
        ...tokens
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { identifier } = req.body;

    const userQuery = await db.query(
      'SELECT id, phone_number FROM users WHERE phone_number = $1 OR email = $1',
      [identifier]
    );

    if (userQuery.rows.length === 0) {
      // Don't reveal if user exists or not for security
      return res.json({
        success: true,
        message: 'If the account exists, an OTP has been sent'
      });
    }

    const user = userQuery.rows[0];

    // Generate OTP for password reset
    const otpCode = authService.generateOTP();
    await db.query(
      'INSERT INTO otps (user_id, otp_code, purpose, expires_at) VALUES ($1, $2, $3, $4)',
      [user.id, otpCode, 'reset_password', new Date(Date.now() + 10 * 60 * 1000)]
    );

    // Send OTP via SMS
    await smsService.sendOTP(user.phone_number, otpCode);

    res.json({
      success: true,
      message: 'If the account exists, an OTP has been sent'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { identifier, otp_code, new_password } = req.body;

    // Find user
    const userQuery = await db.query(
      'SELECT id FROM users WHERE phone_number = $1 OR email = $1',
      [identifier]
    );

    if (userQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = userQuery.rows[0];

    // Verify OTP
    const otpQuery = await db.query(
      'SELECT id, expires_at FROM otps WHERE user_id = $1 AND otp_code = $2 AND purpose = $3 AND verified = false ORDER BY created_at DESC LIMIT 1',
      [user.id, otp_code, 'reset_password']
    );

    if (otpQuery.rows.length === 0 || new Date() > new Date(otpQuery.rows[0].expires_at)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP'
      });
    }

    // Hash new password and update
    const passwordHash = await bcrypt.hash(new_password, config.security.bcryptRounds);
    await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, user.id]);
    
    // Mark OTP as verified
    await db.query('UPDATE otps SET verified = true WHERE id = $1', [otpQuery.rows[0].id]);

    res.json({
      success: true,
      message: 'Password reset successful'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  signup,
  verifyOTP,
  login,
  forgotPassword,
  resetPassword
};
