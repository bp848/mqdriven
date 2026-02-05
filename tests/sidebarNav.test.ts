import { describe, expect, it } from 'vitest';
import { buildNavCategories } from '../components/Sidebar';
import type { EmployeeUser } from '../types';

describe('sidebar navigation', () => {
  it('includes assistant entry for standard users', () => {
    const user: EmployeeUser = { id: 'u1', name: 'User', role: 'user' };
    const categories = buildNavCategories(user);
    const tools = categories.find((category) => category.id === 'tools');

    expect(tools).toBeTruthy();
    expect(tools?.items.some((item) => item.page === 'assistant')).toBe(true);
  });
});
