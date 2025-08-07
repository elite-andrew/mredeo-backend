 const { Pool } = require('pg');
 const config = require('./environment');

// Database connection configuration
let poolConfig = {};

if (config.database.url) {
  // Use connection string if available
  poolConfig = {
    connectionString: config.database.url,
    ssl: config.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  };
} else {
  // Use individual connection parameters
  poolConfig = {
    host: config.database.host,
    port: config.database.port,
    database: config.database.database,
    user: config.database.username,
    password: config.database.password,
    ssl: config.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  };
}

// Add connection pool optimization
poolConfig = {
  ...poolConfig,
  // Connection pool optimization
  max: 50, // Increased from 20 for better concurrency
  min: 5,  // Minimum connections to maintain
  idleTimeoutMillis: 30000, // 30 seconds
  connectionTimeoutMillis: 5000, // Increased from 2000ms
  
  // Statement timeout to prevent long-running queries
  statement_timeout: 30000, // 30 seconds
  
  // Query timeout
  query_timeout: 30000, // 30 seconds
  
  // Application name for monitoring
  application_name: 'mredeo-backend',
  
  // Keep connections alive
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
};

// Optimized connection pool configuration
const pool = new Pool(poolConfig);

// Enhanced error handling
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  // Don't exit process, let it handle gracefully
});

// Connection pool monitoring
pool.on('connect', (client) => {
  console.log('New database connection established');
});

pool.on('acquire', (client) => {
  console.log('Client acquired from pool');
});

pool.on('release', (client) => {
  console.log('Client released back to pool');
});

// Graceful shutdown
process.on('SIGINT', () => {
  pool.end();
});

module.exports = pool;
