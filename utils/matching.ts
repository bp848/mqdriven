import { Customer, PaymentRecipient } from '../types';

export const normalizeText = (value?: string | null): string => (value ?? '').replace(/\s+/g, '').toLowerCase();

const includesMatch = (needle: string, haystack: string): boolean => {
    if (!needle || !haystack) return false;
    return haystack.includes(needle) || needle.includes(haystack);
};

export const findMatchingPaymentRecipientId = (
    supplierName: string | undefined,
    recipients: PaymentRecipient[],
): string => {
    const normalizedSupplier = normalizeText(supplierName);
    if (!normalizedSupplier) {
        return '';
    }

    const exact = recipients.find(rec =>
        normalizedSupplier === normalizeText(rec.companyName) ||
        normalizedSupplier === normalizeText(rec.recipientName)
    );
    if (exact) {
        return exact.id;
    }

    const partial = recipients.find(rec => {
        const company = normalizeText(rec.companyName);
        const recipient = normalizeText(rec.recipientName);
        return includesMatch(normalizedSupplier, company) || includesMatch(normalizedSupplier, recipient);
    });
    return partial?.id ?? '';
};

export const findMatchingCustomerId = (
    customerName: string | undefined,
    customers: Customer[],
): string => {
    const normalizedCustomer = normalizeText(customerName);
    if (!normalizedCustomer) {
        return '';
    }

    const exact = customers.find(customer => normalizedCustomer === normalizeText(customer.customerName));
    if (exact) {
        return exact.id;
    }

    const partial = customers.find(customer => includesMatch(normalizedCustomer, normalizeText(customer.customerName)));
    return partial?.id ?? '';
};
