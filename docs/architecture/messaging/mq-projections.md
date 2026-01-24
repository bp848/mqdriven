# MQ Projections (Read Model 責務一覧)

このファイルは、**Read Model更新の唯一の責務定義**です。
Event定義は `mq-events.md` に集約し、このファイルでは**購読対象と更新内容のみ**を定義します。

---

## 全体ルール（固定）

- Projectionは**Read Model専用**。UIやCommandから直接更新してはいけない。
- 仕訳・帳簿・税・試算表は **Eventの結果**のみ。
- 同期禁止。CommandはEventを出すだけ。
- MonthClosed は **Command Gate**。Projectionは止めない。

---

## Projection一覧（固定）

### 1) JournalLedgerProjection（仕訳帳）

- **購読Event**
  - `JournalEntryApproved`
  - （`JournalEntryLinesGenerated` / `JournalEntryRejected` は**無視**）
- **更新するRead Model**
  - 仕訳帳（postedのみ、仕訳ヘッダ＋明細）
- **更新内容**
  - JournalEntryApproved を1件ずつ Upsert
  - 1仕訳＝複数明細（借方/貸方）を保持
- **再生成ルール**
  - 全Eventを先頭からリプレイして再構築
- **MonthClosed時の挙動**
  - 継続更新（停止しない）

---

### 2) GeneralLedgerProjection（総勘定元帳）

- **購読Event**
  - `JournalEntryApproved`
- **更新するRead Model**
  - 総勘定元帳（account_items ベース、postedのみ）
- **更新内容**
  - 勘定科目×日付の明細を追加
  - 仕訳1件から複数科目へ展開
- **再生成ルール**
  - 全Eventリプレイで再構築
- **MonthClosed時の挙動**
  - 継続更新（停止しない）

---

### 3) TrialBalanceProjection（試算表）

- **購読Event**
  - `JournalEntryApproved`
- **更新するRead Model**
  - 試算表（科目別の借方・貸方合計）
- **更新内容**
  - 勘定科目ごとの月次合計を更新
  - 借方合計＝貸方合計が保たれる
- **再生成ルール**
  - 全Eventリプレイで再構築
- **MonthClosed時の挙動**
  - 継続更新（停止しない）

---

### 4) TaxAggregationProjection（消費税集計）

- **購読Event**
  - `JournalEntryApproved`
- **更新するRead Model**
  - 消費税集計（課税区分別の集計結果）
- **更新内容**
  - 勘定科目・税区分に基づき集計
  - 税計算はProjection側で実行
- **再生成ルール**
  - 全Eventリプレイで再構築
- **MonthClosed時の挙動**
  - 継続更新（停止しない）

---

## MonthClosed の扱い（固定）

- Eventは止めない
- Projectionも止めない
- **止めるのはCommandのみ**
  - 対象月に対する `GenerateJournalEntryLines` / `ApproveJournalEntry` / `RejectJournalEntry` は拒否
- 閉鎖月の修正は**別イベント**（例: `ReopenMonth`）で扱う
