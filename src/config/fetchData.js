// This is a standalone script to fetch data from your database.
// You can save this file as 'fetchData.js' in your project's root directory.

const { Pool } = require('pg');

// -- IMPORTANT --
// Ensure these credentials match the database you're trying to connect to.
const pool = new Pool({
  user: 'postgres',        // Replace with your PostgreSQL username
  host: 'localhost',           // Usually 'localhost' for a local setup
  database: 'MREDEO', // Replace with your database name
  password: 'qwerty',   // Replace with your database password
  port: 5432,                  // The default PostgreSQL port
});

/**
 * An async function to connect to the database,
 * retrieve all users, and print them to the console.
 */
async function fetchUsers() {
  let client;
  try {
    // 1. Get a client from the connection pool.
    client = await pool.connect();

    console.log('✅ Connected to the database.');

    // 2. Execute a SQL query to select all data from the 'users' table.
    // Make sure to replace 'users' with the actual name of your table.
    const result = await client.query('SELECT * FROM users');

    // 3. The retrieved rows are in the 'rows' property of the result object.
    const users = result.rows;

    console.log('\n--- Data from the "users" table ---');
    console.table(users); // This prints the data in a nice, readable table format.

  } catch (err) {
    // 4. If any error occurs, log it to the console.
    console.error('❌ An error occurred:', err.message);

  } finally {
    // 5. Release the client back to the pool to close the connection.
    if (client) {
      client.release();
      console.log('\n✅ Database connection closed.');
    }
    // End the pool completely once all tasks are done.
    await pool.end();
  }
}

// Run the function to start the process.
fetchUsers();
