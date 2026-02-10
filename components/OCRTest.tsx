import React, { useState } from 'react';
import { extractInvoiceDetails } from '../services/geminiService';

const OCRTest: React.FC = () => {
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const testOCR = async () => {
    setLoading(true);
    setError('');
    setResult('');

    try {
      // テスト用の小さなBase64画像（1x1ピクセルの赤い点）
      const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
      
      console.log('[OCRTest] OCRテスト開始');
      const result = await extractInvoiceDetails(testImageBase64, 'image/png');
      console.log('[OCRTest] OCR成功:', result);
      
      setResult(JSON.stringify(result, null, 2));
    } catch (err: any) {
      console.error('[OCRTest] OCRエラー:', err);
      setError(err.message || 'OCR処理中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold mb-4">OCR機能テスト</h2>
      
      <button
        onClick={testOCR}
        disabled={loading}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400"
      >
        {loading ? 'テスト中...' : 'OCRテスト実行'}
      </button>

      {error && (
        <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          <h3 className="font-bold">エラー:</h3>
          <pre>{error}</pre>
        </div>
      )}

      {result && (
        <div className="mt-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
          <h3 className="font-bold">結果:</h3>
          <pre>{result}</pre>
        </div>
      )}

      <div className="mt-4 text-sm text-gray-600">
        <p>ブラウザの開発者ツール（F12）のコンソールも確認してください。</p>
      </div>
    </div>
  );
};

export default OCRTest;
