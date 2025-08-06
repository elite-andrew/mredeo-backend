const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticateToken } = require('../middleware/auth');
const { isMember, canIssuePayments } = require('../middleware/rbac');
const { validatePayment } = require('../middleware/validation');
const { auditMiddleware } = require('../middleware/audit');

// All payment routes require authentication
router.use(authenticateToken);

// Member routes
router.post('/', 
  isMember, 
  validatePayment, 
  auditMiddleware.paymentMade, 
  paymentController.makePayment
);

router.get('/history', 
  isMember, 
  paymentController.getPaymentHistory
);

router.get('/:paymentId', 
  isMember, 
  paymentController.getPaymentDetails
);

// Admin routes
router.post('/issue', 
  canIssuePayments, 
  auditMiddleware.paymentIssued, 
  paymentController.issuePayment
);

router.get('/admin/report', 
  canIssuePayments, 
  paymentController.getPaymentsReport
);

module.exports = router;
