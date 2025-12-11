import { getServerSupabase } from '../_lib/supabaseClient';

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
const VISIBILITY_VALUES = new Set(['all', 'public', 'private', 'assigned']);

const createRequestId = () => Math.random().toString(36).slice(2, 10);

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

const isUuid = (value: unknown): value is string =>
    typeof value === 'string' && UUID_REGEX.test(value);

const normalizeUuidArray = (values: unknown): string[] => {
    if (!Array.isArray(values)) {
        return [];
    }
    return values.filter(isUuid);
};

const getSupabaseStatus = (error: { code?: string | null }) => {
    if (!error?.code) return 400;
    if (error.code === '23505') return 409; // unique violation
    if (error.code === '23503') return 400; // FK violation
    return 400;
};

const validatePostPayload = (body: any) => {
    const errors: string[] = [];
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    const content = typeof body?.content === 'string' ? body.content.trim() : '';
    const visibility = typeof body?.visibility === 'string' ? body.visibility : 'all';
    const isTask = typeof body?.is_task === 'boolean' ? body.is_task : false;
    const dueDate = body?.due_date ?? null;
    const assigneesRaw = body?.assignees;
    const createdBy = typeof body?.created_by === 'string' ? body.created_by : null;

    if (!title) {
        errors.push('title is required');
    }
    if (!content) {
        errors.push('content is required');
    }
    if (!VISIBILITY_VALUES.has(visibility)) {
        errors.push(`visibility must be one of: ${Array.from(VISIBILITY_VALUES).join(', ')}`);
    }
    if (assigneesRaw !== undefined && !Array.isArray(assigneesRaw)) {
        errors.push('assignees must be an array of UUID strings');
    }
    if (dueDate !== null && dueDate !== undefined) {
        const date = new Date(dueDate);
        if (Number.isNaN(date.getTime())) {
            errors.push('due_date must be a valid date string or null');
        }
    }
    if (createdBy && !isUuid(createdBy)) {
        errors.push('created_by must be a valid UUID');
    }

    return {
        errors,
        payload: {
            title,
            content,
            visibility,
            is_task: isTask,
            due_date: dueDate ?? null,
            assignees: normalizeUuidArray(assigneesRaw),
            created_by: createdBy && isUuid(createdBy) ? createdBy : null,
        },
    };
};

export default async function handler(req: any, res: any) {
    const requestId = createRequestId();
    const supabase = getServerSupabase();
    if (!supabase) {
        console.error('[api/board/posts] missing Supabase client', { requestId });
        return res.status(503).json({ error: 'Database client not initialized.', requestId });
    }

    if (req.method === 'GET') {
        try {
            const userId = typeof req.query.user_id === 'string' ? req.query.user_id : null;
            const { data, error } = await supabase.rpc('get_user_posts', {
                p_user_id: userId,
            });

            if (error) {
                console.error('[api/board/posts] get_user_posts failed', { requestId, error });
                const status = getSupabaseStatus(error);
                return res.status(status).json({ error: error.message, requestId });
            }

            return res.status(200).json(data ?? []);
        } catch (err: any) {
            console.error('[api/board/posts] unexpected GET error', { requestId, err });
            return res.status(500).json({ error: 'Internal server error', requestId });
        }
    }

    if (req.method === 'POST') {
        try {
            let body: any;
            try {
                body = parseJsonBody(req);
            } catch (parseErr: any) {
                console.error('[api/board/posts] invalid JSON body', { requestId, err: parseErr });
                return res.status(400).json({ error: 'Invalid JSON body', requestId });
            }

            const { errors, payload } = validatePostPayload(body);
            if (errors.length) {
                return res.status(400).json({ error: 'Invalid request body', details: errors, requestId });
            }

            const { data, error } = await supabase.rpc('create_post', {
                p_title: payload.title,
                p_content: payload.content,
                p_visibility: payload.visibility,
                p_is_task: payload.is_task,
                p_due_date: payload.due_date,
                p_assignees: payload.assignees,
                p_created_by: payload.created_by,
            });

            if (error) {
                const status = getSupabaseStatus(error);
                console.error('[api/board/posts] create_post failed', {
                    requestId,
                    code: error.code,
                    message: error.message,
                    details: error.details,
                });
                return res.status(status).json({ error: error.message, code: error.code, requestId });
            }

            if (!data) {
                console.error('[api/board/posts] create_post returned no data', { requestId });
                return res.status(500).json({ error: 'Post creation failed', requestId });
            }

            return res.status(201).json({ message: 'Post created successfully', post_id: data, requestId });
        } catch (err: any) {
            console.error('[api/board/posts] unexpected POST error', { requestId, err: err?.message, stack: err?.stack });
            return res.status(500).json({ error: 'Internal server error', requestId });
        }
    }

    return sendMethodNotAllowed(res, 'GET, POST');
}
