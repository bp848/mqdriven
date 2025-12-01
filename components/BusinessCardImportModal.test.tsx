// components/BusinessCardImportModal.test.tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BusinessCardImportModal from './BusinessCardImportModal';
import * as geminiService from '../services/geminiService';
import * as actionConsoleService from '../services/actionConsoleService';
import { BusinessCardContact } from '../types';

// Mock the geminiService
vi.mock('../services/geminiService', () => ({
  extractBusinessCardDetails: vi.fn(),
}));

vi.mock('../services/actionConsoleService', () => ({
  logActionEvent: vi.fn(),
  buildActionActorInfo: () => ({ actor: 'テストユーザー', actorDepartment: 'QA' }),
}));

const mockOcrResult: BusinessCardContact = {
  companyName: 'Test Corp',
  personName: 'John Doe',
  email: 'john.doe@test.com',
  phoneNumber: '123-456-7890',
};

describe('BusinessCardImportModal', () => {
  const onRegister = vi.fn();
  const onClose = vi.fn();
  const addToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (isAIOff = false) => {
    return render(
      <BusinessCardImportModal
        isOpen={true}
        onClose={onClose}
        onRegister={onRegister}
        addToast={addToast}
        isAIOff={isAIOff}
        currentUser={null}
      />
    );
  };

  it('renders the modal when open', () => {
    renderComponent();
    expect(screen.getByText('名刺で顧客登録')).toBeInTheDocument();
  });

  it('handles successful OCR process', async () => {
    (geminiService.extractBusinessCardDetails as vi.Mock).mockResolvedValue(mockOcrResult);

    renderComponent();

    const file = new File(['(⌐□_□)'], 'test.png', { type: 'image/png' });
    const input = screen.getByText('ファイルを選択').previousElementSibling as HTMLInputElement;

    await userEvent.upload(input, file);

    await waitFor(() => {
      expect(geminiService.extractBusinessCardDetails).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test Corp')).toBeInTheDocument();
      expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
      expect(screen.getByDisplayValue('john.doe@test.com')).toBeInTheDocument();
    });

    const registerButton = screen.getByText('承認して登録');
    expect(registerButton).not.toBeDisabled();
    fireEvent.click(registerButton);

    await waitFor(() => {
        expect(onRegister).toHaveBeenCalledWith([
            expect.objectContaining({
                customerName: 'Test Corp',
                representative: 'John Doe',
                customerContactInfo: 'john.doe@test.com',
            })
        ]);
    });
  });

  it('handles failed OCR process', async () => {
    const errorMessage = 'OCR解析に失敗しました';
    (geminiService.extractBusinessCardDetails as vi.Mock).mockRejectedValue(new Error(errorMessage));

    renderComponent();

    const file = new File(['(⌐□_□)'], 'test.png', { type: 'image/png' });
    const input = screen.getByText('ファイルを選択').previousElementSibling as HTMLInputElement;

    await userEvent.upload(input, file);

    await waitFor(() => {
      expect(geminiService.extractBusinessCardDetails).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByText(errorMessage, { exact: false })).toBeInTheDocument();
      expect(screen.getByText('エラー')).toBeInTheDocument();
    });

    // Register button should be disabled as there are no ready drafts
    const registerButton = screen.getByText('承認して登録');
    expect(registerButton).toBeDisabled();
  });

  it('disables OCR functionality when AI is off', async () => {
    renderComponent(true); // isAIOff = true

    const file = new File(['(⌐□_□)'], 'test.png', { type: 'image/png' });
    const input = screen.getByText('ファイルを選択').previousElementSibling as HTMLInputElement;

    await userEvent.upload(input, file);
    
    // Using setTimeout to wait for potential async operations, though none should happen
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(geminiService.extractBusinessCardDetails).not.toHaveBeenCalled();
    expect(addToast).toHaveBeenCalledWith('AI機能が無効のため、名刺OCRを利用できません。', 'error');
  });
});
