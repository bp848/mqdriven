# リード詳細ページ右カラム消失の問題

## 問題
`components/sales/LeadDetailModal.tsx` の324-326行目で、右カラムの中身が空になっています。

## 現在の状態（324-326行目）
```tsx
{/* Right Column */}
<div className="h-full bg-slate-900 rounded-lg p-4 flex flex-col overflow-hidden">
   {/* AI Assistant UI Here */}
</div>
```

## 必要な機能

右カラムには以下の機能が表示されるべきです：

### 1. タブナビゲーション
- 企業情報タブ
- 見積もり案タブ
- 提案書案タブ
- 返信メール案タブ

### 2. AI機能ボタン
- 企業調査ボタン（AI）
- 提案パッケージ生成ボタン（AI）
- 返信メール生成ボタン（AI）
- 見積もり保存ボタン

### 3. コンテンツ表示エリア
- 企業調査結果（`companyInvestigation`）
- AI生成見積もり（`lastProposalPackage?.estimate`）
- AI生成提案書（`lastProposalPackage?.proposal`）
- AI生成返信メール（`aiReplyEmail`）

## 復元方法

### オプション1: Gitから復元
```bash
git diff HEAD -- components/sales/LeadDetailModal.tsx
git checkout HEAD -- components/sales/LeadDetailModal.tsx
```

### オプション2: 手動で再実装
右カラムの実装を再作成する必要があります。

## 必要なState
- `activeTab`: 現在のタブ
- `companyInvestigation`: 企業調査結果
- `lastProposalPackage`: AI生成提案パッケージ
- `aiReplyEmail`: AI生成返信メール
- `isInvestigating`: 企業調査中フラグ
- `isGeneratingPackage`: パッケージ生成中フラグ
- `isGeneratingEmail`: メール生成中フラグ

## 緊急対応
右カラムのコンテンツを復元してください。
