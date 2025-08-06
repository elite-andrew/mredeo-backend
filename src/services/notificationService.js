const db = require('../config/database');
const smsService = require('./smsService');
const emailService = require('./emailService');

const sendNotificationToUsers = async (userIds, title, message, senderId) => {
  try {
    // Create notification
    const notificationResult = await db.query(
      'INSERT INTO notifications (sender_id, title, message) VALUES ($1, $2, $3) RETURNING id, created_at',
      [senderId, title, message]
    );

    const notification = notificationResult.rows[0];

    // Create notification_reads entries for specified users
    if (userIds.length > 0) {
      const values = userIds.map((_, index) => 
        `($1, $${index + 2})`
      ).join(', ');

      await db.query(
        `INSERT INTO notification_reads (notification_id, user_id) VALUES ${values}`,
        [notification.id, ...userIds]
      );
    }

    return {
      notification_id: notification.id,
      sent_to_count: userIds.length,
      sent_at: notification.created_at
    };
  } catch (error) {
    console.error('Error sending notification:', error);
    throw error;
  }
};

const sendBulkSMS = async (phoneNumbers, message) => {
  try {
    const results = [];
    
    for (const phoneNumber of phoneNumbers) {
      try {
        await smsService.sendSMS(phoneNumber, message);
        results.push({ phoneNumber, status: 'sent' });
      } catch (error) {
        results.push({ phoneNumber, status: 'failed', error: error.message });
      }
    }
    
    return results;
  } catch (error) {
    console.error('Error sending bulk SMS:', error);
    throw error;
  }
};

const sendBulkEmail = async (emailAddresses, subject, content) => {
  try {
    const results = [];
    
    for (const email of emailAddresses) {
      try {
        await emailService.sendEmail(email, subject, content, content);
        results.push({ email, status: 'sent' });
      } catch (error) {
        results.push({ email, status: 'failed', error: error.message });
      }
    }
    
    return results;
  } catch (error) {
    console.error('Error sending bulk email:', error);
    throw error;
  }
};

const getNotificationStats = async (userId = null) => {
  try {
    if (userId) {
      // User-specific stats
      const stats = await db.query(`
        SELECT 
          COUNT(*) as total_notifications,
          SUM(CASE WHEN nr.is_read = true THEN 1 ELSE 0 END) as read_count,
          SUM(CASE WHEN nr.is_read = false THEN 1 ELSE 0 END) as unread_count
        FROM notification_reads nr
        WHERE nr.user_id = $1
      `, [userId]);
      
      return stats.rows[0];
    } else {
      // System-wide stats
      const stats = await db.query(`
        SELECT 
          COUNT(DISTINCT n.id) as total_notifications,
          COUNT(nr.id) as total_deliveries,
          SUM(CASE WHEN nr.is_read = true THEN 1 ELSE 0 END) as total_read,
          SUM(CASE WHEN nr.is_read = false THEN 1 ELSE 0 END) as total_unread
        FROM notifications n
        LEFT JOIN notification_reads nr ON n.id = nr.notification_id
      `);
      
      return stats.rows[0];
    }
  } catch (error) {
    console.error('Error getting notification stats:', error);
    throw error;
  }
};

module.exports = {
  sendNotificationToUsers,
  sendBulkSMS,
  sendBulkEmail,
  getNotificationStats
};
