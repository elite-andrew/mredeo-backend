const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'MREDEO', 
  user: 'postgres',
  password: '4989!'
});

async function deleteUser() {
  try {
    // Get user details first
    const userEmail = 'admin@mredeo.org'; // Change this to target user
    
    console.log('🔍 Finding user...');
    const findResult = await pool.query(
      'SELECT id, full_name, email, role FROM users WHERE email = $1',
      [userEmail]
    );
    
    if (findResult.rows.length === 0) {
      console.log('❌ User not found');
      await pool.end();
      return;
    }
    
    console.log('📋 User found:');
    console.table(findResult.rows);
    
    // Choose your deletion method:
    
    // Option 1: Soft delete (commented out)
    // console.log('🔄 Soft deleting user...');
    // const softDeleteResult = await pool.query(
    //   'UPDATE users SET is_deleted = true, is_active = false, updated_at = CURRENT_TIMESTAMP WHERE email = $1',
    //   [userEmail]
    // );
    
    // Option 2: Hard delete (PERMANENT REMOVAL)
    console.log('🔄 Hard deleting user...');
    const hardDeleteResult = await pool.query(
      'DELETE FROM users WHERE email = $1',
      [userEmail]
    );
    
    console.log(`✅ User permanently deleted (${hardDeleteResult.rowCount} row(s) affected)`);
    
    // Verify deletion
    const verifyResult = await pool.query(
      'SELECT id, full_name, email, is_active, is_deleted FROM users WHERE email = $1',
      [userEmail]
    );
    
    if (verifyResult.rows.length === 0) {
      console.log('✅ User completely removed from database');
    } else {
      console.log('📋 User status after deletion:');
      console.table(verifyResult.rows);
    }
    
    await pool.end();
    console.log('✅ Database connection closed');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

deleteUser();
