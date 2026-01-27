# 経費分析ビュー設計仕様

## 目的
経費の「何に・どこで・いつ・いくら・誰に」に即した集計をアプリから即時に行えるよう、仕訳明細を正規化する分析ビュー群を提供する。

## 対象テーブル（既存）
- `accounting.accounts`: 勘定科目マスタ（category_codeで費用判定）
- `accounting.journal_batches`: 仕訳バッチ（status, posted_at）
- `accounting.journal_entries`: 仕訳ヘッダ（entry_date, batch_id）
- `accounting.journal_lines`: 仕訳明細（debit, credit, account_id, project_id, description）
- `accounting.payables`: 買掛（journal_line_id, supplier_id）
- `public.payment_recipients`: 仕入先マスタ
- `public.projects`: プロジェクト情報

## 分析ビュー

### accounting.v_expense_lines

**粒度**: 仕訳明細1行 = 1レコード（費用勘定のみ）

**金額**: `amount = debit - credit`（費用は通常プラス、振替等で貸方計上はマイナス）

**主な列**:
- `occurred_on`: 仕訳日（journal_entries.entry_date）
- `account_*`: 勘定科目識別子（id/code/name）
- `project_id`, `project_code`: プロジェクト軸
- `supplier_id`, `supplier_name`: 買掛から辿れた場合のみ付与
- `journal_entry_id`, `journal_batch_id`, `batch_status`, `batch_posted_at`: 計上状態の追跡
- `description`, `entry_description`: 明細・ヘッダの摘要

**フィルタ方針**:
- 費用判定は `accounts.category_code = 'expense'`
- 実績のみ集計する場合は利用側で `WHERE batch_status='posted'` を推奨

### accounting.v_expense_by_month_account
**粒度**: 月単位  
**キー**: `month`(=date_trunc('month', occurred_on)) と各次元キー  
**値**: `SUM(amount)`

### accounting.v_expense_by_month_supplier
**粒度**: 月単位  
**キー**: `month`(=date_trunc('month', occurred_on)) と各次元キー  
**値**: `SUM(amount)`

### accounting.v_expense_by_month_project
**粒度**: 月単位  
**キー**: `month`(=date_trunc('month', occurred_on)) と各次元キー  
**値**: `SUM(amount)`

### accounting.v_expense_workflow_events（任意）
ワークフロー（public.accounting_workflows）と仕訳の対応関係を可視化  
postedの判定・日付は `journal_batches.status`, `posted_at` に依存

## インデックス
クエリ頻度の高い列に以下を作成済/推奨
- `accounting.journal_entries(entry_date)`
- `accounting.journal_lines(account_id)`, `(project_id)`
- `accounting.accounts(category_code)`
- `accounting.payables(journal_line_id)`, `(supplier_id)`

## 想定クエリ例

### 月次×勘定科目トップ
```sql
SELECT month, account_code, account_name, total_amount
FROM accounting.v_expense_by_month_account
WHERE month BETWEEN ... AND ...
-- 必要に応じて posted のみ集計する場合は
-- JOIN v_expense_lines USING(month, account_id, account_code, account_name)
-- WHERE batch_status='posted'
```

### 仕入先別サマリ
```sql
SELECT supplier_name, SUM(total_amount) AS ytd
FROM accounting.v_expense_by_month_supplier
WHERE month >= date_trunc('year', now())
GROUP BY supplier_name
ORDER BY SUM(total_amount) DESC
```

## 運用・留意点
- posted判定は `journal_batches.status='posted'` を採用。`posted_at` は `journal_batches.posted_at`。
- 費用勘定の網羅性は `accounting.accounts.category_code` の運用に依存。
- 仕入先が紐づかない経費（例: 振替・減価償却）は `supplier_*` がNULL。
- 将来的に部門別など追加軸が必要な場合は、`journal_lines` に部門IDが入る設計（または別テーブル連携）を前提にビューを拡張。
- パフォーマンスが必要になれば、マテリアライズドビュー＋定期リフレッシュ（pg_cron）に拡張可能。

## セキュリティ
現状ビューはRLSなし。社内管理ダッシュボード想定。社外・一般ユーザー公開時は、API層で認可、またはレポート用集約テーブルを分離してRLS設計。

## 実装状況

### フロントエンド
- ✅ `ExpenseAnalysisPage.tsx`: 経費分析ページコンポーネント
  - 明細一覧タブ
  - 勘定科目別タブ
  - 仕入先別タブ
  - プロジェクト別タブ

### データサービス
- ✅ `getExpenseLinesData()`: v_expense_lines からデータ取得
- ✅ `getExpenseByMonthAccount()`: v_expense_by_month_account からデータ取得
- ✅ `getExpenseByMonthSupplier()`: v_expense_by_month_supplier からデータ取得
- ✅ `getExpenseByMonthProject()`: v_expense_by_month_project からデータ取得
- ⏳ `getExpenseWorkflowEvents()`: v_expense_workflow_events からデータ取得（未実装・任意）

### ルーティング
- ✅ `App.tsx`: `accounting_expense_analysis` ケース追加
- ✅ `Sidebar.tsx`: 「経費分析」メニュー項目追加

## 今後の拡張案
1. posted判定フィルタリングのオプション追加
2. 日付範囲フィルタリング機能
3. エクスポート機能（CSV/Excel）
4. グラフ表示（月次推移など）

## 最適化・改善（実装済み）

### ワークフローイベントビュー
- ✅ `accounting.v_expense_workflow_events`: 申請→承認→仕訳起票のトレース
  - 実装ファイル: `supabase/migrations/expense_analysis_optimization.sql`
  - SLA分析・ボトルネック分析に使用可能

### インデックス最適化
- ✅ `applications` テーブルのインデックス追加
  - 時系列: `created_at`, `submitted_at`, `approved_at`, `rejected_at`
  - ステータス: `status`, `accounting_status`
  - 分布/ドリルダウン: `applicant_id`, `approver_id`, `application_code_id`, `approval_route_id`
  - 複合インデックス: `(status, created_at)`, `(accounting_status, approved_at)`

### 申請分析用ビュー
- ✅ `v_applications_daily_creation`: 日別作成数（直近30日）
- ✅ `v_applications_by_status`: ステータス別件数
- ✅ `v_applications_by_accounting_status`: 会計処理ステータス別件数
- ✅ `v_applications_approval_sla`: 提出→承認の平均所要時間（直近90日）

### データ品質チェック
- ✅ `v_applications_data_quality`: データ整合性チェック
  - `submitted_at` と `status` の整合性
  - `approved_at` と `rejected_at` の相互排他
  - `updated_at` トリガの確認

### RLS/権限
- ⏳ 現状は社内管理ダッシュボード想定のためRLSなし
- 将来の拡張: 分析専用ロール（`expense_analyst`）の作成例をSQLに含む
