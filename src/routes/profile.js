const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const { authenticateToken } = require('../middleware/auth');
const { validateProfileUpdate } = require('../middleware/validation');
const { auditMiddleware } = require('../middleware/audit');

// All profile routes require authentication
router.use(authenticateToken);

router.get('/', profileController.getProfile);

router.put('/', 
  validateProfileUpdate, 
  auditMiddleware.profileUpdate, 
  profileController.updateProfile
);

router.post('/upload-picture', 
  auditMiddleware.profileUpdate, 
  profileController.uploadProfilePicture
);

router.put('/change-password', 
  auditMiddleware.profileUpdate, 
  profileController.changePassword
);

router.put('/settings', 
  profileController.updateSettings
);

router.delete('/delete-account', 
  profileController.deleteAccount
);

// GDPR compliance
router.get('/export-data', 
  profileController.exportUserData
);

module.exports = router;
