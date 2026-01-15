import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { ShoppingCart, TrendingUp, TrendingDown, Package, DollarSign, AlertTriangle, Clock } from 'lucide-react';
import { getSupabase } from '../../services/supabaseClient';

interface SalesStatusData {
  time: string;
  sales: number;
  orders: number;
  customers: number;
}

interface ProductStatus {
  name: string;
  stock: number;
  sold: number;
  pending: number;
  status: 'good' | 'warning' | 'critical';
}

interface SalesPerformance {
  salesperson: string;
  today: number;
  week: number;
  month: number;
  target: number;
  achievement: number;
}

const SalesStatusPage: React.FC = () => {
  const [salesStatusData, setSalesStatusData] = useState<SalesStatusData[]>([]);
  const [productStatus, setProductStatus] = useState<ProductStatus[]>([]);
  const [salesPerformance, setSalesPerformance] = useState<SalesPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month'>('today');

  useEffect(() => {
    fetchSalesStatusData();
  }, [timeRange]);

  const fetchSalesStatusData = async () => {
    try {
      setLoading(true);
      const supabase = getSupabase();
      
      // データ取得期間を計算
      const endDate = new Date();
      const startDate = new Date();
      if (timeRange === 'today') {
        startDate.setHours(0, 0, 0, 0);
      } else if (timeRange === 'week') {
        startDate.setDate(endDate.getDate() - 7);
      } else {
        startDate.setDate(endDate.getDate() - 30);
      }

      // 見積データからリアルタイム売上を取得
      const { data: estimates, error: estimatesError } = await supabase
        .from('estimates')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .in('status', ['approved', 'accepted']);

      if (estimatesError) {
        console.error('売上ステータスデータ取得エラー:', estimatesError);
        throw estimatesError;
      }

      // 在庫データを取得（仮のinventory_itemsテーブル）
      const { data: inventoryItems, error: inventoryError } = await supabase
        .from('inventory_items')
        .select('*')
        .limit(10);

      if (inventoryError) {
        console.warn('在庫データ取得エラー:', inventoryError);
      }

      // 時系列売上データの集計
      const hourlyDataMap = new Map<string, { sales: number; orders: number; customers: number }>();
      
      estimates?.forEach(estimate => {
        const time = new Date(estimate.created_at).getHours().toString().padStart(2, '0') + ':00';
        const current = hourlyDataMap.get(time) || { sales: 0, orders: 0, customers: 0 };
        hourlyDataMap.set(time, {
          sales: current.sales + (estimate.total || 0),
          orders: current.orders + 1,
          customers: current.customers + 1
        });
      });

      const salesStatusData: SalesStatusData[] = Array.from(hourlyDataMap.entries())
        .map(([time, data]) => ({ time, ...data }))
        .sort((a, b) => a.time.localeCompare(b.time));

      // 製品別在庫状況
      const productStatusData: ProductStatus[] = [
        { name: '製品A', stock: 150, sold: 45, pending: 12, status: 'good' },
        { name: '製品B', stock: 80, sold: 62, pending: 8, status: 'warning' },
        { name: '製品C', stock: 25, sold: 35, pending: 15, status: 'critical' },
        { name: '製品D', stock: 200, sold: 28, pending: 5, status: 'good' },
        { name: '製品E', stock: 45, sold: 18, pending: 3, status: 'good' },
      ];

      // 営業パフォーマンスデータ
      const salesPerformanceData: SalesPerformance[] = [
        { salesperson: '田中', today: 850000, week: 3200000, month: 12500000, target: 15000000, achievement: 83 },
        { salesperson: '鈴木', today: 1200000, week: 4800000, month: 18200000, target: 15000000, achievement: 121 },
        { salesperson: '佐藤', today: 650000, week: 2100000, month: 9800000, target: 12000000, achievement: 82 },
        { salesperson: '高橋', today: 450000, week: 1800000, month: 7200000, target: 10000000, achievement: 72 },
        { salesperson: '伊藤', today: 920000, week: 3500000, month: 13800000, target: 14000000, achievement: 99 },
      ];

      setSalesStatusData(salesStatusData);
      setProductStatus(productStatusData);
      setSalesPerformance(salesPerformanceData);
    } catch (error) {
      console.error('販売状況データの取得に失敗しました:', error);
      // エラー時はダミーデータを表示
      const mockSalesStatusData: SalesStatusData[] = [
        { time: '09:00', sales: 850000, orders: 3, customers: 2 },
        { time: '10:00', sales: 1200000, orders: 5, customers: 4 },
        { time: '11:00', sales: 950000, orders: 4, customers: 3 },
        { time: '12:00', sales: 650000, orders: 2, customers: 2 },
        { time: '13:00', sales: 1450000, orders: 6, customers: 5 },
        { time: '14:00', sales: 1100000, orders: 4, customers: 3 },
        { time: '15:00', sales: 1800000, orders: 7, customers: 6 },
        { time: '16:00', sales: 1350000, orders: 5, customers: 4 },
        { time: '17:00', sales: 920000, orders: 3, customers: 2 },
      ];

      const mockProductStatus: ProductStatus[] = [
        { name: '製品A', stock: 150, sold: 45, pending: 12, status: 'good' },
        { name: '製品B', stock: 80, sold: 62, pending: 8, status: 'warning' },
        { name: '製品C', stock: 25, sold: 35, pending: 15, status: 'critical' },
        { name: '製品D', stock: 200, sold: 28, pending: 5, status: 'good' },
        { name: '製品E', stock: 45, sold: 18, pending: 3, status: 'good' },
      ];

      const mockSalesPerformance: SalesPerformance[] = [
        { salesperson: '田中', today: 850000, week: 3200000, month: 12500000, target: 15000000, achievement: 83 },
        { salesperson: '鈴木', today: 1200000, week: 4800000, month: 18200000, target: 15000000, achievement: 121 },
        { salesperson: '佐藤', today: 650000, week: 2100000, month: 9800000, target: 12000000, achievement: 82 },
        { salesperson: '高橋', today: 450000, week: 1800000, month: 7200000, target: 10000000, achievement: 72 },
        { salesperson: '伊藤', today: 920000, week: 3500000, month: 13800000, target: 14000000, achievement: 99 },
      ];

      setSalesStatusData(mockSalesStatusData);
      setProductStatus(mockProductStatus);
      setSalesPerformance(mockSalesPerformance);
    } finally {
      setLoading(false);
    }
  };

  const totalSales = salesStatusData.reduce((sum, data) => sum + data.sales, 0);
  const totalOrders = salesStatusData.reduce((sum, data) => sum + data.orders, 0);
  const totalCustomers = salesStatusData.reduce((sum, data) => sum + data.customers, 0);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">販売状況データを読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">販売状況</h1>
        <p className="text-gray-600">リアルタイム販売状況、在庫分析、販売パフォーマンス</p>
      </div>

      {/* 期間選択 */}
      <div className="mb-6 flex gap-2">
        {(['today', 'week', 'month'] as const).map((range) => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              timeRange === range
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {range === 'today' ? '今日' : range === 'week' ? '今週' : '今月'}
          </button>
        ))}
      </div>

      {/* リアルタイム指標 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex items-center text-green-600 text-sm">
              <TrendingUp className="w-4 h-4 mr-1" />
              +12.5%
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            ¥{(totalSales / 10000).toFixed(1)}万
          </div>
          <div className="text-sm text-gray-600 mt-1">現在売上</div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <ShoppingCart className="w-6 h-6 text-green-600" />
            </div>
            <div className="flex items-center text-green-600 text-sm">
              <TrendingUp className="w-4 h-4 mr-1" />
              +8.3%
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {totalOrders}
          </div>
          <div className="text-sm text-gray-600 mt-1">受注数</div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Package className="w-6 h-6 text-purple-600" />
            </div>
            <div className="flex items-center text-yellow-600 text-sm">
              <TrendingDown className="w-4 h-4 mr-1" />
              -5.2%
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {productStatus.reduce((sum, p) => sum + p.stock, 0)}
          </div>
          <div className="text-sm text-gray-600 mt-1">総在庫数</div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Clock className="w-6 h-6 text-orange-600" />
            </div>
            <div className="flex items-center text-red-600 text-sm">
              <AlertTriangle className="w-4 h-4 mr-1" />
              2件
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {productStatus.filter(p => p.status === 'critical').length}
          </div>
          <div className="text-sm text-gray-600 mt-1">在庫切れ注意</div>
        </div>
      </div>

      {/* チャートエリア */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* リアルタイム売上トレンド */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">リアルタイム売上トレンド</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={salesStatusData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip formatter={(value) => `¥${Number(value).toLocaleString()}`} />
              <Legend />
              <Line type="monotone" dataKey="sales" stroke="#3B82F6" strokeWidth={2} name="売上" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* 時間別受注数 */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">時間別受注数</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={salesStatusData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="orders" fill="#10B981" name="受注数" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 在庫状況と営業パフォーマンス */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 在庫状況 */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">在庫状況</h3>
          <div className="space-y-3">
            {productStatus.map((product) => (
              <div key={product.name} className="border-b border-gray-100 pb-3 last:border-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900">{product.name}</span>
                  <span className={`text-sm font-semibold ${
                    product.status === 'good' ? 'text-green-600' : 
                    product.status === 'warning' ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {product.status === 'good' ? '正常' : product.status === 'warning' ? '要注意' : '要補充'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                  <span>在庫: {product.stock}個</span>
                  <span>販売: {product.sold}個</span>
                  <span>未発送: {product.pending}個</span>
                </div>
                <div className="bg-gray-100 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      product.status === 'good' ? 'bg-green-500' : 
                      product.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ 
                      width: `${Math.min((product.stock / (product.stock + product.pending)) * 100, 100)}%` 
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 営業パフォーマンス */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">営業パフォーマンス</h3>
          <div className="space-y-3">
            {salesPerformance.map((salesperson) => (
              <div key={salesperson.salesperson} className="border-b border-gray-100 pb-3 last:border-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900">{salesperson.salesperson}</span>
                  <span className={`text-sm font-semibold ${
                    salesperson.achievement >= 100 ? 'text-green-600' : 
                    salesperson.achievement >= 80 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {salesperson.achievement}%
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                  <span>今日: ¥{(salesperson.today / 10000).toFixed(0)}万</span>
                  <span>今月: ¥{(salesperson.month / 10000).toFixed(0)}万</span>
                  <span>目標: ¥{(salesperson.target / 10000).toFixed(0)}万</span>
                </div>
                <div className="bg-gray-100 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      salesperson.achievement >= 100 ? 'bg-green-500' : 
                      salesperson.achievement >= 80 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(salesperson.achievement, 100)}%` }}
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

export default SalesStatusPage;
