import React, { useRef, useState } from 'react';
import { transcribeAudio } from '../services/geminiService.ts';
import { Loader, Upload, FileAudio, Trash2 } from './Icons.tsx';
import { Toast } from '../types.ts';

interface AITranscriptionPageProps {
  addToast: (message: string, type: Toast['type']) => void;
  isAIOff: boolean;
}

const AITranscriptionPage: React.FC<AITranscriptionPageProps> = ({ addToast, isAIOff }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [result, setResult] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  const readFileAsBase64 = (f: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(',')[1] || '';
        resolve(base64);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(f);
    });
  };

  const handleChoose = () => inputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setResult('');
    setError('');
  };

  const handleClear = () => {
    setFile(null);
    setResult('');
    setError('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleTranscribe = async () => {
    if (!file) return;
    if (isAIOff) {
      addToast('AI機能が無効です。環境変数で有効化してください。', 'info');
      return;
    }
    try {
      setIsLoading(true);
      setError('');
      const base64 = await readFileAsBase64(file);
      const text = await transcribeAudio(base64, file.type || 'audio/mpeg');
      setResult(text);
      addToast('文字起こしが完了しました。', 'success');
    } catch (e: any) {
      const msg = e?.message || '文字起こしに失敗しました。';
      setError(msg);
      addToast(msg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">AI文字起こし（Gemini 2.5 Pro）</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">音声ファイル（mp3, m4a, wav など）をアップロードして日本語に文字起こしします。</p>
      </div>

      <div className="flex items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <button onClick={handleChoose} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
          <Upload className="w-5 h-5" /> 音声を選択
        </button>
        {file && (
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
            <FileAudio className="w-5 h-5" />
            <span className="truncate max-w-[320px]" title={file.name}>{file.name}</span>
            <button onClick={handleClear} className="p-2 text-slate-500 hover:text-red-600"><Trash2 className="w-5 h-5"/></button>
          </div>
        )}
        <button
          onClick={handleTranscribe}
          disabled={!file || isLoading}
          className="ml-auto bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isLoading ? (<><Loader className="w-5 h-5 animate-spin" /> 解析中...</>) : '文字起こし'}
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-red-50 text-red-700 text-sm">{error}</div>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">結果</label>
        <textarea
          value={result}
          onChange={(e) => setResult(e.target.value)}
          placeholder="ここに文字起こしの結果が表示されます"
          rows={14}
          className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg p-3 text-sm text-slate-900 dark:text-white"
        />
      </div>
    </div>
  );
};

export default AITranscriptionPage;
