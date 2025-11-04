# デプロイメントガイド

## 🔐 セキュリティ重要事項

**APIキーはソースコードにハードコードされていません。** 環境変数として設定する必要があります。

## 環境変数の設定

本番環境では、以下の環境変数を設定してください：

### 必須
- `VITE_GEMINI_API_KEY` または `GEMINI_API_KEY`: Google Gemini APIキー
  - 取得先: https://aistudio.google.com/app/apikey

### オプション（AI機能を無効化する場合）
- `VITE_AI_OFF=1`: AI機能を完全に無効化
- `VITE_IS_AI_DISABLED=true`: AI機能を無効化（代替設定）

## デプロイ方法

### Vercel

1. Vercelプロジェクトの設定画面で環境変数を設定：
   ```
   GEMINI_API_KEY=your_actual_api_key_here
   ```

2. デプロイ：
   ```bash
   npm run build
   vercel --prod
   ```

### Netlify

1. Netlifyサイトの設定画面で環境変数を設定：
   - Site settings > Build & deploy > Environment > Environment variables
   ```
   VITE_GEMINI_API_KEY=your_actual_api_key_here
   ```

2. デプロイ：
   ```bash
   npm run build
   netlify deploy --prod
   ```

### その他のホスティングサービス

1. ビルド前に環境変数を設定：
   ```bash
   export VITE_GEMINI_API_KEY=your_actual_api_key_here
   npm run build
   ```

2. `dist`フォルダの内容をデプロイ

## ローカル開発

1. `.env`ファイルを作成（`.env.example`を参考に）：
   ```bash
   cp .env.example .env
   ```

2. `.env`ファイルにAPIキーを設定：
   ```
   VITE_GEMINI_API_KEY=your_api_key_here
   ```

3. 開発サーバーを起動：
   ```bash
   npm run dev
   ```

## トラブルシューティング

### "AI APIキーが設定されていません" エラー

**原因**: 環境変数が正しく設定されていない

**解決方法**:
1. 環境変数が設定されているか確認
2. ビルドを再実行
3. ブラウザのコンソールで `window.__ENV` を確認

### APIキーが漏洩した場合

1. **即座にAPIキーを無効化**: https://aistudio.google.com/app/apikey
2. 新しいAPIキーを生成
3. 環境変数を更新
4. 再デプロイ

## セキュリティベストプラクティス

- ✅ APIキーは環境変数として設定
- ✅ `.env`ファイルは`.gitignore`に含める
- ✅ 本番環境とローカル開発で異なるAPIキーを使用
- ❌ APIキーをソースコードにハードコードしない
- ❌ APIキーをGitにコミットしない
- ❌ APIキーを公開リポジトリに含めない
