const db = require('../config/database');

class Notification {
  static async create(notificationData) {
    try {
      const { sender_id, title, message } = notificationData;
      
      const result = await db.query(
        'INSERT INTO notifications (sender_id, title, message) VALUES ($1, $2, $3) RETURNING id, created_at',
        [sender_id, title, message]
      );
      
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  static async findById(id) {
    try {
      const result = await db.query(
        `SELECT n.*, u.full_name as sender_name
         FROM notifications n
         LEFT JOIN users u ON n.sender_id = u.id
         WHERE n.id = $1`,
        [id]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  static async createNotificationReads(notificationId, userIds) {
    try {
      if (userIds.length === 0) return;

      const values = userIds.map((_, index) => 
        `($1, $${index + 2})`
      ).join(', ');

      await db.query(
        `INSERT INTO notification_reads (notification_id, user_id) VALUES ${values}`,
        [notificationId, ...userIds]
      );
    } catch (error) {
      throw error;
    }
  }

  static async getUserNotifications(userId, filters = {}) {
    try {
      const { page = 1, limit = 20, unread_only = false } = filters;
      const offset = (page - 1) * limit;

      let whereConditions = ['nr.user_id = $1'];
      let queryParams = [userId];
      let paramCount = 1;

      if (unread_only) {
        whereConditions.push('nr.is_read = false');
      }

      const whereClause = whereConditions.join(' AND ');

      // Get notifications
      paramCount++;
      queryParams.push(limit);
      paramCount++;
      queryParams.push(offset);

      const notificationsResult = await db.query(
        `SELECT n.id, n.title, n.message, n.created_at,
                nr.is_read, nr.read_at,
                u.full_name as sender_name
         FROM notifications n
         JOIN notification_reads nr ON n.id = nr.notification_id
         LEFT JOIN users u ON n.sender_id = u.id
         WHERE ${whereClause}
         ORDER BY n.created_at DESC
         LIMIT $${paramCount - 1} OFFSET $${paramCount}`,
        queryParams
      );

      // Get total count
      const countResult = await db.query(
        `SELECT COUNT(*) FROM notification_reads nr WHERE ${whereClause}`,
        queryParams.slice(0, -2)
      );

      return {
        notifications: notificationsResult.rows,
        total: parseInt(countResult.rows[0].count)
      };
    } catch (error) {
      throw error;
    }
  }

  static async markAsRead(notificationId, userId) {
    try {
      const result = await db.query(
        'UPDATE notification_reads SET is_read = true, read_at = CURRENT_TIMESTAMP WHERE notification_id = $1 AND user_id = $2 RETURNING id',
        [notificationId, userId]
      );
      
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  static async markAllAsRead(userId) {
    try {
      const result = await db.query(
        'UPDATE notification_reads SET is_read = true, read_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND is_read = false',
        [userId]
      );
      
      return result.rowCount;
    } catch (error) {
      throw error;
    }
  }

  static async getUnreadCount(userId) {
    try {
      const result = await db.query(
        'SELECT COUNT(*) FROM notification_reads WHERE user_id = $1 AND is_read = false',
        [userId]
      );
      
      return parseInt(result.rows[0].count);
    } catch (error) {
      throw error;
    }
  }

  static async getNotificationStats() {
    try {
      const result = await db.query(`
        SELECT 
          COUNT(DISTINCT n.id) as total_notifications,
          COUNT(nr.id) as total_deliveries,
          SUM(CASE WHEN nr.is_read = true THEN 1 ELSE 0 END) as total_read,
          SUM(CASE WHEN nr.is_read = false THEN 1 ELSE 0 END) as total_unread,
          COUNT(DISTINCT n.sender_id) as unique_senders
        FROM notifications n
        LEFT JOIN notification_reads nr ON n.id = nr.notification_id
      `);
      
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  static async deleteNotification(id) {
    try {
      // First delete notification reads
      await db.query('DELETE FROM notification_reads WHERE notification_id = $1', [id]);
      
      // Then delete the notification
      const result = await db.query(
        'DELETE FROM notifications WHERE id = $1 RETURNING id',
        [id]
      );
      
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  static async getRecentNotifications(limit = 5) {
    try {
      const result = await db.query(`
        SELECT n.id, n.title, n.message, n.created_at,
               u.full_name as sender_name,
               COUNT(nr.id) as recipient_count,
               COUNT(CASE WHEN nr.is_read = true THEN 1 END) as read_count
        FROM notifications n
        LEFT JOIN users u ON n.sender_id = u.id
        LEFT JOIN notification_reads nr ON n.id = nr.notification_id
        GROUP BY n.id, n.title, n.message, n.created_at, u.full_name
        ORDER BY n.created_at DESC
        LIMIT $1`,
        [limit]
      );
      
      return result.rows;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Notification;
