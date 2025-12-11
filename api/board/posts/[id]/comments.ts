import { getServerSupabase } from '../../../_lib/supabaseClient';

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

const sendMethodNotAllowed = (res: any) => {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method Not Allowed' });
};

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return sendMethodNotAllowed(res);
    }

    const supabase = getServerSupabase();
    if (!supabase) {
        return res.status(503).json({ error: 'Database client not initialized.' });
    }

    const postId = typeof req.query.id === 'string' ? req.query.id : null;
    if (!postId) {
        return res.status(400).json({ error: 'Invalid post id' });
    }

    try {
        const body = parseJsonBody(req) as { content?: string; user_id?: string | null };
        const { data, error } = await supabase.rpc('add_comment', {
            p_post_id: postId,
            p_content: body.content,
            p_user_id: body.user_id ?? null,
        });

        if (error) {
            console.error('Error from add_comment RPC:', error);
            return res.status(500).json({ error: 'Database error', details: error.message });
        }

        return res.status(201).json({ message: 'Comment added successfully', comment_id: data });
    } catch (err) {
        console.error(`Unexpected error in POST /api/board/posts/${postId}/comments:`, err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
