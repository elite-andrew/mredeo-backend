// Simple SQL migration runner: executes all .sql files in src/migrations in lexical order
const fs = require('fs');
const path = require('path');
const db = require('../config/database');

async function run() {
  const dir = path.join(__dirname, '..', 'migrations');
  if (!fs.existsSync(dir)) {
    console.log('No migrations directory found. Skipping.');
    return;
  }
  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const client = await db.connect();
  try {
    for (const file of files) {
      const full = path.join(dir, file);
      const sql = fs.readFileSync(full, 'utf8');
      console.log(`Applying migration: ${file}`);
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('COMMIT');
      console.log(`Applied: ${file}`);
    }
    console.log('All migrations applied.');
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await db.end?.();
  }
}

if (require.main === module) {
  run();
}

module.exports = run;
