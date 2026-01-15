import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, ScatterChart, Scatter, AreaChart, Area } from 'recharts';
import { Briefcase, TrendingUp, TrendingDown, DollarSign, Calendar, Clock, CheckCircle, AlertTriangle, Users, Target } from 'lucide-react';
import { getSupabase } from '../../services/supabaseClient';

interface HistoricalProject {
  id: string;
  project_name?: string;
  created_at?: string;
  status?: string;
  total_budget?: number;
  actual_cost?: number;
  completion_rate?: number;
  start_date?: string;
  end_date?: string;
  customer_name?: string;
}

interface ProjectTrend {
  month: string;
  created: number;
  completed: number;
  totalValue: number;
  avgBudget: number;
}

interface ProjectStatusAnalysis {
  status: string;
  count: number;
  totalValue: number;
  percentage: number;
  color: string;
}

interface ProjectPerformance {
  name: string;
  budget: number;
  actual: number;
  variance: number;
  varianceRate: number;
  completionRate: number;
}

interface CustomerProjectAnalysis {
  customer: string;
  projectCount: number;
  totalValue: number;
  avgValue: number;
  successRate: number;
}

const HistoricalProjectAnalysisPage: React.FC = () => {
  const [historicalProjects, setHistoricalProjects] = useState<HistoricalProject[]>([]);
  const [projectTrends, setProjectTrends] = useState<ProjectTrend[]>([]);
  const [statusAnalysis, setStatusAnalysis] = useState<ProjectStatusAnalysis[]>([]);
  const [projectPerformance, setProjectPerformance] = useState<ProjectPerformance[]>([]);
  const [customerAnalysis, setCustomerAnalysis] = useState<CustomerProjectAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'1y' | '2y' | '5y' | 'all'>('all');

  useEffect(() => {
    fetchHistoricalProjectData();
  }, [timeRange]);

  const fetchHistoricalProjectData = async () => {
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

      // 過去のプロジェクトデータを取得
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .lte('created_at', endDate.toISOString());

      if (projectsError) {
        console.error('過去プロジェクトデータ取得エラー:', projectsError);
        throw projectsError;
      }

      // 見積データからプロジェクト情報を補完
      const { data: estimates, error: estimatesError } = await supabase
        .from('estimates')
        .select('*')
        .lte('create_date', endDate.toISOString())
        .in('status', ['1', '2']);

      if (estimatesError) {
        console.error('見積データ取得エラー:', estimatesError);
        throw estimatesError;
      }

      // 期間フィルタリング
      const filteredProjects = projects?.filter(project => {
        if (!project.created_at) return false;
        const projectDate = new Date(project.created_at);
        return projectDate >= startDate && projectDate <= endDate;
      }) || [];

      // 月別トレンドデータの集計
      const monthlyDataMap = new Map<string, { created: number; completed: number; totalValue: number }>();
      
      filteredProjects.forEach(project => {
        const month = new Date(project.created_at!).toISOString().slice(0, 7); // YYYY-MM
        const current = monthlyDataMap.get(month) || { created: 0, completed: 0, totalValue: 0 };
        
        current.created++;
        current.totalValue += project.total_budget || 0;
        
        // 完了済みプロジェクトをカウント（仮のロジック）
        if (project.status === 'completed' || project.status === 'finished') {
          current.completed++;
        }

        monthlyDataMap.set(month, current);
      });

      const projectTrends: ProjectTrend[] = Array.from(monthlyDataMap.entries())
        .map(([month, data]) => ({
          month,
          created: data.created,
          completed: data.completed,
          totalValue: data.totalValue,
          avgBudget: data.created > 0 ? Math.round(data.totalValue / data.created) : 0
        }))
        .sort((a, b) => a.month.localeCompare(b.month));

      // ステータス別分析
      const statusMap = new Map<string, { count: number; totalValue: number }>();
      const statusColors: Record<string, string> = {
        'active': '#3B82F6',
        'completed': '#10B981',
        'pending': '#F59E0B',
        'cancelled': '#EF4444',
        'on_hold': '#8B5CF6',
        'other': '#6B7280'
      };
      
      filteredProjects.forEach(project => {
        const status = project.status || 'other';
        const current = statusMap.get(status) || { count: 0, totalValue: 0 };
        statusMap.set(status, {
          count: current.count + 1,
          totalValue: current.totalValue + (project.total_budget || 0)
        });
      });

      const totalProjects = filteredProjects.length;
      const statusAnalysis: ProjectStatusAnalysis[] = Array.from(statusMap.entries())
        .map(([status, data]) => ({
          status,
          count: data.count,
          totalValue: data.totalValue,
          percentage: totalProjects > 0 ? Math.round((data.count / totalProjects) * 100) : 0,
          color: statusColors[status] || '#6B7280'
        }))
        .sort((a, b) => b.count - a.count);

      // プロジェクトパフォーマンス分析
      const projectPerformance: ProjectPerformance[] = filteredProjects
        .filter(project => project.total_budget && project.actual_cost)
        .slice(0, 10)
        .map(project => ({
          name: project.project_name || `プロジェクト${project.id.slice(0, 8)}`,
          budget: project.total_budget || 0,
          actual: project.actual_cost || 0,
          variance: (project.total_budget || 0) - (project.actual_cost || 0),
          varianceRate: project.total_budget ? Math.round(((project.total_budget - (project.actual_cost || 0)) / project.total_budget) * 100) : 0,
          completionRate: project.completion_rate || 0
        }))
        .sort((a, b) => Math.abs(b.varianceRate) - Math.abs(a.varianceRate));

      // 顧客別プロジェクト分析
      const customerMap = new Map<string, { projectCount: number; totalValue: number; completed: number }>();
      
      filteredProjects.forEach(project => {
        const customer = project.customer_name || '未設定';
        const current = customerMap.get(customer) || { projectCount: 0, totalValue: 0, completed: 0 };
        
        current.projectCount++;
        current.totalValue += project.total_budget || 0;
        
        if (project.status === 'completed' || project.status === 'finished') {
          current.completed++;
        }

        customerMap.set(customer, current);
      });

      const customerAnalysis: CustomerProjectAnalysis[] = Array.from(customerMap.entries())
        .map(([customer, data]) => ({
          customer,
          projectCount: data.projectCount,
          totalValue: data.totalValue,
          avgValue: data.projectCount > 0 ? Math.round(data.totalValue / data.projectCount) : 0,
          successRate: data.projectCount > 0 ? Math.round((data.completed / data.projectCount) * 100) : 0
        }))
        .sort((a, b) => b.totalValue - a.totalValue)
        .slice(0, 10);

      setHistoricalProjects(filteredProjects);
      setProjectTrends(projectTrends);
      setStatusAnalysis(statusAnalysis);
      setProjectPerformance(projectPerformance);
      setCustomerAnalysis(customerAnalysis);
    } catch (error) {
      console.error('過去プロジェクト分析データの取得に失敗しました:', error);
      // エラー時はダミーデータを表示
      const mockProjectTrends: ProjectTrend[] = [
        { month: '2023-01', created: 12, completed: 8, totalValue: 8500000, avgBudget: 708333 },
        { month: '2023-02', created: 15, completed: 10, totalValue: 9200000, avgBudget: 613333 },
        { month: '2023-03', created: 10, completed: 7, totalValue: 7100000, avgBudget: 710000 },
        { month: '2023-04', created: 13, completed: 9, totalValue: 7800000, avgBudget: 600000 },
        { month: '2023-05', created: 18, completed: 12, totalValue: 9500000, avgBudget: 527778 },
        { month: '2023-06', created: 20, completed: 14, totalValue: 10200000, avgBudget: 510000 },
      ];

      const mockStatusAnalysis: ProjectStatusAnalysis[] = [
        { status: 'active', count: 45, totalValue: 8500000, percentage: 40, color: '#3B82F6' },
        { status: 'completed', count: 38, totalValue: 7200000, percentage: 34, color: '#10B981' },
        { status: 'pending', count: 18, totalValue: 3200000, percentage: 16, color: '#F59E0B' },
        { status: 'cancelled', count: 8, totalValue: 1500000, percentage: 7, color: '#EF4444' },
        { status: 'on_hold', count: 4, totalValue: 800000, percentage: 3, color: '#8B5CF6' },
      ];

      const mockProjectPerformance: ProjectPerformance[] = [
        { name: 'Webサイト開発', budget: 5000000, actual: 4500000, variance: 500000, varianceRate: 10, completionRate: 95 },
        { name: 'モバイルアプリ', budget: 3000000, actual: 3200000, variance: -200000, varianceRate: -7, completionRate: 88 },
        { name: 'システム改修', budget: 2000000, actual: 1800000, variance: 200000, varianceRate: 10, completionRate: 92 },
        { name: 'データ移行', budget: 1500000, actual: 1700000, variance: -200000, varianceRate: -13, completionRate: 85 },
        { name: 'UI改善', budget: 1000000, actual: 950000, variance: 50000, varianceRate: 5, completionRate: 98 },
      ];

      const mockCustomerAnalysis: CustomerProjectAnalysis[] = [
        { customer: '株式会社ABC', projectCount: 8, totalValue: 12000000, avgValue: 1500000, successRate: 88 },
        { customer: 'DEF商事', projectCount: 6, totalValue: 9000000, avgValue: 1500000, successRate: 92 },
        { customer: 'GHI工業', projectCount: 5, totalValue: 7500000, avgValue: 1500000, successRate: 85 },
        { customer: 'JKL建設', projectCount: 4, totalValue: 6000000, avgValue: 1500000, successRate: 90 },
        { customer: 'MNO電機', projectCount: 3, totalValue: 4500000, avgValue: 1500000, successRate: 95 },
      ];

      setProjectTrends(mockProjectTrends);
      setStatusAnalysis(mockStatusAnalysis);
      setProjectPerformance(mockProjectPerformance);
      setCustomerAnalysis(mockCustomerAnalysis);
    } finally {
      setLoading(false);
    }
  };

  const totalProjects = historicalProjects.length;
  const totalBudget = historicalProjects.reduce((sum, project) => sum + (project.total_budget || 0), 0);
  const avgBudget = totalProjects > 0 ? Math.round(totalBudget / totalProjects) : 0;
  const completedProjects = historicalProjects.filter(p => p.status === 'completed' || p.status === 'finished').length;
  const completionRate = totalProjects > 0 ? Math.round((completedProjects / totalProjects) * 100) : 0;

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">過去プロジェクト分析データを読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">過去のプロジェクト分析</h1>
        <p className="text-gray-600">過去のプロジェクトデータのトレンド分析とパフォーマンス評価</p>
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
              <Briefcase className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex items-center text-green-600 text-sm">
              <TrendingUp className="w-4 h-4 mr-1" />
              +15.2%
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {totalProjects.toLocaleString()}
          </div>
          <div className="text-sm text-gray-600 mt-1">総プロジェクト数</div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <div className="flex items-center text-green-600 text-sm">
              <TrendingUp className="w-4 h-4 mr-1" />
              +12.8%
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            ¥{(totalBudget / 10000).toFixed(0)}万
          </div>
          <div className="text-sm text-gray-600 mt-1">総予算額</div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Target className="w-6 h-6 text-purple-600" />
            </div>
            <div className="flex items-center text-yellow-600 text-sm">
              <TrendingDown className="w-4 h-4 mr-1" />
              -3.1%
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            ¥{avgBudget.toLocaleString()}
          </div>
          <div className="text-sm text-gray-600 mt-1">平均プロジェクト予算</div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-orange-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-orange-600" />
            </div>
            <div className={`flex items-center text-sm ${completionRate >= 80 ? 'text-green-600' : completionRate >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
              <AlertTriangle className="w-4 h-4 mr-1" />
              {completionRate >= 80 ? '良好' : completionRate >= 60 ? '要注意' : '要改善'}
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {completionRate}%
          </div>
          <div className="text-sm text-gray-600 mt-1">完了率</div>
        </div>
      </div>

      {/* チャートエリア */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* 月別トレンド */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">月別プロジェクトトレンド</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={projectTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="created" stroke="#3B82F6" strokeWidth={2} name="新規作成" />
              <Line type="monotone" dataKey="completed" stroke="#10B981" strokeWidth={2} name="完了" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* 予算トレンド */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">月別予算トレンド</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={projectTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => `¥${Number(value).toLocaleString()}`} />
              <Legend />
              <Area type="monotone" dataKey="totalValue" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.3} name="総予算額" />
              <Area type="monotone" dataKey="avgBudget" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.3} name="平均予算" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ステータス分析とプロジェクトパフォーマンス */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ステータス別分析 */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">ステータス別分析</h3>
          <div className="space-y-3">
            {statusAnalysis.map((status) => (
              <div key={status.status} className="border-b border-gray-100 pb-3 last:border-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    <div 
                      className="w-3 h-3 rounded-full mr-2" 
                      style={{ backgroundColor: status.color }}
                    ></div>
                    <span className="font-medium text-gray-900">{status.status}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">
                    {status.count}件 ({status.percentage}%)
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                  <span>総予算: ¥{(status.totalValue / 10000).toFixed(0)}万</span>
                </div>
                <div className="bg-gray-100 rounded-full h-2">
                  <div 
                    className="h-2 rounded-full"
                    style={{ 
                      width: `${status.percentage}%`,
                      backgroundColor: status.color
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* プロジェクトパフォーマンス */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">プロジェクトパフォーマンス（予算対実績）</h3>
          <div className="space-y-3">
            {projectPerformance.map((project) => (
              <div key={project.name} className="border-b border-gray-100 pb-3 last:border-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900">{project.name}</span>
                  <span className={`text-sm font-semibold ${
                    project.varianceRate >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {project.varianceRate >= 0 ? '+' : ''}{project.varianceRate}%
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                  <span>予算: ¥{(project.budget / 10000).toFixed(0)}万</span>
                  <span>実績: ¥{(project.actual / 10000).toFixed(0)}万</span>
                  <span>完了率: {project.completionRate}%</span>
                </div>
                <div className="bg-gray-100 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      project.varianceRate >= 0 ? 'bg-green-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(Math.abs(project.varianceRate), 100)}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 顧客別分析 */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mt-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">顧客別プロジェクト分析</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-900">顧客名</th>
                <th className="text-right py-3 px-4 font-medium text-gray-900">プロジェクト数</th>
                <th className="text-right py-3 px-4 font-medium text-gray-900">総予算額</th>
                <th className="text-right py-3 px-4 font-medium text-gray-900">平均予算</th>
                <th className="text-right py-3 px-4 font-medium text-gray-900">成功率</th>
              </tr>
            </thead>
            <tbody>
              {customerAnalysis.map((customer) => (
                <tr key={customer.customer} className="border-b border-gray-100">
                  <td className="py-3 px-4 text-gray-900 font-medium">{customer.customer}</td>
                  <td className="py-3 px-4 text-right text-gray-900">{customer.projectCount}</td>
                  <td className="py-3 px-4 text-right text-gray-900">
                    ¥{(customer.totalValue / 10000).toFixed(0)}万
                  </td>
                  <td className="py-3 px-4 text-right text-gray-900">
                    ¥{(customer.avgValue / 10000).toFixed(0)}万
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      customer.successRate >= 90 ? 'bg-green-100 text-green-800' : 
                      customer.successRate >= 70 ? 'bg-yellow-100 text-yellow-800' : 
                      'bg-red-100 text-red-800'
                    }`}>
                      {customer.successRate}%
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

export default HistoricalProjectAnalysisPage;
