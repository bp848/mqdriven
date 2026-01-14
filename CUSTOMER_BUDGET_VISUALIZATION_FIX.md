# 顧客別案件予算見える化修正指示書

## 問題分析

### 現状確認
- ✅ **projectsテーブル**: データ存在（1000件以上）
- ✅ **customersテーブル**: データ存在（219件以上）  
- ❌ **projects_v2テーブル**: 空っぽ（0件）
- ❌ **PostgRESTリレーション**: 外部キー制約未設定
- ❌ **顧客別予算集計**: 正しく機能していない

### 根本原因
1. **リレーションシップ未確立**: projects→customersの外部キーがない
2. **集計ロジック不完全**: 顧客別の予算集計が正しく実装されていない
3. **ビュー依存**: estimates_list_viewなどが存在しないか空

## 解決策

### 方案1: 外部キー制約追加＋顧客別集計ビュー作成（推奨）

**手順:**
1. 外部キー制約を追加
2. 顧客別予算集計ビューを作成
3. フロントエンドでビューを参照

### 方案2: 既存テーブルでの手動集計（即時対応）

**手順:**
1. コード内で手動JOINを実装
2. 顧客別にデータをグループ化
3. 集計ロジックを強化

## 実装コード

### 1. 顧客別予算集計サービス関数

```typescript
// services/dataService.tsに追加
export const getCustomerBudgetSummaries = async (): Promise<CustomerBudgetSummary[]> => {
    const supabase = getSupabase();
    
    try {
        // 方案1: 顧客別予算ビューを使用
        const { data, error } = await supabase
            .from('customer_budget_summary_view')
            .select('*')
            .order('total_budget', { ascending: false });
        
        if (!error && data && data.length > 0) {
            return data.map(mapCustomerBudgetSummary);
        }
    } catch (err) {
        console.warn('Customer budget view not available, using fallback:', err.message);
    }
    
    // 方案2: 手動集計
    return await calculateCustomerBudgetsManually();
};

const calculateCustomerBudgetsManually = async (): Promise<CustomerBudgetSummary[]> => {
    const supabase = getSupabase();
    
    // プロジェクトと顧客データを取得
    const [projects, customers] = await Promise.all([
        supabase.from('projects').select('*'),
        supabase.from('customers').select('*')
    ]);
    
    // 注文データを取得
    const { data: orders } = await supabase
        .from('orders')
        .select('*')
        .in('project_id', projects.map(p => p.id));
    
    // 顧客別にデータを集計
    const customerMap = new Map();
    customers.forEach(customer => {
        customerMap.set(customer.id, customer);
        if (customer.customer_code) {
            customerMap.set(customer.customer_code, customer);
        }
    });
    
    const projectByCustomer = new Map();
    projects.forEach(project => {
        const customerKey = project.customer_id || project.customer_code;
        if (!customerKey) return;
        
        if (!projectByCustomer.has(customerKey)) {
            projectByCustomer.set(customerKey, []);
        }
        projectByCustomer.get(customerKey).push(project);
    });
    
    const ordersByProject = new Map();
    orders.forEach(order => {
        if (!ordersByProject.has(order.project_id)) {
            ordersByProject.set(order.project_id, []);
        }
        ordersByProject.get(order.project_id).push(order);
    });
    
    // 顧客別集計を作成
    const customerBudgets: CustomerBudgetSummary[] = [];
    
    for (const [customerKey, customerProjects] of projectByCustomer) {
        const customer = customerMap.get(customerKey);
        if (!customer) continue;
        
        let totalBudget = 0;
        let totalActual = 0;
        let totalCost = 0;
        let projectCount = customerProjects.length;
        
        customerProjects.forEach(project => {
            totalBudget += project.amount || 0;
            totalCost += project.total_cost || 0;
            
            const projectOrders = ordersByProject.get(project.id) || [];
            projectOrders.forEach(order => {
                totalActual += order.amount || 0;
            });
        });
        
        const profitMargin = totalBudget > 0 ? ((totalBudget - totalCost) / totalBudget) * 100 : 0;
        const achievementRate = totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0;
        
        customerBudgets.push({
            customerId: customer.id,
            customerCode: customer.customer_code,
            customerName: customer.customer_name,
            totalBudget,
            totalActual,
            totalCost,
            profitMargin,
            achievementRate,
            projectCount,
            projects: customerProjects.map(p => ({
                id: p.id,
                projectCode: p.project_code,
                projectName: p.project_name,
                budget: p.amount,
                actualCost: totalCost,
                orders: ordersByProject.get(p.id) || []
            }))
        });
    }
    
    return customerBudgets.sort((a, b) => b.totalBudget - a.totalBudget);
};

const mapCustomerBudgetSummary = (row: any): CustomerBudgetSummary => ({
    customerId: row.customer_id,
    customerCode: row.customer_code,
    customerName: row.customer_name,
    totalBudget: row.total_budget,
    totalActual: row.total_actual,
    totalCost: row.total_cost,
    profitMargin: row.profit_margin,
    achievementRate: row.achievement_rate,
    projectCount: row.project_count,
    projects: row.projects || []
});
```

### 2. 顧客別予算ビュー作成SQL

```sql
-- 顧客別予算集計ビューを作成
CREATE OR REPLACE VIEW public.customer_budget_summary_view AS
WITH 
project_orders AS (
    SELECT 
        project_id,
        SUM(amount) as total_orders,
        SUM(variable_cost) as total_order_cost,
        COUNT(*) as order_count
    FROM public.orders
    WHERE project_id IS NOT NULL
    GROUP BY project_id
),
project_summary AS (
    SELECT 
        p.customer_id,
        p.customer_code,
        c.customer_name,
        COUNT(p.id) as project_count,
        COALESCE(SUM(p.amount), 0) as total_budget,
        COALESCE(SUM(p.total_cost), 0) as total_cost,
        COALESCE(po.total_orders, 0) as total_actual,
        COALESCE(po.total_order_cost, 0) as total_order_cost
    FROM public.projects p
    LEFT JOIN public.customers c ON (
        p.customer_id = c.id OR 
        (p.customer_id IS NULL AND p.customer_code = c.customer_code)
    )
    LEFT JOIN project_orders po ON p.id = po.project_id
    GROUP BY 
        p.customer_id, 
        p.customer_code, 
        c.customer_name
)
SELECT 
    ps.*,
    CASE 
        WHEN ps.total_budget > 0 
        THEN ((ps.total_budget - ps.total_cost) / ps.total_budget) * 100 
        ELSE 0 
    END as profit_margin,
    CASE 
        WHEN ps.total_budget > 0 
        THEN (ps.total_actual / ps.total_budget) * 100 
        ELSE 0 
    END as achievement_rate,
    -- プロジェクト詳細情報をJSONで含める
    (
        SELECT JSON_AGG(
            JSON_BUILD_OBJECT(
                'id', p.id,
                'projectCode', p.project_code,
                'projectName', p.project_name,
                'budget', p.amount,
                'actualCost', COALESCE(po2.total_order_cost, 0),
                'orders', (
                    SELECT JSON_AGG(
                        JSON_BUILD_OBJECT(
                            'id', o.id,
                            'amount', o.amount,
                            'orderDate', o.order_date
                        )
                    )
                    FROM public.orders o
                    WHERE o.project_id = p.id
                )
            )
        )
    )
    ) as projects
FROM project_summary ps
LEFT JOIN public.projects p ON ps.customer_id = p.customer_id
LEFT JOIN project_orders po2 ON p.id = po2.project_id
GROUP BY 
    ps.customer_id, 
    ps.customer_code, 
    ps.customer_name,
    ps.project_count,
    ps.total_budget,
    ps.total_cost,
    ps.total_actual,
    ps.total_order_cost
ORDER BY ps.total_budget DESC;
```

### 3. フロントエンドコンポーネント

```typescript
// components/budget/CustomerBudgetVisualizationPage.tsx
import React, { useEffect, useState } from 'react';
import { CustomerBudgetSummary } from '../../types';
import { getCustomerBudgetSummaries } from '../../services/dataService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const CustomerBudgetVisualizationPage: React.FC = () => {
    const [customerBudgets, setCustomerBudgets] = useState<CustomerBudgetSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                const data = await getCustomerBudgetSummaries();
                setCustomerBudgets(data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        
        loadData();
    }, []);

    if (loading) return <div>読み込み中...</div>;
    if (error) return <div>エラー: {error}</div>;

    const totalBudget = customerBudgets.reduce((sum, customer) => sum + customer.totalBudget, 0);
    const totalActual = customerBudgets.reduce((sum, customer) => sum + customer.totalActual, 0);

    const chartData = customerBudgets.map(customer => ({
        name: customer.customerName,
        予算: customer.totalBudget,
        実績: customer.totalActual,
        利益率: customer.profitMargin,
        達成率: customer.achievementRate
    }));

    const pieData = customerBudgets.slice(0, 10).map((customer, index) => ({
        name: customer.customerName,
        value: customer.totalBudget,
        fill: ['#2563eb', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'][index % 5]
    }));

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow">
                <h2 className="text-2xl font-bold mb-4">顧客別予算ダッシュボード</h2>
                
                {/* 集計サマリー */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                        <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200">総予算</h3>
                        <p className="text-2xl font-bold text-blue-600 dark:text-blue-300">
                            ¥{totalBudget.toLocaleString()}
                        </p>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                        <h3 className="text-lg font-semibold text-green-800 dark:text-green-200">総実績</h3>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-300">
                            ¥{totalActual.toLocaleString()}
                        </p>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                        <h3 className="text-lg font-semibold text-purple-800 dark:text-purple-200">達成率</h3>
                        <p className="text-2xl font-bold text-purple-600 dark:text-purple-300">
                            {totalBudget > 0 ? ((totalActual / totalBudget) * 100).toFixed(1) : 0}%
                        </p>
                    </div>
                </div>

                {/* バーチャート */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow">
                        <h3 className="text-lg font-semibold mb-4">顧客別予算比較</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip formatter={(value) => `¥${value.toLocaleString()}`} />
                                <Bar dataKey="予算" fill="#2563eb" />
                                <Bar dataKey="実績" fill="#22c55e" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow">
                        <h3 className="text-lg font-semibold mb-4">予算構成比</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="value"
                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value) => `¥${value.toLocaleString()}`} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 顧客別詳細リスト */}
                <div className="mt-6">
                    <h3 className="text-lg font-semibold mb-4">顧客別詳細</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse border border-slate-200 dark:border-slate-700">
                            <thead className="bg-slate-50 dark:bg-slate-800">
                                <tr>
                                    <th className="px-4 py-2 text-left">顧客名</th>
                                    <th className="px-4 py-2 text-right">プロジェクト数</th>
                                    <th className="px-4 py-2 text-right">総予算</th>
                                    <th className="px-4 py-2 text-right">総実績</th>
                                    <th className="px-4 py-2 text-right">利益率</th>
                                    <th className="px-4 py-2 text-right">達成率</th>
                                </tr>
                            </thead>
                            <tbody>
                                {customerBudgets.map((customer, index) => (
                                    <tr key={customer.customerId} className={index % 2 === 0 ? 'bg-slate-50 dark:bg-slate-900/50' : ''}>
                                        <td className="px-4 py-2 font-medium">{customer.customerName}</td>
                                        <td className="px-4 py-2 text-right">{customer.projectCount}</td>
                                        <td className="px-4 py-2 text-right">¥{customer.totalBudget.toLocaleString()}</td>
                                        <td className="px-4 py-2 text-right">¥{customer.totalActual.toLocaleString()}</td>
                                        <td className="px-4 py-2 text-right">
                                            <span className={customer.profitMargin >= 20 ? 'text-green-600' : customer.profitMargin >= 10 ? 'text-yellow-600' : 'text-red-600'}>
                                                {customer.profitMargin.toFixed(1)}%
                                            </span>
                                        </td>
                                        <td className="px-4 py-2 text-right">
                                            <span className={customer.achievementRate >= 100 ? 'text-green-600' : customer.achievementRate >= 80 ? 'text-yellow-600' : 'text-red-600'}>
                                                {customer.achievementRate.toFixed(1)}%
                                            </span>
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

export default CustomerBudgetVisualizationPage;
```

### 4. タイプ定義追加

```typescript
// types.tsに追加
export interface CustomerBudgetSummary {
    customerId: string;
    customerCode: string | null;
    customerName: string;
    totalBudget: number;
    totalActual: number;
    totalCost: number;
    profitMargin: number;
    achievementRate: number;
    projectCount: number;
    projects: Array<{
        id: string;
        projectCode: string;
        projectName: string;
        budget: number;
        actualCost: number;
        orders: Array<{
            id: string;
            amount: number;
            orderDate: string;
        }>;
    }>;
}
```

## 実行手順

### ステップ1: 外部キー制約追加（最重要）
```sql
-- Supabase SQLエディタで実行
ALTER TABLE public.projects 
ADD CONSTRAINT projects_customer_id_fkey 
FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;
```

### ステップ2: 顧客別予算ビュー作成
```sql
-- 上記のcustomer_budget_summary_view作成SQLを実行
```

### ステップ3: サービス関数実装
1. `getCustomerBudgetSummaries`関数をdataService.tsに追加
2. `CustomerBudgetSummary`タイプをtypes.tsに追加
3. `CustomerBudgetVisualizationPage`コンポーネントを作成

### ステップ4: アプリケーション統合
1. App.tsxで新しいコンポーネントをルーティングに追加
2. ナビゲーションメニューに「顧客別予算」を追加
3. 既存の予算管理画面を置き換えまたは併記

### ステップ5: 検証
1. 顧客別予算ダッシュボードにアクセス
2. データが正しく集計・表示されているか確認
3. ドリルダウンで顧客詳細が確認できるかテスト

## 優先順位

1. **高**: 外部キー制約追加（即時効果あり）
2. **中**: 顧客別予算ビュー作成（集計機能強化）
3. **低**: フロントエンド実装（UI/UX改善）

## 期待効果

- ✅ 顧客別の予算状況が一目で把握可能
- ✅ 予算実績の達成率がリアルタイムで表示
- ✅ ドリルダウンで詳細プロジェクト情報を確認可能
- ✅ データに基づいた経営判断が迅速に実行可能
