// Direct SQL execution without Supabase client
const fs = require('fs');

// Read the SQL file
const sql = fs.readFileSync('fix_application_cancellation.sql', 'utf8');

console.log('SQL file content:');
console.log(sql);
console.log('\n---');
console.log('Please execute this SQL manually in your PostgreSQL client.');
console.log('The SQL adds updated_at column and creates triggers for automatic timestamp management.');
