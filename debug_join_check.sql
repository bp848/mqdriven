-- JOIN問題特定クエリ
-- 1. プロジェクトと顧客の関連性チェック
SELECT 
    'projects-customer-join' as check_type,
    COUNT(*) as total_projects,
    COUNT(p.customer_id) as has_customer_id,
    COUNT(p.customer_code) as has_customer_code,
    COUNT(c.id) as customer_exists_by_id,
    COUNT(c2.id) as customer_exists_by_code
FROM projects p
LEFT JOIN customers c ON p.customer_id = c.id
LEFT JOIN customers c2 ON p.customer_code = c2.customer_code
WHERE p.deleted_at IS NULL;

-- 2. 見積とプロジェクトの関連性チェック  
SELECT 
    'estimates-project-join' as check_type,
    COUNT(*) as total_estimates,
    COUNT(e.project_id) as has_project_id,
    COUNT(e.project_code) as has_project_code,
    COUNT(p.id) as project_exists_by_id,
    COUNT(p2.id) as project_exists_by_code
FROM estimates e
LEFT JOIN projects p ON e.project_id = p.id
LEFT JOIN projects p2 ON e.project_code = p2.project_code
WHERE e.deleted_at IS NULL;

-- 3. 予算とプロジェクトの関連性チェック
SELECT 
    'budgets-project-join' as check_type,
    COUNT(*) as total_budgets,
    COUNT(pb.project_id) as has_project_id,
    COUNT(p.id) as project_exists_by_id
FROM project_budgets pb
LEFT JOIN projects p ON pb.project_id = p.id
WHERE pb.deleted_at IS NULL;

-- 4. 実際の欠落データサンプル
SELECT 
    'orphaned-projects' as data_type,
    p.id,
    p.project_code,
    p.title,
    p.customer_id,
    p.customer_code,
    c.id as customer_found_by_id,
    c2.id as customer_found_by_code
FROM projects p
LEFT JOIN customers c ON p.customer_id = c.id
LEFT JOIN customers c2 ON p.customer_code = c2.customer_code
WHERE c.id IS NULL AND c2.id IS NULL
LIMIT 5;

SELECT 
    'orphaned-estimates' as data_type,
    e.id,
    e.title,
    e.project_id,
    e.project_code,
    p.id as project_found_by_id,
    p2.id as project_found_by_code
FROM estimates e
LEFT JOIN projects p ON e.project_id = p.id
LEFT JOIN projects p2 ON e.project_code = p2.project_code
WHERE p.id IS NULL AND p2.id IS NULL
LIMIT 5;
