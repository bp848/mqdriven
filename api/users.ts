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

export default async function handler(req: any, res: any) {
    if (req.method !== 'GET') {
        return sendMethodNotAllowed(res, 'GET');
    }

    const supabase = getServerSupabase();
    if (!supabase) {
        return res.status(503).json({ error: 'Database client not initialized.' });
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
            console.error('Error from users table query:', userError);
            return res.status(500).json({ error: 'Database error', details: userError.message });
        }
        if (departmentError) {
            console.warn('Failed to fetch departments for user mapping:', departmentError.message);
        }
        if (titleError) {
            console.warn('Failed to fetch titles for user mapping:', titleError.message);
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
    } catch (err) {
        console.error('Unexpected error in GET /api/users:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
