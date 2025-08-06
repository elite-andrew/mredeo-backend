const db = require('../config/database');
const { AUDIT_ACTIONS } = require('../config/constants');

const auditLogger = (action) => {
  return async (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      // Only log successful operations (2xx status codes)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        logAction(req, action, data);
      }
      originalSend.call(this, data);
    };
    
    next();
  };
};

const logAction = async (req, action, responseData) => {
  try {
    const userId = req.user ? req.user.id : null;
    const metadata = {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      method: req.method,
      endpoint: req.originalUrl,
      params: req.params,
      body: sanitizeLogData(req.body),
      timestamp: new Date().toISOString()
    };

    // Extract target_id from response or params
    let targetId = null;
    if (responseData && typeof responseData === 'string') {
      try {
        const parsedResponse = JSON.parse(responseData);
        if (parsedResponse.data && parsedResponse.data.id) {
          targetId = parsedResponse.data.id;
        }
      } catch (e) {
        // Response is not JSON, ignore
      }
    }

    await db.query(
      'INSERT INTO audit_logs (user_id, action, target_id, metadata) VALUES ($1, $2, $3, $4)',
      [userId, action, targetId, JSON.stringify(metadata)]
    );
  } catch (error) {
    console.error('Audit logging error:', error);
    // Don't throw error to avoid breaking the main request flow
  }
};

const sanitizeLogData = (data) => {
  if (!data || typeof data !== 'object') return data;
  
  const sanitized = { ...data };
  const sensitiveFields = ['password', 'password_hash', 'otp_code', 'token'];
  
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });
  
  return sanitized;
};

// Pre-defined audit middleware for common actions
const auditMiddleware = {
  userSignup: auditLogger(AUDIT_ACTIONS.USER_SIGNUP),
  userLogin: auditLogger(AUDIT_ACTIONS.USER_LOGIN),
  userLogout: auditLogger(AUDIT_ACTIONS.USER_LOGOUT),
  passwordReset: auditLogger(AUDIT_ACTIONS.PASSWORD_RESET),
  profileUpdate: auditLogger(AUDIT_ACTIONS.PROFILE_UPDATE),
  paymentMade: auditLogger(AUDIT_ACTIONS.PAYMENT_MADE),
  paymentIssued: auditLogger(AUDIT_ACTIONS.PAYMENT_ISSUED),
  notificationSent: auditLogger(AUDIT_ACTIONS.NOTIFICATION_SENT)
};

module.exports = {
  auditLogger,
  auditMiddleware
};
