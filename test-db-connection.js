// Database connection test
const pool = require('./src/config/database');

async function testConnection() {
  try {
    console.log('🔌 Testing database connection...');
    
    // Test basic connection
    const client = await pool.connect();
    console.log('✅ Database connected successfully!');
    
    // Test query
    const result = await client.query('SELECT NOW() as current_time');
    console.log('⏰ Current database time:', result.rows[0].current_time);
    
    // Check if database exists
    const dbCheck = await client.query(`
      SELECT datname FROM pg_database WHERE datname = $1
    `, [process.env.DB_NAME || 'mredeo_db']);
    
    if (dbCheck.rows.length > 0) {
      console.log('✅ Database exists');
    } else {
      console.log('❌ Database does not exist');
    }
    
    // Release client
    client.release();
    
    console.log('🎉 Database connection test completed successfully!');
    
  } catch (error) {
    console.error('❌ Database connection failed:');
    console.error('Error:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('💡 Solution: Make sure PostgreSQL is running and connection details are correct');
    } else if (error.code === '28P01') {
      console.error('💡 Solution: Check your username and password');
    } else if (error.code === '3D000') {
      console.error('💡 Solution: Create the database first');
    }
  } finally {
    await pool.end();
  }
}

// Run the test
testConnection();
