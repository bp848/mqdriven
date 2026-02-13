import React, { useMemo, useEffect, useState } from 'react';
import { formatJPY } from '../../utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import StatCard from '../StatCard';
import { DollarSign, TrendingUp, Package, AlertTriangle, Activity } from '../Icons';
import { fetchSalesDashboardMetrics, SalesDashboardMetrics } from '../../services/dataService';

interface SalesDashboardProps {
    jobs?: any[];
    leads?: any[];
}


const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const SalesDashboard: React.FC<SalesDashboardProps> = () => {
    const [metrics, setMetrics] = useState<SalesDashboardMetrics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadMetrics = async () => {
            try {
                const data = await fetchSalesDashboardMetrics();
                setMetrics(data);
                setError(null);
            } catch (err) {
                console.error('Failed to load sales metrics:', err);
                setError('販売データの読み込みに失敗しました');
            } finally {
                setLoading(false);
            }
        };

        loadMetrics();
    }, []);

    const conversionStats = useMemo(() => {
        if (!metrics) return { converted: 0, conversionRate: 0 };
        const completed = metrics.statusBreakdown.find((s) => s.status === 'completed')?.count ?? 0;
        const total = metrics.totalOrders || 0;
        const rate = total > 0 ? (completed / total) * 100 : 0;
        return { converted: completed, conversionRate: rate };
    }, [metrics]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-500">販売データを読み込み中...</div>
            </div>
        );
    }

    if (error || !metrics) {
        return (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
                <div className="text-red-500">{error || '販売データがありません'}</div>
                <div className="text-sm text-gray-500">ORDER_V2テーブルにデータが存在するか確認してください</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="今月の売上高" value={formatJPY(metrics.thisMonthSales)} icon={<DollarSign className="w-6 h-6 text-green-600" />} />
                <StatCard title="今月の注文数" value={`${metrics.thisMonthOrders}`} icon={<Package className="w-6 h-6 text-indigo-600" />} />
                <StatCard title="今月の利益" value={formatJPY(metrics.thisMonthProfit)} icon={<TrendingUp className="w-6 h-6 text-purple-600" />} />
                <StatCard title="利益率" value={`${metrics.thisMonthMargin.toFixed(1)}%`} icon={<Activity className="w-6 h-6 text-orange-600" />} />
            </div>

            {/* Additional Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="累計売上" value={formatJPY(metrics.totalSales)} icon={<DollarSign className="w-6 h-6 text-blue-600" />} />
                <StatCard title="総注文数" value={`${metrics.totalOrders}`} icon={<Package className="w-6 h-6 text-gray-600" />} />
                <StatCard title="アクティブ注文" value={`${metrics.activeOrders}`} icon={<Activity className="w-6 h-6 text-green-600" />} />
                <StatCard title="遅延注文" value={`${metrics.overdueOrders}`} icon={<AlertTriangle className="w-6 h-6 text-red-600" />} />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Monthly Sales Trend */}
                <div className="p-6 rounded-2xl shadow-sm">
                    <h3 className="text-xl font-semibold mb-4">月別売上推移</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={metrics.monthlySalesData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.2} />
                            <XAxis dataKey="month" fontSize={12} />
                            <YAxis tickFormatter={(value) => `¥${value / 1000}k`} fontSize={12} />
                            <Tooltip formatter={(value: number, name: string) => [
                                name === 'sales' ? formatJPY(value) : formatJPY(value),
                                name === 'sales' ? '売上' : '利益'
                            ]} />
                            <Line type="monotone" dataKey="sales" stroke="#3b82f6" strokeWidth={2} name="sales" />
                            <Line type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} name="profit" />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Order Type Breakdown */}
                <div className="p-6 rounded-2xl shadow-sm">
                    <h3 className="text-xl font-semibold mb-4">注文タイプ別内訳</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={metrics.orderTypeBreakdown.map(item => ({ name: item.type, value: item.amount }))}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                outerRadius={100}
                                label
                            >
                                {metrics.orderTypeBreakdown.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip formatter={(value: number) => [formatJPY(value), '金額']} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Additional Analysis */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Customers */}
                <div className="p-6 rounded-2xl shadow-sm">
                    <h3 className="text-xl font-semibold mb-4">トップ顧客</h3>
                    <div className="space-y-2">
                        {metrics.topCustomers.slice(0, 5).map((customer, index) => (
                            <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                                <span className="font-medium">{customer.customer_name}</span>
                                <div className="text-right">
                                    <div className="text-sm font-semibold">{formatJPY(customer.sales)}</div>
                                    <div className="text-xs text-gray-500">{customer.orders}件</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Status Breakdown */}
                <div className="p-6 rounded-2xl shadow-sm">
                    <h3 className="text-xl font-semibold mb-4">ステータス別内訳</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={metrics.statusBreakdown.map(item => ({ name: item.status, 件数: item.count }))}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.2} />
                            <XAxis dataKey="name" fontSize={12} />
                            <YAxis fontSize={12} />
                            <Tooltip formatter={(value: number) => [`${value}件`, '件数']} />
                            <Bar dataKey="件数" fill="#8b5cf6" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Order Type Count & Conversion */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="p-6 rounded-2xl shadow-sm">
                    <h3 className="text-xl font-semibold mb-4">注文タイプ（件数ベース）</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={metrics.orderTypeBreakdown.map(item => ({ name: item.type, value: item.count }))}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                outerRadius={100}
                                label
                            >
                                {metrics.orderTypeBreakdown.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                            </Pie>
                            <Tooltip formatter={(value: number) => [`${value}件`, '件数']} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                <div className="p-6 rounded-2xl shadow-sm">
                    <h3 className="text-xl font-semibold mb-4">コンバージョン（完了案件）</h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-gray-600">完了件数</span>
                            <span className="text-2xl font-bold text-green-600">{conversionStats.converted}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-600">コンバージョン率</span>
                            <span className="text-2xl font-bold text-blue-600">{conversionStats.conversionRate.toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-600">総注文数</span>
                            <span className="text-2xl font-bold">{metrics.totalOrders}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SalesDashboard;
