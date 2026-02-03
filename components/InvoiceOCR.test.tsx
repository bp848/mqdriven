import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import InvoiceOCR from './InvoiceOCR';
import { InboxItemStatus } from '../types';

vi.mock('../services/dataService', () => ({
  getInboxItems: vi.fn(),
  updateInboxItem: vi.fn(),
  deleteInboxItem: vi.fn(),
  uploadFile: vi.fn(),
  addInboxItem: vi.fn(),
}));

vi.mock('../services/geminiService', () => ({
  extractInvoiceDetails: vi.fn(),
}));

vi.mock('../services/googleDriveService', () => ({
  googleDriveService: {
    listFiles: vi.fn(),
    downloadFile: vi.fn(),
  },
}));

describe('InvoiceOCR', () => {
  const addToast = vi.fn();
  const onSaveExpenses = vi.fn();
  const requestConfirmation = vi.fn();

  beforeEach(async () => {
    vi.clearAllMocks();
    const dataService = await import('../services/dataService');
    const pdfUrl = 'data:application/pdf;base64,ZmFrZQ==';
    (dataService.getInboxItems as vi.Mock).mockResolvedValue([
      {
        id: 'inbox-1',
        fileUrl: pdfUrl,
        fileName: 'invoice.pdf',
        filePath: 'public/invoice.pdf',
        mimeType: 'application/pdf',
        status: InboxItemStatus.PendingReview,
        extractedData: {
          vendorName: 'Sample Vendor',
          invoiceDate: '2024-01-01',
          totalAmount: 1000,
          description: 'Test invoice',
          costType: 'V',
        },
        errorMessage: null,
        createdAt: '2024-01-01',
      },
    ]);
    (dataService.updateInboxItem as vi.Mock).mockResolvedValue({
      id: 'inbox-1',
      fileUrl: pdfUrl,
      fileName: 'invoice.pdf',
      filePath: 'public/invoice.pdf',
      mimeType: 'application/pdf',
      status: InboxItemStatus.Approved,
      extractedData: {
        vendorName: 'Sample Vendor',
        invoiceDate: '2024-01-01',
        totalAmount: 1000,
        description: 'Test invoice',
        costType: 'V',
      },
      errorMessage: null,
      createdAt: '2024-01-01',
    });
  });

  it('removes an item after approval', async () => {
    render(
      <InvoiceOCR
        onSaveExpenses={onSaveExpenses}
        addToast={addToast}
        requestConfirmation={requestConfirmation}
        isAIOff={false}
      />
    );

    const approveButton = await screen.findByRole('button', { name: '承認して計上' });
    await userEvent.click(approveButton);

    await waitFor(() => {
      expect(onSaveExpenses).toHaveBeenCalled();
      expect(screen.queryByText('invoice.pdf')).not.toBeInTheDocument();
    });
  });
});
