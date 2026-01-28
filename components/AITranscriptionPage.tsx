import React from 'react';
import { TranscriptionService } from './meetingAssistant/TranscriptionService';
import { Toast } from '../types.ts';

interface AITranscriptionPageProps {
  addToast: (message: string, type: Toast['type']) => void;
  isAIOff: boolean;
}

const AITranscriptionPage: React.FC<AITranscriptionPageProps> = ({ addToast, isAIOff }) => {
  if (isAIOff) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">AI機能が無効です</h2>
          <p className="text-slate-500 dark:text-slate-400">環境変数でAI機能を有効化してください。</p>
        </div>
      </div>
    );
  }

  return <TranscriptionService />;
};

export default AITranscriptionPage;
