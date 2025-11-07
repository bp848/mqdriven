import React from 'react';
import { AlertTriangle, CheckCircle, Lightbulb, X } from './Icons';
import { ValidationError } from '../utils/friendlyValidation';

interface FriendlyErrorDisplayProps {
  errors: ValidationError[];
  onClose?: () => void;
}

const FriendlyErrorDisplay: React.FC<FriendlyErrorDisplayProps> = ({ errors, onClose }) => {
  if (errors.length === 0) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* ヘッダー */}
        <div className="bg-gradient-to-r from-red-600 to-orange-600 text-white p-6 rounded-t-2xl sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
                <AlertTriangle className="w-7 h-7 text-red-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">入力内容を確認してください</h2>
                <p className="text-sm text-red-100 mt-1">
                  {errors.length}個の項目を修正する必要があります
                </p>
              </div>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            )}
          </div>
        </div>

        {/* エラーリスト */}
        <div className="p-6 space-y-6">
          {errors.map((error, index) => (
            <div
              key={index}
              className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border-2 border-red-300 dark:border-red-700 rounded-xl p-5"
            >
              {/* 問題番号 */}
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                  {index + 1}
                </div>
                <h3 className="text-lg font-bold text-red-900 dark:text-red-100">
                  問題 {index + 1}
                </h3>
              </div>

              {/* エラーメッセージ */}
              <div className="mb-4 p-4 bg-white dark:bg-slate-800 rounded-lg border border-red-200 dark:border-red-800">
                <p className="text-base font-semibold text-red-800 dark:text-red-200">
                  {error.message}
                </p>
              </div>

              {/* 解決方法 */}
              <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-start gap-2 mb-2">
                  <Lightbulb className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <h4 className="font-bold text-blue-900 dark:text-blue-100">
                    解決方法
                  </h4>
                </div>
                <p className="text-sm text-blue-800 dark:text-blue-200 whitespace-pre-wrap leading-relaxed ml-7">
                  {error.solution}
                </p>
              </div>

              {/* 入力例 */}
              {error.example && (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-start gap-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <h4 className="font-bold text-green-900 dark:text-green-100">
                      入力例
                    </h4>
                  </div>
                  <div className="ml-7">
                    <code className="text-sm font-mono bg-white dark:bg-slate-800 px-3 py-2 rounded border border-green-300 dark:border-green-700 text-green-800 dark:text-green-200 inline-block">
                      {error.example}
                    </code>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* フッター */}
        <div className="p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-b-2xl">
          <div className="space-y-4">
            {/* 次のステップ */}
            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
              <h4 className="font-bold text-purple-900 dark:text-purple-100 mb-2 flex items-center gap-2">
                <span className="text-xl">📌</span>
                次にすること
              </h4>
              <ol className="list-decimal list-inside space-y-2 text-sm text-purple-800 dark:text-purple-200">
                <li>上記の問題を1つずつ修正してください</li>
                <li>全て修正したら、もう一度送信ボタンを押してください</li>
                <li>わからないことがあれば、右下のチャットで質問してください</li>
              </ol>
            </div>

            {/* 閉じるボタン */}
            {onClose && (
              <button
                onClick={onClose}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-4 px-6 rounded-xl transition-colors text-lg"
              >
                わかりました、修正します
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FriendlyErrorDisplay;
