import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Customer, Toast } from '../types';
import { Mail, Send, Loader, Calendar, AlertTriangle, CheckCircle, Trash2 } from './Icons';
import { sendEmail } from '../services/emailService';

type Recipient = { email: string; label: string };

interface NewsletterPageProps {
    customers: Customer[];
    addToast: (message: string, type: Toast['type']) => void;
}

const EMAIL_REGEX = /[\w.+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

const extractEmails = (value: string | null | undefined): string[] => {
    if (!value) return [];
    const matches = value.match(EMAIL_REGEX);
    if (!matches) return [];
    const seen = new Set<string>();
    matches.forEach(email => seen.add(email.trim().toLowerCase()));
    return Array.from(seen);
};

const toPlainText = (html: string): string => {
    if (!html) return '';
    return html
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
};

const NewsletterPage: React.FC<NewsletterPageProps> = ({ customers, addToast }) => {
    const [subject, setSubject] = useState('【ご案内】春のキャンペーンのお知らせ');
    const [htmlBody, setHtmlBody] = useState(`<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
<h2 style="color: #333;">【ご案内】春のキャンペーンのお知らせ</h2>

<p>いつもお世話になっております。</p>

<p>この度、春のキャンペーンを実施することとなりましたので、ご案内申し上げます。</p>

<h3 style="color: #666; margin-top: 30px;">キャンペーン内容</h3>
<ul>
    <li>期間：4月1日～4月30日</li>
    <li>対象：全サービス</li>
    <li>特典：通常価格から10%OFF</li>
</ul>

<p>詳細は以下のURLをご確認ください。</p>
<p><a href="#" style="color: #007bff;">キャンペーン詳細はこちら</a></p>

<p>ご不明な点がございましたら、お気軽にお問い合わせください。</p>

<hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
<p style="font-size: 12px; color: #999;">このメールはシステムにより自動送信されています。</p>
</div>`);
    const [testEmail, setTestEmail] = useState('');
    const [excludedEmails, setExcludedEmails] = useState<Set<string>>(new Set());
    const [isSending, setIsSending] = useState(false);
    const [scheduledAt, setScheduledAt] = useState('');
    const [scheduledStatus, setScheduledStatus] = useState('');
    const timerRef = useRef<number | null>(null);
    const countdownRef = useRef<number | null>(null);
    const [countdown, setCountdown] = useState('');

    const recipients = useMemo<Recipient[]>(() => {
        const seen = new Set<string>();
        const list: Recipient[] = [];
        customers.forEach(customer => {
            const emails = extractEmails(customer.customerContactInfo) || [];
            emails.forEach(email => {
                if (seen.has(email)) return;
                seen.add(email);
                const label = `${customer.customerName}${customer.representative ? ` (${customer.representative})` : ''} <${email}>`;
                list.push({ email, label });
            });
        });
        return list;
    }, [customers]);

    const targetEmails = useMemo(() => {
        return recipients
            .map(r => r.email)
            .filter(email => !excludedEmails.has(email));
    }, [recipients, excludedEmails]);

    const clearSchedule = () => {
        if (timerRef.current) {
            window.clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        if (countdownRef.current) {
            window.clearInterval(countdownRef.current);
            countdownRef.current = null;
        }
        setCountdown('');
    };

    useEffect(() => {
        return () => {
            clearSchedule();
        };
    }, []);

    const handleToggleExclude = (email: string) => {
        setExcludedEmails(prev => {
            const next = new Set(prev);
            if (next.has(email)) {
                next.delete(email);
            } else {
                next.add(email);
            }
            return next;
        });
    };

    const sendNewsletter = async (to: string[], mode: 'test' | 'bulk' | 'scheduled') => {
        if (!subject.trim()) {
            addToast('件名を入力してください。', 'error');
            return;
        }
        if (!htmlBody.trim()) {
            addToast('メルマガ本文(HTML)を入力してください。', 'error');
            return;
        }
        if (to.length === 0) {
            addToast('送信先がありません。取引先のメールアドレスを確認してください。', 'error');
            return;
        }
        setIsSending(true);
        try {
            await sendEmail({
                to,
                subject,
                html: htmlBody,
                body: toPlainText(htmlBody),
            });
            const label =
                mode === 'test' ? 'テスト送信' : mode === 'scheduled' ? '予約送信' : '本番送信';
            addToast(`${label}が完了しました。`, 'success');
        } catch (error: any) {
            addToast(error?.message || 'メール送信に失敗しました。', 'error');
        } finally {
            setIsSending(false);
        }
    };

    const handleTestSend = () => {
        const email = testEmail.trim().toLowerCase();
        if (!email || !email.includes('@')) {
            addToast('テスト送信先メールアドレスを入力してください。', 'error');
            return;
        }
        sendNewsletter([email], 'test');
    };

    const handleSendNow = () => {
        if (!window.confirm(`選択されている ${targetEmails.length} 件の宛先に送信します。よろしいですか？`)) {
            return;
        }
        clearSchedule();
        sendNewsletter(targetEmails, 'bulk');
    };

    const handleSchedule = () => {
        clearSchedule();
        if (!scheduledAt) {
            addToast('予約日時を選択してください。', 'error');
            return;
        }
        const when = new Date(scheduledAt);
        const diff = when.getTime() - Date.now();
        if (Number.isNaN(diff) || diff <= 0) {
            addToast('未来の日時を指定してください。', 'error');
            return;
        }
        if (targetEmails.length === 0) {
            addToast('送信先がありません。取引先のメールアドレスを確認してください。', 'error');
            return;
        }
        setScheduledStatus(`予約: ${when.toLocaleString('ja-JP')}`);
        timerRef.current = window.setTimeout(() => {
            sendNewsletter(targetEmails, 'scheduled');
            clearSchedule();
            setScheduledStatus('');
        }, diff);
        countdownRef.current = window.setInterval(() => {
            const remaining = when.getTime() - Date.now();
            if (remaining <= 0) {
                setCountdown('');
                return;
            }
            const mins = Math.floor(remaining / 60000);
            const secs = Math.floor((remaining % 60000) / 1000);
            setCountdown(`${mins}分${secs.toString().padStart(2, '0')}秒後に送信`);
        }, 1000);
        addToast('予約をセットしました。この画面を開いたままにしてください。', 'info');
    };

    const handleExcludeAll = () => {
        setExcludedEmails(new Set(recipients.map(r => r.email)));
    };

    const handleIncludeAll = () => {
        setExcludedEmails(new Set());
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6 space-y-6">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-lg dark:bg-blue-900/30 dark:text-blue-100">
                    <Mail className="w-6 h-6" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">メールマガジン配信</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-300">HTMLで文案を作成し、取引先全員へ一括送信 / テスト送信 / 予約送信を行えます。</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="space-y-4 lg:col-span-2">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">件名</label>
                        <input
                            type="text"
                            value={subject}
                            onChange={e => setSubject(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="【ご案内】春のキャンペーンのお知らせ"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">メルマガ本文 (HTML)</label>
                        <textarea
                            value={htmlBody}
                            onChange={e => setHtmlBody(e.target.value)}
                            className="w-full min-h-[260px] rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="<p>本文を入力してください</p>"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">プレビュー</label>
                        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-4 min-h-[200px]">
                            <div className="prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: htmlBody || '<p class="text-slate-400">HTMLを入力するとプレビューが表示されます</p>' }} />
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <Send className="w-5 h-5 text-blue-600" />
                            <div>
                                <p className="text-sm font-semibold text-slate-900 dark:text-white">配信先</p>
                                <p className="text-xs text-slate-500 dark:text-slate-300">除外を選ばなければ全取引先が対象</p>
                            </div>
                        </div>
                        <div className="text-sm text-slate-700 dark:text-slate-200">
                            <p>総件数: {recipients.length} 件</p>
                            <p>除外: {excludedEmails.size} 件</p>
                            <p className="font-semibold text-blue-700 dark:text-blue-300">送信対象: {targetEmails.length} 件</p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handleIncludeAll} className="px-3 py-1 rounded-lg border border-slate-300 dark:border-slate-600 text-sm">全件選択</button>
                            <button onClick={handleExcludeAll} className="px-3 py-1 rounded-lg border border-slate-300 dark:border-slate-600 text-sm">全件除外</button>
                        </div>
                        <div className="h-48 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950">
                            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                                {recipients.map(recipient => (
                                    <li key={recipient.email} className="flex items-center gap-2 px-3 py-2">
                                        <input
                                            type="checkbox"
                                            checked={!excludedEmails.has(recipient.email)}
                                            onChange={() => handleToggleExclude(recipient.email)}
                                            className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                                        />
                                        <span className="text-xs text-slate-700 dark:text-slate-200 break-all">{recipient.label}</span>
                                    </li>
                                ))}
                                {recipients.length === 0 && (
                                    <li className="px-3 py-4 text-sm text-slate-500 flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                                        取引先のメールアドレスが登録されていません。
                                    </li>
                                )}
                            </ul>
                        </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-emerald-600" />
                            <div>
                                <p className="text-sm font-semibold text-slate-900 dark:text-white">送信オプション</p>
                                <p className="text-xs text-slate-500 dark:text-slate-300">テスト / 即時 / 予約</p>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">テスト送信先</label>
                            <div className="flex gap-2">
                                <input
                                    type="email"
                                    value={testEmail}
                                    onChange={e => setTestEmail(e.target.value)}
                                    className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="test@example.com"
                                />
                                <button
                                    onClick={handleTestSend}
                                    disabled={isSending}
                                    className="px-3 py-2 rounded-lg bg-slate-800 text-white text-sm disabled:opacity-60"
                                >
                                    {isSending ? <Loader className="w-4 h-4 animate-spin" /> : 'テスト送信'}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">予約送信</label>
                            <input
                                type="datetime-local"
                                value={scheduledAt}
                                onChange={e => setScheduledAt(e.target.value)}
                                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={handleSchedule}
                                    disabled={isSending}
                                    className="flex-1 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-60"
                                >
                                    {isSending ? <Loader className="w-4 h-4 animate-spin" /> : '予約送信'}
                                </button>
                                {scheduledStatus && (
                                    <button
                                        onClick={clearSchedule}
                                        className="px-3 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm flex items-center gap-1"
                                    >
                                        <Trash2 className="w-4 h-4" /> 取消
                                    </button>
                                )}
                            </div>
                            {scheduledStatus && (
                                <div className="text-xs text-emerald-700 dark:text-emerald-300">
                                    <p>{scheduledStatus}</p>
                                    {countdown && <p>{countdown}</p>}
                                </div>
                            )}
                            {!scheduledStatus && countdown && (
                                <p className="text-xs text-emerald-700 dark:text-emerald-300">{countdown}</p>
                            )}
                            <p className="text-[11px] text-slate-500 dark:text-slate-300">※ブラウザを閉じると予約は無効になります</p>
                        </div>

                        <div className="pt-2 border-t border-dashed border-slate-200 dark:border-slate-700 space-y-2">
                            <button
                                onClick={handleSendNow}
                                disabled={isSending}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-60"
                            >
                                {isSending ? <Loader className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                                <span>本番送信 ({targetEmails.length}件)</span>
                            </button>
                            {recipients.length === 0 && (
                                <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                                    <AlertTriangle className="w-4 h-4" /> 送信先がありません。取引先にメールを登録してください。
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-4">
                <div className="flex items-center gap-2 mb-3">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm font-semibold text-slate-800 dark:text-white">送信先リスト</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-xs text-slate-700 dark:text-slate-200">
                    {recipients.slice(0, 60).map(recipient => (
                        <div key={recipient.email} className="flex items-center gap-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2">
                            <input
                                type="checkbox"
                                checked={!excludedEmails.has(recipient.email)}
                                onChange={() => handleToggleExclude(recipient.email)}
                                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                            />
                            <span className="break-all">{recipient.label}</span>
                        </div>
                    ))}
                    {recipients.length > 60 && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-300 col-span-full">
                            …他 {recipients.length - 60} 件（上のリストから除外してください）
                        </p>
                    )}
                    {recipients.length === 0 && (
                        <p className="text-sm text-slate-500">表示する送信先がありません。</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NewsletterPage;
