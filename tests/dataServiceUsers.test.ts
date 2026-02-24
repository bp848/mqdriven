import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addUser, getUsers, updateUser } from '../services/dataService';

let supabaseStub: any;

vi.mock('../services/supabaseClient', () => ({
  getSupabase: () => supabaseStub,
  getSupabaseFunctionHeaders: vi.fn(),
}));

describe('dataService user mutations', () => {
  beforeEach(() => {
    supabaseStub = undefined;
  });

  it('includes name_kana in user insert payload', async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    const fromMock = vi.fn().mockReturnValue({ insert: insertMock });
    supabaseStub = { from: fromMock };

    await addUser({
      name: '山田太郎',
      nameKana: 'ヤマダタロウ',
      email: 'taro@example.com',
      role: 'user',
      isActive: true,
    });

    expect(fromMock).toHaveBeenCalledWith('users');
    expect(insertMock).toHaveBeenCalledWith({
      email: 'taro@example.com',
      name: '山田太郎',
      name_kana: 'ヤマダタロウ',
      role: 'user',
      is_active: true,
      notification_enabled: true,
    });
  });

  it('retries user insert when name_kana column is missing', async () => {
    const insertMock = vi
      .fn()
      .mockResolvedValueOnce({ error: { message: 'column "name_kana" does not exist' } })
      .mockResolvedValueOnce({ error: null });
    const fromMock = vi.fn().mockReturnValue({ insert: insertMock });
    supabaseStub = { from: fromMock };

    await addUser({
      name: '山田太郎',
      nameKana: 'ヤマダタロウ',
      email: 'taro@example.com',
      role: 'user',
    });

    expect(insertMock).toHaveBeenCalledTimes(2);
    expect(insertMock.mock.calls[0][0]).toHaveProperty('name_kana', 'ヤマダタロウ');
    expect(insertMock.mock.calls[1][0]).not.toHaveProperty('name_kana');
  });

  it('updates name_kana when provided', async () => {
    const eqMock = vi
      .fn()
      .mockResolvedValueOnce({ error: { message: 'column "name_kana" does not exist' } })
      .mockResolvedValueOnce({ error: null });
    const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
    const fromMock = vi.fn().mockReturnValue({ update: updateMock });
    supabaseStub = { from: fromMock };

    await updateUser('user-1', { name: '山田太郎', nameKana: 'ヤマダタロウ' });

    expect(updateMock).toHaveBeenCalledTimes(2);
    expect(updateMock.mock.calls[0][0]).toHaveProperty('name_kana', 'ヤマダタロウ');
    expect(updateMock.mock.calls[1][0]).not.toHaveProperty('name_kana');
    expect(eqMock).toHaveBeenCalledWith('id', 'user-1');
  });
});

describe('getUsers name_kana fallback', () => {
  beforeEach(() => {
    supabaseStub = undefined;
  });

  it('falls back to user select without name_kana when missing', async () => {
    const orderMock = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'column "name_kana" does not exist' },
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: 'user-1',
            name: '山田太郎',
            email: 'taro@example.com',
            role: 'user',
            created_at: '2025-01-01',
            department_id: null,
            position_id: null,
            is_active: true,
          },
        ],
        error: null,
      });
    const userSelectMock = vi.fn().mockReturnValue({ order: orderMock });
    const deptSelectMock = vi.fn().mockResolvedValue({ data: [], error: null });
    const titleSelectMock = vi.fn().mockResolvedValue({ data: [], error: null });

    const fromMock = vi.fn((table: string) => {
      if (table === 'users') {
        return { select: userSelectMock };
      }
      if (table === 'departments') {
        return { select: deptSelectMock };
      }
      if (table === 'employee_titles') {
        return { select: titleSelectMock };
      }
      return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
    });

    supabaseStub = { from: fromMock };

    const users = await getUsers();

    expect(users).toHaveLength(1);
    expect(users[0].name).toBe('山田太郎');
    expect(userSelectMock).toHaveBeenCalledTimes(2);
  });
});
