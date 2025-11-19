import { BulletinComment, BulletinPost } from '../types';

export type BulletinThread = BulletinPost & { comments: BulletinComment[] };

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
        assigneeIds: ['user-ops-01'],
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

export const loadStoredThreads = (): BulletinThread[] => {
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
            assigneeIds: Array.isArray(thread.assigneeIds) ? thread.assigneeIds : (thread.assigneeIds ? [thread.assigneeIds as unknown as string] : []),
        }));
    } catch (error) {
        console.warn('Failed to load bulletin board state from localStorage', error);
        return seedThreads;
    }
};

export const persistThreads = (threads: BulletinThread[]) => {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(threads));
    } catch (error) {
        console.warn('Failed to persist bulletin board state', error);
    }
};
