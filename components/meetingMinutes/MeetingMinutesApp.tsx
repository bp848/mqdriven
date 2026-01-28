import React, { useEffect, useRef, useState } from 'react';
import type { MediaMetadata, TranscriptEntry, SummaryData, HistoryEntry } from './types';
import { transcribeMedia, generateSummary } from './services/geminiService';

const MAX_LOGS = 20;

const createId = () => {
  // crypto.randomUUID が無い環境向けフォールバック
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const MeetingMinutesApp: React.FC = () => {
  const [media, setMedia] = useState<MediaMetadata | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof window.setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // media.url の revoke（メモリリーク対策）
  useEffect(() => {
    return () => {
      if (media?.url) URL.revokeObjectURL(media.url);
    };
  }, [media]);

  useEffect(() => {
    const saved = localStorage.getItem('transcription_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch {
        // 壊れていたら無視
        localStorage.removeItem('transcription_history');
      }
    }
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  const addLog = (msg: string) => {
    setLogs(prev =>
      [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, MAX_LOGS),
    );
  };

  const saveToHistory = (t: TranscriptEntry[], name: string, s?: SummaryData) => {
    const text = t.map(x => x.text).join(' ');
    const entry: HistoryEntry = {
      id: createId(),
      date: new Date().toLocaleString('ja-JP'),
      fileName: name,
      transcript: t,
      summary: s,
      wordCount: text.trim() ? text.trim().split(/\s+/).length : 0,
      charCount: text.length,
    };

    // 非同期中でも古い history を掴まないよう functional update
    setHistory(prev => {
      const updated = [entry, ...prev];
      localStorage.setItem('transcription_history', JSON.stringify(updated));
      return updated;
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        addLog('ファイルの読み込みに失敗しました。');
        return;
      }
      const base64 = result.split(',')[1] ?? '';

      setMedia({
        name: file.name,
        size: file.size,
        type: file.type,
        url: URL.createObjectURL(file),
        base64,
      });

      addLog(`ファイル「${file.name}」を読み込みました。`);
    };

    reader.onerror = () => addLog('ファイルの読み込みでエラーが発生しました。');

    reader.readAsDataURL(file);

    // 同じファイルを再度選べるようにリセット
    e.target.value = '';
  };

  const startRecording = async () => {
    try {
      if (!('MediaRecorder' in window)) {
        addLog('このブラウザは録音（MediaRecorder）に対応していません。');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // ブラウザによっては mimeType 指定すると失敗するのでデフォルトで生成
      const recorder = new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const fr = new FileReader();

        fr.onloadend = () => {
          const result = fr.result;
          if (typeof result !== 'string') {
            addLog('録音データの変換に失敗しました。');
            return;
          }
          const base64 = result.split(',')[1] ?? '';

          const date = new Date().toLocaleDateString('ja-JP');
          const name = `録音_${date}.webm`;

          setMedia({
            name,
            size: blob.size,
            type: blob.type || 'audio/webm',
            url: URL.createObjectURL(blob),
            base64,
          });

          addLog('録音が終了しました。');
        };

        fr.onerror = () => addLog('録音データの読み込みでエラーが発生しました。');
        fr.readAsDataURL(blob);

        // マイク停止
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = window.setInterval(() => setRecordingTime(t => t + 1), 1000);

      addLog('録音を開始しました。');
    } catch {
      addLog('マイクへのアクセスに失敗しました。権限を確認してください。');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
      addLog('録音停止を要求しました。');
    }
  };

  const startAnalysis = async () => {
    if (!media) return;

    setIsProcessing(true);
    setTranscript([]);
    setSummary(null);
    setLogs([]);

    try {
      addLog('音声/動画をテキストに変換中...');
      const { transcript: t } = await transcribeMedia(media.base64, media.type, addLog);
      setTranscript(t);

      addLog('要約を生成中...');
      const s = await generateSummary(t, addLog);
      setSummary(s);

      saveToHistory(t, media.name, s);
      addLog('完了しました。');
    } catch {
      addLog('解析中にエラーが発生しました。');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60)
      .toString()
      .padStart(2, '0')}`;

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 min-h-screen bg-slate-50">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900">議事録AI</h1>
          <p className="text-slate-500">録音またはファイルから議事録を作成</p>
        </div>

        <button
          onClick={() => setShowHistory(v => !v)}
          className="px-4 py-2 bg-white border rounded-lg"
        >
          履歴
        </button>
      </header>

      {showHistory && (
        <div className="fixed inset-y-0 right-0 w-80 bg-white shadow-2xl z-50 p-6 overflow-y-auto">
          <div className="flex justify-between mb-4 items-center">
            <h2 className="font-bold">履歴</h2>
            <button
              onClick={() => setShowHistory(false)}
              className="px-2 py-1 rounded hover:bg-slate-100"
              aria-label="close"
            >
              ×
            </button>
          </div>

          {history.length === 0 ? (
            <div className="text-sm text-slate-500">履歴はまだありません。</div>
          ) : (
            history.map(h => (
              <div
                key={h.id}
                onClick={() => {
                  setTranscript(h.transcript);
                  setSummary(h.summary ?? null);
                  setShowHistory(false);
                }}
                className="p-3 mb-2 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100"
              >
                <div className="text-xs text-slate-400">{h.date}</div>
                <div className="text-sm font-medium truncate">{h.fileName}</div>
              </div>
            ))
          )}
        </div>
      )}

      <section className="bg-white p-6 rounded-2xl border shadow-sm mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg"
            disabled={isProcessing}
          >
            {isRecording ? `録音停止 (${formatTime(recordingTime)})` : '録音開始'}
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg"
            disabled={isProcessing}
          >
            ファイル選択
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,video/*"
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>

        {media && (
          <div className="mt-4 flex items-center gap-3">
            <span className="text-sm text-slate-700 truncate">{media.name}</span>

            <button
              disabled={isProcessing}
              onClick={startAnalysis}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg disabled:opacity-50"
            >
              解析開始
            </button>
          </div>
        )}
      </section>

      <section className="bg-slate-900 p-4 rounded-xl text-xs text-emerald-300 font-mono h-40 overflow-y-auto">
        {logs.length === 0 ? (
          <div className="text-slate-500">待機中...</div>
        ) : (
          logs.map((l, i) => <div key={i}>{l}</div>)
        )}
      </section>

      {summary && (
        <section className="mt-8 bg-white p-6 rounded-2xl border shadow-sm">
          <h2 className="text-xl font-bold mb-2">{summary.title}</h2>
          <p className="text-slate-700 mb-4">{summary.overview}</p>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-bold mb-2">決定事項</h3>
              <ul className="list-disc pl-5 text-slate-700">
                {(summary.decisions ?? []).map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="font-bold mb-2">ネクストアクション</h3>
              <ul className="list-disc pl-5 text-slate-700">
                {(summary.nextActions ?? []).map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {transcript.length > 0 && (
        <section className="mt-8 bg-white p-6 rounded-2xl border shadow-sm">
          <h3 className="font-bold mb-3">全文ログ</h3>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {transcript.map((t, i) => (
              <div key={i} className="text-sm text-slate-700">
                <span className="text-slate-400 mr-2">[{t.timestamp}]</span>
                {t.text}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default MeetingMinutesApp;
