# Leadsデータが取得できない問題のデバッグ手順

## 現状
- Supabase `leads` テーブルには11件のデータがある
- RLSは無効化されている
- しかし画面にはデモデータ（2件）が表示されている

## デバッグ手順

### 1. ブラウザのコンソールでエラーを確認

F12 → Console タブで以下を確認：

```
Failed to fetch leads from Supabase: [エラーメッセージ]
```

このエラーメッセージを確認してください。

### 2. Networkタブでリクエストを確認

F12 → Network タブ → ページをリロード

以下のリクエストを探す：
- URL: `https://[your-project].supabase.co/rest/v1/leads`
- Method: GET
- Status: 200 OK か？

**確認ポイント：**
- ステータスコード
- Response タブの内容（データが返ってきているか）
- Headers タブの `apikey` と `Authorization`

### 3. Supabase接続情報を確認

コンソールで以下を実行：

```javascript
// 環境変数を確認
console.log('SUPABASE_URL:', window.__ENV?.VITE_SUPABASE_URL);
console.log('SUPABASE_KEY:', window.__ENV?.VITE_SUPABASE_ANON_KEY ? '✓ SET (' + window.__ENV.VITE_SUPABASE_ANON_KEY.length + ' chars)' : '✗ NOT SET');

// Supabase接続を確認
console.log('hasSupabaseCredentials:', typeof window.__ENV?.VITE_SUPABASE_URL !== 'undefined' && typeof window.__ENV?.VITE_SUPABASE_ANON_KEY !== 'undefined');
```

### 4. 手動でデータ取得を試す

コンソールで以下を実行：

```javascript
// Supabaseから直接データを取得
const { createClient } = supabase;
const supabaseUrl = window.__ENV?.VITE_SUPABASE_URL;
const supabaseKey = window.__ENV?.VITE_SUPABASE_ANON_KEY;

if (supabaseUrl && supabaseKey) {
  const client = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await client.from('leads').select('*');
  console.log('Manual fetch - data:', data);
  console.log('Manual fetch - error:', error);
  console.log('Manual fetch - count:', data?.length);
} else {
  console.log('Supabase credentials not found');
}
```

## よくある原因

### 原因1: 環境変数が読み込まれていない
- `.env` ファイルが正しい場所にあるか
- `VITE_SUPABASE_URL` と `VITE_SUPABASE_ANON_KEY` が設定されているか
- 開発サーバーを再起動したか

### 原因2: CORSエラー
- Supabase Dashboard → Settings → API → CORS で許可されているか

### 原因3: APIキーが無効
- Supabase Dashboard → Settings → API で `anon` キーを確認
- キーが正しくコピーされているか

### 原因4: テーブル名の大文字小文字
- PostgreSQLでは大文字小文字を区別する
- テーブル名は `leads` (小文字) か？

### 原因5: ネットワークエラー
- インターネット接続を確認
- ファイアウォールやプロキシの設定

## 解決策

### 一時的な解決策：デバッグログを追加

`services/dataService.ts` の `getLeads()` 関数にログを追加：

```typescript
export const getLeads = async (): Promise<Lead[]> => {
  console.log('getLeads - hasSupabaseCredentials:', hasSupabaseCredentials());
  
  if (hasSupabaseCredentials()) {
    try {
      const supabaseClient = getSupabase();
      console.log('getLeads - supabaseClient:', supabaseClient);
      
      const { data, error } = await supabaseClient
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

      console.log('getLeads - data:', data);
      console.log('getLeads - error:', error);
      console.log('getLeads - data count:', data?.length);

      if (error) throw error;

      if (data) {
        return data.map((row: any) => ({
          // ... mapping
        }));
      }
    } catch (error) {
      console.error('Failed to fetch leads from Supabase:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
    }
  } else {
    console.log('getLeads - Supabase credentials not found, using demo data');
  }
  
  console.log('getLeads - returning demo data');
  return deepClone(demoState.leads);
};
```

これらのログを確認して、どこで失敗しているか特定してください。
