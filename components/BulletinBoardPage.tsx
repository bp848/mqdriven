import React, { useEffect, useMemo, useState } from 'react';
import { BulletinComment, BulletinPost, EmployeeUser, Toast } from '../types';
import { PlusCircle } from './Icons';

interface BulletinBoardPageProps {
    currentUser: EmployeeUser | null;
    addToast: (message: string, type: Toast['type']) => void;
}

type BulletinThread = BulletinPost & { comments: BulletinComment[] };

const STORAGE_KEY = 'mq.bulletin.threads';

const seedThreads: BulletinThread[] = [
    {
        id: 'seed-001',
        title: '週次アップデート：工場見学の受け入れと来週のイベント',
        body: '来週8日(火)に主要顧客2社の工場見学があります。フロア整備と安全動画の更新を5日(金)までに完了してください。併せて、木曜日に実施する新ERP機能の昼休みデモへ参加希望者はコメント欄で表明をお願いします。',
        authorId: 'user-admin-demo',
        authorName: '管理本部・情シスチーム',
        authorDepartment: '管理本部',
        tags: ['お知らせ', 'イベント'],
        pinned: true,
        createdAt: '2025-05-15T02:30:00.000Z',
        updatedAt: '2025-05-15T02:30:00.000Z',
        comments: [
            {
                id: 'seed-comment-001',
                postId: 'seed-001',
                authorId: 'user-ops-01',
                authorName: '製造部 山本',
                authorDepartment: '製造部',
                body: '安全動画の字幕修正を進めています。完了予定は4日夕方です。',
                createdAt: '2025-05-15T05:10:00.000Z',
            },
        ],
    },
    {
        id: 'seed-002',
        title: 'Slack障害時の連絡手段を再確認してください',
        body: '本日午前にSlackへのアクセス遅延が発生しました。BCPルールに従い、チャット障害時はメールと掲示板コメントを併用します。各部で代替連絡網の最新化と周知をお願いします。',
        authorId: 'user-admin-demo',
        authorName: '管理本部・情報システム',
        authorDepartment: '管理本部',
        tags: ['BCP'],
        pinned: false,
        createdAt: '2025-05-13T23:00:00.000Z',
        updatedAt: '2025-05-13T23:00:00.000Z',
        comments: [],
    },
];

const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return `bb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const formatDateLabel = (timestamp: string) => {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
        return timestamp;
    }
    return new Intl.DateTimeFormat('ja-JP', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
};

const loadStoredThreads = (): BulletinThread[] => {
    if (typeof window === 'undefined') {
        return seedThreads;
    }
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return seedThreads;
        const parsed = JSON.parse(raw) as BulletinThread[];
        if (!Array.isArray(parsed)) return seedThreads;
        return parsed.map(thread => ({
            ...thread,
            comments: Array.isArray(thread.comments) ? thread.comments : [],
        }));
    } catch (error) {
        console.warn('Failed to load bulletin board state from localStorage', error);
        return seedThreads;
    }
};

const persistThreads = (threads: BulletinThread[]) => {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(threads));
    } catch (error) {
        console.warn('Failed to persist bulletin board state', error);
    }
};

const BulletinBoardPage: React.FC<BulletinBoardPageProps> = ({ currentUser, addToast }) => {
    const [threads, setThreads] = useState<BulletinThread[]>(() => loadStoredThreads());
    const [searchTerm, setSearchTerm] = useState('');
    const [showPinnedOnly, setShowPinnedOnly] = useState(false);
    const [newPost, setNewPost] = useState({ title: '', body: '', tags: '' });
    const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});

    useEffect(() => {
        persistThreads(threads);
    }, [threads]);

    const filteredThreads = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        return threads
            .filter(thread => {
                if (showPinnedOnly && !thread.pinned) {
                    return false;
                }
                if (!term) return true;
                return (
                    thread.title.toLowerCase().includes(term) ||
                    thread.body.toLowerCase().includes(term) ||
                    (thread.tags || []).some(tag => tag.toLowerCase().includes(term))
                );
            })
            .sort((a, b) => {
                if (a.pinned && !b.pinned) return -1;
                if (!a.pinned && b.pinned) return 1;
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            });
    }, [threads, searchTerm, showPinnedOnly]);

    const resolveAuthor = () => {
        if (!currentUser) {
            return {
                authorId: 'guest-user',
                authorName: 'ゲストユーザー',
                authorDepartment: null,
            };
        }
        return {
            authorId: currentUser.id,
            authorName: currentUser.name,
            authorDepartment: currentUser.department,
        };
    };

    const handleCreatePost = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!newPost.title.trim() || !newPost.body.trim()) {
            addToast('タイトルと本文は必須です。', 'error');
            return;
        }
        const { authorId, authorName, authorDepartment } = resolveAuthor();
        const now = new Date().toISOString();
        const tags = newPost.tags
            .split(',')
            .map(tag => tag.trim())
            .filter(Boolean);
        const thread: BulletinThread = {
            id: generateId(),
            title: newPost.title.trim(),
            body: newPost.body.trim(),
            tags,
            authorId,
            authorName,
            authorDepartment,
            pinned: false,
            createdAt: now,
            updatedAt: now,
            comments: [],
        };
        setThreads(prev => [thread, ...prev]);
        setNewPost({ title: '', body: '', tags: '' });
        addToast('掲示板に投稿しました。', 'success');
    };

    const handleAddComment = (postId: string) => {
        const draft = commentDrafts[postId];
        if (!draft || !draft.trim()) {
            addToast('コメントを入力してください。', 'error');
            return;
        }
        const { authorId, authorName, authorDepartment } = resolveAuthor();
        const comment: BulletinComment = {
            id: generateId(),
            postId,
            authorId,
            authorName,
            authorDepartment,
            body: draft.trim(),
            createdAt: new Date().toISOString(),
        };
        setThreads(prev =>
            prev.map(thread =>
                thread.id === postId
                    ? { ...thread, comments: [...thread.comments, comment], updatedAt: comment.createdAt }
                    : thread,
            ),
        );
        setCommentDrafts(prev => ({ ...prev, [postId]: '' }));
        addToast('コメントを追加しました。', 'success');
    };

    return (
        <div className="space-y-6">
            <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">社内共有・相談・イベント告知にご利用ください。</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">コメントは投稿者と閲覧者全員に公開されます。</p>
                    </div>
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                        <input
                            type="checkbox"
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            checked={showPinnedOnly}
                            onChange={(e) => setShowPinnedOnly(e.target.checked)}
                        />
                        ピン留めのみ
                    </label>
                </div>
                <div className="flex flex-col gap-3 md:flex-row md:items-center">
                    <input
                        type="search"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="キーワードで検索（タイトル・本文・タグ）"
                        className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
            </section>

            <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">新規投稿</h2>
                <form className="space-y-4" onSubmit={handleCreatePost}>
                    <div>
                        <label htmlFor="bb-title" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">タイトル *</label>
                        <input
                            id="bb-title"
                            type="text"
                            value={newPost.title}
                            onChange={(e) => setNewPost(prev => ({ ...prev, title: e.target.value }))}
                            className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="例）5月度の納期リスク共有"
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="bb-body" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">本文 *</label>
                        <textarea
                            id="bb-body"
                            value={newPost.body}
                            onChange={(e) => setNewPost(prev => ({ ...prev, body: e.target.value }))}
                            className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 min-h-[140px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="共有したい内容や依頼事項を記載してください。"
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="bb-tags" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">タグ（カンマ区切り）</label>
                        <input
                            id="bb-tags"
                            type="text"
                            value={newPost.tags}
                            onChange={(e) => setNewPost(prev => ({ ...prev, tags: e.target.value }))}
                            className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="例）生産計画, 連絡"
                        />
                    </div>
                    <div className="flex justify-end">
                        <button
                            type="submit"
                            className="inline-flex items-center gap-2 bg-blue-600 text-white font-semibold px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors"
                        >
                            <PlusCircle className="w-5 h-5" />
                            投稿する
                        </button>
                    </div>
                </form>
            </section>

            <section className="space-y-4">
                {filteredThreads.length === 0 && (
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-8 text-center text-slate-500 dark:text-slate-400">
                        条件に一致する投稿がありません。新規投稿してみましょう。
                    </div>
                )}
                {filteredThreads.map(thread => (
                    <article key={thread.id} className="bg-white dark:bg-slate-800 rounded-2xl shadow-md border border-slate-100 dark:border-slate-700/60">
                        <div className="p-6 space-y-4">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {thread.pinned && (
                                            <span className="inline-flex items-center text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">PIN</span>
                                        )}
                                        <p className="text-xs text-slate-500 dark:text-slate-400">{formatDateLabel(thread.createdAt)}</p>
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-1">{thread.title}</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">{thread.authorName}{thread.authorDepartment ? `（${thread.authorDepartment}）` : ''}</p>
                                </div>
                                {thread.tags && thread.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-2 justify-end">
                                        {thread.tags.map(tag => (
                                            <span key={tag} className="inline-flex items-center px-2 py-0.5 text-xs font-semibold bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded-full">
                                                #{tag}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <p className="text-base leading-relaxed whitespace-pre-wrap text-slate-800 dark:text-slate-100">{thread.body}</p>
                        </div>
                        <div className="border-t border-slate-100 dark:border-slate-700 px-6 py-4 space-y-4 bg-slate-50/70 dark:bg-slate-900/40 rounded-b-2xl">
                            <div className="space-y-3">
                                {thread.comments.length === 0 && (
                                    <p className="text-sm text-slate-500 dark:text-slate-400">まだコメントはありません。最初のフィードバックを投稿しましょう。</p>
                                )}
                                {thread.comments.map(comment => (
                                    <div key={comment.id} className="bg-white dark:bg-slate-800/70 border border-slate-100 dark:border-slate-700 rounded-xl p-4">
                                        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                                            <span>{comment.authorName}{comment.authorDepartment ? `（${comment.authorDepartment}）` : ''}</span>
                                            <span>{formatDateLabel(comment.createdAt)}</span>
                                        </div>
                                        <p className="mt-2 text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap">{comment.body}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="space-y-2">
                                <textarea
                                    value={commentDrafts[thread.id] || ''}
                                    onChange={(e) => setCommentDrafts(prev => ({ ...prev, [thread.id]: e.target.value }))}
                                    placeholder="コメントを入力（全従業員が閲覧できます）"
                                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                                <div className="flex justify-end">
                                    <button
                                        type="button"
                                        onClick={() => handleAddComment(thread.id)}
                                        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700"
                                    >
                                        コメントを投稿
                                    </button>
                                </div>
                            </div>
                        </div>
                    </article>
                ))}
            </section>
        </div>
    );
};

export default BulletinBoardPage;
