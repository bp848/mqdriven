import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Sidebar from './Sidebar';

describe('Sidebar', () => {
  it('keeps desktop visibility class as a static Tailwind class', () => {
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
    expect(aside?.className).toContain('sm:translate-x-0');
  });
});
