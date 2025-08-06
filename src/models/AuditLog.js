const db = require('../config/database');

class AuditLog {
  static async create(auditData) {
    try {
      const { user_id, action, target_id, metadata } = auditData;
      
      const result = await db.query(
        'INSERT INTO audit_logs (user_id, action, target_id, metadata) VALUES ($1, $2, $3, $4) RETURNING id, created_at',
        [user_id, action, target_id, JSON.stringify(metadata)]
      );
      
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  static async findById(id) {
    try {
      const result = await db.query(
        `SELECT al.*, u.full_name as user_name, u.username
         FROM audit_logs al
         LEFT JOIN users u ON al.user_id = u.id
         WHERE al.id = $1`,
        [id]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  static async getUserAuditLogs(userId, filters = {}) {
    try {
      const { page = 1, limit = 20, action, start_date, end_date } = filters;
      const offset = (page - 1) * limit;

      let whereConditions = ['user_id = $1'];
      let queryParams = [userId];
      let paramCount = 1;

      if (action) {
        paramCount++;
        whereConditions.push(`action = $${paramCount}`);
        queryParams.push(action);
      }

      if (start_date) {
        paramCount++;
        whereConditions.push(`created_at >= $${paramCount}`);
        queryParams.push(start_date);
      }

      if (end_date) {
        paramCount++;
        whereConditions.push(`created_at <= $${paramCount}`);
        queryParams.push(end_date);
      }

      const whereClause = whereConditions.join(' AND ');

      // Get audit logs
      paramCount++;
      queryParams.push(limit);
      paramCount++;
      queryParams.push(offset);

      const auditResult = await db.query(
        `SELECT id, action, target_id, metadata, created_at
         FROM audit_logs
         WHERE ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${paramCount - 1} OFFSET $${paramCount}`,
        queryParams
      );

      // Get total count
      const countResult = await db.query(
        `SELECT COUNT(*) FROM audit_logs WHERE ${whereClause}`,
        queryParams.slice(0, -2)
      );

      return {
        audit_logs: auditResult.rows,
        total: parseInt(countResult.rows[0].count)
      };
    } catch (error) {
      throw error;
    }
  }

  static async getSystemAuditLogs(filters = {}) {
    try {
      const { page = 1, limit = 50, action, user_id, start_date, end_date } = filters;
      const offset = (page - 1) * limit;

      let whereConditions = [];
      let queryParams = [];
      let paramCount = 0;

      if (action) {
        paramCount++;
        whereConditions.push(`al.action = $${paramCount}`);
        queryParams.push(action);
      }

      if (user_id) {
        paramCount++;
        whereConditions.push(`al.user_id = $${paramCount}`);
        queryParams.push(user_id);
      }

      if (start_date) {
        paramCount++;
        whereConditions.push(`al.created_at >= $${paramCount}`);
        queryParams.push(start_date);
      }

      if (end_date) {
        paramCount++;
        whereConditions.push(`al.created_at <= $${paramCount}`);
        queryParams.push(end_date);
      }

      const whereClause = whereConditions.length > 0 ? 
        'WHERE ' + whereConditions.join(' AND ') : '';

      // Get audit logs
      paramCount++;
      queryParams.push(limit);
      paramCount++;
      queryParams.push(offset);

      const auditResult = await db.query(
        `SELECT al.id, al.action, al.target_id, al.metadata, al.created_at,
                u.full_name as user_name, u.username
         FROM audit_logs al
         LEFT JOIN users u ON al.user_id = u.id
         ${whereClause}
         ORDER BY al.created_at DESC
         LIMIT $${paramCount - 1} OFFSET $${paramCount}`,
        queryParams
      );

      // Get total count
      const countResult = await db.query(
        `SELECT COUNT(*) FROM audit_logs al ${whereClause}`,
        queryParams.slice(0, -2)
      );

      return {
        audit_logs: auditResult.rows,
        total: parseInt(countResult.rows[0].count)
      };
    } catch (error) {
      throw error;
    }
  }

  static async getAuditStats() {
    try {
      const result = await db.query(`
        SELECT 
          COUNT(*) as total_logs,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(DISTINCT action) as unique_actions,
          COUNT(CASE WHEN created_at >= CURRENT_DATE THEN 1 END) as today_logs,
          COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as week_logs,
          COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as month_logs
        FROM audit_logs
      `);
      
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  static async getActionStats(limit = 10) {
    try {
      const result = await db.query(`
        SELECT 
          action,
          COUNT(*) as count,
          COUNT(DISTINCT user_id) as unique_users,
          MAX(created_at) as last_occurrence
        FROM audit_logs
        GROUP BY action
        ORDER BY count DESC
        LIMIT $1`,
        [limit]
      );
      
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  static async cleanupOldLogs(daysToKeep = 90) {
    try {
      const result = await db.query(
        'DELETE FROM audit_logs WHERE created_at < CURRENT_DATE - INTERVAL $1 DAY',
        [daysToKeep]
      );
      
      return result.rowCount;
    } catch (error) {
      throw error;
    }
  }

  static async getSecurityEvents(filters = {}) {
    try {
      const { page = 1, limit = 20, start_date, end_date } = filters;
      const offset = (page - 1) * limit;

      // Security-related actions
      const securityActions = [
        'user_login',
        'user_logout', 
        'password_reset',
        'failed_login_attempt',
        'account_locked',
        'unauthorized_access_attempt'
      ];

      let whereConditions = [`action = ANY($1)`];
      let queryParams = [securityActions];
      let paramCount = 1;

      if (start_date) {
        paramCount++;
        whereConditions.push(`created_at >= $${paramCount}`);
        queryParams.push(start_date);
      }

      if (end_date) {
        paramCount++;
        whereConditions.push(`created_at <= $${paramCount}`);
        queryParams.push(end_date);
      }

      const whereClause = whereConditions.join(' AND ');

      // Get security events
      paramCount++;
      queryParams.push(limit);
      paramCount++;
      queryParams.push(offset);

      const securityResult = await db.query(
        `SELECT al.id, al.action, al.target_id, al.metadata, al.created_at,
                u.full_name as user_name, u.username
         FROM audit_logs al
         LEFT JOIN users u ON al.user_id = u.id
         WHERE ${whereClause}
         ORDER BY al.created_at DESC
         LIMIT $${paramCount - 1} OFFSET $${paramCount}`,
        queryParams
      );

      return securityResult.rows;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = AuditLog;
