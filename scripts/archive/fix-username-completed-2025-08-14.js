// Quick script to fix existing usernames - generate from full names
const db = require('./src/config/database');

async function fixUsernames() {
  try {
    console.log('🔧 Regenerating usernames from full names...');
    
    // Get all users to regenerate their usernames from full names
    const usersToFix = await db.query(`
      SELECT id, username, full_name 
      FROM users 
      WHERE full_name IS NOT NULL AND full_name != ''
    `);
    
    console.log(`Found ${usersToFix.rows.length} users to update:`);
    
    for (const user of usersToFix.rows) {
      // Generate username from full name: "John Doe" -> "john_doe"
      let newUsername = user.full_name.toLowerCase()
        .trim()
        .replace(/\s+/g, '_')  // Replace spaces with underscores
        .replace(/[^a-zA-Z0-9._-]/g, ''); // Remove special characters except ._-
      
      // Ensure username is not empty
      if (!newUsername || newUsername.length < 2) {
        newUsername = `user_${user.id}`;
      }
      
      // Ensure username is unique
      let attempt = 0;
      let finalUsername = newUsername;
      while (attempt < 10) {
        const existing = await db.query(
          'SELECT id FROM users WHERE username = $1 AND id != $2',
          [finalUsername, user.id]
        );
        
        if (existing.rows.length === 0) {
          break; // Username is unique
        }
        
        attempt++;
        finalUsername = `${newUsername}_${attempt}`;
      }
      
      // Update the username
      await db.query(
        'UPDATE users SET username = $1 WHERE id = $2',
        [finalUsername, user.id]
      );
      
      console.log(`✅ Updated user ${user.id}: "${user.username}" → "${finalUsername}"`);
    }
    
    console.log('🎉 Username fix completed!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error fixing usernames:', error);
    process.exit(1);
  }
}

fixUsernames();
