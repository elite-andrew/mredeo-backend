const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateToken } = require('../middleware/auth');
const { isAdmin } = require('../middleware/rbac');

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

module.exports = router;
