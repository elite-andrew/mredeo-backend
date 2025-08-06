const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticateToken } = require('../middleware/auth');
const { isAdmin } = require('../middleware/rbac');
const { validateNotification } = require('../middleware/validation');
const { auditMiddleware } = require('../middleware/audit');

// All notification routes require authentication
router.use(authenticateToken);

// Member routes
router.get('/', notificationController.getNotifications);

router.put('/:notificationId/read', 
  notificationController.markNotificationAsRead
);

router.put('/read-all', 
  notificationController.markAllNotificationsAsRead
);

// Admin routes
router.post('/', 
  isAdmin, 
  validateNotification, 
  auditMiddleware.notificationSent, 
  notificationController.sendNotification
);

module.exports = router;
