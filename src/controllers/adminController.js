const db = require('../config/database');
const User = require('../models/User');
const Payment = require('../models/Payment');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');

const getDashboardStats = async (req, res) => {
  try {
    // Get various statistics for the admin dashboard
    const [userStats, paymentStats, notificationStats, auditStats] = await Promise.all([
      User.getUserStats(),
      Payment.getPaymentStats(),
      Notification.getNotificationStats(),
      AuditLog.getAuditStats()
    ]);

    res.json({
      success: true,
      data: {
        users: userStats,
        payments: paymentStats,
        notifications: notificationStats,
        audit: auditStats
      }
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, role, is_active, search } = req.query;
    
    const filters = { page, limit };
    if (role) filters.role = role;
    if (is_active !== undefined) filters.is_active = is_active === 'true';
    if (search) filters.search = search;

    const result = await User.findAll(filters);
    
    const pagination = {
      current_page: parseInt(page),
      per_page: parseInt(limit),
      total_pages: Math.ceil(result.total / limit),
      total_records: result.total
    };

    res.json({
      success: true,
      data: {
        users: result.users,
        pagination
      }
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const getUserDetails = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get user's payment history
    const paymentHistory = await Payment.getUserPayments(userId, { limit: 10 });
    
    // Get user's audit logs
    const auditLogs = await AuditLog.getUserAuditLogs(userId, { limit: 10 });

    res.json({
      success: true,
      data: {
        user,
        payment_history: paymentHistory.payments,
        recent_activities: auditLogs.audit_logs
      }
    });
  } catch (error) {
    console.error('Get user details error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    const validRoles = ['member', 'admin_chairperson', 'admin_secretary', 'admin_signatory'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role specified'
      });
    }

    const updatedUser = await User.update(userId, { role });
    
    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User role updated successfully',
      data: { user: updatedUser }
    });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const toggleUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { is_active } = req.body;

    const updatedUser = await User.update(userId, { is_active });
    
    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: `User ${is_active ? 'activated' : 'deactivated'} successfully`,
      data: { user: updatedUser }
    });
  } catch (error) {
    console.error('Toggle user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const deletedUser = await User.softDelete(userId);
    
    if (!deletedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const getSystemAuditLogs = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      action, 
      user_id, 
      start_date, 
      end_date 
    } = req.query;

    const filters = { page, limit };
    if (action) filters.action = action;
    if (user_id) filters.user_id = user_id;
    if (start_date) filters.start_date = start_date;
    if (end_date) filters.end_date = end_date;

    const result = await AuditLog.getSystemAuditLogs(filters);
    
    const pagination = {
      current_page: parseInt(page),
      per_page: parseInt(limit),
      total_pages: Math.ceil(result.total / limit),
      total_records: result.total
    };

    res.json({
      success: true,
      data: {
        audit_logs: result.audit_logs,
        pagination
      }
    });
  } catch (error) {
    console.error('Get system audit logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const getSecurityEvents = async (req, res) => {
  try {
    const { page = 1, limit = 20, start_date, end_date } = req.query;

    const filters = { page, limit };
    if (start_date) filters.start_date = start_date;
    if (end_date) filters.end_date = end_date;

    const securityEvents = await AuditLog.getSecurityEvents(filters);

    res.json({
      success: true,
      data: { security_events: securityEvents }
    });
  } catch (error) {
    console.error('Get security events error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const getPaymentAnalytics = async (req, res) => {
  try {
    const { year = new Date().getFullYear() } = req.query;

    const [monthlyReport, topContributors, actionStats] = await Promise.all([
      Payment.getMonthlyPaymentReport(year),
      Payment.getTopContributors(10),
      AuditLog.getActionStats(10)
    ]);

    res.json({
      success: true,
      data: {
        monthly_payments: monthlyReport,
        top_contributors: topContributors,
        action_statistics: actionStats
      }
    });
  } catch (error) {
    console.error('Get payment analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const getRecentActivities = async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    const [recentNotifications, recentPayments, recentAuditLogs] = await Promise.all([
      Notification.getRecentNotifications(5),
      db.query(`
        SELECT p.id, p.amount_paid, p.payment_status, p.created_at,
               u.full_name as user_name, ct.name as contribution_name
        FROM payments p
        JOIN users u ON p.user_id = u.id
        JOIN contribution_types ct ON p.contribution_type_id = ct.id
        ORDER BY p.created_at DESC
        LIMIT 10
      `),
      db.query(`
        SELECT al.action, al.created_at, u.full_name as user_name
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        ORDER BY al.created_at DESC
        LIMIT 10
      `)
    ]);

    res.json({
      success: true,
      data: {
        recent_notifications: recentNotifications,
        recent_payments: recentPayments.rows,
        recent_activities: recentAuditLogs.rows
      }
    });
  } catch (error) {
    console.error('Get recent activities error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const exportUserData = async (req, res) => {
  try {
    const { format = 'json', start_date, end_date } = req.query;

    let whereConditions = ['is_deleted = false'];
    let queryParams = [];
    let paramCount = 0;

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

    const usersResult = await db.query(
      `SELECT id, full_name, username, email, phone_number, role, is_active, created_at
       FROM users WHERE ${whereClause}
       ORDER BY created_at DESC`,
      queryParams
    );

    if (format === 'csv') {
      // Convert to CSV format
      const csvHeader = 'ID,Full Name,Username,Email,Phone,Role,Active,Created At\n';
      const csvData = usersResult.rows.map(user => 
        `${user.id},${user.full_name},${user.username},${user.email || ''},${user.phone_number},${user.role},${user.is_active},${user.created_at}`
      ).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=users_export.csv');
      res.send(csvHeader + csvData);
    } else {
      res.json({
        success: true,
        data: {
          users: usersResult.rows,
          exported_at: new Date().toISOString(),
          total_records: usersResult.rows.length
        }
      });
    }
  } catch (error) {
    console.error('Export user data error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const performSystemMaintenance = async (req, res) => {
  try {
    const { action } = req.body;

    let result = {};

    switch (action) {
      case 'cleanup_expired_otps':
        const deletedOtps = await db.query(
          'DELETE FROM otps WHERE expires_at < CURRENT_TIMESTAMP AND verified = false'
        );
        result.deleted_otps = deletedOtps.rowCount;
        break;

      case 'cleanup_old_audit_logs':
        const deletedLogs = await AuditLog.cleanupOldLogs(90); // Keep 90 days
        result.deleted_audit_logs = deletedLogs;
        break;

      case 'update_user_stats':
        // Refresh materialized views or update statistics
        await db.query('ANALYZE users, payments, notifications');
        result.stats_updated = true;
        break;

      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid maintenance action'
        });
    }

    res.json({
      success: true,
      message: 'Maintenance task completed successfully',
      data: result
    });
  } catch (error) {
    console.error('System maintenance error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  getDashboardStats,
  getAllUsers,
  getUserDetails,
  updateUserRole,
  toggleUserStatus,
  deleteUser,
  getSystemAuditLogs,
  getSecurityEvents,
  getPaymentAnalytics,
  getRecentActivities,
  exportUserData,
  performSystemMaintenance
};
