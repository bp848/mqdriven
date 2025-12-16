# Google Calendar Sync (ERP 日報 -> Google / 双方向)

このドキュメントは、日報（application_code='DLY'）を Google カレンダーと同期するための実装方針です。

## データマッピング
- 取得元: `public.applications`（application_code='DLY'）
- key: `applications.id` を Google `extendedProperties.private.erp_event_id` に格納
- title: `form_data->>'customerName'`
- start_at: `form_data->>'reportDate' || ' ' || form_data->>'startTime'`
- end_at: `form_data->>'reportDate' || ' ' || form_data->>'endTime'`
- updated_at: `applications.updated_at`
- description: `form_data->>'activityContent'`
- location: 空
- attendees: `applicant_id` からメールを取得（必要なら追加参加者を拡張）

## 認証・設定
- Google OAuth クレデンシャル（client_id / client_secret / redirect_uri）は設定画面に保存。
- `/api/google/oauth/start` → 同意画面へリダイレクト。
- `/api/google/oauth/callback` → トークンを取得し `public.user_google_tokens` に保存（user_id, access_token, refresh_token, expires_at など）。

## テーブル追加
- `scripts/user_google_tokens.sql` を適用して `public.user_google_tokens` を作成。

## 同期フロー
1) ERP→Google  
   - DLY日報を取得しマッピング。  
   - `erp_event_id` が存在すれば更新、なければ新規作成。削除は delete。  
   - `updated_at` で差分判定。

2) Google→ERP  
   - Google カレンダー watch（push通知）を設定。  
   - Webhookで変更を受信し、`erp_event_id` があれば更新、なければ新規作成。  
   - 競合は「更新日時が新しい方を優先」。

3) 監視切れ対策  
   - 5〜10分間隔のポーリングで ERP→Google の整合性を担保し、watch 有効期限前に再登録。

## 今後の実装タスク
- `/api/google/oauth/start` `/api/google/oauth/callback` エンドポイント追加。
- `user_google_tokens` のCRUDとトークンリフレッシュユーティリティ実装。
- ERP→Google 差分同期ジョブと Google→ERP Webhook 実装。
- watch 再作成 & ポーリングジョブのスケジューラ設定。
