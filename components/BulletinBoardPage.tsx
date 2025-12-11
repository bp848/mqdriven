import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BulletinThread, EmployeeUser, Toast } from '../types';
import { PlusCircle, Pencil, Trash2 } from './Icons';
import {
    getBulletinThreads,
    createBulletinThread,
    updateBulletinThread,
    deleteBulletinThread,
    addBulletinComment,
} from '../services/dataService';

interface BulletinBoardPageProps {
    currentUser: EmployeeUser | null;
    addToast: (message: string, type: Toast['type']) => void;
    allUsers: EmployeeUser[];
}

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

const BulletinBoardPage: React.FC<BulletinBoardPageProps> = ({ currentUser, addToast, allUsers }) => {
    const [threads, setThreads] = useState<BulletinThread[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showPinnedOnly, setShowPinnedOnly] = useState(false);
    const [showAssignedOnly, setShowAssignedOnly] = useState(false);
    const [newPost, setNewPost] = useState({ title: '', body: '', tags: '', due_date: '', is_task: false });
    const [newPostAssignees, setNewPostAssignees] = useState<string[]>([]);
    const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
    const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
    const [editingDraft, setEditingDraft] = useState({ title: '', body: '', tags: '', pinned: false, assigneeIds: [] as string[], due_date: '', is_task: false });
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmittingPost, setIsSubmittingPost] = useState(false);

    const userLookup = useMemo(() => {
        const map = new Map<string, EmployeeUser>();
        allUsers.forEach(user => {
            map.set(user.id, user);
        });
        return map;
    }, [allUsers]);

    const sortThreads = useCallback((items: BulletinThread[]) => {
        return [...items].sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });
    }, []);

    const refreshThreads = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await getBulletinThreads();
            setThreads(sortThreads(data));
        } catch (error) {
            console.error('Failed to load bulletin threads', error);
            addToast('掲示板の読み込みに失敗しました。', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [addToast, sortThreads]);

    useEffect(() => {
        refreshThreads();
    }, [refreshThreads]);

    const upsertThreadInState = useCallback((next: BulletinThread) => {
        setThreads(prev => {
            const without = prev.filter(thread => thread.id !== next.id);
            return sortThreads([next, ...without]);
        });
    }, [sortThreads]);

    const filteredThreads = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        return threads
            .filter(thread => {
                if (showPinnedOnly && !thread.pinned) {
                    return false;
                }
                if (showAssignedOnly) {
                    if (!currentUser) return false;
                    return thread.assigneeIds?.includes(currentUser.id) ?? false;
                }
                if (!term) return true;
                const tags = thread.tags || [];
                return (
                    thread.title.toLowerCase().includes(term) ||
                    thread.body.toLowerCase().includes(term) ||
                    tags.some(tag => tag.toLowerCase().includes(term))
                );
            })
            .sort((a, b) => {
                if (a.pinned && !b.pinned) return -1;
                if (!a.pinned && b.pinned) return 1;
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            });
    }, [threads, searchTerm, showPinnedOnly, showAssignedOnly, currentUser]);

    const handleCreatePost = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!currentUser) {
            addToast('投稿にはログインが必要です。', 'error');
            return;
        }
        if (!newPost.title.trim() || !newPost.body.trim()) {
            addToast('タイトルと本文は必須です。', 'error');
            return;
        }

        const tags = newPost.tags
            .split(',')
            .map(tag => tag.trim())
            .filter(Boolean);

        try {
            setIsSubmittingPost(true);
            const created = await createBulletinThread(
                {
                    title: newPost.title.trim(),
                    body: newPost.body.trim(),
                    tags,
                    assigneeIds: newPostAssignees,
                },
                currentUser
            );
            upsertThreadInState(created);
            setNewPost({ title: '', body: '', tags: '', due_date: '', is_task: false });
            setNewPostAssignees([]);
            addToast('掲示板に投稿しました。', 'success');
        } catch (error) {
            console.error('Failed to create bulletin thread', error);
            addToast('投稿に失敗しました。', 'error');
        } finally {
            setIsSubmittingPost(false);
        }
    };

    const handleAddComment = async (postId: string) => {
        const draft = commentDrafts[postId];
        if (!currentUser) {
            addToast('コメントにはログインが必要です。', 'error');
            return;
        }
        if (!draft || !draft.trim()) {
            addToast('コメントを入力してください。', 'error');
            return;
        }

        try {
            const comment = await addBulletinComment(postId, draft.trim(), currentUser);
            setCommentDrafts(prev => ({ ...prev, [postId]: '' }));
            setThreads(prev => {
                const updated = prev.map(thread =>
                    thread.id === postId
                        ? { ...thread, comments: [...thread.comments, comment], updatedAt: comment.createdAt }
                        : thread
                );
                return sortThreads(updated);
            });
            addToast('コメントを追加しました。', 'success');
        } catch (error) {
            console.error('Failed to add bulletin comment', error);
            addToast('コメントの追加に失敗しました。', 'error');
        }
    };

    const canManageThread = (thread: BulletinThread) => {
        if (!currentUser) return false;
        if (currentUser.role === 'admin') return true;
        return thread.authorId === currentUser.id;
    };

    const handleStartEdit = (thread: BulletinThread) => {
        if (!canManageThread(thread)) {
            addToast('編集権限がありません。', 'error');
            return;
        }
        setEditingThreadId(thread.id);
        setEditingDraft({
            title: thread.title,
            body: thread.body,
            tags: (thread.tags || []).join(', '),
            pinned: Boolean(thread.pinned),
            assigneeIds: Array.isArray(thread.assigneeIds) ? thread.assigneeIds : [],
        });
    };

    const handleCancelEdit = () => {
        setEditingThreadId(null);
        setEditingDraft({ title: '', body: '', tags: '', pinned: false, assigneeIds: [], due_date: '', is_task: false });
    };

    const handleUpdateThread = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!editingThreadId) return;
        const targetThread = threads.find(thread => thread.id === editingThreadId);
        if (!targetThread || !canManageThread(targetThread)) {
            addToast('編集権限がありません。', 'error');
            return;
        }
        const title = editingDraft.title.trim();
        const body = editingDraft.body.trim();
        if (!title || !body) {
            addToast('タイトルと本文は必須です。', 'error');
            return;
        }
        const tags = editingDraft.tags
            .split(',')
            .map(tag => tag.trim())
            .filter(Boolean);
        try {
            const updated = await updateBulletinThread(editingThreadId, {
                title,
                body,
                tags,
                pinned: editingDraft.pinned,
                assigneeIds: editingDraft.assigneeIds,
            });
            upsertThreadInState(updated);
            setEditingThreadId(null);
            setEditingDraft({ title: '', body: '', tags: '', pinned: false, assigneeIds: [], due_date: '', is_task: false });
            addToast('投稿を更新しました。', 'success');
        } catch (error) {
            console.error('Failed to update bulletin thread', error);
            addToast('投稿の更新に失敗しました。', 'error');
        }
    };

    const handleDeleteThread = async (thread: BulletinThread) => {
        if (!canManageThread(thread)) {
            addToast('削除権限がありません。', 'error');
            return;
        }
        const confirmed = typeof window === 'undefined' ? true : window.confirm('この投稿を削除しますか？');
        if (!confirmed) {
            return;
        }
        try {
            await deleteBulletinThread(thread.id);
            setThreads(prev => prev.filter(item => item.id !== thread.id));
            setCommentDrafts(prev => {
                const next = { ...prev };
                delete next[thread.id];
                return next;
            });
            if (editingThreadId === thread.id) {
                handleCancelEdit();
            }
            addToast('投稿を削除しました。', 'info');
        } catch (error) {
            console.error('Failed to delete bulletin thread', error);
            addToast('投稿の削除に失敗しました。', 'error');
        }
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
                    {currentUser && (
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                            <input
                                type="checkbox"
                                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                checked={showAssignedOnly}
                                onChange={(e) => setShowAssignedOnly(e.target.checked)}
                            />
                            自分宛の依頼のみ
                        </label>
                    )}
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
                {!currentUser && (
                    <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200">
                        投稿やコメントを行うには管理画面左下からユーザーを選択してください。
                    </p>
                )}
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
                    <div>
                        <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">タスク依頼先（複数選択可）</label>
                        <select
                            multiple
                            value={newPostAssignees}
                            onChange={(e) => {
                                const selected = Array.from(e.target.selectedOptions).map(option => option.value);
                                setNewPostAssignees(selected);
                            }}
                            className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[120px]"
                        >
                            {allUsers.map(user => (
                                <option key={user.id} value={user.id}>
                                    {user.name}{user.department ? `（${user.department}）` : ''}
                                </option>
                            ))}
                        </select>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">依頼対象を指定すると、相手の「自分宛のみ」フィルターに表示されます。</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">タスクとして投稿</label>
                        <input
                            type="checkbox"
                            checked={newPost.is_task}
                            onChange={(e) => setNewPost(prev => ({ ...prev, is_task: e.target.checked }))}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                    </div>
                    {newPost.is_task && (
                        <div>
                            <label htmlFor="bb-due-date" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">期日</label>
                            <input
                                id="bb-due-date"
                                type="datetime-local"
                                value={newPost.due_date}
                                onChange={(e) => setNewPost(prev => ({ ...prev, due_date: e.target.value }))}
                                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    )}
                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={!currentUser || isSubmittingPost}
                            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-colors ${
                                !currentUser || isSubmittingPost
                                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                                    : 'bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                        >
                            <PlusCircle className="w-5 h-5" />
                            {isSubmittingPost ? '送信中...' : '投稿する'}
                        </button>
                    </div>
                </form>
            </section>

            <section className="space-y-4">
                {isLoading ? (
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-8 text-center text-slate-500 dark:text-slate-400">
                        読み込み中です...
                    </div>
                ) : filteredThreads.length === 0 ? (
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-8 text-center text-slate-500 dark:text-slate-400">
                        条件に一致する投稿がありません。新規投稿してみましょう。
                    </div>
                ) : (
                filteredThreads.map(thread => {
                    const isEditing = editingThreadId === thread.id;
                    const manageAccess = canManageThread(thread);
                    const assigneeUsers = (thread.assigneeIds || [])
                        .map(userId => userLookup.get(userId))
                        .filter((user): user is EmployeeUser => Boolean(user));
                    const isMyTask = currentUser ? thread.assigneeIds?.includes(currentUser.id) : false;
                    return (
                        <article
                            key={thread.id}
                            className={`bg-white dark:bg-slate-800 rounded-2xl shadow-md border ${
                                isMyTask ? 'border-emerald-400 dark:border-emerald-500' : 'border-slate-100 dark:border-slate-700/60'
                            }`}
                        >
                            <div className="p-6 space-y-4">
                                {isEditing ? (
                                    <form className="space-y-4" onSubmit={handleUpdateThread}>
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <p className="text-xs uppercase tracking-wide text-blue-600 font-semibold">編集中</p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                    {thread.authorName}
                                                    {thread.authorDepartment ? `（${thread.authorDepartment}）` : ''}
                                                </p>
                                            </div>
                                            <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-200">
                                                <input
                                                    type="checkbox"
                                                    checked={editingDraft.pinned}
                                                    onChange={(e) => setEditingDraft(prev => ({ ...prev, pinned: e.target.checked }))}
                                                    className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                                                />
                                                ピン留め
                                            </label>
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">タイトル</label>
                                            <input
                                                value={editingDraft.title}
                                                onChange={(e) => setEditingDraft(prev => ({ ...prev, title: e.target.value }))}
                                                className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">本文</label>
                                            <textarea
                                                value={editingDraft.body}
                                                onChange={(e) => setEditingDraft(prev => ({ ...prev, body: e.target.value }))}
                                                className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm min-h-[140px]"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">タグ（カンマ区切り）</label>
                                            <input
                                                value={editingDraft.tags}
                                                onChange={(e) => setEditingDraft(prev => ({ ...prev, tags: e.target.value }))}
                                                className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">タスク依頼先</label>
                                            <select
                                                multiple
                                                value={editingDraft.assigneeIds}
                                                onChange={(e) => {
                                                    const selected = Array.from(e.target.selectedOptions).map(option => option.value);
                                                    setEditingDraft(prev => ({ ...prev, assigneeIds: selected }));
                                                }}
                                                className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm min-h-[120px]"
                                            >
                                                {allUsers.map(user => (
                                                    <option key={user.id} value={user.id}>
                                                        {user.name}{user.department ? `（${user.department}）` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="flex justify-end gap-2">
                                            <button
                                                type="button"
                                                onClick={handleCancelEdit}
                                                className="rounded-xl border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-200"
                                            >
                                                キャンセル
                                            </button>
                                            <button
                                                type="submit"
                                                className="inline-flex items-center gap-2 bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-blue-700"
                                            >
                                                保存する
                                            </button>
                                        </div>
                                    </form>
                                ) : (
                                    <>
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    {thread.pinned && (
                                                        <span className="inline-flex items-center text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">PIN</span>
                                                    )}
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">{formatDateLabel(thread.createdAt)}</p>
                                                </div>
                                                <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-1">{thread.title}</h3>
                                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                                    {thread.authorName}
                                                    {thread.authorDepartment ? `（${thread.authorDepartment}）` : ''}
                                                </p>
                                            </div>
                                            <div className="flex flex-col items-end gap-2">
                                                {thread.tags && thread.tags.length > 0 && (
                                                    <div className="flex flex-wrap gap-2 justify-end">
                                                        {thread.tags.map(tag => (
                                                            <span key={tag} className="inline-flex items-center px-2 py-0.5 text-xs font-semibold bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded-full">
                                                                #{tag}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                                {assigneeUsers.length > 0 && (
                                                    <div className="flex flex-wrap gap-2 justify-end">
                                                        {assigneeUsers.map(user => (
                                                            <span key={user.id} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200 rounded-full">
                                                                <span className="inline-block w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                                                                {user.name}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                                {manageAccess && (
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleStartEdit(thread)}
                                                            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-200 hover:text-blue-600"
                                                        >
                                                            <Pencil className="w-4 h-4" />
                                                            編集
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteThread(thread)}
                                                            className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                            削除
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <p className="text-base leading-relaxed whitespace-pre-wrap text-slate-800 dark:text-slate-100">{thread.body}</p>
                                    </>
                                )}
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
                                    disabled={!currentUser}
                                    className={`w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                                        !currentUser ? 'opacity-60 cursor-not-allowed' : ''
                                    }`}
                                />
                                <div className="flex justify-end">
                                    <button
                                        type="button"
                                        onClick={() => handleAddComment(thread.id)}
                                        disabled={!currentUser}
                                        className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-semibold ${
                                            currentUser ? 'text-blue-600 hover:text-blue-700' : 'text-slate-400 cursor-not-allowed'
                                        }`}
                                    >
                                        コメントを投稿
                                    </button>
                                </div>
                            </div>
                        </div>
                        </article>
                    );
                }))}
            </section>
        </div>
    );
};

export default BulletinBoardPage;
