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
  department: string; // 表示ラベル（顧客/部署など）
  target: number; // 前期間
  actual: number; // 当期間
  achievement: number; // 当期間/前期間 (%)
  color: string;
}

interface KPIData {
  title: string;
  value: string;
  change: number | null;
  icon: React.ReactNode;
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

const BusinessPlanPage: React.FC = () => {
  const [businessPlanData, setBusinessPlanData] = useState<BusinessPlanData[]>([]);
  const [departmentGoals, setDepartmentGoals] = useState<DepartmentGoal[]>([]);
  const [kpiData, setKpiData] = useState<KPIData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'30d' | '90d' | '1y'>('90d');

  useEffect(() => {
    fetchBusinessPlanData();
  }, [timeRange]);

  const fetchBusinessPlanData = async () => {
    try {
      setLoading(true);
      setError(null);
      const supabase = getSupabase();
      
      // データ取得期間を計算（前期間も含めて取得）
      const endDate = new Date();
      const startDate = new Date();
      if (timeRange === '30d') {
        startDate.setDate(endDate.getDate() - 30);
      } else if (timeRange === '90d') {
        startDate.setDate(endDate.getDate() - 90);
      } else {
        startDate.setFullYear(endDate.getFullYear() - 1);
      }
      const days = timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365;
      const prevStartDate = new Date(startDate);
      prevStartDate.setDate(prevStartDate.getDate() - days);

      // 見積データから実績を取得（前期間も含む）
      const { data: estimates, error: estimatesError } = await supabase
        .from('estimates')
        .select('create_date,total,project_id')
        .gte('create_date', prevStartDate.toISOString())
        .lte('create_date', endDate.toISOString())
        .in('status', ['1', '2']);

      if (estimatesError) {
        console.error('実績データ取得エラー:', estimatesError);
        throw estimatesError;
      }

      const currentEstimates = (estimates || []).filter((e: any) => {
        const d = new Date(e.create_date);
        return d >= startDate && d <= endDate;
      });
      const prevEstimates = (estimates || []).filter((e: any) => {
        const d = new Date(e.create_date);
        return d >= prevStartDate && d < startDate;
      });

      // 月別（当期間 vs 前期間）
      const monthlyActual = new Map<string, number>();
      const monthlyPrev = new Map<string, number>();
      const sumByMonth = (rows: any[], map: Map<string, number>) => {
        rows.forEach((e: any) => {
          const month = new Date(e.create_date).toISOString().slice(0, 7);
          map.set(month, (map.get(month) || 0) + (Number(e.total) || 0));
        });
      };
      sumByMonth(currentEstimates, monthlyActual);
      sumByMonth(prevEstimates, monthlyPrev);

      const allMonths = Array.from(new Set([...monthlyActual.keys(), ...monthlyPrev.keys()])).sort((a, b) => a.localeCompare(b));
      const businessPlanData: BusinessPlanData[] = allMonths.map((month) => {
        const actual = monthlyActual.get(month) || 0;
        const target = monthlyPrev.get(month) || 0;
        const achievement = target > 0 ? Math.round((actual / target) * 100) : 0;
        return { month, target, actual, achievement };
      });

      // 顧客（上位）: projects→customers で名称解決
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

      const customerTotals = new Map<string, { current: number; prev: number }>();
      const addCustomerTotal = (row: any, key: 'current' | 'prev') => {
        const customerId = row.project_id ? projectCustomerMap.get(row.project_id) : null;
        if (!customerId) return;
        const current = customerTotals.get(customerId) || { current: 0, prev: 0 };
        current[key] += Number(row.total) || 0;
        customerTotals.set(customerId, current);
      };
      currentEstimates.forEach((e: any) => addCustomerTotal(e, 'current'));
      prevEstimates.forEach((e: any) => addCustomerTotal(e, 'prev'));

      const customerIds = Array.from(customerTotals.keys());
      const customerNameMap = new Map<string, string>();
      if (customerIds.length) {
        const { data: customers, error: customersError } = await supabase
          .from('customers')
          .select('id,customer_name')
          .in('id', customerIds);
        if (customersError) {
          console.error('顧客取得エラー:', customersError);
          throw customersError;
        }
        (customers || []).forEach((c: any) => {
          if (c?.id) customerNameMap.set(c.id, c.customer_name || c.id);
        });
      }

      const customerGoals: DepartmentGoal[] = customerIds
        .map((id) => {
          const totals = customerTotals.get(id)!;
          const achievement = totals.prev > 0 ? Math.round((totals.current / totals.prev) * 100) : 0;
          return {
            department: customerNameMap.get(id) || id,
            target: totals.prev,
            actual: totals.current,
            achievement,
            color: '#3B82F6',
          };
        })
        .sort((a, b) => b.actual - a.actual)
        .slice(0, 8);

      // KPIデータの計算
      const sumSales = (rows: any[]) => rows.reduce((sum, r) => sum + (Number(r.total) || 0), 0);
      const currentSales = sumSales(currentEstimates);
      const prevSales = sumSales(prevEstimates);
      const salesDelta = pctChange(currentSales, prevSales);
      const currentOrders = currentEstimates.length;
      const prevOrders = prevEstimates.length;
      const ordersDelta = pctChange(currentOrders, prevOrders);
      const uniqCustomerCount = (rows: any[]) => {
        const set = new Set<string>();
        rows.forEach((r: any) => {
          const customerId = r.project_id ? projectCustomerMap.get(r.project_id) : null;
          if (customerId) set.add(customerId);
        });
        return set.size;
      };
      const currentCustomers = uniqCustomerCount(currentEstimates);
      const prevCustomers = uniqCustomerCount(prevEstimates);
      const customerDelta = pctChange(currentCustomers, prevCustomers);
      const topCustomerSales = customerGoals[0]?.actual || 0;
      const topCustomerShare = currentSales > 0 ? Math.round((topCustomerSales / currentSales) * 100) : 0;

      const kpiData: KPIData[] = [
        {
          title: '期間売上',
          value: `¥${Math.round(currentSales / 10000).toLocaleString()}万`,
          change: salesDelta,
          icon: <DollarSign className="w-6 h-6" />,
          color: 'text-blue-600',
        },
        {
          title: '受注件数',
          value: `${currentOrders.toLocaleString()}件`,
          change: ordersDelta,
          icon: <Target className="w-6 h-6" />,
          color: 'text-green-600',
        },
        {
          title: '顧客数',
          value: `${currentCustomers.toLocaleString()}社`,
          change: customerDelta,
          icon: <Users className="w-6 h-6" />,
          color: 'text-purple-600',
        },
        {
          title: 'トップ顧客比率',
          value: `${topCustomerShare}%`,
          change: null,
          icon: <CheckCircle className="w-6 h-6" />,
          color: 'text-orange-600',
        },
      ];

      setBusinessPlanData(businessPlanData);
      setDepartmentGoals(customerGoals);
      setKpiData(kpiData);
    } catch (error) {
      console.error('経営計画データの取得に失敗しました:', error);
      setError(error instanceof Error ? error.message : '経営計画データの取得に失敗しました');
      setBusinessPlanData([]);
      setDepartmentGoals([]);
      setKpiData([]);
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

  if (error) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <h1 className="text-xl font-semibold text-red-900 mb-2">経営計画</h1>
          <p className="text-red-800 text-sm break-words">データ取得に失敗しました: {error}</p>
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
              <div className={`flex items-center text-sm ${kpi.change === null ? 'text-gray-500' : kpi.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {kpi.change !== null && (kpi.change >= 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />)}
                {kpi.change === null ? '—' : formatDelta(kpi.change)}
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{kpi.value}</div>
            <div className="text-sm text-gray-600 mt-1">{kpi.title}</div>
          </div>
        ))}
      </div>

      {/* チャートエリア */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* 当期間 vs 前期間 */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">売上推移（当期間 / 前期間）</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={businessPlanData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => `¥${Number(value).toLocaleString()}`} />
              <Legend />
              <Line type="monotone" dataKey="target" stroke="#94A3B8" strokeWidth={2} name="前期間" />
              <Line type="monotone" dataKey="actual" stroke="#10B981" strokeWidth={2} name="当期間" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* 前期間比 */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">月別 前期間比</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={businessPlanData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => `${value}%`} />
              <Legend />
              <Bar dataKey="achievement" fill="#3B82F6" name="前期間比" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 上位顧客（当期間 vs 前期間） */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">上位顧客（当期間 / 前期間）</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={departmentGoals} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="department" type="category" width={80} />
                <Tooltip formatter={(value) => `${value}%`} />
                <Legend />
                <Bar dataKey="achievement" fill="#10B981" name="前期間比" />
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
                  <span>前期間: ¥{(dept.target / 10000).toFixed(0)}万</span>
                  <span>当期間: ¥{(dept.actual / 10000).toFixed(0)}万</span>
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
