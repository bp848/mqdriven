import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { submitApplication, saveApplicationDraft, getApplicationDraft, clearApplicationDraft } from '../../services/dataService';
import { extractInvoiceDetails } from '../../services/geminiService';
import ApprovalRouteSelector from './ApprovalRouteSelector';
import AccountItemSelect from './AccountItemSelect';
import DepartmentSelect from './DepartmentSelect';
import SupplierSearchSelect from './SupplierSearchSelect';
import { Loader, Upload, PlusCircle, Trash2, AlertTriangle, CheckCircle, FileText, RefreshCw, List, KanbanSquare } from '../Icons';
import {
    User,
    InvoiceData,
    Customer,
    AccountItem,
    Job,
    PurchaseOrder,
    Department,
    AllocationDivision,
    JobStatus,
    Toast,
    InvoiceStatus,
    PaymentRecipient,
    BankAccountInfo,
    ApplicationWithDetails,
} from '../../types';
import { findMatchingPaymentRecipientId, findMatchingCustomerId } from '../../utils/matching';

type MQAlertLevel = 'INFO' | 'WARNING' | 'ERROR';

interface MQAlert {
    id: string;
    level: MQAlertLevel;
    message: string;
    lineId?: string;
}

interface ExpenseLine {
    id: string;
    lineDate: string;
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    amountExclTax: number;
    taxRate: number;
    accountItemId: string;
    allocationDivisionId: string;
    customerId: string;
    projectId: string;
    linkedRevenueId: string;
}

interface ExpenseInvoiceDraft {
    id: string;
    supplierName: string;
    paymentRecipientId: string;
    registrationNumber: string;
    invoiceDate: string;
    dueDate: string;
    totalGross: number;
    totalNet: number;
    taxAmount: number;
    status: 'Draft' | 'Pending' | 'Approved' | 'Rejected' | '要修正' | '検証済';
    bankAccount: BankAccountInfo;
    lines: ExpenseLine[];
}

interface ExpenseReimbursementFormProps {
    onSuccess: () => void;
    applicationCodeId: string;
    currentUser: User | null;
    customers: Customer[];
    accountItems: AccountItem[];
    jobs: Job[];
    purchaseOrders: PurchaseOrder[];
    departments: Department[];
    allocationDivisions: AllocationDivision[];
    paymentRecipients: PaymentRecipient[];
    onCreatePaymentRecipient?: (recipient: Partial<PaymentRecipient>) => Promise<PaymentRecipient>;
    isAIOff: boolean;
    isLoading: boolean;
    error: string;
    addToast?: (message: string, type: Toast['type']) => void;
    draftApplication?: ApplicationWithDetails | null;
}

interface ComputedTotals {
    net: number;
    tax: number;
    gross: number;
}



const numberFromInput = (value: string) => {
    if (value === '') return 0;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const generateId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

const createEmptyLine = (): ExpenseLine => ({
    id: generateId('line'),
    lineDate: new Date().toISOString().split('T')[0],
    description: '',
    quantity: 1,
    unit: '式',
    unitPrice: 0,
    amountExclTax: 0,
    taxRate: 10,
    accountItemId: '',
    allocationDivisionId: '',
    customerId: '',
    projectId: '',
    linkedRevenueId: '',
});

const normalizeMatchKey = (value?: string | null) => value?.replace(/\s+/g, '').toLowerCase() ?? '';

const splitAccountComponents = (raw?: string | null) => {
    if (!raw) return { type: undefined, number: undefined };
    const trimmed = raw.trim();
    if (!trimmed) return { type: undefined, number: undefined };
    const parts = trimmed.split(/\s+/);
    if (parts.length === 1) return { type: undefined, number: parts[0] };
    return { type: parts[0], number: parts.slice(1).join(' ') };
};

const isInvoiceRegistrationFormat = (value?: string | null) => {
    if (!value) return false;
    return /^T\d{13}$/.test(value.trim());
};

const blankBankAccount: BankAccountInfo = {
    bankName: '',
    branchName: '',
    accountType: '',
    accountNumber: '',
};

const invoiceStatusOptions = [
    { value: 'Draft', label: 'Draft（編集中）' },
    { value: '要修正', label: '要修正（対応中）' },
    { value: '検証済', label: '検証済（送信準備OK）' },
    { value: 'Pending', label: 'Pending（承認中）' },
    { value: 'Approved', label: 'Approved（承認済）' },
    { value: 'Rejected', label: 'Rejected（差戻し）' },
];

const createEmptyInvoiceDraft = (): ExpenseInvoiceDraft => ({
    id: generateId('invoice'),
    supplierName: '',
    paymentRecipientId: '',
    registrationNumber: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    totalGross: 0,
    totalNet: 0,
    taxAmount: 0,
    status: 'Draft',
    bankAccount: {
        bankName: '',
        branchName: '',
        accountType: '',
        accountNumber: '',
    },
    lines: [createEmptyLine()],
});

const normalizeExpenseLine = (line?: Partial<ExpenseLine>): ExpenseLine => ({
    id: line?.id || generateId('line'),
    lineDate: line?.lineDate || new Date().toISOString().split('T')[0],
    description: line?.description || '',
    quantity: Number(line?.quantity ?? 1) || 1,
    unit: line?.unit || '式',
    unitPrice: Number(line?.unitPrice ?? 0) || 0,
    amountExclTax: Number(line?.amountExclTax ?? 0) || 0,
    taxRate: Number(line?.taxRate ?? 10) || 10,
    accountItemId: line?.accountItemId || '',
    allocationDivisionId: line?.allocationDivisionId || '',
    customerId: line?.customerId || '',
    projectId: line?.projectId || '',
    linkedRevenueId: line?.linkedRevenueId || '',
});

const normalizeExpenseInvoiceDraft = (draft?: Partial<ExpenseInvoiceDraft>): ExpenseInvoiceDraft => ({
    id: draft?.id || generateId('invoice'),
    supplierName: draft?.supplierName || '',
    paymentRecipientId: draft?.paymentRecipientId || '',
    registrationNumber: draft?.registrationNumber || '',
    invoiceDate: draft?.invoiceDate || new Date().toISOString().split('T')[0],
    dueDate: draft?.dueDate || '',
    totalGross: Number(draft?.totalGross ?? 0) || 0,
    totalNet: Number(draft?.totalNet ?? 0) || 0,
    taxAmount: Number(draft?.taxAmount ?? 0) || 0,
    status: (draft?.status as ExpenseInvoiceDraft['status']) || 'Draft',
    bankAccount: {
        bankName: draft?.bankAccount?.bankName || '',
        branchName: draft?.bankAccount?.branchName || '',
        accountType: draft?.bankAccount?.accountType || '',
        accountNumber: draft?.bankAccount?.accountNumber || '',
    },
    lines: (() => {
        const lines = Array.isArray(draft?.lines) ? (draft?.lines as Partial<ExpenseLine>[]) : [];
        return lines.length > 0 ? lines.map(line => normalizeExpenseLine(line)) : [createEmptyLine()];
    })(),
});

const computeLineTotals = (invoice: ExpenseInvoiceDraft): ComputedTotals => {
    const net = invoice.lines.reduce((sum, line) => sum + (Number(line.amountExclTax) || 0), 0);
    const tax = invoice.lines.reduce(
        (sum, line) => sum + (Number(line.amountExclTax) || 0) * ((Number(line.taxRate) || 0) / 100),
        0
    );
    return { net, tax, gross: net + tax };
};

const severityFromAlerts = (alerts: MQAlert[]) => {
    if (alerts.some(alert => alert.level === 'ERROR')) return 'error';
    if (alerts.some(alert => alert.level === 'WARNING')) return 'warn';
    return 'ok';
};

const buildMqAlerts = (
    invoice: ExpenseInvoiceDraft,
    totals: ComputedTotals,
    jobs: Job[],
    purchaseOrders: PurchaseOrder[]
): MQAlert[] => {
    const alerts: MQAlert[] = [];
    const projectTotals: Record<string, number> = {};

    invoice.lines.forEach(line => {
        if (!line.description.trim()) {
            alerts.push({ id: `${line.id}-desc`, level: 'ERROR', message: '品名を入力してください。', lineId: line.id });
        }
        if (!line.projectId && line.customerId) {
            alerts.push({
                id: `${line.id}-project`,
                level: 'WARNING',
                message: '顧客に紐づくプロジェクトを選択してください。',
                lineId: line.id,
            });
        }
        if (!line.amountExclTax || line.amountExclTax <= 0) {
            alerts.push({
                id: `${line.id}-amount`,
                level: 'ERROR',
                message: '金額（税抜）には正の数を入力してください。',
                lineId: line.id,
            });
        }

        if (line.projectId) {
            projectTotals[line.projectId] = (projectTotals[line.projectId] || 0) + (line.amountExclTax || 0);
        }

        const linkedOrder = purchaseOrders.find(po => `order:${po.id}` === line.linkedRevenueId);
        if (linkedOrder && line.amountExclTax > linkedOrder.quantity * linkedOrder.unitPrice) {
            alerts.push({
                id: `${line.id}-po`,
                level: 'WARNING',
                message: 'この経費が対応する発注金額を上回っています。',
                lineId: line.id,
            });
        }
    });

    invoice.lines.forEach(line => {
        if (!line.projectId) return;
        const job = jobs.find(j => j.id === line.projectId);
        if (!job) return;

        if (job.status === JobStatus.Completed) {
            alerts.push({
                id: `${line.id}-job-status`,
                level: 'WARNING',
                message: `プロジェクト「${job.title}」は完了済みです。部門長承認が必要です。`,
                lineId: line.id,
            });
        }
        if (projectTotals[line.projectId] > job.price) {
            alerts.push({
                id: `${line.id}-margin`,
                level: 'ERROR',
                message: `経費累計が案件「${job.title}」の売上を超えています。`,
                lineId: line.id,
            });
        }
        if (!job.invoiceId) {
            alerts.push({
                id: `${line.id}-missing-sales`,
                level: 'INFO',
                message: `案件「${job.title}」に売上請求書が登録されていません（漏れの可能性）。`,
                lineId: line.id,
            });
        }
    });

    if (Math.abs((invoice.totalNet || 0) - totals.net) >= 1 || Math.abs((invoice.totalGross || 0) - totals.gross) >= 1) {
        alerts.push({
            id: `${invoice.id}-total-mismatch`,
            level: 'WARNING',
            message: 'ヘッダー金額と明細合計が一致しません。MQチェックを見直してください。',
        });
    }

    return alerts;
};

const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => (typeof reader.result === 'string' ? resolve(reader.result.split(',')[1]) : reject('Read failed'));
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
};

const statusBadges: Record<string, string> = {
    Draft: 'bg-slate-100 text-slate-700 dark:bg-slate-700/60 dark:text-slate-200',
    '要修正': 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
    検証済: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    Pending: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
    Approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    Rejected: 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
};

const mqLevelStyles: Record<MQAlertLevel, string> = {
    INFO: 'bg-blue-50 text-blue-700 border border-blue-200',
    WARNING: 'bg-amber-50 text-amber-800 border border-amber-200',
    ERROR: 'bg-rose-50 text-rose-800 border border-rose-200',
};

const requiredFieldCardClass =
    'space-y-2 rounded-xl border border-rose-100 bg-rose-50/80 dark:border-rose-500/30 dark:bg-rose-500/10 p-3';
const requiredLabelClass = 'text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2 flex-wrap';
const requiredInputClass =
    'w-full rounded-md border border-rose-300 bg-rose-50/80 px-3 py-2 text-sm text-slate-900 focus:ring-rose-500 focus:border-rose-500 dark:border-rose-500/60 dark:bg-rose-500/10 dark:text-white';

const RequiredBadge: React.FC = () => (
    <span className="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700 dark:bg-rose-500/20 dark:text-rose-200">
        必須
    </span>
);

const severityIcon = (severity: 'ok' | 'warn' | 'error') => {
    if (severity === 'ok') {
        return <CheckCircle className="w-5 h-5 text-emerald-500" aria-hidden />;
    }
    if (severity === 'warn') {
        return <AlertTriangle className="w-5 h-5 text-amber-500" aria-hidden />;
    }
    return <AlertTriangle className="w-5 h-5 text-rose-500" aria-hidden />;
};

const ExpenseReimbursementForm: React.FC<ExpenseReimbursementFormProps> = ({
    onSuccess,
    applicationCodeId,
    currentUser,
    customers,
    accountItems,
    jobs,
    purchaseOrders,
    departments,
    allocationDivisions,
    paymentRecipients,
    onCreatePaymentRecipient,
    isAIOff,
    isLoading,
    error: formLoadError,
    addToast,
    draftApplication,
}) => {
    const [invoiceDrafts, setInvoiceDrafts] = useState<ExpenseInvoiceDraft[]>([createEmptyInvoiceDraft()]);
    const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('');
    const [departmentId, setDepartmentId] = useState<string>('');
    const [approvalRouteId, setApprovalRouteId] = useState<string>('');
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSavingDraft, setIsSavingDraft] = useState(false);
    const [isRestoringDraft, setIsRestoringDraft] = useState(false);
    const [isOcrLoading, setIsOcrLoading] = useState(false);
    const [error, setError] = useState('');
    const [customerSearchTerms, setCustomerSearchTerms] = useState<Record<string, string>>({});
    const [highlightedLineId, setHighlightedLineId] = useState<string>('');
    const [isDraggingFiles, setIsDraggingFiles] = useState(false);
    const [previewFiles, setPreviewFiles] = useState<{ id: string; name: string; url: string; type: string }[]>([]);
    const [selectedPreviewId, setSelectedPreviewId] = useState<string>('');
    const [manualTotalsInvoices, setManualTotalsInvoices] = useState<Record<string, boolean>>({});

    const isDisabled = isSubmitting || isSavingDraft || isLoading || isRestoringDraft || !!formLoadError;

    useEffect(() => {
        if (!selectedInvoiceId && invoiceDrafts.length > 0) {
            setSelectedInvoiceId(invoiceDrafts[0].id);
        }
    }, [invoiceDrafts, selectedInvoiceId]);

    const selectedInvoice = useMemo(
        () => invoiceDrafts.find(inv => inv.id === selectedInvoiceId) || invoiceDrafts[0],
        [invoiceDrafts, selectedInvoiceId]
    );
    const isManualTotals = selectedInvoice ? manualTotalsInvoices[selectedInvoice.id] ?? false : false;
    const paymentRecipientWarning = Boolean(selectedInvoice?.supplierName && !selectedInvoice?.paymentRecipientId);
    const selectedDepartment = useMemo(
        () => departments.find(department => department.id === departmentId),
        [departments, departmentId]
    );





    const updateSelectedInvoice = useCallback(
        (updater: (invoice: ExpenseInvoiceDraft) => ExpenseInvoiceDraft) => {
            setInvoiceDrafts(prev =>
                prev.map(invoice => {
                    if (!selectedInvoice || invoice.id !== selectedInvoice.id) return invoice;
                    return updater(invoice);
                })
            );
        },
        [selectedInvoice]
    );

    const getCustomerForSupplier = useCallback(
        (supplier?: PaymentRecipient | null): Customer | undefined => {
            if (!supplier) return undefined;
            const supplierKeys = [supplier.companyName, supplier.recipientName].map(normalizeMatchKey).filter(Boolean);
            if (!supplierKeys.length) return undefined;
            return customers.find(customer => {
                const customerKeys = [
                    normalizeMatchKey(customer.customerName),
                    normalizeMatchKey(customer.customerNameKana),
                    normalizeMatchKey(customer.name2),
                ].filter(Boolean);
                return customerKeys.some(key => supplierKeys.includes(key));
            });
        },
        [customers]
    );

    const deriveBankAccountInfo = useCallback(
        (current: BankAccountInfo, supplier?: PaymentRecipient | null): BankAccountInfo => {
            if (!supplier) return current;
            const matchedCustomer = getCustomerForSupplier(supplier);
            const supplierAccount = splitAccountComponents(supplier.bankAccountNumber ?? supplier.accountNumber);
            const customerAccount = splitAccountComponents(matchedCustomer?.accountNo);
            return {
                bankName: supplier.bankName ?? matchedCustomer?.bankName ?? current.bankName,
                branchName: supplier.branchName ?? supplier.bankBranch ?? matchedCustomer?.branchName ?? current.branchName,
                accountType:
                    supplier.bankAccountType ??
                    supplierAccount.type ??
                    customerAccount.type ??
                    current.accountType,
                accountNumber:
                    supplier.bankAccountNumber ??
                    supplier.accountNumber ??
                    supplierAccount.number ??
                    customerAccount.number ??
                    current.accountNumber,
            };
        },
        [getCustomerForSupplier]
    );

    const applySupplierDefaults = useCallback(
        (supplier?: PaymentRecipient | null) => {
            if (!supplier) return;
            updateSelectedInvoice(invoice => {
                const derivedRegistration =
                    supplier.invoiceRegistrationNumber ||
                    (isInvoiceRegistrationFormat(supplier.recipientCode) ? supplier.recipientCode : undefined);
                return {
                    ...invoice,
                    supplierName: supplier.companyName || supplier.recipientName || invoice.supplierName,
                    registrationNumber: derivedRegistration || invoice.registrationNumber,
                    bankAccount: deriveBankAccountInfo(invoice.bankAccount, supplier),
                };
            });
        },
        [deriveBankAccountInfo, updateSelectedInvoice]
    );

    const syncSelectedInvoiceTotals = useCallback(() => {
        updateSelectedInvoice(invoice => {
            const totals = computeLineTotals(invoice);
            return {
                ...invoice,
                totalNet: Number(totals.net.toFixed(2)),
                taxAmount: Number(totals.tax.toFixed(2)),
                totalGross: Number(totals.gross.toFixed(2)),
            };
        });
    }, [updateSelectedInvoice]);

    const effectiveCustomers = useMemo(() => {
        if (customers.length) return customers;
        const fallbackName = selectedInvoice?.supplierName || '仮顧客';
        return [
            {
                id: 'fallback-customer',
                customerName: fallbackName,
                createdAt: new Date().toISOString(),
            } as Customer,
        ];
    }, [customers, selectedInvoice?.supplierName]);

    const effectiveJobs = useMemo(() => {
        if (jobs.length) return jobs;
        const fallbackCustomerName = effectiveCustomers[0]?.customerName || '仮顧客';
        return [
            {
                id: 'fallback-job',
                jobNumber: 1,
                clientName: fallbackCustomerName,
                title: `${fallbackCustomerName} 向け仮案件`,
                status: JobStatus.InProgress,
                dueDate: new Date().toISOString().split('T')[0],
                quantity: 1,
                paperType: '',
                finishing: '',
                details: 'Fallback project for expense allocation',
                createdAt: new Date().toISOString(),
                price: 100000,
                variableCost: 50000,
                invoiceStatus: InvoiceStatus.Uninvoiced,
            } as Job,
        ];
    }, [jobs, effectiveCustomers]);

    const invoiceDiagnostics = useMemo(() => {
        return invoiceDrafts.map(invoice => {
            const totals = computeLineTotals(invoice);
            const alerts = buildMqAlerts(invoice, totals, effectiveJobs, purchaseOrders);
            return {
                invoiceId: invoice.id,
                totals,
                alerts,
                severity: severityFromAlerts(alerts),
            };
        });
    }, [invoiceDrafts, effectiveJobs, purchaseOrders]);

    const diagnosticsForSelected = useMemo(() => {
        if (!selectedInvoice) return undefined;
        return invoiceDiagnostics.find(d => d.invoiceId === selectedInvoice.id);
    }, [invoiceDiagnostics, selectedInvoice]);

    useEffect(() => {
        if (!selectedInvoice) return;
        if (manualTotalsInvoices[selectedInvoice.id]) return;
        const totals = computeLineTotals(selectedInvoice);
        const epsilon = 0.01;
        const hasDiff =
            Math.abs((selectedInvoice.totalNet ?? 0) - totals.net) > epsilon ||
            Math.abs((selectedInvoice.taxAmount ?? 0) - totals.tax) > epsilon ||
            Math.abs((selectedInvoice.totalGross ?? 0) - totals.gross) > epsilon;
        if (hasDiff) {
            syncSelectedInvoiceTotals();
        }
    }, [selectedInvoice, manualTotalsInvoices, syncSelectedInvoiceTotals]);

    useEffect(() => {
        if (!highlightedLineId) return;
        const row = document.getElementById(`expense-line-${highlightedLineId}`);
        if (row) {
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [highlightedLineId]);

    const restoreDraftFromPayload = useCallback((draftPayload: any) => {
        if (!draftPayload) return;
        const normalizedDrafts =
            Array.isArray(draftPayload.invoiceDrafts) && draftPayload.invoiceDrafts.length
                ? draftPayload.invoiceDrafts.map((draft: Partial<ExpenseInvoiceDraft>) => normalizeExpenseInvoiceDraft(draft))
                : draftPayload.invoice
                    ? [normalizeExpenseInvoiceDraft(draftPayload.invoice as Partial<ExpenseInvoiceDraft>)]
                    : [createEmptyInvoiceDraft()];

        setInvoiceDrafts(normalizedDrafts);
        const nextSelectedId =
            draftPayload.selectedInvoiceId && normalizedDrafts.some(inv => inv.id === draftPayload.selectedInvoiceId)
                ? draftPayload.selectedInvoiceId
                : normalizedDrafts[0].id;
        setSelectedInvoiceId(nextSelectedId);
        setDepartmentId(draftPayload.departmentId || '');
        setApprovalRouteId(draftPayload.approvalRouteId || '');
        setNotes(draftPayload.notes || '');
        setCustomerSearchTerms({});
        setHighlightedLineId('');
    }, []);

    useEffect(() => {
        if (!currentUser?.id || !applicationCodeId || draftApplication) return;
        let isMounted = true;
        setIsRestoringDraft(true);

        (async () => {
            try {
                const draft = await getApplicationDraft(applicationCodeId, currentUser.id);
                if (!isMounted || !draft?.formData) return;
                restoreDraftFromPayload(draft.formData);
            } catch (err) {
                console.error('Failed to restore draft', err);
            } finally {
                if (isMounted) {
                    setIsRestoringDraft(false);
                }
            }
        })();

        return () => {
            isMounted = false;
        };
    }, [applicationCodeId, currentUser?.id, restoreDraftFromPayload, draftApplication]);

    useEffect(() => {
        if (!draftApplication?.formData || draftApplication.applicationCodeId !== applicationCodeId) return;
        setIsRestoringDraft(true);
        try {
            restoreDraftFromPayload(draftApplication.formData);
        } finally {
            setIsRestoringDraft(false);
        }
    }, [draftApplication, applicationCodeId, restoreDraftFromPayload]);

    useEffect(() => {
        if (!selectedInvoice || selectedInvoice.paymentRecipientId || !selectedInvoice.supplierName || !paymentRecipients.length) return;
        const matchedId = findMatchingPaymentRecipientId(selectedInvoice.supplierName, paymentRecipients);
        if (!matchedId) return;
        updateSelectedInvoice(invoice => ({ ...invoice, paymentRecipientId: matchedId }));
        const matchedSupplier = paymentRecipients.find(recipient => recipient.id === matchedId);
        if (matchedSupplier) {
            applySupplierDefaults(matchedSupplier);
        }
    }, [selectedInvoice, paymentRecipients, updateSelectedInvoice, applySupplierDefaults]);

    const handleInvoiceFieldChange = (field: keyof ExpenseInvoiceDraft, value: string | number) => {
        updateSelectedInvoice(invoice => ({ ...invoice, [field]: value }));
    };

    const handleTotalsModeChange = (manual: boolean) => {
        if (!selectedInvoice) return;
        setManualTotalsInvoices(prev => {
            const previous = prev[selectedInvoice.id] ?? false;
            if (previous === manual) return prev;
            return { ...prev, [selectedInvoice.id]: manual };
        });
        if (!manual) {
            syncSelectedInvoiceTotals();
        }
    };

    const handleSupplierSelectChange = (recipientId: string, supplier?: PaymentRecipient | null) => {
        handleInvoiceFieldChange('paymentRecipientId', recipientId);
        if (supplier) {
            applySupplierDefaults(supplier);
        } else if (!recipientId) {
            updateSelectedInvoice(invoice => ({
                ...invoice,
                supplierName: '',
                registrationNumber: '',
                bankAccount: { ...blankBankAccount },
            }));
        }
    };

    const handleBankAccountChange = (field: keyof BankAccountInfo, value: string) => {
        updateSelectedInvoice(invoice => ({
            ...invoice,
            bankAccount: { ...invoice.bankAccount, [field]: value },
        }));
    };

    const handleLineChange = (lineId: string, field: keyof ExpenseLine, value: string | number) => {
        updateSelectedInvoice(invoice => {
            const nextLines = invoice.lines.map(line => {
                if (line.id !== lineId) return line;
                const updatedLine: ExpenseLine = { ...line, [field]: value };

                if (field === 'quantity' || field === 'unitPrice') {
                    const quantity = Number(field === 'quantity' ? value : updatedLine.quantity) || 0;
                    const unitPrice = Number(field === 'unitPrice' ? value : updatedLine.unitPrice) || 0;
                    updatedLine.amountExclTax = Number((quantity * unitPrice).toFixed(2));
                }

                if (field === 'amountExclTax') {
                    updatedLine.amountExclTax = Number(value) || 0;
                }

                if (field === 'customerId' && value === '') {
                    updatedLine.projectId = '';
                    updatedLine.linkedRevenueId = '';
                }

                return updatedLine;
            });

            return { ...invoice, lines: nextLines };
        });
    };

    const addLine = () => {
        updateSelectedInvoice(invoice => ({ ...invoice, lines: [...invoice.lines, createEmptyLine()] }));
    };

    const removeLine = (lineId: string) => {
        updateSelectedInvoice(invoice => {
            const remaining = invoice.lines.filter(line => line.id !== lineId);
            return { ...invoice, lines: remaining.length > 0 ? remaining : [createEmptyLine()] };
        });
    };

    const handleCustomerFilterChange = (lineId: string, value: string) => {
        setCustomerSearchTerms(prev => ({ ...prev, [lineId]: value }));
    };

    const getAccountItemSuggestions = (description: string) => {
        if (!description.trim()) return [];
        const keyword = description.toLowerCase();
        return accountItems
            .filter(item => item.name.toLowerCase().includes(keyword) || item.code.toLowerCase().includes(keyword))
            .slice(0, 3);
    };

    const handleJumpToLine = (lineId?: string) => {
        if (!lineId) return;
        setHighlightedLineId(lineId);
        setTimeout(() => {
            const firstInput = document.querySelector<HTMLInputElement>(`#description-${lineId}`);
            firstInput?.focus();
        }, 120);
    };

    const ingestFiles = async (fileList: FileList | File[]) => {
        if (!fileList || fileList.length === 0) return;
        if (isAIOff) {
            setError('AI機能が停止しているため、OCR取り込みは利用できません。');
            return;
        }

        setIsOcrLoading(true);
        setError('');
        const created: ExpenseInvoiceDraft[] = [];
        const newPreviews: { id: string; name: string; url: string; type: string }[] = [];

        try {
            for (const file of Array.from(fileList)) {
                const base64 = await readFileAsBase64(file);
                const ocrData: InvoiceData = await extractInvoiceDetails(base64, file.type);
                const invoice = createEmptyInvoiceDraft();
                const expenseDraft = ocrData.expenseDraft;
                invoice.supplierName = expenseDraft?.supplierName || ocrData.vendorName || invoice.supplierName;
                invoice.registrationNumber = expenseDraft?.registrationNumber || ocrData.registrationNumber || invoice.registrationNumber;
                invoice.invoiceDate = expenseDraft?.invoiceDate || ocrData.invoiceDate || invoice.invoiceDate;
                invoice.dueDate = expenseDraft?.dueDate || ocrData.dueDate || invoice.dueDate;
                invoice.totalGross = Number(expenseDraft?.totalGross ?? ocrData.totalAmount ?? invoice.totalGross);
                invoice.totalNet = Number(expenseDraft?.totalNet ?? ocrData.subtotalAmount ?? invoice.totalNet);
                invoice.taxAmount = Number(expenseDraft?.taxAmount ?? ocrData.taxAmount ?? invoice.taxAmount);

                if (!invoice.totalNet && invoice.totalGross) {
                    const estimatedNet = Number((invoice.totalGross / 1.1).toFixed(2));
                    invoice.totalNet = estimatedNet;
                    if (!invoice.taxAmount) {
                        invoice.taxAmount = Number((invoice.totalGross - estimatedNet).toFixed(2));
                    }
                } else if (!invoice.totalGross && invoice.totalNet) {
                    invoice.totalGross = Number((invoice.totalNet * 1.1).toFixed(2));
                    if (!invoice.taxAmount) {
                        invoice.taxAmount = Number((invoice.totalGross - invoice.totalNet).toFixed(2));
                    }
                }

                const bankSource = expenseDraft?.bankAccount || ocrData.bankAccount;
                if (bankSource) {
                    invoice.bankAccount = {
                        bankName: bankSource.bankName ?? invoice.bankAccount.bankName,
                        branchName: bankSource.branchName ?? invoice.bankAccount.branchName,
                        accountType: bankSource.accountType ?? invoice.bankAccount.accountType,
                        accountNumber: bankSource.accountNumber ?? invoice.bankAccount.accountNumber,
                    };
                }

                const availablePaymentRecipientId =
                    expenseDraft?.paymentRecipientId ||
                    ocrData.matchedPaymentRecipientId ||
                    findMatchingPaymentRecipientId(invoice.supplierName, paymentRecipients);
                let matchedRecipient: PaymentRecipient | undefined;
                if (availablePaymentRecipientId) {
                    invoice.paymentRecipientId = availablePaymentRecipientId;
                    matchedRecipient = paymentRecipients.find(rec => rec.id === availablePaymentRecipientId);
                }
                if (matchedRecipient) {
                    invoice.supplierName =
                        invoice.supplierName ||
                        matchedRecipient.companyName ||
                        matchedRecipient.recipientName ||
                        invoice.supplierName;
                    if (!invoice.registrationNumber) {
                        const derivedRegistration =
                            matchedRecipient.invoiceRegistrationNumber ||
                            (isInvoiceRegistrationFormat(matchedRecipient.recipientCode) ? matchedRecipient.recipientCode : undefined);
                        if (derivedRegistration) {
                            invoice.registrationNumber = derivedRegistration;
                        }
                    }
                    invoice.bankAccount = deriveBankAccountInfo(invoice.bankAccount, matchedRecipient);
                }

                const resolveCustomerId = (name?: string) => findMatchingCustomerId(name || ocrData.relatedCustomer, customers);
                const resolveProjectId = (name?: string) => {
                    const normalized = normalizeMatchKey(name);
                    if (!normalized) return '';
                    const matchedJob = effectiveJobs.find(job => normalizeMatchKey(job.title) === normalized);
                    return matchedJob?.id || '';
                };

                const ocrLines = expenseDraft?.lines || ocrData.lineItems;
                if (ocrLines && ocrLines.length) {
                    invoice.lines = ocrLines.map(line => {
                        const quantity = line.quantity !== undefined ? Number(line.quantity) : undefined;
                        const unitPrice = line.unitPrice !== undefined ? Number(line.unitPrice) : undefined;
                        const normalized = normalizeExpenseLine({
                            description: line.description ? `【OCR】${line.description}` : '',
                            lineDate: line.lineDate || invoice.invoiceDate,
                            quantity,
                            unit: line.unit,
                            unitPrice,
                            amountExclTax:
                                line.amountExclTax !== undefined
                                    ? Number(line.amountExclTax)
                                    : unitPrice !== undefined && quantity !== undefined
                                        ? unitPrice * quantity
                                        : undefined,
                            taxRate: line.taxRate,
                        });
                        const matchedCustomerId = resolveCustomerId(line.customerName);
                        if (matchedCustomerId) {
                            normalized.customerId = matchedCustomerId;
                        }
                        const matchedProjectId = resolveProjectId(line.projectName);
                        if (matchedProjectId) {
                            normalized.projectId = matchedProjectId;
                            if (!normalized.customerId) {
                                const matchedJob = effectiveJobs.find(job => job.id === matchedProjectId);
                                if (matchedJob?.customerId) {
                                    normalized.customerId = matchedJob.customerId;
                                }
                            }
                        }
                        return normalized;
                    });
                } else {
                    const detailAmountSource = invoice.totalNet || invoice.totalGross;
                    const detailAmount = Number(detailAmountSource.toFixed(2));
                    const fallbackCustomerId = resolveCustomerId();
                    invoice.lines = [
                        {
                            ...createEmptyLine(),
                            description: ocrData.description ? `【OCR】${ocrData.description}` : '',
                            amountExclTax: detailAmount,
                            customerId: fallbackCustomerId,
                        },
                    ];
                }
                created.push(invoice);

                const previewId = generateId('preview');
                const objectUrl = URL.createObjectURL(file);
                newPreviews.push({ id: previewId, name: file.name, url: objectUrl, type: file.type || '' });
            }
        } catch (err: any) {
            setError(err.message || 'OCR処理でエラーが発生しました。');
        } finally {
            setIsOcrLoading(false);
        }

        if (created.length > 0) {
            setInvoiceDrafts(prev => [...created, ...prev]);
            setSelectedInvoiceId(created[0].id);
            addToast?.(`${created.length}件の請求書をDraftに取り込みました。`, 'info');
        }

        if (newPreviews.length > 0) {
            setPreviewFiles(prev => [...newPreviews, ...prev]);
            setSelectedPreviewId(newPreviews[0].id);
        }
    };

    const handleFileInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        await ingestFiles(files ?? []);
        event.target.value = '';
    };

    const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setIsDraggingFiles(false);
        await ingestFiles(event.dataTransfer.files);
    };

    const buildApplicationPayload = () => ({
        applicationCodeId,
        formData: {
            departmentId,
            approvalRouteId,
            invoiceDrafts,
            selectedInvoiceId,
            invoice: selectedInvoice,
            mqAlerts: diagnosticsForSelected?.alerts ?? [],
            computedTotals: diagnosticsForSelected?.totals,
            notes,
        },
        approvalRouteId,
    });

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError('');

        if (!currentUser) return setError('ユーザー情報が見つかりません。');
        if (!selectedInvoice) return setError('請求書を追加してください。');
        if (!departmentId) return setError('部門を選択してください。');
        if (!approvalRouteId) return setError('承認ルートを選択してください。');
        if (!selectedInvoice.supplierName.trim()) return setError('サプライヤー名を入力してください。');
        if (!selectedInvoice.paymentRecipientId) return setError('支払先を選択してください。');
        if (selectedInvoice.lines.length === 0) return setError('少なくとも1件の明細を入力してください。');
        const invalidLine = selectedInvoice.lines.find(line => !line.description || !line.amountExclTax);
        if (invalidLine) {
            const index = selectedInvoice.lines.findIndex(line => line.id === invalidLine.id);
            setHighlightedLineId(invalidLine.id);
            return setError(`第${index + 1}行目の「品名」と「金額（税抜）」を確認してください。`);
        }

        setIsSubmitting(true);
        try {
            await submitApplication(buildApplicationPayload(), currentUser.id);
            try {
                await clearApplicationDraft(applicationCodeId, currentUser.id);
            } catch (cleanupError) {
                console.warn('Failed to clear expense draft after submission', cleanupError);
            }
            addToast?.('経費精算を送信しました。', 'success');
            onSuccess();
        } catch (err: any) {
            setError(err.message || '申請の提出に失敗しました。');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSaveDraft = async () => {
        setError('');
        if (!currentUser) return setError('ユーザー情報が見つかりません。');
        if (!selectedInvoice) return setError('請求書を追加してください。');

        setIsSavingDraft(true);
        try {
            await saveApplicationDraft(buildApplicationPayload(), currentUser.id);
            addToast?.('下書きを保存しました。', 'success');
        } catch (err: any) {
            setError(err.message || '下書きの保存に失敗しました。');
        } finally {
            setIsSavingDraft(false);
        }
    };

    const handleNextInvoice = () => {
        if (!selectedInvoice) return;
        const index = invoiceDrafts.findIndex(inv => inv.id === selectedInvoice.id);
        if (index === -1) return;
        const nextIndex = (index + 1) % invoiceDrafts.length;
        setSelectedInvoiceId(invoiceDrafts[nextIndex].id);
    };

    const addNewInvoice = () => {
        const draft = createEmptyInvoiceDraft();
        setInvoiceDrafts(prev => [...prev, draft]);
        setSelectedInvoiceId(draft.id);
    };

    const totalsLabel = diagnosticsForSelected?.totals || { net: 0, tax: 0, gross: 0 };
    const selectedPreview = useMemo(
        () => previewFiles.find(f => f.id === selectedPreviewId) || previewFiles[0],
        [previewFiles, selectedPreviewId]
    );

    if (!selectedInvoice) {
        return (
            <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm">
                <p className="text-center text-slate-500">請求書を追加して開始してください。</p>
                <button
                    type="button"
                    onClick={addNewInvoice}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg"
                >
                    <PlusCircle className="w-4 h-4" />
                    新しい請求書を作成
                </button>
            </div>
        );
    }

    return (
        <div className="relative">
            {(isLoading || formLoadError || isRestoringDraft) && (
                <div className="absolute inset-0 bg-white/60 dark:bg-slate-900/70 backdrop-blur-sm z-10 flex items-center justify-center rounded-2xl">
                    {(isLoading || isRestoringDraft) && <Loader className="w-12 h-12 animate-spin text-blue-500" />}
                </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-6">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white text-center">経費精算フォーム</h2>

                {formLoadError && (
                    <div className="bg-rose-50 border-l-4 border-rose-400 text-rose-700 p-4 rounded-md" role="alert">
                        <p className="font-bold">フォーム読み込みエラー</p>
                        <p>{formLoadError}</p>
                    </div>
                )}

                <div className="grid gap-6 lg:grid-cols-[minmax(320px,_420px)_minmax(0,_1fr)]">
                    <div className="space-y-6 self-start lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:pr-1">
                        <section className="bg-slate-950/70 dark:bg-slate-950/80 rounded-xl p-4 shadow-sm min-h-[360px] flex flex-col">
                            <p className="text-sm font-semibold text-slate-200 mb-2">請求書プレビュー</p>
                            {previewFiles.length === 0 ? (
                                <p className="text-xs text-slate-400">
                                    PDF / 画像をアップロードするとここにプレビューが表示されます。
                                </p>
                            ) : (
                                <div className="flex-1 flex gap-3 overflow-hidden">
                                    <div className="w-32 flex-shrink-0 space-y-2 overflow-y-auto pr-1">
                                        {previewFiles.map(file => (
                                            <button
                                                key={file.id}
                                                type="button"
                                                onClick={() => setSelectedPreviewId(file.id)}
                                                className={`w-full text-left px-2 py-1 rounded-md text-xs border transition-colors ${
                                                    selectedPreview?.id === file.id
                                                        ? 'bg-blue-600 text-white border-blue-400'
                                                        : 'bg-slate-900 text-slate-200 border-slate-700 hover:border-blue-400'
                                                }`}
                                            >
                                                <span className="block truncate" title={file.name}>{file.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex-1 bg-slate-900 border border-slate-700 rounded-lg flex items-center justify-center overflow-hidden">
                                        {selectedPreview ? (
                                            selectedPreview.type.startsWith('image/') ? (
                                                <img
                                                    src={selectedPreview.url}
                                                    alt={selectedPreview.name}
                                                    className="max-h-full max-w-full object-contain"
                                                />
                                            ) : selectedPreview.type === 'application/pdf' ? (
                                                <iframe
                                                    src={selectedPreview.url}
                                                    title={selectedPreview.name}
                                                    className="w-full h-full"
                                                />
                                            ) : (
                                                <p className="text-xs text-slate-400">このファイル形式のプレビューには対応していません。</p>
                                            )
                                        ) : (
                                            <p className="text-xs text-slate-400">プレビュー対象のファイルがありません。</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </section>

                        <section
                            onDragOver={e => {
                                e.preventDefault();
                                if (!isDisabled && !isAIOff) setIsDraggingFiles(true);
                            }}
                            onDragLeave={() => setIsDraggingFiles(false)}
                            onDrop={handleDrop}
                            className={`border-2 border-dashed rounded-xl p-4 flex flex-col gap-3 bg-white dark:bg-slate-800 ${
                                isDraggingFiles ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-500/10' : 'border-slate-200'
                            } ${isDisabled || isAIOff ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                            <div className="flex items-center gap-3">
                                <FileText className="w-6 h-6 text-blue-500" aria-hidden />
                                <div>
                                    <p className="font-semibold text-slate-800 dark:text-slate-100">一括アップロード</p>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        PDF / 画像をまとめてドラッグ＆ドロップ。OCR結果はDraftに追加されます。
                                    </p>
                                </div>
                            </div>
                            <label
                                htmlFor="bulk-upload"
                                className={`inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition ${
                                    isDisabled || isAIOff ? 'opacity-50 cursor-not-allowed' : ''
                                }`}
                            >
                                {isOcrLoading ? <Loader className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                <span>{isOcrLoading ? '解析中...' : 'ファイルをアップロード'}</span>
                                <input
                                    id="bulk-upload"
                                    type="file"
                                    className="sr-only"
                                    accept="image/*,application/pdf"
                                    multiple
                                    disabled={isDisabled || isAIOff}
                                    onChange={handleFileInputChange}
                                />
                            </label>
                            {isAIOff && (
                                <p className="text-xs text-rose-500">
                                    SupabaseのAIフラグがOFFのため、OCRキューは利用できません。
                                </p>
                            )}
                        </section>

                        <section className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm space-y-3">
                            <div className="flex items-center justify-between">
                                <p className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-slate-400" />
                                    請求書マスターリスト
                                </p>
                                <button
                                    type="button"
                                    onClick={addNewInvoice}
                                    className="text-sm text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 disabled:opacity-50"
                                    disabled={isDisabled}
                                >
                                    <PlusCircle className="w-4 h-4" /> 新規Draft
                                </button>
                            </div>

                            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                                {invoiceDrafts.map(invoice => {
                                    const diagnostics = invoiceDiagnostics.find(d => d.invoiceId === invoice.id);
                                    const severity = diagnostics?.severity ?? 'ok';
                                    return (
                                        <button
                                            key={invoice.id}
                                            type="button"
                                            onClick={() => setSelectedInvoiceId(invoice.id)}
                                            disabled={isDisabled}
                                            className={`w-full text-left rounded-lg border p-3 flex items-center justify-between gap-3 transition ${
                                                selectedInvoice?.id === invoice.id
                                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10'
                                                    : 'border-slate-200 hover:border-blue-400'
                                            }`}
                                        >
                                            <div>
                                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                                    {invoice.supplierName || '未入力のサプライヤー'}
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    {invoice.invoiceDate} / 合計 ¥{(diagnostics?.totals.gross ?? 0).toLocaleString()}
                                                </p>
                                                <span
                                                    className={`inline-flex items-center text-[11px] px-2 py-0.5 rounded-full mt-1 ${
                                                        statusBadges[invoice.status] || 'bg-slate-100 text-slate-600'
                                                    }`}
                                                >
                                                    {invoice.status}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {severityIcon(severity as 'ok' | 'warn' | 'error')}
                                                <span className="text-xs text-slate-500">
                                                    {diagnostics?.alerts.length ?? 0} 件
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </section>

                        <section className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm space-y-3">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-amber-500" aria-hidden />
                                <p className="font-semibold text-slate-800 dark:text-slate-100">MQルール警告</p>
                            </div>
                            <p className="text-xs text-slate-500">
                                WARNING/INFO は目視確認用です。ERROR が残っている場合のみ送信・保存がブロックされます。
                            </p>
                            {diagnosticsForSelected?.alerts.length ? (
                                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                    {diagnosticsForSelected.alerts.map(alert => (
                                        <div
                                            key={alert.id}
                                            className={`p-3 rounded-lg text-sm flex justify-between items-start gap-2 ${mqLevelStyles[alert.level]}`}
                                        >
                                            <p>{alert.message}</p>
                                            {alert.lineId && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleJumpToLine(alert.lineId)}
                                                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 underline"
                                                >
                                                    該当明細へ
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-slate-500">検証済。問題は見つかりません。</p>
                            )}
                        </section>
                    </div>

                    <div className="space-y-6">

                        <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-5 space-y-4">
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className={`md:col-span-2 ${requiredFieldCardClass}`}>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <label className={requiredLabelClass}>サプライヤー / 支払先</label>
                                        <RequiredBadge />
                                        {paymentRecipientWarning && (
                                            <span className="text-xs text-amber-600 dark:text-amber-300 bg-amber-100 dark:bg-amber-500/20 px-2 py-0.5 rounded-full">
                                                支払先を選択してください
                                            </span>
                                        )}
                                    </div>
                                    <SupplierSearchSelect
                                        suppliers={paymentRecipients}
                                        value={selectedInvoice.paymentRecipientId}
                                        searchHint={selectedInvoice.supplierName}
                                        onChange={handleSupplierSelectChange}
                                        onCreateSupplier={
                                            onCreatePaymentRecipient
                                                ? async (name) => {
                                                    const created = await onCreatePaymentRecipient({ companyName: name });
                                                    handleSupplierSelectChange(created.id, created);
                                                    return created;
                                                }
                                                : undefined
                                        }
                                        disabled={isDisabled}
                                        required
                                        highlightRequired
                                        id="paymentRecipientId"
                                    />
                                    {!paymentRecipients.length && (
                                        <p className="mt-1 text-xs text-amber-600">
                                            支払先マスタが未設定です。マスタ管理から登録してください。
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-300">
                                        登録番号（インボイス）
                                    </label>
                                    <input
                                        type="text"
                                        value={selectedInvoice.registrationNumber}
                                        onChange={e => handleInvoiceFieldChange('registrationNumber', e.target.value)}
                                        className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="T1234567890123"
                                        disabled={isDisabled}
                                    />
                                </div>
                                <div className={requiredFieldCardClass}>
                                    <label htmlFor="invoiceDate" className={requiredLabelClass}>
                                        請求書発行日
                                        <RequiredBadge />
                                    </label>
                                    <input
                                        type="date"
                                        value={selectedInvoice.invoiceDate}
                                        onChange={e => handleInvoiceFieldChange('invoiceDate', e.target.value)}
                                        className={requiredInputClass}
                                        disabled={isDisabled}
                                        required
                                        id="invoiceDate"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-300">
                                        支払期限
                                    </label>
                                    <input
                                        type="date"
                                        value={selectedInvoice.dueDate}
                                        onChange={e => handleInvoiceFieldChange('dueDate', e.target.value)}
                                        className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                                        disabled={isDisabled}
                                    />
                                </div>
                                <div className={requiredFieldCardClass}>
                                    <label className={requiredLabelClass}>
                                        部門
                                        <RequiredBadge />
                                    </label>
                                    <DepartmentSelect
                                        value={departmentId}
                                        onChange={setDepartmentId}
                                        required
                                        highlightRequired
                                        id="departmentId"
                                    />
                                </div>
                                <div className={`md:col-span-2 ${requiredFieldCardClass}`}>
                                    <ApprovalRouteSelector
                                        onChange={setApprovalRouteId}
                                        isSubmitting={isDisabled}
                                        variant="inline"
                                        highlightRequired
                                        labelAdornment={<RequiredBadge />}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-300">
                                        合計金額（税込）
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={selectedInvoice.totalGross}
                                        onChange={e =>
                                            handleInvoiceFieldChange('totalGross', numberFromInput(e.target.value))
                                        }
                                        readOnly={!isManualTotals}
                                        aria-readonly={!isManualTotals}
                                        className={`mt-1 w-full rounded-md border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm text-right text-slate-900 dark:text-white focus:ring-blue-500 focus:border-blue-500 ${
                                            isManualTotals ? 'bg-white dark:bg-slate-700' : 'bg-slate-50 dark:bg-slate-800'
                                        }`}
                                        disabled={isDisabled}
                                    />
                                    {!isManualTotals && (
                                        <p className="mt-1 text-xs text-slate-500">
                                            明細の集計結果を自動表示しています。手動入力に切り替える場合は下のボタンを使用してください。
                                        </p>
                                    )}
                                </div>
                                <div className="flex items-end justify-between gap-2">
                                    <div className="w-full">
                                        <label className="block text-sm font-medium text-slate-600 dark:text-slate-300">
                                            ステータス
                                        </label>
                                        <select
                                            value={selectedInvoice.status}
                                            onChange={e =>
                                                handleInvoiceFieldChange('status', e.target.value as ExpenseInvoiceDraft['status'])
                                            }
                                            className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                                            disabled={isDisabled}
                                        >
                                            {invoiceStatusOptions.map(option => (
                                                <option key={option.value} value={option.value}>
                                                    {option.label}
                                                </option>
                                            ))}
                                        </select>
                                        <p className="mt-1 text-xs text-slate-500">
                                            Draft/要修正は作業中メモ、検証済は送信準備完了の目印として利用できます。
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            handleInvoiceFieldChange('status', diagnosticsForSelected?.alerts.length ? '要修正' : '検証済')
                                        }
                                        className="inline-flex items-center gap-1 px-3 py-2 text-xs bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-200"
                                        disabled={isDisabled}
                                    >
                                        <RefreshCw className="w-3.5 h-3.5" />
                                        MQ結果を反映
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
                                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">ヘッダー金額の入力モード</p>
                                <button
                                    type="button"
                                    onClick={() => handleTotalsModeChange(!isManualTotals)}
                                    className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200"
                                    disabled={isDisabled}
                                >
                                    {isManualTotals ? '明細の自動集計に戻す' : '手動入力に切り替える'}
                                </button>
                            </div>
                            <p className="text-xs text-slate-500">
                                {isManualTotals
                                    ? '手動モードではヘッダー金額を自由に入力できます。明細を編集した場合は「明細の自動集計に戻す」でリセットできます。'
                                    : '明細行から税抜・消費税・税込を自動算出しています。'}
                            </p>

                            <div className="grid md:grid-cols-3 gap-4">
                                {(['totalNet', 'taxAmount'] as const).map(field => (
                                    <div key={field}>
                                        <label className="block text-sm font-medium text-slate-600 dark:text-slate-300">
                                            {field === 'totalNet' ? '税抜金額' : '消費税額'}
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={selectedInvoice[field]}
                                            onChange={e =>
                                                handleInvoiceFieldChange(field, numberFromInput(e.target.value))
                                            }
                                            readOnly={!isManualTotals}
                                            aria-readonly={!isManualTotals}
                                            className={`mt-1 w-full rounded-md border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm text-right text-slate-900 dark:text-white focus:ring-blue-500 focus:border-blue-500 ${
                                                isManualTotals ? 'bg-white dark:bg-slate-700' : 'bg-slate-50 dark:bg-slate-800'
                                            }`}
                                            disabled={isDisabled}
                                        />
                                    </div>
                                ))}
                                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 text-sm">
                                    <p className="text-xs text-slate-500 mb-1">明細からの自動集計</p>
                                    <p className="flex justify-between text-slate-700 dark:text-slate-100">
                                        <span>税抜</span>
                                        <span>¥{totalsLabel.net.toLocaleString()}</span>
                                    </p>
                                    <p className="flex justify-between text-slate-600">
                                        <span>消費税</span>
                                        <span>¥{totalsLabel.tax.toLocaleString()}</span>
                                    </p>
                                    <p className="flex justify-between font-semibold text-slate-900 dark:text-white">
                                        <span>税込</span>
                                        <span>¥{totalsLabel.gross.toLocaleString()}</span>
                                    </p>
                                </div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-300">振込先・銀行名</label>
                                    <input
                                        type="text"
                                        value={selectedInvoice.bankAccount.bankName}
                                        onChange={e => handleBankAccountChange('bankName', e.target.value)}
                                        className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="○○銀行"
                                        disabled={isDisabled}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-300">支店名</label>
                                    <input
                                        type="text"
                                        value={selectedInvoice.bankAccount.branchName}
                                        onChange={e => handleBankAccountChange('branchName', e.target.value)}
                                        className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="本店営業部"
                                        disabled={isDisabled}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-300">口座種別</label>
                                    <input
                                        type="text"
                                        value={selectedInvoice.bankAccount.accountType}
                                        onChange={e => handleBankAccountChange('accountType', e.target.value)}
                                        className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="普通 / 当座"
                                        disabled={isDisabled}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-300">口座番号</label>
                                    <input
                                        type="text"
                                        value={selectedInvoice.bankAccount.accountNumber}
                                        onChange={e => handleBankAccountChange('accountNumber', e.target.value)}
                                        className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="1234567"
                                        disabled={isDisabled}
                                    />
                                </div>
                            </div>
                        </section>

                        <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-5 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-base font-semibold text-slate-800 dark:text-slate-100">
                                    <span>経費明細</span>
                                    <RequiredBadge />
                                </div>
                                <button
                                    type="button"
                                    onClick={addLine}
                                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-semibold disabled:opacity-50"
                                    disabled={isDisabled}
                                >
                                    <PlusCircle className="w-4 h-4" />
                                    明細行を追加
                                </button>
                            </div>
                            <div className="overflow-x-auto">
                                <p className="text-xs text-slate-500 mb-2">行を横スクロールして全ての項目を入力できます。</p>
                                <table
                                    id="expense-lines-table"
                                    tabIndex={-1}
                                    className="w-full min-w-[1200px] text-sm whitespace-nowrap"
                                >
                                    <thead>
                                        <tr className="text-left text-xs text-slate-500 uppercase tracking-wider">
                                            <th className="py-2 px-2 min-w-[40px]">#</th>
                                            <th className="py-2 px-2 min-w-[120px]">日付</th>
                                            <th className="py-2 px-2 min-w-[240px]">品名</th>
                                            <th className="py-2 px-2 min-w-[90px]">数量</th>
                                            <th className="py-2 px-2 min-w-[90px]">単位</th>
                                            <th className="py-2 px-2 min-w-[120px]">単価</th>
                                            <th className="py-2 px-2 min-w-[140px]">金額（税抜）</th>
                                            <th className="py-2 px-2 min-w-[140px]">勘定科目</th>
                                            <th className="py-2 px-2 min-w-[150px]">振分区分</th>
                                            <th className="py-2 px-2 min-w-[100px]">税率</th>
                                            <th className="py-2 px-2 min-w-[220px]">顧客</th>
                                            <th className="py-2 px-2 min-w-[220px]">プロジェクト</th>
                                            <th className="py-2 px-2 min-w-[200px]">売上/見積</th>
                                            <th className="px-2" />
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                        {selectedInvoice.lines.map((line, index) => {
                                            const lineAlerts = diagnosticsForSelected?.alerts.filter(alert => alert.lineId === line.id) || [];
                                            const hasErrorAlert = lineAlerts.some(alert => alert.level === 'ERROR');
                                            const customerFilter = (customerSearchTerms[line.id] || '').toLowerCase();
                                            const filteredCustomers = effectiveCustomers.filter(customer =>
                                                customer.customerName.toLowerCase().includes(customerFilter)
                                            );
                                            const selectedCustomer = effectiveCustomers.find(customer => customer.id === line.customerId);
                                            const availableProjects = effectiveJobs.filter(job => {
                                                if (!selectedCustomer) return false;
                                                if (job.customerId && selectedCustomer.id) {
                                                    return job.customerId === selectedCustomer.id;
                                                }
                                                return (
                                                    job.clientName?.trim().toLowerCase() ===
                                                    selectedCustomer.customerName?.trim().toLowerCase()
                                                );
                                            });
                                            const revenueOptions = [
                                                ...availableProjects
                                                    .filter(job => job.invoiceId)
                                                    .map(job => ({
                                                        id: `invoice:${job.invoiceId}`,
                                                        label: `売上 ${job.jobNumber} / ¥${job.price.toLocaleString()}`,
                                                    })),
                                                ...purchaseOrders
                                                    .filter(order => order.supplierName === selectedInvoice.supplierName)
                                                    .map(order => ({
                                                        id: `order:${order.id}`,
                                                        label: `発注 ${order.itemName} / ¥${(
                                                            order.quantity * order.unitPrice
                                                        ).toLocaleString()}`,
                                                    })),
                                            ];
                                            const accountItemHints = getAccountItemSuggestions(line.description);

                                            return (
                                                <tr
                                                    key={line.id}
                                                    id={`expense-line-${line.id}`}
                                                    className={`align-top ${
                                                        highlightedLineId === line.id
                                                            ? 'bg-blue-50 dark:bg-blue-500/10'
                                                            : hasErrorAlert
                                                                ? 'bg-rose-50 dark:bg-rose-900/20'
                                                                : ''
                                                    }`}
                                                >
                                                    <td className="py-3 px-2 text-xs text-slate-500">{index + 1}</td>
                                                    <td className="py-3 px-2 min-w-[120px]">
                                                        <label htmlFor={`lineDate-${line.id}`} className="sr-only">
                                                            日付
                                                        </label>
                                                        <input
                                                            id={`lineDate-${line.id}`}
                                                            aria-label="日付"
                                                            type="date"
                                                            value={line.lineDate}
                                                            onChange={e => handleLineChange(line.id, 'lineDate', e.target.value)}
                                                            className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1.5 text-sm"
                                                            disabled={isDisabled}
                                                        />
                                                    </td>
                                                    <td className="py-3 px-2 min-w-[240px]">
                                                        <label htmlFor={`description-${line.id}`} className="sr-only">
                                                            品名
                                                        </label>
                                                        <input
                                                            id={`description-${line.id}`}
                                                            aria-label="品名"
                                                            type="text"
                                                            value={line.description}
                                                            onChange={e => handleLineChange(line.id, 'description', e.target.value)}
                                                            className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1.5 text-sm"
                                                            placeholder="例: 町田印刷 9月号チラシ"
                                                            disabled={isDisabled}
                                                        />
                                                        {accountItemHints.length > 0 && (
                                                            <div className="flex flex-wrap gap-1 mt-1">
                                                                {accountItemHints.map(hint => (
                                                                    <button
                                                                        type="button"
                                                                        key={hint.id}
                                                                        onClick={() => handleLineChange(line.id, 'accountItemId', hint.id)}
                                                                        className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600 hover:bg-blue-100"
                                                                        disabled={isDisabled}
                                                                    >
                                                                        候補: {hint.name}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-2 min-w-[100px]">
                                                        <label htmlFor={`quantity-${line.id}`} className="sr-only">
                                                            数量
                                                        </label>
                                                        <input
                                                            id={`quantity-${line.id}`}
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={line.quantity}
                                                            onChange={e =>
                                                                handleLineChange(line.id, 'quantity', numberFromInput(e.target.value))
                                                            }
                                                            className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1.5 text-sm text-right"
                                                            disabled={isDisabled}
                                                        />
                                                    </td>
                                                    <td className="py-3 px-2 min-w-[100px]">
                                                        <label htmlFor={`unit-${line.id}`} className="sr-only">
                                                            単位
                                                        </label>
                                                        <input
                                                            id={`unit-${line.id}`}
                                                            type="text"
                                                            value={line.unit}
                                                            onChange={e => handleLineChange(line.id, 'unit', e.target.value)}
                                                            className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1.5 text-sm"
                                                            disabled={isDisabled}
                                                        />
                                                    </td>
                                                    <td className="py-3 px-2 min-w-[120px]">
                                                        <label htmlFor={`unitPrice-${line.id}`} className="sr-only">
                                                            単価
                                                        </label>
                                                        <input
                                                            id={`unitPrice-${line.id}`}
                                                            type="number"
                                                            step="0.01"
                                                            value={line.unitPrice}
                                                            onChange={e =>
                                                                handleLineChange(line.id, 'unitPrice', numberFromInput(e.target.value))
                                                            }
                                                            className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1.5 text-sm text-right"
                                                            disabled={isDisabled}
                                                        />
                                                    </td>
                                                    <td className="py-3 px-2 min-w-[150px]">
                                                        <label htmlFor={`amount-${line.id}`} className="sr-only">
                                                            金額（税抜）
                                                        </label>
                                                        <input
                                                            id={`amount-${line.id}`}
                                                            aria-label="金額（税抜）"
                                                            type="number"
                                                            step="0.01"
                                                            value={line.amountExclTax}
                                                            onChange={e =>
                                                                handleLineChange(line.id, 'amountExclTax', numberFromInput(e.target.value))
                                                            }
                                                            className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1.5 text-sm text-right"
                                                            disabled={isDisabled}
                                                        />
                                                    </td>
                                                    <td className="py-3 px-2 min-w-[160px]">
                                                        <label htmlFor={`accountItem-${line.id}`} className="sr-only">
                                                            勘定科目
                                                        </label>
                                                        <AccountItemSelect
                                                            id={`accountItem-${line.id}`}
                                                            name={`accountItem-${line.id}`}
                                                            value={line.accountItemId}
                                                            onChange={value => handleLineChange(line.id, 'accountItemId', value)}
                                                        />
                                                    </td>
                                                    <td className="py-3 px-2 min-w-[160px]">
                                                        <label className="sr-only" htmlFor={`allocation-${line.id}`}>
                                                            振分区分
                                                        </label>
                                                        <select
                                                            id={`allocation-${line.id}`}
                                                            value={line.allocationDivisionId}
                                                            onChange={e =>
                                                                handleLineChange(line.id, 'allocationDivisionId', e.target.value)
                                                            }
                                                            className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1.5 text-sm"
                                                            disabled={isDisabled}
                                                        >
                                                            <option value="">振分区分</option>
                                                            {allocationDivisions.map(division => (
                                                                <option key={division.id} value={division.id}>
                                                                    {division.name}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td className="py-3 px-2 min-w-[100px]">
                                                        <label htmlFor={`taxRate-${line.id}`} className="sr-only">
                                                            税率
                                                        </label>
                                                        <input
                                                            id={`taxRate-${line.id}`}
                                                            type="number"
                                                            step="0.01"
                                                            value={line.taxRate}
                                                            onChange={e =>
                                                                handleLineChange(line.id, 'taxRate', numberFromInput(e.target.value))
                                                            }
                                                            className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1.5 text-sm text-right"
                                                            disabled={isDisabled}
                                                        />
                                                    </td>
                                                    <td className="py-3 px-2 min-w-[220px]">
                                                        <label className="sr-only" htmlFor={`customer-${line.id}`}>
                                                            顧客
                                                        </label>
                                                        <input
                                                            type="text"
                                                            placeholder="顧客検索"
                                                            value={customerSearchTerms[line.id] || ''}
                                                            onChange={e => handleCustomerFilterChange(line.id, e.target.value)}
                                                            className="w-full rounded-md border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-2 py-1 text-xs mb-1"
                                                            disabled={isDisabled}
                                                        />
                                                        {customerFilter && (
                                                            <div className="flex flex-wrap gap-1 mb-1">
                                                                {filteredCustomers.slice(0, 3).map(customer => (
                                                                    <button
                                                                        type="button"
                                                                        key={customer.id}
                                                                        onClick={() => handleLineChange(line.id, 'customerId', customer.id)}
                                                                        className={`px-2 py-0.5 text-[11px] rounded-full border ${
                                                                            line.customerId === customer.id
                                                                                ? 'bg-blue-100 border-blue-400 text-blue-700'
                                                                                : 'bg-white border-slate-200 text-slate-600'
                                                                        }`}
                                                                        disabled={isDisabled}
                                                                    >
                                                                        {customer.customerName}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                        <select
                                                            id={`customer-${line.id}`}
                                                            aria-label="顧客"
                                                            value={line.customerId}
                                                            onChange={e => handleLineChange(line.id, 'customerId', e.target.value)}
                                                            className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1.5 text-sm"
                                                            disabled={isDisabled}
                                                        >
                                                            <option value="">顧客を選択</option>
                                                            {filteredCustomers.map(customer => (
                                                                <option key={customer.id} value={customer.id}>
                                                                    {customer.customerName}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        {lineAlerts
                                                            .filter(alert => alert.level === 'ERROR' && alert.message.includes('顧客'))
                                                            .map(alert => (
                                                                <p key={alert.id} className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                                                                    {alert.message}
                                                                </p>
                                                            ))}
                                                    </td>
                                                    <td className="py-3 px-2 min-w-[220px]">
                                                        <label className="sr-only" htmlFor={`project-${line.id}`}>
                                                            プロジェクト
                                                        </label>
                                                        <select
                                                            id={`project-${line.id}`}
                                                            aria-label='プロジェクト'
                                                            value={line.projectId}
                                                            onChange={e => handleLineChange(line.id, 'projectId', e.target.value)}
                                                            className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1.5 text-sm"
                                                            disabled={isDisabled || !line.customerId}
                                                        >
                                                            <option value="">
                                                                {line.customerId ? 'プロジェクトを選択' : '顧客を先に選択'}
                                                            </option>
                                                            {availableProjects.map(project => (
                                                                <option
                                                                    key={project.id}
                                                                    value={project.id}
                                                                    disabled={project.status === JobStatus.Completed}
                                                                >
                                                                    {project.title}（{project.status}）
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td className="py-3 px-2 min-w-[200px]">
                                                        <label className="sr-only" htmlFor={`revenue-${line.id}`}>
                                                            売上/見積
                                                        </label>
                                                        <select
                                                            id={`revenue-${line.id}`}
                                                            aria-label="売上/見積"
                                                            value={line.linkedRevenueId}
                                                            onChange={e => handleLineChange(line.id, 'linkedRevenueId', e.target.value)}
                                                            className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1.5 text-sm"
                                                            disabled={isDisabled || revenueOptions.length === 0}
                                                        >
                                                            <option value="">
                                                                {revenueOptions.length ? '売上/見積を紐付け' : '候補なし'}
                                                            </option>
                                                            {revenueOptions.map(option => (
                                                                <option key={option.id} value={option.id}>
                                                                    {option.label}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td className="py-3 px-2 align-middle text-right">
                                                        <button
                                                            type="button"
                                                            onClick={() => removeLine(line.id)}
                                                            className="text-slate-400 hover:text-rose-500 disabled:opacity-50"
                                                            disabled={isDisabled}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-200 dark:border-slate-700">
                                <div className="text-sm text-slate-500 dark:text-slate-400">
                                    合計金額（税抜ベース）:
                                    <span className="text-lg font-bold text-slate-900 dark:text-white ml-2">
                                        ¥{totalsLabel.net.toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        </section>

                        <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-5 space-y-3">
                            <label htmlFor="allocationNotes" className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                備考
                            </label>
                            <textarea
                                id="allocationNotes"
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                rows={3}
                                className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                                placeholder="補足事項や承認者宛コメントを入力してください。"
                                disabled={isDisabled}
                            />
                        </section>
                    </div>
                </div>

                {error && (
                    <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-3" role="alert">
                        {error}
                    </p>
                )}

                <div className="flex flex-wrap justify-between gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <button
                        type="button"
                        onClick={handleNextInvoice}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-100 font-semibold disabled:opacity-50"
                        disabled={isDisabled}
                    >
                        次の請求書へ
                    </button>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={handleSaveDraft}
                            className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold flex items-center gap-2 disabled:opacity-50"
                            disabled={isDisabled || isSavingDraft}
                        >
                            {isSavingDraft && <Loader className="w-4 h-4 animate-spin" />}
                            下書き保存
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2 rounded-lg bg-blue-600 text-white font-semibold flex items-center justify-center gap-2 disabled:bg-slate-400"
                            disabled={isDisabled}
                        >
                            {isSubmitting ? <Loader className="w-4 h-4 animate-spin" /> : '申請を送信する'}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default ExpenseReimbursementForm;
