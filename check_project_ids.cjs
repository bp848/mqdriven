const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rwjhpfghhgstvplmggks.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3amhwZmdoaGdzdHZwbG1nZ2tzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MDgzNDYsImV4cCI6MjA3NDI4NDM0Nn0.RfCRooN6YVTHJ2Mw-xFCWus3wUVMLkJCLSitB8TNiIo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProjectIds() {
  try {
    console.log('=== プロジェクトID確認 ===');
    
    // 1. プロジェクトテーブルの構造を確認
    console.log('\n--- プロジェクトテーブル構造 ---');
    const { data: projects, error: projectError } = await supabase
      .from('projects')
      .select('id, project_id, project_name, customer_code')
      .limit(5);
    
    if (projectError) {
      console.error('プロジェクトエラー:', projectError);
    } else {
      console.log('プロジェクトデータ:', projects);
    }
    
    // 2. 見積テーブルのproject_idの形式を確認
    console.log('\n--- 見積テーブルのproject_id ---');
    const { data: estimates, error: estimatesError } = await supabase
      .from('estimates')
      .select('estimates_id, project_id')
      .limit(5);
    
    if (estimatesError) {
      console.error('見積エラー:', estimatesError);
    } else {
      console.log('見積データ:', estimates);
    }
    
    // 3. 正しいUUIDで検索テスト
    if (projects && projects.length > 0) {
      console.log('\n--- UUID検索テスト ---');
      const firstProjectId = projects[0].id; // idカラム（UUID）を使用
      console.log('検索するUUID:', firstProjectId);
      
      const { data: projectSearch, error: searchError } = await supabase
        .from('projects')
        .select('id, project_name, customer_code')
        .eq('id', firstProjectId)
        .single();
      
      if (searchError) {
        console.error('UUID検索エラー:', searchError);
      } else {
        console.log('UUID検索結果:', projectSearch);
      }
    }
    
  } catch (err) {
    console.error('予期せぬエラー:', err);
  }
}

checkProjectIds();
