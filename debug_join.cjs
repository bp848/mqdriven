const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rwjhpfghhgstvplmggks.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3amhwZmdoaGdzdHZwbG1nZ2tzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MDgzNDYsImV4cCI6MjA3NDI4NDM0Nn0.RfCRooN6YVTHJ2Mw-xFCWus3wUVMLkJCLSitB8TNiIo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugJoin() {
  try {
    console.log('=== JOINデバッグ ===');
    
    // 1. 見積データを取得
    console.log('\n--- 見積データ ---');
    const { data: estimates, error: estimatesError } = await supabase
      .from('estimates')
      .select('estimates_id, project_id')
      .limit(5);
    
    if (estimatesError) {
      console.error('見積エラー:', estimatesError);
      return;
    }
    
    console.log('見積データ:', estimates);
    
    // 2. プロジェクトIDを取得して検索
    const projectIds = estimates.map(e => e.project_id).filter(Boolean);
    console.log('\n--- プロジェクトID ---', projectIds);
    
    if (projectIds.length > 0) {
      const { data: projects, error: projectError } = await supabase
        .from('projects')
        .select('project_id, project_name, customer_code')
        .in('project_id', projectIds);
      
      if (projectError) {
        console.error('プロジェクトエラー:', projectError);
      } else {
        console.log('プロジェクトデータ:', projects);
        
        // 3. 顧客コードを取得して検索
        const customerCodes = projects.map(p => p.customer_code).filter(Boolean);
        console.log('\n--- 顧客コード ---', customerCodes);
        
        if (customerCodes.length > 0) {
          const { data: customers, error: customerError } = await supabase
            .from('customers')
            .select('customer_code, customer_name')
            .in('customer_code', customerCodes);
          
          if (customerError) {
            console.error('顧客エラー:', customerError);
          } else {
            console.log('顧客データ:', customers);
            
            // 4. マッピングテスト
            console.log('\n--- マッピングテスト ---');
            estimates.forEach(estimate => {
              const project = projects.find(p => p.project_id === estimate.project_id);
              const customer = project ? customers.find(c => c.customer_code === project.customer_code) : null;
              
              console.log(`見積${estimate.estimates_id}:`);
              console.log(`  プロジェクトID: ${estimate.project_id}`);
              console.log(`  プロジェクト: ${project?.project_name || '見つからない'}`);
              console.log(`  顧客コード: ${project?.customer_code || 'なし'}`);
              console.log(`  顧客名: ${customer?.customer_name || '見つからない'}`);
              console.log('');
            });
          }
        }
      }
    }
    
  } catch (err) {
    console.error('予期せぬエラー:', err);
  }
}

debugJoin();
