import React, { useState } from 'react';
import { getSupabase } from '../../services/supabaseClient';
import { SUPABASE_KEY, SUPABASE_URL } from '../../supabaseCredentials';

interface TestResult {
  test: string;
  status: 'pending' | 'success' | 'error';
  message: string;
  details?: any;
}

const DatabaseConnectionTest: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);

  const updateResult = (test: string, status: 'pending' | 'success' | 'error', message: string, details?: any) => {
    setResults(prev => [...prev.filter(r => r.test !== test), { test, status, message, details }]);
  };

  const runTests = async () => {
    setIsRunning(true);
    setResults([]);

    try {
      // Test 1: Supabase Client Initialization
      updateResult('Supabase Client', 'pending', 'Initializing Supabase client...');
      let supabase;
      try {
        supabase = getSupabase();
        updateResult('Supabase Client', 'success', 'Supabase client initialized successfully');
      } catch (error: any) {
        updateResult('Supabase Client', 'error', 'Failed to initialize Supabase client', error.message);
        return;
      }

      // Test 2: Basic Connectivity
      updateResult('Basic Connectivity', 'pending', 'Testing basic database connectivity...');
      try {
        const { data, error } = await supabase.from('users').select('count').limit(1);
        if (error) {
          updateResult('Basic Connectivity', 'error', 'Basic connectivity test failed', error);
        } else {
          updateResult('Basic Connectivity', 'success', 'Basic connectivity test passed', { count: data });
        }
      } catch (error: any) {
        updateResult('Basic Connectivity', 'error', 'Basic connectivity test failed with exception', error.message);
      }

      // Test 3: Users Query
      updateResult('Users Query', 'pending', 'Testing users table query...');
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, name, email, role')
          .limit(5);
        
        if (error) {
          updateResult('Users Query', 'error', 'Users query failed', error);
        } else {
          updateResult('Users Query', 'success', `Successfully fetched ${data?.length || 0} users`, data);
        }
      } catch (error: any) {
        updateResult('Users Query', 'error', 'Users query failed with exception', error.message);
      }

      // Test 4: Departments Query
      updateResult('Departments Query', 'pending', 'Testing departments table query...');
      try {
        const { data, error } = await supabase.from('departments').select('id, name').limit(5);
        
        if (error) {
          updateResult('Departments Query', 'error', 'Departments query failed', error);
        } else {
          updateResult('Departments Query', 'success', `Successfully fetched ${data?.length || 0} departments`, data);
        }
      } catch (error: any) {
        updateResult('Departments Query', 'error', 'Departments query failed with exception', error.message);
      }

      // Test 5: Network Connectivity
      updateResult('Network Test', 'pending', 'Testing direct network connectivity...');
      try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
          method: 'GET',
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          updateResult('Network Test', 'success', 'Direct network connectivity successful', { status: response.status });
        } else {
          updateResult('Network Test', 'error', `Network request failed: ${response.status} ${response.statusText}`);
        }
      } catch (error: any) {
        updateResult('Network Test', 'error', 'Network test failed with exception', error.message);
      }

    } catch (error: any) {
      console.error('Test suite failed:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'pending':
        return '⏳';
      case 'success':
        return '✅';
      case 'error':
        return '❌';
    }
  };

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'pending':
        return 'text-blue-600';
      case 'success':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm space-y-6">
      <div className="border-b border-slate-200 dark:border-slate-700 pb-4">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">データベース接続テスト</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Supabaseデータベースへの接続状態を診断します。
        </p>
      </div>

      <div className="space-y-4">
        <button
          onClick={runTests}
          disabled={isRunning}
          className="bg-blue-600 text-white font-semibold py-2 px-6 rounded-lg hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed"
        >
          {isRunning ? 'テスト実行中...' : '接続テストを実行'}
        </button>

        {results.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-lg font-medium text-slate-900 dark:text-white">テスト結果</h3>
            {results.map((result) => (
              <div key={result.test} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getStatusIcon(result.status)}</span>
                    <span className="font-medium text-slate-900 dark:text-white">{result.test}</span>
                  </div>
                  <span className={`text-sm font-medium ${getStatusColor(result.status)}`}>
                    {result.status === 'pending' ? '実行中' : result.status === 'success' ? '成功' : '失敗'}
                  </span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">{result.message}</p>
                {result.details && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-slate-500 hover:text-slate-700">詳細を表示</summary>
                    <pre className="mt-2 p-2 bg-slate-100 dark:bg-slate-700 rounded text-slate-800 dark:text-slate-200 overflow-auto">
                      {JSON.stringify(result.details, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
        <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-3">トラブルシューティング</h3>
        <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
          <p>• 「Supabase Client」が失敗する場合：認証情報を確認してください</p>
          <p>• 「Basic Connectivity」が失敗する場合：ネットワーク接続やSupabaseプロジェクトの状態を確認してください</p>
          <p>• 「Users Query」が失敗する場合：usersテーブルの存在や権限を確認してください</p>
          <p>• 「Network Test」が失敗する場合：ファイアウォールやプロキシ設定を確認してください</p>
        </div>
      </div>
    </div>
  );
};

export default DatabaseConnectionTest;
