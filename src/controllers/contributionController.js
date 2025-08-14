const db = require('../config/database');

const createContributionType = async (req, res) => {
  try {
    const { name, amount } = req.body;
    const createdBy = req.user.id;

    // Check if contribution type already exists
    const existingQuery = await db.query(
      'SELECT id FROM contribution_types WHERE name = $1',
      [name]
    );

    if (existingQuery.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Contribution type with this name already exists'
      });
    }

    const contributionResult = await db.query(
      `INSERT INTO contribution_types (name, amount, created_by)
       VALUES ($1, $2, $3) 
       RETURNING id, name, amount, is_active, created_at`,
      [name, amount, createdBy]
    );

    const contribution = contributionResult.rows[0];

    res.status(201).json({
      success: true,
      message: 'Contribution type created successfully',
      data: { contribution }
    });
  } catch (error) {
    console.error('Create contribution type error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const getContributionTypes = async (req, res) => {
  try {
    const { include_inactive = 'false' } = req.query;
    
    let query = `SELECT ct.id, ct.name, ct.amount, ct.is_active, ct.created_at,
                        u.full_name as created_by_name
                 FROM contribution_types ct
                 LEFT JOIN users u ON ct.created_by = u.id`;
    
    if (include_inactive === 'false') {
      query += ' WHERE ct.is_active = true';
    }
    
    query += ' ORDER BY ct.created_at DESC';

    const contributionsQuery = await db.query(query);

    res.json({
      success: true,
      data: { contribution_types: contributionsQuery.rows }
    });
  } catch (error) {
    console.error('Get contribution types error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const updateContributionType = async (req, res) => {
  try {
    const { contributionId } = req.params;
    const { name, amount, is_active } = req.body;

    const updateFields = [];
    const queryParams = [];
    let paramCount = 0;

    if (name !== undefined) {
      paramCount++;
      updateFields.push(`name = $${paramCount}`);
      queryParams.push(name);
    }

    if (amount !== undefined) {
      paramCount++;
      updateFields.push(`amount = $${paramCount}`);
      queryParams.push(amount);
    }

    if (is_active !== undefined) {
      paramCount++;
      updateFields.push(`is_active = $${paramCount}`);
      queryParams.push(is_active);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    paramCount++;
    queryParams.push(contributionId);

    const updateQuery = `
      UPDATE contribution_types 
      SET ${updateFields.join(', ')} 
      WHERE id = $${paramCount} 
      RETURNING id, name, amount, is_active, created_at`;

    const result = await db.query(updateQuery, queryParams);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Contribution type not found'
      });
    }

    res.json({
      success: true,
      message: 'Contribution type updated successfully',
      data: { contribution: result.rows[0] }
    });
  } catch (error) {
    console.error('Update contribution type error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const deleteContributionType = async (req, res) => {
  try {
    const { contributionId } = req.params;

    // Check if there are any payments associated with this contribution type
    const paymentsQuery = await db.query(
      'SELECT COUNT(*) FROM payments WHERE contribution_type_id = $1',
      [contributionId]
    );

    const paymentCount = parseInt(paymentsQuery.rows[0].count);

    if (paymentCount > 0) {
      // Don't delete, just deactivate
      const deactivateResult = await db.query(
        'UPDATE contribution_types SET is_active = false WHERE id = $1 RETURNING id, name',
        [contributionId]
      );

      if (deactivateResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Contribution type not found'
        });
      }

      return res.json({
        success: true,
        message: 'Contribution type deactivated (has associated payments)'
      });
    }

    // Safe to delete
    const deleteResult = await db.query(
      'DELETE FROM contribution_types WHERE id = $1 RETURNING id, name',
      [contributionId]
    );

    if (deleteResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Contribution type not found'
      });
    }

    res.json({
      success: true,
      message: 'Contribution type deleted successfully'
    });
  } catch (error) {
    console.error('Delete contribution type error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Admin: Issue contribution notification
const issueContributionNotification = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { title, message, contribution_type_id, due_date } = req.body;

    // Verify admin role
    if (!req.user.role.startsWith('admin_')) {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can issue contribution notifications'
      });
    }

    // Get contribution type details
    const contributionTypeQuery = await db.query(
      'SELECT * FROM contribution_types WHERE id = $1 AND is_active = true',
      [contribution_type_id]
    );

    if (contributionTypeQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Contribution type not found'
      });
    }

    const contributionType = contributionTypeQuery.rows[0];

    // Begin transaction
    await db.query('BEGIN');

    try {
      // Create notification
      const notificationResult = await db.query(
        `INSERT INTO notifications (sender_id, title, message, notification_type, contribution_type_id, due_date)
         VALUES ($1, $2, $3, 'contribution_request', $4, $5) RETURNING *`,
        [adminId, title, message, contribution_type_id, due_date]
      );

      const notification = notificationResult.rows[0];

      // Get all active members
      const membersQuery = await db.query(
        'SELECT id FROM users WHERE role = $1 AND is_active = true AND is_deleted = false',
        ['member']
      );

      // Handle different contribution types
      if (contributionType.name === 'Annual Membership Fee') {
        // For annual fees, check if user already paid this year
        for (const member of membersQuery.rows) {
          const existingStatusQuery = await db.query(
            `SELECT * FROM user_contribution_status ucs
             JOIN notifications n ON ucs.notification_id = n.id
             WHERE ucs.user_id = $1 AND ucs.contribution_type_id = $2 
             AND ucs.payment_status = 'paid'
             AND EXTRACT(YEAR FROM n.created_at) = EXTRACT(YEAR FROM CURRENT_DATE)`,
            [member.id, contribution_type_id]
          );

          // Only create new status if not already paid this year
          if (existingStatusQuery.rows.length === 0) {
            await db.query(
              `INSERT INTO user_contribution_status (user_id, notification_id, contribution_type_id, required_amount)
               VALUES ($1, $2, $3, $4)`,
              [member.id, notification.id, contribution_type_id, contributionType.amount]
            );
          }
        }
      } else {
        // For Emergency Fund and Special Project Fund, always create new requirements
        // but first mark previous notifications of same type as inactive
        await db.query(
          `UPDATE user_contribution_status SET payment_status = 'unpaid', paid_amount = 0.00
           WHERE contribution_type_id = $1 AND payment_status != 'paid'`,
          [contribution_type_id]
        );

        // Create new contribution requirements for all members
        for (const member of membersQuery.rows) {
          await db.query(
            `INSERT INTO user_contribution_status (user_id, notification_id, contribution_type_id, required_amount)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (user_id, notification_id, contribution_type_id) DO UPDATE SET
             required_amount = EXCLUDED.required_amount, payment_status = 'unpaid', paid_amount = 0.00`,
            [member.id, notification.id, contribution_type_id, contributionType.amount]
          );
        }
      }

      // Create notification reads for all users
      for (const member of membersQuery.rows) {
        await db.query(
          'INSERT INTO notification_reads (notification_id, user_id) VALUES ($1, $2)',
          [notification.id, member.id]
        );
      }

      await db.query('COMMIT');

      res.json({
        success: true,
        data: { notification },
        message: 'Contribution notification issued successfully'
      });

    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Issue contribution notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get user's contribution status for dashboard
const getUserContributionStatus = async (req, res) => {
  try {
    const userId = req.user.id;

    const statusQuery = await db.query(
      `SELECT 
         ucs.*,
         ct.name as contribution_name,
         ct.description as contribution_description,
         n.title as notification_title,
         n.message as notification_message,
         n.due_date,
         n.created_at as notification_date
       FROM user_contribution_status ucs
       JOIN contribution_types ct ON ucs.contribution_type_id = ct.id
       JOIN notifications n ON ucs.notification_id = n.id
       WHERE ucs.user_id = $1 AND n.is_active = true
       ORDER BY n.created_at DESC`,
      [userId]
    );

    const contributionStatus = statusQuery.rows.map(row => ({
      id: row.id,
      contribution_type: {
        id: row.contribution_type_id,
        name: row.contribution_name,
        description: row.contribution_description
      },
      required_amount: parseFloat(row.required_amount),
      paid_amount: parseFloat(row.paid_amount),
      payment_status: row.payment_status,
      due_date: row.due_date,
      notification: {
        title: row.notification_title,
        message: row.notification_message,
        date: row.notification_date
      },
      last_paid_at: row.last_paid_at
    }));

    res.json({
      success: true,
      data: contributionStatus
    });

  } catch (error) {
    console.error('Get user contribution status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update contribution status when payment is made
const updateContributionStatusOnPayment = async (paymentId, userId, contributionTypeId, amount) => {
  try {
    // Find the most recent contribution requirement for this type
    const statusQuery = await db.query(
      `SELECT * FROM user_contribution_status 
       WHERE user_id = $1 AND contribution_type_id = $2 
       ORDER BY created_at DESC LIMIT 1`,
      [userId, contributionTypeId]
    );

    if (statusQuery.rows.length > 0) {
      const status = statusQuery.rows[0];
      const newPaidAmount = parseFloat(status.paid_amount) + parseFloat(amount);
      const requiredAmount = parseFloat(status.required_amount);

      let paymentStatus = 'partial';
      if (newPaidAmount >= requiredAmount) {
        paymentStatus = 'paid';
      } else if (newPaidAmount > 0) {
        paymentStatus = 'partial';
      }

      await db.query(
        `UPDATE user_contribution_status 
         SET paid_amount = $1, payment_status = $2, last_payment_id = $3, last_paid_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [newPaidAmount, paymentStatus, paymentId, status.id]
      );
    }
  } catch (error) {
    console.error('Update contribution status error:', error);
  }
};

// Get contribution statistics for admin
const getContributionStatistics = async (req, res) => {
  try {
    const statsQuery = await db.query(`
      SELECT 
        ct.name as contribution_type,
        COUNT(ucs.id) as total_members,
        COUNT(CASE WHEN ucs.payment_status = 'paid' THEN 1 END) as paid_count,
        COUNT(CASE WHEN ucs.payment_status = 'unpaid' THEN 1 END) as unpaid_count,
        COUNT(CASE WHEN ucs.payment_status = 'partial' THEN 1 END) as partial_count,
        SUM(ucs.required_amount) as total_required,
        SUM(ucs.paid_amount) as total_collected
      FROM user_contribution_status ucs
      JOIN contribution_types ct ON ucs.contribution_type_id = ct.id
      JOIN notifications n ON ucs.notification_id = n.id
      WHERE n.is_active = true
      GROUP BY ct.id, ct.name
      ORDER BY ct.name
    `);

    res.json({
      success: true,
      data: statsQuery.rows
    });

  } catch (error) {
    console.error('Get contribution statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  createContributionType,
  getContributionTypes,
  updateContributionType,
  deleteContributionType,
  issueContributionNotification,
  getUserContributionStatus,
  updateContributionStatusOnPayment,
  getContributionStatistics
};
