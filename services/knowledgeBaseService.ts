import { BulletinThread, EmployeeUser, KnowledgeArticle } from '../types';
import {
    getBulletinThreads,
    createBulletinThread,
    updateBulletinThread,
    deleteBulletinThread,
} from './dataService';

export type KnowledgeArticleInput = {
    title: string;
    body: string;
    summary?: string;
    category?: string;
    tags?: string[];
    pinned?: boolean;
};

type KnowledgeMetadata = {
    kb?: boolean;
    summary?: string;
    category?: string;
    tags?: string[];
    pinned?: boolean;
};

const KB_META_PREFIX = '<!--kb:';
const KB_META_SUFFIX = '-->';

const normalizeTags = (tags?: string[]): string[] => {
    const unique = new Set<string>();
    (tags ?? []).forEach(tag => {
        const trimmed = tag.trim();
        if (trimmed) unique.add(trimmed);
    });
    return Array.from(unique);
};

const toSummary = (summary: string | undefined, body: string): string => {
    if (summary && summary.trim()) return summary.trim();
    const collapsed = body.replace(/\s+/g, ' ').trim();
    return collapsed.slice(0, 140);
};

const encodeContentWithMeta = (body: string, meta: KnowledgeMetadata): string => {
    const payload: KnowledgeMetadata = {
        kb: true,
        pinned: Boolean(meta.pinned),
        category: meta.category?.trim() || '共通',
        tags: normalizeTags(meta.tags),
        summary: toSummary(meta.summary, body),
    };
    return `${KB_META_PREFIX}${JSON.stringify(payload)}${KB_META_SUFFIX}\n${body.trim()}`;
};

const parseContentMeta = (content: string): { meta: KnowledgeMetadata; body: string } => {
    if (!content.startsWith(KB_META_PREFIX)) {
        return { meta: {}, body: content };
    }
    const endIndex = content.indexOf(KB_META_SUFFIX);
    if (endIndex === -1) {
        return { meta: {}, body: content };
    }
    const rawMeta = content.slice(KB_META_PREFIX.length, endIndex);
    let meta: KnowledgeMetadata = {};
    try {
        meta = JSON.parse(rawMeta);
    } catch {
        meta = {};
    }
    const body = content.slice(endIndex + KB_META_SUFFIX.length).trimStart();
    return { meta, body };
};

const isKnowledgeThread = (thread: BulletinThread, meta: KnowledgeMetadata): boolean => {
    if (meta.kb === true) return true;
    const tags = normalizeTags([
        ...(Array.isArray(meta.tags) ? meta.tags : []),
        ...(Array.isArray(thread.tags) ? thread.tags : []),
    ]).map(tag => tag.toLowerCase());
    if (tags.some(tag => tag === 'kb' || tag === 'knowledge' || tag === 'ナレッジ')) {
        return true;
    }
    const title = thread.title?.toLowerCase() || '';
    return title.includes('kb') || title.includes('ナレッジ');
};

const toArticle = (
    thread: BulletinThread,
    meta: KnowledgeMetadata,
    body: string,
    userLookup: Map<string, EmployeeUser>
): KnowledgeArticle => {
    const tags = normalizeTags([
        ...(Array.isArray(meta.tags) ? meta.tags : []),
        ...(Array.isArray(thread.tags) ? thread.tags : []),
    ]);
    const author = userLookup.get(thread.authorId);
    return {
        id: thread.id,
        title: thread.title,
        summary: toSummary(meta.summary, body),
        category: meta.category?.trim() || '共通',
        tags,
        body,
        createdAt: thread.createdAt,
        updatedAt: thread.updatedAt,
        authorId: thread.authorId,
        authorName: author?.name ?? thread.authorName ?? '不明なユーザー',
        pinned: meta.pinned ?? thread.pinned ?? false,
    };
};

export const fetchKnowledgeArticles = async (allUsers: EmployeeUser[] = []): Promise<KnowledgeArticle[]> => {
    const threads = await getBulletinThreads();
    const userLookup = new Map<string, EmployeeUser>();
    allUsers.forEach(user => userLookup.set(user.id, user));

    const articles: KnowledgeArticle[] = [];
    for (const thread of threads) {
        const { meta, body } = parseContentMeta(thread.body || '');
        if (!isKnowledgeThread(thread, meta)) continue;
        articles.push(toArticle(thread, meta, body, userLookup));
    }

    return articles.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
};

export const createKnowledgeArticle = async (
    input: KnowledgeArticleInput,
    author: EmployeeUser,
    allUsers: EmployeeUser[] = []
): Promise<KnowledgeArticle> => {
    const content = encodeContentWithMeta(input.body, {
        summary: input.summary,
        category: input.category,
        tags: input.tags,
        pinned: input.pinned,
    });
    const created = await createBulletinThread(
        {
            title: input.title,
            body: content,
            tags: normalizeTags(input.tags),
            pinned: input.pinned,
        },
        author
    );
    const { meta, body } = parseContentMeta(created.body || '');
    const userLookup = new Map<string, EmployeeUser>();
    allUsers.forEach(user => userLookup.set(user.id, user));
    return toArticle(created, meta, body, userLookup);
};

export const updateKnowledgeArticle = async (
    id: string,
    input: KnowledgeArticleInput,
    allUsers: EmployeeUser[] = []
): Promise<KnowledgeArticle> => {
    const content = encodeContentWithMeta(input.body, {
        summary: input.summary,
        category: input.category,
        tags: input.tags,
        pinned: input.pinned,
    });
    const updated = await updateBulletinThread(id, {
        title: input.title,
        body: content,
        pinned: input.pinned,
        tags: normalizeTags(input.tags),
    });
    const { meta, body } = parseContentMeta(updated.body || '');
    const userLookup = new Map<string, EmployeeUser>();
    allUsers.forEach(user => userLookup.set(user.id, user));
    return toArticle(updated, meta, body, userLookup);
};

export const removeKnowledgeArticle = async (id: string): Promise<void> => {
    await deleteBulletinThread(id);
};
