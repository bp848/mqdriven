import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import JournalReviewPage from './JournalReviewPage';
import { AccountingStatus, ApplicationStatus } from '../../types';

vi.mock('../../services/dataService', () => ({
  getApplications: vi.fn(),
  getJournalEntriesByStatus: vi.fn(),
  updateJournalEntryStatus: vi.fn(),
  generateJournalLinesFromApplication: vi.fn(),
}));

describe('JournalReviewPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    window.alert = vi.fn();
    const dataService = await import('../../services/dataService');
    (dataService.getApplications as vi.Mock).mockResolvedValue([
      {
        id: 'app-1',
        status: ApplicationStatus.APPROVED,
        accounting_status: AccountingStatus.NONE,
        formData: { title: 'テスト申請', totalAmount: 1000 },
        applicant: { name: '申請者' },
        approvedAt: '2024-01-02',
      },
    ]);
    (dataService.getJournalEntriesByStatus as vi.Mock).mockImplementation((status: string) => {
      if (status === 'draft') {
        return Promise.resolve([
          {
            id: 'journal-1',
            reference_id: 'app-1',
            status: 'draft',
            lines: [],
          },
        ]);
      }
      return Promise.resolve([]);
    });
    (dataService.updateJournalEntryStatus as vi.Mock).mockResolvedValue(undefined);
  });

  it('removes the review card after confirming the journal entry', async () => {
    render(<JournalReviewPage currentUser={{ id: 'user-1', name: 'Tester' }} />);

    const confirmButton = await screen.findByRole('button', { name: '仕訳を確定' });
    await userEvent.click(confirmButton);

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: '仕訳を確定' })).not.toBeInTheDocument();
      expect(screen.getByText('アーカイブ済みの仕訳')).toBeInTheDocument();
    });
  });
});
