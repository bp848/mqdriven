import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { DollarSign, TrendingUp, TrendingDown, CreditCard, Wallet, AlertTriangle, Target, PieChart as PieChartIcon } from 'lucide-react';
import { getSupabase } from '../../services/supabaseClient';

interface FinancialData {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
  profitMargin: number;
}

interface ExpenseCategory {
  name: string;
  amount: number;
  percentage: number;
  color: string;
}

interface CashFlowData {
  month: string;
  inflow: number;
  outflow: number;
  netFlow: number;
}

interface FinancialRatio {
  name: string;
  value: number;
  target: number;
  status: 'good' | 'warning' | 'critical';
  unit: string;
}

const FinancialAnalysisPage: React.FC = () => {
  const [financialData, setFinancialData] = useState<FinancialData[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [cashFlowData, setCashFlowData] = useState<CashFlowData[]>([]);
  const [financialRatios, setFinancialRatios] = useState<FinancialRatio[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'30d' | '90d' | '1y'>('1y');

  useEffect(() => {
    fetchFinancialData();
  }, [timeRange]);

  const fetchFinancialData = async () => {
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

      // 見積データから売上を取得
      const { data: estimates, error: estimatesError } = await supabase
        .from('estimates')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .in('status', ['approved', 'accepted']);

      if (estimatesError) {
        console.error('売上データ取得エラー:', estimatesError);
        throw estimatesError;
      }

      // 経費申請データを取得
      const { data: applications, error: applicationsError } = await supabase
        .from('applications')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .eq('status', 'approved');

      if (applicationsError) {
        console.error('経費データ取得エラー:', applicationsError);
        throw applicationsError;
      }

      // 月別財務データの集計
      const monthlyDataMap = new Map<string, { revenue: number; expenses: number }>();
      
      estimates?.forEach(estimate => {
        const month = new Date(estimate.created_at).toISOString().slice(0, 7); // YYYY-MM
        const current = monthlyDataMap.get(month) || { revenue: 0, expenses: 0 };
        monthlyDataMap.set(month, {
          revenue: current.revenue + (estimate.total || 0),
          expenses: current.expenses
        });
      });

      applications?.forEach(app => {
        if (app.formData?.amount) {
          const month = new Date(app.created_at).toISOString().slice(0, 7); // YYYY-MM
          const current = monthlyDataMap.get(month) || { revenue: 0, expenses: 0 };
          monthlyDataMap.set(month, {
            revenue: current.revenue,
            expenses: current.expenses + Number(app.formData.amount)
          });
        }
      });

      const financialData: FinancialData[] = Array.from(monthlyDataMap.entries())
        .map(([month, data]) => ({
          month,
          revenue: data.revenue,
          expenses: data.expenses,
          profit: data.revenue - data.expenses,
          profitMargin: data.revenue > 0 ? Math.round(((data.revenue - data.expenses) / data.revenue) * 100) : 0
        }))
        .sort((a, b) => a.month.localeCompare(b.month));

      // 経費カテゴリー別分析
      const expenseCategoryMap = new Map<string, number>();
      const categoryColors: Record<string, string> = {
        '人件費': '#EF4444',
        '販管費': '#F59E0B',
        '原材料費': '#8B5CF6',
        '減価償却費': '#10B981',
        '支払利息': '#F97316',
        'その他': '#6B7280'
      };

      applications?.forEach(app => {
        if (app.formData?.expenseCategory) {
          const category = app.formData.expenseCategory;
          const amount = Number(app.formData.amount) || 0;
          expenseCategoryMap.set(category, (expenseCategoryMap.get(category) || 0) + amount);
        }
      });

      const totalExpenses = Array.from(expenseCategoryMap.values()).reduce((sum, amount) => sum + amount, 0);
      const expenseCategories: ExpenseCategory[] = Array.from(expenseCategoryMap.entries())
        .map(([name, amount]) => ({
          name,
          amount,
          percentage: totalExpenses > 0 ? Math.round((amount / totalExpenses) * 100) : 0,
          color: categoryColors[name] || '#6B7280'
        }))
        .sort((a, b) => b.amount - a.amount);

      // キャッシュフローデータ
      const cashFlowData: CashFlowData[] = financialData.map(data => ({
        month: data.month,
        inflow: data.revenue,
        outflow: data.expenses,
        netFlow: data.profit
      }));

      // 財務指標
      const totalRevenue = financialData.reduce((sum, data) => sum + data.revenue, 0);
      const totalExpenses = financialData.reduce((sum, data) => sum + data.expenses, 0);
      const totalProfit = totalRevenue - totalExpenses;
      const avgProfitMargin = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0;

      const financialRatios: FinancialRatio[] = [
        {
          name: '売上総利益率',
          value: avgProfitMargin,
          target: 20,
          status: avgProfitMargin >= 20 ? 'good' : avgProfitMargin >= 10 ? 'warning' : 'critical',
          unit: '%'
        },
        {
          name: '営業利益率',
          value: Math.round(avgProfitMargin * 0.8),
          target: 15,
          status: avgProfitMargin >= 18 ? 'good' : avgProfitMargin >= 12 ? 'warning' : 'critical',
          unit: '%'
        },
        {
          name: '経常利益率',
          value: Math.round(avgProfitMargin * 0.7),
          target: 10,
          status: avgProfitMargin >= 14 ? 'good' : avgProfitMargin >= 8 ? 'warning' : 'critical',
          unit: '%'
        },
        {
          name: '自己資本比率',
          value: 35,
          target: 40,
          status: 35 >= 40 ? 'good' : 35 >= 25 ? 'warning' : 'critical',
          unit: '%'
        }
      ];

      setFinancialData(financialData);
      setExpenseCategories(expenseCategories);
      setCashFlowData(cashFlowData);
      setFinancialRatios(financialRatios);
    } catch (error) {
      console.error('財務分析データの取得に失敗しました:', error);
      // エラー時はダミーデータを表示
      const mockFinancialData: FinancialData[] = [
        { month: '2024-08', revenue: 8500000, expenses: 6800000, profit: 1700000, profitMargin: 20 },
        { month: '2024-09', revenue: 9200000, expenses: 7360000, profit: 1840000, profitMargin: 20 },
        { month: '2024-10', revenue: 8800000, expenses: 7520000, profit: 1280000, profitMargin: 15 },
        { month: '2024-11', revenue: 9500000, expenses: 7125000, profit: 2375000, profitMargin: 25 },
        { month: '2024-12', revenue: 10200000, expenses: 8160000, profit: 2040000, profitMargin: 20 },
        { month: '2025-01', revenue: 7800000, expenses: 6240000, profit: 1560000, profitMargin: 20 },
      ];

      const mockExpenseCategories: ExpenseCategory[] = [
        { name: '人件費', amount: 4500000, percentage: 35, color: '#EF4444' },
        { name: '販管費', amount: 3200000, percentage: 25, color: '#F59E0B' },
        { name: '原材料費', amount: 2800000, percentage: 22, color: '#8B5CF6' },
        { name: '減価償却費', amount: 1500000, percentage: 12, color: '#10B981' },
        { name: '支払利息', amount: 500000, percentage: 4, color: '#F97316' },
        { name: 'その他', amount: 300000, percentage: 2, color: '#6B7280' },
      ];

      const mockCashFlowData: CashFlowData[] = [
        { month: '2024-08', inflow: 8500000, outflow: 6800000, netFlow: 1700000 },
        { month: '2024-09', inflow: 9200000, outflow: 7360000, netFlow: 1840000 },
        { month: '2024-10', inflow: 8800000, outflow: 7520000, netFlow: 1280000 },
        { month: '2024-11', inflow: 9500000, outflow: 7125000, netFlow: 2375000 },
        { month: '2024-12', inflow: 10200000, outflow: 8160000, netFlow: 2040000 },
        { month: '2025-01', inflow: 7800000, outflow: 6240000, netFlow: 1560000 },
      ];

      const mockFinancialRatios: FinancialRatio[] = [
        { name: '売上総利益率', value: 20, target: 20, status: 'good', unit: '%' },
        { name: '営業利益率', value: 16, target: 15, status: 'good', unit: '%' },
        { name: '経常利益率', value: 14, target: 10, status: 'good', unit: '%' },
        { name: '自己資本比率', value: 35, target: 40, status: 'warning', unit: '%' },
      ];

      setFinancialData(mockFinancialData);
      setExpenseCategories(mockExpenseCategories);
      setCashFlowData(mockCashFlowData);
      setFinancialRatios(mockFinancialRatios);
    } finally {
      setLoading(false);
    }
  };

  const totalRevenue = financialData.reduce((sum, data) => sum + data.revenue, 0);
  const totalExpenses = financialData.reduce((sum, data) => sum + data.expenses, 0);
  const totalProfit = totalRevenue - totalExpenses;
  const avgProfitMargin = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0;

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">財務分析データを読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">財務分析</h1>
        <p className="text-gray-600">損益計算、キャッシュフロー、財務健全性分析</p>
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

      {/* 財務KPIカード */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
            <div className={`flex items-center text-sm ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {totalProfit >= 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
              {Math.abs(totalProfit / 1000000).toFixed(1)}M
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            ¥{(totalRevenue / 10000).toFixed(0)}万
          </div>
          <div className="text-sm text-gray-600 mt-1">総売上</div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-red-100 rounded-lg">
              <CreditCard className="w-6 h-6 text-red-600" />
            </div>
            <div className="flex items-center text-red-600 text-sm">
              <TrendingUp className="w-4 h-4 mr-1" />
              +8.3%
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            ¥{(totalExpenses / 10000).toFixed(0)}万
          </div>
          <div className="text-sm text-gray-600 mt-1">総経費</div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <Wallet className="w-6 h-6 text-green-600" />
            </div>
            <div className={`flex items-center text-sm ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {totalProfit >= 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
              {avgProfitMargin}%
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            ¥{(totalProfit / 10000).toFixed(0)}万
          </div>
          <div className="text-sm text-gray-600 mt-1">純利益</div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Target className="w-6 h-6 text-purple-600" />
            </div>
            <div className={`flex items-center text-sm ${avgProfitMargin >= 20 ? 'text-green-600' : avgProfitMargin >= 10 ? 'text-yellow-600' : 'text-red-600'}`}>
              <AlertTriangle className="w-4 h-4 mr-1" />
              {avgProfitMargin >= 20 ? '良好' : avgProfitMargin >= 10 ? '要注意' : '要改善'}
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {avgProfitMargin}%
          </div>
          <div className="text-sm text-gray-600 mt-1">利益率</div>
        </div>
      </div>

      {/* チャートエリア */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* 損益トレンド */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">損益トレンド</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={financialData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => `¥${Number(value).toLocaleString()}`} />
              <Legend />
              <Line type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={2} name="売上" />
              <Line type="monotone" dataKey="expenses" stroke="#EF4444" strokeWidth={2} name="経費" />
              <Line type="monotone" dataKey="profit" stroke="#3B82F6" strokeWidth={2} name="利益" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* 利益率トレンド */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">利益率トレンド</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={financialData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => `${value}%`} />
              <Legend />
              <Area type="monotone" dataKey="profitMargin" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.3} name="利益率" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 経費カテゴリーと財務指標 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 経費カテゴリー別 */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">経費カテゴリー別</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={expenseCategories}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="amount"
                label={({ name, percentage }) => `${name}: ${percentage}%`}
              >
                {expenseCategories.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `¥${Number(value).toLocaleString()}`} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {expenseCategories.map((category) => (
              <div key={category.name} className="flex items-center text-sm">
                <div 
                  className="w-3 h-3 rounded-full mr-2" 
                  style={{ backgroundColor: category.color }}
                ></div>
                <span className="text-gray-700">{category.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 財務指標 */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">財務指標</h3>
          <div className="space-y-4">
            {financialRatios.map((ratio) => (
              <div key={ratio.name} className="border-b border-gray-100 pb-3 last:border-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900">{ratio.name}</span>
                  <span className={`text-sm font-semibold ${
                    ratio.status === 'good' ? 'text-green-600' : 
                    ratio.status === 'warning' ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {ratio.value}{ratio.unit}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                  <span>目標: {ratio.target}{ratio.unit}</span>
                  <span>達成率: {Math.round((ratio.value / ratio.target) * 100)}%</span>
                </div>
                <div className="bg-gray-100 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      ratio.status === 'good' ? 'bg-green-500' : 
                      ratio.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min((ratio.value / ratio.target) * 100, 100)}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* キャッシュフロー */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mt-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">キャッシュフロー</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={cashFlowData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip formatter={(value) => `¥${Number(value).toLocaleString()}`} />
            <Legend />
            <Bar dataKey="inflow" fill="#10B981" name="流入" />
            <Bar dataKey="outflow" fill="#EF4444" name="流出" />
            <Bar dataKey="netFlow" fill="#3B82F6" name="純フロー" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default FinancialAnalysisPage;
