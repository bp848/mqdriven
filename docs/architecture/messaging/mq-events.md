# MQ Events (Single Source of Truth)

このファイルは、会計MQドリブン設計の**唯一の真実**です。
UI・API・バッチ・投影は、ここに定義された Command / Event 以外を扱ってはいけません。

---

## 固定ルール

- UIは**Commandしか出さない**。
- 真実は**Eventのみ**。
- 帳簿・税・試算表は**Read Model（イベント結果）**。
- 同期更新は禁止。すべて非同期で伝播する。

---

## 命名規則（固定）

- Command: **命令形**（例: `ApproveJournalEntry`）
- Event: **過去形**（例: `JournalEntryApproved`）

---

## Commands（固定）

| Command | 意味 | 成果イベント |
| --- | --- | --- |
| GenerateJournalEntryLines | 仕訳下書きの生成を要求する | JournalEntryLinesGenerated |
| ApproveJournalEntry | 仕訳を確定する | JournalEntryApproved |
| RejectJournalEntry | 仕訳を差し戻す | JournalEntryRejected |
| CloseMonth | 月次を締める | MonthClosed |

---

## Events（固定）

| Event | 事実の意味 | 説明 |
| --- | --- | --- |
| JournalEntryLinesGenerated | 仕訳下書きが生成された | draftのラインが生成された事実。帳簿には反映しない。 |
| JournalEntryApproved | 仕訳が確定された | postedとして帳簿・税・試算表に反映される。 |
| JournalEntryRejected | 仕訳が差し戻された | 会計結果には反映しない（要再レビュー）。 |
| MonthClosed | 月次が締められた | **Commandゲートのみ**に影響。Event/Projectionは止めない。 |

---

## 重要

- MonthClosed 後も Event は流し続ける。
- 締後の修正は **別イベント**で扱う（例: `ReopenMonth`）
- Read Model は **mq-projections.md** を唯一の更新責務とする。
