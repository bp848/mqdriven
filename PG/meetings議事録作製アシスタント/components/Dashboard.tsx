import React, { useState, useMemo } from 'react';
import { Meeting } from '../types';
import { Plus, Calendar, ArrowRight, Clock, Search, ListFilter } from 'lucide-react';

interface DashboardProps {
  meetings: Meeting[];
  onNewMeeting: () => void;
  onSelectMeeting: (meeting: Meeting) => void;
}

type SortOption = 'date_desc' | 'date_asc' | 'duration_desc' | 'duration_asc';

export const Dashboard: React.FC<DashboardProps> = ({ meetings, onNewMeeting, onSelectMeeting }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('date_desc');

  const filteredAndSortedMeetings = useMemo(() => {
    let result = [...meetings];

    // Filter by search term
    if (searchTerm.trim()) {
      const lowerTerm = searchTerm.toLowerCase();
      result = result.filter(m => 
        m.title.toLowerCase().includes(lowerTerm) || 
        m.summary.toLowerCase().includes(lowerTerm) ||
        m.transcript.toLowerCase().includes(lowerTerm)
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'date_desc':
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        case 'date_asc':
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        case 'duration_desc':
          return b.durationSeconds - a.durationSeconds;
        case 'duration_asc':
          return a.durationSeconds - b.durationSeconds;
        default:
          return 0;
      }
    });

    return result;
  }, [meetings, searchTerm, sortBy]);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Hero Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">議事録作製アシスタント</h2>
        </div>
        <button 
          onClick={onNewMeeting}
          className="bg-brand-600 hover:bg-brand-500 text-white px-6 py-3 rounded-full font-semibold shadow-lg shadow-brand-600/20 transition-all hover:scale-105 flex items-center gap-2 w-fit"
        >
          <Plus className="w-5 h-5" />
          新規会議
        </button>
      </div>

      {/* Recent Meetings */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="text-lg font-semibold text-slate-200">最近の会議</h3>
          
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Sort Dropdown */}
            <div className="relative group">
              <ListFilter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="appearance-none bg-slate-900 border border-slate-800 rounded-lg pl-10 pr-8 py-2 text-sm text-slate-200 focus:outline-none focus:border-brand-500 w-full sm:w-auto cursor-pointer hover:border-slate-700 transition-colors"
              >
                <option value="date_desc">日付: 新しい順</option>
                <option value="date_asc">日付: 古い順</option>
                <option value="duration_desc">時間: 長い順</option>
                <option value="duration_asc">時間: 短い順</option>
              </select>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input 
                type="text" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="議事録を検索..." 
                className="bg-slate-900 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-brand-500 w-full sm:w-64 placeholder-slate-600"
              />
            </div>
          </div>
        </div>

        {filteredAndSortedMeetings.length === 0 ? (
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-12 text-center">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-slate-500" />
            </div>
            <h4 className="text-xl font-medium text-white mb-2">
              {searchTerm ? '該当する会議が見つかりません' : 'まだ会議の記録がありません'}
            </h4>
            <p className="text-slate-500 mb-6">
              {searchTerm ? '検索キーワードを変更してみてください。' : '録音を開始して議事録とアクションプランを作成しましょう。'}
            </p>
            {!searchTerm && (
              <button 
                onClick={onNewMeeting}
                className="text-brand-400 hover:text-brand-300 font-medium"
              >
                最初の会議を始める &rarr;
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAndSortedMeetings.map((meeting) => (
              <div 
                key={meeting.id}
                onClick={() => onSelectMeeting(meeting)}
                className="bg-slate-900 border border-slate-800 hover:border-brand-500/50 rounded-xl p-5 cursor-pointer transition-all hover:shadow-lg hover:shadow-brand-900/10 group"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-800 to-slate-700 flex items-center justify-center text-slate-300 group-hover:text-white transition-colors">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div className={`px-2 py-1 rounded text-xs font-medium ${meeting.synced ? 'bg-emerald-950 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                    {meeting.synced ? '同期済' : '未同期'}
                  </div>
                </div>
                
                <h4 className="text-lg font-semibold text-slate-200 mb-2 line-clamp-1 group-hover:text-brand-400 transition-colors">
                  {meeting.title}
                </h4>
                
                <p className="text-slate-500 text-sm mb-4 line-clamp-2">
                  {meeting.summary || meeting.transcript.substring(0, 100) + "..."}
                </p>
                
                <div className="flex items-center justify-between text-xs text-slate-500 pt-4 border-t border-slate-800">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {Math.floor(meeting.durationSeconds / 60)}分 {meeting.durationSeconds % 60}秒
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600">
                      {new Date(meeting.date).toLocaleDateString('ja-JP')}
                    </span>
                    <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform text-brand-500/0 group-hover:text-brand-500" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};