const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://rwjhpfghhgstvplmggks.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3amhwZmdoaGdzdHZwbG1nZ2tzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MDgzNDYsImV4cCI6MjA3NDI4NDM0Nn0.RfCRooN6YVTHJ2Mw-xFCWus3wUVMLkJCLSitB8TNiIo'
);

async function verifyFix() {
  try {
    console.log('=== Testing Projects with Customer Relationship ===');
    
    // Test the exact query that was failing
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select(`
        id,
        project_code,
        customer_id,
        customer_code,
        project_name,
        customers(id, customer_name)
      `)
      .limit(5);
    
    if (projectsError) {
      console.log('❌ Still failing:', projectsError.message);
      console.log('Error details:', projectsError);
      return false;
    }
    
    console.log('✅ SUCCESS! Projects with customer relationship works:');
    console.log('Sample data:');
    projects.forEach((project, index) => {
      console.log(`  ${index + 1}. ${project.project_code} - ${project.project_name}`);
      console.log(`     Customer: ${project.customers?.customer_name || 'Not found'}`);
      console.log(`     Customer ID: ${project.customer_id}`);
    });
    
    // Test the exact query from the frontend
    console.log('\n=== Testing Frontend Query Pattern ===');
    const { data: frontendData, error: frontendError } = await supabase
      .from('projects')
      .select('*')
      .order('update_date', { ascending: false })
      .order('project_code', { ascending: false })
      .limit(3);
    
    if (frontendError) {
      console.log('❌ Frontend query error:', frontendError.message);
      return false;
    }
    
    console.log('✅ Frontend query pattern works');
    console.log(`Found ${frontendData.length} projects`);
    
    return true;
    
  } catch (err) {
    console.log('Unexpected error:', err.message);
    return false;
  }
}

verifyFix().then(success => {
  if (success) {
    console.log('\n🎉 Fix verified! The error should be resolved in the frontend.');
  } else {
    console.log('\n❌ Fix not working. Please ensure the foreign key constraint was added correctly.');
  }
});
