const db = require('../config/database');

const sendNotification = async (req, res) => {
  try {
    const { title, message } = req.body;
    const senderId = req.user.id;

    // Create notification
    const notificationResult = await db.query(
      'INSERT INTO notifications (sender_id, title, message) VALUES ($1, $2, $3) RETURNING id, created_at',
      [senderId, title, message]
    );

    const notification = notificationResult.rows[0];

    // Get all active members to create notification_reads entries
    const membersQuery = await db.query(
      'SELECT id FROM users WHERE is_active = true AND is_deleted = false'
    );

    // Create notification_reads entries for all members
    const readEntries = membersQuery.rows.map(member => [notification.id, member.id]);
    
    if (readEntries.length > 0) {
      const values = readEntries.map((_, index) => 
        `($${index * 2 + 1}, $${index * 2 + 2})`
      ).join(', ');

      const flattenedEntries = readEntries.flat();
      
      await db.query(
        `INSERT INTO notification_reads (notification_id, user_id) VALUES ${values}`,
        flattenedEntries
      );
    }

    res.status(201).json({
      success: true,
      message: 'Notification sent successfully to all members',
      data: {
        notification_id: notification.id,
        title,
        message,
        sent_to_count: membersQuery.rows.length,
        sent_at: notification.created_at
      }
    });
  } catch (error) {
    console.error('Send notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, unread_only = 'false' } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE nr.user_id = $1';
    const queryParams = [userId];

    if (unread_only === 'true') {
      whereClause += ' AND nr.is_read = false';
    }

    const notificationsQuery = await db.query(
      `SELECT n.id, n.title, n.message, n.created_at,
              nr.is_read, nr.read_at,
              u.full_name as sender_name
       FROM notifications n
       JOIN notification_reads nr ON n.id = nr.notification_id
       LEFT JOIN users u ON n.sender_id = u.id
       ${whereClause}
       ORDER BY n.created_at DESC
       LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`,
      [...queryParams, limit, offset]
    );

    // Get unread count
    const unreadCountQuery = await db.query(
      'SELECT COUNT(*) FROM notification_reads WHERE user_id = $1 AND is_read = false',
      [userId]
    );

    const notifications = notificationsQuery.rows;
    const unreadCount = parseInt(unreadCountQuery.rows[0].count);

    res.json({
      success: true,
      data: {
        notifications,
        unread_count: unreadCount,
        pagination: {
          current_page: parseInt(page),
          per_page: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const markNotificationAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.id;

    const updateResult = await db.query(
      'UPDATE notification_reads SET is_read = true, read_at = CURRENT_TIMESTAMP WHERE notification_id = $1 AND user_id = $2 RETURNING id',
      [notificationId, userId]
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const markAllNotificationsAsRead = async (req, res) => {
  try {
    const userId = req.user.id;

    const updateResult = await db.query(
      'UPDATE notification_reads SET is_read = true, read_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND is_read = false',
      [userId]
    );

    res.json({
      success: true,
      message: `${updateResult.rowCount} notifications marked as read`
    });
  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  sendNotification,
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead
};
