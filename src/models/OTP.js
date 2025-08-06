const db = require('../config/database');

class OTP {
  static async create(otpData) {
    try {
      const { user_id, otp_code, purpose, expires_at } = otpData;
      
      const result = await db.query(
        'INSERT INTO otps (user_id, otp_code, purpose, expires_at) VALUES ($1, $2, $3, $4) RETURNING id, created_at',
        [user_id, otp_code, purpose, expires_at]
      );
      
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  static async findValidOTP(userId, otpCode, purpose) {
    try {
      const result = await db.query(
        `SELECT id, expires_at, verified FROM otps 
         WHERE user_id = $1 AND otp_code = $2 AND purpose = $3 AND verified = false 
         ORDER BY created_at DESC LIMIT 1`,
        [userId, otpCode, purpose]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  static async markAsVerified(id) {
    try {
      const result = await db.query(
        'UPDATE otps SET verified = true, verified_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id',
        [id]
      );
      
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  static async isExpired(expiresAt) {
    return new Date() > new Date(expiresAt);
  }

  static async cleanupExpired() {
    try {
      const result = await db.query(
        'DELETE FROM otps WHERE expires_at < CURRENT_TIMESTAMP AND verified = false'
      );
      
      return result.rowCount;
    } catch (error) {
      throw error;
    }
  }

  static async getUserOTPHistory(userId, limit = 10) {
    try {
      const result = await db.query(
        `SELECT otp_code, purpose, verified, expires_at, created_at, verified_at
         FROM otps WHERE user_id = $1 
         ORDER BY created_at DESC LIMIT $2`,
        [userId, limit]
      );
      
      // Mask OTP codes for security
      const maskedHistory = result.rows.map(otp => ({
        ...otp,
        otp_code: '******'
      }));
      
      return maskedHistory;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = OTP;
