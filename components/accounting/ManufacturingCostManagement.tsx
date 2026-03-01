import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Job, JobStatus } from '../../types';
import StatCard from '../StatCard';
import { DollarSign, PieChart as PieChartIcon, HardHat } from '../Icons';
import { getExpenseBreakdown } from '../../services/dataService';

interface ManufacturingCostManagementProps {
    jobs: Job[];
}

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#10b981', '#06b6d4', '#f59e0b', '#ef4444'];

const ManufacturingCostManagement: React.FC<ManufacturingCostManagementProps> = ({ jobs }) => {
    const [expenseData, setExpenseData] = useState<{ accountName: string; amount: number }[]>([]);
    const [isLoadingExpense, setIsLoadingExpense] = useState(true);

    const relevantJobs = useMemo(() => {
        return jobs.filter(j => j.status === JobStatus.Completed || j.status === JobStatus.InProgress);
    }, [jobs]);

    const { totalVariableCost, averageVariableCost, costRate } = useMemo(() => {
        const totalV = relevantJobs.reduce((sum, job) => sum + job.variableCost, 0);
        const totalP = relevantJobs.reduce((sum, job) => sum + job.price, 0);
        const avgV = relevantJobs.length > 0 ? totalV / relevantJobs.length : 0;
        const rate = totalP > 0 ? (totalV / totalP) * 100 : 0;
        return {
            totalVariableCost: totalV,
            averageVariableCost: avgV,
            costRate: rate,
        };
    }, [relevantJobs]);

    // 会計データから費目別内訳を取得
    const loadExpenseBreakdown = useCallback(async () => {
        setIsLoadingExpense(true);
        try {
            const now = new Date();
            const year = now.getFullYear();
            // 当期（4月〜翌3月）の範囲を算出
            const fiscalStart = now.getMonth() >= 3
                ? `${year}-04-01`
                : `${year - 1}-04-01`;
            const fiscalEnd = now.getMonth() >= 3
                ? `${year + 1}-03-31`
                : `${year}-03-31`;
            const data = await getExpenseBreakdown({ startDate: fiscalStart, endDate: fiscalEnd });
            setExpenseData(data);
        } catch (err) {
            console.error('Failed to load expense breakdown:', err);
        } finally {
            setIsLoadingExpense(false);
        }
    }, []);

    useEffect(() => {
        loadExpenseBreakdown();
    }, [loadExpenseBreakdown]);

    const costBreakdownData = useMemo(() => {
        if (expenseData.length > 0) {
            return expenseData.map(d => ({ name: d.accountName, value: d.amount }));
        }
        // 会計データがない場合のみ案件変動費を表示
        if (totalVariableCost === 0) return [];
        return [{ name: '変動費合計（内訳なし）', value: totalVariableCost }];
    }, [expenseData, totalVariableCost]);

    const totalExpense = costBreakdownData.reduce((s, d) => s + d.value, 0);

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                 <StatCard title="総変動費 (V)" value={`¥${totalVariableCost.toLocaleString()}`} icon={<DollarSign className="w-6 h-6 text-orange-600 dark:text-orange-400"/>} />
                 <StatCard title="平均原価率" value={`${costRate.toFixed(1)}%`} icon={<PieChartIcon className="w-6 h-6 text-purple-600 dark:text-purple-400"/>} />
                 <StatCard title="平均変動費 / 案件" value={`¥${Math.round(averageVariableCost).toLocaleString()}`} icon={<HardHat className="w-6 h-6 text-pink-600 dark:text-pink-400"/>} />
                 <StatCard title="費用合計（会計）" value={`¥${totalExpense.toLocaleString()}`} icon={<DollarSign className="w-6 h-6 text-red-600 dark:text-red-400"/>} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm">
                     <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-4">
                       費目別内訳{isLoadingExpense ? '（読込中...）' : expenseData.length > 0 ? '（会計実績）' : '（データなし）'}
                     </h2>
                     {costBreakdownData.length > 0 ? (
                       <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                              <Pie
                                  data={costBreakdownData}
                                  cx="50%"
                                  cy="50%"
                                  labelLine={false}
                                  outerRadius={110}
                                  fill="#8884d8"
                                  dataKey="value"
                                  nameKey="name"
                                  label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                              >
                                  {costBreakdownData.map((_entry, index) => (
                                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                  ))}
                              </Pie>
                              <Tooltip formatter={(value: number) => `¥${value.toLocaleString()}`} />
                              <Legend />
                          </PieChart>
                      </ResponsiveContainer>
                     ) : (
                       <div className="flex items-center justify-center h-[300px] text-slate-400 text-sm">
                         この期間の費用データはありません
                       </div>
                     )}
                </div>
                 <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden">
                    <div className="p-6">
                        <h2 className="text-xl font-semibold text-slate-800 dark:text-white">案件別コスト</h2>
                    </div>
                    <div className="overflow-y-auto max-h-80">
                         <table className="w-full text-base text-left text-slate-500 dark:text-slate-400">
                            <thead className="text-sm text-slate-700 uppercase bg-slate-50 dark:bg-slate-700 dark:text-slate-300 sticky top-0">
                                <tr>
                                    <th scope="col" className="px-6 py-3">案件名</th>
                                    <th scope="col" className="px-6 py-3 text-right">売上 (P)</th>
                                    <th scope="col" className="px-6 py-3 text-right">変動費 (V)</th>
                                    <th scope="col" className="px-6 py-3 text-right">原価率</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                {relevantJobs.map(job => (
                                    <tr key={job.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/50">
                                        <td className="px-6 py-3 font-medium text-slate-800 dark:text-slate-200">{job.title}</td>
                                        <td className="px-6 py-3 text-right">¥{job.price.toLocaleString()}</td>
                                        <td className="px-6 py-3 text-right">¥{job.variableCost.toLocaleString()}</td>
                                        <td className="px-6 py-3 text-right font-semibold">{job.price > 0 ? ((job.variableCost / job.price) * 100).toFixed(1) : '0.0'}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default React.memo(ManufacturingCostManagement);
