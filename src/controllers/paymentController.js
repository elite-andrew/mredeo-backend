const db = require('../config/database');
const { PAYMENT_STATUS } = require('../config/constants');

const makePayment = async (req, res) => {
  try {
    const { contribution_type_id, amount_paid, telco, phone_number_used } = req.body;
    const userId = req.user.id;

    // Verify contribution type exists and is active
    const contributionQuery = await db.query(
      'SELECT id, name, amount FROM contribution_types WHERE id = $1 AND is_active = true',
      [contribution_type_id]
    );

    if (contributionQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Contribution type not found or inactive'
      });
    }

    const contributionType = contributionQuery.rows[0];

    // Validate amount
    if (parseFloat(amount_paid) < parseFloat(contributionType.amount)) {
      return res.status(400).json({
        success: false,
        message: `Minimum payment amount is ${contributionType.amount}`
      });
    }

    // Generate transaction reference
    const transactionRef = `MREDEO-${Date.now()}-${userId.substring(0, 8)}`;

    // Create payment record
    const paymentResult = await db.query(
      `INSERT INTO payments (user_id, contribution_type_id, amount_paid, telco, phone_number_used, transaction_reference, payment_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING id, transaction_reference, created_at`,
      [userId, contribution_type_id, amount_paid, telco, phone_number_used, transactionRef, PAYMENT_STATUS.PENDING]
    );

    const payment = paymentResult.rows[0];

    // TODO: Integrate with actual payment gateway here
    // For now, we'll simulate payment processing
    
    res.status(201).json({
      success: true,
      message: 'Payment initiated successfully',
      data: {
        payment_id: payment.id,
        transaction_reference: payment.transaction_reference,
        amount: amount_paid,
        status: PAYMENT_STATUS.PENDING,
        created_at: payment.created_at
      }
    });
  } catch (error) {
    console.error('Payment creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const getPaymentHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const paymentsQuery = await db.query(
      `SELECT p.id, p.amount_paid, p.payment_status, p.telco, p.phone_number_used,
              p.transaction_reference, p.paid_at, p.created_at,
              ct.name as contribution_name, ct.amount as contribution_amount
       FROM payments p
       JOIN contribution_types ct ON p.contribution_type_id = ct.id
       WHERE p.user_id = $1
       ORDER BY p.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const totalQuery = await db.query(
      'SELECT COUNT(*) FROM payments WHERE user_id = $1',
      [userId]
    );

    const payments = paymentsQuery.rows;
    const total = parseInt(totalQuery.rows[0].count);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        payments,
        pagination: {
          current_page: parseInt(page),
          total_pages: totalPages,
          total_records: total,
          per_page: parseInt(limit)
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

const getPaymentDetails = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const userId = req.user.id;

    const paymentQuery = await db.query(
      `SELECT p.*, ct.name as contribution_name, ct.amount as contribution_amount
       FROM payments p
       JOIN contribution_types ct ON p.contribution_type_id = ct.id
       WHERE p.id = $1 AND p.user_id = $2`,
      [paymentId, userId]
    );

    if (paymentQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    res.json({
      success: true,
      data: { payment: paymentQuery.rows[0] }
    });
  } catch (error) {
    console.error('Get payment details error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Admin-only: Issue payments to members
const issuePayment = async (req, res) => {
  try {
    const { issued_to, amount, purpose } = req.body;
    const issuedBy = req.user.id;

    // Verify recipient exists and is a member
    const recipientQuery = await db.query(
      'SELECT id, full_name, role FROM users WHERE id = $1 AND role = $2 AND is_active = true',
      [issued_to, 'member']
    );

    if (recipientQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    const recipient = recipientQuery.rows[0];
    const transactionRef = `MREDEO-ISSUED-${Date.now()}-${issuedBy.substring(0, 8)}`;

    const issuedPaymentResult = await db.query(
      `INSERT INTO issued_payments (issued_by, issued_to, amount, purpose, transaction_reference)
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, transaction_reference, issued_at`,
      [issuedBy, issued_to, amount, purpose, transactionRef]
    );

    const issuedPayment = issuedPaymentResult.rows[0];

    res.status(201).json({
      success: true,
      message: `Payment of ${amount} issued successfully to ${recipient.full_name}`,
      data: {
        issued_payment_id: issuedPayment.id,
        transaction_reference: issuedPayment.transaction_reference,
        issued_to: recipient.full_name,
        amount,
        purpose,
        issued_at: issuedPayment.issued_at
      }
    });
  } catch (error) {
    console.error('Issue payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Admin-only: Get all payments report
const getPaymentsReport = async (req, res) => {
  try {
    const { 
      start_date, 
      end_date, 
      status, 
      contribution_type_id,
      page = 1, 
      limit = 20 
    } = req.query;

    let whereConditions = [];
    let queryParams = [];
    let paramCount = 0;

    if (start_date) {
      paramCount++;
      whereConditions.push(`p.created_at >= $${paramCount}`);
      queryParams.push(start_date);
    }

    if (end_date) {
      paramCount++;
      whereConditions.push(`p.created_at <= $${paramCount}`);
      queryParams.push(end_date);
    }

    if (status) {
      paramCount++;
      whereConditions.push(`p.payment_status = $${paramCount}`);
      queryParams.push(status);
    }

    if (contribution_type_id) {
      paramCount++;
      whereConditions.push(`p.contribution_type_id = $${paramCount}`);
      queryParams.push(contribution_type_id);
    }

    const whereClause = whereConditions.length > 0 ? 
      'WHERE ' + whereConditions.join(' AND ') : '';

    const offset = (page - 1) * limit;
    paramCount++;
    queryParams.push(limit);
    paramCount++;
    queryParams.push(offset);

    const paymentsQuery = await db.query(
      `SELECT p.id, p.amount_paid, p.payment_status, p.telco, p.transaction_reference,
              p.paid_at, p.created_at, u.full_name, u.username, ct.name as contribution_name
       FROM payments p
       JOIN users u ON p.user_id = u.id
       JOIN contribution_types ct ON p.contribution_type_id = ct.id
       ${whereClause}
       ORDER BY p.created_at DESC
       LIMIT $${paramCount-1} OFFSET $${paramCount}`,
      queryParams
    );

    // Get summary statistics
    const summaryQuery = await db.query(
      `SELECT 
         COUNT(*) as total_payments,
         SUM(CASE WHEN payment_status = 'success' THEN amount_paid ELSE 0 END) as total_amount_success,
         SUM(CASE WHEN payment_status = 'pending' THEN amount_paid ELSE 0 END) as total_amount_pending,
         COUNT(CASE WHEN payment_status = 'success' THEN 1 END) as successful_payments,
         COUNT(CASE WHEN payment_status = 'pending' THEN 1 END) as pending_payments,
         COUNT(CASE WHEN payment_status = 'failed' THEN 1 END) as failed_payments
       FROM payments p ${whereClause}`,
      queryParams.slice(0, -2) // Remove limit and offset for summary
    );

    res.json({
      success: true,
      data: {
        payments: paymentsQuery.rows,
        summary: summaryQuery.rows[0],
        pagination: {
          current_page: parseInt(page),
          per_page: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get payments report error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  makePayment,
  getPaymentHistory,
  getPaymentDetails,
  issuePayment,
  getPaymentsReport
};
