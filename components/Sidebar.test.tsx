import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Sidebar from './Sidebar';

describe('Sidebar', () => {
  it('has proper desktop visibility classes', () => {
    const onNavigate = vi.fn();
    const { container } = render(
      <Sidebar
        currentPage={'sales_dashboard' as any}
        onNavigate={onNavigate}
        currentUser={{ id: 'admin-1', name: 'Admin User', role: 'admin' } as any}
        supabaseUserEmail="admin@example.com"
        onSignOut={vi.fn()}
        approvalsCount={0}
      />
    );
    const aside = container.querySelector('aside');
    expect(aside).not.toBeNull();
    expect(aside?.className).toContain('bg-slate-800');
    expect(aside?.className).toContain('text-white');
  });
});
