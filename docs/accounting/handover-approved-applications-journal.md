# 引継ぎ書：承認済み一覧〜仕訳生成/確定＋AI提案＋Supabase修正

作成日: 2026-01-27

## 0. 目的（今どこまで出来ていて、何が未完か）
承認済み申請（applications）を起点に、会計担当が以下を **一画面で完結** できる状態にする。
- 仕訳生成（draft）
- 仕訳確定（posted）
- AI仕訳提案（勘定科目/摘要/金額/根拠）

途中で発生していた **PGRST106 / RPC 404** を潰し、**public VIEW/RPC 経由に寄せる方針**を採用済み。
現状、UIが複数ページに分散しており、方針は **「承認済み一覧と仕訳レビューを統合」**（未完）。

---

## 1. Supabase（本番）情報
- Project: `rwjhpfghhgstvplmggks`
- 本番仕訳の正（SoT）
  - `accounting.journal_batches`
  - `accounting.journal_entries`
  - `accounting.journal_lines`
- `public.journal_entries` も存在（旧/別用途の可能性）。**新規実装は accounting 側に寄せる前提。**

---

## 2. DB/RPC 現状（重要ポイント）

### 2.1 仕訳生成 RPC（既存・問題の根）
- 関数: `public.generate_journal_lines_from_application(p_application_id uuid, p_user_id uuid)`
- 重大バグの原因:
  - フロントが `application_id` の **1引数で呼んでいた**
  - 正しくは **2引数** 必須
- 正しい呼び方（必須）:
```ts
supabase.rpc('generate_journal_lines_from_application', {
  p_application_id: <uuid>,
  p_user_id: <uuid>
})
```
- ここがズレると **404 / PGRST106** が永遠に出る。呼び出し箇所の統一が最優先。

### 2.2 AI提案（あなたが作成済み）
テーブル（accounting）
- `accounting.ai_runs`
- `accounting.ai_journal_proposals`
- `accounting.ai_journal_proposal_lines`

RPC（accounting）
- `accounting.rpc_generate_ai_proposal(...)`
- `accounting.rpc_approve_ai_proposal(proposal_id uuid)`

目的:
AIの「提案」を本番仕訳と分離して保持し、**承認後に accounting.journal_* にコピー**する。

---

## 3. UIの現状（混在が最大の問題）

### 3.1 ルーティング / ページキー
`App.tsx` / サイドバーで以下が存在。
- `accounting_approved_applications` … 承認済一覧（`ApprovedApplications`）
- `accounting_journal_review` … 仕訳レビュー（`JournalReviewPage` 系）

### 3.2 画面が二重化している場所
- `components/accounting/JournalReviewPage.tsx`（旧/別系統っぽい）
- `src/components/accounting/JournalEntry.tsx`（中身は JournalReviewPage 的な実装）

**結果:** どれが正かブレて「直したのに反映されない」が発生。

---

## 4. 既に入った変更（重要）
1) 仕訳レビュー系画面に **「仕訳生成」「仕訳確定」**ボタン追加  
   - 仕訳未生成の理由を UI 上で解消（コミット/プッシュ済み）
2) 承認済み一覧に **検索フィルタ** 追加  
   - テストデータ特定が容易化（コミット/プッシュ済み）
3) RPC 引数不一致の修正  
   - `services/dataService.ts` の `generateJournalLinesFromApplication` は **2引数** で呼ぶ修正済み  
   - ただし **どの画面が呼ぶべきか** は未統一

---

## 5. 最新方針（あなたの要求）

### 5.1 統合方針
「承認済み一覧」を統合画面にする。  
仕訳レビューは別ページとして残さず、**承認済み一覧から**以下が完結する構成に寄せる。
- 仕訳生成
- 仕訳確定
- AI提案（勘定科目が選択済み状態）

### 5.2 UI 仕様（確定）
- 承認済み一覧の「次へ」は廃止し、**「仕訳確定」**にする  
  - 単なる文言変更ではなく **posted 化する操作に接続**
- 推奨の出し分け
  - 未生成（lines なし / `accounting_status = none`）: 仕訳生成
  - draft（lines あり / `accounting_status = draft`）: 仕訳確定
  - posted: 確定済み（非活性 or 非表示）
- AI提案は **「表示される」だけでなく、UI の選択状態として初期セット**されていること  
  - その上で会計担当が修正できること

### 5.3 不備チェック（確認フロー）
画面上に「確認要」項目を明示して、申請者/社長確認へ回せる導線にする。
- 支払日不明
- 目的不明（摘要・内容が薄い）
- 金額相違（申請 vs 明細合計）
- 予算/MQ（将来拡張。今は “未確定” 表示でも良い）

---

## 6. 実装上の注意点（実務に直結）

### 6.1 RPC 呼び出しの統一（最優先）
- **必ず2引数**で呼ぶ
- 例: `services/dataService.ts` の `generateJournalLinesFromApplication`
  - `p_application_id` と `p_user_id` を必ず渡す
  - `p_user_id` が無い場合でも **キーを渡す**（`null` で可）

### 6.2 正のテーブル
新規の本番反映は **accounting スキーマ** を正として扱う。
- 旧: `public.journal_entries`
- 正: `accounting.journal_*`

### 6.3 「承認済み一覧」に寄せる際の最低要件
- 承認済みの検索・絞り込み
- AI提案の初期選択状態
- 仕訳生成 → 仕訳確定の導線
- 仕訳確定済みの明示
- 不備チェック表示

---

## 7. 未完タスク（次の担当がやること）

### 7.1 画面統合
- `ApprovedApplications` を主画面として強化  
  - 仕訳レビュー相当を統合（`components/accounting/JournalReviewPage.tsx` の廃止方向）
- `accounting_journal_review` を **最終的に廃止/誘導**へ

### 7.2 AI提案の「選択済み」セット
- AI提案行をセレクト等の **初期値** にセット
- 修正可能な UI にする

### 7.3 仕訳生成/確定の状態同期
- `accounting_status` の状態と UI 出し分けを一致させる
- `generate_journal_lines_from_application` を **呼び出し元を統一**

### 7.4 不備チェック表示
- 画面上で「確認要」を分かりやすく表示
- 申請者/社長確認の運用につなげる

---

## 8. 参照ファイル（場所）
- `src/components/accounting/ApprovedApplications.tsx`
- `src/components/accounting/JournalEntry.tsx`
- `components/accounting/JournalReviewPage.tsx`
- `services/dataService.ts`
- `App.tsx`（ページキーのスイッチ）

---

## 9. まとめ（結論）
- **RPC 404 の原因は引数不一致**で確定。2引数を必須に統一すれば解消。
- **承認済み一覧と仕訳レビューの統合が未完**。ここが最大の優先事項。
- AI提案は DB 準備済み。**「選択済み状態」まで持っていく UI 実装が未完**。
