const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rwjhpfghhgstvplmggks.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3amhwZmdoaGdzdHZwbG1nZ2tzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MDgzNDYsImV4cCI6MjA3NDI4NDM0Nn0.RfCRooN6YVTHJ2Mw-xFCWus3wUVMLkJCLSitB8TNiIo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabaseStructure() {
  try {
    console.log('=== テーブル構造確認 ===');
    
    // 1. customersテーブル構造
    console.log('\n--- customersテーブル ---');
    const { data: customers, error: customersError } = await supabase
      .from('customers')
      .select('*')
      .limit(3);
    
    if (customersError) {
      console.error('customersテーブルエラー:', customersError);
    } else {
      console.log('customersデータ:', customers);
    }
    
    // 2. projectsテーブル構造
    console.log('\n--- projectsテーブル ---');
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('*')
      .limit(3);
    
    if (projectsError) {
      console.error('projectsテーブルエラー:', projectsError);
    } else {
      console.log('projectsデータ:', projects);
    }
    
    // 3. estimatesテーブルのproject_idとcustomersの関連
    console.log('\n--- リレーション確認 ---');
    const { data: estimateWithProject, error: estimateError } = await supabase
      .from('estimates')
      .select(`
        estimates_id,
        project_id,
        projects (
          project_id,
          project_name,
          customer_id
        )
      `)
      .eq('estimates_id', '58556')
      .single();
    
    if (estimateError) {
      console.error('リレーションエラー:', estimateError);
    } else {
      console.log('リレーション結果:', estimateWithProject);
    }
    
    // 4. customersテーブル直接検索
    console.log('\n--- customers直接検索 ---');
    const { data: customer57379, error: customerError } = await supabase
      .from('customers')
      .select('*')
      .eq('customer_id', '57379')
      .single();
    
    if (customerError) {
      console.error('customer検索エラー:', customerError);
    } else {
      console.log('customer57379:', customer57379);
    }
    
  } catch (err) {
    console.error('予期せぬエラー:', err);
  }
}

checkDatabaseStructure();
