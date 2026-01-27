# 経費分析ページ実装チェックリスト

## ✅ 実装完了項目

### フロントエンド
- [x] `ExpenseAnalysisPage.tsx`: 経費分析ページコンポーネント
  - [x] 明細一覧タブ
  - [x] 勘定科目別タブ
  - [x] 仕入先別タブ
  - [x] プロジェクト別タブ
  - [x] サマリーカード（総経費額、明細件数、勘定科目数）
  - [x] ソート機能
  - [x] データ未集計時のEmptyState表示

### データサービス
- [x] `getExpenseLinesData()`: v_expense_lines からデータ取得
- [x] `getExpenseByMonthAccount()`: v_expense_by_month_account からデータ取得
- [x] `getExpenseByMonthSupplier()`: v_expense_by_month_supplier からデータ取得
- [x] `getExpenseByMonthProject()`: v_expense_by_month_project からデータ取得
- [x] `getExpenseWorkflowEvents()`: v_expense_workflow_events からデータ取得
- [x] `getApplicationsDailyCreation()`: 日別作成数取得
- [x] `getApplicationsByStatus()`: ステータス別件数取得
- [x] `getApplicationsByAccountingStatus()`: 会計処理ステータス別件数取得
- [x] `getApplicationsApprovalSLA()`: 承認SLA取得
- [x] `getApplicationsDataQuality()`: データ品質チェック取得

### ルーティング
- [x] `App.tsx`: `accounting_expense_analysis` ケース追加
- [x] `Sidebar.tsx`: 「経費分析」メニュー項目追加

### データベース最適化
- [x] SQLスクリプト作成: `supabase/migrations/expense_analysis_optimization.sql`
  - [x] ワークフローイベントビュー
  - [x] applications テーブルのインデックス最適化
  - [x] 申請分析用ビュー（4種類）
  - [x] データ品質チェックビュー

### データ品質改善
- [x] `accounting_status` の `pending` 値を `NONE` に正規化
- [x] 承認時に `accounting_status` を `draft` に更新
- [x] 仕訳生成成功時に `accounting_status` を `draft` に更新

### ドキュメント
- [x] 仕様ドキュメント: `docs/accounting/expense-analysis-view-spec.md`
- [x] 実装チェックリスト: 本ファイル

## 🔄 実行が必要な作業

### 1. SQLスクリプトの実行
Supabase SQL Editorで以下を実行：

```sql
-- ファイル: supabase/migrations/expense_analysis_optimization.sql
-- 実行方法: Supabase Dashboard > SQL Editor > 新規クエリ > 貼り付け > 実行
```

**実行内容**:
- ワークフローイベントビューの作成
- applications テーブルのインデックス追加（10個以上）
- 申請分析用ビューの作成（4種類）
- データ品質チェックビューの作成

**実行後の確認**:
```sql
-- ビューが作成されたか確認
SELECT table_name FROM information_schema.views 
WHERE table_schema = 'accounting' 
AND table_name LIKE 'v_expense%';

SELECT table_name FROM information_schema.views 
WHERE table_schema = 'public' 
AND table_name LIKE 'v_applications%';

-- インデックスが作成されたか確認
SELECT indexname FROM pg_indexes 
WHERE tablename = 'applications' 
AND schemaname = 'public';
```

### 2. データベースビューの確認
経費分析用のビューが既に作成されているか確認：

```sql
-- 経費分析ビュー
SELECT * FROM accounting.v_expense_lines LIMIT 5;
SELECT * FROM accounting.v_expense_by_month_account LIMIT 5;
SELECT * FROM accounting.v_expense_by_month_supplier LIMIT 5;
SELECT * FROM accounting.v_expense_by_month_project LIMIT 5;
```

**注意**: これらのビューが存在しない場合は、ユーザーが提供したSQLを実行する必要があります。

### 3. 動作確認
1. アプリケーションを起動
2. サイドバーから「経費分析」をクリック
3. 各タブでデータが表示されることを確認
4. データ未集計時は「データ未集計」が表示されることを確認

## 📊 確認クエリ（実行後）

### ワークフローイベント
```sql
SELECT * FROM accounting.v_expense_workflow_events 
ORDER BY workflow_created_at DESC 
LIMIT 10;
```

### 申請分析
```sql
-- 日別作成数
SELECT * FROM public.v_applications_daily_creation;

-- ステータス別件数
SELECT * FROM public.v_applications_by_status;

-- 承認SLA
SELECT * FROM public.v_applications_approval_sla;

-- データ品質チェック
SELECT * FROM public.v_applications_data_quality;
```

## 🐛 トラブルシューティング

### ビューが見つからないエラー
- 原因: データベースビューが未作成
- 対応: ユーザーが提供したSQL（v_expense_lines等）を実行

### インデックスが作成されない
- 原因: 既に同名のインデックスが存在
- 対応: `CREATE INDEX IF NOT EXISTS` を使用しているため問題なし

### データが表示されない
- 原因1: データ未集計（journal_linesに費用勘定のデータがない）
- 対応: 正常な動作。EmptyStateが表示される
- 原因2: ビューが正しく作成されていない
- 対応: ビューの定義を確認

### accounting_status の不整合
- 原因: 過去データに `pending` 値が残っている
- 対応: `mapAccountingStatus` 関数で `pending` を `NONE` に正規化済み

## 📝 次のステップ（オプション）

1. **posted判定フィルタリング**: フロントエンドに「確定済みのみ表示」オプション追加
2. **日付範囲フィルタリング**: 期間指定機能の追加
3. **エクスポート機能**: CSV/Excel出力
4. **グラフ表示**: 月次推移の可視化
5. **申請分析ダッシュボード**: 申請分析ビューを表示する専用ページ

## ✅ 完了確認

- [ ] SQLスクリプト実行完了
- [ ] データベースビュー確認完了
- [ ] フロントエンド動作確認完了
- [ ] データ品質チェック実行
- [ ] ドキュメント確認完了
