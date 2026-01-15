import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { Target, TrendingUp, TrendingDown, DollarSign, Users, Calendar, CheckCircle } from 'lucide-react';
import { getSupabase } from '../../services/supabaseClient';

interface BusinessPlanData {
  month: string;
  target: number;
  actual: number;
  achievement: number;
}

interface DepartmentGoal {
  department: string;
  target: number;
  actual: number;
  achievement: number;
  color: string;
}

interface KPIData {
  title: string;
  value: string;
  change: number;
  icon: React.ReactNode;
  color: string;
}

const BusinessPlanPage: React.FC = () => {
  const [businessPlanData, setBusinessPlanData] = useState<BusinessPlanData[]>([]);
  const [departmentGoals, setDepartmentGoals] = useState<DepartmentGoal[]>([]);
  const [kpiData, setKpiData] = useState<KPIData[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'30d' | '90d' | '1y'>('90d');

  useEffect(() => {
    fetchBusinessPlanData();
  }, [timeRange]);

  const fetchBusinessPlanData = async () => {
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

      // 見積データから実績を取得
      const { data: estimates, error: estimatesError } = await supabase
        .from('estimates')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .in('status', ['approved', 'accepted']);

      if (estimatesError) {
        console.error('実績データ取得エラー:', estimatesError);
        throw estimatesError;
      }

      // 月別目標対実績データの集計
      const monthlyDataMap = new Map<string, { target: number; actual: number }>();
      
      // 過去6ヶ月分の目標データ（ダミー）
      const monthlyTargets = {
        '2024-08': 5000000,
        '2024-09': 5200000,
        '2024-10': 5500000,
        '2024-11': 5800000,
        '2024-12': 6000000,
        '2025-01': 6200000,
      };

      estimates?.forEach(estimate => {
        const month = new Date(estimate.created_at).toISOString().slice(0, 7); // YYYY-MM
        const current = monthlyDataMap.get(month) || { target: monthlyTargets[month as keyof typeof monthlyTargets] || 0, actual: 0 };
        monthlyDataMap.set(month, {
          target: current.target,
          actual: current.actual + (estimate.total || 0)
        });
      });

      const businessPlanData: BusinessPlanData[] = Array.from(monthlyDataMap.entries())
        .map(([month, data]) => ({
          month,
          target: data.target,
          actual: data.actual,
          achievement: data.target > 0 ? Math.round((data.actual / data.target) * 100) : 0
        }))
        .sort((a, b) => a.month.localeCompare(b.month));

      // 部署別目標達成率
      const departmentMap = new Map<string, { target: number; actual: number }>();
      const departmentTargets = {
        '営業部': 3000000,
        '技術部': 1500000,
        '管理部': 1000000,
        '製造部': 700000,
      };

      estimates?.forEach(estimate => {
        // 仮の部署割り当て（実際はユーザー情報から取得）
        const department = estimate.userId ? '営業部' : '技術部';
        const current = departmentMap.get(department) || { target: departmentTargets[department as keyof typeof departmentTargets] || 0, actual: 0 };
        departmentMap.set(department, {
          target: current.target,
          actual: current.actual + (estimate.total || 0)
        });
      });

      const departmentColors = {
        '営業部': '#3B82F6',
        '技術部': '#10B981',
        '管理部': '#F59E0B',
        '製造部': '#EF4444',
      };

      const departmentGoals: DepartmentGoal[] = Array.from(departmentMap.entries())
        .map(([department, data]) => ({
          department,
          target: data.target,
          actual: data.actual,
          achievement: data.target > 0 ? Math.round((data.actual / data.target) * 100) : 0,
          color: departmentColors[department as keyof typeof departmentColors] || '#6B7280'
        }))
        .sort((a, b) => b.achievement - a.achievement);

      // KPIデータの計算
      const totalTarget = Array.from(monthlyDataMap.values()).reduce((sum, data) => sum + data.target, 0);
      const totalActual = Array.from(monthlyDataMap.values()).reduce((sum, data) => sum + data.actual, 0);
      const overallAchievement = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0;

      const kpiData: KPIData[] = [
        {
          title: '全体目標達成率',
          value: `${overallAchievement}%`,
          change: overallAchievement - 95, // 前月比（仮）
          icon: <Target className="w-6 h-6" />,
          color: overallAchievement >= 100 ? 'text-green-600' : overallAchievement >= 80 ? 'text-yellow-600' : 'text-red-600'
        },
        {
          title: '月間売上目標',
          value: `¥${(totalTarget / 12 / 10000).toFixed(0)}万`,
          change: 5.2,
          icon: <DollarSign className="w-6 h-6" />,
          color: 'text-blue-600'
        },
        {
          title: '達成部署数',
          value: `${departmentGoals.filter(d => d.achievement >= 100).length}/${departmentGoals.length}`,
          change: 1,
          icon: <CheckCircle className="w-6 h-6" />,
          color: 'text-purple-600'
        },
        {
          title: '平均達成率',
          value: `${Math.round(departmentGoals.reduce((sum, d) => sum + d.achievement, 0) / departmentGoals.length)}%`,
          change: -2.1,
          icon: <TrendingUp className="w-6 h-6" />,
          color: 'text-orange-600'
        }
      ];

      setBusinessPlanData(businessPlanData);
      setDepartmentGoals(departmentGoals);
      setKpiData(kpiData);
    } catch (error) {
      console.error('経営計画データの取得に失敗しました:', error);
      // エラー時はダミーデータを表示
      const mockBusinessPlanData: BusinessPlanData[] = [
        { month: '2024-08', target: 5000000, actual: 4800000, achievement: 96 },
        { month: '2024-09', target: 5200000, actual: 5400000, achievement: 104 },
        { month: '2024-10', target: 5500000, actual: 5100000, achievement: 93 },
        { month: '2024-11', target: 5800000, actual: 6200000, achievement: 107 },
        { month: '2024-12', target: 6000000, actual: 5800000, achievement: 97 },
        { month: '2025-01', target: 6200000, actual: 5900000, achievement: 95 },
      ];

      const mockDepartmentGoals: DepartmentGoal[] = [
        { department: '営業部', target: 3000000, actual: 3200000, achievement: 107, color: '#3B82F6' },
        { department: '技術部', target: 1500000, actual: 1400000, achievement: 93, color: '#10B981' },
        { department: '管理部', target: 1000000, actual: 950000, achievement: 95, color: '#F59E0B' },
        { department: '製造部', target: 700000, actual: 350000, achievement: 50, color: '#EF4444' },
      ];

      const mockKpiData: KPIData[] = [
        { title: '全体目標達成率', value: '95%', change: -2.1, icon: <Target className="w-6 h-6" />, color: 'text-yellow-600' },
        { title: '月間売上目標', value: '¥517万', change: 5.2, icon: <DollarSign className="w-6 h-6" />, color: 'text-blue-600' },
        { title: '達成部署数', value: '2/4', change: 1, icon: <CheckCircle className="w-6 h-6" />, color: 'text-purple-600' },
        { title: '平均達成率', value: '86%', change: -2.1, icon: <TrendingUp className="w-6 h-6" />, color: 'text-orange-600' }
      ];

      setBusinessPlanData(mockBusinessPlanData);
      setDepartmentGoals(mockDepartmentGoals);
      setKpiData(mockKpiData);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">経営計画データを読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">経営計画</h1>
        <p className="text-gray-600">事業計画、予算管理、目標達成状況の分析</p>
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
        {kpiData.map((kpi, index) => (
          <div key={index} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <div className={kpi.color}>{kpi.icon}</div>
              </div>
              <div className={`flex items-center text-sm ${kpi.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {kpi.change >= 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                {Math.abs(kpi.change)}%
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{kpi.value}</div>
            <div className="text-sm text-gray-600 mt-1">{kpi.title}</div>
          </div>
        ))}
      </div>

      {/* チャートエリア */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* 目標対実績トレンド */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">目標対実績トレンド</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={businessPlanData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => `¥${Number(value).toLocaleString()}`} />
              <Legend />
              <Line type="monotone" dataKey="target" stroke="#EF4444" strokeWidth={2} name="目標" />
              <Line type="monotone" dataKey="actual" stroke="#10B981" strokeWidth={2} name="実績" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* 達成率トレンド */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">月別達成率</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={businessPlanData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => `${value}%`} />
              <Legend />
              <Bar dataKey="achievement" fill="#3B82F6" name="達成率" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 部署別目標達成状況 */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">部署別目標達成状況</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={departmentGoals} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="department" type="category" width={80} />
                <Tooltip formatter={(value) => `${value}%`} />
                <Legend />
                <Bar dataKey="achievement" fill="#10B981" name="達成率" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-4">
            {departmentGoals.map((dept) => (
              <div key={dept.department} className="border-b border-gray-100 pb-3 last:border-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900">{dept.department}</span>
                  <span className={`text-sm font-semibold ${
                    dept.achievement >= 100 ? 'text-green-600' : 
                    dept.achievement >= 80 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {dept.achievement}%
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                  <span>目標: ¥{(dept.target / 10000).toFixed(0)}万</span>
                  <span>実績: ¥{(dept.actual / 10000).toFixed(0)}万</span>
                </div>
                <div className="bg-gray-100 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      dept.achievement >= 100 ? 'bg-green-500' : 
                      dept.achievement >= 80 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(dept.achievement, 100)}%` }}
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

export default BusinessPlanPage;
