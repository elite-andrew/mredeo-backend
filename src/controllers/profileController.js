// Passwords are managed by Firebase Authentication; no bcrypt checks needed here.
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const db = require('../config/database');
const config = require('../config/environment');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.upload.path);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `profile-${req.user.id}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, JPG, PNG, GIF) are allowed'));
    }
  },
  limits: {
    fileSize: config.upload.maxFileSize
  }
});

const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const profileQuery = await db.query(
      `SELECT u.id, u.full_name, u.username, u.email, u.phone_number, 
              u.profile_picture, u.role, u.created_at,
              us.language, us.dark_mode, us.notifications_enabled, us.consent_to_terms
       FROM users u
       LEFT JOIN user_settings us ON u.id = us.user_id
       WHERE u.id = $1`,
      [userId]
    );

    if (profileQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const profile = profileQuery.rows[0];

    res.json({
      success: true,
      data: { profile }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { full_name, email } = req.body;

    const updateFields = [];
    const queryParams = [];
    let paramCount = 0;

    if (full_name !== undefined) {
      paramCount++;
      updateFields.push(`full_name = $${paramCount}`);
      queryParams.push(full_name);
    }

    if (email !== undefined) {
      // Check if email is already taken by another user
      const emailCheck = await db.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, userId]
      );

      if (emailCheck.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Email is already taken'
        });
      }

      paramCount++;
      updateFields.push(`email = $${paramCount}`);
      queryParams.push(email);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    paramCount++;
    queryParams.push(userId);

    const updateQuery = `
      UPDATE users 
      SET ${updateFields.join(', ')} 
      WHERE id = $${paramCount} 
      RETURNING id, full_name, username, email, phone_number, profile_picture, role`;

    const result = await db.query(updateQuery, queryParams);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { profile: result.rows[0] }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const uploadProfilePicture = async (req, res) => {
  upload.single('profile_picture')(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: 'File size too large. Maximum size is 5MB'
          });
        }
      }
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    try {
      const userId = req.user.id;
      const filename = req.file.filename;
      const filepath = `/uploads/${filename}`;

      // Get current profile picture to delete old one
      const currentProfileQuery = await db.query(
        'SELECT profile_picture FROM users WHERE id = $1',
        [userId]
      );

      // Update profile picture in database
      await db.query(
        'UPDATE users SET profile_picture = $1 WHERE id = $2',
        [filepath, userId]
      );

      // Delete old profile picture if exists
      if (currentProfileQuery.rows[0]?.profile_picture) {
        const oldFilePath = path.join(process.cwd(), currentProfileQuery.rows[0].profile_picture);
        try {
          await fs.unlink(oldFilePath);
        } catch (deleteError) {
          console.error('Error deleting old profile picture:', deleteError);
          // Don't fail the request if old file deletion fails
        }
      }

      res.json({
        success: true,
        message: 'Profile picture updated successfully',
        data: {
          profile_picture: filepath
        }
      });
    } catch (error) {
      console.error('Upload profile picture error:', error);
      
      // Clean up uploaded file on error
      try {
        await fs.unlink(req.file.path);
      } catch (deleteError) {
        console.error('Error cleaning up uploaded file:', deleteError);
      }
      
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  });
};

const changePassword = async (req, res) => {
  // Redirect password changes to Firebase client SDK
  return res.status(400).json({
    success: false,
    message: 'Change password via Firebase Authentication on the client.'
  });
};

const updateSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    const { language, dark_mode, notifications_enabled } = req.body;

    // Check if user settings exist
    const existingSettings = await db.query(
      'SELECT id FROM user_settings WHERE user_id = $1',
      [userId]
    );

    const updateFields = [];
    const queryParams = [];
    let paramCount = 0;

    if (language !== undefined) {
      paramCount++;
      updateFields.push(`language = $${paramCount}`);
      queryParams.push(language);
    }

    if (dark_mode !== undefined) {
      paramCount++;
      updateFields.push(`dark_mode = $${paramCount}`);
      queryParams.push(dark_mode);
    }

    if (notifications_enabled !== undefined) {
      paramCount++;
      updateFields.push(`notifications_enabled = $${paramCount}`);
      queryParams.push(notifications_enabled);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No settings to update'
      });
    }

    paramCount++;
    queryParams.push(userId);

    if (existingSettings.rows.length > 0) {
      // Update existing settings
      const updateQuery = `
        UPDATE user_settings 
        SET ${updateFields.join(', ')} 
        WHERE user_id = $${paramCount} 
        RETURNING language, dark_mode, notifications_enabled, consent_to_terms`;

      const result = await db.query(updateQuery, queryParams);
      
      res.json({
        success: true,
        message: 'Settings updated successfully',
        data: { settings: result.rows[0] }
      });
    } else {
      // Create new settings record
      const insertQuery = `
        INSERT INTO user_settings (user_id, ${updateFields.map(field => field.split(' = ')[0]).join(', ')})
        VALUES ($${paramCount}, ${updateFields.map((_, index) => `$${index + 1}`).join(', ')})
        RETURNING language, dark_mode, notifications_enabled, consent_to_terms`;

      const result = await db.query(insertQuery, queryParams);
      
      res.json({
        success: true,
        message: 'Settings created successfully',
        data: { settings: result.rows[0] }
      });
    }
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const deleteAccount = async (req, res) => {
  try {
    const userId = req.user.id;
    // Soft delete - mark as deleted instead of actual deletion
    await db.query(
      'UPDATE users SET is_deleted = true, is_active = false WHERE id = $1',
      [userId]
    );
    res.json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GDPR - Export user data
const exportUserData = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user data
    const userData = await db.query(
      'SELECT id, full_name, username, email, phone_number, role, created_at FROM users WHERE id = $1',
      [userId]
    );

    // Get payment history
    const paymentsData = await db.query(
      'SELECT amount_paid, payment_status, telco, transaction_reference, paid_at, created_at FROM payments WHERE user_id = $1',
      [userId]
    );

    // Get user settings
    const settingsData = await db.query(
      'SELECT language, dark_mode, notifications_enabled, consent_to_terms FROM user_settings WHERE user_id = $1',
      [userId]
    );

    // Get audit logs
    const auditData = await db.query(
      'SELECT action, target_id, created_at FROM audit_logs WHERE user_id = $1',
      [userId]
    );

    const exportData = {
      user_profile: userData.rows[0],
      payments: paymentsData.rows,
      settings: settingsData.rows[0] || {},
      audit_logs: auditData.rows,
      exported_at: new Date().toISOString()
    };

    res.json({
      success: true,
      message: 'User data exported successfully',
      data: exportData
    });
  } catch (error) {
    console.error('Export user data error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  uploadProfilePicture,
  changePassword,
  updateSettings,
  deleteAccount,
  exportUserData
};
