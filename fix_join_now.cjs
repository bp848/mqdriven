const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rwjhpfghhgstvplmggks.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3amhwZmdoaGdzdHZwbG1nZ2tzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MDgzNDYsImV4cCI6MjA3NDI4NDM0Nn0.RfCRooN6YVTHJ2Mw-xFCWus3wUVMLkJCLSitB8TNiIo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixJoinNow() {
  try {
    // 1. 見積データ取得
    const { data: estimates } = await supabase
      .from('estimates')
      .select('*')
      .limit(5);
    
    console.log('見積データ:', estimates);
    
    // 2. project_idで直接検索
    const projectIds = estimates.map(e => e.project_id).filter(Boolean);
    console.log('検索project_ids:', projectIds);
    
    const { data: projects } = await supabase
      .from('projects')
      .select('*')
      .in('project_code', projectIds);
    
    console.log('プロジェクトデータ:', projects);
    
    // 3. 顧客データ取得
    const customerCodes = projects.map(p => p.customer_code).filter(Boolean);
    console.log('検索customer_codes:', customerCodes);
    
    const { data: customers } = await supabase
      .from('customers')
      .select('*')
      .in('customer_code', customerCodes);
    
    console.log('顧客データ:', customers);
    
    // 4. 結果表示
    estimates.forEach(estimate => {
      const project = projects.find(p => p.project_code === estimate.project_id);
      const customer = project ? customers.find(c => c.customer_code === project.customer_code) : null;
      
      console.log(`見積${estimate.estimates_id}:`);
      console.log(`  顧客名: ${customer?.customer_name || '見つからない'}`);
      console.log(`  プロジェクト名: ${project?.project_name || '見つからない'}`);
    });
    
  } catch (err) {
    console.error('エラー:', err);
  }
}

fixJoinNow();
