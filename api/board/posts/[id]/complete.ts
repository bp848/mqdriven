import { getServerSupabase } from '../../../_lib/supabaseClient';

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

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
    res.setHeader('Allow', 'PUT');
    res.status(405).json({ error: 'Method Not Allowed' });
};

const isUuid = (value: unknown): value is string =>
    typeof value === 'string' && UUID_REGEX.test(value);

export default async function handler(req: any, res: any) {
    if (req.method !== 'PUT') {
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
        const body = parseJsonBody(req) as { user_id?: string | null };
        const { error } = await supabase.rpc('complete_task', {
            p_post_id: postId,
            p_user_id: isUuid(body.user_id) ? body.user_id : null,
        });

        if (error) {
            console.error('Error from complete_task RPC:', error);
            return res.status(500).json({ error: 'Database error', details: error.message });
        }

        return res.status(200).json({ message: 'Task completed successfully' });
    } catch (err) {
        console.error(`Unexpected error in PUT /api/board/posts/${postId}/complete:`, err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
