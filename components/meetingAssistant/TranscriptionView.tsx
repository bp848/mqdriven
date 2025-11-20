import React, { useRef, useEffect } from 'react';
import { IconUser, IconBot } from './Icons';
import type { TranscriptionEntry } from '../../types/meetingAssistant';

interface TranscriptionViewProps {
  transcriptionHistory: TranscriptionEntry[];
  isMeetingActive: boolean;
}

export const TranscriptionView: React.FC<TranscriptionViewProps> = ({ transcriptionHistory, isMeetingActive }) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [transcriptionHistory]);

    return (
        <div className="mt-6">
            <h2 className="text-xl font-bold text-gray-300 mb-3 text-center">ライブ文字起こし</h2>
            <div ref={scrollRef} className="h-64 max-h-64 overflow-y-auto bg-gray-900/70 rounded-lg p-4 border border-gray-700 space-y-4">
                {transcriptionHistory.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-500">
                        <p>{isMeetingActive ? "聞き取り中..." : "会議を開始すると、ライブ文字起こしが表示されます。"}</p>
                    </div>
                ) : (
                    transcriptionHistory.map((entry, index) => (
                        <div key={index} className={`flex items-start gap-3 ${entry.speaker === 'user' ? 'justify-start' : 'justify-end'}`}>
                           {entry.speaker === 'user' && (
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-400">
                                    <IconUser className="w-5 h-5 text-blue-300" />
                                </div>
                           )}
                            <div className={`max-w-md p-3 rounded-xl ${entry.speaker === 'user' ? 'bg-gray-700 text-gray-200 rounded-tl-none' : 'bg-blue-800 text-blue-100 rounded-tr-none'}`}>
                                <p className="text-sm leading-relaxed whitespace-pre-wrap">{entry.text}</p>
                            </div>
                            {entry.speaker === 'model' && (
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-500/20 flex items-center justify-center border border-teal-400">
                                    <IconBot className="w-5 h-5 text-teal-300" />
                                </div>
                           )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
