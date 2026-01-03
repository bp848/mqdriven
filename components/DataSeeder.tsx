import React, { useState } from 'react';
import { Database, Loader, CheckCircle, AlertTriangle } from './Icons';
import { getSupabase } from '../services/supabaseClient';
import { Toast } from '../types';

interface DataSeederProps {
  addToast: (message: string, type: Toast['type']) => void;
}

const DataSeeder: React.FC<DataSeederProps> = ({ addToast }) => {
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedStatus, setSeedStatus] = useState<'idle' | 'seeding' | 'success' | 'error'>('idle');
  const [seedResults, setSeedResults] = useState<string[]>([]);

  const seedData = async () => {
    setIsSeeding(true);
    setSeedStatus('seeding');
    setSeedResults([]);

    try {
      const supabase = getSupabase();
      const results: string[] = [];

      // 1. 取引先データ
      results.push('📁 取引先データを作成中...');
      const { data: customers, error: customerError } = await supabase
        .from('customers')
        .upsert([
          {
            name: '株式会社ABC商事',
            contact_person: '田中太郎',
            email: 'tanaka@abc-shoji.jp',
            phone: '03-1234-5678',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            name: 'XYZ株式会社',
            contact_person: '鈴木花子',
            email: 'suzuki@xyz-corp.jp',
            phone: '03-9876-5432',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            name: '有限会社DEF',
            contact_person: '佐藤次郎',
            email: 'sato@def-ltd.co.jp',
            phone: '03-5555-7777',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ], { onConflict: 'name' })
        .select();

      if (customerError) throw customerError;
      results.push(`✅ 取引先: ${customers.length}件作成`);

      // 2. プロジェクトデータ
      results.push('📋 プロジェクトデータを作成中...');
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
      results.push(`✅ プロジェクト: ${projects.length}件作成`);

      // 3. 見積もりデータ
      results.push('💰 見積もりデータを作成中...');
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
      results.push(`✅ 見積もり: ${estimates.length}件作成`);

      // 4. 受注データ
      results.push('📦 受注データを作成中...');
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
      results.push(`✅ 受注: ${orders.length}件作成`);

      // 5. カレンダーイベント
      results.push('📅 カレンダーイベントを作成中...');
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
          }
        ])
        .select();

      if (eventError) throw eventError;
      results.push(`✅ カレンダーイベント: ${events.length}件作成`);

      // 6. 議事録
      results.push('📝 議事録を作成中...');
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
      results.push(`✅ 議事録: ${threads.length}件作成`);

      // データ確認
      results.push('\n📊 データ集計:');
      const tables = ['customers', 'projects', 'estimates', 'orders', 'calendar_events', 'bulletin_threads'];
      
      for (const table of tables) {
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });
        
        if (!error) {
          results.push(`  ${table}: ${count}件`);
        }
      }

      setSeedResults(results);
      setSeedStatus('success');
      addToast('サンプルデータの投入が完了しました！', 'success');

    } catch (error) {
      console.error('Data seeding error:', error);
      const errorMessage = error instanceof Error ? error.message : '不明なエラー';
      setSeedResults([`❌ エラー: ${errorMessage}`]);
      setSeedStatus('error');
      addToast('データ投入に失敗しました', 'error');
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
      <div className="flex items-center gap-3 mb-4">
        <Database className="w-6 h-6 text-blue-600" />
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
          サンプルデータ投入
        </h3>
      </div>
      
      <p className="text-slate-600 dark:text-slate-400 mb-6">
        各管理システムにテストデータを投入して、一覧ページの表示を確認します。
      </p>

      <button
        onClick={seedData}
        disabled={isSeeding}
        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-semibold px-4 py-2 rounded-lg transition-colors"
      >
        {isSeeding ? (
          <>
            <Loader className="w-5 h-5 animate-spin" />
            データ投入中...
          </>
        ) : (
          <>
            <Database className="w-5 h-5" />
            サンプルデータを投入
          </>
        )}
      </button>

      {seedResults.length > 0 && (
        <div className={`mt-6 p-4 rounded-lg ${
          seedStatus === 'success' 
            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
            : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
        }`}>
          <div className="flex items-center gap-2 mb-3">
            {seedStatus === 'success' ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-600" />
            )}
            <h4 className="font-semibold text-slate-900 dark:text-white">
              {seedStatus === 'success' ? '投入完了' : 'エラー'}
            </h4>
          </div>
          <pre className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
            {seedResults.join('\n')}
          </pre>
        </div>
      )}
    </div>
  );
};

export default DataSeeder;
