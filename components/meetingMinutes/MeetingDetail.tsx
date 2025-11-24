import React, { useState } from 'react';
import { ArrowLeft, Calendar, Clock, Share2, CheckCircle, Circle, ListTodo, FileText, BrainCircuit, Cloud } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { Meeting } from './types';

interface MeetingDetailProps {
  meeting: Meeting;
  onBack: () => void;
  onSync: () => void;
}

const PRIORITY_MAP: Record<string, string> = {
  High: '高',
  Medium: '中',
  Low: '低',
};

export const MeetingDetail: React.FC<MeetingDetailProps> = ({ meeting, onBack, onSync }) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'transcript'>('summary');

  const markdownComponents = {
    h1: ({ children }: any) => (
      <h1 className="text-2xl font-bold text-white mb-4">{children}</h1>
    ),
    h2: ({ children }: any) => (
      <h2 className="text-xl font-semibold text-white mt-6 mb-3">{children}</h2>
    ),
    h3: ({ children }: any) => (
      <h3 className="text-lg font-semibold text-white mt-4 mb-2">{children}</h3>
    ),
    p: ({ children }: any) => (
      <p className="mb-2">{children}</p>
    ),
    ul: ({ children }: any) => (
      <ul className="ml-4 list-disc text-slate-300 mb-2">{children}</ul>
    ),
    li: ({ children }: any) => (
      <li className="ml-4 text-slate-300 mb-1">{children}</li>
    ),
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div className="space-y-2">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-400 hover:text-brand-400 transition-colors text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            ダッシュボードに戻る
          </button>
          <h1 className="text-3xl font-bold text-white">{meeting.title}</h1>
          <div className="flex items-center gap-4 text-slate-400 text-sm">
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {new Date(meeting.date).toLocaleDateString('ja-JP')}
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {Math.floor(meeting.durationSeconds / 60)}分 {meeting.durationSeconds % 60}秒
            </div>
            <div className={`flex items-center gap-1 ${meeting.synced ? 'text-emerald-400' : 'text-slate-500'}`}>
              <Cloud className="w-4 h-4" />
              {meeting.synced ? '同期済み' : 'ローカルのみ'}
            </div>
          </div>
        </div>

        <button
          onClick={onSync}
          disabled={meeting.synced}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
            meeting.synced
              ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-900 cursor-default'
              : 'bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-600/20'
          }`}
        >
          {meeting.synced ? <CheckCircle className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
          {meeting.synced ? 'Supabaseに保存済み' : 'Supabaseに保存'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
            <div className="flex border-b border-slate-800">
              <button
                onClick={() => setActiveTab('summary')}
                className={`flex-1 px-6 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                  activeTab === 'summary'
                    ? 'bg-slate-800/50 text-brand-400 border-b-2 border-brand-500'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <BrainCircuit className="w-4 h-4" />
                AI要約
              </button>
              <button
                onClick={() => setActiveTab('transcript')}
                className={`flex-1 px-6 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                  activeTab === 'transcript'
                    ? 'bg-slate-800/50 text-brand-400 border-b-2 border-brand-500'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileText className="w-4 h-4" />
                文字起こし原文
              </button>
            </div>

            <div className="p-6 min-h-[400px] text-slate-300 leading-relaxed">
              {activeTab === 'summary' ? (
                <div className="prose prose-invert prose-sm max-w-none">
                  {meeting.summary ? (
                    <ReactMarkdown components={markdownComponents}>{meeting.summary}</ReactMarkdown>
                  ) : (
                    <p>要約がありません。</p>
                  )}
                </div>
              ) : (
                <p className="whitespace-pre-wrap text-slate-400 font-mono text-sm">
                  {meeting.transcript}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-6 h-full">
            <div className="flex items-center gap-2 mb-6 text-brand-400">
              <ListTodo className="w-5 h-5" />
              <h2 className="font-semibold">アクションプラン</h2>
            </div>

            <div className="space-y-4">
              {meeting.actionItems.length === 0 ? (
                <p className="text-slate-500 italic text-sm">アクションアイテムは見つかりませんでした。</p>
              ) : (
                meeting.actionItems.map((item, index) => (
                  <div
                    key={index}
                    className="bg-slate-950/50 border border-slate-800 p-4 rounded-lg hover:border-brand-500/30 transition-colors group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-1">
                        <Circle className="w-4 h-4 text-slate-600 group-hover:text-brand-500" />
                      </div>
                      <div className="flex-1">
                        <p className="text-slate-200 text-sm font-medium mb-2">{item.task}</p>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400 bg-slate-900 px-2 py-1 rounded">{item.owner}</span>
                          <span
                            className={`px-2 py-1 rounded font-medium ${
                              item.priority === 'High'
                                ? 'bg-red-950 text-red-400'
                                : item.priority === 'Medium'
                                ? 'bg-yellow-950 text-yellow-400'
                                : 'bg-blue-950 text-blue-400'
                            }`}
                          >
                            {PRIORITY_MAP[item.priority] || item.priority}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
