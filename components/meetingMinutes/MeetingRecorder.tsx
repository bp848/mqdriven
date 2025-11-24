
import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2, AlertCircle, MicOff, Smartphone, Monitor, Volume2, Info, Activity } from 'lucide-react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { AudioVisualizer } from './AudioVisualizer';
import { transcribeAudio, analyzeTranscript, getMeetingMinutesApiKey } from './services';
import { MeetingStatus, type Meeting } from './types';
import { MODEL_LIVE } from './constants';

const generateId = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

interface MeetingRecorderProps {
  onCancel: () => void;
  onComplete: (meeting: Meeting) => void;
}

export const MeetingRecorder: React.FC<MeetingRecorderProps> = ({ onCancel, onComplete }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [processingStep, setProcessingStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [permissionState, setPermissionState] = useState<PermissionState | null>(null);
  const [realtimeTranscript, setRealtimeTranscript] = useState<string>("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  
  // Live API Refs
  const liveSessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const transcriptAccumulatorRef = useRef<string>("");

  // Check microphone permission on mount
  useEffect(() => {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'microphone' as PermissionName })
        .then((status) => {
          setPermissionState(status.state);
          status.onchange = () => {
            setPermissionState(status.state);
            if (status.state === 'granted') {
              setError(null);
            } else if (status.state === 'denied') {
              setError("マイクへのアクセスがブロックされています。");
            }
          };
        })
        .catch(() => {
          // Browser might not support 'microphone' in permissions query
        });
    }
    
    return () => {
      cleanupLiveSession();
    };
  }, []);

  // Auto-scroll to bottom when realtime transcript updates
  useEffect(() => {
    if (previewRef.current) {
      previewRef.current.scrollTop = previewRef.current.scrollHeight;
    }
  }, [realtimeTranscript]);

  const cleanupLiveSession = () => {
    if (liveSessionRef.current) {
      // Close session if method exists, or just let it disconnect
      try { liveSessionRef.current.close(); } catch (e) {}
      liveSessionRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  const startLiveTranscribing = async (audioStream: MediaStream) => {
    try {
      const apiKey = getMeetingMinutesApiKey();
      const ai = new GoogleGenAI({ apiKey });
      
      // Setup AudioContext for 16kHz PCM
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;
      
      const source = audioCtx.createMediaStreamSource(audioStream);
      sourceRef.current = source;
      
      // Buffer size 4096, 1 input channel, 1 output channel
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      // Connect Live API
      const sessionPromise = ai.live.connect({
        model: MODEL_LIVE,
        callbacks: {
          onopen: () => {
            console.log("Live API Connected");
            // Start streaming audio
            source.connect(processor);
            processor.connect(audioCtx.destination);
          },
          onmessage: (message: LiveServerMessage) => {
            // Handle Transcription
            if (message.serverContent?.inputTranscription) {
              const text = message.serverContent.inputTranscription.text;
              if (text) {
                transcriptAccumulatorRef.current += text;
                setRealtimeTranscript(transcriptAccumulatorRef.current);
              }
            }
          },
          onclose: () => {
            console.log("Live API Closed");
          },
          onerror: (err) => {
            console.error("Live API Error", err);
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {}, // Enable input transcription with default settings
          systemInstruction: "You are a silent listener. Do not speak. Just transcribe.",
        }
      });

      liveSessionRef.current = sessionPromise;

      // Audio Processing Loop
      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Create PCM Blob (16-bit PCM)
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          // Float32 (-1.0 to 1.0) -> Int16 (-32768 to 32767)
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        
        // Convert to base64
        let binary = '';
        const bytes = new Uint8Array(pcmData.buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64Data = btoa(binary);

        // Send to Live API
        sessionPromise.then(session => {
          session.sendRealtimeInput({
            media: {
              mimeType: 'audio/pcm;rate=16000',
              data: base64Data
            }
          });
        }).catch(e => console.error("Failed to send audio", e));
      };

    } catch (e) {
      console.error("Failed to start Live API", e);
      // Do not block main recording if Live API fails
    }
  };

  const startRecording = async () => {
    setError(null);
    setRealtimeTranscript("");
    transcriptAccumulatorRef.current = "";
    
    if (permissionState === 'denied') {
      setError("マイクの使用がブロックされています。ブラウザのアドレスバーから設定を変更してください。");
      return;
    }

    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStream(audioStream);
      setPermissionState('granted');
      
      // 1. Start MediaRecorder (For final high-quality processing)
      const mediaRecorder = new MediaRecorder(audioStream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.start();

      // 2. Start Live API (For real-time preview)
      await startLiveTranscribing(audioStream);

      setIsRecording(true);
      setElapsedTime(0);
      
      timerRef.current = window.setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
      
    } catch (err: any) {
      console.error("Microphone access error:", err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError("マイクへのアクセスが拒否されました。ブラウザの設定で許可してください。");
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError("マイクが見つかりません。接続を確認してください。");
      } else {
        setError("マイクの起動に失敗しました: " + (err.message || "不明なエラー"));
      }
    }
  };

  const stopRecording = () => {
    cleanupLiveSession(); // Stop Live API immediately

    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.onstop = async () => {
        // Stop all tracks
        stream?.getTracks().forEach(track => track.stop());
        setStream(null);
        setIsRecording(false);
        clearInterval(timerRef.current);
        
        await processRecording();
      };
    }
  };

  const processRecording = async () => {
    try {
      setProcessingStep("音声を文字起こし中...");
      const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' }); // Or audio/mp4 depending on browser
      
      // Convert Blob to Base64
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64String = (reader.result as string).split(',')[1];
        const mimeType = (reader.result as string).split(',')[0].split(':')[1].split(';')[0];

        // 1. Transcribe (Gemini Flash) - Final High Quality
        const transcript = await transcribeAudio(base64String, mimeType);
        
        setProcessingStep("会話を分析中 (思考中)...");
        
        // 2. Analyze (Gemini Pro with Thinking)
        const analysis = await analyzeTranscript(transcript);

        const newMeeting: Meeting = {
          id: generateId(),
          title: analysis.title || `${new Date().toLocaleDateString('ja-JP')} の会議`,
          date: new Date().toISOString(),
          durationSeconds: elapsedTime,
          transcript: transcript,
          summary: analysis.summary,
          actionItems: analysis.actionItems,
          status: MeetingStatus.COMPLETED,
          synced: false
        };

        onComplete(newMeeting);
      };
      
    } catch (err) {
      setError("処理に失敗しました。もう一度お試しください。");
      console.error(err);
      setProcessingStep(null);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-8 animate-fade-in pb-12 w-full max-w-4xl mx-auto">
      
      <div className="text-center space-y-2 mt-8">
        <h2 className="text-3xl font-bold text-white">
          {isRecording ? '聞き取り中...' : processingStep ? '処理中...' : '会議を開始'}
        </h2>
        <p className="text-slate-400">
          {isRecording 
            ? 'Gemini Live がリアルタイムで音声を聞き取っています' 
            : processingStep 
              ? 'Gemini 2.5 Flash & 3 Pro (思考モード) を使用中' 
              : '会議を録音して議事録とアクションプランを作成します'}
        </p>
      </div>

      {/* Visualizer Area */}
      <div className="w-full max-w-md h-32 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-center overflow-hidden relative shadow-inner">
        {isRecording ? (
          <AudioVisualizer stream={stream} isRecording={isRecording} />
        ) : processingStep ? (
           <div className="flex flex-col items-center gap-3">
             <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
             <span className="text-xs text-brand-400 font-mono uppercase tracking-widest animate-pulse">AI処理中</span>
           </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-2 text-red-400">
            <MicOff className="w-6 h-6" />
            <span className="text-xs font-medium">マイクエラー</span>
          </div>
        ) : (
          <div className="text-slate-600 flex items-center gap-2">
            <Mic className="w-6 h-6" />
            <span>録音準備完了</span>
          </div>
        )}
      </div>

      {/* Real-time Preview Area */}
      {isRecording && (
        <div className="w-full max-w-2xl animate-fade-in-up">
          <div 
            ref={previewRef}
            className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 min-h-[120px] max-h-[200px] overflow-y-auto relative"
          >
            <div className="flex items-center gap-2 text-xs text-brand-400 mb-2 font-mono uppercase tracking-wider sticky top-0 bg-slate-900/95 py-1 w-full">
              <Activity className="w-3 h-3 animate-pulse" />
              リアルタイムプレビュー
            </div>
            <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap font-medium">
              {realtimeTranscript || <span className="text-slate-600 italic">音声待機中...</span>}
            </p>
          </div>
        </div>
      )}

      {/* Timer */}
      {(isRecording || elapsedTime > 0) && !processingStep && (
        <div className="text-5xl font-mono font-light text-slate-200 tracking-wider">
          {formatTime(elapsedTime)}
        </div>
      )}

      {/* Controls */}
      {error && (
        <div className="flex items-center gap-2 text-red-400 bg-red-950/50 px-4 py-2 rounded-lg border border-red-900 max-w-md text-left">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      <div className="flex gap-6">
        {!isRecording && !processingStep && (
          <>
            <button 
              onClick={onCancel}
              className="px-6 py-3 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
            >
              キャンセル
            </button>
            <button 
              onClick={startRecording}
              className="group relative px-8 py-3 bg-brand-600 hover:bg-brand-500 text-white rounded-full font-semibold shadow-lg shadow-brand-600/30 transition-all hover:scale-105 flex items-center gap-2"
            >
              <Mic className="w-5 h-5" />
              録音開始
            </button>
          </>
        )}

        {isRecording && (
          <button 
            onClick={stopRecording}
            className="px-8 py-3 bg-red-500 hover:bg-red-400 text-white rounded-full font-semibold shadow-lg shadow-red-500/30 transition-all hover:scale-105 flex items-center gap-2"
          >
            <Square className="w-5 h-5 fill-current" />
            会議終了
          </button>
        )}
      </div>

      {/* Usage Guide - Only show when not recording */}
      {!isRecording && !processingStep && (
        <div className="w-full max-w-2xl mt-12">
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
              <Info className="w-5 h-5 text-brand-400" />
              使い方と設置ガイド
            </h3>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-slate-800 rounded-lg text-brand-400">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-200">スマホ側の設定</p>
                    <p className="text-sm text-slate-400 mt-1">
                      Google Meetなどで会議に参加し、<span className="text-brand-300 font-medium">スピーカーフォン</span>に設定してください。
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 bg-slate-800 rounded-lg text-brand-400">
                    <Monitor className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-200">このPCの設定</p>
                    <p className="text-sm text-slate-400 mt-1">
                      このアプリで「録音開始」を押します。PCのマイクがスマホの音声を拾います。
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-amber-950/20 border border-amber-900/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2 text-amber-400">
                  <Volume2 className="w-5 h-5" />
                  <p className="font-medium">ハウリング対策</p>
                </div>
                <ul className="text-sm text-amber-200/80 space-y-2 list-disc list-inside">
                  <li>スマホとPCを近づけすぎないでください。</li>
                  <li>PCのスピーカーから音が出ている場合は、PCの音量を下げるか、マイクの位置を調整してください。</li>
                  <li>「キーン」という音が鳴る場合は、すぐに距離を離してください。</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
