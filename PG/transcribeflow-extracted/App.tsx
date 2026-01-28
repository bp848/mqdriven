import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  SparklesIcon,
  MicrophoneIcon,
  StopIcon,
  PlusIcon,
  ChevronLeftIcon,
  TrashIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  ListBulletIcon,
  PlayCircleIcon,
  ChatBubbleLeftRightIcon,
  ArrowRightIcon,
  ArrowDownOnSquareIcon,
  CloudIcon,
  SpeakerWaveIcon,
  InformationCircleIcon,
  KeyIcon,
  ExclamationTriangleIcon,
  ArrowPathRoundedSquareIcon,
  ChartBarIcon,
  DocumentArrowUpIcon,
  MusicalNoteIcon,
  VideoCameraIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { HistoryEntry, MediaMetadata, VisibilityLevel } from './types';
import { transcribeMedia, generateSummary } from './services/geminiService';
import { supabase } from './services/supabase';
import { GoogleGenAI, Modality, LiveServerMessage } from "@google/genai";
import WordCloud from './components/WordCloud';

type AppView = 'list' | 'detail' | 'create';
type CreateStep = 'info' | 'action';
type ListFilter = 'all' | 'shared' | 'private';

const CURRENT_USER = { id: 'user-001', name: '石崎 洋平', dept: '営業本部' };

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

const App: React.FC = () => {
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [view, setView] = useState<AppView>('list');
  const [createStep, setCreateStep] = useState<CreateStep>('info');
  const [listFilter, setListFilter] = useState<ListFilter>('all');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [selectedMinute, setSelectedMinute] = useState<HistoryEntry | null>(null);
  
  const [meetingTopic, setMeetingTopic] = useState('');
  const [meetingAttendees, setMeetingAttendees] = useState('');
  const [meetingLocation, setMeetingLocation] = useState('');
  const [meetingCategory, setMeetingCategory] = useState('一般会議');
  const [visibility, setVisibility] = useState<VisibilityLevel>('private');

  const [isRecording, setIsRecording] = useState(false);
  const isRecordingRef = useRef(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processPhase, setProcessPhase] = useState<'idle' | 'preparing' | 'transcribing' | 'summarizing' | 'saving'>('idle');
  const [logs, setLogs] = useState<string[]>([]);
  const [media, setMedia] = useState<MediaMetadata | null>(null);

  const [volumeLevel, setVolumeLevel] = useState(0);
  const [audioStatus, setAudioStatus] = useState<'quiet' | 'good' | 'loud'>('good');
  const [liveTranscript, setLiveTranscript] = useState('');
  const liveSessionRef = useRef<any>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const init = async () => {
      const selected = await window.aistudio.hasSelectedApiKey();
      setHasKey(selected);

      let data = null;
      if (supabase) {
        const { data: sbData } = await supabase
          .from('minutes')
          .select('*')
          .order('created_at', { ascending: false });
        data = sbData;
      }
      if (data) {
        setHistory(data);
      } else {
        const saved = localStorage.getItem('minute_history_v14');
        if (saved) setHistory(JSON.parse(saved));
      }
    };
    init();
  }, []);

  const handleSelectKey = async () => {
    await window.aistudio.openSelectKey();
    setHasKey(true);
  };

  const addLog = (msg: string) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    addLog(`ファイルの読込中: ${file.name}`);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      setMedia({
        name: file.name,
        size: file.size,
        type: file.type || 'audio/mpeg',
        url: URL.createObjectURL(file),
        base64
      });
      addLog("ファイルが準備できました。解析ボタンを押してください。");
    };
    reader.onerror = () => addLog("ファイルの読み込みに失敗しました。");
    reader.readAsDataURL(file);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => { if (event.data.size > 0) audioChunksRef.current.push(event.data); };
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          setMedia({ name: `録音_${new Date().getTime()}.webm`, size: audioBlob.size, type: 'audio/webm', url: URL.createObjectURL(audioBlob), base64 });
        };
        reader.readAsDataURL(audioBlob);
      };

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      setLiveTranscript('');
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => addLog("ライブストリーム接続完了"),
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.inputTranscription) {
              setLiveTranscript(prev => prev + message.serverContent!.inputTranscription!.text);
            }
          },
          onerror: (e) => {
            if (e.toString().includes("403") || e.toString().includes("leaked")) setHasKey(false);
          },
          onclose: () => addLog("ライブ接続終了"),
        },
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
        }
      });

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);

      const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
      scriptProcessor.onaudioprocess = (e) => {
        if (!isRecordingRef.current) return;
        const inputData = e.inputBuffer.getChannelData(0);
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
        const rms = Math.sqrt(sum / inputData.length);
        const level = Math.min(1, rms * 5);
        setVolumeLevel(level);
        setAudioStatus(level < 0.05 ? 'quiet' : level > 0.8 ? 'loud' : 'good');
        const int16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
        const pcmBlob = { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
        sessionPromise.then(s => s.sendRealtimeInput({ media: pcmBlob })).catch(() => {});
      };
      source.connect(scriptProcessor);
      scriptProcessor.connect(audioContext.destination);

      mediaRecorder.start();
      setIsRecording(true);
      isRecordingRef.current = true;
      setRecordingTime(0);
      timerRef.current = window.setInterval(() => setRecordingTime(t => t + 1), 1000);
      visualize(analyser);
      
      liveSessionRef.current = {
        stop: () => {
          sessionPromise.then(s => s.close());
          scriptProcessor.disconnect(); source.disconnect(); audioContext.close();
        }
      };
    } catch (err) { alert("マイクへのアクセスを許可してください。"); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecordingRef.current) {
      mediaRecorderRef.current.stop();
      if (liveSessionRef.current) liveSessionRef.current.stop();
      setIsRecording(false);
      isRecordingRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    }
  };

  const visualize = (analyser: AnalyserNode) => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d')!;
    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(dataArray);
      ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
      const barWidth = (canvasRef.current!.width / analyser.frequencyBinCount) * 2.5;
      let x = 0;
      for (let i = 0; i < analyser.frequencyBinCount; i++) {
        const barHeight = (dataArray[i] / 255) * canvasRef.current!.height;
        ctx.fillStyle = audioStatus === 'loud' ? '#ef4444' : audioStatus === 'quiet' ? '#eab308' : '#6366f1';
        ctx.fillRect(x, canvasRef.current!.height - barHeight, barWidth, barHeight);
        x += barWidth + 2;
      }
    };
    draw();
  };

  const startAnalysis = async () => {
    if (!media) return;
    setIsProcessing(true);
    setProcessPhase('preparing');
    addLog("高精度解析エンジンを起動中...");

    const tempId = Math.random().toString(36).substr(2, 9);
    const initialEntry: HistoryEntry = {
      id: tempId, date: new Date().toLocaleDateString('ja-JP'), fileName: meetingTopic || media.name,
      author: CURRENT_USER.name, ownerId: CURRENT_USER.id, department: CURRENT_USER.dept,
      status: '解析中', visibility: visibility, transcript: [], wordCount: 0, charCount: 0,
    };

    try {
      setHistory(prev => [initialEntry, ...prev]);
      setProcessPhase('transcribing');
      const { transcript } = await transcribeMedia(media.base64, media.type, { topic: meetingTopic, attendees: meetingAttendees, location: meetingLocation, category: meetingCategory }, addLog);
      
      setProcessPhase('summarizing');
      const summary = await generateSummary(transcript, { topic: meetingTopic, attendees: meetingAttendees, location: meetingLocation, category: meetingCategory }, addLog);
      
      const finalEntry: HistoryEntry = {
        ...initialEntry, fileName: summary.title, status: '解析済み', transcript, summary,
        wordCount: transcript.length, charCount: transcript.reduce((acc, curr) => acc + curr.text.length, 0),
      };

      if (supabase) await supabase.from('minutes').insert([{ ...finalEntry, created_at: new Date().toISOString() }]);
      setHistory(prev => {
        const updated = prev.map(h => h.id === tempId ? finalEntry : h);
        localStorage.setItem('minute_history_v14', JSON.stringify(updated));
        return updated;
      });
      setSelectedMinute(finalEntry);
      setView('detail');
    } catch (err: any) {
      if (err.message.includes("AUTH_REQUIRED") || err.message.includes("403")) setHasKey(false);
      addLog(`エラー: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const keywords = useMemo(() => {
    if (!selectedMinute) return [];
    const text = selectedMinute.transcript.map(t => t.text).join(' ');
    const words = text.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]{2,}/g) || [];
    const counts: Record<string, number> = {};
    words.forEach(w => counts[w] = (counts[w] || 0) + 1);
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([text, size]) => ({ text, size }));
  }, [selectedMinute]);

  const deleteEntry = async (id: string) => {
    if (!window.confirm("このドキュメントを削除しますか？")) return;
    if (supabase) await supabase.from('minutes').delete().eq('id', id);
    const updated = history.filter(h => h.id !== id);
    setHistory(updated);
    localStorage.setItem('minute_history_v14', JSON.stringify(updated));
    if (selectedMinute?.id === id) setSelectedMinute(null);
  };

  if (hasKey === false) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-[3rem] p-12 shadow-2xl text-center space-y-10">
          <ExclamationTriangleIcon className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="text-3xl font-black text-slate-900">API認証エラー</h2>
          <p className="text-slate-500">APIキーが無効、または漏洩の可能性があります。新しいキーを選択してください。</p>
          <button onClick={handleSelectKey} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-3">
            APIキーを選択し直す <KeyIcon className="w-6 h-6" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20">
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b h-20 flex items-center shadow-sm px-8">
        <div className="max-w-7xl mx-auto w-full flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('list')}>
            <div className="bg-indigo-600 p-2.5 rounded-2xl shadow-lg"><SparklesIcon className="w-6 h-6 text-white" /></div>
            <span className="text-2xl font-black tracking-tighter">TranscribeFlow</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleSelectKey} title="APIキーを変更" className="p-3 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
              <ArrowPathRoundedSquareIcon className="w-6 h-6" />
            </button>
            <button onClick={() => { setView('create'); setCreateStep('info'); setMedia(null); setMeetingTopic(''); }} className="bg-white text-slate-600 border px-6 py-3 rounded-2xl font-black text-xs shadow-sm flex items-center gap-2 hover:bg-slate-50">
              <PlusIcon className="w-4 h-4" /> 新規
            </button>
            <button onClick={() => { setView('create'); setCreateStep('action'); setMedia(null); setMeetingTopic('クイック解析'); }} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black text-xs shadow-xl flex items-center gap-2 hover:bg-indigo-700 transition-all">
              <MicrophoneIcon className="w-4 h-4" /> クイック録音
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-8">
        {view === 'list' && (
          <div className="space-y-10 animate-fade-in">
             <div className="flex items-center justify-between">
                <h2 className="text-4xl font-black tracking-tighter">ドキュメント</h2>
                <div className="flex gap-2 bg-white border p-1 rounded-2xl">
                   {['all', 'shared', 'private'].map(f => (
                     <button key={f} onClick={() => setListFilter(f as any)} className={`px-5 py-2 rounded-xl text-[11px] font-black transition-all ${listFilter === f ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>
                       {f === 'all' ? 'すべて' : f === 'shared' ? '共有' : '個人'}
                     </button>
                   ))}
                </div>
             </div>
             <div className="bg-white rounded-[2.5rem] border shadow-sm overflow-hidden">
                <table className="w-full text-left">
                   <thead className="bg-slate-50 text-[10px] uppercase font-black text-slate-400 border-b">
                      <tr><th className="px-10 py-6">ステータス</th><th className="px-10 py-6">議題</th><th className="px-10 py-6">日付</th><th className="px-10 py-6 text-right">操作</th></tr>
                   </thead>
                   <tbody className="divide-y text-sm">
                      {history.filter(h => listFilter === 'all' || h.visibility === listFilter).map(item => (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors cursor-pointer group" onClick={() => { setSelectedMinute(item); setView('detail'); }}>
                           <td className="px-10 py-8 italic font-black text-indigo-500 uppercase">{item.status}</td>
                           <td className="px-10 py-8 font-black text-lg group-hover:text-indigo-600 transition-colors">{item.fileName}</td>
                           <td className="px-10 py-8 text-slate-400 font-mono">{item.date}</td>
                           <td className="px-10 py-8 text-right">
                              <button onClick={(e) => { e.stopPropagation(); deleteEntry(item.id); }} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><TrashIcon className="w-5 h-5" /></button>
                           </td>
                        </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </div>
        )}

        {view === 'create' && (
          <div className="max-w-5xl mx-auto space-y-12 animate-fade-in">
            {createStep === 'info' ? (
              <div className="bg-white p-16 rounded-[4rem] border shadow-2xl text-center space-y-12">
                <h3 className="text-4xl font-black tracking-tight">会議設定</h3>
                <div className="text-left space-y-3">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-4">会議の議題</label>
                  <input type="text" value={meetingTopic} onChange={e => setMeetingTopic(e.target.value)} placeholder="議題を入力してください" className="w-full px-8 py-6 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-[2rem] font-black outline-none text-xl transition-all shadow-inner" />
                </div>
                <button onClick={() => setCreateStep('action')} disabled={!meetingTopic} className={`w-full py-8 rounded-[2.5rem] font-black text-2xl transition-all ${meetingTopic ? 'bg-indigo-600 text-white shadow-xl hover:bg-indigo-700' : 'bg-slate-100 text-slate-300'}`}>次へ進む</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                 <div className="lg:col-span-5 space-y-8">
                    <div className="bg-white p-10 rounded-[3.5rem] border shadow-xl flex flex-col items-center gap-8">
                       <h3 className="text-xl font-black flex items-center gap-2"><SpeakerWaveIcon className="w-5 h-5 text-indigo-500" /> 音声モニター</h3>
                       <div className={`text-6xl font-black font-mono tracking-tighter ${isRecording ? 'text-indigo-600' : 'text-slate-100'}`}>
                         {Math.floor(recordingTime/60).toString().padStart(2,'0')}:{ (recordingTime%60).toString().padStart(2,'0') }
                       </div>
                       <canvas ref={canvasRef} width="300" height="80" className="w-full h-20 bg-slate-50 rounded-2xl" />
                       <div className="flex gap-4">
                         <button onClick={isRecording ? stopRecording : startRecording} className={`w-28 h-28 rounded-[2rem] flex items-center justify-center shadow-2xl transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-indigo-700 text-white hover:bg-indigo-900'}`}>
                           {isRecording ? <StopIcon className="w-10 h-10" /> : <MicrophoneIcon className="w-10 h-10" />}
                         </button>
                         <button onClick={() => fileInputRef.current?.click()} className="w-28 h-28 rounded-[2rem] bg-slate-100 text-slate-600 flex items-center justify-center shadow-xl hover:bg-slate-200 transition-all">
                           <DocumentArrowUpIcon className="w-10 h-10" />
                         </button>
                         <input type="file" ref={fileInputRef} className="hidden" accept="audio/*,video/*" onChange={handleFileUpload} />
                       </div>
                       <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">録音 または ファイルアップロード</p>
                    </div>
                    {media && !isProcessing && (
                      <div className="bg-slate-900 p-8 rounded-[3rem] text-white space-y-6 animate-fade-in shadow-2xl">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-white/10 rounded-xl">
                            {media.type.startsWith('video') ? <VideoCameraIcon className="w-6 h-6 text-indigo-400" /> : <MusicalNoteIcon className="w-6 h-6 text-indigo-400" />}
                          </div>
                          <div className="overflow-hidden">
                            <p className="font-black text-sm truncate">{media.name}</p>
                            <p className="text-[10px] text-white/40 font-mono uppercase">{(media.size / 1024 / 1024).toFixed(2)} MB</p>
                          </div>
                          <button onClick={() => setMedia(null)} className="ml-auto p-2 text-white/40 hover:text-white transition-colors"><XMarkIcon className="w-5 h-5" /></button>
                        </div>
                        <button onClick={startAnalysis} className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black text-md hover:bg-indigo-500 transition-all flex items-center justify-center gap-3">
                          <SparklesIcon className="w-5 h-5" /> 解析を開始
                        </button>
                      </div>
                    )}
                 </div>
                 <div className="lg:col-span-7 bg-slate-900 p-12 rounded-[4rem] min-h-[500px] text-white shadow-2xl flex flex-col gap-8">
                    <h3 className="font-black text-2xl uppercase tracking-tighter flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-slate-700'}`} />
                      Live Feed
                    </h3>
                    <div className="flex-1 overflow-y-auto font-mono text-xl leading-relaxed text-indigo-50/70 italic custom-scrollbar">
                       {isRecording ? (liveTranscript || "音声を待機しています...") : "録音を開始するか、メディアをアップロードしてください。"}
                    </div>
                 </div>
              </div>
            )}
          </div>
        )}

        {view === 'detail' && selectedMinute && (
          <div className="max-w-6xl mx-auto space-y-12 animate-fade-in pb-40">
            <button onClick={() => setView('list')} className="text-slate-400 font-black hover:text-slate-900 flex items-center gap-2 group transition-colors">
              <ChevronLeftIcon className="w-6 h-6 group-hover:-translate-x-1 transition-transform" /> 一覧へ戻る
            </button>
            <div className="bg-white p-20 rounded-[5rem] border shadow-2xl space-y-12">
              <div className="flex items-center gap-4">
                 <span className="bg-indigo-600 text-white px-5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest italic">Gemini 3 Pro Output</span>
                 <span className="bg-slate-100 text-slate-500 px-5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest">{selectedMinute.status}</span>
              </div>
              <h2 className="text-6xl font-black tracking-tighter text-slate-900 leading-tight">{selectedMinute.summary?.title}</h2>
              <div className="p-10 bg-indigo-50/30 rounded-[3rem] text-slate-700 leading-relaxed text-2xl font-medium border border-indigo-100/20 shadow-inner">
                {selectedMinute.summary?.overview}
              </div>
              <div className="pt-8 space-y-8">
                 <h3 className="font-black text-slate-900 text-3xl flex items-center gap-4"><ChartBarIcon className="w-10 h-10 text-indigo-400" /> 主要トピック分析</h3>
                 <WordCloud words={keywords} />
              </div>
              <div className="grid lg:grid-cols-2 gap-12 pt-12">
                 <div className="space-y-8">
                    <h3 className="font-black text-slate-900 text-3xl flex items-center gap-4"><CheckCircleIcon className="w-10 h-10 text-emerald-500" /> 決定事項</h3>
                    {selectedMinute.summary?.decisions.map((d, i) => (
                      <div key={i} className="bg-emerald-50/10 p-6 rounded-3xl text-emerald-950 font-black text-lg flex gap-4 border border-emerald-100/30"><span>•</span> {d}</div>
                    ))}
                 </div>
                 <div className="space-y-8">
                    <h3 className="font-black text-slate-900 text-3xl flex items-center gap-4"><ArrowPathIcon className="w-10 h-10 text-indigo-500" /> ネクストアクション</h3>
                    {selectedMinute.summary?.nextActions.map((a, i) => (
                      <div key={i} className="bg-indigo-50/20 p-6 rounded-3xl text-indigo-950 font-black text-lg flex gap-4 border border-indigo-100/30"><span className="text-indigo-600 uppercase italic font-black">Next:</span> {a}</div>
                    ))}
                 </div>
              </div>
              <div className="pt-20 space-y-12 border-t">
                <h3 className="font-black text-slate-900 text-3xl flex items-center gap-4"><ListBulletIcon className="w-10 h-10 text-slate-300" /> 文字起こしログ</h3>
                <div className="space-y-10 max-h-[800px] overflow-y-auto pr-8 custom-scrollbar">
                  {selectedMinute.transcript.map((t, i) => (
                    <div key={i} className="flex gap-14 group">
                      <span className="text-[11px] font-mono font-black text-slate-300 w-16 pt-1 tracking-widest">{t.timestamp}</span>
                      <p className="text-slate-600 text-xl leading-relaxed group-hover:text-slate-900 transition-colors">{t.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {isProcessing && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-3xl z-[100] flex flex-col items-center justify-center text-white p-10 animate-fade-in">
           <div className="w-48 h-48 border-[16px] border-white/5 border-t-indigo-600 rounded-full animate-spin shadow-2xl mb-12" />
           <div className="text-center space-y-4">
              <h2 className="text-4xl font-black tracking-tighter uppercase">{processPhase}...</h2>
              <p className="text-indigo-200 text-lg uppercase tracking-widest font-black opacity-50 italic">Processing with Gemini 3 Pro</p>
           </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.6s ease-out forwards; }
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 20px; }
      `}} />
    </div>
  );
};

export default App;