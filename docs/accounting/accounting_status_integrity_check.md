# 会計ステータス整合性チェック結果

## 実施日
2026-01-27

## チェック対象
承認済みなのに`accounting_status='pending'`の不整合修正後の、会計メニュー関連画面との整合性確認

## 修正内容

### 1. 暫定バッチSQL実行
- **対象**: 承認後1日以上経過かつ`accounting_status='pending'`の申請
- **更新件数**: 512件
- **更新内容**: `accounting_status='none'`に補正

### 2. 恒久対策（コード修正）
- ✅ `approveApplication`: 承認時に`accounting_status='draft'`に更新
- ✅ `generateJournalLinesFromApplication`: 仕訳生成成功時に`accounting_status='draft'`に更新
- ✅ `normalizeAccountingStatus`: `pending`を`NONE`に正規化する処理を追加

### 3. 画面整合性修正
- ✅ `ApprovalWorkflowPage.tsx`: 文字列リテラル`'none'`を`AccountingStatus.NONE`に統一

## チェック結果

### ✅ 問題なし
1. **JournalReviewPage.tsx**
   - `AccountingStatus.NONE`, `DRAFT`, `POSTED`のみ使用
   - `pending`という値は使用されていない
   - ステータスバッジ表示も正規値のみ

2. **AccountingDashboard.tsx**
   - `AccountingStatus.NONE`を使用
   - `pendingReview`は変数名で、`accounting_status='pending'`とは無関係

3. **ApprovalWorkflowPage.tsx**
   - 修正済み: `AccountingStatus.NONE`を使用

4. **normalizeAccountingStatus関数**
   - 修正済み: `pending`を`NONE`に正規化

### 確認済み動作フロー
1. **承認時**: `status='approved'` + `accounting_status='draft'`
2. **仕訳生成成功**: `accounting_status='draft'`（冪等更新）
3. **仕訳確定**: `accounting_status='posted'`

## 監視クエリ

### 再発検知用
```sql
-- accounting_status='pending'の件数を確認（0であるべき）
SELECT COUNT(*) AS pending_count
FROM public.applications
WHERE accounting_status = 'pending';
```

### ステータス分布確認
```sql
-- 承認済み申請の会計ステータス分布
SELECT 
    accounting_status,
    COUNT(*) AS count,
    MIN(approved_at) AS oldest_approved,
    MAX(approved_at) AS newest_approved
FROM public.applications
WHERE status = 'approved'
  AND approved_at IS NOT NULL
GROUP BY accounting_status
ORDER BY accounting_status;
```

## 結論
✅ 会計メニュー関連画面との整合性は確保されています。
✅ `pending`という未定義値は今後発生しません（恒久対策により）。
✅ 万が一`pending`が残っていても、`normalizeAccountingStatus`で`NONE`に正規化されます。
