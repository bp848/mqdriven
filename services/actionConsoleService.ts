import { EmployeeUser } from '../types';

export type Severity = 'critical' | 'warning' | 'info';
export type Status = 'success' | 'failure' | 'pending';

export interface ActionLogEntry {
  id: string;
  timestamp: string;
  module: string;
  severity: Severity;
  status: Status;
  actor: string;
  actorDepartment: string;
  summary: string;
  detail: string;
  ip: string;
  context?: string;
  ref?: string;
}

type LogInput = Omit<ActionLogEntry, 'id' | 'timestamp' | 'ip'> & {
  id?: string;
  timestamp?: string;
  ip?: string;
};

const MAX_ENTRIES = 200;

const BASE_LOGS: ActionLogEntry[] = [
  {
    id: 'LOG-241205-001',
    timestamp: '2024-12-05T09:11:00+09:00',
    module: '承認ワークフロー',
    severity: 'critical',
    status: 'failure',
    actor: '石嶋 洋平',
    actorDepartment: 'システム管理部',
    summary: '経費精算申請 (#EXP-20241205-09) の承認処理がタイムアウトしました',
    detail: '承認ルート「営業部長決裁」の第2ステップで、Supabase RPC への接続が 30 秒を超過しました。',
    ip: '10.22.14.88',
    context: 'approval_id=ce1407, route=v2-sales, level=2',
  },
  {
    id: 'LOG-241205-002',
    timestamp: '2024-12-05T08:59:00+09:00',
    module: '通知メール',
    severity: 'warning',
    status: 'success',
    actor: 'システム',
    actorDepartment: 'バックグラウンドジョブ',
    summary: '稟議申請の差戻し通知を再送しました',
    detail: 'SMTP サーバーから一時的に 421 エラーが返却されたため、キューに再投入し 2 回目の試行で成功。',
    ip: '10.10.10.2',
    ref: 'MAIL-20241205-017',
  },
  {
    id: 'LOG-241205-003',
    timestamp: '2024-12-05T08:45:00+09:00',
    module: 'ユーザー管理',
    severity: 'info',
    status: 'success',
    actor: '石嶋 洋平',
    actorDepartment: 'システム管理部',
    summary: 'ユーザー「中村優子」の権限を admin → user に変更しました',
    detail: '理由: 部門異動（システム権限の剥奪）。 操作は MFA によって確認済み。',
    ip: '10.22.14.88',
    ref: 'USER-0042',
  },
  {
    id: 'LOG-241205-004',
    timestamp: '2024-12-05T08:30:00+09:00',
    module: 'AIコンシェルジュ',
    severity: 'warning',
    status: 'failure',
    actor: 'システム',
    actorDepartment: 'AIサービス',
    summary: 'Gemini API から rate-limit 429 が返却されました',
    detail: 'キュー内の 3 件のリクエストが待機状態になり、5 秒後に自動リトライされます。',
    ip: '10.20.0.10',
    context: 'ai_mode=proposal-support',
  },
  {
    id: 'LOG-241204-021',
    timestamp: '2024-12-04T20:15:00+09:00',
    module: 'マスタ管理',
    severity: 'info',
    status: 'success',
    actor: '田所 祐介',
    actorDepartment: '経理部',
    summary: '勘定科目「6116_広告宣伝費」を新規登録しました',
    detail: '部門配賦: 営業本部, 取引区分: 費目。作成後すぐに承認されました。',
    ip: '10.15.9.44',
    ref: 'ACCT-6116',
  },
  {
    id: 'LOG-241204-015',
    timestamp: '2024-12-04T18:02:00+09:00',
    module: '監査ログ',
    severity: 'info',
    status: 'success',
    actor: 'システム',
    actorDepartment: '背景ジョブ',
    summary: 'ログローテーションを完了しました',
    detail: '過去 30 日以前のアクションログをアーカイブ（S3）へ退避。',
    ip: '10.10.10.1',
  },
  {
    id: 'LOG-241204-010',
    timestamp: '2024-12-04T16:30:00+09:00',
    module: '通知メール',
    severity: 'warning',
    status: 'pending',
    actor: 'システム',
    actorDepartment: 'バックグラウンドジョブ',
    summary: '交通費申請 (#TRN-20241204-02) の最終承認メールがキュー待機中です',
    detail: 'SMTP 接続先がメンテナンスモードのため、再試行を 10 分後に予約しました。',
    ip: '10.10.10.2',
    ref: 'MAIL-20241204-055',
  },
  {
    id: 'LOG-241204-008',
    timestamp: '2024-12-04T15:12:00+09:00',
    module: '承認ワークフロー',
    severity: 'info',
    status: 'success',
    actor: '佐藤 純',
    actorDepartment: '営業部',
    summary: '稟議申請 (#RN-20241203-04) をレベル 3 で承認しました',
    detail: '承認コメント: 「競合見積との比較済み。利益率 38% なので承認可」。',
    ip: '10.28.5.17',
    ref: 'APP-20241203-04',
  },
];

let logs: ActionLogEntry[] = [...BASE_LOGS];

const listeners = new Set<() => void>();

const notify = () => listeners.forEach(listener => listener());

const generateLogId = () => {
  const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
  return `LOG-${timestamp}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
};

export const getActionLogs = (): ActionLogEntry[] => logs;

export const subscribeToActionLogs = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const logActionEvent = (entry: LogInput): ActionLogEntry => {
  const finalized: ActionLogEntry = {
    id: entry.id ?? generateLogId(),
    timestamp: entry.timestamp ?? new Date().toISOString(),
    module: entry.module,
    severity: entry.severity,
    status: entry.status,
    actor: entry.actor ?? 'システム',
    actorDepartment: entry.actorDepartment ?? 'システム',
    summary: entry.summary,
    detail: entry.detail,
    ip: entry.ip ?? '127.0.0.1',
    context: entry.context,
    ref: entry.ref,
  };

  logs = [finalized, ...logs].slice(0, MAX_ENTRIES);
  notify();
  return finalized;
};

export const buildActionActorInfo = (user: EmployeeUser | null | undefined) => ({
  actor: user?.name ?? 'システム',
  actorDepartment: user?.department ?? '営業支援AI',
});
