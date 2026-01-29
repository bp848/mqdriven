import React from 'react';
import ReactDOM from 'react-dom/client';
import AITranscriptionStandalone from '../components/AITranscriptionStandalone';

// Mock implementations for standalone mode
const addToast = (message: string, type: 'success' | 'error' | 'info' | 'warning') => {
  console.log(`Toast: ${message} (${type})`);
};

const isAIOff = false; // Set to true to disable AI features

// スタンドアロンページ用のSupabase認証初期化
const initializeAuth = async () => {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = 'https://rwjhpfghhgstvplmggks.supabase.co';
    const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3amhwZmdoaGdzdHZwbG1na2tzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgxMDI4NzEsImV4cCI6MjA1MzY4NDg3MX0.8Q2hS3qJh_QN9QYzOJqUaW5x3JQq0n3pF2o4r9q8X7o';

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      }
    });

    // 現在のセッションを確認
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      // 未認証の場合はメインページにリダイレクト
      window.location.href = '/';
      return null;
    }

    return supabase;
  } catch (error) {
    console.error('認証初期化エラー:', error);
    return null;
  }
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <AITranscriptionStandalone addToast={addToast} isAIOff={isAIOff} />
  </React.StrictMode>,
);
