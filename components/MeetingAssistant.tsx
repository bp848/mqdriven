import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { LiveServerMessage } from '@google/genai';
import { MeetingControls } from './meetingAssistant/MeetingControls';
import { TranscriptionView } from './meetingAssistant/TranscriptionView';
import { ResultsView } from './meetingAssistant/ResultsView';
import { IconAlertTriangle, IconLoader, IconSparkles } from './meetingAssistant/Icons';
import { startMeetingSession, generateMinutesAndTasks } from '../services/geminiLiveService';
import type { MeetingTask, TranscriptionEntry } from '../types/meetingAssistant';

const MeetingAssistant: React.FC = () => {
  const [isMeetingActive, setIsMeetingActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcriptionHistory, setTranscriptionHistory] = useState<TranscriptionEntry[]>([]);
  const [meetingMinutes, setMeetingMinutes] = useState<string | null>(null);
  const [tasks, setTasks] = useState<MeetingTask[]>([]);

  const sessionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const currentInputTranscriptionRef = useRef('');
  const currentOutputTranscriptionRef = useRef('');

  const handleMessage = useCallback((message: LiveServerMessage) => {
    if (message.serverContent?.outputTranscription) {
      const text = message.serverContent.outputTranscription.text;
      currentOutputTranscriptionRef.current += text;
      setTranscriptionHistory((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.speaker === 'model') {
          return [...prev.slice(0, -1), { ...last, text: currentOutputTranscriptionRef.current }];
        }
        return [...prev, { speaker: 'model', text: currentOutputTranscriptionRef.current }];
      });
    } else if (message.serverContent?.inputTranscription) {
      const text = message.serverContent.inputTranscription.text;
      currentInputTranscriptionRef.current += text;
      setTranscriptionHistory((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.speaker === 'user') {
          return [...prev.slice(0, -1), { ...last, text: currentInputTranscriptionRef.current }];
        }
        return [...prev, { speaker: 'user', text: currentInputTranscriptionRef.current }];
      });
    }

    if (message.serverContent?.turnComplete) {
      currentInputTranscriptionRef.current = '';
      currentOutputTranscriptionRef.current = '';
    }
  }, []);

  const stopMeetingResources = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsMeetingActive(false);
  }, []);

  const handleError = useCallback(
    (err: Error | ErrorEvent) => {
      console.error(err);
      const message = err && 'message' in err ? err.message : '不明なエラーが発生しました。';
      setError(`エラー: ${message} APIキーやマイクの権限を確認してください。`);
      stopMeetingResources();
    },
    [stopMeetingResources],
  );

  const startMeeting = useCallback(async () => {
    if (isMeetingActive) return;

    setError(null);
    setTranscriptionHistory([]);
    setMeetingMinutes(null);
    setTasks([]);

    try {
      const { session, stream, context, processor, source } = await startMeetingSession(handleMessage, handleError);
      sessionRef.current = session;
      streamRef.current = stream;
      audioContextRef.current = context;
      scriptProcessorRef.current = processor;
      sourceRef.current = source;
      setIsMeetingActive(true);
    } catch (err: any) {
      handleError(err);
    }
  }, [handleError, handleMessage, isMeetingActive]);

  const stopMeeting = useCallback(async () => {
    if (!isMeetingActive) return;

    stopMeetingResources();

    if (transcriptionHistory.length === 0) {
      setError('会話の文字起こしが取得できませんでした。会議を再度開始してください。');
      return;
    }

    setIsProcessing(true);
    setError(null);
    const fullTranscript = transcriptionHistory
      .map((entry) => `${entry.speaker === 'user' ? 'ユーザー' : 'アシスタント'}: ${entry.text}`)
      .join('\n');

    try {
      const result = await generateMinutesAndTasks(fullTranscript);
      setMeetingMinutes(result.meetingMinutes);
      setTasks(result.tasks);
    } catch (err: any) {
      handleError(err);
    } finally {
      setIsProcessing(false);
    }
  }, [handleError, isMeetingActive, stopMeetingResources, transcriptionHistory]);

  useEffect(() => {
    return () => {
      stopMeetingResources();
    };
  }, [stopMeetingResources]);

  return (
    <div className="w-full">
      <div className="w-full bg-slate-900/90 text-slate-100 rounded-3xl border border-slate-800 shadow-2xl p-6 space-y-8">
        <header className="text-center space-y-2">
          <div className="flex items-center justify-center gap-3 text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-300">
            <IconSparkles className="w-8 h-8" />
            <span>Gemini Live 会議アシスタント</span>
          </div>
          <p className="text-sm text-slate-400">
            リアルタイムで文字起こし・要約・アクション抽出された議事録を生成します。APIキーとマイクの権限を確認した上でご利用ください。
          </p>
        </header>

        <div className="space-y-6">
          <MeetingControls isMeetingActive={isMeetingActive} onStartMeeting={startMeeting} onStopMeeting={stopMeeting} />

          {error && (
            <div className="flex items-center gap-2 bg-red-900/60 border border-red-800 text-red-200 px-4 py-3 rounded-2xl text-sm">
              <IconAlertTriangle className="w-5 h-5 text-red-300" />
              <span>{error}</span>
            </div>
          )}

          <TranscriptionView transcriptionHistory={transcriptionHistory} isMeetingActive={isMeetingActive} />

          {isProcessing && (
            <div className="flex flex-col items-center justify-center gap-3 py-6 text-center text-blue-200">
              <IconLoader className="w-10 h-10 animate-spin text-blue-300" />
              <p className="font-semibold text-lg">議事録とタスクを生成中...</p>
              <p className="text-sm text-slate-400">少々お待ちください。</p>
            </div>
          )}

          {(meetingMinutes || tasks.length > 0) && !isProcessing && <ResultsView minutes={meetingMinutes} tasks={tasks} />}
        </div>

        <footer className="text-center text-xs text-slate-500 border-t border-slate-800 pt-4">
          Gemini AIが生成する出力です。APIキーとマイクのアクセス許可が必要です。
        </footer>
      </div>
    </div>
  );
};

export default MeetingAssistant;
