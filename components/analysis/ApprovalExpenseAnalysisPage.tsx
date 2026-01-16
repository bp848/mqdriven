import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { FileText, Clock, CheckCircle, XCircle, AlertTriangle, TrendingUp, TrendingDown, Users } from 'lucide-react';
import { getSupabase } from '../../services/supabaseClient';

interface ApprovalData {
  month: string;
  pending: number;
  approved: number;
  rejected: number;
  totalAmount: number;
}

interface ExpenseCategory {
  name: string;
  amount: number;
  count: number;
  color: string;
}

interface DepartmentStats {
  name: string;
  pending: number;
  approved: number;
  avgProcessTime: number;
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

const ApprovalExpenseAnalysisPage: React.FC = () => {
  const [approvalData, setApprovalData] = useState<ApprovalData[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [departmentStats, setDepartmentStats] = useState<DepartmentStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'30d' | '90d' | '1y'>('30d');
  const [approvedChangePct, setApprovedChangePct] = useState<number | null>(null);
  const [rejectedChangePct, setRejectedChangePct] = useState<number | null>(null);

  useEffect(() => {
    fetchApprovalData();
  }, [timeRange]);

  const fetchApprovalData = async () => {
    try {
      setLoading(true);
      setError(null);
      const supabase = getSupabase();
      
      // 認証状態を確認
      const { data: authData } = await supabase.auth.getSession();
      if (!authData.session) {
        console.warn('[ApprovalExpenseAnalysis] 未認証状態');
        setError('認証が必要です。再度ログインしてください。');
        return;
      }
      
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

      console.log(`[ApprovalExpenseAnalysis] データ取得期間: ${prevStartDate.toISOString()} 〜 ${endDate.toISOString()}`);

      // 申請データを取得（過去データも含める）
      const { data: applications, error: applicationsError } = await supabase
        .from('applications')
        .select(`
          *,
          application_code:application_codes(name, code)
        `)
        .gte('created_at', prevStartDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .limit(1000); // limitを追加

      if (applicationsError) {
        console.error('申請データ取得エラー:', applicationsError);
        throw new Error(`申請データの取得に失敗しました: ${applicationsError.message}`);
      }

      console.log(`[ApprovalExpenseAnalysis] 取得件数: ${applications?.length || 0}件`);

      const currentApps = (applications || []).filter((app: any) => {
        const d = new Date(app.created_at);
        return d >= startDate && d <= endDate;
      });
      const prevApps = (applications || []).filter((app: any) => {
        const d = new Date(app.created_at);
        return d >= prevStartDate && d < startDate;
      });

      console.log(`[ApprovalExpenseAnalysis] 期間内データ: 現在${currentApps.length}件, 前期${prevApps.length}件`);

      // 月別承認状況データの集計
      const monthlyDataMap = new Map<string, { pending: number; approved: number; rejected: number; totalAmount: number }>();
      
      currentApps.forEach((app: any) => {
        const appDate = new Date(app.created_at);
        const month = appDate.toISOString().slice(0, 7); // YYYY-MM
        const current = monthlyDataMap.get(month) || { pending: 0, approved: 0, rejected: 0, totalAmount: 0 };

        if (app.status === 'pending_approval') current.pending++;
        else if (app.status === 'approved') current.approved++;
        else if (app.status === 'rejected') current.rejected++;

        if (app.form_data && typeof app.form_data === 'object') {
          const formData = app.form_data as any;
          if (formData.amount) current.totalAmount += Number(formData.amount) || 0;
        }

        monthlyDataMap.set(month, current);
      });

      const approvalData: ApprovalData[] = Array.from(monthlyDataMap.entries())
        .map(([month, data]) => ({ month, ...data }))
        .sort((a, b) => a.month.localeCompare(b.month));

      // 経費カテゴリー別データの集計
      const expenseCategoryMap = new Map<string, { amount: number; count: number }>();
      const categoryColors: Record<string, string> = {
        '出張旅費': '#3B82F6',
        '接待交際費': '#10B981',
        '消耗品費': '#F59E0B',
        '通信費': '#EF4444',
        '修繕費': '#8B5CF6',
        'その他': '#6B7280'
      };

      currentApps.forEach((app: any) => {
        if (app.form_data && typeof app.form_data === 'object') {
          const formData = app.form_data as any;
          if (formData.expenseCategory) {
            const category = formData.expenseCategory;
            const amount = Number(formData.amount) || 0;
            const current = expenseCategoryMap.get(category) || { amount: 0, count: 0 };
            expenseCategoryMap.set(category, {
              amount: current.amount + amount,
              count: current.count + 1,
            });
          }
        }
      });

      const expenseCategories: ExpenseCategory[] = Array.from(expenseCategoryMap.entries())
        .map(([name, data]) => ({
          name,
          ...data,
          color: categoryColors[name] || '#6B7280'
        }))
        .sort((a, b) => b.amount - a.amount);

      // 部署別統計データの集計
      const departmentMap = new Map<string, { pending: number; approved: number; totalProcessTime: number; count: number }>();
      
      currentApps.forEach((app: any) => {
        // 申請者情報を取得
        const applicantName = app.applicant?.name || app.applicant?.email || '不明';
        const department = applicantName; // 申請者名を部署として使用
        const current = departmentMap.get(department) || { pending: 0, approved: 0, totalProcessTime: 0, count: 0 };

        if (app.status === 'pending_approval') {
          current.pending++;
        } else if (app.status === 'approved') {
          current.approved++;
          if (app.submitted_at && app.approved_at) {
            const submitted = new Date(app.submitted_at);
            const approved = new Date(app.approved_at);
            const processTime = Math.ceil((approved.getTime() - submitted.getTime()) / (1000 * 60 * 60 * 24));
            current.totalProcessTime += processTime;
            current.count++;
          }
        }

        departmentMap.set(department, current);
      });

      const departmentStats: DepartmentStats[] = Array.from(departmentMap.entries())
        .map(([name, data]) => ({
          name,
          pending: data.pending,
          approved: data.approved,
          avgProcessTime: data.count > 0 ? Math.round(data.totalProcessTime / data.count * 10) / 10 : 0
        }))
        .sort((a, b) => b.approved - a.approved);

      setApprovalData(approvalData);
      setExpenseCategories(expenseCategories);
      setDepartmentStats(departmentStats);

      const countByStatus = (rows: any[], status: string) => rows.filter((r: any) => r.status === status).length;
      setApprovedChangePct(pctChange(countByStatus(currentApps, 'approved'), countByStatus(prevApps, 'approved')));
      setRejectedChangePct(pctChange(countByStatus(currentApps, 'rejected'), countByStatus(prevApps, 'rejected')));
    } catch (error) {
      console.error('承認・経費データの取得に失敗しました:', error);
      setError(error instanceof Error ? error.message : '承認・経費データの取得に失敗しました');
      setApprovalData([]);
      setExpenseCategories([]);
      setDepartmentStats([]);
      setApprovedChangePct(null);
      setRejectedChangePct(null);
    } finally {
      setLoading(false);
    }
  };

  const totalPending = approvalData.reduce((sum, month) => sum + month.pending, 0);
  const totalApproved = approvalData.reduce((sum, month) => sum + month.approved, 0);
  const totalRejected = approvalData.reduce((sum, month) => sum + month.rejected, 0);
  const totalAmount = approvalData.reduce((sum, month) => sum + month.totalAmount, 0);
  const approvalRate = totalPending + totalApproved > 0 ? (totalApproved / (totalPending + totalApproved)) * 100 : 0;
  const overallAvgProcessDays =
    departmentStats.length > 0
      ? Math.round((departmentStats.reduce((sum, d) => sum + d.avgProcessTime, 0) / departmentStats.length) * 10) / 10
      : 0;
  const mostPendingDept = departmentStats.reduce<{ name: string; pending: number } | null>((acc, d) => {
    if (!acc) return { name: d.name, pending: d.pending };
    return d.pending > acc.pending ? { name: d.name, pending: d.pending } : acc;
  }, null);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">承認・経費データを読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <h1 className="text-xl font-semibold text-red-900 mb-2">承認稟議・経費分析</h1>
          <p className="text-red-800 text-sm break-words">データ取得に失敗しました: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">承認稟議・経費分析</h1>
        <p className="text-gray-600">稟議承認状況、経費申請分析、承認フローの最適化</p>
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
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
            <div className="text-yellow-600 text-sm font-medium">
              承認待ち
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {totalPending}
          </div>
          <div className="text-sm text-gray-600 mt-1">件</div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div className={`flex items-center text-sm ${approvedChangePct === null ? 'text-gray-500' : approvedChangePct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {approvedChangePct !== null && (approvedChangePct >= 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />)}
              {formatDelta(approvedChangePct)}
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {totalApproved}
          </div>
          <div className="text-sm text-gray-600 mt-1">承認済み</div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-red-100 rounded-lg">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
            <div className={`flex items-center text-sm ${rejectedChangePct === null ? 'text-gray-500' : rejectedChangePct >= 0 ? 'text-red-600' : 'text-green-600'}`}>
              {rejectedChangePct !== null && (rejectedChangePct >= 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />)}
              {formatDelta(rejectedChangePct)}
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {totalRejected}
          </div>
          <div className="text-sm text-gray-600 mt-1">却下</div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex items-center text-green-600 text-sm">
              <TrendingUp className="w-4 h-4 mr-1" />
              {approvalRate.toFixed(1)}%
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            ¥{(totalAmount / 10000).toFixed(0)}万
          </div>
          <div className="text-sm text-gray-600 mt-1">総申請額</div>
        </div>
      </div>

      {/* チャートエリア */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* 承認トレンド */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">月別承認状況</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={approvalData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="pending" fill="#F59E0B" name="承認待ち" />
              <Bar dataKey="approved" fill="#10B981" name="承認済み" />
              <Bar dataKey="rejected" fill="#EF4444" name="却下" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 経費カテゴリー別 */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">経費カテゴリー別</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={expenseCategories.map(cat => ({ ...cat, value: cat.amount, name: cat.name }))}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="value"
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
      </div>

      {/* 部署別統計と詳細 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 部署別統計 */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">部署別承認状況</h3>
          <div className="space-y-4">
            {departmentStats.map((dept) => (
              <div key={dept.name} className="border-b border-gray-100 pb-3 last:border-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900">{dept.name}</span>
                  <div className="flex items-center text-sm text-gray-600">
                    <Users className="w-4 h-4 mr-1" />
                    平均{dept.avgProcessTime}日
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center text-sm">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></div>
                    <span className="text-gray-700">待ち: {dept.pending}</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                    <span className="text-gray-700">承認: {dept.approved}</span>
                  </div>
                </div>
                <div className="mt-2 bg-gray-100 rounded-full h-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full"
                    style={{ 
                      width: `${(dept.approved / (dept.pending + dept.approved)) * 100}%` 
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 承認済み申請詳細リスト */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">承認済み申請詳細（最新20件）</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-900">申請日</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">申請者</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">会社名</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">金額</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">カテゴリー</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">承認日</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {currentApps
                  .filter((app: any) => app.status === 'approved')
                  .sort((a: any, b: any) => new Date(b.approved_at).getTime() - new Date(a.approved_at).getTime())
                  .slice(0, 20)
                  .map((app: any) => {
                    const formData = app.form_data as any;
                    const amount = Number(formData.amount || formData.totalGross || formData.invoice?.totalGross || 0);
                    const supplierName = formData.supplierName || formData.companyName || '-';
                    const applicantName = app.applicant?.name || app.applicant?.email || '不明';
                    
                    return (
                      <tr key={app.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4">{new Date(app.approved_at).toLocaleDateString('ja-JP')}</td>
                        <td className="py-3 px-4">{applicantName}</td>
                        <td className="py-3 px-4">{supplierName}</td>
                        <td className="py-3 px-4 text-right font-mono">¥{amount.toLocaleString()}</td>
                        <td className="py-3 px-4">{formData.expenseCategory || '-'}</td>
                        <td className="py-3 px-4">{new Date(app.approved_at).toLocaleDateString('ja-JP')}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 経費カテゴリー詳細 */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">経費カテゴリー詳細</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-900">カテゴリー</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-900">金額</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-900">件数</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-900">平均</th>
                </tr>
              </thead>
              <tbody>
                {expenseCategories.map((category) => (
                  <tr key={category.name} className="border-b border-gray-100">
                    <td className="py-3 px-4 text-gray-900">{category.name}</td>
                    <td className="py-3 px-4 text-right text-gray-900">
                      ¥{(category.amount / 10000).toFixed(1)}万
                    </td>
                    <td className="py-3 px-4 text-right text-gray-900">{category.count}</td>
                    <td className="py-3 px-4 text-right text-gray-900">
                      ¥{Math.round(category.amount / category.count).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* アラート */}
      <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-xl p-6">
        <div className="flex items-start space-x-3">
          <AlertTriangle className="w-6 h-6 text-yellow-600 mt-1" />
          <div>
            <h3 className="text-lg font-semibold text-yellow-900 mb-2">承認待ち案件の注意事項</h3>
            <ul className="text-sm text-yellow-800 space-y-1">
              <li>• 現在 {totalPending} 件の承認待ち案件があります</li>
              <li>• 平均承認処理時間は {overallAvgProcessDays} 日です</li>
              {mostPendingDept && <li>• 承認待ち案件が最も多い部署: {mostPendingDept.name}（{mostPendingDept.pending}件）</li>}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApprovalExpenseAnalysisPage;
