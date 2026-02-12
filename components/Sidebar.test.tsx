import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import Sidebar from './Sidebar';
import type { EmployeeUser } from '../types';

const buildUser = (overrides: Partial<EmployeeUser>): EmployeeUser => ({
  id: overrides.id ?? 'user-1',
  name: overrides.name ?? 'テストユーザー',
  role: overrides.role ?? 'employee',
  ...overrides,
});

describe('Sidebar', () => {
  it('管理者の現在ユーザーが非アクティブでもユーザー切替に表示される', async () => {
    const currentAdmin = buildUser({
      id: 'admin-inactive',
      name: '管理者（非アクティブ）',
      role: 'admin',
      is_active: false,
    });
    const activeUser = buildUser({
      id: 'active-user',
      name: 'アクティブユーザー',
      role: 'employee',
      is_active: true,
    });

    render(
      <Sidebar
        currentPage="approval_list"
        onNavigate={vi.fn()}
        currentUser={currentAdmin}
        allUsers={[activeUser]}
        onUserChange={vi.fn()}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'メニュー' }));

    const select = screen.getByLabelText('ユーザー切替') as HTMLSelectElement;
    expect(select.value).toBe('admin-inactive');
    expect(screen.getByRole('option', { name: '管理者（非アクティブ）' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'アクティブユーザー' })).toBeInTheDocument();
  });

  it('allUsers が空でも現在の管理者ユーザー名を表示する', async () => {
    const currentAdmin = buildUser({
      id: 'admin-user',
      name: '管理者',
      role: 'admin',
    });

    render(
      <Sidebar
        currentPage="approval_list"
        onNavigate={vi.fn()}
        currentUser={currentAdmin}
        allUsers={[]}
        onUserChange={vi.fn()}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'メニュー' }));

    const select = screen.getByLabelText('ユーザー切替') as HTMLSelectElement;
    expect(select.value).toBe('admin-user');
    expect(screen.getByRole('option', { name: '管理者' })).toBeInTheDocument();
  });
});
