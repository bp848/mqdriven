import React, { useMemo } from 'react';
import { Job, JobStatus } from '../../types';
import { Trophy, DollarSign, TrendingUp, Briefcase } from '../Icons';
import StatCard from '../StatCard';
import { formatJPY } from '../../utils';

interface SalesRankingProps {
    jobs: Job[];
}

interface CustomerSalesData {
    clientName: string;
    jobCount: number;
    totalSales: number;
    totalMargin: number;
}

const SalesRanking: React.FC<SalesRankingProps> = ({ jobs }) => {
    const customerData = useMemo(() => {
        const data = jobs.reduce((acc: Record<string, CustomerSalesData>, job) => {
            if (job.status !== JobStatus.Cancelled) {
                if (!acc[job.clientName]) {
                    acc[job.clientName] = { clientName: job.clientName, jobCount: 0, totalSales: 0, totalMargin: 0 };
                }
                acc[job.clientName].jobCount += 1;
                acc[job.clientName].totalSales += job.price;
                acc[job.clientName].totalMargin += (job.price - job.variableCost);
            }
            return acc;
        }, {});

        return Object.values(data).sort((a: CustomerSalesData, b: CustomerSalesData) => b.totalSales - a.totalSales);
    }, [jobs]);

    const { totalRankedSales, totalRankedMargin } = useMemo(() => {
        return customerData.reduce(
            (acc, customer) => {
                acc.totalRankedSales += customer.totalSales;
                acc.totalRankedMargin += customer.totalMargin;
                return acc;
            },
            { totalRankedSales: 0, totalRankedMargin: 0 }
        );
    }, [customerData]);

    const getRankIcon = (index: number) => {
        const rank = index + 1;
        if (rank === 1) return <Trophy className="w-6 h-6 text-yellow-400" />;
        if (rank === 2) return <Trophy className="w-6 h-6 text-slate-400" />;
        if (rank === 3) return <Trophy className="w-6 h-6 text-yellow-600" />; // Bronze
        return <span className="font-semibold text-slate-500 text-lg">{rank}</span>;
    };

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <StatCard title="総売上高 (P)" value={formatJPY(totalRankedSales)} icon={<DollarSign className="w-6 h-6 text-green-600 dark:text-green-400"/>} />
                <StatCard title="総限界利益 (M)" value={formatJPY(totalRankedMargin)} icon={<TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400"/>} />
                <StatCard title="対象クライアント数" value={customerData.length.toString()} icon={<Briefcase className="w-6 h-6 text-indigo-600 dark:text-indigo-400"/>} />
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-6">
                    <h2 className="text-xl font-semibold text-slate-800 dark:text-white">顧客別 売上ランキング (累計)</h2>
                    <p className="mt-1 text-base text-slate-500 dark:text-slate-400">
                        キャンセルを除く全ての案件を集計しています。
                    </p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-base text-left text-slate-500 dark:text-slate-400">
                        <thead className="text-sm text-slate-700 uppercase bg-slate-50 dark:bg-slate-700 dark:text-slate-300">
                            <tr>
                                <th scope="col" className="px-6 py-3 w-16 text-center">順位</th>
                                <th scope="col" className="px-6 py-3">クライアント名</th>
                                <th scope="col" className="px-6 py-3 text-right">案件数</th>
                                <th scope="col" className="px-6 py-3 text-right">売上高 (P)</th>
                                <th scope="col" className="px-6 py-3 text-right">限界利益 (M)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {customerData.map((customer, index) => (
                                <tr key={customer.clientName} className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600">
                                    <td className="px-6 py-4 text-center">
                                        <div className="w-8 h-8 flex items-center justify-center mx-auto">{getRankIcon(index)}</div>
                                    </td>
                                    <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">{customer.clientName}</td>
                                    <td className="px-6 py-4 text-right">{customer.jobCount}</td>
                                    <td className="px-6 py-4 text-right font-semibold">¥{customer.totalSales.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-right font-semibold text-blue-600 dark:text-blue-400">¥{customer.totalMargin.toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default SalesRanking;