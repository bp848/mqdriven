import React from 'react';
import { Loader, Save, AlertTriangle } from './Icons';

interface ConnectionSetupPageProps {
  onRetry: () => void;
  onShowSetup: () => void;
}

const ConnectionSetupPage: React.FC<ConnectionSetupPageProps> = ({ onRetry, onShowSetup }) => {
  
  const codeSnippet = `
// supabaseCredentials.ts

// 1. SupabaseプロジェクトのURLを貼り付けてください
export const SUPABASE_URL = 'ここにURLを貼り付け'; 

// 2. Supabaseプロジェクトのanon publicキーを貼り付けてください
export const SUPABASE_KEY = 'ここにキーを貼り付け';
  `.trim();

  return (
    <div className="fixed inset-0 bg-slate-100 dark:bg-slate-900 flex justify-center items-center z-[200] p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">データベース接続設定が必要です</h2>
          <p className="mt-1 text-slate-500 dark:text-slate-400">
            アプリケーションを使用するには、データベースへの接続情報を設定する必要があります。
          </p>
        </div>
        <div className="p-6 space-y-4">
            <div className="text-base text-slate-700 dark:text-slate-300 space-y-2">
                <p>
                    プロジェクトのルートディレクトリにある <code className="font-mono bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded">supabaseCredentials.ts</code> ファイルを開いてください。
                </p>
                 <p>
                    ファイル内の指示に従い、あなたのSupabaseプロジェクトのURLと公開キー（Anon Key）を貼り付けて保存してください。
                </p>
            </div>
             <pre className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                <code>{codeSnippet}</code>
            </pre>
           <div className="text-sm text-slate-500 dark:text-slate-400 pt-2">
            これらの情報は <a href="https://supabase.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Supabase</a> プロジェクトの「Project Settings」 &gt; 「API」ページで確認できます。
            テーブルのセットアップがまだの場合は、<button type="button" onClick={onShowSetup} className="text-blue-600 hover:underline">セットアップガイド</button>を参照してください。
          </div>
        </div>
        <div className="flex justify-end p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={onRetry}
            className="w-48 flex items-center justify-center bg-blue-600 text-white font-semibold py-2.5 px-4 rounded-lg shadow-md hover:bg-blue-700"
          >
            設定完了、再接続を試す
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConnectionSetupPage;
