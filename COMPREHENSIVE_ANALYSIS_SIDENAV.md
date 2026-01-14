# 包括的分析サイドナビ実装計画

## 📊 要件分析

### 🎯 目的
- **統合的ダッシュボード**: 販売、経費、プロジェクト、顧客などを一元管理
- **リアルタイム分析**: 現在のビジネス状況を多角的に可視化
- **意思決定支援**: データに基づいた迅速な経営判断を可能に

### 🔍 必要な機能

#### 1. データ集計領域
- **販売分析**: 売上、受注、顧客別売上
- **経費管理**: 経費申請、承認済、会計処理状況
- **プロジェクト管理**: 進捗状況、予算vs実績、利益率
- **顧客分析**: 顧客別収益性、ランク付け、継続率
- **在庫管理**: 在庫状況、発注状況、在庫回転率
- **仕訳管理**: 売上原価、利益率分析

#### 2. 分析機能
- **時系列分析**: 月次・四半期・年次の推移
- **比較分析**: 前年同期比較、予算達成率
- **構成比分析**: 品目別・顧客別・地域別構成
- **相関分析**: 販売と経費の相関、季節変動分析

#### 3. UI/UX要件
- **レスポンシブデザイン**: モバイル・タブレット対応
- **インタラクティブな操作**: ドラッグ＆ドロップ、フィルタリング
- **リアルタイム更新**: WebSocketによる自動更新
- **エクスポート機能**: PDF、Excel、CSV形式での出力

## 🎯 実装計画

### フェーズ1: 基盤整備（1-2週間）

#### 1.1 データベース設計
```sql
-- 統合分析ビューの作成
CREATE OR REPLACE VIEW public.comprehensive_analysis_dashboard AS
WITH 
-- 販売集計
sales_summary AS (
    SELECT 
        DATE_TRUNC(created_at, 'month') as analysis_month,
        COUNT(*) as total_orders,
        SUM(total_amount) as total_sales,
        AVG(total_amount) as avg_order_value,
        COUNT(DISTINCT customer_id) as unique_customers
    FROM public.orders
    WHERE created_at >= CURRENT_DATE - INTERVAL '12 months'
    GROUP BY DATE_TRUNC(created_at, 'month')
),

-- 経費集計
expense_summary AS (
    SELECT 
        DATE_TRUNC(created_at, 'month') as analysis_month,
        COUNT(*) as total_expenses,
        SUM(amount) as total_expense_amount,
        AVG(amount) as avg_expense_value,
        COUNT(DISTINCT applicant_id) as unique_applicants
    FROM public.expense_requests
    WHERE status = 'approved'
    AND created_at >= CURRENT_DATE - INTERVAL '12 months'
    GROUP BY DATE_TRUNC(created_at, 'month')
),

-- プロジェクト集計
project_summary AS (
    SELECT 
        DATE_TRUNC(updated_at, 'month') as analysis_month,
        COUNT(*) as active_projects,
        SUM(budget_sales) as total_budget,
        SUM(total_cost) as total_cost,
        AVG(budget_sales) as avg_project_value
    FROM public.projects
    WHERE updated_at >= CURRENT_DATE - INTERVAL '12 months'
    GROUP BY DATE_TRUNC(updated_at, 'month')
)

-- 最終統合
SELECT 
    ss.analysis_month,
    ss.total_orders,
    ss.total_sales,
    ss.avg_order_value,
    ss.unique_customers,
    COALESCE(es.total_expenses, 0) as total_expenses,
    COALESCE(es.total_expense_amount, 0) as total_expense_amount,
    COALESCE(es.avg_expense_value, 0) as avg_expense_value,
    COALESCE(es.unique_applicants, 0) as unique_applicants,
    ps.active_projects,
    COALESCE(ps.total_budget, 0) as total_budget,
    COALESCE(ps.total_cost, 0) as total_cost,
    COALESCE(ps.avg_project_value, 0) as avg_project_value,
    (COALESCE(ss.total_sales, 0) - COALESCE(es.total_expense_amount, 0)) as net_profit,
    CASE 
        WHEN COALESCE(es.total_expense_amount, 0) > 0 
        THEN ROUND((COALESCE(ss.total_sales, 0) / COALESCE(es.total_expense_amount, 0)) * 100, 2)
        ELSE NULL 
    END as expense_ratio
FROM sales_summary ss
FULL OUTER JOIN expense_summary es ON ss.analysis_month = es.analysis_month
FULL OUTER JOIN project_summary ps ON ss.analysis_month = ps.analysis_month
ORDER BY ss.analysis_month DESC;
```

#### 1.2 APIサービスの実装
```typescript
// services/analysisService.ts
export const getComprehensiveAnalysisData = async (
    period: 'current_month' | 'quarter' | 'year' = 'current_month',
    startDate?: string,
    endDate?: string
): Promise<ComprehensiveAnalysisData[]> => {
    const supabase = getSupabase();
    
    let dateFilter = '';
    if (period === 'current_month') {
        dateFilter = 'AND DATE_TRUNC(created_at, \'month\') = DATE_TRUNC(CURRENT_DATE, \'month\')';
    } else if (period === 'quarter') {
        dateFilter = 'AND DATE_TRUNC(created_at, \'quarter\') = DATE_TRUNC(CURRENT_DATE, \'quarter\')';
    } else if (period === 'year') {
        dateFilter = 'AND DATE_TRUNC(created_at, \'year\') = DATE_TRUNC(CURRENT_DATE, \'year\')';
    }
    
    if (startDate && endDate) {
        dateFilter += ` AND created_at BETWEEN '${startDate}' AND '${endDate}'`;
    }
    
    const { data, error } = await supabase
        .from('comprehensive_analysis_dashboard')
        .select('*')
        .order('analysis_month', { ascending: false });
    
    if (error) {
        throw formatSupabaseError('Failed to fetch comprehensive analysis data', error);
    }
    
    return data || [];
};
```

### フェーズ2: コア機能実装（2-4週間）

#### 2.1 統合ダッシュボードコンポーネント
```typescript
// components/analysis/ComprehensiveAnalysisDashboard.tsx
const ComprehensiveAnalysisDashboard: React.FC = () => {
    const [data, setData] = useState<ComprehensiveAnalysisData[]>([]);
    const [period, setPeriod] = useState<'current_month' | 'quarter' | 'year'>('current_month');
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                const analysisData = await getComprehensiveAnalysisData(period);
                setData(analysisData);
            } catch (err) {
                console.error('Failed to load analysis data:', err);
            } finally {
                setLoading(false);
            }
        };
        
        loadData();
    }, [period]);
    
    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow">
                <h2 className="text-2xl font-bold mb-4">包括的分析ダッシュボード</h2>
                
                {/* 期間選択 */}
                <div className="flex gap-4 mb-6">
                    <select 
                        value={period}
                        onChange={(e) => setPeriod(e.target.value as any)}
                        className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg"
                    >
                        <option value="current_month">今月</option>
                        <option value="quarter">四半期</option>
                        <option value="year">年間</option>
                    </select>
                </div>
                
                {/* 主要KPIカード */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <KPICard 
                        title="総売上" 
                        value={data[0]?.total_sales || 0} 
                        format="currency"
                        trend={calculateTrend(data, 'total_sales')}
                    />
                    <KPICard 
                        title="総経費" 
                        value={data[0]?.total_expense_amount || 0} 
                        format="currency"
                        trend={calculateTrend(data, 'total_expense_amount')}
                    />
                    <KPICard 
                        title="純利益" 
                        value={data[0]?.net_profit || 0} 
                        format="currency"
                        trend={calculateTrend(data, 'net_profit')}
                    />
                    <KPICard 
                        title="利益率" 
                        value={data[0]?.expense_ratio || 0} 
                        format="percentage"
                        trend={calculateTrend(data, 'expense_ratio')}
                    />
                </div>
                
                {/* チャートエリア */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow">
                        <h3 className="text-lg font-semibold mb-4">売上・経費推移</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={data}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="analysis_month" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Line type="monotone" dataKey="total_sales" stroke="#2563eb" name="売上" />
                                <Line type="monotone" dataKey="total_expense_amount" stroke="#ef4444" name="経費" />
                                <Line type="monotone" dataKey="net_profit" stroke="#22c55e" name="純利益" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                    
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow">
                        <h3 className="text-lg font-semibold mb-4">構成比分析</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={[
                                        { name: '売上', value: data[0]?.total_sales || 0, fill: '#2563eb' },
                                        { name: '経費', value: data[0]?.total_expense_amount || 0, fill: '#ef4444' },
                                        { name: '純利益', value: data[0]?.net_profit || 0, fill: '#22c55e' }
                                    ]}
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={80}
                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                >
                                    <Tooltip />
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};
```

#### 2.2 KPIカードコンポーネント
```typescript
// components/analysis/KPICard.tsx
interface KPICardProps {
    title: string;
    value: number;
    format: 'currency' | 'percentage' | 'number';
    trend?: 'up' | 'down' | 'stable';
}

const KPICard: React.FC<KPICardProps> = ({ title, value, format, trend }) => {
    const formatValue = (val: number) => {
        switch (format) {
            case 'currency':
                return new Intl.NumberFormat('ja-JP', {
                    style: 'currency',
                    currency: 'JPY'
                }).format(val);
            case 'percentage':
                return `${val.toFixed(1)}%`;
            case 'number':
                return val.toLocaleString();
            default:
                return val.toString();
        }
    };
    
    const getTrendIcon = () => {
        switch (trend) {
            case 'up':
                return <span className="text-green-500">↑</span>;
            case 'down':
                return <span className="text-red-500">↓</span>;
            default:
                return <span className="text-gray-500">→</span>;
        }
    };
    
    return (
        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="flex justify-between items-center">
                <div>
                    <h4 className="text-sm font-medium text-slate-600 dark:text-slate-400">{title}</h4>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                        {formatValue(value)}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {trend && getTrendIcon()}
                    <span className={`text-sm ${
                        trend === 'up' ? 'text-green-600' :
                        trend === 'down' ? 'text-red-600' :
                        'text-gray-600'
                    }`}>
                        {trend === 'up' ? '増加' : trend === 'down' ? '減少' : '安定'}
                    </span>
                </div>
            </div>
        </div>
    );
};
```

### フェーズ3: 高度な機能（4-6週間）

#### 3.1 リアルタイム更新機能
```typescript
// WebSocketによるリアルタイム更新
const useRealTimeAnalysis = () => {
    const [data, setData] = useState<ComprehensiveAnalysisData[]>([]);
    
    useEffect(() => {
        const ws = new WebSocket('wss://your-api.com/analysis');
        
        ws.onmessage = (event) => {
            const updatedData = JSON.parse(event.data);
            setData(updatedData);
        };
        
        ws.onclose = () => {
            // 再接続ロジック
            setTimeout(() => {
                const ws = new WebSocket('wss://your-api.com/analysis');
                // WebSocket再接続
            }, 5000);
        };
        
        return () => {
            ws.close();
        };
    }, []);
    
    return data;
};
```

#### 3.2 エクスポート機能
```typescript
// PDF/Excelエクスポート機能
const exportAnalysisReport = async (
    format: 'pdf' | 'excel' | 'csv',
    period: 'current_month' | 'quarter' | 'year'
) => {
    const data = await getComprehensiveAnalysisData(period);
    
    if (format === 'pdf') {
        await generatePDFReport(data);
    } else if (format === 'excel') {
        await generateExcelReport(data);
    } else if (format === 'csv') {
        await generateCSVReport(data);
    }
};
```

## 🚀 実行スケジュール

### 週次実行計画

#### 週1-2: 基盤整備
- データベースビューの作成とテスト
- APIサービスの実装
- 基本的なコンポーネントの作成

#### 週3-4: コア機能実装
- 統合ダッシュボードの完成
- KPIカードコンポーネントの実装
- チャート機能の実装
- 基本的なテストとデバッグ

#### 週5-6: 高度な機能
- リアルタイム更新機能の実装
- エクスポート機能の追加
- パフォーマンスの最適化
- 本格テストとユーザー受け入れ

## 💡 期待される効果

- ✅ **統合的経営管理**: 販売・経費・プロジェクトを一元で管理可能
- ✅ **リアルタイム分析**: 現在のビジネス状況を即座に把握
- ✅ **意思決定支援**: データに基づいた迅速な経営判断
- ✅ **業務効率の向上**: 手動集計作業の自動化による時間削減
- ✅ **拡張性の確保**: 将来の機能追加に対応可能な構造

これにより**包括的分析サイドナビが実装され、経営管理の質と効率が大幅に向上します**。
