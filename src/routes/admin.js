const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateToken } = require('../middleware/auth');
const { isAdmin, canIssuePayments, canSignPayments } = require('../middleware/rbac');

// All admin routes require authentication and admin role
router.use(authenticateToken);
router.use(isAdmin);

// Dashboard and analytics
router.get('/dashboard/stats', adminController.getDashboardStats);
router.get('/analytics/payments', adminController.getPaymentAnalytics);
router.get('/activities/recent', adminController.getRecentActivities);

// User management
router.get('/users', adminController.getAllUsers);
router.get('/users/:userId', adminController.getUserDetails);
router.put('/users/:userId/role', adminController.updateUserRole);
router.put('/users/:userId/status', adminController.toggleUserStatus);
router.delete('/users/:userId', adminController.deleteUser);

// System monitoring
router.get('/audit-logs', adminController.getSystemAuditLogs);
router.get('/security-events', adminController.getSecurityEvents);

// Data export
router.get('/export/users', adminController.exportUserData);

// System maintenance
router.post('/maintenance', adminController.performSystemMaintenance);

// Dual Authorization Payment System
// Routes for financial authorities (chairperson, secretary, treasurer)
router.post('/payments/initiate', canIssuePayments, adminController.initiatePayment);
router.get('/payments/history', adminController.getPaymentHistory);
router.get('/payments/issued', adminController.getIssuedPayments);

// Routes for signatories (signatory role only)
router.get('/payments/pending', canSignPayments, adminController.getPendingPayments);
router.put('/payments/:payment_id/approve', canSignPayments, adminController.approvePayment);
router.put('/payments/:payment_id/reject', canSignPayments, adminController.rejectPayment);

module.exports = router;
