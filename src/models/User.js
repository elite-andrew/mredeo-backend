const db = require('../config/database');

class User {
  static async findById(id) {
    try {
      const result = await db.query(
        'SELECT id, firebase_uid, full_name, username, email, phone_number, profile_picture, role, is_active, is_deleted, created_at, updated_at FROM users WHERE id = $1',
        [id]
      );
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  static async findByFirebaseUid(uid) {
    try {
      const result = await db.query(
        'SELECT id, firebase_uid, full_name, username, email, phone_number, profile_picture, role, is_active, is_deleted, created_at FROM users WHERE firebase_uid = $1 AND is_deleted = false',
        [uid]
      );
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  static async findByIdentifier(identifier) {
    try {
      const result = await db.query(
        `SELECT id, firebase_uid, full_name, username, email, phone_number, role, is_active, is_deleted, created_at 
         FROM users WHERE (email = $1 OR phone_number = $1 OR username = $1) AND is_deleted = false`,
        [identifier]
      );
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  static async create(userData) {
    try {
      const { firebase_uid, full_name, username, email, phone_number, role = 'member', is_active = true } = userData;
      
      const result = await db.query(
        `INSERT INTO users (firebase_uid, full_name, username, email, phone_number, role, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, firebase_uid, full_name, username, email, phone_number, role, is_active, created_at`,
        [firebase_uid, full_name, username, email, phone_number, role, is_active]
      );
      
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  static async update(id, updateData) {
    try {
      const fields = [];
      const values = [];
      let paramCount = 0;

      Object.keys(updateData).forEach(key => {
        if (updateData[key] !== undefined) {
          paramCount++;
          fields.push(`${key} = $${paramCount}`);
          values.push(updateData[key]);
        }
      });

      if (fields.length === 0) {
        throw new Error('No fields to update');
      }

      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);

      const result = await db.query(
        `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramCount + 1}
         RETURNING id, full_name, username, email, phone_number, profile_picture, role`,
        values
      );

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  static async softDelete(id) {
    try {
      const result = await db.query(
        'UPDATE users SET is_deleted = true, is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id',
        [id]
      );
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  static async findAll(filters = {}) {
    try {
      const { page = 1, limit = 10, role, is_active, search } = filters;
      const offset = (page - 1) * limit;

      let whereConditions = ['is_deleted = false'];
      let queryParams = [];
      let paramCount = 0;

      if (role) {
        paramCount++;
        whereConditions.push(`role = $${paramCount}`);
        queryParams.push(role);
      }

      if (is_active !== undefined) {
        paramCount++;
        whereConditions.push(`is_active = $${paramCount}`);
        queryParams.push(is_active);
      }

      if (search) {
        paramCount++;
        whereConditions.push(`(full_name ILIKE $${paramCount} OR username ILIKE $${paramCount} OR email ILIKE $${paramCount})`);
        queryParams.push(`%${search}%`);
      }

      const whereClause = whereConditions.join(' AND ');

      // Get users
      paramCount++;
      queryParams.push(limit);
      paramCount++;
      queryParams.push(offset);

      const usersResult = await db.query(
  `SELECT id, firebase_uid, full_name, username, email, phone_number, profile_picture, role, is_active, created_at
         FROM users WHERE ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${paramCount - 1} OFFSET $${paramCount}`,
        queryParams
      );

      // Get total count
      const countResult = await db.query(
        `SELECT COUNT(*) FROM users WHERE ${whereClause}`,
        queryParams.slice(0, -2)
      );

      return {
        users: usersResult.rows,
        total: parseInt(countResult.rows[0].count)
      };
    } catch (error) {
      throw error;
    }
  }

  static async getUserStats() {
    try {
      const result = await db.query(`
        SELECT 
          COUNT(*) as total_users,
          COUNT(CASE WHEN role = 'member' THEN 1 END) as total_members,
          COUNT(CASE WHEN role LIKE 'admin%' THEN 1 END) as total_admins,
          COUNT(CASE WHEN is_active = true THEN 1 END) as active_users,
          COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as new_users_30_days
        FROM users WHERE is_deleted = false
      `);

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }
}

module.exports = User;
