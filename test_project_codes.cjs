const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rwjhpfghhgstvplmggks.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3amhwZmdoaGdzdHZwbG1nZ2tzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MDgzNDYsImV4cCI6MjA3NDI4NDM0Nn0.RfCRooN6YVTHJ2Mw-xFCWus3wUVMLkJCLSitB8TNiIo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testProjectCodes() {
  try {
    // 見積のproject_idを確認
    const { data: estimates } = await supabase
      .from('estimates')
      .select('estimates_id, project_id')
      .limit(5);
    
    console.log('見積project_id:', estimates);
    
    // project_codeで検索
    const projectIds = estimates.map(e => e.project_id).filter(Boolean);
    const { data: projects } = await supabase
      .from('projects')
      .select('project_code, project_name, customer_code')
      .in('project_code', projectIds);
    
    console.log('project_code検索結果:', projects);
    
  } catch (err) {
    console.error('エラー:', err);
  }
}

testProjectCodes();
