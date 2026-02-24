import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getApprovedApplications } from '../services/dataService';

let supabaseStub: any;

vi.mock('../services/supabaseClient', () => ({
  getSupabase: () => supabaseStub,
  getSupabaseFunctionHeaders: vi.fn(),
}));

const makeApprovedApplication = (id: string) => ({
  id,
  status: 'approved',
  applicant_id: null,
  application_code_id: null,
  form_data: {},
  accounting_status: 'none',
  handling_status: 'unhandled',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  applicant: null,
  application_code: null,
  approval_route: null,
});

describe('getApprovedApplications journal batch fetch guard', () => {
  beforeEach(() => {
    supabaseStub = undefined;
  });

  it('filters invalid UUIDs and chunks source_application_id IN queries', async () => {
    const validIds = Array.from({ length: 220 }, (_, index) =>
      `123e4567-e89b-42d3-a456-${String(index).padStart(12, '0')}`,
    );

    const applications = [
      ...validIds.map(makeApprovedApplication),
      makeApprovedApplication('invalid-id'),
    ];

    const inCalls: Array<{ column: string; values: string[] }> = [];

    const fromMock = vi.fn((table: string) => {
      if (table === 'applications') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn().mockResolvedValue({ data: applications, error: null }),
            })),
          })),
        };
      }

      if (table === 'journal_batches') {
        return {
          select: vi.fn(() => ({
            in: vi.fn((column: string, values: string[]) => {
              inCalls.push({ column, values });
              return Promise.resolve({ data: [], error: null });
            }),
          })),
        };
      }

      if (table === 'journal_entries') {
        return {
          select: vi.fn(() => ({
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    supabaseStub = { from: fromMock };

    const result = await getApprovedApplications();

    expect(result).toHaveLength(applications.length);
    expect(inCalls).toHaveLength(2);
    expect(inCalls[0].column).toBe('source_application_id');
    expect(inCalls[0].values).toHaveLength(200);
    expect(inCalls[1].values).toHaveLength(20);
    expect(inCalls.flatMap(call => call.values)).not.toContain('invalid-id');
  });

  it('continues when part of journal_batches requests fails', async () => {
    const validIds = [
      '123e4567-e89b-42d3-a456-000000000001',
      '123e4567-e89b-42d3-a456-000000000002',
    ];
    const applications = validIds.map(makeApprovedApplication);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const fromMock = vi.fn((table: string) => {
      if (table === 'applications') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn().mockResolvedValue({ data: applications, error: null }),
            })),
          })),
        };
      }

      if (table === 'journal_batches') {
        return {
          select: vi.fn(() => ({
            in: vi.fn().mockResolvedValue({
              data: [{ id: 'batch-2', source_application_id: validIds[1], status: 'draft' }],
              error: { message: 'Bad Request' },
            }),
          })),
        };
      }

      if (table === 'journal_entries') {
        return {
          select: vi.fn(() => ({
            in: vi.fn().mockResolvedValue({
              data: [{ id: 'entry-2', batch_id: 'batch-2', entry_date: '2026-01-05', description: 'ok', created_at: '2026-01-05T00:00:00Z' }],
              error: null,
            }),
          })),
        };
      }

      if (table === 'v_journal_lines') {
        return {
          select: vi.fn(() => ({
            in: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          })),
        };
      }

      if (table === 'chart_of_accounts') {
        return {
          select: vi.fn(() => ({
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    supabaseStub = { from: fromMock };

    const result = await getApprovedApplications();

    expect(result).toHaveLength(2);
    expect(result.find(app => app.id === validIds[1])?.journalEntry?.id).toBe('entry-2');
    expect(warnSpy).toHaveBeenCalledWith(
      'Failed to fetch part of journal batches for approved applications:',
      expect.objectContaining({ message: 'Bad Request' }),
    );

    warnSpy.mockRestore();
  });
});
