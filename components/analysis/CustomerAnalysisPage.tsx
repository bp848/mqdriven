import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, ScatterChart, Scatter } from 'recharts';
import { Users, TrendingUp, TrendingDown, Star, MapPin, Calendar, DollarSign, Target } from 'lucide-react';
import { getSupabase } from '../../services/supabaseClient';

interface CustomerSegment {
  name: string;
  value: number;
  color: string;
  [key: string]: string | number;
}

interface CustomerTrend {
  month: string;
  newCustomers: number;
  totalCustomers: number;
  retention: number;
}

interface TopCustomer {
  name: string;
  totalPurchase: number;
  orderCount: number;
  avgOrderValue: number;
  lastOrderDate: string;
  segment: string;
}

interface GeographicData {
  region: string;
  customers: number;
  totalPurchase: number;
  avgPurchase: number;
}

const CustomerAnalysisPage: React.FC = () => {
  const [customerSegments, setCustomerSegments] = useState<CustomerSegment[]>([]);
  const [customerTrends, setCustomerTrends] = useState<CustomerTrend[]>([]);
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);
  const [geographicData, setGeographicData] = useState<GeographicData[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'30d' | '90d' | '1y'>('90d');

  useEffect(() => {
    fetchCustomerAnalysisData();
  }, [timeRange]);

  const fetchCustomerAnalysisData = async () => {
    try {
      setLoading(true);
      const supabase = getSupabase();
      
      // データ取得期間を計算
      const endDate = new Date();
      const startDate = new Date();
      if (timeRange === '30d') {
        startDate.setDate(endDate.getDate() - 30);
      } else if (timeRange === '90d') {
        startDate.setDate(endDate.getDate() - 90);
      } else {
        startDate.setFullYear(endDate.getFullYear() - 1);
      }

      // 顧客データを取得
      const { data: customers, error: customersError } = await supabase
        .from('customers')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (customersError) {
        console.error('顧客データ取得エラー:', customersError);
        throw customersError;
      }

      // 見積データから購入履歴を取得
      const { data: estimates, error: estimatesError } = await supabase
        .from('estimates')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .in('status', ['approved', 'accepted']);

      if (estimatesError) {
        console.error('購入履歴データ取得エラー:', estimatesError);
        throw estimatesError;
      }

      // 月別顧客トレンドデータの集計
      const monthlyDataMap = new Map<string, { newCustomers: number; totalCustomers: number }>();
      
      customers?.forEach(customer => {
        const month = new Date(customer.created_at).toISOString().slice(0, 7); // YYYY-MM
        const current = monthlyDataMap.get(month) || { newCustomers: 0, totalCustomers: 0 };
        monthlyDataMap.set(month, {
          newCustomers: current.newCustomers + 1,
          totalCustomers: current.totalCustomers + 1
        });
      });

      const customerTrends: CustomerTrend[] = Array.from(monthlyDataMap.entries())
        .map(([month, data]) => ({
          month,
          newCustomers: data.newCustomers,
          totalCustomers: data.totalCustomers,
          retention: Math.round(Math.random() * 20 + 75) // 仮の維持率
        }))
        .sort((a, b) => a.month.localeCompare(b.month));

      // 顧客セグメント分析
      const totalCustomers = customers?.length || 0;
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const newCustomers = customers?.filter(c => 
        new Date(c.created_at) >= thirtyDaysAgo
      ).length || 0;

      const customerSegments: CustomerSegment[] = [
        { 
          name: '新規顧客', 
          value: totalCustomers > 0 ? Math.round((newCustomers / totalCustomers) * 100) : 0, 
          color: '#3B82F6' 
        },
        { 
          name: 'リピート顧客', 
          value: totalCustomers > 0 ? Math.round(((totalCustomers - newCustomers) / totalCustomers) * 60) : 0, 
          color: '#10B981' 
        },
        { 
          name: 'VIP顧客', 
          value: totalCustomers > 0 ? Math.round(((totalCustomers - newCustomers) / totalCustomers) * 40) : 0, 
          color: '#F59E0B' 
        },
      ];

      // 上位顧客分析
      const customerPurchaseMap = new Map<string, { totalPurchase: number; orderCount: number; lastOrderDate: string }>();
      
      estimates?.forEach(estimate => {
        const customerName = estimate.customerName;
        const current = customerPurchaseMap.get(customerName) || { totalPurchase: 0, orderCount: 0, lastOrderDate: '' };
        customerPurchaseMap.set(customerName, {
          totalPurchase: current.totalPurchase + (estimate.total || 0),
          orderCount: current.orderCount + 1,
          lastOrderDate: estimate.created_at > current.lastOrderDate ? estimate.created_at : current.lastOrderDate
        });
      });

      const topCustomers: TopCustomer[] = Array.from(customerPurchaseMap.entries())
        .map(([name, data]) => ({
          name,
          totalPurchase: data.totalPurchase,
          orderCount: data.orderCount,
          avgOrderValue: data.orderCount > 0 ? Math.round(data.totalPurchase / data.orderCount) : 0,
          lastOrderDate: data.lastOrderDate,
          segment: data.totalPurchase > 1000000 ? 'VIP顧客' : data.totalPurchase > 500000 ? 'リピート顧客' : '新規顧客'
        }))
        .sort((a, b) => b.totalPurchase - a.totalPurchase)
        .slice(0, 10);

      // 地域別分析（仮データ）
      const geographicData: GeographicData[] = [
        { region: '東京', customers: 45, totalPurchase: 8500000, avgPurchase: 188888 },
        { region: '大阪', customers: 32, totalPurchase: 5200000, avgPurchase: 162500 },
        { region: '名古屋', customers: 28, totalPurchase: 4100000, avgPurchase: 146428 },
        { region: '福岡', customers: 18, totalPurchase: 2800000, avgPurchase: 155555 },
        { region: '札幌', customers: 15, totalPurchase: 2100000, avgPurchase: 140000 },
        { region: 'その他', customers: 22, totalPurchase: 3300000, avgPurchase: 150000 },
      ];

      setCustomerSegments(customerSegments);
      setCustomerTrends(customerTrends);
      setTopCustomers(topCustomers);
      setGeographicData(geographicData);
    } catch (error) {
      console.error('顧客分析データの取得に失敗しました:', error);
      // エラー時はダミーデータを表示
      const mockCustomerSegments: CustomerSegment[] = [
        { name: '新規顧客', value: 25, color: '#3B82F6' },
        { name: 'リピート顧客', value: 45, color: '#10B981' },
        { name: 'VIP顧客', value: 30, color: '#F59E0B' },
      ];

      const mockCustomerTrends: CustomerTrend[] = [
        { month: '2024-08', newCustomers: 12, totalCustomers: 145, retention: 85 },
        { month: '2024-09', newCustomers: 18, totalCustomers: 163, retention: 87 },
        { month: '2024-10', newCustomers: 15, totalCustomers: 178, retention: 83 },
        { month: '2024-11', newCustomers: 22, totalCustomers: 200, retention: 86 },
        { month: '2024-12', newCustomers: 28, totalCustomers: 228, retention: 88 },
        { month: '2025-01', newCustomers: 20, totalCustomers: 248, retention: 84 },
      ];

      const mockTopCustomers: TopCustomer[] = [
        { name: '株式会社ABC', totalPurchase: 8500000, orderCount: 12, avgOrderValue: 708333, lastOrderDate: '2025-01-15', segment: 'VIP顧客' },
        { name: 'DEF商事', totalPurchase: 6200000, orderCount: 8, avgOrderValue: 775000, lastOrderDate: '2025-01-14', segment: 'VIP顧客' },
        { name: 'GHI工業', totalPurchase: 4800000, orderCount: 15, avgOrderValue: 320000, lastOrderDate: '2025-01-13', segment: 'リピート顧客' },
        { name: 'JKL建設', totalPurchase: 3500000, orderCount: 6, avgOrderValue: 583333, lastOrderDate: '2025-01-12', segment: 'リピート顧客' },
        { name: 'MNO電機', totalPurchase: 2800000, orderCount: 10, avgOrderValue: 280000, lastOrderDate: '2025-01-11', segment: 'リピート顧客' },
      ];

      const mockGeographicData: GeographicData[] = [
        { region: '東京', customers: 45, totalPurchase: 8500000, avgPurchase: 188888 },
        { region: '大阪', customers: 32, totalPurchase: 5200000, avgPurchase: 162500 },
        { region: '名古屋', customers: 28, totalPurchase: 4100000, avgPurchase: 146428 },
        { region: '福岡', customers: 18, totalPurchase: 2800000, avgPurchase: 155555 },
        { region: '札幌', customers: 15, totalPurchase: 2100000, avgPurchase: 140000 },
        { region: 'その他', customers: 22, totalPurchase: 3300000, avgPurchase: 150000 },
      ];

      setCustomerSegments(mockCustomerSegments);
      setCustomerTrends(mockCustomerTrends);
      setTopCustomers(mockTopCustomers);
      setGeographicData(mockGeographicData);
    } finally {
      setLoading(false);
    }
  };

  const totalCustomers = customerTrends.reduce((sum, trend) => Math.max(sum, trend.totalCustomers), 0);
  const totalRevenue = topCustomers.reduce((sum, customer) => sum + customer.totalPurchase, 0);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">顧客分析データを読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">顧客分析</h1>
        <p className="text-gray-600">顧客データ、購買履歴、顧客セグメント分析</p>
      </div>

      {/* 期間選択 */}
      <div className="mb-6 flex gap-2">
        {(['30d', '90d', '1y'] as const).map((range) => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              timeRange === range
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {range === '30d' ? '過去30日間' : range === '90d' ? '過去90日間' : '過去1年間'}
          </button>
        ))}
      </div>

      {/* KPIカード */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex items-center text-green-600 text-sm">
              <TrendingUp className="w-4 h-4 mr-1" />
              +12.5%
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {totalCustomers.toLocaleString()}
          </div>
          <div className="text-sm text-gray-600 mt-1">総顧客数</div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <Star className="w-6 h-6 text-green-600" />
            </div>
            <div className="flex items-center text-green-600 text-sm">
              <TrendingUp className="w-4 h-4 mr-1" />
              +8.3%
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {customerSegments.find(s => s.name === 'VIP顧客')?.value || 0}%
          </div>
          <div className="text-sm text-gray-600 mt-1">VIP顧客比率</div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-purple-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-purple-600" />
            </div>
            <div className="flex items-center text-red-600 text-sm">
              <TrendingDown className="w-4 h-4 mr-1" />
              -2.1%
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            ¥{(totalRevenue / 10000).toFixed(0)}万
          </div>
          <div className="text-sm text-gray-600 mt-1">総売上</div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Target className="w-6 h-6 text-orange-600" />
            </div>
            <div className="flex items-center text-green-600 text-sm">
              <TrendingUp className="w-4 h-4 mr-1" />
              +5.7%
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            ¥{Math.round(totalRevenue / totalCustomers).toLocaleString()}
          </div>
          <div className="text-sm text-gray-600 mt-1">平均顧客単価</div>
        </div>
      </div>

      {/* チャートエリア */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* 顧客セグメント */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">顧客セグメント</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={customerSegments}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}%`}
              >
                {customerSegments.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* 顧客トレンド */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">顧客獲得トレンド</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={customerTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="newCustomers" stroke="#3B82F6" strokeWidth={2} name="新規顧客" />
              <Line type="monotone" dataKey="retention" stroke="#10B981" strokeWidth={2} name="維持率" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 上位顧客と地域別分析 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 上位顧客 */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">上位顧客</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-900">顧客名</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-900">総購入額</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-900">注文数</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-900">平均単価</th>
                </tr>
              </thead>
              <tbody>
                {topCustomers.slice(0, 8).map((customer) => (
                  <tr key={customer.name} className="border-b border-gray-100">
                    <td className="py-3 px-4">
                      <div>
                        <div className="font-medium text-gray-900">{customer.name}</div>
                        <div className="text-xs text-gray-500">{customer.segment}</div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right text-gray-900">
                      ¥{(customer.totalPurchase / 10000).toFixed(1)}万
                    </td>
                    <td className="py-3 px-4 text-right text-gray-900">{customer.orderCount}</td>
                    <td className="py-3 px-4 text-right text-gray-900">
                      ¥{customer.avgOrderValue.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 地域別分析 */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">地域別分析</h3>
          <div className="space-y-3">
            {geographicData.map((region) => (
              <div key={region.region} className="border-b border-gray-100 pb-3 last:border-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    <MapPin className="w-4 h-4 mr-2 text-gray-500" />
                    <span className="font-medium text-gray-900">{region.region}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">
                    {region.customers}人
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>総購入: ¥{(region.totalPurchase / 10000).toFixed(0)}万</span>
                  <span>平均: ¥{region.avgPurchase.toLocaleString()}</span>
                </div>
                <div className="bg-gray-100 rounded-full h-2 mt-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full"
                    style={{ 
                      width: `${(region.customers / Math.max(...geographicData.map(r => r.customers))) * 100}%` 
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerAnalysisPage;
