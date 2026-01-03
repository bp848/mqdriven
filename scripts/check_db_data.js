// DBデータ確認スクリプト
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rwjhpfghhgstvplmggks.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3amhwZmdoaGdzdHZwbG1nZ2tzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MDgzNDYsImV4cCI6MjA3NDI4NDM0Nn0.RfCRooN6YVTHJ2Mw-xFCWus3wUVMLkJCLSitB8TNiIo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabaseData() {
  console.log('🔍 データベースのデータ確認中...\n');

  const tables = [
    { name: 'customers', description: '取引先' },
    { name: 'projects', description: 'プロジェクト' },
    { name: 'estimates', description: '見積もり' },
    { name: 'orders', description: '受注' },
    { name: 'calendar_events', description: 'カレンダーイベント' },
    { name: 'bulletin_threads', description: '議事録' },
    { name: 'jobs', description: '案件（jobsビュー）' },
    { name: 'estimates_list_view', description: '見積もりリストビュー' }
  ];

  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table.name)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.log(`❌ ${table.description} (${table.name}): エラー - ${error.message}`);
      } else {
        console.log(`✅ ${table.description} (${table.name}): ${count}件`);
        
        // サンプルデータを表示
        if (count && count > 0) {
          const { data, error: dataError } = await supabase
            .from(table.name)
            .select('*')
            .limit(3);
            
          if (!dataError && data) {
            console.log(`   サンプルデータ:`);
            data.forEach((row, index) => {
              if (table.name === 'customers') {
                console.log(`   ${index + 1}. ${row.name} (${row.contact_person})`);
              } else if (table.name === 'projects') {
                console.log(`   ${index + 1}. ${row.project_name} (${row.project_code})`);
              } else if (table.name === 'estimates') {
                console.log(`   ${index + 1}. ${row.title} - ${row.total}円 (${row.status})`);
              } else if (table.name === 'orders') {
                console.log(`   ${index + 1}. ${row.client_custmer} - ${row.amount}円 (${row.approval_status1})`);
              } else if (table.name === 'calendar_events') {
                console.log(`   ${index + 1}. ${row.title} (${row.start_at})`);
              } else if (table.name === 'bulletin_threads') {
                console.log(`   ${index + 1}. ${row.title} (${row.category})`);
              } else if (table.name === 'jobs') {
                console.log(`   ${index + 1}. ${row.title} - ${row.totalAmount}円`);
              } else if (table.name === 'estimates_list_view') {
                console.log(`   ${index + 1}. ${row.title} - ${row.total}円 (${row.status})`);
              }
            });
          }
        }
      }
    } catch (error) {
      console.log(`❌ ${table.description} (${table.name}): 例外エラー - ${error.message}`);
    }
    console.log('');
  }

  // 特定のデータ確認
  console.log('📊 詳細データ確認:');
  
  // 最新の見積もり
  const { data: latestEstimates } = await supabase
    .from('estimates')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);
    
  if (latestEstimates && latestEstimates.length > 0) {
    console.log('最新の見積もり:');
    latestEstimates.forEach((est, index) => {
      console.log(`  ${index + 1}. ${est.title} - ${est.total}円 (${est.status}) - ${est.created_at}`);
    });
  } else {
    console.log('見積もりデータがありません');
  }

  console.log('');

  // 最新の受注
  const { data: latestOrders } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);
    
  if (latestOrders && latestOrders.length > 0) {
    console.log('最新の受注:');
    latestOrders.forEach((order, index) => {
      console.log(`  ${index + 1}. ${order.client_custmer} - ${order.amount}円 (${order.approval_status1}) - ${order.created_at}`);
    });
  } else {
    console.log('受注データがありません');
  }
}

checkDatabaseData().catch(console.error);
