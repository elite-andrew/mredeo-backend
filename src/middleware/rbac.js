const { USER_ROLES } = require('../config/constants');

const isAdmin = (req, res, next) => {
  const adminRoles = [
    USER_ROLES.ADMIN_CHAIRPERSON,
    USER_ROLES.ADMIN_SECRETARY,
    USER_ROLES.ADMIN_SIGNATORY
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
  const authorizedRoles = [
    USER_ROLES.ADMIN_CHAIRPERSON,
    USER_ROLES.ADMIN_SIGNATORY
  ];
  
  if (!authorizedRoles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Payment issuance requires chairperson or signatory role'
    });
  }
  
  next();
};

module.exports = {
  isAdmin,
  isMember,
  hasRole,
  canIssuePayments
};
