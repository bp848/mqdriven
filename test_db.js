const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rwjhpfghhgstvplmggks.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3amhwZmdoaGdzdHZwbG1nZ2tzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MDgzNDYsImV4cCI6MjA3NDI4NDM0Nn0.RfCRooN6YVTHJ2Mw-xFCWus3wUVMLkJCLSitB8TNiIo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testEstimates() {
  try {
    console.log('Testing estimates table...');
    
    // Check if table exists and get count
    const { count, error } = await supabase
      .from('estimates')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.error('Error accessing estimates:', error);
      return;
    }
    
    console.log(`Estimates count: ${count}`);
    
    // Try to get actual data
    const { data, error: dataError } = await supabase
      .from('estimates')
      .select('*')
      .limit(5);
    
    if (dataError) {
      console.error('Error fetching data:', dataError);
      return;
    }
    
    console.log('Sample data:', data);
    
    // If no data, create sample
    if (count === 0) {
      console.log('Creating sample data...');
      const { error: insertError } = await supabase
        .from('estimates')
        .insert([
          {
            estimate_number: 'EST-2025-001',
            customer_name: '株式会社ABC',
            title: 'ウェブサイト開発',
            display_name: 'ウェブサイト開発',
            project_name: 'コーポレートサイト',
            items: [],
            total: 500000,
            delivery_date: '2025-02-01',
            payment_terms: '納品後30日',
            delivery_method: '納品',
            notes: '基本的なコーポレートサイトの開発',
            status: 'draft',
            version: 1,
            user_id: 'test-user',
            create_date: new Date().toISOString(),
            update_date: new Date().toISOString(),
            subtotal: 450000,
            tax_total: 50000,
            grand_total: 500000,
            status_label: '下書き'
          }
        ]);
      
      if (insertError) {
        console.error('Error inserting sample data:', insertError);
      } else {
        console.log('Sample data created successfully');
      }
    }
    
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

testEstimates();
