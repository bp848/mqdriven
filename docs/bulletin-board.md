# 社内掲示板（Knowledge Board)

社内の手順書・マニュアル・運用連絡をこのファイルに追記していきます。新規投稿を追加する際は以下テンプレートをコピーし、最新エントリとして追記してください。

````markdown
## 投稿タイトル
- 日付: YYYY-MM-DD
- 担当: 氏名
- 概要: 1行サマリー

### 1. 背景 / 目的
### 2. システム構成 / 関連モジュール
### 3. 業務フロー / 操作手順
### 4. テスト観点 / 受け入れ手順
### 5. 補足メモ
````

---

## FAX自動入力機能マニュアル
- 日付: 2025-11-19
- 担当: Cascade（支援）
- 概要: FAXで受領した資料をOCRし案件・見積へ連携する一連のオペレーションと受入テスト手順

### 1. 背景 / 目的
- 紙で届く受注・見積・外注請求書をPDF/画像化してアップロードし、Gemini OCRで抽出した構造化データを案件・受注・経費ドラフトへ接続する。
- オペレーターの入力負荷軽減と、支払先・顧客マスタとの突合精度向上が主目的。

### 2. システム構成 / 関連モジュール
| レイヤ | 説明 |
| --- | --- |
| フロントエンド | `FaxOcrIntakePage` がアップロード UI, OCR結果サマリー、編集モーダルを提供 @components/sales/FaxOcrIntakePage.tsx |
| サービス層 | `dataService` が Supabase `fax_intakes` テーブルを CRUD し、`requestFaxOcr` で Functions を起動 @services/dataService.ts |
| OCRワーカー | `supabase/functions/fax-ocr-intake` がストレージからファイルを取得し Gemini OCR → JSON整形 → マスタ突合 → 結果保存を実行 |
| マスタ照合 | `utils/matching.ts` で支払先・顧客名を正規化し部分一致検索を実装 |

### 3. 業務フロー / 操作手順
1. **アップロード準備**: 文書種別（受注/見積/外注請求/不明）と備考を入力し、PDF/画像ファイルをドラッグ＆ドロップで選択。
2. **送信**: 「アップロード & OCR開始」で Supabase Storage に保存 → `fax_intakes` レコード生成（`status=draft`, `ocrStatus=pending`）。
3. **OCR実行**: 自動で Functions を呼び出し、`ocr_status` を `processing` → 完了時 `done` と JSON/Raw テキストを格納。失敗時は `failed` + エラーメッセージ。
4. **結果確認**: 取り込みキューで発行元・金額・振込先・顧客候補などを確認。支払先/顧客はマスタ候補がラベル表示され、メモとリンクID（案件/受注/見積）を手動編集可能。
5. **業務側処理**: ステータスを `ready` → `linked` に更新して管理テーブルへの連携完了とする。不要データは削除（`status=deleted`）。必要に応じ再OCRを実行。

### 4. 受け入れテスト手順
- **シナリオ1: 正常アップロード〜OCR完了**
  1. キューをリフレッシュして初期状態を確認。
  2. テストPDFを「受注」種別でアップロード。
  3. トースト成功表示・フォームリセットを確認。
  4. レコードが一覧に追加され、`processing` → `done` に遷移し、OCRサマリー（発行元/金額/振込先/明細）が表示されること。
- **シナリオ2: 自動突合精度**
  1. シナリオ1の結果で「支払先候補」「顧客候補」がマスタ名称と一致することを確認。
  2. 表記揺れデータで再テストし、部分一致ロジックで候補が検出されること。
- **シナリオ3: OCR失敗〜再実行**
  1. 読み取り不能ファイルを投入し `failed` 状態とエラーメッセージ表示を確認。
  2. 「OCR再実行」で `processing` → `failed/done` へ遷移し、トーストと `ocr_error_message` 更新を確認。
- **シナリオ4: 編集・リンク付け**
  1. 完了済み行の編集モーダルで `status=ready`、`linkedOrderId` を入力。
  2. 保存後、バッジ・リンク表示が即時反映されること。
- **シナリオ5: 削除・権限**
  1. 「削除」で行が一覧から消え、ソフトデリートされること。
  2. 未ログイン状態でアップロード操作がブロックされること。

### 5. 補足メモ
- **バリデーション**: PDF/画像のみ受け付け、その他は即エラー表示。
- **並列実行**: `isUploading` や `isRefreshing` で多重操作を抑止。
- **経費ドラフト**: `docType=vendor_invoice` の場合、OCR JSON から `application_drafts` を自動生成（Supabaseログで確認）。
- **ログ確認**: Supabase の `fax_intakes` / `application_drafts` / Functions ログでトレース可能。

---

## MQ会計ERP 申請・承認ワークフローUATガイド
- 日付: 2025-11-19
- 担当: Cascade（支援）
- 概要: ログイン〜申請作成〜承認/差戻し〜下書き再開までの機能概要と受入テストシナリオ

### 1. 背景 / 目的
- MQ会計ERPはサイドナビから「承認一覧」「各申請フォーム」を切り替えて、社員が工数/経費などの申請と承認者の審査を一気通貫で実施する@App.tsx#69-216。
- 納品先の受入テスト向けに、①ログイン、②申請作成、③承認/差戻しの観点を標準化し、社内UAT担当が同一シナリオで検証できるようにすることが本ドキュメントの目的。

### 2. システム構成 / 関連モジュール
| レイヤ | 説明 |
| --- | --- |
| 認証 | Supabase接続が設定され、`VITE_BYPASS_SUPABASE_AUTH` が無効な場合のみログイン必須。未設定時はセットアップ案内にフォールバック@App.tsx#147-212,@App.tsx#772-824 |
| ログイン画面 | `LoginPage` がメール/パスワード + Google OAuthを提供し、社内ドメイン以外を即時拒否。モバイルOAuth時はセッション残骸をクリアしてからリダイレクト@components/LoginPage.tsx#18-195 |
| 承認ワークフロー | `ApprovalWorkflowPage` が承認一覧とフォームを切替管理。申請コード→画面マッピングは `APPLICATION_FORM_PAGE_MAP` で定義@components/accounting/ApprovalWorkflowPage.tsx#62-335,@App.tsx#116-253 |
| フォーム | 経費（`ExpenseReimbursementForm`）は明細・AI OCR・支払先マスタ連携を搭載。他の交通費/休暇/稟議/日報/週報も個別実装し、共通で `ApprovalRouteSelector` を利用@components/forms/*.tsx |
| 承認操作 | `ApplicationDetailModal` が詳細表示と承認/差戻し操作を提供し、`dataService` が `applications` への更新を担当@components/ApplicationDetailModal.tsx#1-247,@services/dataService.ts#1149-1424 |
| 下書き再開 | `handleResumeApplicationDraft` と `ApprovalWorkflowPage` が `draft` ステータス申請をフォームへバインド@App.tsx#233-253,@components/accounting/ApprovalWorkflowPage.tsx#200-245 |

### 3. 業務フロー / 操作手順
1. **ログイン判定**: Supabase資格情報を読み込み、`shouldRequireAuth` が true の場合のみログインを表示。未設定ならセットアップパネルへ遷移。
2. **ログイン処理**: メール/パスワードまたはGoogle OAuthでサインイン。社内ドメイン以外は即エラー。成功後はヘッダー/サイドバー付きダッシュボードへ遷移@App.tsx#836-918。
3. **申請作成**: サイドバー「申請・承認」から対象フォーム（経費EXPなど）を開き、明細や添付を入力。`ApprovalRouteSelector` で承認ルートを確定し送信。
4. **承認一覧**: `ApprovalWorkflowPage` が「要承認」「自分の申請」「完了済み」を切替表示し、`applications` テーブルからステータス別に取得。
5. **承認/差戻し**: 詳細モーダルで内容確認後、`approveApplication` または `rejectApplication` を実行して次ステップ or 完了ステータス更新。差戻し時は理由必須で申請者通知。
6. **下書き再開**: 「自分の申請」タブから `draft` 行の「下書きを再開」を押すと、対応フォームへ遷移し保存済みデータを再ロード。

### 4. テスト観点 / 受け入れ手順
#### テスト前提
- `supabaseCredentials.ts` に Supabase URL/anon key を設定し、`VITE_BYPASS_SUPABASE_AUTH` を未設定または `0` にする@App.tsx#147-212。
- Supabaseに社員ドメインで2アカウント（申請者・承認者）を作成し `employees/users` テーブルと紐付け。承認者は対象承認ルートに含める@services/dataService.ts#1149-1188。
- `approval_routes` に少なくとも1ルート（例: 経費ルート）を、`application_codes` に EXP/TRP/LEV/APL/DLY/WKR を用意。
- ブラウザはChrome最新版。経費精算で使用する支払先・勘定科目を事前登録@components/forms/ExpenseReimbursementForm.tsx#1-120。

#### シナリオ一覧
1. **シナリオ1: メール/パスワードログイン**  
   - 手順: 社員ドメイン + 正しいPWでログイン。  
   - 期待: エラーなしでホームへ遷移し、右上にメール表示。`shouldRequireAuth` が true でも Header/Sidebar が描画される@App.tsx#147-212,@App.tsx#836-918。
2. **シナリオ2: 許可ドメイン外アドレス拒否**  
   - 手順: 外部メールでログイン試行。  
   - 期待: 「社員専用」「許可ドメイン表示」のエラーが出てURLクエリもリセット@components/LoginPage.tsx#18-46。
3. **シナリオ3: Google OAuthログイン**  
   - 手順: 「Googleでログイン」→ Supabase OAuth → 成功後ホーム表示。  
   - 期待: モバイル時は localStorage の Supabaseキーを削除し、Auth Callback後に復帰@components/LoginPage.tsx#91-140,@App.tsx#772-824。
4. **シナリオ4: 経費精算申請の作成/送信 (EXP)**  
   - 手順: 経費フォームで明細入力→AI-OCR任意→承認ルート選択→送信→「承認一覧>自分の申請」で確認。  
   - 期待: `submitApplication` が `applications` に `pending_approval` で挿入し、適切な `approver_id` へアサイン@components/forms/ExpenseReimbursementForm.tsx#1-120,@services/dataService.ts#1171-1188。
5. **シナリオ5: 承認者による承認**  
   - 手順: 承認者でログイン→「要承認」で申請を開き承認→「完了済」タブで確認。  
   - 期待: `approveApplication` が次ルート引継ぎor最終承認を行い、完了時には `approved_at` 記録と通知送信@components/ApplicationDetailModal.tsx#77-210,@services/dataService.ts#1291-1370。
6. **シナリオ6: 承認者による差戻し**  
   - 手順: 別申請で差戻し理由を入力→送信→申請者視点で理由表示を確認。  
   - 期待: 理由未入力時はバリデーション。送信後 `applications.rejection_reason` が保存され詳細モーダルにも表示@components/ApplicationDetailModal.tsx#204-236,@services/dataService.ts#1375-1424。
7. **シナリオ7: 下書きの再開**  
   - 手順: 任意フォームを「下書き保存」→承認一覧で「下書きを再開」。  
   - 期待: `handleResumeApplicationDraft` が `APPLICATION_FORM_PAGE_MAP` を参照し対象フォームを表示、`resumedApplication` で入力値を復元@App.tsx#233-253,@components/accounting/ApprovalWorkflowPage.tsx#200-245。

### 5. 補足メモ
- **エビデンス収集**: 各シナリオで画面キャプチャ（ログイン/フォーム/承認モーダル等）とSupabaseテーブルの該当レコードを保存し、日付/担当者を記録。エラー時はブラウザDevToolsのConsole/Networkログも確保し、`services/dataService` のどのAPIが失敗したかメモ。
- **自動化提案**: Playwright等で上記シナリオを自動or半自動化し、テストケース表に転記。受入後は社内Wikiへ転載しリグレッション観点として流用。
- **将来TODO**: OAuthドメイン制限の構成値を環境変数化し、オンボーディング向けサンプルデータをテンプレ化する.
