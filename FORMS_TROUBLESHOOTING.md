# 申請フォームトラブルシューティングガイド

## 「フォームが見つかりません」エラーの解決方法

### 問題: 申請フォーム 'LEV' / 'TRP' / 'EXP' は存在しないか、正しく設定されていません

このエラーは、申請種別マスタ（`application_codes`テーブル）が正しく読み込まれていない場合に発生します。

### 原因と解決方法

#### 1. データベースに申請種別が登録されていない

**確認方法:**
1. Supabaseダッシュボードを開く
2. `application_codes`テーブルを確認
3. 以下のレコードが存在するか確認

**必要なレコード:**
```sql
-- 休暇申請
INSERT INTO application_codes (code, name, description) VALUES
('LEV', '休暇申請', '有給休暇や特別休暇の申請');

-- 交通費申請
INSERT INTO application_codes (code, name, description) VALUES
('TRP', '交通費申請', '業務に関する交通費の申請');

-- 経費精算
INSERT INTO application_codes (code, name, description) VALUES
('EXP', '経費精算', '業務に関する経費の精算申請');

-- 稟議申請
INSERT INTO application_codes (code, name, description) VALUES
('APL', '経費なし稟議申請', '経費を伴わない稟議の申請');

-- 日報
INSERT INTO application_codes (code, name, description) VALUES
('DLY', '日報', '日次業務報告');

-- 週報
INSERT INTO application_codes (code, name, description) VALUES
('WKR', '週報', '週次業務報告');
```

#### 2. データ取得順序の問題

**症状:**
- ページをリロードすると正常に動作する
- 初回アクセス時のみエラーが発生

**原因:**
`application_codes`の取得が完了する前にフォームがレンダリングされている

**解決済み:**
- `App.tsx`で`getApplicationCodes()`を先に実行
- `ApprovalWorkflowPage`に`applicationCodes`をpropsで渡す

#### 3. ブラウザキャッシュの問題

**解決方法:**
1. 完全リロード: `Ctrl + Shift + R` (Windows) / `Cmd + Shift + R` (Mac)
2. キャッシュクリア:
   - Chrome: `Ctrl + Shift + Delete`
   - 「キャッシュされた画像とファイル」を選択
   - 「データを削除」をクリック

#### 4. コードマッピングの確認

**フォームコードのマッピング:**
```typescript
// services/normalizeFormCode.ts
EXPENSE  → EXP  (経費精算)
TRANSPORT → TRP  (交通費申請)
LEAVE    → LEV  (休暇申請)
APPROVAL → APL  (稟議申請)
DAILY    → DLY  (日報)
WEEKLY   → WKR  (週報)
```

### デバッグ方法

#### 1. ブラウザコンソールでログを確認

開発者ツール（F12）を開き、以下のログを確認:

```
取得した申請種別: [...]
フォームコード検索: { rawFormCode: "...", normalizedInput: "...", ... }
マッチした申請種別: ...
```

**正常な場合:**
```javascript
取得した申請種別: [
  { id: "...", code: "LEV", name: "休暇申請", ... },
  { id: "...", code: "TRP", name: "交通費申請", ... },
  { id: "...", code: "EXP", name: "経費精算", ... }
]
フォームコード検索: { rawFormCode: "transport", normalizedInput: "TRP", ... }
マッチした申請種別: { id: "...", code: "TRP", name: "交通費申請" }
```

**異常な場合:**
```javascript
取得した申請種別: []  // 空配列
マッチした申請種別: undefined
```

#### 2. データベース接続の確認

```sql
-- Supabase SQL Editorで実行
SELECT * FROM application_codes ORDER BY code;
```

期待される結果: 6件のレコード（LEV, TRP, EXP, APL, DLY, WKR）

#### 3. RLSポリシーの確認

`application_codes`テーブルに対して、認証済みユーザーが読み取り可能か確認:

```sql
-- RLSポリシーを確認
SELECT * FROM pg_policies WHERE tablename = 'application_codes';

-- 必要に応じて追加
CREATE POLICY "Allow authenticated users to read application codes"
ON application_codes FOR SELECT
TO authenticated
USING (true);
```

### よくある質問

#### Q: 特定のフォームだけエラーになる
A: そのフォームの申請種別コードがデータベースに登録されているか確認してください。

#### Q: ページをリロードすると直る
A: データ取得のタイミング問題です。最新版では修正済みです。

#### Q: 新しい申請種別を追加したい
A: 
1. `application_codes`テーブルに新しいレコードを追加
2. `normalizeFormCode.ts`にマッピングを追加
3. 対応するフォームコンポーネントを作成
4. `ApprovalWorkflowPage.tsx`でフォームをレンダリング

### サポート

問題が解決しない場合は、以下の情報を添えてサポートに連絡してください:
- ブラウザのコンソールログ
- `application_codes`テーブルの内容
- エラーが発生するフォームの種類
