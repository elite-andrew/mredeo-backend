 const { Pool } = require('pg');
 const config = require('./environment');

 
 const pool = new Pool({
 connectionString: config.database.url,
 ssl: config.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
   idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
 });
 pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
 process.exit(-1);
  });

 module.exports = pool;

