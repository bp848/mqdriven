import { getServerSupabase } from './_lib/supabaseClient';

type EmployeeRow = {
    id: string;
    name: string | null;
    email: string | null;
    role: string | null;
    created_at: string;
    department_id?: string | null;
    position_id?: string | null;
    is_active?: boolean | null;
};

const normalizeString = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
};

const sendMethodNotAllowed = (res: any, allow: string) => {
    res.setHeader('Allow', allow);
    res.status(405).json({ error: 'Method Not Allowed' });
};

const createRequestId = () => Math.random().toString(36).slice(2, 10);
const getSupabaseStatus = (error?: { code?: string | null }) => {
    if (!error?.code) return 400;
    if (error.code === '42501') return 403; // insufficient privilege
    if (error.code === 'PGRST301') return 401;
    return 400;
};

export default async function handler(req: any, res: any) {
    if (req.method !== 'GET') {
        return sendMethodNotAllowed(res, 'GET');
    }

    const requestId = createRequestId();
    const supabase = getServerSupabase();
    if (!supabase) {
        console.error('[api/users] missing Supabase client', { requestId });
        return res.status(503).json({ error: 'Database client not initialized.', requestId });
    }

    try {
        const [
            { data: userRows, error: userError },
            { data: departmentRows, error: departmentError },
            { data: titleRows, error: titleError },
        ] = await Promise.all([
            supabase
                .from('users')
                .select('id, name, email, role, created_at, department_id, position_id, is_active')
                .order('name', { ascending: true }),
            supabase.from('departments').select('id, name'),
            supabase.from('employee_titles').select('id, name'),
        ]);

        if (userError) {
            const status = getSupabaseStatus(userError);
            console.error('[api/users] users query failed', { requestId, code: userError.code, message: userError.message });
            return res.status(status).json({ error: userError.message, code: userError.code, requestId });
        }
        if (departmentError) {
            console.warn('[api/users] departments query failed', { requestId, message: departmentError.message });
        }
        if (titleError) {
            console.warn('[api/users] employee_titles query failed', { requestId, message: titleError.message });
        }

        const departmentMap = new Map<string, string>();
        (departmentRows || []).forEach(row => {
            const id = normalizeString(row?.id);
            if (id) {
                departmentMap.set(id, row?.name ?? '');
            }
        });

        const titleMap = new Map<string, string>();
        (titleRows || []).forEach(row => {
            const id = normalizeString(row?.id);
            if (id) {
                titleMap.set(id, row?.name ?? '');
            }
        });

        const payload = (userRows || []).map((row: EmployeeRow) => {
            const id = row.id;
            const role = row.role === 'admin' ? 'admin' : 'user';
            const departmentId = normalizeString(row.department_id);
            const titleId = normalizeString(row.position_id);
            return {
                id,
                name: row.name ?? '（未設定）',
                department: departmentId ? departmentMap.get(departmentId) ?? null : null,
                title: titleId ? titleMap.get(titleId) ?? null : null,
                email: row.email ?? '',
                role,
                createdAt: row.created_at,
                isActive: row.is_active ?? null,
            };
        });

        return res.status(200).json(payload);
    } catch (err: any) {
        console.error('[api/users] unexpected error', { requestId, err: err?.message, stack: err?.stack });
        return res.status(500).json({ error: 'Internal server error', requestId });
    }
}
