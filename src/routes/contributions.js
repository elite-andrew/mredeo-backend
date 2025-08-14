const express = require('express');
const router = express.Router();
const contributionController = require('../controllers/contributionController');
const { authenticateToken } = require('../middleware/auth');
const { isAdmin } = require('../middleware/rbac');

// All contribution routes require authentication
router.use(authenticateToken);

// Public route for members to view contribution types
router.get('/', contributionController.getContributionTypes);

// Member route to get their contribution status
router.get('/status', contributionController.getUserContributionStatus);

// Admin-only routes
router.post('/', 
  isAdmin, 
  contributionController.createContributionType
);

router.post('/issue-notification',
  isAdmin,
  contributionController.issueContributionNotification
);

router.get('/statistics',
  isAdmin,
  contributionController.getContributionStatistics
);

router.put('/:contributionId', 
  isAdmin, 
  contributionController.updateContributionType
);

router.delete('/:contributionId', 
  isAdmin, 
  contributionController.deleteContributionType
);

module.exports = router;
