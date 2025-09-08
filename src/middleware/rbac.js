const { USER_ROLES } = require('../config/constants');
const db = require('../config/database');

// Enhanced admin check that verifies role from database
const isAdmin = async (req, res, next) => {
  try {
    const adminRoles = [
      USER_ROLES.ADMIN_CHAIRPERSON,
      USER_ROLES.ADMIN_SECRETARY,
      USER_ROLES.ADMIN_SIGNATORY,
      USER_ROLES.ADMIN_TREASURER
    ];
    
    // Always check role from database for authoritative source
    const userQuery = await db.query(
      'SELECT role FROM users WHERE id = $1 AND is_active = true AND is_deleted = false',
      [req.user.id]
    );
    
    if (userQuery.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'User not found or inactive'
      });
    }
    
    const dbRole = userQuery.rows[0].role;
    
    // Log role validation for debugging
    console.log(`Role validation - User ${req.user.id}: Token role = ${req.user.role}, DB role = ${dbRole}`);
    
    // Use database role as authoritative source
    req.user.authoritative_role = dbRole;
    
    if (!adminRoles.includes(dbRole)) {
      console.log(`Access denied - User ${req.user.id} with role ${dbRole} attempted admin access`);
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }
    
    next();
  } catch (error) {
    console.error('Role validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Role validation failed'
    });
  }
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
