// Database connection debugging script
// Run this in the browser console to diagnose connection issues

async function debugDatabaseConnection() {
  console.log('🔍 Starting database connection debug...');
  
  try {
    // Test 1: Check if Supabase client can be initialized
    console.log('📋 Test 1: Supabase client initialization');
    let supabase;
    try {
      // Try to import and initialize the supabase client
      const { getSupabase } = await import('./services/supabaseClient.js');
      supabase = getSupabase();
      console.log('✅ Supabase client initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Supabase client:', error);
      return;
    }
    
    // Test 2: Test basic connectivity with a simple query
    console.log('📋 Test 2: Basic connectivity test');
    try {
      const { data, error } = await supabase.from('users').select('count').limit(1);
      if (error) {
        console.error('❌ Basic query failed:', error);
        console.log('Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
      } else {
        console.log('✅ Basic connectivity test passed');
        console.log('User count query result:', data);
      }
    } catch (error) {
      console.error('❌ Basic connectivity test failed with exception:', error);
    }
    
    // Test 3: Test the exact query that's failing
    console.log('📋 Test 3: Users query (exact same as dataService)');
    try {
      const { data: userRows, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role, created_at, department_id, position_id, is_active')
        .order('name', { ascending: true })
        .limit(5); // Limit to 5 for testing
      
      if (userError) {
        console.error('❌ Users query failed:', userError);
        console.log('User query error details:', {
          message: userError.message,
          details: userError.details,
          hint: userError.hint,
          code: userError.code
        });
      } else {
        console.log('✅ Users query passed');
        console.log('Sample users:', userRows);
      }
    } catch (error) {
      console.error('❌ Users query failed with exception:', error);
    }
    
    // Test 4: Test departments query
    console.log('📋 Test 4: Departments query');
    try {
      const { data: departmentRows, error: departmentError } = await supabase
        .from('departments')
        .select('id, name')
        .limit(5);
      
      if (departmentError) {
        console.error('❌ Departments query failed:', departmentError);
      } else {
        console.log('✅ Departments query passed');
        console.log('Sample departments:', departmentRows);
      }
    } catch (error) {
      console.error('❌ Departments query failed with exception:', error);
    }
    
    // Test 5: Test titles query
    console.log('📋 Test 5: Employee titles query');
    try {
      const { data: titleRows, error: titleError } = await supabase
        .from('employee_titles')
        .select('id, name')
        .limit(5);
      
      if (titleError) {
        console.error('❌ Employee titles query failed:', titleError);
      } else {
        console.log('✅ Employee titles query passed');
        console.log('Sample titles:', titleRows);
      }
    } catch (error) {
      console.error('❌ Employee titles query failed with exception:', error);
    }
    
    // Test 6: Test the exact Promise.all scenario
    console.log('📋 Test 6: Promise.all scenario (exact reproduction)');
    try {
      const [
        { data: userRows, error: userError },
        { data: departmentRows, error: departmentError },
        { data: titleRows, error: titleError },
      ] = await Promise.all([
        supabase
          .from('users')
          .select('id, name, email, role, created_at, department_id, position_id, is_active')
          .order('name', { ascending: true })
          .limit(3),
        supabase.from('departments').select('id, name').limit(3),
        supabase.from('employee_titles').select('id, name').limit(3),
      ]);
      
      if (userError) console.error('❌ Promise.all users query failed:', userError);
      if (departmentError) console.error('❌ Promise.all departments query failed:', departmentError);
      if (titleError) console.error('❌ Promise.all titles query failed:', titleError);
      
      if (!userError && !departmentError && !titleError) {
        console.log('✅ Promise.all scenario passed');
        console.log('Combined results:', { userRows, departmentRows, titleRows });
      }
    } catch (error) {
      console.error('❌ Promise.all scenario failed with exception:', error);
    }
    
    // Test 7: Check network connectivity
    console.log('📋 Test 7: Network connectivity check');
    try {
      const response = await fetch('https://rwjhpfghhgstvplmggks.supabase.co/rest/v1/', {
        method: 'GET',
        headers: {
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3amhwZmdoaGdzdHZwbG1nZ2tzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MDgzNDYsImV4cCI6MjA3NDI4NDM0Nn0.RfCRooN6YVTHJ2Mw-xFCWus3wUVMLkJCLSitB8TNiIo',
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        console.log('✅ Direct network connectivity to Supabase passed');
        console.log('Response status:', response.status);
      } else {
        console.error('❌ Direct network connectivity failed:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('❌ Direct network connectivity failed with exception:', error);
    }
    
    console.log('🔍 Database connection debug completed');
    
  } catch (error) {
    console.error('❌ Debug script failed with unexpected error:', error);
  }
}

// Make the function available globally
window.debugDatabaseConnection = debugDatabaseConnection;

console.log('Database connection debug script loaded. Run debugDatabaseConnection() to start debugging.');
