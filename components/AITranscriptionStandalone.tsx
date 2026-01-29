import React from 'react';
import { TranscriptionService } from './meetingAssistant/TranscriptionService';
import { Toast } from '../types.ts';

interface AITranscriptionStandaloneProps {
  addToast: (message: string, type: Toast['type']) => void;
  isAIOff: boolean;
}

const AITranscriptionStandalone: React.FC<AITranscriptionStandaloneProps> = ({ addToast, isAIOff }) => {
  if (isAIOff) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="container mx-auto px-4 py-8">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6">
            <div className="text-center py-12">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">AI機能が無効です</h2>
              <p className="text-slate-500 dark:text-slate-400">環境変数でAI機能を有効化してください。</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">議事録AI文字起こし</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">音声・動画ファイルから自動で文字起こしと議事録を作成します</p>
        </div>
        <TranscriptionService />
      </div>
    </div>
  );
};

export default AITranscriptionStandalone;
