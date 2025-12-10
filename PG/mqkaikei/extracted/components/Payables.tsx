import React from 'react';

interface PayablesProps {
  notify?: (message: string, type: 'success' | 'info' | 'error') => void;
}

const demoPayables = [
  { id: 'pay-001', supplier: 'コモリ紙工', amount: 320000, due: '2024-12-15', status: 'pending' },
  { id: 'pay-002', supplier: 'XXインキ', amount: 185000, due: '2024-12-18', status: 'scheduled' },
];

export const Payables: React.FC<PayablesProps> = ({ notify }) => {
  const formatJPY = (value: number) => `¥${value.toLocaleString()}`;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
      <div className="px-6 py-4 border-b border-slate-100">
        <h2 className="text-lg font-semibold text-slate-800">買掛管理（デモ）</h2>
        <p className="text-sm text-slate-500 mt-1">PG/mqkaikei の参考 UI コンポーネントです。</p>
      </div>
      <table className="w-full text-left text-sm text-slate-600">
        <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
          <tr>
            <th className="px-6 py-3">支払先</th>
            <th className="px-6 py-3 text-right">金額</th>
            <th className="px-6 py-3">支払期日</th>
            <th className="px-6 py-3">ステータス</th>
            <th className="px-6 py-3 text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          {demoPayables.map(payable => (
            <tr key={payable.id} className="border-t border-slate-100">
              <td className="px-6 py-3 font-medium text-slate-800">{payable.supplier}</td>
              <td className="px-6 py-3 text-right tabular-nums">{formatJPY(payable.amount)}</td>
              <td className="px-6 py-3">{payable.due}</td>
              <td className="px-6 py-3">
                <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700">
                  {payable.status === 'pending' ? '承認待ち' : '支払予定'}
                </span>
              </td>
              <td className="px-6 py-3 text-right">
                <button
                  onClick={() => notify?.(`${payable.supplier} を確認しました`, 'info')}
                  className="text-blue-600 hover:underline text-sm font-semibold"
                >
                  詳細
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Payables;
