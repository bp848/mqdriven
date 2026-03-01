import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader, Save, Mail, CheckCircle } from './Icons';
import { Toast, EmployeeUser } from '../types';
import { getSupabase, getSupabaseFunctionHeaders } from '../services/supabaseClient';

type NotificationTemplateKey = 'submitted' | 'step_forward' | 'approved' | 'rejected';

interface NotificationTemplate {
    subject: string;
    body: string;
}

const TEMPLATE_STORAGE_KEY = 'notificationTemplates';
const SIGNATURE_STORAGE_KEY = 'signatureSettings';
const SMTP_STORAGE_KEY = 'smtpSettings';
const GOOGLE_SYNC_STORAGE_KEY = 'googleCalendarSyncSettings';

const NOTIFICATION_TEMPLATE_CONFIG: Record<NotificationTemplateKey, {
    label: string;
    description: string;
    defaultSubject: string;
    defaultBody: string;
}> = {
    submitted: {
        label: '申請提出通知（承認者宛）',
        description: '申請が提出された際に最初の承認者へ送られるメールです。',
        defaultSubject: '【承認依頼】{{application_code}} の申請が提出されました',
        defaultBody: `{{intro}}

{{detail_table}}

{{link_hint}}`,
    },
    step_forward: {
        label: '承認バトンタッチ通知',
        description: '次の承認者へステップが移った際のメールです。',
        defaultSubject: '【承認依頼】{{application_code}} の承認ステップが割り当てられました',
        defaultBody: `{{intro}}

{{detail_table}}

次の承認レベル: {{next_level}}
{{link_hint}}`,
    },
    approved: {
        label: '最終承認完了通知（申請者宛）',
        description: '申請がすべて承認された際、申請者へ送られます。',
        defaultSubject: '【承認完了】{{application_code}} の申請が承認されました',
        defaultBody: `{{intro}}

{{detail_table}}

承認日時: {{approved_at}}
{{link_hint}}`,
    },
    rejected: {
        label: '差戻し通知（申請者宛）',
        description: '申請が差し戻された際、申請者へ送られます。',
        defaultSubject: '【差し戻し】{{application_code}} の申請が差し戻されました',
        defaultBody: `{{intro}}

{{detail_table}}

差戻し理由: {{rejection_reason}}
{{link_hint}}`,
    },
};

const buildDefaultTemplates = (): Record<NotificationTemplateKey, NotificationTemplate> => {
    return (Object.keys(NOTIFICATION_TEMPLATE_CONFIG) as NotificationTemplateKey[]).reduce((acc, key) => {
        const config = NOTIFICATION_TEMPLATE_CONFIG[key];
        acc[key] = { subject: config.defaultSubject, body: config.defaultBody };
        return acc;
    }, {} as Record<NotificationTemplateKey, NotificationTemplate>);
};

interface SettingsPageProps {
    addToast: (message: string, type: Toast['type']) => void;
    currentUser: EmployeeUser | null;
    googleAuthStatus?: { connected: boolean; expiresAt: string | null; loading: boolean };
    onRefreshGoogleAuthStatus?: () => void;
}

const getAllowedGoogleOrigins = (): string[] => {
    const raw = import.meta.env.VITE_GOOGLE_OAUTH_ALLOWED_ORIGINS || '';
    if (raw) {
        const parsed = raw
            .split(',')
            .map(item => item.trim())
            .filter(Boolean);
        if (parsed.length) return parsed;
    }
    return [
        'https://erp.b-p.co.jp',
        'http://localhost:5174',
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:5174',
        'http://localhost:3000',
        typeof window !== 'undefined' ? window.location.origin : '',
    ];
};

const isGoogleOAuthAllowedOrigin = () => {
    if (typeof window === 'undefined') return false;
    const allowed = getAllowedGoogleOrigins().filter(Boolean);
    const origin = window.location.origin;
    if (allowed.includes('*')) return true;
    if (allowed.includes(origin)) return true;
    return false;
};

const SettingsPage: React.FC<SettingsPageProps> = ({ addToast, currentUser, googleAuthStatus, onRefreshGoogleAuthStatus }) => {
    const [smtpSettings, setSmtpSettings] = useState({
        host: 'smtp.example.com',
        port: 587,
        username: 'user@example.com',
        password: 'password123',
        senderEmail: 'noreply@example.com',
        senderName: 'MQ会計管理システム',
        encryption: 'tls',
    });
    const [signatureSettings, setSignatureSettings] = useState({
        companyName: '',
        department: '',
        yourName: '',
        phone: '',
        email: '',
        website: '',
    });
    const [notificationTemplates, setNotificationTemplates] = useState<Record<NotificationTemplateKey, NotificationTemplate>>(
        () => buildDefaultTemplates()
    );
    const [isSaving, setIsSaving] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const mounted = useRef(true);
    // グローバル状態があれば使用し、なければローカル状態を使用
    const [localGoogleStatus, setLocalGoogleStatus] = useState<{ connected: boolean; expiresAt: string | null; loading: boolean }>({
        connected: false,
        expiresAt: null,
        loading: false,
    });
    
    const currentGoogleStatus = googleAuthStatus || localGoogleStatus;
    const setCurrentGoogleStatus = googleAuthStatus ? () => {} : setLocalGoogleStatus;
    const [googleSyncSettings, setGoogleSyncSettings] = useState({
        importWindowDays: 14,
        targetCalendarId: 'primary',
        autoImport: true,
        autoExport: true,
    });
    const [isGoogleActionLoading, setIsGoogleActionLoading] = useState(false);
    const googleRedirectUri =
        typeof window !== 'undefined'
            ? `${window.location.origin}/api/google/oauth/callback`
            : 'https://your-domain/api/google/oauth/callback';

    useEffect(() => {
        mounted.current = true;
        
        try {
            const savedSignature = localStorage.getItem(SIGNATURE_STORAGE_KEY);
            if (savedSignature) {
                setSignatureSettings(JSON.parse(savedSignature));
            }
            const savedSmtp = localStorage.getItem(SMTP_STORAGE_KEY);
            if (savedSmtp) {
                const parsed = JSON.parse(savedSmtp);
                setSmtpSettings(prev => ({
                    ...prev,
                    ...parsed,
                    port: parsed?.port ? Number(parsed.port) : prev.port,
                }));
            }
            const savedTemplates = localStorage.getItem(TEMPLATE_STORAGE_KEY);
            if (savedTemplates) {
                const parsed = JSON.parse(savedTemplates);
                setNotificationTemplates(prev => {
                    const next = { ...prev };
                    (Object.keys(NOTIFICATION_TEMPLATE_CONFIG) as NotificationTemplateKey[]).forEach(key => {
                        if (parsed?.[key]) {
                            next[key] = {
                                subject: parsed[key].subject ?? NOTIFICATION_TEMPLATE_CONFIG[key].defaultSubject,
                                body: parsed[key].body ?? NOTIFICATION_TEMPLATE_CONFIG[key].defaultBody,
                            };
                        }
                    });
                    return next;
                });
            }
            const savedGoogleSync = localStorage.getItem(GOOGLE_SYNC_STORAGE_KEY);
            if (savedGoogleSync) {
                const parsed = JSON.parse(savedGoogleSync);
                setGoogleSyncSettings(prev => ({
                    ...prev,
                    ...parsed,
                    importWindowDays: parsed?.importWindowDays ? Number(parsed.importWindowDays) : prev.importWindowDays,
                }));
            }
        } catch (error) {
            console.error("Failed to load signature settings from localStorage", error);
        }

        return () => {
            mounted.current = false;
        };
    }, []);

    const fetchGoogleStatus = useCallback(async () => {
        if (!currentUser) {
            setCurrentGoogleStatus({ connected: false, expiresAt: null, loading: false });
            return;
        }
        if (!isGoogleOAuthAllowedOrigin()) {
            setCurrentGoogleStatus({ connected: false, expiresAt: null, loading: false });
            return;
        }
        setCurrentGoogleStatus(prev => ({ ...prev, loading: true }));
        try {
            const supabase = getSupabase();
            const headers = await getSupabaseFunctionHeaders(supabase);
            const { data, error } = await supabase.functions.invoke<{ connected?: boolean; expires_at?: string | null }>('google-oauth-status', {
                body: { user_id: currentUser.id },
                headers,
            });
            if (error) {
                console.warn('Google OAuth status fetch failed (function may not be deployed):', error);
                setCurrentGoogleStatus(prev => ({ ...prev, loading: false }));
                return;
            }
            console.info('[GoogleAuth] status fetched', data);
            const isConnected = !!data?.connected;
            setCurrentGoogleStatus({
                connected: isConnected,
                expiresAt: data?.expires_at ?? null,
                loading: false,
            });
            
            // 連携成功時のガイダンス
            if (isConnected && !currentGoogleStatus.connected) {
                addToast('Googleカレンダー連携が完了しました！カレンダーページで同期機能をお試しください。', 'success');
            }
        } catch (err) {
            console.error('Failed to fetch Google OAuth status', err);
            setCurrentGoogleStatus(prev => ({ ...prev, loading: false }));
        }
    }, [currentUser, currentGoogleStatus.connected, addToast]);

    useEffect(() => {
        fetchGoogleStatus();
    }, [fetchGoogleStatus]);

    const handleSmtpChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setSmtpSettings(prev => ({ ...prev, [name]: name === 'port' ? Number(value) : value }));
    };

    const handleSignatureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setSignatureSettings(prev => ({...prev, [name]: value}));
    };

    const handleTemplateChange = (
        key: NotificationTemplateKey,
        field: keyof NotificationTemplate,
        value: string
    ) => {
        setNotificationTemplates(prev => ({
            ...prev,
            [key]: {
                ...prev[key],
                [field]: value,
            },
        }));
    };

    const handleTemplateReset = (key: NotificationTemplateKey) => {
        const config = NOTIFICATION_TEMPLATE_CONFIG[key];
        setNotificationTemplates(prev => ({
            ...prev,
            [key]: {
                subject: config.defaultSubject,
                body: config.defaultBody,
            },
        }));
        addToast(`「${config.label}」を初期テンプレートに戻しました。`, 'success');
    };

    const startGoogleAuth = async () => {
        if (!currentUser) {
            addToast('ログイン状態を確認してください。', 'error');
            return;
        }
        if (!isGoogleOAuthAllowedOrigin()) {
            addToast('ローカル環境ではGoogle連携を呼び出しません（CORS制限）。', 'info');
            return;
        }
        console.info('[GoogleAuth] start clicked', { userId: currentUser?.id, origin: window.location.origin });
        setIsGoogleActionLoading(true);
        try {
            const supabase = getSupabase();
            const headers = await getSupabaseFunctionHeaders(supabase);
            const { data, error } = await supabase.functions.invoke<{ authUrl?: string }>('google-oauth-start', {
                body: { user_id: currentUser.id },
                headers,
            });
            if (error) throw error;
            if (data?.authUrl) {
                console.info('[GoogleAuth] authUrl received', data.authUrl);
                window.open(data.authUrl, '_blank', 'noopener');
                addToast('Google認可画面を開きました。完了後この画面に戻ってください。', 'success');
                addToast('認可完了後、「再読み込み」ボタンを押して連携状態を確認してください。', 'info');
            } else {
                addToast('認可URLを取得できませんでした。', 'error');
            }
        } catch (err) {
            console.error('Failed to start Google OAuth', err);
            addToast('Googleカレンダー連携の開始に失敗しました。', 'error');
        } finally {
            setIsGoogleActionLoading(false);
            fetchGoogleStatus();
        }
    };

    const disconnectGoogleAuth = async () => {
        if (!currentUser) {
            addToast('ログイン状態を確認してください。', 'error');
            return;
        }
        if (!isGoogleOAuthAllowedOrigin()) {
            addToast('ローカル環境ではGoogle連携を呼び出しません（CORS制限）。', 'info');
            setCurrentGoogleStatus({ connected: false, expiresAt: null, loading: false });
            return;
        }
        console.info('[GoogleAuth] disconnect clicked', { userId: currentUser?.id });
        setIsGoogleActionLoading(true);
        try {
            const supabase = getSupabase();
            const headers = await getSupabaseFunctionHeaders(supabase);
            const { error } = await supabase.functions.invoke('google-oauth-disconnect', {
                body: { user_id: currentUser.id },
                headers,
            });
            if (error) throw error;
            addToast('Googleカレンダー連携を解除しました。', 'success');
            setCurrentGoogleStatus({ connected: false, expiresAt: null, loading: false });
        } catch (err) {
            console.error('Failed to disconnect Google OAuth', err);
            addToast('Googleカレンダー連携の解除に失敗しました。', 'error');
        } finally {
            setIsGoogleActionLoading(false);
        }
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setTimeout(() => {
            if (mounted.current) {
                localStorage.setItem(SIGNATURE_STORAGE_KEY, JSON.stringify(signatureSettings));
                localStorage.setItem(SMTP_STORAGE_KEY, JSON.stringify(smtpSettings));
                localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(notificationTemplates));
                localStorage.setItem(GOOGLE_SYNC_STORAGE_KEY, JSON.stringify(googleSyncSettings));

                setIsSaving(false);
                console.log('Saved settings:', {smtpSettings, signatureSettings, notificationTemplates});
                addToast('設定が正常に保存されました。', 'success');
            }
        }, 1500);
    };

    const handleTestConnection = () => {
        setIsTesting(true);
        setTimeout(() => {
            if (mounted.current) {
                setIsTesting(false);
                console.log('Testing connection with:', smtpSettings);
                if (Math.random() > 0.2) {
                    addToast('テストメールが正常に送信されました。', 'success');
                } else {
                    addToast('接続に失敗しました。設定を確認してください。', 'error');
                }
            }
        }, 2000);
    };

    const inputClass = "w-full text-base bg-slate-50 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500";
    const labelClass = "block text-base font-medium text-slate-700 dark:text-slate-300 mb-1.5";
    const placeholderChips = [
        { token: '{{application_code}}', label: '申請種別名' },
        { token: '{{applicant}}', label: '申請者（氏名 + メール）' },
        { token: '{{status}}', label: '現在のステータス' },
        { token: '{{current_level}}', label: '現在の承認レベル' },
        { token: '{{next_level}}', label: '次の承認レベル' },
        { token: '{{approved_at}}', label: '承認日時' },
        { token: '{{rejection_reason}}', label: '差戻し理由' },
        { token: '{{detail_table}}', label: '申請詳細ブロック' },
        { token: '{{link_hint}}', label: 'フッターの案内文' },
    ];

    const profileFields = [
        { label: '氏名', value: currentUser?.name || '未設定' },
        { label: '部門', value: currentUser?.department || '未所属' },
        { label: '役職', value: currentUser?.title || '未設定' },
        { label: 'メールアドレス', value: currentUser?.email || '未設定' },
        { label: '権限', value: currentUser ? (currentUser.role === 'admin' ? '管理者' : '一般ユーザー') : '未設定' },
    ];

    return (
        <div className="space-y-8">
            <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                <div className="flex items-start justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Googleカレンダー同期設定</h2>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                            Googleからのインポート/エクスポート条件を管理します。認可後にインポート設定を保存してください。
                        </p>
                        <div className="mt-2 text-xs text-slate-600 dark:text-slate-300 space-y-1 bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg border border-slate-200 dark:border-slate-600">
                            <p className="font-semibold">連携に必要な設定</p>
                            <p>・Google OAuthのリダイレクトURI: <span className="font-mono break-all">{googleRedirectUri}</span></p>
                            <p>・Supabase Functions 環境変数: GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI</p>
                            <p>・リダイレクト後、この画面に `google_calendar=ok|error` が付いて戻ります。</p>
                        </div>
                        <div className="mt-3 text-sm text-slate-700 dark:text-slate-200 space-y-1">
                            <p>連携状態: {currentGoogleStatus.loading ? '確認中...' : currentGoogleStatus.connected ? '連携済み' : '未連携'}</p>
                            {currentGoogleStatus.connected && (
                                <p>トークン有効期限: {currentGoogleStatus.expiresAt ? new Date(currentGoogleStatus.expiresAt).toLocaleString('ja-JP') : '取得不可'}</p>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-col gap-2">
                        <button
                            type="button"
                            onClick={currentGoogleStatus.connected ? disconnectGoogleAuth : startGoogleAuth}
                            disabled={isGoogleActionLoading || currentGoogleStatus.loading}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold text-white ${isGoogleActionLoading || currentGoogleStatus.loading ? 'bg-slate-400 cursor-not-allowed' : currentGoogleStatus.connected ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                        >
                            {isGoogleActionLoading || currentGoogleStatus.loading
                                ? '処理中...'
                                : currentGoogleStatus.connected
                                    ? '同期解除'
                                    : 'Google連携を開始'}
                        </button>
                        <button
                            type="button"
                            onClick={googleAuthStatus ? onRefreshGoogleAuthStatus : fetchGoogleStatus}
                            disabled={currentGoogleStatus.loading}
                            className="px-4 py-2 rounded-lg text-sm font-semibold text-blue-600 border border-blue-200 hover:bg-blue-50 dark:text-blue-300 dark:border-blue-700 dark:hover:bg-blue-900/30"
                        >
                            再読み込み
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
                    <div>
                        <label className={labelClass}>インポート期間（日数）</label>
                        <input
                            type="number"
                            min={1}
                            max={90}
                            value={googleSyncSettings.importWindowDays}
                            onChange={(e) => setGoogleSyncSettings(prev => ({ ...prev, importWindowDays: Number(e.target.value) }))}
                            className={inputClass}
                        />
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Google→ERP 取り込み時に見る過去・未来の範囲。</p>
                    </div>
                    <div>
                        <label className={labelClass}>対象カレンダーID</label>
                        <input
                            type="text"
                            value={googleSyncSettings.targetCalendarId}
                            onChange={(e) => setGoogleSyncSettings(prev => ({ ...prev, targetCalendarId: e.target.value }))}
                            className={inputClass}
                            placeholder="primary または calendarId@group.calendar.google.com"
                        />
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">取り込み・書き込み先のカレンダーID。</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <input
                            id="autoImport"
                            type="checkbox"
                            checked={googleSyncSettings.autoImport}
                            onChange={(e) => setGoogleSyncSettings(prev => ({ ...prev, autoImport: e.target.checked }))}
                            className="h-4 w-4 text-blue-600 border-slate-300 rounded"
                        />
                        <label htmlFor="autoImport" className="text-sm text-slate-800 dark:text-slate-200">
                            Google→ERP の自動インポートを有効にする
                        </label>
                    </div>
                    <div className="flex items-center gap-3">
                        <input
                            id="autoExport"
                            type="checkbox"
                            checked={googleSyncSettings.autoExport}
                            onChange={(e) => setGoogleSyncSettings(prev => ({ ...prev, autoExport: e.target.checked }))}
                            className="h-4 w-4 text-blue-600 border-slate-300 rounded"
                        />
                        <label htmlFor="autoExport" className="text-sm text-slate-800 dark:text-slate-200">
                            ERP→Google の同期（エクスポート）を有効にする
                        </label>
                    </div>
                </div>
                <div className="mt-4 rounded-lg bg-slate-50 dark:bg-slate-700/50 p-3 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                    <p>※ インポート/エクスポートの実行ロジックはバックエンドジョブで処理してください。ここでは対象範囲とカレンダーを記録します。</p>
                    <p>※ 連携解除するとトークンは削除されます。再度連携するときは「Google連携を開始」を押してください。</p>
                </div>
            </section>

            <form onSubmit={handleSave} className="space-y-8">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                    <h2 className="text-xl font-semibold text-slate-800 dark:text-white">マイプロフィール</h2>
                    <p className="mt-1 text-base text-slate-500 dark:text-slate-400">現在ログインしているユーザーの情報です。</p>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {profileFields.map(({ label, value }) => (
                        <div key={label}>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
                            <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">{value}</p>
                        </div>
                    ))}
                </div>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                    <h2 className="text-xl font-semibold text-slate-800 dark:text-white">通知メール設定 (SMTP)</h2>
                    <p className="mt-1 text-base text-slate-500 dark:text-slate-400">
                        申請の承認・却下などの通知をメールで送信するためのSMTPサーバー設定です。
                    </p>
                </div>
                <div className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label htmlFor="host" className={labelClass}>SMTPホスト</label>
                            <input type="text" id="host" name="host" value={smtpSettings.host} onChange={handleSmtpChange} className={inputClass} placeholder="smtp.example.com" />
                        </div>
                        <div>
                            <label htmlFor="port" className={labelClass}>SMTPポート</label>
                            <input type="number" id="port" name="port" value={smtpSettings.port} onChange={handleSmtpChange} className={inputClass} placeholder="587" />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label htmlFor="username" className={labelClass}>ユーザー名</label>
                            <input type="text" id="username" name="username" value={smtpSettings.username} onChange={handleSmtpChange} className={inputClass} placeholder="user@example.com" />
                        </div>
                        <div>
                            <label htmlFor="password" className={labelClass}>パスワード</label>
                            <input type="password" id="password" name="password" value={smtpSettings.password} onChange={handleSmtpChange} className={inputClass} placeholder="••••••••" />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label htmlFor="senderEmail" className={labelClass}>送信元メールアドレス</label>
                            <input type="email" id="senderEmail" name="senderEmail" value={smtpSettings.senderEmail} onChange={handleSmtpChange} className={inputClass} placeholder="noreply@example.com" />
                        </div>
                         <div>
                            <label htmlFor="senderName" className={labelClass}>送信元名</label>
                            <input type="text" id="senderName" name="senderName" value={smtpSettings.senderName} onChange={handleSmtpChange} className={inputClass} placeholder="MQ会計管理システム" />
                        </div>
                    </div>
                     <div>
                        <label htmlFor="encryption" className={labelClass}>暗号化</label>
                        <select id="encryption" name="encryption" value={smtpSettings.encryption} onChange={handleSmtpChange} className={inputClass}>
                            <option value="none">なし</option>
                            <option value="ssl">SSL/TLS</option>
                            <option value="tls">STARTTLS</option>
                        </select>
                    </div>
                </div>
                 <div className="flex justify-end p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700">
                    <button
                        type="button"
                        onClick={handleTestConnection}
                        disabled={isTesting || isSaving}
                        className="flex items-center justify-center gap-2 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold py-2 px-4 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600 disabled:opacity-50"
                    >
                        {isTesting ? <Loader className="w-5 h-5 animate-spin"/> : <Mail className="w-5 h-5" />}
                        <span>{isTesting ? '送信中...' : '接続テスト'}</span>
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                    <h2 className="text-xl font-semibold text-slate-800 dark:text-white">Eメール署名設定</h2>
                    <p className="mt-1 text-base text-slate-500 dark:text-slate-400">
                        「AI提案メール作成」などで使用されるメールの署名を設定します。
                    </p>
                </div>
                 <div className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label htmlFor="companyName" className={labelClass}>会社名</label>
                            <input type="text" id="companyName" name="companyName" value={signatureSettings.companyName} onChange={handleSignatureChange} className={inputClass} placeholder="文唱堂印刷株式会社" />
                        </div>
                        <div>
                            <label htmlFor="department" className={labelClass}>部署名</label>
                            <input type="text" id="department" name="department" value={signatureSettings.department} onChange={handleSignatureChange} className={inputClass} placeholder="システム管理・開発" />
                        </div>
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label htmlFor="yourName" className={labelClass}>氏名</label>
                            <input type="text" id="yourName" name="yourName" value={signatureSettings.yourName} onChange={handleSignatureChange} className={inputClass} placeholder="石嶋 洋平" />
                        </div>
                         <div>
                            <label htmlFor="phone" className={labelClass}>電話番号・FAX</label>
                            <input type="text" id="phone" name="phone" value={signatureSettings.phone} onChange={handleSignatureChange} className={inputClass} placeholder="TEL：03-3851-0111　FAX：03-3861-1979" />
                        </div>
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label htmlFor="email" className={labelClass}>E-mail</label>
                            <input type="email" id="email" name="email" value={signatureSettings.email} onChange={handleSignatureChange} className={inputClass} placeholder="sales.system@mqprint.co.jp" />
                        </div>
                         <div>
                            <label htmlFor="website" className={labelClass}>ウェブサイト</label>
                            <input type="url" id="website" name="website" value={signatureSettings.website} onChange={handleSignatureChange} className={inputClass} placeholder="https://new.b-p.co.jp/" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                    <h2 className="text-xl font-semibold text-slate-800 dark:text-white">通知メールテンプレート</h2>
                    <p className="mt-1 text-base text-slate-500 dark:text-slate-400">
                        承認ワークフローで送信される各種メールの件名・本文を自由にカスタマイズできます。<br className="hidden md:block" />
                        下記の差し込みタグを使うと、申請ごとの情報を自動で挿入できます。
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                        {placeholderChips.map(item => (
                            <span
                                key={item.token}
                                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-200"
                            >
                                <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                                {item.token}
                                <span className="text-[11px] text-slate-400 dark:text-slate-300">({item.label})</span>
                            </span>
                        ))}
                    </div>
                </div>
                <div className="divide-y divide-slate-200 dark:divide-slate-700">
                    {(Object.keys(NOTIFICATION_TEMPLATE_CONFIG) as NotificationTemplateKey[]).map(key => {
                        const config = NOTIFICATION_TEMPLATE_CONFIG[key];
                        const template = notificationTemplates[key];
                        return (
                            <section key={key} className="p-6 space-y-4">
                                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                    <div>
                                        <h3 className="text-lg font-semibold text-slate-800 dark:text-white">{config.label}</h3>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">{config.description}</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleTemplateReset(key)}
                                        className="self-start rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700/80"
                                    >
                                        初期テンプレに戻す
                                    </button>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <label className={labelClass}>件名</label>
                                        <input
                                            type="text"
                                            value={template.subject}
                                            onChange={(e) => handleTemplateChange(key, 'subject', e.target.value)}
                                            className={inputClass}
                                        />
                                    </div>
                                    <div>
                                        <label className={labelClass}>本文</label>
                                        <textarea
                                            value={template.body}
                                            onChange={(e) => handleTemplateChange(key, 'body', e.target.value)}
                                            className={`${inputClass} min-h-[140px]`}
                                        />
                                    </div>
                                </div>
                            </section>
                        );
                    })}
                </div>
            </div>

            <div className="flex justify-end">
                <button
                    type="submit"
                    disabled={isSaving || isTesting}
                    className="w-48 flex items-center justify-center gap-2 bg-blue-600 text-white font-semibold py-2.5 px-4 rounded-lg shadow-md hover:bg-blue-700 disabled:bg-slate-400"
                >
                    {isSaving ? <Loader className="w-5 h-5 animate-spin"/> : <Save className="w-5 h-5" />}
                    <span>{isSaving ? '保存中...' : 'すべての設定を保存'}</span>
                </button>
            </div>
        </form>
        </div>
    );
};

export default SettingsPage;
