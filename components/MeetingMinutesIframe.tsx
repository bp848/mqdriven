import React from 'react';

const MEETING_MINUTES_APP_URL =
  import.meta.env.VITE_MEETING_MINUTES_APP_URL ??
  'https://meetings-365022685299.us-west1.run.app/';

const MeetingMinutesIframe: React.FC = () => {
  return (
    <div className="w-full flex justify-center">
      <div className="w-full max-w-5xl">
        <div className="w-full h-[90vh] bg-slate-900/80 rounded-3xl overflow-hidden border border-slate-800 shadow-inner mx-auto">
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
