import React, { useState } from 'react';
import { X, Save, Database, AlertTriangle, HelpCircle } from 'lucide-react';
import { SupabaseConfig } from '../types';

interface SettingsModalProps {
  config: SupabaseConfig;
  onClose: () => void;
  onSave: (config: SupabaseConfig) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ config, onClose, onSave }) => {
  const [tempConfig, setTempConfig] = useState<SupabaseConfig>(config);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
        
        <div className="flex items-center justify-between p-6 border-b border-slate-800 sticky top-0 bg-slate-900/95 backdrop-blur z-10">
          <h3 className="text-xl font-semibold text-white flex items-center gap-2">
            <Database className="w-5 h-5 text-brand-500" />
            設定
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-blue-950/30 border border-blue-900/50 p-4 rounded-lg">
             <h4 className="text-sm font-semibold text-blue-200 mb-2 flex items-center gap-2">
               <AlertTriangle className="w-4 h-4" /> Supabase連携ガイド
             </h4>
             <p className="text-xs text-blue-300/80 leading-relaxed">
               クラウド同期を有効にするにはSupabaseプロジェクト情報を入力してください。<br/>
               <span className="font-semibold text-blue-200">必須カラム:</span> <code className="bg-blue-950 px-1 rounded">title</code>, <code className="bg-blue-950 px-1 rounded">summary</code>, <code className="bg-blue-950 px-1 rounded">transcript</code>, <code className="bg-blue-950 px-1 rounded">duration_seconds</code>, <code className="bg-blue-950 px-1 rounded">action_items (jsonb)</code>
             </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">プロジェクト URL</label>
              <input 
                type="text" 
                value={tempConfig.url}
                onChange={(e) => setTempConfig({...tempConfig, url: e.target.value})}
                placeholder="https://xyz.supabase.co"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand-500 placeholder-slate-700"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Anon Public Key (API Key)</label>
              <input 
                type="password" 
                value={tempConfig.key}
                onChange={(e) => setTempConfig({...tempConfig, key: e.target.value})}
                placeholder="eyJ..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand-500 placeholder-slate-700"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">テーブル名</label>
              <input 
                type="text" 
                value={tempConfig.tableName}
                onChange={(e) => setTempConfig({...tempConfig, tableName: e.target.value})}
                placeholder="meetings"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand-500 placeholder-slate-700"
              />
            </div>
          </div>

          {/* Troubleshooting Help */}
          <div className="bg-slate-800/50 rounded-lg p-4 space-y-2">
            <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-slate-400" />
              保存できない場合
            </h4>
            <ul className="text-xs text-slate-400 list-disc list-inside space-y-1">
              <li>テーブルで <strong>RLS (Row Level Security)</strong> が有効な場合、Insertを許可するポリシーが必要です。</li>
              <li>一番簡単なテスト方法は、一時的にRLSを無効にすることです。</li>
              <li>URLに <code>https://</code> が含まれているか確認してください。</li>
              <li>テーブルのカラム名がすべて小文字のsnake_caseであることを確認してください。</li>
            </ul>
          </div>
        </div>

        <div className="p-6 border-t border-slate-800 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-slate-400 hover:text-white transition-colors font-medium"
          >
            キャンセル
          </button>
          <button 
            onClick={() => onSave(tempConfig)}
            className="bg-brand-600 hover:bg-brand-500 text-white px-6 py-2 rounded-lg font-semibold shadow-lg shadow-brand-600/20 transition-all flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            設定を保存
          </button>
        </div>

      </div>
    </div>
  );
};