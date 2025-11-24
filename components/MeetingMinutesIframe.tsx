import React from 'react';

const MEETING_MINUTES_APP_URL = import.meta.env.VITE_MEETING_MINUTES_APP_URL ?? 'http://localhost:5174';

const MeetingMinutesIframe: React.FC = () => {
  return (
    <div className="min-h-full flex flex-col">
      <div className="flex-1 min-h-[600px] bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 shadow-inner">
        <iframe
          src={MEETING_MINUTES_APP_URL}
          title="議事録作製アシスタント"
          className="w-full h-full border-0"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
        />
      </div>
    </div>
  );
};

export default MeetingMinutesIframe;
