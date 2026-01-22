import React from 'react';
import { AlertCircle, FileText } from 'lucide-react';

const OrdersAnalysisPage: React.FC = () => {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-8">
      <div className="text-center">
        <FileText className="w-16 h-16 text-cyan-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">受注テーブル分析（orders）</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">ordersテーブルの全カラム閲覧・簡易集計・CSV出力</p>
        <div className="bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-cyan-500 mr-2" />
            <span className="text-cyan-700 dark:text-cyan-300">データ準備中です。まもなく利用可能になります。</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrdersAnalysisPage;
