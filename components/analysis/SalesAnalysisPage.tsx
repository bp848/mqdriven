import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Users, Calendar } from 'lucide-react';
import { getSupabase } from '../../services/supabaseClient';

interface SalesData {
  date: string;
  sales: number;
  orders: number;
  customers: number;
}

interface ProductSales {
  name: string;
  sales: number;
  quantity: number;
}

interface CustomerSegment {
  name: string;
  value: number;
  color: string;
}

const pctChange = (current: number, previous: number): number | null => {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  return ((current - previous) / previous) * 100;
};

const formatDelta = (value: number | null) => {
  if (value === null) return '—';
  const rounded = Math.round(value * 10) / 10;
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded}%`;
};

const SalesAnalysisPage: React.FC = () => {
  const [salesData, setSalesData] = useState<SalesData[]>([]);
  const [productSales, setProductSales] = useState<ProductSales[]>([]);
  const [customerSegments, setCustomerSegments] = useState<CustomerSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [salesChangePct, setSalesChangePct] = useState<number | null>(null);
  const [ordersChangePct, setOrdersChangePct] = useState<number | null>(null);
  const [customersChangePct, setCustomersChangePct] = useState<number | null>(null);
  const [periodCustomerCount, setPeriodCustomerCount] = useState<number>(0);

  useEffect(() => {
    fetchSalesData();
  }, [timeRange]);

  const fetchSalesData = async () => {
    try {
      setLoading(true);
      setError(null);
      const supabase = getSupabase();
      
      // 売上データの取得期間を計算（前期間も含めて取得）
      const endDate = new Date();
      const startDate = new Date();
      if (timeRange === '7d') {
        startDate.setDate(endDate.getDate() - 7);
      } else if (timeRange === '30d') {
        startDate.setDate(endDate.getDate() - 30);
      } else {
        startDate.setDate(endDate.getDate() - 90);
      }
      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
      const prevStartDate = new Date(startDate);
      prevStartDate.setDate(prevStartDate.getDate() - days);

      // 見積データから売上情報を取得（前期間も含める）
      const { data: estimates, error: estimatesError } = await supabase
        .from('estimates')
        .select('create_date,total,copies,specification,pattern_name,project_id')
        .gte('create_date', prevStartDate.toISOString())
        .lte('create_date', endDate.toISOString())
        .in('status', ['1', '2']); // status: 1=approved, 2=ordered

      if (estimatesError) {
        console.error('見積データ取得エラー:', estimatesError);
        throw estimatesError;
      }

      // プロジェクト→顧客の紐付け（customerSegments / 顧客数集計用）
      const projectIds = Array.from(new Set((estimates || []).map((e: any) => e.project_id).filter(Boolean)));
      const projectCustomerMap = new Map<string, string>();
      if (projectIds.length) {
        const { data: projects, error: projectsError } = await supabase
          .from('projects')
          .select('id,customer_id')
          .in('id', projectIds);
        if (projectsError) {
          console.error('プロジェクト取得エラー:', projectsError);
          throw projectsError;
        }
        (projects || []).forEach((p: any) => {
          if (p?.id && p?.customer_id) projectCustomerMap.set(p.id, p.customer_id);
        });
      }

      // 日別売上データの集計
      const dailySalesMap = new Map<string, { sales: number; orders: number; customerSet: Set<string> }>();
      
      const currentEstimates = (estimates || []).filter((estimate: any) => {
        const d = new Date(estimate.create_date);
        return d >= startDate && d <= endDate;
      });
      const prevEstimates = (estimates || []).filter((estimate: any) => {
        const d = new Date(estimate.create_date);
        return d >= prevStartDate && d < startDate;
      });

      currentEstimates.forEach((estimate: any) => {
        const estimateDate = new Date(estimate.create_date);
        const date = estimateDate.toISOString().split('T')[0];
        const customerId = estimate.project_id ? (projectCustomerMap.get(estimate.project_id) || '') : '';
        const current = dailySalesMap.get(date) || { sales: 0, orders: 0, customerSet: new Set<string>() };
        if (customerId) current.customerSet.add(customerId);
        dailySalesMap.set(date, {
          sales: current.sales + (Number(estimate.total) || 0),
          orders: current.orders + 1,
          customerSet: current.customerSet,
        });
      });

      const salesData: SalesData[] = Array.from(dailySalesMap.entries())
        .map(([date, data]) => ({ date, sales: data.sales, orders: data.orders, customers: data.customerSet.size }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // 製品別売上データの集計
      const productSalesMap = new Map<string, { sales: number; quantity: number }>();
      
      currentEstimates.forEach((estimate: any) => {
        const productName = estimate.pattern_name || estimate.specification || 'その他';
        const current = productSalesMap.get(productName) || { sales: 0, quantity: 0 };
        productSalesMap.set(productName, {
          sales: current.sales + (Number(estimate.total) || 0),
          quantity: current.quantity + (Number(estimate.copies) || 0),
        });
      });

      const productSales: ProductSales[] = Array.from(productSalesMap.entries())
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 5);

      // 顧客セグメント（DB参照: 見積×プロジェクトの顧客紐付けのみで算出）
      const customerStats = new Map<string, { sales: number; orders: number; hadPrev: boolean }>();
      const addCustomer = (estimate: any, hadPrev: boolean) => {
        const customerId = estimate.project_id ? projectCustomerMap.get(estimate.project_id) : null;
        if (!customerId) return;
        const current = customerStats.get(customerId) || { sales: 0, orders: 0, hadPrev: false };
        customerStats.set(customerId, {
          sales: current.sales + (Number(estimate.total) || 0),
          orders: current.orders + 1,
          hadPrev: current.hadPrev || hadPrev,
        });
      };
      prevEstimates.forEach((e: any) => addCustomer(e, true));
      currentEstimates.forEach((e: any) => addCustomer(e, false));

      const activeCustomers = Array.from(customerStats.entries());
      const totalActiveCustomers = activeCustomers.length;
      const newCustomers = activeCustomers.filter(([, s]) => !s.hadPrev);
      const existingCustomers = activeCustomers.filter(([, s]) => s.hadPrev);
      existingCustomers.sort((a, b) => b[1].sales - a[1].sales);
      const vipCount = existingCustomers.length ? Math.max(1, Math.ceil(existingCustomers.length * 0.1)) : 0;
      const vipCustomerIds = new Set(existingCustomers.slice(0, vipCount).map(([id]) => id));
      const repeatCustomers = existingCustomers.filter(([id, s]) => !vipCustomerIds.has(id) && s.orders >= 2);
      const repeatCustomerIds = new Set(repeatCustomers.map(([id]) => id));
      const otherCount = Math.max(0, totalActiveCustomers - newCustomers.length - vipCustomerIds.size - repeatCustomerIds.size);
      const toPct = (n: number) => (totalActiveCustomers > 0 ? Math.round((n / totalActiveCustomers) * 100) : 0);

      const customerSegments: CustomerSegment[] = [
        { name: '新規顧客', value: toPct(newCustomers.length), color: '#3B82F6' },
        { name: 'リピート顧客', value: toPct(repeatCustomerIds.size), color: '#10B981' },
        { name: 'VIP顧客', value: toPct(vipCustomerIds.size), color: '#F59E0B' },
        ...(otherCount > 0 ? [{ name: 'その他', value: toPct(otherCount), color: '#6B7280' }] : []),
      ];

      // KPI差分（前期間比）
      const sumSales = (rows: any[]) => rows.reduce((sum, r) => sum + (Number(r.total) || 0), 0);
      const currentSales = sumSales(currentEstimates);
      const prevSales = sumSales(prevEstimates);
      setSalesChangePct(pctChange(currentSales, prevSales));

      const currentOrders = currentEstimates.length;
      const prevOrders = prevEstimates.length;
      setOrdersChangePct(pctChange(currentOrders, prevOrders));

      const uniqCustomers = (rows: any[]) => {
        const set = new Set<string>();
        rows.forEach((r: any) => {
          const customerId = r.project_id ? projectCustomerMap.get(r.project_id) : null;
          if (customerId) set.add(customerId);
        });
        return set.size;
      };
      const currentCustomerCount = uniqCustomers(currentEstimates);
      const prevCustomerCount = uniqCustomers(prevEstimates);
      setCustomersChangePct(pctChange(currentCustomerCount, prevCustomerCount));
      setPeriodCustomerCount(currentCustomerCount);

      setSalesData(salesData);
      setProductSales(productSales);
      setCustomerSegments(customerSegments);
    } catch (error) {
      console.error('販売データの取得に失敗しました:', error);
      setError(error instanceof Error ? error.message : '販売データの取得に失敗しました');
      setSalesData([]);
      setProductSales([]);
      setCustomerSegments([]);
      setSalesChangePct(null);
      setOrdersChangePct(null);
      setCustomersChangePct(null);
      setPeriodCustomerCount(0);
    } finally {
      setLoading(false);
    }
  };

  const totalSales = salesData.reduce((sum, day) => sum + day.sales, 0);
  const totalOrders = salesData.reduce((sum, day) => sum + day.orders, 0);
  const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">販売データを読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <h1 className="text-xl font-semibold text-red-900 mb-2">販売分析</h1>
          <p className="text-red-800 text-sm break-words">データ取得に失敗しました: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">販売分析</h1>
        <p className="text-gray-600">売上データ、受注状況、顧客分析の総合レポート</p>
      </div>

      {/* 期間選択 */}
      <div className="mb-6 flex gap-2">
        {(['7d', '30d', '90d'] as const).map((range) => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              timeRange === range
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {range === '7d' ? '過去7日間' : range === '30d' ? '過去30日間' : '過去90日間'}
          </button>
        ))}
      </div>

      {/* KPIカード */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
            <div className={`flex items-center text-sm ${salesChangePct === null ? 'text-gray-500' : salesChangePct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {salesChangePct !== null && (salesChangePct >= 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />)}
              {formatDelta(salesChangePct)}
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            ¥{(totalSales / 10000).toFixed(1)}万
          </div>
          <div className="text-sm text-gray-600 mt-1">総売上</div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <ShoppingCart className="w-6 h-6 text-green-600" />
            </div>
            <div className={`flex items-center text-sm ${ordersChangePct === null ? 'text-gray-500' : ordersChangePct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {ordersChangePct !== null && (ordersChangePct >= 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />)}
              {formatDelta(ordersChangePct)}
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {totalOrders.toLocaleString()}
          </div>
          <div className="text-sm text-gray-600 mt-1">総受注数</div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
            <div className={`flex items-center text-sm ${customersChangePct === null ? 'text-gray-500' : customersChangePct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {customersChangePct !== null && (customersChangePct >= 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />)}
              {formatDelta(customersChangePct)}
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {periodCustomerCount.toLocaleString()}
          </div>
          <div className="text-sm text-gray-600 mt-1">顧客数</div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Calendar className="w-6 h-6 text-orange-600" />
            </div>
            <div className="flex items-center text-gray-500 text-sm">
              平均
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            ¥{(avgOrderValue / 10000).toFixed(1)}万
          </div>
          <div className="text-sm text-gray-600 mt-1">平均客単価</div>
        </div>
      </div>

      {/* チャートエリア */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* 売上トレンド */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">売上トレンド</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={salesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value) => `¥${Number(value).toLocaleString()}`} />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="sales" 
                stroke="#3B82F6" 
                strokeWidth={2}
                name="売上"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* 製品別売上 */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">製品別売上</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={productSales}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => `¥${Number(value).toLocaleString()}`} />
              <Legend />
              <Bar dataKey="sales" fill="#10B981" name="売上" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 顧客セグメントと詳細 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 顧客セグメント */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">顧客セグメント</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={customerSegments.map(seg => ({ ...seg, value: seg.value, name: seg.name }))}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {customerSegments.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `${value}%`} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 space-y-2">
            {customerSegments.map((segment) => (
              <div key={segment.name} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div 
                    className="w-3 h-3 rounded-full mr-2" 
                    style={{ backgroundColor: segment.color }}
                  ></div>
                  <span className="text-sm text-gray-700">{segment.name}</span>
                </div>
                <span className="text-sm font-medium text-gray-900">{segment.value}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* 詳細データ */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">製品別詳細</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-900">製品名</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-900">売上</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-900">数量</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-900">平均単価</th>
                </tr>
              </thead>
              <tbody>
                {productSales.map((product) => (
                  <tr key={product.name} className="border-b border-gray-100">
                    <td className="py-3 px-4 text-gray-900">{product.name}</td>
                    <td className="py-3 px-4 text-right text-gray-900">
                      ¥{(product.sales / 10000).toFixed(1)}万
                    </td>
                    <td className="py-3 px-4 text-right text-gray-900">{product.quantity}</td>
                    <td className="py-3 px-4 text-right text-gray-900">
                      ¥{Math.round(product.sales / product.quantity).toLocaleString()}
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

export default SalesAnalysisPage;
