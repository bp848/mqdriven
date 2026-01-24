import React, { useEffect, useState, useMemo } from 'react';
import { CustomerBudgetSummary } from '../../types';
import { getCustomerBudgetSummaries } from '../../services/dataService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Users, DollarSign, Target } from '../Icons';

const CustomerBudgetVisualizationPage: React.FC = () => {
    const [customerBudgets, setCustomerBudgets] = useState<CustomerBudgetSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedCustomer, setSelectedCustomer] = useState<CustomerBudgetSummary | null>(null);

    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                setError(null);
                const data = await getCustomerBudgetSummaries();
                setCustomerBudgets(data);
                if (data.length > 0) {
                    setSelectedCustomer(data[0]); // 最初の顧客を選択
                }
            } catch (err) {
                setError(err.message);
                console.error('Failed to load customer budgets:', err);
            } finally {
                setLoading(false);
            }
        };
        
        loadData();
    }, []);

    // 集計データの計算
    const summaryData = useMemo(() => {
        const totalBudget = customerBudgets.reduce((sum, customer) => sum + customer.totalBudget, 0);
        const totalActual = customerBudgets.reduce((sum, customer) => sum + customer.totalActual, 0);
        const totalCost = customerBudgets.reduce((sum, customer) => sum + customer.totalCost, 0);
        const avgProfitMargin = customerBudgets.length > 0 ? 
            customerBudgets.reduce((sum, customer) => sum + customer.profitMargin, 0) / customerBudgets.length : 0;
        const avgAchievementRate = customerBudgets.length > 0 ? 
            customerBudgets.reduce((sum, customer) => sum + customer.achievementRate, 0) / customerBudgets.length : 0;

        return {
            totalBudget,
            totalActual,
            totalCost,
            avgProfitMargin,
            avgAchievementRate,
            customerCount: customerBudgets.length,
            totalProfit: totalBudget - totalCost
        };
    }, [customerBudgets]);

    // チャートデータの準備
    const chartData = useMemo(() => {
        return customerBudgets.slice(0, 10).map(customer => ({
            name: customer.customerName.length > 15 ? customer.customerName.substring(0, 12) + '...' : customer.customerName,
            予算: customer.totalBudget,
            実績: customer.totalActual,
            原価: customer.totalCost,
            利益: customer.totalBudget - customer.totalCost,
            利益率: customer.profitMargin,
            達成率: customer.achievementRate
        }));
    }, [customerBudgets]);

    const pieData = useMemo(() => {
        return customerBudgets.slice(0, 8).map((customer, index) => ({
            name: customer.customerName,
            value: customer.totalBudget,
            fill: ['#2563eb', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#10b981', '#f97316', '#6366f1'][index % 8]
        }));
    }, [customerBudgets]);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('ja-JP', {
            style: 'currency',
            currency: 'JPY'
        }).format(value);
    };

    const getProfitMarginColor = (margin: number) => {
        if (margin >= 20) return 'text-green-600 dark:text-green-400';
        if (margin >= 10) return 'text-yellow-600 dark:text-yellow-400';
        return 'text-red-600 dark:text-red-400';
    };

    const getAchievementRateColor = (rate: number) => {
        if (rate >= 100) return 'text-green-600 dark:text-green-400';
        if (rate >= 80) return 'text-yellow-600 dark:text-yellow-400';
        return 'text-red-600 dark:text-red-400';
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                    <p className="mt-4 text-slate-600 dark:text-slate-400">顧客別予算データを読み込み中...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center bg-red-50 dark:bg-red-900/20 p-8 rounded-lg">
                    <div className="text-red-600 dark:text-red-400 mb-2">⚠️ エラーが発生しました</div>
                    <p className="text-slate-700 dark:text-slate-300">{error}</p>
                    <button 
                        onClick={() => window.location.reload()}
                        className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                        再読み込み
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
            <div className="max-w-7xl mx-auto px-4 py-8">
                {/* ヘッダー */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
                        顧客別予算ダッシュボード
                    </h1>
                    <p className="text-slate-600 dark:text-slate-400">
                        顧客ごとの予算・実績・利益率を可視化
                    </p>
                </div>

                {/* サマリーカード */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                    <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-sm border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">総予算</h3>
                            <DollarSign className="w-5 h-5 text-blue-500" />
                        </div>
                        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                            {formatCurrency(summaryData.totalBudget)}
                        </p>
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-sm border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">総実績</h3>
                            <TrendingUp className="w-5 h-5 text-green-500" />
                        </div>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                            {formatCurrency(summaryData.totalActual)}
                        </p>
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-sm border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">総利益</h3>
                            <div className="w-5 h-5 text-purple-500">💰</div>
                        </div>
                        <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                            {formatCurrency(summaryData.totalProfit)}
                        </p>
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-sm border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">平均利益率</h3>
                            <Target className="w-5 h-5 text-orange-500" />
                        </div>
                        <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                            {summaryData.avgProfitMargin.toFixed(1)}%
                        </p>
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-sm border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">平均達成率</h3>
                            <div className="w-5 h-5 text-teal-500">📊</div>
                        </div>
                        <p className="text-2xl font-bold text-teal-600 dark:text-teal-400">
                            {summaryData.avgAchievementRate.toFixed(1)}%
                        </p>
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-sm border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">顧客数</h3>
                            <Users className="w-5 h-5 text-indigo-500" />
                        </div>
                        <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                            {summaryData.customerCount}
                        </p>
                    </div>
                </div>

                {/* メインコンテンツ */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* 左側: 顧客リスト */}
                    <div className="lg:col-span-2">
                        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                            <div className="p-6">
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
                                    顧客一覧 ({customerBudgets.length}件)
                                </h2>
                                
                                <div className="space-y-2 max-h-96 overflow-y-auto">
                                    {customerBudgets.map((customer, index) => (
                                        <div
                                            key={customer.customerId}
                                            onClick={() => setSelectedCustomer(customer)}
                                            className={`p-4 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                                                selectedCustomer?.customerId === customer.customerId
                                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <h3 className="font-semibold text-slate-900 dark:text-white">
                                                        {customer.customerName}
                                                    </h3>
                                                    <p className="text-sm text-slate-600 dark:text-slate-400">
                                                        {customer.projectCount}件のプロジェクト
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                                                        {formatCurrency(customer.totalBudget)}
                                                    </p>
                                                </div>
                                            </div>
                                            
                                            {/* 選択中の顧客詳細を表示 */}
                                            {selectedCustomer?.customerId === customer.customerId && (
                                                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                                        <div>
                                                            <span className="text-slate-600 dark:text-slate-400">実績率:</span>
                                                            <span className={`font-medium ${getAchievementRateColor(customer.achievementRate)}`}>
                                                                {customer.achievementRate.toFixed(1)}%
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="text-slate-600 dark:text-slate-400">利益率:</span>
                                                            <span className={`font-medium ${getProfitMarginColor(customer.profitMargin)}`}>
                                                                {customer.profitMargin.toFixed(1)}%
                                                            </span>
                                                        </div>
                                                    </div>
                                                    
                                                    {/* プロジェクト一覧 */}
                                                    <div className="mt-3">
                                                        <h4 className="font-medium text-slate-700 dark:text-slate-300 mb-2">プロジェクト一覧</h4>
                                                        <div className="space-y-1">
                                                            {customer.projects.slice(0, 3).map(project => (
                                                                <div key={project.id} className="flex items-center justify-between text-xs bg-slate-50 dark:bg-slate-900/50 p-2 rounded">
                                                                    <span>{project.projectCode}: {project.projectName}</span>
                                                                    <span>{formatCurrency(project.budget)}</span>
                                                                </div>
                                                            ))}
                                                            {customer.projects.length > 3 && (
                                                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                                                    他 {customer.projects.length - 3}件...
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 中央: バーチャート */}
                    <div className="space-y-8">
                        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                            <div className="p-6">
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
                                    予算 vs 実績比較
                                </h2>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis 
                                            dataKey="name" 
                                            tick={{ fontSize: 12 }}
                                            angle={-45}
                                            textAnchor="end"
                                            height={80}
                                        />
                                        <YAxis 
                                            tickFormatter={(value) => `¥${(value / 10000).toFixed(0)}万`}
                                        />
                                        <Tooltip 
                                            formatter={(value, name) => {
                                                if (name === '予算' || name === '実績' || name === '原価') {
                                                    return [`${name}: ${formatCurrency(Number(value))}`];
                                                }
                                                return [`${name}: ${value}%`];
                                            }}
                                        />
                                        <Bar dataKey="予算" fill="#2563eb" />
                                        <Bar dataKey="実績" fill="#22c55e" />
                                        <Bar dataKey="原価" fill="#ef4444" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                            <div className="p-6">
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
                                    予算構成比
                                </h2>
                                <ResponsiveContainer width="100%" height={300}>
                                    <PieChart>
                                        <Pie
                                            data={pieData}
                                            cx="50%"
                                            cy="50%"
                                            outerRadius={80}
                                            fill="#8884d8"
                                            dataKey="value"
                                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                        >
                                            {pieData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.fill} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CustomerBudgetVisualizationPage;
