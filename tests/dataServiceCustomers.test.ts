import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addCustomer } from '../services/dataService';

let supabaseStub: any;

vi.mock('../services/supabaseClient', () => ({
  getSupabase: () => supabaseStub,
  getSupabaseFunctionHeaders: vi.fn(),
}));

const enrichCustomerData = vi.fn();

vi.mock('../services/geminiService', () => ({
  enrichCustomerData: (...args: unknown[]) => enrichCustomerData(...args),
}));

describe('addCustomer grounding', () => {
  beforeEach(() => {
    supabaseStub = undefined;
    enrichCustomerData.mockReset();
  });

  it('fills empty fields using grounded data before insert', async () => {
    enrichCustomerData.mockResolvedValue({
      websiteUrl: 'https://example.com',
      address1: 'Tokyo',
      phoneNumber: '03-0000-0000',
      representative: '山田太郎',
    });

    const singleMock = vi.fn().mockResolvedValue({
      data: { id: 'cust-1', customer_name: 'Test Corp' },
      error: null,
    });
    const selectMock = vi.fn().mockReturnValue({ single: singleMock });
    const insertMock = vi.fn().mockReturnValue({ select: selectMock });
    const fromMock = vi.fn().mockReturnValue({ insert: insertMock });
    supabaseStub = { from: fromMock };

    await addCustomer({
      customerName: 'Test Corp',
      address1: '',
      phoneNumber: undefined,
    });

    expect(enrichCustomerData).toHaveBeenCalledWith('Test Corp');
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        customer_name: 'Test Corp',
        address_1: 'Tokyo',
        phone_number: '03-0000-0000',
        representative_name: '山田太郎',
        website_url: 'https://example.com',
      })
    );
  });

  it('skips grounding when no empty fields are present', async () => {
    enrichCustomerData.mockResolvedValue({
      address1: 'Should Not Apply',
    });

    const singleMock = vi.fn().mockResolvedValue({
      data: { id: 'cust-2', customer_name: 'Filled Corp' },
      error: null,
    });
    const selectMock = vi.fn().mockReturnValue({ single: singleMock });
    const insertMock = vi.fn().mockReturnValue({ select: selectMock });
    const fromMock = vi.fn().mockReturnValue({ insert: insertMock });
    supabaseStub = { from: fromMock };

    await addCustomer({
      customerName: 'Filled Corp',
      address1: 'Osaka',
      phoneNumber: '06-0000-0000',
      representative: '佐藤花子',
      websiteUrl: 'https://filled.example.com',
      companyContent: '製造業',
      annualSales: 120000000,
      employeesCount: 42,
    });

    expect(enrichCustomerData).not.toHaveBeenCalled();
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        address_1: 'Osaka',
        phone_number: '06-0000-0000',
        representative_name: '佐藤花子',
        website_url: 'https://filled.example.com',
      })
    );
  });
});
