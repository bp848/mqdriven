import React, { useState, useEffect, useCallback, useRef } from 'react';
import Button from './Button';
import { MeetingSummary, ActionItem } from '../types';

const MeetingAssistant: React.FC = () => {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [transcription, setTranscription] = useState<string>('');
  const [summary, setSummary] = useState<MeetingSummary | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState<boolean>(false);
  const transcriptionIntervalRef = useRef<number | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Mock transcription data for demonstration
  const mockTranscriptionChunks = [
    "本日も皆様、お集まりいただきありがとうございます。",
    "本日のアジェンダは、新製品のマーケティング戦略についてです。",
    "まず、市場調査の結果から発表します。",
    "担当は田中さん、お願いします。",
    "（田中）はい、市場調査の結果、若年層に響くデザインが求められていることが判明しました。",
    "特にSNSでの拡散が重要です。",
    "ありがとうございます。次に、具体的なプロモーション計画について議論しましょう。",
    "佐藤さん、何か提案はありますか？",
    "（佐藤）はい、インフルエンサーとのコラボレーションを検討しています。",
    "予算は〇〇円を想定しております。",
    "なるほど。期日は来月末までに具体的なリストアップと見積もりをお願いします。",
    "この件の担当は佐藤さんでお願いします。",
    "他に意見はありますか？",
    "では、次回の会議までに各部門で検討事項を整理してきてください。",
    "次回の会議は来週の火曜日の午後2時で設定します。",
    "本日はこれで終了です。ありがとうございました。",
  ];

  const mockSummaryData: MeetingSummary = {
    summary:
      "本日の会議では、新製品のマーケティング戦略について議論しました。市場調査の結果、若年層に響くデザインとSNSでの拡散が重要であることが確認されました。具体的なプロモーション計画としてインフルエンサーとのコラボレーションが提案され、来月末までに具体的なリストアップと見積もりを行うことが決定しました。",
    keyDecisions: [
      "新製品のデザインは若年層に響くものを重視する。",
      "SNSでの拡散をマーケティング戦略の柱とする。",
      "インフルエンサーとのコラボレーションを具体的に検討し、来月末までにリストアップと見積もりを提出する。",
    ],
    actionItems: [
      {
        id: '1',
        description: "市場調査結果の発表",
        assignee: "田中さん",
        dueDate: "完了済",
      },
      {
        id: '2',
        description: "インフルエンサーとのコラボレーションに関するリストアップと見積もり",
        assignee: "佐藤さん",
        dueDate: "来月末",
      },
      {
        id: '3',
        description: "次回の会議までに各部門で検討事項を整理",
        assignee: "各部門",
        dueDate: "来週火曜日",
      },
    ],
  };

  const startTranscription = useCallback(() => {
    let chunkIndex = 0;
    setTranscription('');
    transcriptionIntervalRef.current = window.setInterval(() => {
      if (chunkIndex < mockTranscriptionChunks.length) {
        setTranscription((prev) => prev + mockTranscriptionChunks[chunkIndex] + ' ');
        chunkIndex++;
      } else {
        // Optional: stop transcription if all chunks are displayed
        // This simulates a meeting ending when content runs out
        // For a real app, this would be tied to user action or audio input ending
        clearInterval(transcriptionIntervalRef.current!);
        transcriptionIntervalRef.current = null;
        // If the transcription mock automatically ends, and we are still recording,
        // we might want to automatically trigger end meeting.
        // For now, let's assume the user manually ends the meeting.
      }
    }, 1500); // Add a new chunk every 1.5 seconds
  }, []);

  const stopTranscription = useCallback(() => {
    if (transcriptionIntervalRef.current) {
      clearInterval(transcriptionIntervalRef.current);
      transcriptionIntervalRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        // In a real application, send audioBlob to a backend for actual transcription/processing
        console.log('Recording stopped. Audio Blob:', audioBlob);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setSummary(null); // Clear previous summary
      startTranscription(); // Start mock transcription
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('マイクへのアクセスが拒否されました。会議の録音と文字起こしを開始できません。');
      setIsRecording(false);
    }
  }, [startTranscription]);

  const endRecording = useCallback(() => {
    stopTranscription(); // Stop mock transcription
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    setIsRecording(false);
    setIsLoadingSummary(true);

    // Simulate AI summary generation
    setTimeout(() => {
      setSummary(mockSummaryData);
      setIsLoadingSummary(false);
    }, 3000); // Simulate 3 seconds for AI to process
  }, [stopTranscription]);

  // Clean up interval on component unmount
  useEffect(() => {
    return () => {
      stopTranscription();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-8">
      {/* Control Buttons */}
      <div className="flex flex-col md:flex-row gap-4 justify-center sticky bottom-0 bg-white p-4 -mx-6 md:-mx-8 border-t border-gray-200 shadow-lg z-10">
        <Button onClick={startRecording} disabled={isRecording} isLoading={false}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
          </svg>
          Start Meeting
        </Button>
        <Button onClick={endRecording} disabled={!isRecording} variant="danger">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 9a1 1 0 000 2h4a1 1 0 100-2H8z" clipRule="evenodd" />
          </svg>
          End Meeting
        </Button>
      </div>

      {/* Real-time Transcription Section */}
      <section className="bg-gray-50 p-6 rounded-lg shadow-inner border border-gray-200">
        <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-blue-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v2M7 7h10" />
          </svg>
          リアルタイム文字起こし
        </h2>
        {isRecording ? (
          <div className="animate-pulse text-lg text-gray-600 mb-2 flex items-center">
            <span className="relative flex h-3 w-3 mr-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
            <span>会議を録音して文字起こし中...</span>
          </div>
        ) : (
          <p className="text-gray-500 italic">会議を開始すると、リアルタイムの文字起こしがここに表示されます。</p>
        )}
        <div className="mt-4 p-4 min-h-[150px] max-h-[300px] overflow-y-auto bg-white border border-gray-300 rounded-md shadow-sm text-gray-700 leading-relaxed text-base">
          {transcription || (isRecording ? "音声入力を待っています..." : "文字起こしがここに表示されます。")}
        </div>
      </section>

      {/* Meeting Summary & Action Plan Section */}
      <section className="bg-white p-6 rounded-lg shadow-xl border border-blue-100">
        <h2 className="text-2xl font-bold text-blue-700 mb-4 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-blue-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          会議の要約とアクションプラン
        </h2>
        {isLoadingSummary ? (
          <div className="flex items-center justify-center p-8 text-lg text-blue-600">
            <svg className="animate-spin h-6 w-6 text-blue-500 mr-3" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>要約を生成中...</span>
          </div>
        ) : summary ? (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">要約</h3>
              <p className="text-gray-700 leading-relaxed">{summary.summary}</p>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">主要な決定事項</h3>
              <ul className="list-disc list-inside text-gray-700 space-y-1 pl-4">
                {summary.keyDecisions.map((decision, index) => (
                  <li key={index}>{decision}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">アクションアイテム</h3>
              {summary.actionItems.length > 0 ? (
                <ul className="space-y-3">
                  {summary.actionItems.map((item) => (
                    <li key={item.id} className="bg-blue-50 p-4 rounded-md border border-blue-200">
                      <p className="font-medium text-gray-800">{item.description}</p>
                      {item.assignee && (
                        <p className="text-sm text-gray-600 mt-1">
                          担当者: <span className="font-semibold">{item.assignee}</span>
                        </p>
                      )}
                      {item.dueDate && (
                        <p className="text-sm text-gray-600 mt-1">
                          期日: <span className="font-semibold">{item.dueDate}</span>
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-600 italic">アクションアイテムはありません。</p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-gray-600 italic p-8 text-center">会議が終了すると、会議の要約とアクションアイテムがここに表示されます。</p>
        )}
      </section>
    </div>
  );
};

export default MeetingAssistant;