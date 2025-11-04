# 🚨 セキュリティアラート

## APIキーの漏洩リスク

以前のコミットでAPIキーがソースコードにハードコードされていた可能性があります。

### 緊急対応が必要な場合

もしこのリポジトリが公開されている、または第三者と共有されている場合：

1. **即座にAPIキーを無効化**
   - Google AI Studio: https://aistudio.google.com/app/apikey
   - 既存のAPIキーを削除

2. **新しいAPIキーを生成**
   - 新しいAPIキーを作成
   - 環境変数として設定（ソースコードには書かない）

3. **Gitの履歴から削除（オプション）**
   
   ⚠️ **注意**: この操作は慎重に行ってください。チーム全体に影響します。
   
   ```bash
   # BFG Repo-Cleanerを使用（推奨）
   # https://rtyley.github.io/bfg-repo-cleaner/
   
   # または git filter-branchを使用
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch src/config.ts src/envShim.ts scripts/build-with-esbuild.mjs" \
     --prune-empty --tag-name-filter cat -- --all
   
   # 強制プッシュ（チームメンバーに事前通知）
   git push origin --force --all
   ```

4. **環境変数を設定**
   - ローカル: `.env`ファイル
   - 本番: ホスティングサービスの環境変数設定

## 修正済みの内容

以下のファイルからハードコードされたAPIキーを削除しました：

- ✅ `src/config.ts`
- ✅ `src/envShim.ts`
- ✅ `scripts/build-with-esbuild.mjs`

現在は環境変数のみを使用するように変更されています。

## 今後の予防策

1. `.env`ファイルは`.gitignore`に含まれています
2. `.env.example`をテンプレートとして使用
3. APIキーは常に環境変数として設定
4. コミット前に機密情報がないか確認

## 参考リンク

- [Git Secrets](https://github.com/awslabs/git-secrets) - コミット前に機密情報を検出
- [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/) - Git履歴から機密情報を削除
- [GitHub: Removing sensitive data](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
