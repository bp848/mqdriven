import React from 'react';
import { AlertCircle, BarChart3 } from 'lucide-react';

const SalesAnalysisPage: React.FC = () => {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-8">
      <div className="text-center">
        <BarChart3 className="w-16 h-16 text-blue-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">販売分析</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">売上データ、受注状況、顧客分析など販売関連の総合分析</p>
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-blue-500 mr-2" />
            <span className="text-blue-700 dark:text-blue-300">データ準備中です。まもなく利用可能になります。</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesAnalysisPage;
