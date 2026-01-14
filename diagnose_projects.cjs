const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://rwjhpfghhgstvplmggks.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3amhwZmdoaGdzdHZwbG1nZ2tzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MDgzNDYsImV4cCI6MjA3NDI4NDM0Nn0.RfCRooN6YVTHJ2Mw-xFCWus3wUVMLkJCLSitB8TNiIo'
);

async function runDiagnostics() {
  try {
    console.log('=== Table record counts ===');
    
    // Check projects table
    const { data: projectsCount, error: projectsError } = await supabase
      .from('projects')
      .select('id', { count: 'exact', head: true });
    
    if (projectsError) {
      console.log('Projects count error:', projectsError.message);
    } else {
      console.log(`Projects table: ${projectsCount?.length || 0} records`);
    }

    // Check projects_v2 table
    const { data: projectsV2Count, error: projectsV2Error } = await supabase
      .from('projects_v2')
      .select('id', { count: 'exact', head: true });
    
    if (projectsV2Error) {
      console.log('Projects_v2 count error:', projectsV2Error.message);
    } else {
      console.log(`Projects_v2 table: ${projectsV2Count?.length || 0} records`);
    }

    // Check customers table
    const { data: customersCount, error: customersError } = await supabase
      .from('customers')
      .select('id', { count: 'exact', head: true });
    
    if (customersError) {
      console.log('Customers count error:', customersError.message);
    } else {
      console.log(`Customers table: ${customersCount?.length || 0} records`);
    }

    console.log('\n=== Sample projects data ===');
    const { data: sampleProjects, error: sampleError } = await supabase
      .from('projects')
      .select('id, project_code, customer_id, customer_code, project_name')
      .limit(3);
    
    if (sampleError) {
      console.log('Sample projects error:', sampleError.message);
    } else {
      console.log('Sample projects:', sampleProjects);
    }

    console.log('\n=== Sample projects_v2 data ===');
    const { data: sampleProjectsV2, error: sampleV2Error } = await supabase
      .from('projects_v2')
      .select('id, project_code, customer_id, project_name, status')
      .limit(3);
    
    if (sampleV2Error) {
      console.log('Sample projects_v2 error:', sampleV2Error.message);
    } else {
      console.log('Sample projects_v2:', sampleProjectsV2);
    }

    console.log('\n=== Testing projects with customer relationship ===');
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
      console.log('❌ Projects join error:', joinError.message);
      console.log('Error details:', joinError);
    } else {
      console.log('✓ Projects join works:', testJoin);
    }

    console.log('\n=== Testing projects_v2 with customer relationship ===');
    const { data: testJoinV2, error: joinErrorV2 } = await supabase
      .from('projects_v2')
      .select(`
        id,
        project_code,
        customer_id,
        customers(id, customer_name)
      `)
      .limit(1);
    
    if (joinErrorV2) {
      console.log('❌ Projects_v2 join error:', joinErrorV2.message);
    } else {
      console.log('✓ Projects_v2 join works:', testJoinV2);
    }

  } catch (err) {
    console.log('Unexpected error:', err.message);
  }
}

runDiagnostics();
