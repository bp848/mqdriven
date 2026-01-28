
import React from 'react';
import { QuoteResultData } from '../types';

interface QuoteResultProps {
  data: QuoteResultData;
}

const QuoteResult: React.FC<QuoteResultProps> = ({ data }) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(amount);
  };

  // Corrected: mq represents the profit amount in the QuoteResultData interface
  const profit = data.mq;

  return (
    <div className="bg-white/80 backdrop-blur-sm p-6 md:p-8 rounded-2xl shadow-lg border border-gray-200 animate-fade-in">
      <h2 className="text-2xl font-bold mb-2 text-slate-900">見積もり結果</h2>
      
      <div className="text-center bg-blue-50 border border-blue-200 rounded-lg p-6 my-6">
        <p className="text-lg text-blue-800">顧客への提示価格 (税込)</p>
        <p className="text-4xl md:text-5xl font-extrabold text-blue-600 my-2 tracking-tight">
          {/* pq is the tax-exclusive preliminary quote, calculated here with 10% tax (1.1 multiplier) */}
          {formatCurrency(data.pq * 1.1)}
        </p>
      </div>

      <div className="space-y-6">
        <div>
            <h3 className="text-lg font-semibold mb-3 text-slate-800 border-b pb-2">コスト分析</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-center">
                <div className="bg-slate-100 p-3 rounded-md">
                    <div className="text-sm text-slate-600">内部原価</div>
                    {/* vq corresponds to the internal cost in QuoteResultData */}
                    <div className="text-lg font-bold text-slate-800">{formatCurrency(data.vq)}</div>
                </div>
                <div className="bg-slate-100 p-3 rounded-md">
                    <div className="text-sm text-slate-600">利益額</div>
                    <div className="text-lg font-bold text-green-700">{formatCurrency(profit)}</div>
                </div>
                <div className="bg-slate-100 p-3 rounded-md col-span-2 sm:col-span-1">
                    <div className="text-sm text-slate-600">利益率</div>
                    <div className="text-lg font-bold text-slate-800">{data.profitMargin}%</div>
                </div>
            </div>
        </div>
      
        <div>
          <h3 className="text-lg font-semibold mb-3 text-slate-800 border-b pb-2">原価の内訳</h3>
          <ul className="space-y-2 text-sm">
            {data.costBreakdown.map((item, index) => (
              <li key={index} className="flex justify-between items-center bg-slate-50 p-3 rounded-md">
                <span className="text-slate-600">{item.item}</span>
                <span className="font-medium text-slate-800">{formatCurrency(item.cost)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
           <h3 className="text-lg font-semibold mb-3 text-slate-800 border-b pb-2">社内向けメモ</h3>
           <p className="text-sm text-slate-600 bg-slate-50 p-4 rounded-md whitespace-pre-wrap">
             {data.internalNotes}
           </p>
        </div>

        <div>
            <h3 className="text-lg font-semibold mb-3 text-slate-800 border-b pb-2">おおよその製造期間</h3>
            <p className="text-center text-2xl font-bold text-slate-700 bg-slate-50 p-4 rounded-md">
              {data.estimatedProductionDays} 営業日
            </p>
        </div>
      </div>
    </div>
  );
};

export default QuoteResult;
