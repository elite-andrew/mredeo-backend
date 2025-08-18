const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'MREDEO', 
  user: 'postgres',
  password: '4989!'
});

async function promoteUser() {
  try {
    console.log('🔄 Promoting user to admin...');
    
    // Update the user role
    const updateResult = await pool.query(
      'UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE email = $2 AND is_active = true',
      ['admin_chairperson', 'einsteinelite05@gmail.com']
    );
    
    console.log(`✅ Updated ${updateResult.rowCount} user(s)`);
    
    // Verify the update
    const verifyResult = await pool.query(
      'SELECT id, full_name, email, role, updated_at FROM users WHERE email = $1',
      ['einsteinelite05@gmail.com']
    );
    
    console.log('📋 Updated user details:');
    console.table(verifyResult.rows);
    
    await pool.end();
    console.log('✅ Database connection closed');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

promoteUser();
