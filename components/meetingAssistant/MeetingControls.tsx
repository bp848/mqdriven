import React from 'react';
import { IconMic, IconMicOff } from './Icons';

interface MeetingControlsProps {
  isMeetingActive: boolean;
  onStartMeeting: () => void;
  onStopMeeting: () => void;
}

export const MeetingControls: React.FC<MeetingControlsProps> = ({ isMeetingActive, onStartMeeting, onStopMeeting }) => {
  return (
    <div className="flex flex-col items-center">
      <button
        onClick={isMeetingActive ? onStopMeeting : onStartMeeting}
        className={`relative flex items-center justify-center w-24 h-24 rounded-full transition-all duration-300 ease-in-out focus:outline-none focus:ring-4
          ${isMeetingActive 
            ? 'bg-red-500 hover:bg-red-600 focus:ring-red-400/50 shadow-lg shadow-red-500/30' 
            : 'bg-blue-500 hover:bg-blue-600 focus:ring-blue-400/50 shadow-lg shadow-blue-500/30'
          }`}
      >
        {isMeetingActive && <span className="absolute h-full w-full rounded-full bg-red-500 animate-ping opacity-75"></span>}
        {isMeetingActive ? <IconMicOff className="w-10 h-10 text-white" /> : <IconMic className="w-10 h-10 text-white" />}
      </button>
      <p className={`mt-4 text-lg font-semibold ${isMeetingActive ? 'text-red-300' : 'text-blue-300'}`}>
        {isMeetingActive ? '会議進行中...' : 'クリックして会議を開始'}
      </p>
    </div>
  );
};
