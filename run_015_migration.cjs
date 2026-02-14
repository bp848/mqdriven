const fs = require('fs');
const path = require('path');

const migrationFile = path.join(__dirname, 'database', 'migrations', '015_create_customer_feedback.sql');

try {
  const sql = fs.readFileSync(migrationFile, 'utf8');
  
  console.log('------------------------------------------------------------------');
  console.log('V Execute the following SQL in your Supabase SQL Editor V');
  console.log('------------------------------------------------------------------');
  console.log(`-- Migration file: ${path.basename(migrationFile)}
`);
  console.log(sql);
  console.log('------------------------------------------------------------------');
  console.log('^ Execute the above SQL in your Supabase SQL Editor ^');
  console.log('------------------------------------------------------------------');
  console.log('
This script creates the `customer_feedback` table and sets up necessary policies and indexes.');
  console.log('After running the SQL, the database will be ready for the new feedback feature.');

} catch (err) {
  console.error(`Error reading migration file: ${migrationFile}`, err);
  process.exit(1);
}
