const { USER_ROLES } = require('../config/constants');

const isAdmin = (req, res, next) => {
  const adminRoles = [
    USER_ROLES.ADMIN_CHAIRPERSON,
    USER_ROLES.ADMIN_SECRETARY,
    USER_ROLES.ADMIN_SIGNATORY,
    USER_ROLES.ADMIN_TREASURER
  ];
  
  if (!adminRoles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
  
  next();
};

const isMember = (req, res, next) => {
  if (req.user.role !== USER_ROLES.MEMBER) {
    return res.status(403).json({
      success: false,
      message: 'Member access required'
    });
  }
  
  next();
};

const hasRole = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }
    
    next();
  };
};

const canIssuePayments = (req, res, next) => {
  // Financial authorities who can initiate payments
  const financialAuthorities = [
    USER_ROLES.ADMIN_CHAIRPERSON,
    USER_ROLES.ADMIN_SECRETARY,
    USER_ROLES.ADMIN_TREASURER
  ];
  
  // Check if user has financial authority
  if (!financialAuthorities.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Payment issuance requires chairperson, secretary, or treasurer role'
    });
  }
  
  next();
};

const canSignPayments = (req, res, next) => {
  // Only signatories can sign/approve payments
  if (req.user.role !== USER_ROLES.ADMIN_SIGNATORY) {
    return res.status(403).json({
      success: false,
      message: 'Payment signing requires signatory role'
    });
  }
  
  next();
};

// Middleware for dual authorization - both financial authority and signatory required
const requiresDualAuthorization = (req, res, next) => {
  const { initiatedBy, approvedBy } = req.body;
  
  // Check if both initiator and approver are provided
  if (!initiatedBy || !approvedBy) {
    return res.status(400).json({
      success: false,
      message: 'Both initiator and approver are required for payment authorization'
    });
  }
  
  // Ensure they are different people (no self-approval)
  if (initiatedBy === approvedBy) {
    return res.status(400).json({
      success: false,
      message: 'Self-approval is not allowed. Initiator and approver must be different users.'
    });
  }
  
  // Note: The actual role validation for initiator and approver should be done 
  // in the controller by fetching their user records and checking roles
  next();
};

module.exports = {
  isAdmin,
  isMember,
  hasRole,
  canIssuePayments,
  canSignPayments,
  requiresDualAuthorization
};
