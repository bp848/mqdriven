const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://rwjhpfghhgstvplmggks.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3amhwZmdoaGdzdHZwbG1nZ2tzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MDgzNDYsImV4cCI6MjA3NDI4NDM0Nn0.RfCRooN6YVTHJ2Mw-xFCWus3wUVMLkJCLSitB8TNiIo'
);

async function testAndFix() {
  try {
    console.log('=== Checking customer_id data quality ===');
    
    // Get all projects with customer_id
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id, project_code, customer_id, customer_code, project_name')
      .not('customer_id', 'is', null);
    
    if (projectsError) {
      console.log('Error fetching projects:', projectsError.message);
      return;
    }
    
    console.log(`Found ${projects.length} projects with customer_id`);
    
    // Check if customer_id values are valid UUIDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    let validUuids = 0;
    let invalidUuids = 0;
    
    const customerIds = [...new Set(projects.map(p => p.customer_id).filter(Boolean))];
    
    customerIds.forEach(customerId => {
      if (uuidRegex.test(customerId)) {
        validUuids++;
      } else {
        invalidUuids++;
        console.log(`Invalid UUID: ${customerId}`);
      }
    });
    
    console.log(`Valid UUIDs: ${validUuids}, Invalid UUIDs: ${invalidUuids}`);
    
    // Check if these customer_ids exist in customers table
    const { data: customers, error: customersError } = await supabase
      .from('customers')
      .select('id, customer_name')
      .in('id', customerIds);
    
    if (customersError) {
      console.log('Error checking customers:', customersError.message);
      return;
    }
    
    const existingCustomerIds = new Set(customers.map(c => c.id));
    const orphanedIds = customerIds.filter(id => !existingCustomerIds.has(id));
    
    console.log(`Customers found: ${customers.length}`);
    console.log(`Orphaned customer_ids: ${orphanedIds.length}`);
    
    if (orphanedIds.length > 0) {
      console.log('Orphaned customer_ids:', orphanedIds);
    }
    
    // If data looks good, we can proceed with the fix
    if (invalidUuids === 0 && orphanedIds.length === 0) {
      console.log('\n✓ Data quality looks good! You can add the foreign key constraint.');
      console.log('Run this SQL in your Supabase SQL editor:');
      console.log('ALTER TABLE public.projects ADD CONSTRAINT projects_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;');
    } else {
      console.log('\n❌ Data quality issues found. Fix the data before adding foreign key constraint.');
    }
    
    // Test the current state
    console.log('\n=== Testing current query behavior ===');
    const { data: testQuery, error: testError } = await supabase
      .from('projects')
      .select(`
        id,
        project_code,
        customer_id,
        customer_code,
        project_name
      `)
      .limit(1);
    
    if (testError) {
      console.log('Basic query error:', testError.message);
    } else {
      console.log('✓ Basic query works');
    }
    
    // Test with attempted join
    const { data: testJoin, error: joinError } = await supabase
      .from('projects')
      .select(`
        id,
        project_code,
        customer_id,
        customers(id, customer_name)
      `)
      .limit(1);
    
    if (joinError) {
      console.log('❌ Join query fails (expected):', joinError.message);
    } else {
      console.log('✓ Join query works');
    }
    
  } catch (err) {
    console.log('Unexpected error:', err.message);
  }
}

testAndFix();
