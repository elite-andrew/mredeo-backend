const db = require('../config/database');

class Payment {
  static async create(paymentData) {
    try {
      const { 
        user_id, 
        contribution_type_id, 
        amount_paid, 
        telco, 
        phone_number_used, 
        transaction_reference, 
        payment_status = 'pending' 
      } = paymentData;
      
      const result = await db.query(
        `INSERT INTO payments (user_id, contribution_type_id, amount_paid, telco, phone_number_used, transaction_reference, payment_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, transaction_reference, created_at`,
        [user_id, contribution_type_id, amount_paid, telco, phone_number_used, transaction_reference, payment_status]
      );
      
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  static async findById(id) {
    try {
      const result = await db.query(
        `SELECT p.*, ct.name as contribution_name, ct.amount as contribution_amount,
                u.full_name as user_name, u.username
         FROM payments p
         JOIN contribution_types ct ON p.contribution_type_id = ct.id
         JOIN users u ON p.user_id = u.id
         WHERE p.id = $1`,
        [id]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  static async findByTransactionRef(transactionRef) {
    try {
      const result = await db.query(
        'SELECT * FROM payments WHERE transaction_reference = $1',
        [transactionRef]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  static async updateStatus(id, status, paidAt = null) {
    try {
      const result = await db.query(
        'UPDATE payments SET payment_status = $1, paid_at = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
        [status, paidAt, id]
      );
      
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  static async getUserPayments(userId, filters = {}) {
    try {
      const { page = 1, limit = 10, status, contribution_type_id } = filters;
      const offset = (page - 1) * limit;

      let whereConditions = ['p.user_id = $1'];
      let queryParams = [userId];
      let paramCount = 1;

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

      const whereClause = whereConditions.join(' AND ');

      // Get payments
      paramCount++;
      queryParams.push(limit);
      paramCount++;
      queryParams.push(offset);

      const paymentsResult = await db.query(
        `SELECT p.id, p.amount_paid, p.payment_status, p.telco, p.phone_number_used,
                p.transaction_reference, p.paid_at, p.created_at,
                ct.name as contribution_name, ct.amount as contribution_amount
         FROM payments p
         JOIN contribution_types ct ON p.contribution_type_id = ct.id
         WHERE ${whereClause}
         ORDER BY p.created_at DESC
         LIMIT $${paramCount - 1} OFFSET $${paramCount}`,
        queryParams
      );

      // Get total count
      const countResult = await db.query(
        `SELECT COUNT(*) FROM payments p WHERE ${whereClause}`,
        queryParams.slice(0, -2)
      );

      return {
        payments: paymentsResult.rows,
        total: parseInt(countResult.rows[0].count)
      };
    } catch (error) {
      throw error;
    }
  }

  static async getPaymentStats(userId = null) {
    try {
      let query = `
        SELECT 
          COUNT(*) as total_payments,
          SUM(CASE WHEN payment_status = 'success' THEN amount_paid ELSE 0 END) as total_amount_success,
          SUM(CASE WHEN payment_status = 'pending' THEN amount_paid ELSE 0 END) as total_amount_pending,
          COUNT(CASE WHEN payment_status = 'success' THEN 1 END) as successful_payments,
          COUNT(CASE WHEN payment_status = 'pending' THEN 1 END) as pending_payments,
          COUNT(CASE WHEN payment_status = 'failed' THEN 1 END) as failed_payments,
          AVG(CASE WHEN payment_status = 'success' THEN amount_paid END) as average_payment_amount
        FROM payments`;

      const queryParams = [];
      
      if (userId) {
        query += ' WHERE user_id = $1';
        queryParams.push(userId);
      }

      const result = await db.query(query, queryParams);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  static async getMonthlyPaymentReport(year = new Date().getFullYear()) {
    try {
      const result = await db.query(`
        SELECT 
          EXTRACT(MONTH FROM created_at) as month,
          COUNT(*) as payment_count,
          SUM(CASE WHEN payment_status = 'success' THEN amount_paid ELSE 0 END) as total_amount,
          COUNT(CASE WHEN payment_status = 'success' THEN 1 END) as successful_count
        FROM payments 
        WHERE EXTRACT(YEAR FROM created_at) = $1
        GROUP BY EXTRACT(MONTH FROM created_at)
        ORDER BY month`,
        [year]
      );

      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  static async getTopContributors(limit = 10) {
    try {
      const result = await db.query(`
        SELECT 
          u.id,
          u.full_name,
          u.username,
          COUNT(p.id) as payment_count,
          SUM(p.amount_paid) as total_contributed
        FROM users u
        JOIN payments p ON u.id = p.user_id
        WHERE p.payment_status = 'success'
        GROUP BY u.id, u.full_name, u.username
        ORDER BY total_contributed DESC
        LIMIT $1`,
        [limit]
      );

      return result.rows;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Payment;
