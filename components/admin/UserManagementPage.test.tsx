import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import UserManagementPage from './UserManagementPage';

vi.mock('../../services/dataService', () => ({
  getUsers: vi.fn(),
  addUser: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
}));

describe('UserManagementPage impersonation', () => {
  const addToast = vi.fn();
  const requestConfirmation = vi.fn();
  const onImpersonateUser = vi.fn();

  beforeEach(async () => {
    vi.clearAllMocks();
    const dataService = await import('../../services/dataService');
    (dataService.getUsers as vi.Mock).mockResolvedValue([
      {
        id: 'u-admin',
        name: '管理者 太郎',
        email: 'admin@example.com',
        role: 'admin',
        department: '管理部',
        title: '管理者',
        isActive: true,
        createdAt: '2024-01-01',
      },
      {
        id: 'u-user',
        name: '一般 花子',
        email: 'user@example.com',
        role: 'user',
        department: '営業部',
        title: '担当',
        isActive: true,
        createdAt: '2024-01-02',
      },
    ]);
  });

  it('allows admin to impersonate another user from the user list', async () => {
    render(
      <UserManagementPage
        addToast={addToast}
        requestConfirmation={requestConfirmation}
        currentUser={{ id: 'u-admin', name: '管理者 太郎', role: 'admin' }}
        onImpersonateUser={onImpersonateUser}
      />
    );

    await screen.findByText('一般 花子');

    const impersonateButtons = screen.getAllByRole('button', { name: '代理ログイン' });
    await userEvent.click(impersonateButtons[0]);

    await waitFor(() => {
      expect(onImpersonateUser).toHaveBeenCalledWith(expect.objectContaining({ id: 'u-user' }));
      expect(addToast).toHaveBeenCalledWith('「一般 花子」として代理ログインしました。', 'success');
    });
  });
});
