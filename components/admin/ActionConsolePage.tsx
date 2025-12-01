import React, { useMemo, useState } from 'react';
import { Search, RefreshCw, Shield, History, AlertTriangle, CheckCircle } from '../Icons';

type Severity = 'critical' | 'warning' | 'info';
type Status = 'success' | 'failure' | 'pending';

interface ActionLogEntry {
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

const ACTION_LOGS: ActionLogEntry[] = [
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

const severityBadgeClass = (severity: Severity) => {
    switch (severity) {
        case 'critical':
            return 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300';
        case 'warning':
            return 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200';
        default:
            return 'bg-slate-100 text-slate-700 dark:bg-slate-700/60 dark:text-slate-200';
    }
};

const statusIndicatorClass = (status: Status) => {
    switch (status) {
        case 'success':
            return 'text-emerald-600 dark:text-emerald-400';
        case 'failure':
            return 'text-rose-600 dark:text-rose-400';
        default:
            return 'text-amber-500 dark:text-amber-300';
    }
};

const formatDate = (ts: string) => {
    return new Date(ts).toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const getRelativeTime = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    const minutes = Math.round(diff / 60000);
    if (minutes < 60) return `${minutes}分前`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}時間前`;
    const days = Math.round(hours / 24);
    return `${days}日前`;
};

const ActionConsolePage: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [severityFilter, setSeverityFilter] = useState<'all' | Severity>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | Status>('all');
    const [moduleFilter, setModuleFilter] = useState('all');
    const [timeFilter, setTimeFilter] = useState<'24h' | '7d' | '30d' | 'all'>('all');
    const [isRefreshing, setIsRefreshing] = useState(false);

    const modules = useMemo(() => Array.from(new Set(ACTION_LOGS.map(log => log.module))), []);

    const filteredLogs = useMemo(() => {
        const now = Date.now();
        const thresholdHours =
            timeFilter === '24h' ? 24 : timeFilter === '7d' ? 24 * 7 : timeFilter === '30d' ? 24 * 30 : null;

        return ACTION_LOGS.filter(log => {
            if (severityFilter !== 'all' && log.severity !== severityFilter) return false;
            if (statusFilter !== 'all' && log.status !== statusFilter) return false;
            if (moduleFilter !== 'all' && log.module !== moduleFilter) return false;
            if (thresholdHours) {
                const diffHours = (now - new Date(log.timestamp).getTime()) / (1000 * 60 * 60);
                if (diffHours > thresholdHours) return false;
            }
            if (searchTerm.trim()) {
                const needle = searchTerm.toLowerCase();
                const haystack = `${log.summary} ${log.detail} ${log.actor} ${log.module} ${log.id}`.toLowerCase();
                if (!haystack.includes(needle)) return false;
            }
            return true;
        });
    }, [searchTerm, severityFilter, statusFilter, moduleFilter, timeFilter]);

    const stats = useMemo(() => {
        const critical = ACTION_LOGS.filter(log => log.severity === 'critical').length;
        const warnings = ACTION_LOGS.filter(log => log.severity === 'warning').length;
        const failures = ACTION_LOGS.filter(log => log.status === 'failure').length;
        const success = ACTION_LOGS.filter(log => log.status === 'success').length;
        const successRate = ACTION_LOGS.length === 0 ? 0 : Math.round((success / ACTION_LOGS.length) * 100);
        return { total: ACTION_LOGS.length, critical, warnings, failures, successRate };
    }, []);

    const handleRefresh = () => {
        setIsRefreshing(true);
        setTimeout(() => setIsRefreshing(false), 800);
    };

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                <div className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
                    <div>
                        <p className="text-sm font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-300">SYSTEM CONSOLE</p>
                        <h2 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">アクションコンソール</h2>
                        <p className="mt-1 text-base text-slate-500 dark:text-slate-400">
                            システム全体の重要イベントや操作履歴をリアルタイムに可視化します。
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-200">
                            {filteredLogs.length} / {ACTION_LOGS.length} 件表示
                        </div>
                        <button
                            type="button"
                            onClick={handleRefresh}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700/70"
                        >
                            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                            再読み込み
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    <p className="text-sm text-slate-500">監視対象イベント</p>
                    <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{stats.total}</p>
                    <p className="text-xs text-slate-400">過去30日内</p>
                </div>
                <div className="rounded-2xl border border-rose-100 bg-white p-4 shadow-sm dark:border-rose-400/30 dark:bg-slate-800">
                    <p className="text-sm text-rose-500">クリティカル</p>
                    <p className="mt-2 text-3xl font-bold text-rose-600 dark:text-rose-300">{stats.critical}</p>
                    <p className="text-xs text-rose-400">直近の失敗系イベント</p>
                </div>
                <div className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm dark:border-amber-400/30 dark:bg-slate-800">
                    <p className="text-sm text-amber-500">警告/ Pending</p>
                    <p className="mt-2 text-3xl font-bold text-amber-500">{stats.warnings}</p>
                    <p className="text-xs text-amber-500">処理待ちや注意喚起</p>
                </div>
                <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm dark:border-emerald-400/30 dark:bg-slate-800">
                    <p className="text-sm text-emerald-600">成功率</p>
                    <p className="mt-2 text-3xl font-bold text-emerald-600">{stats.successRate}%</p>
                    <p className="text-xs text-emerald-500">正常終了したアクション</p>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-4">
                <div className="space-y-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800 lg:col-span-3">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <label className="relative flex">
                            <span className="sr-only">検索</span>
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                                type="search"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                placeholder="キーワード検索（例: SMTP, 承認, IP など）"
                                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                            />
                        </label>
                        <select
                            value={moduleFilter}
                            onChange={e => setModuleFilter(e.target.value)}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                        >
                            <option value="all">すべてのモジュール</option>
                            {modules.map(module => (
                                <option key={module} value={module}>
                                    {module}
                                </option>
                            ))}
                        </select>
                        <select
                            value={severityFilter}
                            onChange={e => setSeverityFilter(e.target.value as 'all' | Severity)}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                        >
                            <option value="all">重要度: すべて</option>
                            <option value="critical">Critical</option>
                            <option value="warning">Warning</option>
                            <option value="info">Info</option>
                        </select>
                        <select
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value as 'all' | Status)}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                        >
                            <option value="all">ステータス: すべて</option>
                            <option value="success">Success</option>
                            <option value="pending">Pending</option>
                            <option value="failure">Failure</option>
                        </select>
                    </div>
                    <div className="flex flex-wrap gap-2 text-sm">
                        {(['24h', '7d', '30d', 'all'] as const).map(option => (
                            <button
                                key={option}
                                type="button"
                                onClick={() => setTimeFilter(option)}
                                className={`rounded-full border px-3 py-1 ${
                                    timeFilter === option
                                        ? 'border-blue-500 bg-blue-500 text-white'
                                        : 'border-slate-300 text-slate-600 hover:border-blue-400 hover:text-blue-600 dark:border-slate-600 dark:text-slate-300'
                                }`}
                            >
                                {option === '24h' && '過去24時間'}
                                {option === '7d' && '過去7日'}
                                {option === '30d' && '過去30日'}
                                {option === 'all' && '全期間'}
                            </button>
                        ))}
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-700">
                        {filteredLogs.length === 0 ? (
                            <div className="py-12 text-center text-slate-500 dark:text-slate-400">
                                <History className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
                                <p className="mt-4 text-base font-semibold">該当するログがありません</p>
                                <p className="text-sm">フィルター条件を調整してください。</p>
                            </div>
                        ) : (
                            filteredLogs.map(log => (
                                <article key={log.id} className="grid gap-3 py-4 lg:grid-cols-[1fr_auto] lg:items-center">
                                    <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${severityBadgeClass(log.severity)}`}>
                                                {log.severity.toUpperCase()}
                                            </span>
                                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{log.module}</span>
                                            <span className="text-xs font-mono text-slate-400">{log.id}</span>
                                        </div>
                                        <p className="mt-2 text-base font-semibold text-slate-900 dark:text-white">{log.summary}</p>
                                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">{log.detail}</p>
                                        <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-400">
                                            <span>実行者: {log.actor} ({log.actorDepartment})</span>
                                            <span>IP: {log.ip}</span>
                                            {log.ref && <span>関連ID: {log.ref}</span>}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{formatDate(log.timestamp)}</p>
                                        <p className="text-xs text-slate-400">{getRelativeTime(log.timestamp)}</p>
                                        <div className={`mt-2 text-sm font-semibold ${statusIndicatorClass(log.status)}`}>
                                            {log.status === 'success' && 'SUCCESS'}
                                            {log.status === 'failure' && 'FAILED'}
                                            {log.status === 'pending' && 'PENDING'}
                                        </div>
                                    </div>
                                </article>
                            ))
                        )}
                    </div>
                </div>
                <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                        <div className="flex items-center gap-2">
                            <Shield className="h-5 w-5 text-slate-400" />
                            <p className="text-sm font-semibold text-slate-600 dark:text-slate-200">リアルタイム監視</p>
                        </div>
                        <ul className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                            <li className="flex gap-2">
                                <span className="text-emerald-500">●</span> バックグラウンドジョブ：稼働中
                            </li>
                            <li className="flex gap-2">
                                <span className="text-amber-500">●</span> SMTP リトライキュー：3 件待機
                            </li>
                            <li className="flex gap-2">
                                <span className="text-emerald-500">●</span> Supabase RPC 応答時間：320ms
                            </li>
                            <li className="flex gap-2">
                                <span className="text-rose-500">●</span> 重要度 CRITICAL：1 件未対応
                            </li>
                        </ul>
                    </div>
                    <div className="rounded-2xl border border-rose-100 bg-white p-4 shadow-sm dark:border-rose-500/30 dark:bg-slate-800">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-rose-500" />
                            <p className="text-sm font-semibold text-rose-500">対応が必要なイベント</p>
                        </div>
                        <ul className="mt-4 space-y-3 text-sm text-rose-600 dark:text-rose-300">
                            {ACTION_LOGS.filter(log => log.status !== 'success').slice(0, 3).map(log => (
                                <li key={log.id} className="rounded-lg bg-rose-50/80 p-3 text-xs dark:bg-rose-500/10">
                                    <p className="font-semibold">{log.summary}</p>
                                    <p className="mt-1 text-[11px]">{log.module} / {formatDate(log.timestamp)}</p>
                                </li>
                            ))}
                        </ul>
                        <p className="mt-3 text-right text-[11px] text-rose-400">最終更新: {formatDate(ACTION_LOGS[0].timestamp)}</p>
                    </div>
                    <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm dark:border-emerald-500/30 dark:bg-slate-800">
                        <div className="flex items-center gap-2">
                            <CheckCircle className="h-5 w-5 text-emerald-500" />
                            <p className="text-sm font-semibold text-emerald-500">成功した直近アクション</p>
                        </div>
                        <ul className="mt-4 space-y-3 text-sm text-emerald-600 dark:text-emerald-300">
                            {ACTION_LOGS.filter(log => log.status === 'success').slice(0, 3).map(log => (
                                <li key={log.id} className="rounded-lg bg-emerald-50/80 p-3 text-xs dark:bg-emerald-500/10">
                                    <p className="font-semibold">{log.summary}</p>
                                    <p className="mt-1 text-[11px]">{log.module} / {formatDate(log.timestamp)}</p>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ActionConsolePage;
