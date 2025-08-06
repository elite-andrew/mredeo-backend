const db = require('../config/database');

const createContributionType = async (req, res) => {
  try {
    const { name, amount } = req.body;
    const createdBy = req.user.id;

    // Check if contribution type already exists
    const existingQuery = await db.query(
      'SELECT id FROM contribution_types WHERE name = $1',
      [name]
    );

    if (existingQuery.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Contribution type with this name already exists'
      });
    }

    const contributionResult = await db.query(
      `INSERT INTO contribution_types (name, amount, created_by)
       VALUES ($1, $2, $3) 
       RETURNING id, name, amount, is_active, created_at`,
      [name, amount, createdBy]
    );

    const contribution = contributionResult.rows[0];

    res.status(201).json({
      success: true,
      message: 'Contribution type created successfully',
      data: { contribution }
    });
  } catch (error) {
    console.error('Create contribution type error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const getContributionTypes = async (req, res) => {
  try {
    const { include_inactive = 'false' } = req.query;
    
    let query = `SELECT ct.id, ct.name, ct.amount, ct.is_active, ct.created_at,
                        u.full_name as created_by_name
                 FROM contribution_types ct
                 LEFT JOIN users u ON ct.created_by = u.id`;
    
    if (include_inactive === 'false') {
      query += ' WHERE ct.is_active = true';
    }
    
    query += ' ORDER BY ct.created_at DESC';

    const contributionsQuery = await db.query(query);

    res.json({
      success: true,
      data: { contribution_types: contributionsQuery.rows }
    });
  } catch (error) {
    console.error('Get contribution types error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const updateContributionType = async (req, res) => {
  try {
    const { contributionId } = req.params;
    const { name, amount, is_active } = req.body;

    const updateFields = [];
    const queryParams = [];
    let paramCount = 0;

    if (name !== undefined) {
      paramCount++;
      updateFields.push(`name = $${paramCount}`);
      queryParams.push(name);
    }

    if (amount !== undefined) {
      paramCount++;
      updateFields.push(`amount = $${paramCount}`);
      queryParams.push(amount);
    }

    if (is_active !== undefined) {
      paramCount++;
      updateFields.push(`is_active = $${paramCount}`);
      queryParams.push(is_active);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    paramCount++;
    queryParams.push(contributionId);

    const updateQuery = `
      UPDATE contribution_types 
      SET ${updateFields.join(', ')} 
      WHERE id = $${paramCount} 
      RETURNING id, name, amount, is_active, created_at`;

    const result = await db.query(updateQuery, queryParams);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Contribution type not found'
      });
    }

    res.json({
      success: true,
      message: 'Contribution type updated successfully',
      data: { contribution: result.rows[0] }
    });
  } catch (error) {
    console.error('Update contribution type error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const deleteContributionType = async (req, res) => {
  try {
    const { contributionId } = req.params;

    // Check if there are any payments associated with this contribution type
    const paymentsQuery = await db.query(
      'SELECT COUNT(*) FROM payments WHERE contribution_type_id = $1',
      [contributionId]
    );

    const paymentCount = parseInt(paymentsQuery.rows[0].count);

    if (paymentCount > 0) {
      // Don't delete, just deactivate
      const deactivateResult = await db.query(
        'UPDATE contribution_types SET is_active = false WHERE id = $1 RETURNING id, name',
        [contributionId]
      );

      if (deactivateResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Contribution type not found'
        });
      }

      return res.json({
        success: true,
        message: 'Contribution type deactivated (has associated payments)'
      });
    }

    // Safe to delete
    const deleteResult = await db.query(
      'DELETE FROM contribution_types WHERE id = $1 RETURNING id, name',
      [contributionId]
    );

    if (deleteResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Contribution type not found'
      });
    }

    res.json({
      success: true,
      message: 'Contribution type deleted successfully'
    });
  } catch (error) {
    console.error('Delete contribution type error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  createContributionType,
  getContributionTypes,
  updateContributionType,
  deleteContributionType
};
