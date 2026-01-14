# 見積・予算・プロジェクト管理 UUID不一致問題 解決指示書

## 問題確認
- ✅ **projectsテーブル**: データ存在（1000件以上）
- ❌ **projects_v2テーブル**: 空っぽ（0件）
- ❌ **PostgRESTリレーション**: 外部キー制約未設定

## 解決策

### 方案1: 既存projectsテーブルの外部キー制約を追加（推奨）

**手順:**
1. Supabase SQLエディタを開く
2. 以下のSQLを実行:
```sql
ALTER TABLE public.projects 
ADD CONSTRAINT projects_customer_id_fkey 
FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;
```

**メリット:**
- 既存データをそのまま利用可能
- 最小の変更で解決
- リレーションシップが正しく機能

### 方案2: projects_v2テーブルにデータを移行

**手順:**
1. データ移行スクリプトを実行
2. アプリケーションをprojects_v2を使用するように修正

**移行SQL:**
```sql
-- customersテーブルのマッピングを作成
CREATE TEMPORARY TABLE customer_mapping AS
SELECT DISTINCT 
    p.customer_id,
    p.customer_code,
    c.id as new_customer_id,
    c.customer_code as new_customer_code
FROM projects p
LEFT JOIN customers c ON (
    p.customer_code = c.customer_code OR 
    (p.customer_id IS NOT NULL AND p.customer_id = c.id)
);

-- projects_v2にデータを挿入
INSERT INTO projects_v2 (
    id,
    project_code,
    customer_id,
    project_name,
    status,
    delivery_status,
    budget_sales,
    budget_cost,
    due_date,
    delivery_date,
    created_by,
    created_at,
    updated_at
)
SELECT 
    gen_random_uuid(),
    p.project_code,
    COALESCE(cm.new_customer_id, gen_random_uuid()),
    p.project_name,
    CASE 
        WHEN p.project_status = '8' THEN 'done'
        WHEN p.project_status = '0' THEN 'planning'
        ELSE 'in_progress'
    END as status,
    'not_started' as delivery_status,
    COALESCE(p.amount, 0) as budget_sales,
    COALESCE(p.total_cost, 0) as budget_cost,
    p.delivery_date,
    NULL as delivery_date,
    p.create_user_id,
    p.create_date,
    p.update_date
FROM projects p
LEFT JOIN customer_mapping cm ON p.customer_code = cm.customer_code;
```

### 方案3: ビューを作成して統合

**ビュー作成SQL:**
```sql
CREATE OR REPLACE VIEW projects_unified AS
SELECT 
    p.id,
    p.project_code,
    p.customer_id,
    c.customer_name,
    p.customer_code,
    p.project_name,
    p.project_status,
    p.create_date,
    p.update_date,
    p.amount,
    p.total_cost,
    p.delivery_date
FROM projects p
LEFT JOIN customers c ON (
    p.customer_id = c.id OR 
    (p.customer_id IS NULL AND p.customer_code = c.customer_code)
);
```

## 即時対応（コード修正）

### 見積管理の修正
```typescript
// services/dataService.ts
export const getEstimates = async (): Promise<Estimate[]> => {
  const supabase = getSupabase();
  
  try {
    // リレーション付きクエリを試行
    const { data, error } = await supabase
      .from('estimates')
      .select(`
        *,
        projects(id, project_code, project_name, customer_id),
        customers(id, customer_name, customer_code)
      `)
      .order('created_at', { ascending: false });
    
    if (!error && data) return data.map(dbEstimateToEstimate);
  } catch (err) {
    // フォールバック: 手動JOIN
    console.warn('Estimates relationship not available, using fallback:', err.message);
    
    const [estimates, projects, customers] = await Promise.all([
      supabase.from('estimates').select('*').order('created_at', { ascending: false }),
      supabase.from('projects').select('id, project_code, project_name, customer_id, customer_code'),
      supabase.from('customers').select('id, customer_name, customer_code')
    ]);
    
    // 手動でデータを結合
    return joinEstimatesWithProjectsAndCustomers(estimates.data, projects.data, customers.data);
  }
};
```

### 予算管理の修正
```typescript
export const getProjectBudgets = async (): Promise<ProjectBudget[]> => {
  const supabase = getSupabase();
  
  try {
    // projects_v2を優先的に使用
    const { data, error } = await supabase
      .from('project_budgets_v2')
      .select(`
        *,
        projects_v2(id, project_code, project_name),
        customers(id, customer_name, customer_code)
      `)
      .order('period_start', { ascending: false });
    
    if (!error && data && data.length > 0) {
      return data.map(mapProjectBudget);
    }
  } catch (err) {
    // フォールバック: 従来のテーブルを使用
    return getLegacyProjectBudgets();
  }
};
```

### プロジェクト管理の修正
```typescript
export const getProjectsUnified = async (): Promise<Project[]> => {
  const supabase = getSupabase();
  
  // 統合ビューを使用
  const { data, error } = await supabase
    .from('projects_unified')
    .select('*')
    .order('update_date', { ascending: false });
  
  if (error) throw formatSupabaseError('Failed to fetch projects', error);
  return (data || []).map(dbProjectToProject);
};
```

## 実行優先順

1. **即時**: 外部キー制約を追加（方案1）
2. **確認**: アプリケーションで表示が改善されるか確認
3. **必要に応じて**: 方案2または3を検討

## 検証手順

1. 外部キー制約追加後、以下のSQLで確認:
```sql
SELECT 
    p.id,
    p.project_code,
    p.customer_id,
    c.customer_name
FROM projects p
LEFT JOIN customers c ON p.customer_id = c.id
LIMIT 5;
```

2. アプリケーションの各ページでデータが正しく表示されるか確認:
   - 見積管理ページ
   - 予算管理ページ  
   - プロジェクト管理ページ

## 注意点

- 既存データの整合性を確認してから移行を実施
- 外部キー制約追加はダウンタイムが最小
- 本番環境適用前は必ずテスト環境で検証
