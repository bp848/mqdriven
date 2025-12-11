import { getServerSupabase } from '../_lib/supabaseClient';

const parseJsonBody = (req: any) => {
    if (!req.body) {
        return {};
    }
    if (typeof req.body === 'string') {
        return req.body.length ? JSON.parse(req.body) : {};
    }
    if (Buffer.isBuffer(req.body)) {
        const text = req.body.toString('utf-8');
        return text.length ? JSON.parse(text) : {};
    }
    return req.body;
};

const sendMethodNotAllowed = (res: any, allow: string) => {
    res.setHeader('Allow', allow);
    res.status(405).json({ error: 'Method Not Allowed' });
};

export default async function handler(req: any, res: any) {
    const supabase = getServerSupabase();
    if (!supabase) {
        return res.status(503).json({ error: 'Database client not initialized.' });
    }

    if (req.method === 'GET') {
        try {
            const userId = typeof req.query.user_id === 'string' ? req.query.user_id : null;
            const { data, error } = await supabase.rpc('get_user_posts', {
                p_user_id: userId,
            });

            if (error) {
                console.error('Error from get_user_posts RPC:', error);
                return res.status(500).json({ error: 'Database error', details: error.message });
            }

            return res.status(200).json(data ?? []);
        } catch (err) {
            console.error('Unexpected error in GET /api/board/posts:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    if (req.method === 'POST') {
        try {
            const body = parseJsonBody(req) as {
                title?: string;
                content?: string;
                visibility?: string;
                is_task?: boolean;
                due_date?: string | null;
                assignees?: string[];
                created_by?: string | null;
            };

            const { data, error } = await supabase.rpc('create_post', {
                p_title: body.title,
                p_content: body.content,
                p_visibility: body.visibility ?? 'all',
                p_is_task: body.is_task ?? false,
                p_due_date: body.due_date ?? null,
                p_assignees: body.assignees ?? [],
                p_created_by: body.created_by ?? null,
            });

            if (error) {
                console.error('Error from create_post RPC:', error);
                return res.status(500).json({ error: 'Database error', details: error.message });
            }

            return res.status(201).json({ message: 'Post created successfully', post_id: data });
        } catch (err) {
            console.error('Unexpected error in POST /api/board/posts:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    return sendMethodNotAllowed(res, 'GET, POST');
}
