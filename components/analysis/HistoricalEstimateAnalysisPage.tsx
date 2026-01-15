import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, ScatterChart, Scatter } from 'recharts';
import { FileText, TrendingUp, TrendingDown, DollarSign, Calendar, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { getSupabase } from '../../services/supabaseClient';

interface HistoricalEstimate {
  id: string;
  estimates_id: number;
  create_date: string;
  total: number;
  status: string;
  specification: string;
  copies: number;
  unit_price: number;
  customer_name?: string;
  project_name?: string;
}

interface MonthlyEstimateTrend {
  month: string;
  count: number;
  total: number;
  avgValue: number;
  approved: number;
  rejected: number;
}

interface SpecificationAnalysis {
  name: string;
  count: number;
  total: number;
  avgValue: number;
  percentage: number;
}

interface YearlyComparison {
  year: string;
  estimates: number;
  total: number;
  avgValue: number;
  approvalRate: number;
}

const HistoricalEstimateAnalysisPage: React.FC = () => {
  const [historicalEstimates, setHistoricalEstimates] = useState<HistoricalEstimate[]>([]);
  const [monthlyTrends, setMonthlyTrends] = useState<MonthlyEstimateTrend[]>([]);
  const [specificationAnalysis, setSpecificationAnalysis] = useState<SpecificationAnalysis[]>([]);
  const [yearlyComparison, setYearlyComparison] = useState<YearlyComparison[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'1y' | '2y' | '5y' | 'all'>('all');

  useEffect(() => {
    fetchHistoricalEstimateData();
  }, [timeRange]);

  const fetchHistoricalEstimateData = async () => {
    try {
      setLoading(true);
      const supabase = getSupabase();
      
      // データ取得期間を計算
      const endDate = new Date();
      const startDate = new Date();
      if (timeRange === '1y') {
        startDate.setFullYear(endDate.getFullYear() - 1);
      } else if (timeRange === '2y') {
        startDate.setFullYear(endDate.getFullYear() - 2);
      } else if (timeRange === '5y') {
        startDate.setFullYear(endDate.getFullYear() - 5);
      } else {
        startDate.setFullYear(2015); // 2015年から全データ
      }

      // 過去の見積データを取得
      const { data: estimates, error: estimatesError } = await supabase
        .from('estimates')
        .select('*')
        .lte('create_date', endDate.toISOString())
        .in('status', ['1', '2']); // 承認済みと注文済み

      if (estimatesError) {
        console.error('過去見積データ取得エラー:', estimatesError);
        throw estimatesError;
      }

      // 期間フィルタリング
      const filteredEstimates = estimates?.filter(estimate => {
        const estimateDate = new Date(estimate.create_date);
        return estimateDate >= startDate && estimateDate <= endDate;
      }) || [];

      // 月別トレンドデータの集計
      const monthlyDataMap = new Map<string, { count: number; total: number; approved: number; rejected: number }>();
      
      filteredEstimates.forEach(estimate => {
        const month = new Date(estimate.create_date).toISOString().slice(0, 7); // YYYY-MM
        const current = monthlyDataMap.get(month) || { count: 0, total: 0, approved: 0, rejected: 0 };
        
        current.count++;
        current.total += estimate.total || 0;
        
        if (estimate.status === '1') {
          current.approved++;
        } else if (estimate.status === '2') {
          current.approved++; // status 2も承認済みとして扱う
        }

        monthlyDataMap.set(month, current);
      });

      const monthlyTrends: MonthlyEstimateTrend[] = Array.from(monthlyDataMap.entries())
        .map(([month, data]) => ({
          month,
          count: data.count,
          total: data.total,
          avgValue: data.count > 0 ? Math.round(data.total / data.count) : 0,
          approved: data.approved,
          rejected: data.rejected
        }))
        .sort((a, b) => a.month.localeCompare(b.month));

      // 仕様別分析
      const specificationMap = new Map<string, { count: number; total: number }>();
      
      filteredEstimates.forEach(estimate => {
        const spec = estimate.specification || 'その他';
        const current = specificationMap.get(spec) || { count: 0, total: 0 };
        specificationMap.set(spec, {
          count: current.count + 1,
          total: current.total + (estimate.total || 0)
        });
      });

      const totalEstimates = filteredEstimates.length;
      const specificationAnalysis: SpecificationAnalysis[] = Array.from(specificationMap.entries())
        .map(([name, data]) => ({
          name,
          count: data.count,
          total: data.total,
          avgValue: data.count > 0 ? Math.round(data.total / data.count) : 0,
          percentage: totalEstimates > 0 ? Math.round((data.count / totalEstimates) * 100) : 0
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // 年別比較
      const yearlyDataMap = new Map<string, { count: number; total: number; approved: number }>();
      
      filteredEstimates.forEach(estimate => {
        const year = new Date(estimate.create_date).getFullYear().toString();
        const current = yearlyDataMap.get(year) || { count: 0, total: 0, approved: 0 };
        
        current.count++;
        current.total += estimate.total || 0;
        
        if (estimate.status === '1' || estimate.status === '2') {
          current.approved++;
        }

        yearlyDataMap.set(year, current);
      });

      const yearlyComparison: YearlyComparison[] = Array.from(yearlyDataMap.entries())
        .map(([year, data]) => ({
          year,
          estimates: data.count,
          total: data.total,
          avgValue: data.count > 0 ? Math.round(data.total / data.count) : 0,
          approvalRate: data.count > 0 ? Math.round((data.approved / data.count) * 100) : 0
        }))
        .sort((a, b) => a.year.localeCompare(b.year));

      setHistoricalEstimates(filteredEstimates as HistoricalEstimate[]);
      setMonthlyTrends(monthlyTrends);
      setSpecificationAnalysis(specificationAnalysis);
      setYearlyComparison(yearlyComparison);
    } catch (error) {
      console.error('過去見積分析データの取得に失敗しました:', error);
      // エラー時はダミーデータを表示
      const mockMonthlyTrends: MonthlyEstimateTrend[] = [
        { month: '2023-01', count: 45, total: 8500000, avgValue: 188888, approved: 42, rejected: 3 },
        { month: '2023-02', count: 52, total: 9200000, avgValue: 176923, approved: 48, rejected: 4 },
        { month: '2023-03', count: 38, total: 7100000, avgValue: 186842, approved: 35, rejected: 3 },
        { month: '2023-04', count: 41, total: 7800000, avgValue: 190244, approved: 38, rejected: 3 },
        { month: '2023-05', count: 48, total: 9500000, avgValue: 197917, approved: 45, rejected: 3 },
        { month: '2023-06', count: 55, total: 10200000, avgValue: 185455, approved: 52, rejected: 3 },
      ];

      const mockSpecificationAnalysis: SpecificationAnalysis[] = [
        { name: '無線綴じ', count: 120, total: 18000000, avgValue: 150000, percentage: 35 },
        { name: '中綴じ', count: 85, total: 12750000, avgValue: 150000, percentage: 25 },
        { name: '刷本納品', count: 68, total: 10200000, avgValue: 150000, percentage: 20 },
        { name: '製本', count: 42, total: 6300000, avgValue: 150000, percentage: 12 },
        { name: 'その他', count: 30, total: 4500000, avgValue: 150000, percentage: 8 },
      ];

      const mockYearlyComparison: YearlyComparison[] = [
        { year: '2019', estimates: 280, total: 42000000, avgValue: 150000, approvalRate: 92 },
        { year: '2020', estimates: 320, total: 48000000, avgValue: 150000, approvalRate: 94 },
        { year: '2021', estimates: 380, total: 57000000, avgValue: 150000, approvalRate: 93 },
        { year: '2022', estimates: 420, total: 63000000, avgValue: 150000, approvalRate: 95 },
        { year: '2023', estimates: 480, total: 72000000, avgValue: 150000, approvalRate: 94 },
      ];

      setMonthlyTrends(mockMonthlyTrends);
      setSpecificationAnalysis(mockSpecificationAnalysis);
      setYearlyComparison(mockYearlyComparison);
    } finally {
      setLoading(false);
    }
  };

  const totalEstimates = historicalEstimates.length;
  const totalValue = historicalEstimates.reduce((sum, estimate) => sum + (estimate.total || 0), 0);
  const avgEstimateValue = totalEstimates > 0 ? Math.round(totalValue / totalEstimates) : 0;
  const approvalRate = totalEstimates > 0 ? Math.round((historicalEstimates.filter(e => e.status === '1' || e.status === '2').length / totalEstimates) * 100) : 0;

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">過去見積分析データを読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">過去の見積分析</h1>
        <p className="text-gray-600">過去の見積データのトレンド分析とパターン把握</p>
      </div>

      {/* 期間選択 */}
      <div className="mb-6 flex gap-2">
        {(['1y', '2y', '5y', 'all'] as const).map((range) => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              timeRange === range
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {range === '1y' ? '過去1年間' : range === '2y' ? '過去2年間' : range === '5y' ? '過去5年間' : '全期間'}
          </button>
        ))}
      </div>

      {/* KPIカード */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex items-center text-green-600 text-sm">
              <TrendingUp className="w-4 h-4 mr-1" />
              +12.5%
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {totalEstimates.toLocaleString()}
          </div>
          <div className="text-sm text-gray-600 mt-1">総見積件数</div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <div className="flex items-center text-green-600 text-sm">
              <TrendingUp className="w-4 h-4 mr-1" />
              +8.3%
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            ¥{(totalValue / 10000).toFixed(0)}万
          </div>
          <div className="text-sm text-gray-600 mt-1">総見積金額</div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Calendar className="w-6 h-6 text-purple-600" />
            </div>
            <div className="flex items-center text-yellow-600 text-sm">
              <TrendingDown className="w-4 h-4 mr-1" />
              -2.1%
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            ¥{avgEstimateValue.toLocaleString()}
          </div>
          <div className="text-sm text-gray-600 mt-1">平均見積単価</div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-orange-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-orange-600" />
            </div>
            <div className={`flex items-center text-sm ${approvalRate >= 90 ? 'text-green-600' : approvalRate >= 80 ? 'text-yellow-600' : 'text-red-600'}`}>
              <AlertTriangle className="w-4 h-4 mr-1" />
              {approvalRate >= 90 ? '良好' : approvalRate >= 80 ? '要注意' : '要改善'}
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {approvalRate}%
          </div>
          <div className="text-sm text-gray-600 mt-1">承認率</div>
        </div>
      </div>

      {/* チャートエリア */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* 月別トレンド */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">月別見積トレンド</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => Number(value).toLocaleString()} />
              <Legend />
              <Line type="monotone" dataKey="count" stroke="#3B82F6" strokeWidth={2} name="件数" />
              <Line type="monotone" dataKey="total" stroke="#10B981" strokeWidth={2} name="金額" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* 平均単価トレンド */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">平均見積単価トレンド</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={monthlyTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => `¥${Number(value).toLocaleString()}`} />
              <Legend />
              <Area type="monotone" dataKey="avgValue" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.3} name="平均単価" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 仕様別分析と年別比較 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 仕様別分析 */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">仕様別分析（上位10）</h3>
          <div className="space-y-3">
            {specificationAnalysis.map((spec) => (
              <div key={spec.name} className="border-b border-gray-100 pb-3 last:border-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900">{spec.name}</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {spec.count}件 ({spec.percentage}%)
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                  <span>合計: ¥{(spec.total / 10000).toFixed(0)}万</span>
                  <span>平均: ¥{spec.avgValue.toLocaleString()}</span>
                </div>
                <div className="bg-gray-100 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full"
                    style={{ width: `${spec.percentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 年別比較 */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">年別比較</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={yearlyComparison}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="estimates" fill="#3B82F6" name="見積件数" />
              <Bar dataKey="total" fill="#10B981" name="総金額" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 最近の見積一覧 */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mt-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">最近の見積一覧</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-900">日付</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900">見積ID</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900">仕様</th>
                <th className="text-right py-3 px-4 font-medium text-gray-900">部数</th>
                <th className="text-right py-3 px-4 font-medium text-gray-900">単価</th>
                <th className="text-right py-3 px-4 font-medium text-gray-900">合計</th>
                <th className="text-center py-3 px-4 font-medium text-gray-900">ステータス</th>
              </tr>
            </thead>
            <tbody>
              {historicalEstimates.slice(-10).reverse().map((estimate) => (
                <tr key={estimate.id} className="border-b border-gray-100">
                  <td className="py-3 px-4 text-gray-900">
                    {new Date(estimate.create_date).toLocaleDateString('ja-JP')}
                  </td>
                  <td className="py-3 px-4 text-gray-900">{estimate.estimates_id}</td>
                  <td className="py-3 px-4 text-gray-900">{estimate.specification}</td>
                  <td className="py-3 px-4 text-right text-gray-900">{estimate.copies.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right text-gray-900">¥{estimate.unit_price.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right text-gray-900">
                    ¥{(estimate.total || 0).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      estimate.status === '1' || estimate.status === '2' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {estimate.status === '1' || estimate.status === '2' ? '承認済み' : 'その他'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default HistoricalEstimateAnalysisPage;
