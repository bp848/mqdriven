const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rwjhpfghhgstvplmggks.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3amhwZmdoaGdzdHZwbG1nZ2tzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MDgzNDYsImV4cCI6MjA3NDI4NDM0Nn0.RfCRooN6YVTHJ2Mw-xFCWus3wUVMLkJCLSitB8TNiIo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testCustomer1063() {
  try {
    const { data: customer } = await supabase
      .from('customers')
      .select('customer_code, customer_name')
      .eq('customer_code', '1063')
      .single();
    
    console.log('顧客1063:', customer);
    
  } catch (err) {
    console.error('エラー:', err);
  }
}

testCustomer1063();
