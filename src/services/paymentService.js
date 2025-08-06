const db = require('../config/database');

const getServiceStatus = async () => {
  try {
    // Check database connection
    const dbResult = await db.query('SELECT NOW() as current_time');
    
    return {
      database: {
        status: 'healthy',
        connection: 'active',
        timestamp: dbResult.rows[0].current_time
      },
      api: {
        status: 'healthy',
        version: process.env.API_VERSION || 'v1'
      },
      server: {
        status: 'healthy',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        environment: process.env.NODE_ENV || 'development'
      }
    };
  } catch (error) {
    return {
      database: {
        status: 'unhealthy',
        error: error.message
      },
      api: {
        status: 'degraded'
      },
      server: {
        status: 'unhealthy',
        uptime: process.uptime()
      }
    };
  }
};

const recordPaymentActivity = async (userId, action, amount = null) => {
  try {
    await db.query(
      'INSERT INTO payment_activities (user_id, action, amount, recorded_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)',
      [userId, action, amount]
    );
  } catch (error) {
    console.error('Error recording payment activity:', error);
  }
};

const generateReport = async (type, startDate, endDate) => {
  try {
    let query;
    let params = [];

    switch (type) {
      case 'payments':
        query = `
          SELECT 
            DATE(created_at) as date,
            COUNT(*) as total_payments,
            SUM(amount_paid) as total_amount,
            payment_status
          FROM payments 
          WHERE created_at BETWEEN $1 AND $2
          GROUP BY DATE(created_at), payment_status
          ORDER BY date DESC
        `;
        params = [startDate, endDate];
        break;
        
      case 'users':
        query = `
          SELECT 
            DATE(created_at) as date,
            COUNT(*) as new_users,
            role
          FROM users 
          WHERE created_at BETWEEN $1 AND $2
          GROUP BY DATE(created_at), role
          ORDER BY date DESC
        `;
        params = [startDate, endDate];
        break;
        
      default:
        throw new Error('Invalid report type');
    }

    const result = await db.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('Error generating report:', error);
    throw error;
  }
};

module.exports = {
  getServiceStatus,
  recordPaymentActivity,
  generateReport
};
