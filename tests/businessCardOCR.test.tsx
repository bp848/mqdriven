import { describe, expect, it } from 'vitest';
import { buildCustomerInsertPayload, mapExtractedDetailsToCustomer } from '../components/businessCardOcrHelpers';

const sampleExtractedData = {
  companyName: 'テスト株式会社',
  personName: '山田太郎',
  department: '営業部',
  title: '部長',
  address: '東京都千代田区1-2-3',
  phoneNumber: '03-1111-2222',
  faxNumber: '03-1111-3333',
  mobileNumber: '090-1234-5678',
  email: 'taro@example.com',
  websiteUrl: 'https://example.com',
  postalCode: '100-0001',
  recipientEmployeeCode: 'EMP-001',
  notes: '次回訪問予定',
};

describe('BusinessCardOCR helpers', () => {
  it('maps extracted details to customer fields including new inputs', () => {
    const mapped = mapExtractedDetailsToCustomer(sampleExtractedData);

    expect(mapped.customer_name).toBe('テスト株式会社');
    expect(mapped.representative_name).toBe('山田太郎');
    expect(mapped.department).toBe('営業部');
    expect(mapped.position).toBe('部長');
    expect(mapped.address_1).toBe('東京都千代田区1-2-3');
    expect(mapped.phone_number).toBe('03-1111-2222');
    expect(mapped.fax).toBe('03-1111-3333');
    expect(mapped.mobile_number).toBe('090-1234-5678');
    expect(mapped.email).toBe('taro@example.com');
    expect(mapped.website_url).toBe('https://example.com');
    expect(mapped.zip_code).toBe('100-0001');
    expect(mapped.received_by_employee_code).toBe('EMP-001');
    expect(mapped.note).toBe('次回訪問予定');
  });

  it('builds customer insert payload with department and note', () => {
    const createdAt = '2025-01-01T00:00:00.000Z';
    const payload = buildCustomerInsertPayload(
      {
        customer_name: 'テスト株式会社',
        representative_name: '山田太郎',
        department: '営業部',
        position: '部長',
        phone_number: '03-1111-2222',
        mobile_number: '090-1234-5678',
        fax: '03-1111-3333',
        address_1: '東京都千代田区1-2-3',
        website_url: 'https://example.com',
        email: 'taro@example.com',
        zip_code: '100-0001',
        received_by_employee_code: 'EMP-001',
        note: '次回訪問予定',
      },
      createdAt
    );

    expect(payload).toMatchObject({
      customer_name: 'テスト株式会社',
      representative_name: '山田太郎',
      representative_title: '部長',
      phone_number: '03-1111-2222',
      mobile_number: '090-1234-5678',
      fax: '03-1111-3333',
      address_1: '東京都千代田区1-2-3',
      website_url: 'https://example.com',
      customer_contact_info: 'taro@example.com',
      zip_code: '100-0001',
      received_by_employee_code: 'EMP-001',
      created_at: createdAt,
      note: '部署: 営業部\n備考: 次回訪問予定',
    });
  });
});
