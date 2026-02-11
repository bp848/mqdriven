import React, { useState, useEffect } from 'react';
import { formatJPY } from '../../utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { ArrowLeft, TrendingUp, TrendingDown, DollarSign, FileText } from '../Icons';
import { createSupabaseBrowser } from '../../lib/supabase';

interface CustomerData {
    customer_name: string;
    見積もり金額: number;
    受注金額_兼_売上金額: number;
    受注金額_見積もり差異額: number;
}

interface MonthlyData {
    顧客名: string;
    年月: string;
    見積もり金額: number;
    受注金額_兼_売上金額: number;
    受注金額_見積もり差異額: number;
    注文数: number;
}

interface CustomerDetailPageProps {
    customerName?: string;
    onBack: () => void;
}

const CustomerDetailPage: React.FC<CustomerDetailPageProps> = ({ customerName, onBack }) => {
    const [customerData, setCustomerData] = useState<CustomerData[]>([]);
    const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<string>(customerName || '');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadCustomerData = async () => {
            try {
                const supabase = createSupabaseBrowser();

                // 顧客別集計データ
                const { data: customerSummary, error: customerError } = await supabase
                    .from('orders_v2')
                    .select(`
                        customer_name,
                        estimate_pq,
                        estimate_vq,
                        estimate_mq,
                        final_pq,
                        final_vq,
                        final_mq
                    `)
                    .eq('order_type', 'sales')
                    .not('order_date', 'is', null)
                    .gte('order_date', '2025-04-01')
                    .lt('order_date', '2026-04-01');

                if (customerError) throw customerError;

                // 顧客別データ集計
                const customerMap = new Map<string, CustomerData>();
                (customerSummary || []).forEach(row => {
                    const customer = row.customer_name;
                    const quoteAmount = (row.estimate_pq || 0) + (row.estimate_vq || 0) + (row.estimate_mq || 0);
                    const orderAmount = (row.final_pq || 0) + (row.final_vq || 0) + (row.final_mq || 0);
                    const difference = orderAmount - quoteAmount;

                    const existing = customerMap.get(customer) || {
                        customer_name: customer,
                        見積もり金額: 0,
                        受注金額_兼_売上金額: 0,
                        受注金額_見積もり差異額: 0
                    };

                    existing.見積もり金額 += quoteAmount;
                    existing.受注金額_兼_売上金額 += orderAmount;
                    existing.受注金額_見積もり差異額 += difference;

                    customerMap.set(customer, existing);
                });

                const customerArray = Array.from(customerMap.values())
                    .sort((a, b) => b.受注金額_兼_売上金額 - a.受注金額_兼_売上金額);

                setCustomerData(customerArray);

                // 月別詳細データ（選択された顧客）
                if (selectedCustomer) {
                    const { data: monthlySummary, error: monthlyError } = await supabase
                        .from('orders_v2')
                        .select(`
                            customer_name,
                            order_date,
                            estimate_pq,
                            estimate_vq,
                            estimate_mq,
                            final_pq,
                            final_vq,
                            final_mq
                        `)
                        .eq('order_type', 'sales')
                        .eq('customer_name', selectedCustomer)
                        .not('order_date', 'is', null)
                        .gte('order_date', '2025-04-01')
                        .lt('order_date', '2026-04-01')
                        .order('order_date');

                    if (monthlyError) throw monthlyError;

                    // 月別データ集計
                    const monthlyMap = new Map<string, MonthlyData>();
                    (monthlySummary || []).forEach(row => {
                        const month = new Date(row.order_date).toISOString().slice(0, 7);
                        const quoteAmount = (row.estimate_pq || 0) + (row.estimate_vq || 0) + (row.estimate_mq || 0);
                        const orderAmount = (row.final_pq || 0) + (row.final_vq || 0) + (row.final_mq || 0);
                        const difference = orderAmount - quoteAmount;

                        const existing = monthlyMap.get(month) || {
                            顧客名: selectedCustomer,
                            年月: month,
                            見積もり金額: 0,
                            受注金額_兼_売上金額: 0,
                            受注金額_見積もり差異額: 0,
                            注文数: 0
                        };

                        existing.見積もり金額 += quoteAmount;
                        existing.受注金額_兼_売上金額 += orderAmount;
                        existing.受注金額_見積もり差異額 += difference;
                        existing.注文数 += 1;

                        monthlyMap.set(month, existing);
                    });

                    const monthlyArray = Array.from(monthlyMap.values())
                        .sort((a, b) => a.年月.localeCompare(b.年月));

                    setMonthlyData(monthlyArray);
                }

            } catch (error) {
                console.error('Failed to load customer data:', error);
            } finally {
                setLoading(false);
            }
        };

        loadCustomerData();
    }, [selectedCustomer]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-500">顧客データを読み込み中...</div>
            </div>
        );
    }

    const currentCustomer = customerData.find(c => c.customer_name === selectedCustomer);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                    戻る
                </button>

                <select
                    value={selectedCustomer}
                    onChange={(e) => setSelectedCustomer(e.target.value)}
                    className="px-4 py-2 bg-white text-slate-900 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                    <option value="">顧客を選択</option>
                    {customerData.map((customer) => (
                        <option key={customer.customer_name} value={customer.customer_name}>
                            {customer.customer_name}
                        </option>
                    ))}
                </select>
            </div>

            {selectedCustomer && currentCustomer && (
                <>
                    {/* Customer Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="p-6 rounded-2xl shadow-sm border border-gray-200">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-lg font-semibold text-gray-900">見積もり金額</h3>
                                <FileText className="w-6 h-6 text-blue-600" />
                            </div>
                            <div className="text-2xl font-bold text-blue-600">
                                {formatJPY(currentCustomer.見積もり金額)}
                            </div>
                        </div>

                        <div className="p-6 rounded-2xl shadow-sm border border-gray-200">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-lg font-semibold text-gray-900">受注金額</h3>
                                <DollarSign className="w-6 h-6 text-green-600" />
                            </div>
                            <div className="text-2xl font-bold text-green-600">
                                {formatJPY(currentCustomer.受注金額_兼_売上金額)}
                            </div>
                        </div>

                        <div className="p-6 rounded-2xl shadow-sm border border-gray-200">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-lg font-semibold text-gray-900">差異額</h3>
                                {currentCustomer.受注金額_見積もり差異額 >= 0 ? (
                                    <TrendingUp className="w-6 h-6 text-green-600" />
                                ) : (
                                    <TrendingDown className="w-6 h-6 text-red-600" />
                                )}
                            </div>
                            <div className={`text-2xl font-bold ${currentCustomer.受注金額_見積もり差異額 >= 0 ? 'text-green-600' : 'text-red-600'
                                }`}>
                                {formatJPY(currentCustomer.受注金額_見積もり差異額)}
                            </div>
                        </div>
                    </div>

                    {/* Monthly Performance Chart */}
                    <div className="p-6 rounded-2xl shadow-sm border border-gray-200">
                        <h3 className="text-xl font-semibold mb-4">月別実績</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={monthlyData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.2} />
                                <XAxis dataKey="年月" fontSize={12} />
                                <YAxis tickFormatter={(value) => `¥${value / 1000000}M`} fontSize={12} />
                                <Tooltip formatter={(value: number, name: string) => [
                                    formatJPY(value),
                                    name === '見積もり金額' ? '見積もり' :
                                        name === '受注金額_兼_売上金額' ? '受注' : '差異'
                                ]} />
                                <Bar dataKey="見積もり金額" fill="#3b82f6" />
                                <Bar dataKey="受注金額_兼_売上金額" fill="#10b981" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Monthly Details Table */}
                    <div className="p-6 rounded-2xl shadow-sm border border-gray-200">
                        <h3 className="text-xl font-semibold mb-4">月別詳細</h3>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            年月
                                        </th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            見積もり金額
                                        </th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            受注金額
                                        </th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            差異額
                                        </th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            注文数
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {monthlyData.map((month) => (
                                        <tr key={month.年月} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                {month.年月}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                                                {formatJPY(month.見積もり金額)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                                                {formatJPY(month.受注金額_兼_売上金額)}
                                            </td>
                                            <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${month.受注金額_見積もり差異額 >= 0 ? 'text-green-600' : 'text-red-600'
                                                }`}>
                                                {formatJPY(month.受注金額_見積もり差異額)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                                                {month.注文数}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {!selectedCustomer && (
                <div className="text-center py-12">
                    <div className="text-gray-500">顧客を選択して詳細を表示してください</div>
                </div>
            )}
        </div>
    );
};

export default CustomerDetailPage;
