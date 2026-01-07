import React, { useEffect, useMemo, useState } from 'react';
import { EmployeeUser, KnowledgeArticle, Toast } from '../types';
import {
    createKnowledgeArticle,
    fetchKnowledgeArticles,
    KnowledgeArticleInput,
    removeKnowledgeArticle,
    updateKnowledgeArticle,
} from '../services/knowledgeBaseService';
import { BookOpen, Lightbulb, PlusCircle, RefreshCw, Search, Trash2 } from './Icons';

type KnowledgeBasePageProps = {
    currentUser: EmployeeUser | null;
    addToast: (message: string, type: Toast['type']) => void;
    allUsers: EmployeeUser[];
};

const defaultForm: KnowledgeArticleInput = {
    title: '',
    body: '',
    summary: '',
    category: '',
    tags: [],
    pinned: false,
};

const KnowledgeBasePage: React.FC<KnowledgeBasePageProps> = ({ currentUser, addToast, allUsers }) => {
    const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
    const [form, setForm] = useState<KnowledgeArticleInput>(defaultForm);
    const [tagsInput, setTagsInput] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const loadArticles = async () => {
        setIsLoading(true);
        try {
            const data = await fetchKnowledgeArticles(allUsers);
            setArticles(data);
            if (!selectedArticleId && data.length) {
                setSelectedArticleId(data[0].id);
                const first = data[0];
                setForm({
                    title: first.title,
                    body: first.body,
                    summary: first.summary,
                    category: first.category,
                    tags: first.tags,
                    pinned: Boolean(first.pinned),
                });
                setTagsInput(first.tags.join(', '));
            }
        } catch (error) {
            console.error('Failed to load knowledge articles', error);
            addToast('ナレッジベースの読み込みに失敗しました。', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadArticles();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const categories = useMemo(() => {
        const set = new Set<string>();
        articles.forEach(article => set.add(article.category || '共通'));
        return Array.from(set);
    }, [articles]);

    const filteredArticles = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        return articles.filter(article => {
            if (categoryFilter !== 'all' && article.category !== categoryFilter) return false;
            if (!term) return true;
            const haystack = [
                article.title,
                article.summary,
                article.category,
                article.tags.join(' '),
                article.body,
                article.authorName || '',
            ]
                .join(' ')
                .toLowerCase();
            return haystack.includes(term);
        });
    }, [articles, searchTerm, categoryFilter]);

    const pinnedArticles = useMemo(
        () => filteredArticles.filter(article => article.pinned),
        [filteredArticles]
    );
    const otherArticles = useMemo(
        () => filteredArticles.filter(article => !article.pinned),
        [filteredArticles]
    );

    const activeArticle = useMemo(
        () => articles.find(article => article.id === selectedArticleId) || null,
        [articles, selectedArticleId]
    );

    const handleSelectArticle = (article: KnowledgeArticle) => {
        setSelectedArticleId(article.id);
        setForm({
            title: article.title,
            body: article.body,
            summary: article.summary,
            category: article.category,
            tags: article.tags,
            pinned: Boolean(article.pinned),
        });
        setTagsInput(article.tags.join(', '));
    };

    const handleCreateOrUpdate = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!currentUser) {
            addToast('左下のユーザーセレクターからユーザーを選択してください。', 'warning');
            return;
        }
        if (!form.title.trim() || !form.body.trim()) {
            addToast('タイトルと本文は必須です。', 'error');
            return;
        }

        setIsSaving(true);
        try {
            const payload: KnowledgeArticleInput = {
                ...form,
                tags: tagsInput
                    .split(',')
                    .map(tag => tag.trim())
                    .filter(Boolean),
            };
            let saved: KnowledgeArticle;
            if (selectedArticleId) {
                saved = await updateKnowledgeArticle(selectedArticleId, payload, allUsers);
                setArticles(prev => prev.map(item => (item.id === saved.id ? saved : item)));
                addToast('ナレッジを更新しました。', 'success');
            } else {
                saved = await createKnowledgeArticle(payload, currentUser, allUsers);
                setArticles(prev => [saved, ...prev]);
                addToast('ナレッジを登録しました。', 'success');
            }
            setSelectedArticleId(saved.id);
        } catch (error) {
            console.error('Failed to save knowledge article', error);
            addToast('保存に失敗しました。', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedArticleId) return;
        const confirmed = typeof window === 'undefined' ? true : window.confirm('このナレッジを削除しますか？');
        if (!confirmed) return;
        try {
            await removeKnowledgeArticle(selectedArticleId);
            setArticles(prev => prev.filter(item => item.id !== selectedArticleId));
            setSelectedArticleId(null);
            setForm(defaultForm);
            setTagsInput('');
            addToast('削除しました。', 'info');
        } catch (error) {
            console.error('Failed to delete knowledge article', error);
            addToast('削除に失敗しました。', 'error');
        }
    };

    const handleResetForm = () => {
        setSelectedArticleId(null);
        setForm(defaultForm);
        setTagsInput('');
    };

    return (
        <div className="space-y-6">
            <section className="rounded-2xl bg-gradient-to-r from-sky-800 via-sky-700 to-emerald-600 text-white shadow-lg p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-white/15">
                        <BookOpen className="w-8 h-8" />
                    </div>
                    <div>
                        <p className="text-sm uppercase tracking-wide text-white/80">Knowledge Base</p>
                        <h2 className="text-2xl font-bold">ナレッジベース・コーナー</h2>
                        <p className="text-sm text-white/80 mt-1">現場で溜まった知見を即座に検索・再利用し、メンバー全員の引き出しを増やします。</p>
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-3 w-full md:w-auto">
                    <div className="rounded-xl bg-white/15 px-3 py-2 text-center">
                        <p className="text-xs text-white/80">記事数</p>
                        <p className="text-xl font-bold">{articles.length}</p>
                    </div>
                    <div className="rounded-xl bg-white/15 px-3 py-2 text-center">
                        <p className="text-xs text-white/80">ピン留め</p>
                        <p className="text-xl font-bold">{articles.filter(a => a.pinned).length}</p>
                    </div>
                    <div className="rounded-xl bg-white/15 px-3 py-2 text-center">
                        <p className="text-xs text-white/80">最終更新</p>
                        <p className="text-sm font-semibold">
                            {articles[0]?.updatedAt ? new Date(articles[0].updatedAt).toLocaleDateString() : '-'}
                        </p>
                    </div>
                </div>
            </section>

            <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-4 md:p-5">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                    <div className="md:col-span-2 relative">
                        <Search className="w-5 h-5 text-slate-400 absolute left-3 top-3" />
                        <input
                            type="search"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="タイトル・タグ・本文から検索"
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                    </div>
                    <div className="md:col-span-2">
                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                            <option value="all">カテゴリ: すべて</option>
                            {categories.map(category => (
                                <option key={category} value={category}>{category}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex gap-3 justify-end">
                        <button
                            type="button"
                            onClick={handleResetForm}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700/60"
                        >
                            <PlusCircle className="w-4 h-4" />
                            新規作成
                        </button>
                        <button
                            type="button"
                            onClick={loadArticles}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800"
                        >
                            <RefreshCw className="w-4 h-4" />
                            更新
                        </button>
                    </div>
                </div>
            </section>

            <div className="grid lg:grid-cols-5 gap-6">
                <section className="lg:col-span-2 space-y-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-4 md:p-5">
                        <div className="flex items-center gap-2 mb-3">
                            <Lightbulb className="w-5 h-5 text-amber-500" />
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-white">ナレッジコーナー (ピン留め)</h3>
                        </div>
                        {isLoading ? (
                            <p className="text-sm text-slate-500 dark:text-slate-400">読み込み中...</p>
                        ) : pinnedArticles.length === 0 ? (
                            <p className="text-sm text-slate-500 dark:text-slate-400">ピン留めされたナレッジはありません。</p>
                        ) : (
                            <div className="space-y-3">
                                {pinnedArticles.map(article => (
                                    <article
                                        key={article.id}
                                        className={`border rounded-xl p-3 cursor-pointer transition hover:shadow-sm ${
                                            selectedArticleId === article.id
                                                ? 'border-emerald-400 dark:border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10'
                                                : 'border-slate-200 dark:border-slate-700'
                                        }`}
                                        onClick={() => handleSelectArticle(article)}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-xs text-emerald-600 dark:text-emerald-300 font-semibold">{article.category}</p>
                                                <h4 className="text-sm font-bold text-slate-800 dark:text-white mt-0.5">{article.title}</h4>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{article.summary}</p>
                                            </div>
                                            <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/20">PIN</span>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-4 md:p-5">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-white">ナレッジ一覧</h3>
                            <span className="text-xs text-slate-500 dark:text-slate-400">{filteredArticles.length} 件</span>
                        </div>
                        {isLoading ? (
                            <p className="text-sm text-slate-500 dark:text-slate-400">読み込み中...</p>
                        ) : filteredArticles.length === 0 ? (
                            <p className="text-sm text-slate-500 dark:text-slate-400">ナレッジが見つかりません。新規作成してください。</p>
                        ) : (
                            <div className="divide-y divide-slate-200 dark:divide-slate-700">
                                {[...pinnedArticles, ...otherArticles].map(article => (
                                    <article
                                        key={article.id}
                                        onClick={() => handleSelectArticle(article)}
                                        className={`py-3 cursor-pointer transition ${
                                            selectedArticleId === article.id
                                                ? 'bg-sky-50 dark:bg-sky-900/30'
                                                : 'hover:bg-slate-50 dark:hover:bg-slate-700/40'
                                        } px-2 rounded-lg`}
                                    >
                                        <div className="flex items-start gap-2">
                                            <div className="mt-1">
                                                <BookOpen className={`w-4 h-4 ${article.pinned ? 'text-emerald-500' : 'text-slate-400'}`} />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">{article.category}</p>
                                                    {article.tags.slice(0, 3).map(tag => (
                                                        <span key={tag} className="text-[10px] px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200">
                                                            #{tag}
                                                        </span>
                                                    ))}
                                                </div>
                                                <p className="text-sm font-semibold text-slate-800 dark:text-white">{article.title}</p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{article.summary}</p>
                                                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                                                    更新: {new Date(article.updatedAt).toLocaleString()}
                                                    {article.authorName ? ` ｜ ${article.authorName}` : ''}
                                                </p>
                                            </div>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}
                    </div>
                </section>

                <section className="lg:col-span-3 space-y-4">
                    <form className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-5 space-y-4" onSubmit={handleCreateOrUpdate}>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">編集フォーム</p>
                                <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
                                    {selectedArticleId ? 'ナレッジを更新' : '新規ナレッジを作成'}
                                </h3>
                            </div>
                            {selectedArticleId && (
                                <button
                                    type="button"
                                    onClick={handleDelete}
                                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-500/40 dark:text-rose-200 dark:hover:bg-rose-900/40 text-sm font-semibold"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    削除
                                </button>
                            )}
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">タイトル *</label>
                                <input
                                    type="text"
                                    value={form.title}
                                    onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                                    className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                                    placeholder="例）FAX OCRトラブルシューティング手順"
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">カテゴリ</label>
                                <input
                                    type="text"
                                    value={form.category}
                                    onChange={(e) => setForm(prev => ({ ...prev, category: e.target.value }))}
                                    className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                    placeholder="営業 / 製造 / 管理 など"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">タグ（カンマ区切り）</label>
                                <input
                                    type="text"
                                    value={tagsInput}
                                    onChange={(e) => {
                                        setTagsInput(e.target.value);
                                        setForm(prev => ({ ...prev, tags: e.target.value.split(',').map(tag => tag.trim()).filter(Boolean) }));
                                    }}
                                    className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                    placeholder="例）OCR, 受注, トラブルシュート"
                                />
                            </div>
                            <div className="flex items-center gap-2 mt-6">
                                <input
                                    id="kb-pinned"
                                    type="checkbox"
                                    checked={form.pinned}
                                    onChange={(e) => setForm(prev => ({ ...prev, pinned: e.target.checked }))}
                                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                />
                                <label htmlFor="kb-pinned" className="text-sm font-semibold text-slate-700 dark:text-slate-200">ピン留め（コーナーに表示）</label>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">要約 / ハイライト</label>
                            <textarea
                                value={form.summary}
                                onChange={(e) => setForm(prev => ({ ...prev, summary: e.target.value }))}
                                className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 min-h-[64px]"
                                placeholder="1〜2行で結論や再現手順を書くと検索精度が上がります。"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">本文 *</label>
                            <textarea
                                value={form.body}
                                onChange={(e) => setForm(prev => ({ ...prev, body: e.target.value }))}
                                className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-3 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 min-h-[240px]"
                                placeholder="手順や背景、リンク、担当者メモなどを自由に記載してください。"
                                required
                            />
                        </div>
                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={handleResetForm}
                                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700/60"
                            >
                                リセット
                            </button>
                            <button
                                type="submit"
                                disabled={isSaving}
                                className={`inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white ${
                                    isSaving ? 'bg-slate-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'
                                }`}
                            >
                                <PlusCircle className="w-4 h-4" />
                                {selectedArticleId ? '更新する' : '登録する'}
                            </button>
                        </div>
                    </form>

                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-5">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-white">プレビュー</h3>
                            {activeArticle && (
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                    {new Date(activeArticle.updatedAt).toLocaleString()} 更新
                                </span>
                            )}
                        </div>
                        {activeArticle ? (
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200">
                                        {activeArticle.category}
                                    </span>
                                    {activeArticle.pinned && (
                                        <span className="px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-xs font-semibold text-emerald-700 dark:text-emerald-200">
                                            PIN
                                        </span>
                                    )}
                                    {activeArticle.tags.map(tag => (
                                        <span key={tag} className="text-[11px] px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200">
                                            #{tag}
                                        </span>
                                    ))}
                                </div>
                                <h4 className="text-xl font-bold text-slate-900 dark:text-white">{activeArticle.title}</h4>
                                <p className="text-sm text-slate-600 dark:text-slate-300">{activeArticle.summary}</p>
                                <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
                                    <div className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                                        {activeArticle.body}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-slate-500 dark:text-slate-400">プレビューするナレッジを選択してください。</p>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
};

export default KnowledgeBasePage;
