import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BusinessCardOCR from './BusinessCardOCR';
import * as geminiService from '../services/geminiService';
import * as supabaseClient from '../services/supabaseClient';

vi.mock('../services/geminiService', () => ({
  extractBusinessCardDetails: vi.fn(),
}));

vi.mock('../services/supabaseClient', () => ({
  getSupabase: vi.fn(),
}));

class MockFileReader {
  public result: string | null = null;
  public onload: (() => void) | null = null;
  public onerror: (() => void) | null = null;

  readAsDataURL() {
    this.result = 'data:application/pdf;base64,ZmFrZQ==';
    if (this.onload) this.onload();
  }
}

describe('BusinessCardOCR', () => {
  const addToast = vi.fn();
  const requestConfirmation = vi.fn();
  const onCustomerAdded = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    global.FileReader = MockFileReader as unknown as typeof FileReader;
    global.URL.createObjectURL = vi.fn(() => 'blob:preview-url');
    global.URL.revokeObjectURL = vi.fn();

    (geminiService.extractBusinessCardDetails as vi.Mock).mockResolvedValue({
      companyName: 'Example Inc.',
      personName: 'Taro Yamada',
      email: 'taro@example.com',
      phoneNumber: '090-1111-2222',
    });

    (supabaseClient.getSupabase as vi.Mock).mockReturnValue({
      from: () => ({
        insert: () => ({
          select: () => ({
            single: vi.fn().mockResolvedValue({ data: { id: 'cust-1' }, error: null }),
          }),
        }),
      }),
    });
  });

  it('removes a card after approving and saving to customers', async () => {
    const { container } = render(
      <BusinessCardOCR
        addToast={addToast}
        requestConfirmation={requestConfirmation}
        isAIOff={false}
        onCustomerAdded={onCustomerAdded}
      />
    );

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['dummy'], 'card.pdf', { type: 'application/pdf' });
    await userEvent.upload(input, file);

    await waitFor(() => {
      expect(geminiService.extractBusinessCardDetails).toHaveBeenCalledTimes(1);
    });

    const approveButton = await screen.findByRole('button', { name: '顧客として登録' });
    await userEvent.click(approveButton);

    await waitFor(() => {
      expect(screen.queryByText('card.pdf')).not.toBeInTheDocument();
    });

    expect(onCustomerAdded).toHaveBeenCalledWith(expect.objectContaining({ id: 'cust-1' }));
  });

  it('registers selected cards in bulk', async () => {
    const { container } = render(
      <BusinessCardOCR
        addToast={addToast}
        requestConfirmation={requestConfirmation}
        isAIOff={false}
        onCustomerAdded={onCustomerAdded}
      />
    );

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['dummy'], 'bulk-card.pdf', { type: 'application/pdf' });
    await userEvent.upload(input, file);

    await waitFor(() => {
      expect(geminiService.extractBusinessCardDetails).toHaveBeenCalledTimes(1);
    });

    const checkbox = await screen.findByRole('checkbox', { name: '登録対象に追加' });
    await userEvent.click(checkbox);

    const bulkButton = await screen.findByRole('button', { name: /選択した名刺を登録/ });
    await userEvent.click(bulkButton);

    await waitFor(() => {
      expect(screen.queryByText('bulk-card.pdf')).not.toBeInTheDocument();
    });
  });

  it('selects all pending cards when "全て選択" is clicked', async () => {
    const { container } = render(
      <BusinessCardOCR
        addToast={addToast}
        requestConfirmation={requestConfirmation}
        isAIOff={false}
        onCustomerAdded={onCustomerAdded}
      />
    );

    // Upload multiple files to create multiple pending cards
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file1 = new File(['dummy1'], 'card1.pdf', { type: 'application/pdf' });
    const file2 = new File(['dummy2'], 'card2.pdf', { type: 'application/pdf' });
    await userEvent.upload(input, [file1, file2]);

    await waitFor(() => {
      expect(geminiService.extractBusinessCardDetails).toHaveBeenCalledTimes(2);
    });

    // Initially no cards should be selected
    const checkboxes = screen.getAllByRole('checkbox', { name: '登録対象に追加' });
    expect(checkboxes).toHaveLength(2);
    checkboxes.forEach(checkbox => {
      expect(checkbox).not.toBeChecked();
    });

    // Click "全て選択" button
    const selectAllButton = await screen.findByRole('button', { name: '全て選択' });
    await userEvent.click(selectAllButton);

    // All pending cards should now be selected
    checkboxes.forEach(checkbox => {
      expect(checkbox).toBeChecked();
    });

    // Bulk registration button should show count of selected cards
    const bulkButton = await screen.findByRole('button', { name: /選択した名刺を登録 \(2\)/ });
    expect(bulkButton).toBeInTheDocument();
  });

  it('deselects all cards when "選択解除" is clicked', async () => {
    const { container } = render(
      <BusinessCardOCR
        addToast={addToast}
        requestConfirmation={requestConfirmation}
        isAIOff={false}
        onCustomerAdded={onCustomerAdded}
      />
    );

    // Upload a file and select it manually first
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['dummy'], 'card.pdf', { type: 'application/pdf' });
    await userEvent.upload(input, file);

    await waitFor(() => {
      expect(geminiService.extractBusinessCardDetails).toHaveBeenCalledTimes(1);
    });

    // Select the card manually
    const checkbox = await screen.findByRole('checkbox', { name: '登録対象に追加' });
    await userEvent.click(checkbox);
    expect(checkbox).toBeChecked();

    // Click "選択解除" button
    const deselectButton = await screen.findByRole('button', { name: '選択解除' });
    await userEvent.click(deselectButton);

    // Card should be deselected
    expect(checkbox).not.toBeChecked();

    // Bulk registration button should be disabled and show count of 0
    const bulkButton = await screen.findByRole('button', { name: /選択した名刺を登録 \(0\)/ });
    expect(bulkButton).toBeDisabled();
  });
});
