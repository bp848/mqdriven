import { BusinessCardContact, Customer } from '../types';

export const mapExtractedDetailsToCustomer = (extractedData: BusinessCardContact): Partial<Customer> => ({
    customer_name: extractedData.companyName || '',
    representative_name: extractedData.personName || extractedData.name || extractedData.contactPerson || '',
    department: extractedData.department || '',
    position: extractedData.title || extractedData.position || '',
    address_1: extractedData.address || '',
    phone_number: extractedData.phoneNumber || extractedData.phone || extractedData.tel || '',
    fax: extractedData.faxNumber || extractedData.fax || '',
    mobile_number: extractedData.mobileNumber || extractedData.mobile || '',
    email: extractedData.email || '',
    website_url: extractedData.websiteUrl || extractedData.website || extractedData.url || '',
    zip_code: extractedData.postalCode || extractedData.zipCode || '',
    received_by_employee_code: extractedData.recipientEmployeeCode || '',
    note: extractedData.notes || extractedData.note || '',
});

export const buildCustomerInsertPayload = (data: Partial<Customer>, createdAt: string): Partial<Customer> => {
    const noteLines = [];
    if (data.department) noteLines.push(`部署: ${data.department}`);
    if (data.note) noteLines.push(`備考: ${data.note}`);
    const note = noteLines.length ? noteLines.join('\n') : undefined;

    return {
        customer_name: data.customer_name,
        representative_name: data.representative_name,
        representative_title: data.position || data.representative_title,
        phone_number: data.phone_number,
        mobile_number: data.mobile_number,
        fax: data.fax,
        address_1: data.address_1,
        website_url: data.website_url,
        customer_contact_info: data.email,
        zip_code: data.zip_code,
        received_by_employee_code: data.received_by_employee_code,
        note,
        created_at: createdAt,
    };
};
