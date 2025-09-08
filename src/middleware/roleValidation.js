const db = require('../config/database');

// Middleware to validate role consistency and prevent unauthorized role changes
const validateRoleConsistency = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // Get the current role from database
    const userQuery = await db.query(
      'SELECT role FROM users WHERE id = $1 AND is_active = true AND is_deleted = false',
      [userId]
    );
    
    if (userQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found or inactive'
      });
    }
    
    const dbRole = userQuery.rows[0].role;
    
    // Add database role to request for consistency checking
    req.user.dbRole = dbRole;
    
    // Log role access for audit trail
    console.log(`Role validation - User ${userId}: DB role = ${dbRole}, Token role = ${req.user.role}`);
    
    next();
  } catch (error) {
    console.error('Role validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Role validation failed'
    });
  }
};

// Middleware to ensure only admins can access admin endpoints
const requireAdmin = (req, res, next) => {
  const role = req.user.dbRole || req.user.role;
  
  if (!role || !isAdminRole(role)) {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
  
  next();
};

// Helper function to check if role is admin
const isAdminRole = (role) => {
  if (!role) return false;
  const adminRoles = ['admin_chairperson', 'admin_secretary', 'admin_signatory', 'admin_treasurer'];
  return adminRoles.includes(role.toLowerCase());
};

// Middleware to log role changes
const logRoleChange = async (req, res, next) => {
  const originalJson = res.json;
  
  res.json = function(data) {
    // If this is a successful profile update, log it
    if (data.success && req.body && req.body.role) {
      const userId = req.user.id;
      const oldRole = req.user.dbRole || req.user.role;
      const newRole = req.body.role;
      
      if (oldRole !== newRole) {
        console.log(`ROLE CHANGE: User ${userId} role changed from ${oldRole} to ${newRole} by user ${req.user.id}`);
        
        // Insert audit log (you may want to create an audit_logs table)
        db.query(
          'INSERT INTO audit_logs (user_id, action, old_value, new_value, changed_by, created_at) VALUES ($1, $2, $3, $4, $5, NOW())',
          [userId, 'role_change', oldRole, newRole, req.user.id]
        ).catch(err => console.error('Failed to log role change:', err));
      }
    }
    
    originalJson.call(this, data);
  };
  
  next();
};

module.exports = {
  validateRoleConsistency,
  requireAdmin,
  isAdminRole,
  logRoleChange
};
