import React from 'react';

const MEETING_MINUTES_APP_URL =
  import.meta.env.VITE_MEETING_MINUTES_APP_URL ??
  'https://meetings-365022685299.us-west1.run.app/';

const MeetingMinutesIframe: React.FC = () => {
  return (
    <div className="w-full flex flex-col items-center">
      <div className="w-full max-w-5xl mx-auto">
        <h2 className="text-xl font-semibold mb-2">議事録作成アシスタント</h2>
        <p className="text-sm text-slate-500 mb-4">
          会議内容を要約して議事録ドラフトを作成します。決定事項と ToDo を必ず確認してください。
        </p>

        <div className="w-full min-h-[650px] bg-slate-900/80 rounded-3xl overflow-hidden border border-slate-800 shadow-inner">
          <iframe
            src={MEETING_MINUTES_APP_URL}
            title="議事録作成アシスタント"
            className="w-full h-full border-0"
            allow="microphone"
          />
        </div>
      </div>
    </div>
  );
};

export default MeetingMinutesIframe;
