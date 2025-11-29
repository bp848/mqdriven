# 承認フォームシステムの構造メモ

## 全体像
- 承認ワークフロー周りの UI は `components/accounting/ApprovalWorkflowPage.tsx` がエントリーポイントです。申請一覧 (`view="list"`) と個別フォーム (`view="form"`) を切り替え、必要なデータを `dataService` から取得します。【F:components/accounting/ApprovalWorkflowPage.tsx†L1-L213】
- `ApprovalWorkflowPage` では URL などから渡されるフォームコードを `normalizeFormCode` で標準化し、対応するフォームコンポーネントを描画します。【F:components/accounting/ApprovalWorkflowPage.tsx†L170-L204】【F:services/normalizeFormCode.ts†L1-L8】
- フォームの定義 (`ApplicationCode`) や申請一覧 (`ApplicationWithDetails`) はすべて `services/dataService.ts` にあるインメモリの `demoState` から取得・保存されます。【F:services/dataService.ts†L711-L749】

## データレイヤー
- `dataService` は承認ルート (`ApprovalRoute`)、勘定科目、部署、支払先などフォームが依存するマスター情報を取得する関数を提供します。例: `getApprovalRoutes`、`getDepartments`、`getPaymentRecipients`。【F:services/dataService.ts†L523-L540】【F:components/forms/DepartmentSelect.tsx†L1-L38】【F:components/forms/PaymentRecipientSelect.tsx†L1-L65】
- 申請データは `Application` 型として保存され、申請 ID、申請種別、承認ルート、現在の承認レベルなどを保持します。【F:types.ts†L430-L456】
- `submitApplication` はフォームごとに作られた `formData` を受け取り、承認ルートから初期の承認者を決定して `demoState` に申請を追加します。【F:services/dataService.ts†L715-L749】

## 共通 UI コンポーネント
- すべての申請フォームで承認ルートを選択する UI として `ApprovalRouteSelector` を使用します。初回マウント時に承認ルート一覧をロードし、必要であれば特定のルートを強制選択します。【F:components/forms/ApprovalRouteSelector.tsx†L1-L84】
- 勘定科目・支払先・部門といったマスター選択 UI も専用コンポーネントとして分離されており、マウント時に `dataService` から一覧をフェッチしてセレクトボックスを描画します。【F:components/forms/AccountItemSelect.tsx†L3-L41】【F:components/forms/PaymentRecipientSelect.tsx†L1-L65】【F:components/forms/DepartmentSelect.tsx†L1-L38】

## 代表的なフォーム
- **経費精算 (EXP)**: 明細行の追加・削除、AI-OCR での明細取込、振分先（顧客/案件/発注）選択など最も多くのマスター情報に依存します。送信時は部門・承認ルート・各明細の必須入力を検証した上で `submitApplication` を呼び出します。【F:components/forms/ExpenseReimbursementForm.tsx†L2-L360】
- **交通費精算 (TRP)**: 経費フォームと同様に明細行で構成され、OCR で領収書から出発地/目的地を推測します。【F:components/forms/TransportExpenseForm.tsx†L1-L220】
- **稟議フォーム (APL)**: PDF/ZIP をドラッグ＆ドロップで受け取り、`parseApprovalDocument` による AI-OCR で件名と本文を下書きします。複数ファイルの展開や AI チャット連携が特徴です。【F:components/forms/ApprovalForm.tsx†L1-L206】
- **日報・週報・休暇申請**: 入力項目はシンプルですが、AI による文面生成 (`generateDailyReportSummary` など) やチャットモーダルを通じた作成支援が組み込まれています。【F:components/forms/DailyReportForm.tsx†L1-L200】【F:components/forms/LeaveApplicationForm.tsx†L1-L196】
- **日報の保存先と可視化**: 日報フォームで送信された内容は `applications` テーブルに `application_code_id = DLY` として格納され、`MySchedulePage` から同テーブルのレコードを集計してサマリ表示や mbox 取り込みと連携します。【F:services/dataService.ts†L1233-L1281】【F:components/MySchedulePage.tsx†L392-L575】

## AI 連携
- 各フォームの OCR やサマリ生成は `services/geminiService.ts` のユーティリティを使用します。OCR 用関数 (`extractInvoiceDetails`, `parseApprovalDocument`) やサマリ生成 (`generateDailyReportSummary`) は API キーの有無と AI 停止フラグを検証してから Gemini API を呼び出します。【F:components/forms/ExpenseReimbursementForm.tsx†L137-L177】【F:components/forms/TransportExpenseForm.tsx†L75-L111】【F:components/forms/ApprovalForm.tsx†L99-L123】【F:components/forms/DailyReportForm.tsx†L51-L71】

## 申請データのライフサイクル
1. フォーム表示時に `ApprovalWorkflowPage` が申請コード情報と必要なマスターを読み込みます。【F:components/accounting/ApprovalWorkflowPage.tsx†L54-L79】【F:components/accounting/ApprovalWorkflowPage.tsx†L188-L204】
2. ユーザーがフォームを送信すると、各フォームが `submitApplication` を呼び出し、`demoState.applications` に申請が保存されます。【F:components/forms/ExpenseReimbursementForm.tsx†L215-L226】【F:components/forms/TransportExpenseForm.tsx†L185-L191】【F:components/forms/ApprovalForm.tsx†L159-L166】
3. 申請一覧タブでは `getApplications` の結果に基づいて、承認待ち／提出済み／完了済みのタブを構築します。【F:components/accounting/ApprovalWorkflowPage.tsx†L41-L161】
4. 承認・差戻しアクションは同じ `dataService` 内の `approveApplication` / `rejectApplication` によりステータスが更新されます。【F:components/accounting/ApprovalWorkflowPage.tsx†L100-L124】【F:services/dataService.ts†L751-L772】

## 新しいフォームを追加する際の手順
1. `components/forms/` に新しいフォームコンポーネントを作成し、`ApprovalRouteSelector` と共通の送信ハンドラ (`submitApplication`) を利用する。
2. 必要なマスター情報があれば `dataService` にフェッチ関数を追加し、専用セレクタを作成して流用する。
3. `services/normalizeFormCode.ts` にコードを追加し、`ApprovalWorkflowPage` の `switch` 文にフォームを登録する。【F:services/normalizeFormCode.ts†L1-L8】【F:components/accounting/ApprovalWorkflowPage.tsx†L198-L204】
4. デモデータで利用する場合は `dataService` の `demoState.applicationCodes` や関連マスターに初期値を追加する。

このメモを起点に、各フォームのバリデーションや AI 利用ロジックを追いながら改修箇所を把握できます。
