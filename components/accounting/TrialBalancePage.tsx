
import React, { useMemo } from 'react';
import { JournalEntry } from '../../types';

interface TrialBalancePageProps {
  journalEntries: JournalEntry[];
}

const TrialBalancePage: React.FC<TrialBalancePageProps> = ({ journalEntries }) => {
  const trialBalanceData = useMemo(() => {
    const balances: Record<string, { debit: number; credit: number }> = {};
    
    journalEntries.forEach(entry => {
      if (!balances[entry.account]) {
        balances[entry.account] = { debit: 0, credit: 0 };
      }
      balances[entry.account].debit += entry.debit;
      balances[entry.account].credit += entry.credit;
    });

    return Object.entries(balances)
      .map(([account, { debit, credit }]) => ({
        account,
        debit,
        credit,
        balance: debit - credit,
      }))
      .sort((a, b) => a.account.localeCompare(b.account));
  }, [journalEntries]);

  const totals = useMemo(() => {
    return trialBalanceData.reduce(
      (acc, item) => {
        acc.debit += item.debit;
        acc.credit += item.credit;
        return acc;
      },
      { debit: 0, credit: 0 }
    );
  }, [trialBalanceData]);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden">
      <div className="p-6">
        <h2 className="text-xl font-semibold text-slate-800 dark:text-white">試算表</h2>
        <p className="mt-1 text-base text-slate-500 dark:text-slate-400">
          指定された期間の勘定科目ごとの借方・貸方合計と残高を表示します。
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-base text-left text-slate-500 dark:text-slate-400">
          <thead className="text-sm text-slate-700 uppercase bg-slate-50 dark:bg-slate-700 dark:text-slate-300">
            <tr>
              <th scope="col" className="px-6 py-3">勘定科目</th>
              <th scope="col" className="px-6 py-3 text-right">借方合計</th>
              <th scope="col" className="px-6 py-3 text-right">貸方合計</th>
              <th scope="col" className="px-6 py-3 text-right">残高</th>
            </tr>
          </thead>
          <tbody>
            {trialBalanceData.map(({ account, debit, credit, balance }) => (
              <tr key={account} className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600">
                <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">{account}</td>
                <td className="px-6 py-4 text-right">¥{debit.toLocaleString()}</td>
                <td className="px-6 py-4 text-right">¥{credit.toLocaleString()}</td>
                <td className="px-6 py-4 text-right font-semibold">¥{balance.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="font-bold bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
            <tr>
              <td className="px-6 py-4">合計</td>
              <td className="px-6 py-4 text-right">¥{totals.debit.toLocaleString()}</td>
              <td className="px-6 py-4 text-right">¥{totals.credit.toLocaleString()}</td>
              <td className="px-6 py-4 text-right">
                {totals.debit === totals.credit ? '¥0' : <span className="text-red-500">不一致</span>}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export default TrialBalancePage;
