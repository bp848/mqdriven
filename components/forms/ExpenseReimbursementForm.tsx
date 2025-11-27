import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { submitApplication, saveApplicationDraft, getApplicationDraft, clearApplicationDraft } from '../../services/dataService';
import { extractInvoiceDetails } from '../../services/geminiService';
import ApprovalRouteSelector from './ApprovalRouteSelector';
import AccountItemSelect from './AccountItemSelect';
import DepartmentSelect from './DepartmentSelect';
import SupplierSearchSelect from './SupplierSearchSelect';
import { useSubmitWithConfirmation } from '../../hooks/useSubmitWithConfirmation';
import { Loader, Upload, PlusCircle, Trash2, AlertTriangle, CheckCircle, FileText, RefreshCw, List, ArrowLeft, ArrowRight, Check, Sparkles, X, Pencil } from '../Icons';
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

// --- TYPES AND CONSTANTS ---

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
    ocrExtracted: boolean;
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
    ocrExtractedFields: Set<string>;
    sourceFile?: { name: string; type: string; url: string };
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

const generateId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

const createEmptyLine = (ocr: boolean = false): ExpenseLine => ({
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
    ocrExtracted: ocr,
});

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
    bankAccount: { bankName: '', branchName: '', accountType: '', accountNumber: '' },
    lines: [createEmptyLine()],
    ocrExtractedFields: new Set(),
});

const STEPS = [
    { id: 1, name: '請求書のアップロードと確認' },
    { id: 2, name: '明細の編集' },
    { id: 3, name: '申請内容の最終確認と提出' },
];


// --- UTILITY FUNCTIONS ---

const numberFromInput = (value: string) => {
    if (value === '') return 0;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => (typeof reader.result === 'string' ? resolve(reader.result.split(',')[1]) : reject('Read failed'));
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
};

const computeLineTotals = (invoice: ExpenseInvoiceDraft): ComputedTotals => {
    const net = invoice.lines.reduce((sum, line) => sum + (Number(line.amountExclTax) || 0), 0);
    const tax = invoice.lines.reduce(
        (sum, line) => sum + (Number(line.amountExclTax) || 0) * ((Number(line.taxRate) || 0) / 100),
        0
    );
    return { net, tax, gross: net + tax };
};


// --- UI HELPER COMPONENTS ---

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
    <div className={`bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200/80 dark:border-slate-700/60 ${className}`}>
        {children}
    </div>
);

const CardHeader: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
    <div className={`p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700 ${className}`}>{children}</div>
);

const CardTitle: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
    <h3 className={`text-lg font-bold text-slate-800 dark:text-slate-100 ${className}`}>{children}</h3>
);

const CardDescription: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
    <p className={`text-sm text-slate-500 dark:text-slate-400 mt-1 ${className}`}>{children}</p>
);

const CardContent: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
    <div className={`p-4 sm:p-6 ${className}`}>{children}</div>
);

const OcrLabel: React.FC = () => (
    <span className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 font-medium">
        <Sparkles className="w-3 h-3" />
        <span>AI-OCR</span>
    </span>
);

const RequiredBadge: React.FC = () => (
    <span className="ml-1 text-[10px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-500/20 px-1.5 py-0.5 rounded-full">
        必須
    </span>
);

const FormField: React.FC<{
    label: string;
    children: React.ReactNode;
    isOcr?: boolean;
    htmlFor?: string;
    required?: boolean;
    className?: string;
}> = ({ label, children, isOcr, htmlFor, required, className }) => (
    <div className={className}>
        <label htmlFor={htmlFor} className="flex items-center justify-between text-sm font-medium text-slate-700 dark:text-slate-300">
            <span className="flex items-center gap-2">{label} {required && <RequiredBadge />}</span>
            {isOcr && <OcrLabel />}
        </label>
        <div className="mt-1.5">{children}</div>
    </div>
);

// --- MAIN COMPONENT ---

const ExpenseReimbursementForm: React.FC<ExpenseReimbursementFormProps> = (props) => {
    const {
        onSuccess, applicationCodeId, currentUser, customers, accountItems, jobs, purchaseOrders,
        departments, allocationDivisions, paymentRecipients, onCreatePaymentRecipient,
        isAIOff, isLoading, error: formLoadError, addToast, draftApplication
    } = props;

    const [currentStep, setCurrentStep] = useState(1);
    const [invoice, setInvoice] = useState<ExpenseInvoiceDraft>(createEmptyInvoiceDraft());
    const [departmentId, setDepartmentId] = useState<string>('');
    const [approvalRouteId, setApprovalRouteId] = useState<string>('');
    const [notes, setNotes] = useState('');
    const [mqCostType, setMqCostType] = useState<'V' | 'F' | ''>('');
    const [mqPurpose, setMqPurpose] = useState('');
    const [mqExpectedSalesPQ, setMqExpectedSalesPQ] = useState<number | ''>('');
    const [mqExpectedMarginMQ, setMqExpectedMarginMQ] = useState<number | ''>('');
    const [hasSubmitted, setHasSubmitted] = useState(false);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSavingDraft, setIsSavingDraft] = useState(false);
    const [isOcrLoading, setIsOcrLoading] = useState(false);
    const [isRestoring, setIsRestoring] = useState(true);
    const [error, setError] = useState('');
    const { requestConfirmation, ConfirmationDialog } = useSubmitWithConfirmation();

    const isDisabled = isSubmitting || isSavingDraft || isLoading || isRestoring || !!formLoadError || hasSubmitted;

    const mqMRate = useMemo(() => {
        if (mqExpectedSalesPQ === '' || mqExpectedMarginMQ === '') return null;
        const pq = typeof mqExpectedSalesPQ === 'number' ? mqExpectedSalesPQ : Number(mqExpectedSalesPQ);
        const mq = typeof mqExpectedMarginMQ === 'number' ? mqExpectedMarginMQ : Number(mqExpectedMarginMQ);
        if (!Number.isFinite(pq) || pq === 0 || !Number.isFinite(mq)) return null;
        return (mq / pq) * 100;
    }, [mqExpectedSalesPQ, mqExpectedMarginMQ]);

    const resetFormFields = useCallback(() => {
        setInvoice(createEmptyInvoiceDraft());
        setDepartmentId('');
        setApprovalRouteId('');
        setNotes('');
        setMqCostType('');
        setMqPurpose('');
        setMqExpectedSalesPQ('');
        setMqExpectedMarginMQ('');
        setCurrentStep(1);
    }, []);

    // Restore draft logic
    useEffect(() => {
        const restoreDraft = async () => {
            if (!currentUser?.id || !applicationCodeId) {
                setHasSubmitted(false);
                setIsRestoring(false);
                return;
            }

            try {
                const draft = draftApplication ? draftApplication : await getApplicationDraft(applicationCodeId, currentUser.id);
                if (draft?.formData) {
                    const data = draft.formData as any;
                    setInvoice({
                        ...createEmptyInvoiceDraft(),
                        ...data.invoice,
                        ocrExtractedFields: new Set(data.invoice?.ocrExtractedFields || []),
                    });
                    setDepartmentId(data.departmentId || '');
                    setApprovalRouteId(data.approvalRouteId || '');
                    setNotes(data.notes || '');

                    const mq = data.mqAccounting || {};
                    setMqCostType(mq.costType === 'V' || mq.costType === 'F' ? mq.costType : '');
                    setMqPurpose(mq.purpose || '');
                    setMqExpectedSalesPQ(
                        typeof mq.expectedSalesPQ === 'number' && Number.isFinite(mq.expectedSalesPQ)
                            ? mq.expectedSalesPQ
                            : ''
                    );
                    setMqExpectedMarginMQ(
                        typeof mq.expectedMarginMQ === 'number' && Number.isFinite(mq.expectedMarginMQ)
                            ? mq.expectedMarginMQ
                            : ''
                    );

                    addToast?.('下書きを復元しました。', 'info');
                }
            } catch (err) {
                console.error("Failed to restore draft", err);
            } finally {
                setHasSubmitted(false);
                setIsRestoring(false);
            }
        };
        restoreDraft();
    }, [applicationCodeId, currentUser?.id, draftApplication, addToast]);

    const handleFieldChange = (field: keyof ExpenseInvoiceDraft, value: any) => {
        setInvoice(prev => ({ ...prev, [field]: value }));
    };

    const handleLineChange = (lineId: string, field: keyof ExpenseLine, value: any) => {
        setInvoice(prev => {
            const newLines = prev.lines.map(line => {
                if (line.id !== lineId) return line;
                const updatedLine = { ...line, [field]: value };
                if (field === 'quantity' || field === 'unitPrice') {
                    const quantity = field === 'quantity' ? Number(value) : Number(updatedLine.quantity);
                    const unitPrice = field === 'unitPrice' ? Number(value) : Number(updatedLine.unitPrice);
                    updatedLine.amountExclTax = quantity * unitPrice;
                }
                return updatedLine;
            });
            return { ...prev, lines: newLines };
        });
    };

    const addLine = () => {
        setInvoice(prev => ({ ...prev, lines: [...prev.lines, createEmptyLine()] }));
    };

    const removeLine = (lineId: string) => {
        setInvoice(prev => {
            const newLines = prev.lines.filter(l => l.id !== lineId);
            if (newLines.length === 0) {
                return { ...prev, lines: [createEmptyLine()] };
            }
            return { ...prev, lines: newLines };
        });
    };

    const handleFileUpload = async (files: FileList | null) => {
        if (!files || files.length === 0 || isAIOff) return;

        setIsOcrLoading(true);
        setError('');
        const file = files[0];

        try {
            const base64 = await readFileAsBase64(file);
            const ocrData: InvoiceData = await extractInvoiceDetails(base64, file.type);
            const newDraft = createEmptyInvoiceDraft();
            const ocrFields = new Set<string>();

            const updateField = (field: keyof ExpenseInvoiceDraft, value: any) => {
                if (value) {
                    (newDraft as any)[field] = value;
                    ocrFields.add(field);
                }
            };

            updateField('supplierName', ocrData.vendorName);
            updateField('registrationNumber', ocrData.registrationNumber);
            updateField('invoiceDate', ocrData.invoiceDate);
            updateField('dueDate', ocrData.dueDate);
            updateField('totalGross', ocrData.totalAmount);
            updateField('totalNet', ocrData.subtotalAmount);
            updateField('taxAmount', ocrData.taxAmount);

            if (ocrData.lineItems && ocrData.lineItems.length > 0) {
                newDraft.lines = ocrData.lineItems.map(item => ({
                    ...createEmptyLine(true),
                    description: item.description || '',
                    amountExclTax: item.amountExclTax || 0,
                    quantity: item.quantity || 1,
                    unitPrice: item.unitPrice || 0,
                    taxRate: item.taxRate || 10,
                }));
                ocrFields.add('lines');
            } else if (newDraft.totalNet) {
                newDraft.lines = [{
                    ...createEmptyLine(true),
                    description: ocrData.description || '品名不明',
                    amountExclTax: newDraft.totalNet,
                }];
                ocrFields.add('lines');
            }

            newDraft.ocrExtractedFields = ocrFields;
            newDraft.sourceFile = { name: file.name, type: file.type, url: URL.createObjectURL(file) };

            setInvoice(newDraft);
            addToast?.('OCRが完了しました。内容を確認してください。', 'success');

        } catch (err: any) {
            setError(err.message || 'OCR処理中にエラーが発生しました。');
            addToast?.('OCR処理に失敗しました。', 'error');
        } finally {
            setIsOcrLoading(false);
        }
    };

    const buildApplicationPayload = () => {
        const normalizeOptionalNumber = (value: number | '' ): number | undefined => {
            if (value === '') return undefined;
            if (typeof value === 'number' && Number.isFinite(value)) return value;
            const parsed = Number(value as any);
            return Number.isFinite(parsed) ? parsed : undefined;
        };

        const mqAccounting = {
            costType: mqCostType || undefined,
            purpose: mqPurpose || undefined,
            expectedSalesPQ: normalizeOptionalNumber(mqExpectedSalesPQ),
            expectedMarginMQ: normalizeOptionalNumber(mqExpectedMarginMQ),
        };

        return {
            applicationCodeId,
            formData: {
                departmentId,
                approvalRouteId,
                notes,
                invoice: {
                    ...invoice,
                    ocrExtractedFields: Array.from(invoice.ocrExtractedFields),
                },
                mqAccounting,
            },
            approvalRouteId,
        };
    };

    const executeSubmission = async () => {
        if (!currentUser) {
            setError('ユーザー情報が見つかりません。');
            return;
        }
        const payload = buildApplicationPayload();
        setIsSubmitting(true);
        setError('');
        try {
            await submitApplication(payload, currentUser.id);
            await clearApplicationDraft(applicationCodeId, currentUser.id);
            resetFormFields();
            setHasSubmitted(true);
            addToast?.('経費精算を送信しました。', 'success');
            onSuccess();
        } catch (err: any) {
            setError(err.message || '申請の提出に失敗しました。');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (hasSubmitted) {
            addToast?.('すでに送信済みの申請です。新しい申請を開始してください。', 'info');
            return;
        }
        if (!currentUser) return setError('ユーザー情報が見つかりません。');
        if (!departmentId) return setError('部門を選択してください。');
        if (!approvalRouteId) return setError('承認ルートを選択してください。');
        if (!invoice.supplierName) return setError('サプライヤー名を入力してください。');

        requestConfirmation({
            label: '申請を送信する',
            title: 'フォーム送信時に送信しますか？',
            description: 'はいを選ぶと申請が送信され、承認者に通知されます。内容の最終確認をお願いします。',
            confirmLabel: 'はい',
            cancelLabel: 'いいえ',
            draftLabel: '下書き',
            postConfirmMessage: 'はい（1件の申請を送信しました）',
            forceConfirmation: true,
            onConfirm: executeSubmission,
            onDraft: handleSaveDraft,
        });
    };

    const handleSaveDraft = async () => {
        if (hasSubmitted) {
            addToast?.('送信済みの申請は下書き保存できません。新しい申請を開始してください。', 'info');
            return;
        }
        if (!currentUser) return setError('ユーザー情報が見つかりません。');
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

    const handleStartNewApplication = () => {
        resetFormFields();
        setHasSubmitted(false);
        setError('');
    };

    const computedTotals = useMemo(() => computeLineTotals(invoice), [invoice]);

    if (isRestoring) {
        return (
            <div className="flex justify-center items-center h-96">
                <Loader className="w-12 h-12 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="w-full p-2 sm:p-4">
            {hasSubmitted && (
                <div className="mb-8 flex flex-col gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 dark:border-emerald-500/40 dark:bg-emerald-900/20 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">この申請は送信済みです。</p>
                        <p className="text-sm text-emerald-900/80 dark:text-emerald-200/80">承認一覧 &gt; 自分の申請タブで内容を確認できます。新しい申請を作成する場合は下のボタンを押してください。</p>
                    </div>
                    <button
                        type="button"
                        onClick={handleStartNewApplication}
                        className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                    >
                        新しい申請を作成
                    </button>
                </div>
            )}

            <form onSubmit={handleSubmit}>
                {currentStep === 1 && (
                    <div className="space-y-6 animate-fade-in">
                        <Card>
                            <CardHeader>
                                <CardTitle>ステップ1: 請求書のアップロードと確認</CardTitle>
                                <CardDescription>請求書のPDFや画像をアップロードすると、AI-OCRが情報を自動で読み取ります。</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <UploadZone onFileUpload={handleFileUpload} isLoading={isOcrLoading} isAIOff={isAIOff} sourceFile={invoice.sourceFile} />
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>ヘッダー情報</CardTitle>
                                <CardDescription>OCRが読み取った請求書の基本情報です。誤りがあれば修正してください。</CardDescription>
                            </CardHeader>
                            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
                                <FormField label="サプライヤー / 支払先" htmlFor="supplierName" required isOcr={invoice.ocrExtractedFields.has('supplierName')} className="md:col-span-2 lg:col-span-3">
                                    <SupplierSearchSelect
                                        suppliers={paymentRecipients}
                                        value={invoice.paymentRecipientId}
                                        searchHint={invoice.supplierName}
                                        onChange={(id, supplier) => {
                                            handleFieldChange('paymentRecipientId', id);
                                            if (supplier) handleFieldChange('supplierName', supplier.companyName || supplier.recipientName);
                                        }}
                                        onCreateSupplier={onCreatePaymentRecipient ? async (name) => {
                                            const created = await onCreatePaymentRecipient({ companyName: name });
                                            handleFieldChange('paymentRecipientId', created.id);
                                            handleFieldChange('supplierName', created.companyName);
                                            return created;
                                        } : undefined}
                                        disabled={isDisabled} required highlightRequired id="supplierName"
                                    />
                                </FormField>
                                <FormField label="登録番号 (インボイス)" htmlFor="registrationNumber" isOcr={invoice.ocrExtractedFields.has('registrationNumber')}>
                                    <input id="registrationNumber" type="text" value={invoice.registrationNumber} onChange={e => handleFieldChange('registrationNumber', e.target.value)} className="w-full rounded-md border-slate-300 dark:border-slate-600" disabled={isDisabled} />
                                </FormField>
                                <FormField label="請求書発行日" htmlFor="invoiceDate" required isOcr={invoice.ocrExtractedFields.has('invoiceDate')}>
                                    <input id="invoiceDate" type="date" value={invoice.invoiceDate} onChange={e => handleFieldChange('invoiceDate', e.target.value)} className="w-full rounded-md border-slate-300 dark:border-slate-600" disabled={isDisabled} required />
                                </FormField>
                                <FormField label="支払期限" htmlFor="dueDate" isOcr={invoice.ocrExtractedFields.has('dueDate')}>
                                    <input id="dueDate" type="date" value={invoice.dueDate} onChange={e => handleFieldChange('dueDate', e.target.value)} className="w-full rounded-md border-slate-300 dark:border-slate-600" disabled={isDisabled} />
                                </FormField>
                                <div className="md:col-span-2 lg:col-span-3 border-t dark:border-slate-700 pt-6 mt-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <FormField label="税抜合計" htmlFor="totalNet" isOcr={invoice.ocrExtractedFields.has('totalNet')}>
                                        <input id="totalNet" type="number" value={invoice.totalNet} onChange={e => handleFieldChange('totalNet', numberFromInput(e.target.value))} className="w-full text-right rounded-md border-slate-300 dark:border-slate-600" disabled={isDisabled} />
                                    </FormField>
                                    <FormField label="消費税" htmlFor="taxAmount" isOcr={invoice.ocrExtractedFields.has('taxAmount')}>
                                        <input id="taxAmount" type="number" value={invoice.taxAmount} onChange={e => handleFieldChange('taxAmount', numberFromInput(e.target.value))} className="w-full text-right rounded-md border-slate-300 dark:border-slate-600" disabled={isDisabled} />
                                    </FormField>
                                    <FormField label="税込合計" htmlFor="totalGross" isOcr={invoice.ocrExtractedFields.has('totalGross')}>
                                        <input id="totalGross" type="number" value={invoice.totalGross} onChange={e => handleFieldChange('totalGross', numberFromInput(e.target.value))} className="w-full text-right rounded-md border-slate-300 dark:border-slate-600" disabled={isDisabled} />
                                    </FormField>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {currentStep === 2 && (
                    <div className="animate-fade-in">
                        <Card>
                            <CardHeader>
                                <CardTitle>ステップ2: 明細の編集</CardTitle>
                                <CardDescription>経費の明細を入力または修正します。OCRで読み取られた行はハイライトされています。</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <LineItemTable
                                    lines={invoice.lines}
                                    onLineChange={handleLineChange}
                                    onAddLine={addLine}
                                    onRemoveLine={removeLine}
                                    isDisabled={isDisabled}
                                    customers={customers}
                                    jobs={jobs}
                                />
                            </CardContent>
                            <div className="p-4 sm:p-6 border-t border-slate-200 dark:border-slate-700 flex justify-end items-center gap-6 bg-slate-50/50 dark:bg-slate-800/30 rounded-b-xl">
                                <div className="text-sm">税抜合計: <span className="font-bold text-lg ml-2">¥{computedTotals.net.toLocaleString()}</span></div>
                                <div className="text-sm">消費税: <span className="font-bold text-lg ml-2">¥{Math.round(computedTotals.tax).toLocaleString()}</span></div>
                                <div className="text-sm font-bold text-blue-600 dark:text-blue-400">税込合計: <span className="text-xl ml-2">¥{Math.round(computedTotals.gross).toLocaleString()}</span></div>
                            </div>
                        </Card>
                    </div>
                )}

                {currentStep === 3 && (
                    <div className="space-y-6 animate-fade-in">
                        <Card>
                            <CardHeader>
                                <CardTitle>ステップ3: 申請内容の最終確認と提出</CardTitle>
                                <CardDescription>申請内容を確認し、部門と承認ルートを選択して提出してください。</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <FormField label="申請部門" htmlFor="departmentId" required>
                                    <DepartmentSelect value={departmentId} onChange={setDepartmentId} required highlightRequired id="departmentId" />
                                </FormField>
                                <FormField label="承認ルート" required>
                                    <ApprovalRouteSelector onChange={setApprovalRouteId} isSubmitting={isDisabled} highlightRequired />
                                </FormField>
                                <FormField label="備考" htmlFor="notes">
                                    <textarea
                                        id="notes"
                                        value={notes}
                                        onChange={e => setNotes(e.target.value)}
                                        rows={8}
                                        className="w-full rounded-md border-slate-300 dark:border-slate-600 min-h-[200px]"
                                        placeholder="補足事項や承認者へのコメントがあれば入力してください。"
                                        disabled={isDisabled}
                                    />
                                </FormField>
                                <div className="pt-4 mt-2 border-t dark:border-slate-700 space-y-4">
                                    <h4 className="text-base font-semibold text-slate-800 dark:text-slate-100">MQ会計情報（任意）</h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        この支出が会社のMQ（限界利益）にどう貢献するか、可能な範囲で入力してください。
                                    </p>
                                    <FormField label="経費の種類 (V/F)" className="space-y-2">
                                        <div className="flex flex-wrap gap-4 text-sm">
                                            <label className="inline-flex items-center gap-2">
                                                <input
                                                    type="radio"
                                                    name="mq_cost_type"
                                                    value="V"
                                                    checked={mqCostType === 'V'}
                                                    onChange={() => setMqCostType('V')}
                                                    disabled={isDisabled}
                                                />
                                                <span>変動費 (V)</span>
                                            </label>
                                            <label className="inline-flex items-center gap-2">
                                                <input
                                                    type="radio"
                                                    name="mq_cost_type"
                                                    value="F"
                                                    checked={mqCostType === 'F'}
                                                    onChange={() => setMqCostType('F')}
                                                    disabled={isDisabled}
                                                />
                                                <span>固定費 (F)</span>
                                            </label>
                                            <label className="inline-flex items-center gap-2">
                                                <input
                                                    type="radio"
                                                    name="mq_cost_type"
                                                    value=""
                                                    checked={mqCostType === ''}
                                                    onChange={() => setMqCostType('')}
                                                    disabled={isDisabled}
                                                />
                                                <span>未選択</span>
                                            </label>
                                        </div>
                                    </FormField>
                                    <FormField label="支出の目的・期待効果">
                                        <textarea
                                            value={mqPurpose}
                                            onChange={e => setMqPurpose(e.target.value)}
                                            rows={4}
                                            className="w-full rounded-md border-slate-300 dark:border-slate-600 min-h-[120px] text-sm"
                                            placeholder="例）A社との新規プロジェクト打ち合わせ。来期1,000万円の売上を目指す など"
                                            disabled={isDisabled}
                                        />
                                    </FormField>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                                        <FormField label="期待売上 (PQ)">
                                            <input
                                                type="number"
                                                value={mqExpectedSalesPQ === '' ? '' : mqExpectedSalesPQ}
                                                onChange={e => {
                                                    const v = e.target.value;
                                                    setMqExpectedSalesPQ(v === '' ? '' : Number(v));
                                                }}
                                                className="w-full rounded-md border-slate-300 dark:border-slate-600 text-right"
                                                placeholder="例）1000000"
                                                disabled={isDisabled}
                                            />
                                        </FormField>
                                        <FormField label="期待限界利益 (MQ)">
                                            <input
                                                type="number"
                                                value={mqExpectedMarginMQ === '' ? '' : mqExpectedMarginMQ}
                                                onChange={e => {
                                                    const v = e.target.value;
                                                    setMqExpectedMarginMQ(v === '' ? '' : Number(v));
                                                }}
                                                className="w-full rounded-md border-slate-300 dark:border-slate-600 text-right"
                                                placeholder="例）400000"
                                                disabled={isDisabled}
                                            />
                                        </FormField>
                                        <div className="space-y-1 text-sm">
                                            <div className="text-slate-500 dark:text-slate-400">m率 (MQ ÷ PQ)</div>
                                            <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                                                {mqMRate === null ? '- %' : `${mqMRate.toFixed(1)}%`}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle>最終確認</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex justify-between text-sm"><span className="text-slate-500">サプライヤー:</span> <span className="font-medium">{invoice.supplierName}</span></div>
                                <div className="flex justify-between text-sm"><span className="text-slate-500">請求書発行日:</span> <span className="font-medium">{invoice.invoiceDate}</span></div>
                                <div className="flex justify-between text-sm"><span className="text-slate-500">申請部門:</span> <span className="font-medium">{departments.find(d => d.id === departmentId)?.name || '未選択'}</span></div>
                                <div className="flex justify-between text-lg font-bold pt-3 border-t dark:border-slate-700 mt-3"><span className="text-slate-600 dark:text-slate-300">合計申請金額 (税込):</span> <span>¥{Math.round(computedTotals.gross).toLocaleString()}</span></div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {error && <p className="mt-4 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-3" role="alert">{error}</p>}

                <footer className="mt-8 flex justify-between items-center">
                    <button type="button" onClick={() => setCurrentStep(s => Math.max(1, s - 1))} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-100 font-semibold disabled:opacity-50" disabled={isDisabled || currentStep === 1}>
                        <ArrowLeft className="w-4 h-4" /> 戻る
                    </button>
                    <div className="flex items-center gap-3">
                        <button type="button" onClick={handleSaveDraft} className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200 font-semibold flex items-center gap-2 disabled:opacity-50" disabled={isDisabled}>
                            {isSavingDraft ? <Loader className="w-4 h-4 animate-spin" /> : '下書き保存'}
                        </button>
                        {currentStep < 3 ? (
                            <button type="button" onClick={() => setCurrentStep(s => Math.min(3, s + 1))} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold disabled:opacity-50" disabled={isDisabled}>
                                次へ <ArrowRight className="w-4 h-4" />
                            </button>
                        ) : (
                            <button type="submit" className="px-6 py-2 rounded-lg bg-blue-600 text-white font-semibold flex items-center justify-center gap-2 disabled:bg-slate-400" disabled={isDisabled}>
                                {isSubmitting ? <Loader className="w-4 h-4 animate-spin" /> : '申請を送信する'}
                            </button>
                        )}
                    </div>
                </footer>
            </form>
            {ConfirmationDialog}
        </div>
    );
};

// --- CHILD COMPONENTS ---

const UploadZone: React.FC<{
    onFileUpload: (files: FileList | null) => void;
    isLoading: boolean;
    isAIOff: boolean;
    sourceFile?: { name: string; url: string; type: string };
}> = ({ onFileUpload, isLoading, isAIOff, sourceFile }) => {
    const [isDragging, setIsDragging] = useState(false);

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        if (!isLoading && !isAIOff) setIsDragging(true);
    };
    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
    };
    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
        onFileUpload(e.dataTransfer.files);
    };
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onFileUpload(e.target.files);
        e.target.value = ''; // Reset input
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${isDragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/50' : 'border-slate-300 dark:border-slate-600 hover:border-slate-400'
                    } ${(isLoading || isAIOff) && 'opacity-50 cursor-not-allowed'}`}
            >
                <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
                    <Upload className="w-10 h-10 mb-4 text-slate-500 dark:text-slate-400" />
                    <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">クリックしてアップロード、またはドラッグ＆ドロップ</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">PDF, PNG, JPG (MAX. 10MB)</p>
                </div>
                <input id="dropzone-file" type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleFileChange} disabled={isLoading || isAIOff} accept="application/pdf,image/png,image/jpeg" />
                {isLoading && (
                    <div className="absolute inset-0 bg-white/70 dark:bg-slate-900/70 flex flex-col items-center justify-center rounded-lg">
                        <Loader className="w-8 h-8 animate-spin text-blue-600" />
                        <p className="mt-2 text-sm font-semibold text-blue-600">AI-OCRが解析中...</p>
                    </div>
                )}
                {isAIOff && (
                    <div className="absolute inset-0 bg-white/70 dark:bg-slate-900/70 flex items-center justify-center rounded-lg">
                        <p className="text-sm font-semibold text-rose-600">AI機能が無効です</p>
                    </div>
                )}
            </div>
            <div className="h-64 bg-slate-100 dark:bg-slate-900/50 rounded-lg flex items-center justify-center border dark:border-slate-700">
                {sourceFile ? (
                    sourceFile.type.startsWith('image/') ? (
                        <img src={sourceFile.url} alt={sourceFile.name} className="max-h-full max-w-full object-contain rounded-md" />
                    ) : (
                        <div className="text-center p-4">
                            <FileText className="w-16 h-16 mx-auto text-slate-500" />
                            <p className="mt-2 font-semibold text-slate-700 dark:text-slate-200">{sourceFile.name}</p>
                            <p className="text-xs text-slate-500">{sourceFile.type}</p>
                        </div>
                    )
                ) : (
                    <div className="text-center text-slate-500">
                        <FileText className="w-16 h-16 mx-auto" />
                        <p className="mt-2">プレビューエリア</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const LineItemTable: React.FC<{
    lines: ExpenseLine[];
    onLineChange: (lineId: string, field: keyof ExpenseLine, value: any) => void;
    onAddLine: () => void;
    onRemoveLine: (lineId: string) => void;
    isDisabled: boolean;
    customers: Customer[];
    jobs: Job[];
}> = ({ lines, onLineChange, onAddLine, onRemoveLine, isDisabled, customers, jobs }) => {
    return (
        <div className="flow-root">
            <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
                <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                        <thead>
                            <tr>
                                <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-slate-900 dark:text-white sm:pl-0">品名</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900 dark:text-white">日付</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900 dark:text-white">顧客</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900 dark:text-white">プロジェクト</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900 dark:text-white">金額(税抜)</th>
                                <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-0"><span className="sr-only">削除</span></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {lines.map(line => (
                                <tr key={line.id} className={line.ocrExtracted ? 'bg-yellow-50 dark:bg-yellow-500/10' : ''}>
                                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-0">
                                        <input type="text" value={line.description} onChange={e => onLineChange(line.id, 'description', e.target.value)} className="w-full rounded-md border-slate-300 dark:border-slate-600" disabled={isDisabled} />
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                                        <input type="date" value={line.lineDate} onChange={e => onLineChange(line.id, 'lineDate', e.target.value)} className="w-full rounded-md border-slate-300 dark:border-slate-600" disabled={isDisabled} />
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                                        <select value={line.customerId} onChange={e => onLineChange(line.id, 'customerId', e.target.value)} className="w-full rounded-md border-slate-300 dark:border-slate-600" disabled={isDisabled}>
                                            <option value="">顧客を選択</option>
                                            {customers.map(c => <option key={c.id} value={c.id}>{c.customerName}</option>)}
                                        </select>
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                                        <select value={line.projectId} onChange={e => onLineChange(line.id, 'projectId', e.target.value)} className="w-full rounded-md border-slate-300 dark:border-slate-600" disabled={isDisabled || !line.customerId}>
                                            <option value="">{line.customerId ? "プロジェクトを選択" : "先に顧客を選択"}</option>
                                            {jobs.filter(j => j.customerId === line.customerId).map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                                        </select>
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                                        <input type="number" value={line.amountExclTax} onChange={e => onLineChange(line.id, 'amountExclTax', numberFromInput(e.target.value))} className="w-full text-right rounded-md border-slate-300 dark:border-slate-600" disabled={isDisabled} />
                                    </td>
                                    <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-0">
                                        <button type="button" onClick={() => onRemoveLine(line.id)} className="text-slate-500 hover:text-rose-600 disabled:opacity-50" disabled={isDisabled}>
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="mt-4">
                        <button type="button" onClick={onAddLine} className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-50" disabled={isDisabled}>
                            <PlusCircle className="w-5 h-5" />
                            明細行を追加
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExpenseReimbursementForm;
