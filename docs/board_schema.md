# 統合掲示板テーブル説明書

本書は AI 議事録作成ボットなどのシステム利用者が Supabase 上の掲示板テーブルを正しく利用するためのリファレンスです。スキーマは `integrated_board_tables.sql`、RPC は `integrated_board_rpc.sql` に定義されています。

---

## 1. posts – 掲示板の親テーブル
| 列名 | 型 | 説明 |
| --- | --- | --- |
| `id` | `UUID` | 投稿 ID。`gen_random_uuid()` により自動生成。 |
| `title` | `TEXT` | 投稿タイトル。任意。 |
| `content` | `TEXT NOT NULL` | 投稿本文。Markdown 等のプレーンテキスト。 |
| `visibility` | `TEXT` | 公開範囲。`all`(全員)、`public`(部門横断公開)、`private`(作成者のみ)、`assigned`(担当者のみ)。チェック制約で値を制限。 |
| `is_task` | `BOOLEAN` | タスク扱いかどうか。`true` の場合、担当者や期限の設定を推奨。 |
| `due_date` | `TIMESTAMPTZ` | タスクの期限。 |
| `completed` | `BOOLEAN` | タスク完了フラグ。`complete_task` RPC で更新。 |
| `created_at`, `updated_at` | `TIMESTAMPTZ` | 作成 / 更新日時。`updated_at` は `set_posts_updated_at` トリガーで自動更新。 |
| `created_by` | `UUID` | 投稿者 (`auth.users.id`)。RLS により本人または可視ユーザーのみ参照可。 |

### 用途
- AI が議事録を掲示する際は `create_post` RPC を呼び、`title`・`content`・`visibility` を設定する。
- `assigned` で投稿する場合は `post_assignments` に担当者を追加する必要がある。
- `is_task = true` かつ `due_date` を入れることでタスクリスト UI に表示される。

---

## 2. post_assignments – 担当者テーブル
| 列名 | 型 | 説明 |
| --- | --- | --- |
| `id` | `UUID` | レコード ID。 |
| `post_id` | `UUID` | 紐付く投稿。`ON DELETE CASCADE`。 |
| `user_id` | `UUID` | 担当者 ( `auth.users` )。 |
| `assigned_at` | `TIMESTAMPTZ` | 割当日時。 |
| `UNIQUE(post_id, user_id)` | - | 同じ担当者を二重登録しない。 |

### 用途
- `create_post` RPC の `p_assignees` に UUID 配列を渡すと自動挿入される。
- `complete_task` RPC は、ここに割り当てられているユーザーのみ実行可能 (社長ユーザーを除く)。

---

## 3. post_comments – コメントテーブル
| 列名 | 型 | 説明 |
| --- | --- | --- |
| `id` | `UUID` | コメント ID。 |
| `post_id` | `UUID` | 対象投稿。`ON DELETE CASCADE`。 |
| `content` | `TEXT` | コメント本文。 |
| `user_id` | `UUID` | コメント投稿者。 |
| `created_at` | `TIMESTAMPTZ` | 登録日時。 |

### 用途
- `add_comment` RPC を通じて書き込む。AI がフォローアップをする際は `p_post_id` と `p_content` を指定する。
- RLS により、閲覧・投稿はいずれも「投稿を閲覧できるユーザー」だけに許可される。

---

## 4. post_notifications – 通知履歴 (任意)
| 列名 | 型 | 説明 |
| --- | --- | --- |
| `id` | `UUID` | 通知 ID。 |
| `post_id` | `UUID` | 対象投稿。 |
| `user_id` | `UUID` | 通知先ユーザー。 |
| `notification_type` | `TEXT` | `new_post` / `new_comment` / `task_assigned` / `task_completed` のいずれか。 |
| `sent_at` | `TIMESTAMPTZ` | 通知送信日時。 |
| `UNIQUE(post_id, user_id, notification_type)` | - | ダブル通知防止。 |

### 用途
- 現状アプリでは必須ではないが、AI が外部通知を送る場合に使用する拡張ポイント。

---

## 5. Row Level Security / ポリシー
| テーブル | 主なポリシー |
| --- | --- |
| `posts` | 「閲覧可能ユーザーのみ参照」「作成者のみ更新」。`visibility` や `post_assignments` を参照。 |
| `post_assignments` | 割当本人、または投稿者が参照可能。 |
| `post_comments` | 投稿の閲覧権限を持つユーザーのみ参照・投稿可能。 |
| `post_notifications` | 自分あての通知のみ参照可能。 |

AI であっても Supabase セッションは RLS の対象。サービスロールキーを使う場合はポリシーをバイパスできるが、リーク対策として最小限に留めること。

---

## 6. RPC (補助関数)
| 関数名 | 説明 / 引数 |
| --- | --- |
| `get_user_posts(p_user_id UUID)` | 指定ユーザーが閲覧可能な投稿一覧を返す。AI から `null` を渡すと `auth.uid()` または社長ユーザーで判定。 |
| `create_post(p_title, p_content, p_visibility, p_is_task, p_due_date, p_assignees, p_created_by)` | 投稿と割当をまとめて作成。`p_created_by` が `NULL` の場合は `auth.uid()` が使用される。 |
| `add_comment(p_post_id, p_content, p_user_id)` | コメント追加。 |
| `complete_task(p_post_id, p_user_id)` | 担当ユーザー (または社長) がタスクを完了にする。 |
| `board_admin_user()` | 社長(全権ユーザー)の UUID を返すヘルパー。 |

AI ボットは原則として RPC 経由で操作することで、アプリと同一のビジネスロジックを共有できる。

---

## 7. 実装ガイドライン (AI 投稿の推奨手順)
1. **ユーザー解決**: `getUsers()` API ( `/api/users` ) から投稿者と担当者の UUID を取得。社長ユーザー ID は `board_admin_user()` と一致させるとよい。
2. **投稿作成**: `POST /api/board/posts` に以下の JSON を送信。<br>
   ```json
   {
     "title": "会議議事録 - 2025-02-01",
     "content": "...本文...",
     "visibility": "assigned",
     "is_task": false,
     "assignees": ["<UUID1>", "<UUID2>"],
     "created_by": "<AI用ユーザーUUID>"
   }
   ```
3. **コメント追記**: 既存投稿に追記する場合は `POST /api/board/posts/{id}/comments` を使用。
4. **タスク完了**: アクションアイテムが完了したら `PUT /api/board/posts/{id}/complete` を呼び、根拠コメントを残す。

---

## 8. トラブルシューティング
- **500: Database client not initialized**  
  `SUPABASE_URL` と `SUPABASE_SERVICE_ROLE_KEY` が環境変数に設定されているか確認。
- **投稿が表示されない**  
  `visibility` と `post_assignments` の設定が現在のユーザーで閲覧可能になっているか確認。
- **タスク完了時に「User is not assigned」**  
  `post_assignments` に当該ユーザーが含まれているか確認。社長ユーザーのみ制約を回避可能。

---

これで AI ボットが掲示板テーブルを利用する際に必要な構造と制約を把握できます。詳細は `integrated_board_tables.sql` と `integrated_board_rpc.sql` を参照してください。
