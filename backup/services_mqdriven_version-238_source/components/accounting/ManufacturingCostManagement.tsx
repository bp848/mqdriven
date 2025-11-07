import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Job, JobStatus } from '../../types';
import StatCard from '../StatCard';
import { DollarSign, PieChart as PieChartIcon, HardHat } from '../Icons';

interface ManufacturingCostManagementProps {
    jobs: Job[];
}

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#10b981'];

const ManufacturingCostManagement: React.FC<ManufacturingCostManagementProps> = ({ jobs }) => {

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
    
    // Mock data for cost breakdown as it's not in the Job model
    const costBreakdownData = useMemo(() => {
        if (totalVariableCost === 0) return [];
        return [
            { name: '用紙代', value: totalVariableCost * 0.55 },
            { name: 'インク・版代', value: totalVariableCost * 0.20 },
            { name: '加工費', value: totalVariableCost * 0.15 },
            { name: '外注費', value: totalVariableCost * 0.05 },
            { name: 'その他', value: totalVariableCost * 0.05 },
        ];
    }, [totalVariableCost]);

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                 <StatCard title="総変動費 (V)" value={`¥${totalVariableCost.toLocaleString()}`} icon={<DollarSign className="w-6 h-6 text-orange-600 dark:text-orange-400"/>} />
                 <StatCard title="平均原価率" value={`${costRate.toFixed(1)}%`} icon={<PieChartIcon className="w-6 h-6 text-purple-600 dark:text-purple-400"/>} />
                 <StatCard title="平均変動費 / 案件" value={`¥${Math.round(averageVariableCost).toLocaleString()}`} icon={<HardHat className="w-6 h-6 text-pink-600 dark:text-pink-400"/>} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm">
                     <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-4">変動費内訳 (サンプル)</h2>
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
                                {costBreakdownData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip formatter={(value: number) => `¥${value.toLocaleString()}`} />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
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
                                        <td className="px-6 py-3 text-right font-semibold">{((job.variableCost / job.price) * 100).toFixed(1)}%</td>
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
