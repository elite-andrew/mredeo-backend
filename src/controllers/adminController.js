const db = require('../config/database');
const User = require('../models/User');
const Payment = require('../models/Payment');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');
const { initiatePaymentWithProvider } = require('../services/paymentProviderService');

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

    const validRoles = ['member', 'admin_chairperson', 'admin_secretary', 'admin_signatory', 'admin_treasurer'];
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

// Dual Authorization Payment Functions

const initiatePayment = async (req, res) => {
  try {
    const { issued_to, amount, purpose } = req.body;
    const initiated_by = req.user.id;
    
    // Validate required fields
    if (!issued_to || !amount || !purpose) {
      return res.status(400).json({
        success: false,
        message: 'Recipient, amount, and purpose are required'
      });
    }
    
    // Verify recipient exists
    const recipient = await User.findById(issued_to);
    if (!recipient) {
      return res.status(404).json({
        success: false,
        message: 'Recipient not found'
      });
    }
    
    // Generate transaction reference
    const transaction_reference = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create payment record with pending approval
    const query = `
      INSERT INTO issued_payments 
      (initiated_by, issued_to, amount, purpose, transaction_reference, approval_status)
      VALUES ($1, $2, $3, $4, $5, 'pending')
      RETURNING *
    `;
    
    const result = await db.query(query, [
      initiated_by,
      issued_to,
      amount,
      purpose,
      transaction_reference
    ]);
    
    // Log the action
    await AuditLog.log({
      user_id: initiated_by,
      action: 'PAYMENT_INITIATED',
      resource_type: 'issued_payment',
      resource_id: result.rows[0].id,
      details: { amount, purpose, recipient: issued_to }
    });
    
    res.json({
      success: true,
      message: 'Payment initiated successfully. Awaiting signatory approval.',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Initiate payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const approvePayment = async (req, res) => {
  try {
    const { payment_id } = req.params;
    const approved_by = req.user.id;
    
    // Get payment details
    const paymentQuery = `
      SELECT p.*, 
             u1.full_name as initiated_by_name, u1.role as initiated_by_role,
             u2.full_name as recipient_name
      FROM issued_payments p
      JOIN users u1 ON p.initiated_by = u1.id
      JOIN users u2 ON p.issued_to = u2.id
      WHERE p.id = $1
    `;
    
    const paymentResult = await db.query(paymentQuery, [payment_id]);
    
    if (paymentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }
    
    const payment = paymentResult.rows[0];
    
    // Check if payment is still pending
    if (payment.approval_status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Payment has already been ${payment.approval_status}`
      });
    }
    
    // Ensure approver is different from initiator
    if (payment.initiated_by === approved_by) {
      return res.status(400).json({
        success: false,
        message: 'Self-approval is not allowed'
      });
    }
    
    // Verify initiator has financial authority
    const financialAuthorities = ['admin_chairperson', 'admin_secretary', 'admin_treasurer'];
    if (!financialAuthorities.includes(payment.initiated_by_role)) {
      return res.status(400).json({
        success: false,
        message: 'Payment initiator does not have financial authority'
      });
    }
    
    // Update payment status to approved
    const updateQuery = `
      UPDATE issued_payments 
      SET approved_by = $1, approval_status = 'approved', approved_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;
    
    const result = await db.query(updateQuery, [approved_by, payment_id]);
    
    // Log the approval action
    await AuditLog.log({
      user_id: approved_by,
      action: 'PAYMENT_APPROVED',
      resource_type: 'issued_payment',
      resource_id: payment_id,
      details: { 
        amount: payment.amount, 
        purpose: payment.purpose,
        initiated_by: payment.initiated_by,
        recipient: payment.issued_to
      }
    });
    
    // After internal approval, initiate actual payment with provider
    try {
      // Get recipient's phone number for payment
      const recipientQuery = `SELECT phone_number, full_name FROM users WHERE id = $1`;
      const recipientResult = await db.query(recipientQuery, [payment.issued_to]);
      const recipient = recipientResult.rows[0];
      
      // Trigger payment provider API (this is where the signatory sends the payment request)
      const paymentProviderResponse = await initiatePaymentWithProvider({
        amount: payment.amount,
        recipient_phone: recipient.phone_number,
        recipient_name: recipient.full_name,
        purpose: payment.purpose,
        transaction_reference: payment.transaction_reference,
        initiated_by_signatory: approved_by
      });
      
      // Update payment with provider response
      if (paymentProviderResponse.success) {
        await db.query(`
          UPDATE issued_payments 
          SET payment_provider_reference = $1, payment_status = 'processing', issued_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [paymentProviderResponse.provider_reference, payment_id]);
        
        // Log successful provider initiation
        await AuditLog.log({
          user_id: approved_by,
          action: 'PAYMENT_PROVIDER_INITIATED',
          resource_type: 'issued_payment',
          resource_id: payment_id,
          details: { 
            provider_reference: paymentProviderResponse.provider_reference,
            amount: payment.amount,
            recipient_phone: recipient.phone_number
          }
        });
        
        res.json({
          success: true,
          message: 'Payment approved and sent to payment provider. Awaiting recipient confirmation.',
          data: {
            payment: result.rows[0],
            provider_response: paymentProviderResponse
          }
        });
      } else {
        // Payment provider failed - update status
        await db.query(`
          UPDATE issued_payments 
          SET payment_status = 'provider_failed', provider_error = $1
          WHERE id = $2
        `, [paymentProviderResponse.error, payment_id]);
        
        res.json({
          success: false,
          message: 'Payment approved internally but failed at payment provider',
          data: {
            payment: result.rows[0],
            provider_error: paymentProviderResponse.error
          }
        });
      }
      
    } catch (providerError) {
      console.error('Payment provider error:', providerError);
      
      // Update payment status to indicate provider failure
      await db.query(`
        UPDATE issued_payments 
        SET payment_status = 'provider_failed', provider_error = $1
        WHERE id = $2
      `, [providerError.message, payment_id]);
      
      // Still return success for the approval, but indicate provider issue
      res.json({
        success: true,
        message: 'Payment approved internally but payment provider integration failed',
        data: {
          payment: result.rows[0],
          provider_error: providerError.message
        }
      });
    }
  } catch (error) {
    console.error('Approve payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const rejectPayment = async (req, res) => {
  try {
    const { payment_id } = req.params;
    const { rejection_reason } = req.body;
    const approved_by = req.user.id;
    
    if (!rejection_reason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }
    
    // Get payment details
    const paymentQuery = `SELECT * FROM issued_payments WHERE id = $1`;
    const paymentResult = await db.query(paymentQuery, [payment_id]);
    
    if (paymentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }
    
    const payment = paymentResult.rows[0];
    
    // Check if payment is still pending
    if (payment.approval_status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Payment has already been ${payment.approval_status}`
      });
    }
    
    // Ensure rejecter is different from initiator
    if (payment.initiated_by === approved_by) {
      return res.status(400).json({
        success: false,
        message: 'Self-rejection is not allowed'
      });
    }
    
    // Update payment status
    const updateQuery = `
      UPDATE issued_payments 
      SET approved_by = $1, approval_status = 'rejected', approved_at = CURRENT_TIMESTAMP, rejection_reason = $2
      WHERE id = $3
      RETURNING *
    `;
    
    const result = await db.query(updateQuery, [approved_by, rejection_reason, payment_id]);
    
    // Log the action
    await AuditLog.log({
      user_id: approved_by,
      action: 'PAYMENT_REJECTED',
      resource_type: 'issued_payment',
      resource_id: payment_id,
      details: { 
        amount: payment.amount, 
        purpose: payment.purpose,
        initiated_by: payment.initiated_by,
        recipient: payment.issued_to,
        rejection_reason
      }
    });
    
    res.json({
      success: true,
      message: 'Payment rejected successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Reject payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const getPendingPayments = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    const query = `
      SELECT p.*, 
             u1.full_name as initiated_by_name, u1.role as initiated_by_role,
             u2.full_name as recipient_name
      FROM issued_payments p
      JOIN users u1 ON p.initiated_by = u1.id
      JOIN users u2 ON p.issued_to = u2.id
      WHERE p.approval_status = 'pending'
      ORDER BY p.created_at DESC
      LIMIT $1 OFFSET $2
    `;
    
    const countQuery = `SELECT COUNT(*) FROM issued_payments WHERE approval_status = 'pending'`;
    
    const [paymentsResult, countResult] = await Promise.all([
      db.query(query, [limit, offset]),
      db.query(countQuery)
    ]);
    
    const total = parseInt(countResult.rows[0].count);
    
    res.json({
      success: true,
      data: {
        payments: paymentsResult.rows,
        pagination: {
          current_page: parseInt(page),
          per_page: parseInt(limit),
          total_pages: Math.ceil(total / limit),
          total_records: total
        }
      }
    });
  } catch (error) {
    console.error('Get pending payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const getPaymentHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, initiated_by, approved_by } = req.query;
    const offset = (page - 1) * limit;
    
    let whereConditions = [];
    let queryParams = [limit, offset];
    let paramCount = 2;
    
    if (status) {
      whereConditions.push(`p.approval_status = $${++paramCount}`);
      queryParams.push(status);
    }
    
    if (initiated_by) {
      whereConditions.push(`p.initiated_by = $${++paramCount}`);
      queryParams.push(initiated_by);
    }
    
    if (approved_by) {
      whereConditions.push(`p.approved_by = $${++paramCount}`);
      queryParams.push(approved_by);
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    const query = `
      SELECT p.*, 
             u1.full_name as initiated_by_name, u1.role as initiated_by_role,
             u2.full_name as recipient_name,
             u3.full_name as approved_by_name, u3.role as approved_by_role
      FROM issued_payments p
      JOIN users u1 ON p.initiated_by = u1.id
      JOIN users u2 ON p.issued_to = u2.id
      LEFT JOIN users u3 ON p.approved_by = u3.id
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT $1 OFFSET $2
    `;
    
    const countQuery = `SELECT COUNT(*) FROM issued_payments p ${whereClause}`;
    const countParams = queryParams.slice(2); // Remove limit and offset
    
    const [paymentsResult, countResult] = await Promise.all([
      db.query(query, queryParams),
      db.query(countQuery, countParams)
    ]);
    
    const total = parseInt(countResult.rows[0].count);
    
    res.json({
      success: true,
      data: {
        payments: paymentsResult.rows,
        pagination: {
          current_page: parseInt(page),
          per_page: parseInt(limit),
          total_pages: Math.ceil(total / limit),
          total_records: total
        }
      }
    });
  } catch (error) {
    console.error('Get payment history error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const getIssuedPayments = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      start_date, 
      end_date, 
      type,
      search 
    } = req.query;
    
    const offset = (page - 1) * limit;
    
    let whereConditions = ['p.approval_status = $3']; // Only approved payments
    let queryParams = [limit, offset, 'approved'];
    let paramCount = 3;
    
    if (start_date) {
      whereConditions.push(`p.created_at >= $${++paramCount}`);
      queryParams.push(start_date);
    }
    
    if (end_date) {
      whereConditions.push(`p.created_at <= $${++paramCount}`);
      queryParams.push(end_date);
    }
    
    if (type && type !== 'All') {
      whereConditions.push(`p.contribution_type ILIKE $${++paramCount}`);
      queryParams.push(`%${type}%`);
    }
    
    if (search) {
      whereConditions.push(`(u2.full_name ILIKE $${++paramCount} OR p.purpose ILIKE $${paramCount})`);
      queryParams.push(`%${search}%`);
    }
    
    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    
    const query = `
      SELECT p.id, 
             p.issued_to,
             p.amount,
             p.purpose,
             p.contribution_type as type,
             p.purpose as description,
             p.transaction_reference,
             p.created_at,
             p.approved_at as issued_at,
             u2.full_name as member_name,
             u2.phone_number as member_phone,
             u1.full_name as issued_by_name
      FROM issued_payments p
      JOIN users u1 ON p.initiated_by = u1.id
      JOIN users u2 ON p.issued_to = u2.id
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT $1 OFFSET $2
    `;
    
    const countQuery = `
      SELECT COUNT(*) 
      FROM issued_payments p
      JOIN users u1 ON p.initiated_by = u1.id
      JOIN users u2 ON p.issued_to = u2.id
      ${whereClause}
    `;
    const countParams = queryParams.slice(2); // Remove limit and offset
    
    const [paymentsResult, countResult] = await Promise.all([
      db.query(query, queryParams),
      db.query(countQuery, countParams)
    ]);
    
    const total = parseInt(countResult.rows[0].count);
    
    res.json({
      success: true,
      data: {
        payments: paymentsResult.rows,
        pagination: {
          current_page: parseInt(page),
          per_page: parseInt(limit),
          total_pages: Math.ceil(total / limit),
          total_records: total
        }
      }
    });
  } catch (error) {
    console.error('Get issued payments error:', error);
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
  performSystemMaintenance,
  // Dual authorization payment functions
  initiatePayment,
  approvePayment,
  rejectPayment,
  getPendingPayments,
  getPaymentHistory,
  getIssuedPayments
};
