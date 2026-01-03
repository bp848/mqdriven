// サンプルデータ投入スクリプト
// Node.jsから直接Supabaseにデータを投入

import { createClient } from '@supabase/supabase-js';

// 直接認証情報を設定
const supabaseUrl = 'https://rwjhpfghhgstvplmggks.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3amhwZmdoaGdzdHZwbG1nZ2tzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MDgzNDYsImV4cCI6MjA3NDI4NDM0Nn0.RfCRooN6YVTHJ2Mw-xFCWus3wUVMLkJCLSitB8TNiIo';

if (supabaseUrl === 'YOUR_SUPABASE_URL' || supabaseKey === 'YOUR_SUPABASE_SERVICE_ROLE_KEY') {
  console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedData() {
  console.log('🌱 Starting data seeding...');

  try {
    // 1. 取引先データ
    console.log('📁 Creating customers...');
    const { data: customers, error: customerError } = await supabase
      .from('customers')
      .upsert([
        {
          name: '株式会社ABC商事',
          contact_person: '田中太郎',
          email: 'tanaka@abc-shoji.jp',
          phone: '03-1234-5678',
          address: '東京都千代田区丸の内1-2-3',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          name: 'XYZ株式会社',
          contact_person: '鈴木花子',
          email: 'suzuki@xyz-corp.jp',
          phone: '03-9876-5432',
          address: '東京都港区虎ノ門4-5-6',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          name: '有限会社DEF',
          contact_person: '佐藤次郎',
          email: 'sato@def-ltd.co.jp',
          phone: '03-5555-7777',
          address: '東京都新宿区西新宿8-9-10',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ], { onConflict: 'name' })
      .select();

    if (customerError) throw customerError;
    console.log(`✅ Created ${customers.length} customers`);

    // 2. プロジェクトデータ
    console.log('📋 Creating projects...');
    const { data: projects, error: projectError } = await supabase
      .from('projects')
      .upsert([
        {
          project_code: 'P2025-001',
          project_name: 'ABC商事 パンフレット印刷',
          customer_id: customers[0].id,
          customer_code: 'C001',
          project_status: '進行中',
          classification_id: 'CLS001',
          sales_user_id: 'USR001',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          project_code: 'P2025-002',
          project_name: 'XYZ株式会社 年報印刷',
          customer_id: customers[1].id,
          customer_code: 'C002',
          project_status: '進行中',
          classification_id: 'CLS001',
          sales_user_id: 'USR002',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          project_code: 'P2025-003',
          project_name: '有限会社DEF カタログ制作',
          customer_id: customers[2].id,
          customer_code: 'C003',
          project_status: '完了',
          classification_id: 'CLS002',
          sales_user_id: 'USR001',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ], { onConflict: 'project_code' })
      .select();

    if (projectError) throw projectError;
    console.log(`✅ Created ${projects.length} projects`);

    // 3. 見積もりデータ
    console.log('💰 Creating estimates...');
    const { data: estimates, error: estimateError } = await supabase
      .from('estimates')
      .upsert([
        {
          estimate_number: 2025001,
          title: 'パンフレット印刷見積もり',
          customer_name: customers[0].name,
          project_id: projects[0].id,
          pattern_no: 'V1',
          subtotal: 500000,
          tax_rate: 10,
          consumption: 50000,
          total: 550000,
          grand_total: 550000,
          status: '見積中',
          delivery_date: '2025-02-15',
          expiration_date: '2025-02-28',
          notes: 'A4サイズ、フルカラー、1000部',
          user_id: 'USR001',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          estimate_number: 2025002,
          title: '年報印刷見積もり',
          customer_name: customers[1].name,
          project_id: projects[1].id,
          pattern_no: 'V1',
          subtotal: 800000,
          tax_rate: 10,
          consumption: 80000,
          total: 880000,
          grand_total: 880000,
          status: '受注',
          delivery_date: '2025-03-01',
          expiration_date: '2025-03-15',
          notes: 'B5サイズ、モノカラー、500部',
          user_id: 'USR002',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ], { onConflict: 'estimate_number' })
      .select();

    if (estimateError) throw estimateError;
    console.log(`✅ Created ${estimates.length} estimates`);

    // 4. 受注データ
    console.log('📦 Creating orders...');
    const { data: orders, error: orderError } = await supabase
      .from('orders')
      .upsert([
        {
          client_custmer: customers[0].name,
          project_code: projects[0].project_code,
          order_date: '2025-01-15',
          quantity: 1000,
          amount: 550000,
          subamount: 500000,
          total_cost: 350000,
          approval_status1: '発注済',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          client_custmer: customers[1].name,
          project_code: projects[1].project_code,
          order_date: '2025-01-20',
          quantity: 500,
          amount: 880000,
          subamount: 800000,
          total_cost: 600000,
          approval_status1: '発注済',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          client_custmer: customers[2].name,
          project_code: projects[2].project_code,
          order_date: '2024-12-10',
          quantity: 200,
          amount: 320000,
          subamount: 300000,
          total_cost: 220000,
          approval_status1: '受領済',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ])
      .select();

    if (orderError) throw orderError;
    console.log(`✅ Created ${orders.length} orders`);

    // 5. カレンダーイベント
    console.log('📅 Creating calendar events...');
    const { data: events, error: eventError } = await supabase
      .from('calendar_events')
      .upsert([
        {
          user_id: 'USR001',
          title: 'ABC商事 商談',
          start_at: '2025-01-25T10:00:00Z',
          end_at: '2025-01-25T11:00:00Z',
          all_day: false,
          source: 'system',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          user_id: 'USR001',
          title: 'XYZ株式会社 納品打ち合わせ',
          start_at: '2025-01-26T14:00:00Z',
          end_at: '2025-01-26T15:00:00Z',
          all_day: false,
          source: 'system',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          user_id: 'USR002',
          title: '有限会社DEF 仕様確認',
          start_at: '2025-01-27T16:00:00Z',
          end_at: '2025-01-27T17:00:00Z',
          all_day: false,
          source: 'system',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          user_id: 'USR001',
          title: '週次定例会',
          start_at: '2025-01-27T09:00:00Z',
          end_at: '2025-01-27T10:00:00Z',
          all_day: false,
          source: 'system',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ])
      .select();

    if (eventError) throw eventError;
    console.log(`✅ Created ${events.length} calendar events`);

    // 6. 議事録
    console.log('📝 Creating bulletin threads...');
    const { data: threads, error: threadError } = await supabase
      .from('bulletin_threads')
      .upsert([
        {
          title: 'ABC商事 プロジェクト進捗会議',
          content: 'パンフレット印刷の仕様と納期について協議',
          category: '議事録',
          author_id: 'USR001',
          status: '公開',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          title: 'XYZ株式会社 年報制作キックオフ',
          content: '年報印刷プロジェクトの開始会議',
          category: '議事録',
          author_id: 'USR002',
          status: '公開',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          title: '今週の営業会議',
          content: '新規案件の状況確認と今後の戦略について',
          category: '掲示板',
          author_id: 'USR001',
          status: '公開',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ])
      .select();

    if (threadError) throw threadError;
    console.log(`✅ Created ${threads.length} bulletin threads`);

    // 確認
    console.log('\n📊 Data Summary:');
    const tables = ['customers', 'projects', 'estimates', 'orders', 'calendar_events', 'bulletin_threads'];
    
    for (const table of tables) {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (!error) {
        console.log(`  ${table}: ${count} records`);
      }
    }

    console.log('\n🎉 Data seeding completed successfully!');
    console.log('🔄 Please refresh your browser to see the data in the application.');

  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  }
}

seedData();
