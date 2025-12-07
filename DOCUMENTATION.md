# 資料作成ツール 簡易マニュアル

## 1. 基本機能

### 1.1 メイン機能
- 提案書の自動作成
- テンプレートからの差し替え
- データベース連携による情報取得

## 2. テーブル連携

### 2.1 連携テーブル一覧

| テーブル名 | 用途 | 主キー |
|------------|------|--------|
| `documents` | ドキュメント管理 | `id` |
| `templates` | テンプレート管理 | `template_id` |
| `users` | ユーザー情報 | `user_id` |

### 2.2 主要テーブル構造

#### documents テーブル
```sql
CREATE TABLE documents (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    template_id INTEGER REFERENCES templates(id),
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 3. 使い方

### 3.1 基本操作
1. 左メニューから「資料作成」を選択
2. 「新規作成」ボタンをクリック
3. テンプレートを選択
4. 必要項目を入力
5. 「保存」または「ダウンロード」をクリック

### 3.2 注意事項
- 保存は自動的に行われます
- インターネット接続が必要です
- データは定期的にバックアップされます

## 4. トラブルシューティング

| 現象 | 対処法 |
|------|--------|
| 保存に失敗する | インターネット接続を確認 |
| テンプレートが表示されない | ページを再読み込み |
| エラーが表示される | スクリーンショットを撮ってITサポートへ |

## 5. 問い合わせ先
- ITサポート: support@example.com
- 緊急時: 内線1234
