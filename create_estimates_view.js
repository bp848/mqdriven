import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createEstimatesView() {
  const sql = `
    CREATE OR REPLACE VIEW estimates_list_view AS
    SELECT 
        e.id as estimates_id,
        e.pattern_no as pattern_no,
        e.pattern_name as specification,
        e.copies,
        e.unit_price,
        e.tax_rate,
        e.total,
        e.subtotal,
        e.consumption,
        e.delivery_date,
        e.transaction_method,
        e.delivery_place,
        e.note,
        e.status,
        e.create_id,
        e.created_at,
        e.update_date,
        e.version,
        p.project_code,
        p.project_name,
        p.customer_id,
        p.customer_code,
        c.customer_name,
        c.customer_code as customer_code_resolved
    FROM estimates e
    LEFT JOIN projects p ON e.project_id = p.id OR e.project_code = p.project_code
    LEFT JOIN customers c ON p.customer_id = c.id OR p.customer_code = c.customer_code;
  `;

  try {
    console.log('Creating estimates_list_view...');
    console.log('Please run this SQL manually in your Supabase dashboard:');
    console.log(sql);
    
    // Test if we can access the estimates table
    const { data, error } = await supabase
      .from('estimates')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('Cannot access estimates table:', error);
    } else {
      console.log('Estimates table is accessible');
      console.log('The view needs to be created manually in Supabase dashboard');
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

createEstimatesView();
