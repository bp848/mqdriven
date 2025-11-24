import React, { useEffect, useState } from 'react';
import { Mic, Settings, CheckCircle2, AlertCircle } from 'lucide-react';
import { Meeting, SupabaseConfig } from './types';
import { MeetingDashboard } from './Dashboard';
import { MeetingRecorder } from './MeetingRecorder';
import { MeetingDetail } from './MeetingDetail';
import { SettingsModal } from './SettingsModal';
import { saveMeetingToSupabase } from './services';

const LOCAL_MEETINGS_KEY = 'mm_meetings';
const LOCAL_CONFIG_KEY = 'mm_supabase_config';

const defaultSupabaseConfig: SupabaseConfig = {
  url: '',
  key: '',
  tableName: 'meetings',
};

export const MeetingMinutesApp: React.FC = () => {
  const [currentView, setCurrentView] = useState<'dashboard' | 'record' | 'detail'>('dashboard');
  const [activeMeeting, setActiveMeeting] = useState<Meeting | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [supabaseConfig, setSupabaseConfig] = useState<SupabaseConfig>(defaultSupabaseConfig);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    const storedMeetings = localStorage.getItem(LOCAL_MEETINGS_KEY);
    const storedConfig = localStorage.getItem(LOCAL_CONFIG_KEY);

    if (storedMeetings) {
      try {
        setMeetings(JSON.parse(storedMeetings));
      } catch (error) {
        console.error('Failed to parse stored meetings', error);
      }
    }

    if (storedConfig) {
      try {
        setSupabaseConfig(JSON.parse(storedConfig));
      } catch (error) {
        console.error('Failed to parse stored supabase config', error);
      }
    }
  }, []);

  const saveMeetingsLocally = (updatedMeetings: Meeting[]) => {
    setMeetings(updatedMeetings);
    localStorage.setItem(LOCAL_MEETINGS_KEY, JSON.stringify(updatedMeetings));
  };

  const handleSaveConfig = (config: SupabaseConfig) => {
    setSupabaseConfig(config);
    localStorage.setItem(LOCAL_CONFIG_KEY, JSON.stringify(config));
    setShowSettings(false);
    showNotification('success', '設定を保存しました');
  };

  const handleMeetingComplete = (meeting: Meeting) => {
    const updatedMeetings = [meeting, ...meetings];
    saveMeetingsLocally(updatedMeetings);
    setActiveMeeting(meeting);
    setCurrentView('detail');

    if (supabaseConfig.url && supabaseConfig.key) {
      handleSupabaseSync(meeting);
    }
  };

  const handleSupabaseSync = async (meeting: Meeting) => {
    try {
      await saveMeetingToSupabase(meeting, supabaseConfig);
      showNotification('success', 'Supabaseへの同期が完了しました');

      const updatedMeetings = meetings.map((m) =>
        m.id === meeting.id ? { ...m, synced: true } : m,
      );
      saveMeetingsLocally(updatedMeetings);

      if (activeMeeting?.id === meeting.id) {
        setActiveMeeting({ ...meeting, synced: true });
      }
    } catch (error) {
      console.error(error);
      showNotification('error', 'Supabaseへの同期に失敗しました。設定を確認してください。');
    }
  };

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-brand-500/30">
      <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => setCurrentView('dashboard')}
          >
            <div className="w-8 h-8 bg-gradient-to-br from-brand-400 to-brand-600 rounded-lg flex items-center justify-center shadow-lg shadow-brand-500/20">
              <Mic className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              議事録作製アシスタント
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentView === 'dashboard' && (
          <MeetingDashboard
            meetings={meetings}
            onNewMeeting={() => setCurrentView('record')}
            onSelectMeeting={(meeting) => {
              setActiveMeeting(meeting);
              setCurrentView('detail');
            }}
          />
        )}

        {currentView === 'record' && (
          <MeetingRecorder
            onCancel={() => setCurrentView('dashboard')}
            onComplete={handleMeetingComplete}
          />
        )}

        {currentView === 'detail' && activeMeeting && (
          <MeetingDetail
            meeting={activeMeeting}
            onBack={() => setCurrentView('dashboard')}
            onSync={() => handleSupabaseSync(activeMeeting)}
          />
        )}
      </main>

      {showSettings && (
        <SettingsModal
          config={supabaseConfig}
          onClose={() => setShowSettings(false)}
          onSave={handleSaveConfig}
        />
      )}

      {notification && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-xl border flex items-center gap-3 animate-fade-in-up ${
          notification.type === 'success'
            ? 'bg-emerald-950/90 border-emerald-800 text-emerald-200'
            : 'bg-red-950/90 border-red-800 text-red-200'
        }`}>
          {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="text-sm font-medium">{notification.message}</span>
        </div>
      )}
    </div>
  );
};

export default MeetingMinutesApp;
