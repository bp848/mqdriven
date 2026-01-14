# 見積・予算・プロジェクト管理 UUID表示問題 包括的修正指示書

## 問題分析

### 現状確認
- ✅ **projectsテーブル**: データ存在（1000件以上）
- ✅ **customersテーブル**: データ存在（219件以上）
- ❌ **estimates_list_view**: データなしまたはビューが存在しない
- ❌ **projects_v2テーブル**: 空っぽ（0件）

### 根本原因
1. **PostgRESTリレーション未設定**: projects→customersの外部キー制約がない
2. **ビュー参照エラー**: estimates_list_viewが存在しないか空
3. **データ不整合**:新旧テーブル間のデータ移行が完了していない

## 即時修正コード

### 1. 見積管理修正

```typescript
// services/dataService.ts - getEstimatesPage関数を修正
export const getEstimatesPage = async (page: number, pageSize: number): Promise<{ rows: Estimate[]; totalCount: number; }> => {
    const supabase = getSupabase();
    const from = Math.max(0, (page - 1) * pageSize);
    const to = from + pageSize - 1;
    
    // 方案1: estimates_v2テーブルを優先
    try {
        const { data, error, count } = await supabase
            .from('estimates_v2')
            .select(`
                *,
                projects_v2(id, project_code, project_name, customer_id),
                customers(id, customer_name, customer_code)
            `, { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(from, to);

        if (!error && data && data.length > 0) {
            return {
                rows: data.map(mapEstimateV2ToEstimate),
                totalCount: count ?? 0,
            };
        }
    } catch (err) {
        console.warn('estimates_v2 query failed:', err.message);
    }

    // 方案2: 従来estimatesテーブルをフォールバック
    console.warn('Falling back to legacy estimates table');
    
    const { data: legacyData, error: legacyError, count: legacyCount } = await supabase
        .from('estimates')
        .select(`
            estimates_id,
            pattern_no,
            pattern_name,
            specification,
            copies,
            unit_price,
            tax_rate,
            total,
            subtotal,
            consumption,
            delivery_date,
            expiration_date,
            delivery_place,
            transaction_method,
            note,
            status,
            create_date,
            update_date,
            project_id
        `, { count: 'exact' })
        .order('create_date', { ascending: false })
        .range(from, to);

    if (legacyError) {
        throw formatSupabaseError('Failed to fetch estimates', legacyError);
    }

    // 手動で顧客・プロジェクト情報を取得
    const [projects, customers] = await Promise.all([
        supabase.from('projects').select('id, project_code, project_name, customer_id, customer_code'),
        supabase.from('customers').select('id, customer_name, customer_code')
    ]);

    // 手動JOIN
    const projectMap = (projects.data || []).reduce((acc, project) => {
        acc[project.id] = project;
        return acc;
    }, {} as Record<string, any>);

    const customerMap = (customers.data || []).reduce((acc, customer) => {
        acc[customer.id] = customer;
        acc[customer.customer_code] = customer;
        return acc;
    }, {} as Record<string, any>);

    const enrichedData = (legacyData || []).map(estimate => {
        const project = projectMap[estimate.project_id];
        const customer = project?.customer_id 
            ? customerMap[project.customer_id] 
            : project?.customer_code 
                ? customerMap[project.customer_code] 
                : null;

        return {
            ...estimate,
            project: project || null,
            customer: customer || null,
        };
    });

    return {
        rows: enrichedData.map(mapLegacyEstimateToEstimate),
        totalCount: legacyCount ?? 0,
    };
};

// 新しいマッピング関数
const mapEstimateV2ToEstimate = (row: any): Estimate => ({
    id: row.id,
    estimateNumber: row.estimate_number,
    version: row.version,
    status: row.status,
    subtotal: row.subtotal,
    taxAmount: row.tax_amount,
    total: row.total,
    currency: row.currency,
    validUntil: row.valid_until,
    deliveryDate: row.delivery_date,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    projectId: row.project_id,
    project: row.projects_v2,
    customer: row.customers,
    // ... 他の必要なフィールド
});

const mapLegacyEstimateToEstimate = (row: any): Estimate => ({
    id: row.estimates_id,
    estimateNumber: row.pattern_no,
    version: 1,
    status: mapLegacyStatus(row.status),
    subtotal: row.subtotal || 0,
    taxAmount: row.tax_rate ? (row.subtotal || 0) * (row.tax_rate / 100) : 0,
    total: row.total || 0,
    currency: 'JPY',
    validUntil: row.expiration_date,
    deliveryDate: row.delivery_date,
    notes: row.note,
    createdAt: row.create_date,
    updatedAt: row.update_date,
    projectId: row.project_id,
    project: row.project,
    customer: row.customer,
    // ... 他の必要なフィールド
});
```

### 2. 予算管理修正

```typescript
// services/dataService.ts - getProjectBudgetSummaries関数を修正
export const getProjectBudgetSummaries = async (filters: ProjectBudgetFilter = {}): Promise<ProjectBudgetSummary[]> => {
    const supabase = getSupabase();
    
    // 方案1: projects_v2ベースの集計を試行
    try {
        const { data: v2Data, error: v2Error } = await supabase
            .from('projects_v2')
            .select(`
                *,
                customers(id, customer_name, customer_code)
            `)
            .order('updated_at', { ascending: false });

        if (!v2Error && v2Data && v2Data.length > 0) {
            // 注文データを取得
            const { data: orders } = await supabase
                .from('orders_v2')
                .select('*')
                .in('project_id', v2Data.map(p => p.id));

            const ordersByProject = (orders || []).reduce((acc, order) => {
                if (!acc[order.project_id]) acc[order.project_id] = [];
                acc[order.project_id].push(order);
                return acc;
            }, {} as Record<string, any[]>);

            return v2Data.map(project => ({
                ...project,
                customerName: project.customers?.customer_name || '未設定',
                customerCode: project.customers?.customer_code || project.customer_id,
                totalAmount: (ordersByProject[project.id] || [])
                    .reduce((sum, order) => sum + (order.amount || 0), 0),
                totalCost: (ordersByProject[project.id] || [])
                    .reduce((sum, order) => sum + (order.variable_cost || 0), 0),
                orders: ordersByProject[project.id] || [],
            }));
        }
    } catch (err) {
        console.warn('projects_v2 query failed, using legacy:', err.message);
    }

    // 方案2: 従来方式のフォールバック
    const [
        financialRows,
        purchaseOrders,
        customersData,
    ] = await Promise.all([
        fetchProjectFinancialView(),
        fetchPurchaseOrdersWithFilters(filters),
        supabase.from('customers').select('id, customer_code, customer_name'),
    ]);

    // 既存のロジックを継続...
    // （既存コードは変更せず）
};
```

### 3. プロジェクト管理修正

```typescript
// services/dataService.ts - getProjects関数は既に修正済み
// 追加: projects_v2のフォールバックを追加
export const getProjectsUnified = async (): Promise<Project[]> => {
    const supabase = getSupabase();
    
    // 方案1: projects_v2を試行
    try {
        const { data, error } = await supabase
            .from('projects_v2')
            .select(`
                *,
                customers(id, customer_name, customer_code)
            `)
            .order('updated_at', { ascending: false });

        if (!error && data && data.length > 0) {
            return data.map(mapProjectV2ToProject);
        }
    } catch (err) {
        console.warn('projects_v2 query failed:', err.message);
    }

    // 方案2: 従来projectsテーブルをフォールバック（既存ロジック）
    return getProjects(); // 既存関数を呼び出し
};

const mapProjectV2ToProject = (row: any): Project => ({
    id: row.id,
    projectCode: row.project_code,
    customerCode: row.customers?.customer_code,
    customerName: row.customers?.customer_name,
    customerId: row.customer_id,
    projectName: row.project_name,
    projectStatus: row.status,
    createDate: row.created_at,
    updateDate: row.updated_at,
    amount: row.budget_sales,
    totalCost: row.budget_cost,
    deliveryDate: row.due_date,
    // ... 他の必要なフィールド
});
```

## データベース修正SQL

### 1. 外部キー制約の追加（最重要）

```sql
-- projectsテーブルに外部キー制約を追加
ALTER TABLE public.projects 
ADD CONSTRAINT projects_customer_id_fkey 
FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;

-- 制約が追加されたか確認
SELECT 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name = 'projects'
    AND kcu.column_name = 'customer_id';
```

### 2. estimates_list_viewの再作成

```sql
-- estimates_list_viewを再作成
CREATE OR REPLACE VIEW public.estimates_list_view AS
WITH 
estimates_with_projects AS (
    SELECT 
        e.estimates_id as id,
        e.pattern_no as estimate_number,
        e.pattern_name,
        e.specification,
        e.copies,
        e.unit_price,
        e.tax_rate,
        e.total,
        e.subtotal,
        e.consumption,
        e.delivery_date,
        e.expiration_date,
        e.delivery_place,
        e.transaction_method,
        e.note,
        e.status,
        e.create_date as created_at,
        e.update_date as updated_at,
        e.project_id,
        p.project_name,
        p.customer_id,
        p.customer_code
    FROM public.estimates e
    LEFT JOIN public.projects p ON e.project_id = p.id
),
final_view AS (
    SELECT 
        ewp.*,
        c.customer_name,
        c.customer_code as customer_code_final
    FROM estimates_with_projects ewp
    LEFT JOIN public.customers c ON (
        ewp.customer_id = c.id OR 
        (ewp.customer_id IS NULL AND ewp.customer_code = c.customer_code)
    )
)
SELECT * FROM final_view
ORDER BY created_at DESC;
```

### 3. projects_v2へのデータ移行（任意）

```sql
-- projectsテーブルからprojects_v2へデータ移行
INSERT INTO public.projects_v2 (
    id,
    project_code,
    customer_id,
    project_name,
    status,
    delivery_status,
    budget_sales,
    budget_cost,
    due_date,
    created_by,
    created_at,
    updated_at
)
SELECT 
    p.id,
    p.project_code,
    p.customer_id,
    p.project_name,
    CASE 
        WHEN p.project_status = '8' THEN 'done'
        WHEN p.project_status = '0' THEN 'planning'
        ELSE 'in_progress'
    END as status,
    'not_started' as delivery_status,
    COALESCE(p.amount, 0) as budget_sales,
    COALESCE(p.total_cost, 0) as budget_cost,
    p.delivery_date as due_date,
    p.create_user_id as created_by,
    p.create_date as created_at,
    p.update_date as updated_at
FROM public.projects p
WHERE NOT EXISTS (
    SELECT 1 FROM public.projects_v2 pv2 
    WHERE pv2.id = p.id
);
```

## 実行手順

### ステップ1: 即時対応（コード修正）
1. 上記のコード修正を`services/dataService.ts`に適用
2. アプリケーションを再起動
3. 各画面でデータが表示されるか確認

### ステップ2: 恒久対応（データベース）
1. Supabase SQLエディタで外部キー制約を追加
2. estimates_list_viewを再作成
3. 必要に応じてprojects_v2へデータ移行

### ステップ3: 検証
1. 見積管理画面でデータが表示されるか確認
2. 予算管理画面で集計が正しく表示されるか確認
3. プロジェクト管理画面で一覧が表示されるか確認

## 優先順位

1. **高**: 外部キー制約の追加（最も効果的）
2. **中**: コード修正（即時対応可能）
3. **低**: データ移行（計画的に実施）

## 注意点

- 本番適用前は必ずテスト環境で検証
- データバックアップを取得してから実施
- アプリケーションの再起動が必要な場合がある
- ユーザーへの影響を最小限に抑える
