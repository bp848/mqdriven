import React, { useMemo, useState } from 'react';
import { Estimate, Customer, EstimateStatus } from '../../types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Users, Target, AlertTriangle } from '../Icons';
import { formatJPY } from '../../utils';

interface CustomerMQAnalysisProps {
  estimates: Estimate[];
  customers: Customer[];
}

interface CustomerAnalysis {
  customerName: string;
  customerId: string;
  totalEstimates: number;
  totalSales: number;
  totalCost: number;
  totalMq: number;
  avgMqRate: number;
  orderedCount: number;
  orderedAmount: number;
  orderedRate: number;
  estimates: Estimate[];
}

const CustomerMQAnalysis: React.FC<CustomerMQAnalysisProps> = ({ estimates, customers }) => {
  const [sortBy, setSortBy] = useState<'sales' | 'mq' | 'mq_rate' | 'ordered_rate'>('sales');
  const [showTop, setShowTop] = useState<10 | 20 | 50>(10);

  const customerAnalysis = useMemo(() => {
    const customerMap = new Map<string, CustomerAnalysis>();

    estimates.forEach(estimate => {
      const customerName = estimate.customerName || '未設定顧客';
      const customerId = estimate.projectId || 'unknown';

      if (!customerMap.has(customerId)) {
        customerMap.set(customerId, {
          customerName,
          customerId,
          totalEstimates: 0,
          totalSales: 0,
          totalCost: 0,
          totalMq: 0,
          avgMqRate: 0,
          orderedCount: 0,
          orderedAmount: 0,
          orderedRate: 0,
          estimates: [],
        });
      }

      const analysis = customerMap.get(customerId)!;
      const salesAmount = estimate.total || estimate.subtotal || 0;
      const costAmount = estimate.variableCostAmount || 0;
      const mqAmount = salesAmount - costAmount;
      const mqRate = salesAmount > 0 ? (mqAmount / salesAmount) * 100 : 0;

      analysis.totalEstimates += 1;
      analysis.totalSales += salesAmount;
      analysis.totalCost += costAmount;
      analysis.totalMq += mqAmount;
      analysis.estimates.push(estimate);

      if (estimate.status === EstimateStatus.Ordered) {
        analysis.orderedCount += 1;
        analysis.orderedAmount += salesAmount;
      }
    });

    // 平均MQ率を計算
    customerMap.forEach(analysis => {
      const validEstimates = analysis.estimates.filter(e => {
        const sales = Number(e.total || e.subtotal || 0);
        const cost = Number(e.variableCostAmount || 0);
        return sales > 0;
      });
      
      if (validEstimates.length > 0) {
        const totalMq = validEstimates.reduce((sum, e) => {
          const sales = Number(e.total || e.subtotal || 0);
          const cost = Number(e.variableCostAmount || 0);
          return sum + (sales - cost);
        }, 0);
        const totalSales = validEstimates.reduce((sum, e) => sum + Number(e.total || e.subtotal || 0), 0);
        analysis.avgMqRate = totalSales > 0 ? (totalMq / totalSales) * 100 : 0;
      }

      analysis.orderedRate = analysis.totalEstimates > 0 ? (analysis.orderedCount / analysis.totalEstimates) * 100 : 0;
    });

    return Array.from(customerMap.values());
  }, [estimates]);

  const sortedCustomers = useMemo(() => {
    return [...customerAnalysis].sort((a, b) => {
      switch (sortBy) {
        case 'sales':
          return b.totalSales - a.totalSales;
        case 'mq':
          return b.totalMq - a.totalMq;
        case 'mq_rate':
          return b.avgMqRate - a.avgMqRate;
        case 'ordered_rate':
          return b.orderedRate - a.orderedRate;
        default:
          return 0;
      }
    }).slice(0, showTop);
  }, [customerAnalysis, sortBy, showTop]);

  const totalStats = useMemo(() => {
    return customerAnalysis.reduce(
      (acc, customer) => ({
        totalCustomers: acc.totalCustomers + 1,
        totalEstimates: acc.totalEstimates + customer.totalEstimates,
        totalSales: acc.totalSales + customer.totalSales,
        totalCost: acc.totalCost + customer.totalCost,
        totalMq: acc.totalMq + customer.totalMq,
        totalOrdered: acc.totalOrdered + customer.orderedCount,
      }),
      { totalCustomers: 0, totalEstimates: 0, totalSales: 0, totalCost: 0, totalMq: 0, totalOrdered: 0 }
    );
  }, [customerAnalysis]);

  const chartColors = ['#2563eb', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#10b981', '#f97316'];

  const pieData = useMemo(() => {
    return sortedCustomers.slice(0, 8).map((customer, index) => ({
      name: customer.customerName,
      value: customer.totalSales,
      percentage: totalStats.totalSales > 0 ? (customer.totalSales / totalStats.totalSales) * 100 : 0,
      color: chartColors[index % chartColors.length],
    }));
  }, [sortedCustomers, totalStats.totalSales]);

  const mqRateDistribution = useMemo(() => {
    const ranges = [
      { label: '0%以下', min: -Infinity, max: 0, count: 0 },
      { label: '0-10%', min: 0, max: 10, count: 0 },
      { label: '10-20%', min: 10, max: 20, count: 0 },
      { label: '20-30%', min: 20, max: 30, count: 0 },
      { label: '30-40%', min: 30, max: 40, count: 0 },
      { label: '40%以上', min: 40, max: Infinity, count: 0 },
    ];

    customerAnalysis.forEach(customer => {
      const rate = customer.avgMqRate;
      const range = ranges.find(r => rate >= r.min && rate < r.max);
      if (range) range.count++;
    });

    return ranges.map(r => ({
      name: r.label,
      value: r.count,
      percentage: (r.count / customerAnalysis.length) * 100,
    }));
  }, [customerAnalysis]);

  return (
    <div className="space-y-6">
      {/* 総合統計 */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
            <Users className="w-4 h-4" />
            <span className="text-sm">顧客数</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{totalStats.totalCustomers}</p>
        </div>
        
        <div className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
            <Target className="w-4 h-4" />
            <span className="text-sm">総見積件数</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{totalStats.totalEstimates}</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
            <DollarSign className="w-4 h-4" />
            <span className="text-sm">総売上</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatJPY(totalStats.totalSales)}</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm">総原価</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatJPY(totalStats.totalCost)}</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm">総MQ</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatJPY(totalStats.totalMq)}</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
            <Target className="w-4 h-4" />
            <span className="text-sm">受注率</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {totalStats.totalEstimates > 0 ? ((totalStats.totalOrdered / totalStats.totalEstimates) * 100).toFixed(1) : 0}%
          </p>
        </div>
      </div>

      {/* コントロール */}
      <div className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">表示件数</label>
              <select
                value={showTop}
                onChange={(e) => setShowTop(Number(e.target.value) as 10 | 20 | 50)}
                className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={10}>上位10件</option>
                <option value={20}>上位20件</option>
                <option value={50}>上位50件</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">ソート順</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="sales">売上順</option>
                <option value="mq">MQ順</option>
                <option value="mq_rate">MQ率順</option>
                <option value="ordered_rate">受注率順</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* チャート */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 売上構成パイチャート */}
        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-sm border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">顧客別売上構成</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => percent > 0.05 ? `${name}: ${(percent * 100).toFixed(1)}%` : ''}
                outerRadius={80}
                fill="#888888"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => formatJPY(value)} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* MQ率分布 */}
        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-sm border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">MQ率分布</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={mqRateDistribution}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value: number) => `${value}顧客`} />
              <Bar dataKey="value" fill="#2563eb" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 顧客別詳細テーブル */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            顧客別MQ分析（{showTop}件）
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-600 dark:text-slate-300">
              <thead className="text-xs uppercase bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-200">
                <tr>
                  <th className="px-4 py-3 font-medium">顧客名</th>
                  <th className="px-4 py-3 font-medium text-right">見積件数</th>
                  <th className="px-4 py-3 font-medium text-right">売上高</th>
                  <th className="px-4 py-3 font-medium text-right">原価</th>
                  <th className="px-4 py-3 font-medium text-right">MQ</th>
                  <th className="px-4 py-3 font-medium text-right">MQ率</th>
                  <th className="px-4 py-3 font-medium text-right">受注件数</th>
                  <th className="px-4 py-3 font-medium text-right">受注率</th>
                </tr>
              </thead>
              <tbody>
                {sortedCustomers.map((customer, index) => (
                  <tr key={customer.customerId} className="border-b border-slate-200 dark:border-slate-700">
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                      {customer.customerName}
                    </td>
                    <td className="px-4 py-3 text-right">{customer.totalEstimates}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatJPY(customer.totalSales)}</td>
                    <td className="px-4 py-3 text-right">{formatJPY(customer.totalCost)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-blue-600">
                      {formatJPY(customer.totalMq)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-semibold ${
                        customer.avgMqRate >= 40 ? 'text-green-600' :
                        customer.avgMqRate >= 20 ? 'text-yellow-600' :
                        customer.avgMqRate >= 0 ? 'text-orange-600' : 'text-red-600'
                      }`}>
                        {customer.avgMqRate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">{customer.orderedCount}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-semibold ${
                        customer.orderedRate >= 50 ? 'text-green-600' :
                        customer.orderedRate >= 30 ? 'text-yellow-600' : 'text-orange-600'
                      }`}>
                        {customer.orderedRate.toFixed(1)}%
                      </span>
                    </td>
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

export default CustomerMQAnalysis;
