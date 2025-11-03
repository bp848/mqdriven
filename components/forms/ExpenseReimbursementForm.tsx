import React, { useState, useMemo, useEffect } from 'react';
import { submitApplication } from '../../services/dataService.ts';
import { extractInvoiceDetails } from '../../services/geminiService.ts';
import ApprovalRouteSelector from './ApprovalRouteSelector.tsx';
import AccountItemSelect from './AccountItemSelect.tsx';
import PaymentRecipientSelect from './PaymentRecipientSelect.tsx';
import DepartmentSelect from './DepartmentSelect.tsx';
import CustomerSearchSelect from './CustomerSearchSelect.tsx';
import ProjectSelect from './ProjectSelect.tsx';
import { Loader, Upload, PlusCircle, Trash2, AlertTriangle } from '../Icons.tsx';
import { User, InvoiceData, Customer, AccountItem, Department, AllocationDivision, Project, PaymentRecipient, MQCode } from '../../types.ts';

interface ExpenseReimbursementFormProps {
    onSuccess: () => void;
    applicationCodeId: string;
    currentUser: User | null;
    customers: Customer[];
    accountItems: AccountItem[];
    projects: Project[];
    departments: Department[];
    isAIOff: boolean;
    isLoading: boolean;
    error: string;
    allocationDivisions: AllocationDivision[];
    paymentRecipients: PaymentRecipient[];
}

interface ExpenseDetail {
    id: string;
    paymentDate: string;
    paymentRecipientId: string;
    description: string;
    allocationTargetId: string;
    costType: 'V' | 'F';
    accountItemId: string;
    allocationDivisionId: string;
    amount: number;
    customerId: string;
    projectId: string;
    mqCode: MQCode | null;
}

const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result.split(',')[1]) : reject("Read failed");
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
};

const ExpenseReimbursementForm: React.FC<ExpenseReimbursementFormProps> = ({ onSuccess, applicationCodeId, currentUser, customers, accountItems, projects, departments, isAIOff, isLoading, error: formLoadError, allocationDivisions, paymentRecipients }) => {
    const [departmentId, setDepartmentId] = useState<string>('');
    // FIX: Initialize with one empty row to prevent validation issues and improve UX.
    const [details, setDetails] = useState<ExpenseDetail[]>(() => [{
        id: `row_${Date.now()}`,
        paymentDate: new Date().toISOString().split('T')[0],
        paymentRecipientId: '',
        description: '',
        allocationTargetId: '',
        costType: 'F',
        accountItemId: '',
        allocationDivisionId: '',
        amount: 0,
        customerId: '',
        projectId: '',
        mqCode: null,
    }]);
    const [notes, setNotes] = useState('');
    const [approvalRouteId, setApprovalRouteId] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isOcrLoading, setIsOcrLoading] = useState(false);
    const [error, setError] = useState('');
    const [validationErrors, setValidationErrors] = useState<Set<string>>(new Set());
    const [duplicateWarnings, setDuplicateWarnings] = useState<Set<string>>(new Set());
    const [duplicateWarningMessage, setDuplicateWarningMessage] = useState('');

    const isDisabled = isSubmitting || isLoading || !!formLoadError;

    const totalAmount = useMemo(() => details.reduce((sum, item) => sum + (Number(item.amount) || 0), 0), [details]);

    const recipientMap = useMemo(() => new Map(paymentRecipients.map(recipient => [recipient.id, recipient])), [paymentRecipients]);
    const activeAllocationDivisions = useMemo(() => allocationDivisions.filter(div => div.isActive), [allocationDivisions]);

    const isMqCodeComplete = (mqCode: MQCode | null | undefined): boolean => {
        if (!mqCode) return false;
        return Boolean(mqCode.p && mqCode.v && mqCode.m && mqCode.q && mqCode.f && mqCode.g);
    };

    const evaluateDuplicateWarnings = (rows: ExpenseDetail[]) => {
        const duplicates = new Set<string>();
        for (let index = 1; index < rows.length; index += 1) {
            const current = rows[index];
            const previous = rows[index - 1];
            if (
                current.paymentRecipientId &&
                previous.paymentRecipientId &&
                current.paymentRecipientId === previous.paymentRecipientId &&
                current.description.trim() === previous.description.trim() &&
                current.amount === previous.amount &&
                current.paymentDate === previous.paymentDate
            ) {
                duplicates.add(previous.id);
                duplicates.add(current.id);
            }
        }
        return {
            duplicates,
            message: duplicates.size > 0 ? '同一内容の明細が連続しています。必要に応じて統合してください。' : '',
        };
    };

    useEffect(() => {
        const { duplicates, message } = evaluateDuplicateWarnings(details);
        setDuplicateWarnings(duplicates);
        setDuplicateWarningMessage(message);
    }, [details]);

    // FIX: The user reported an error on line 73. While no specific error was found, the form was incomplete.
    // I am completing the form with logic from similar components to ensure functionality.
    const isFormValid = useMemo(() => {
        if (!departmentId || !approvalRouteId || details.length === 0) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return !details.some(detail => {
            const paymentDate = detail.paymentDate ? new Date(detail.paymentDate) : null;
            const isFutureDate = paymentDate ? paymentDate.getTime() > today.getTime() : true;
            return (
                !detail.paymentDate ||
                isFutureDate ||
                !detail.paymentRecipientId ||
                !detail.description.trim() ||
                !detail.accountItemId ||
                !detail.allocationDivisionId ||
                !detail.amount || detail.amount <= 0 ||
                !detail.customerId ||
                !detail.projectId ||
                !isMqCodeComplete(detail.mqCode)
            );
        });
    }, [departmentId, approvalRouteId, details]);

    const addNewRow = () => {
        setDetails(prev => [...prev, {
            id: `row_${Date.now()}`,
            paymentDate: new Date().toISOString().split('T')[0],
            paymentRecipientId: '',
            description: '',
            allocationTargetId: '',
            costType: 'F',
            accountItemId: '',
            allocationDivisionId: '',
            amount: 0,
            customerId: '',
            projectId: '',
            mqCode: null,
        }]);
    };
    
    const updateDetail = (id: string, updates: Partial<ExpenseDetail>) => {
        setDetails(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
    };

    const handleRemoveRow = (id: string) => setDetails(prev => prev.filter(item => item.id !== id));

    const clearForm = () => {
        setDepartmentId('');
        // FIX: Re-initialize with one empty row instead of just clearing
        setDetails([{
            id: `row_${Date.now()}`,
            paymentDate: new Date().toISOString().split('T')[0],
            paymentRecipientId: '',
            description: '',
            allocationTargetId: '',
            costType: 'F',
            accountItemId: '',
            allocationDivisionId: '',
            amount: 0,
            customerId: '',
            projectId: '',
            mqCode: null,
        }]);
        setNotes('');
        setError('');
        setValidationErrors(new Set());
        setDuplicateWarnings(new Set());
        setDuplicateWarningMessage('');
    };
    
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (isAIOff) {
            setError('AI機能は現在無効です。ファイルからの読み取りはできません。');
            return;
        }

        setIsOcrLoading(true);
        setError('');
        try {
            const base64String = await readFileAsBase64(file);
            const ocrData: InvoiceData = await extractInvoiceDetails(base64String, file.type, accountItems, allocationDivisions);
            
            const matchedAccountItem = accountItems.find(item => item.name === ocrData.account);
            const matchedAllocDivision = allocationDivisions.find(div => div.name === ocrData.allocationDivision);
            const matchedCustomer = customers.find(customer => customer.customerName === ocrData.relatedCustomer);
            const matchedProject = projects.find(project => project.projectName === ocrData.project);
            const resolvedProject = matchedCustomer && matchedProject && matchedProject.customerId === matchedCustomer.id ? matchedProject : null;

            const newDetail: ExpenseDetail = {
                id: `row_ocr_${Date.now()}`,
                paymentDate: ocrData.invoiceDate || new Date().toISOString().split('T')[0],
                paymentRecipientId: '', // User needs to select this
                description: `【OCR読取: ${ocrData.vendorName}】${ocrData.description}`,
                allocationTargetId: '',
                costType: ocrData.costType || 'F',
                accountItemId: matchedAccountItem?.id || '',
                allocationDivisionId: matchedAllocDivision?.id || '',
                amount: ocrData.totalAmount || 0,
                customerId: matchedCustomer?.id || '',
                projectId: resolvedProject?.id || '',
                mqCode: matchedAccountItem?.mqCode ?? null,
            };
            setDetails(prev => [...prev, newDetail]);

        } catch (err: any) {
            if (err.name === 'AbortError') return;
            setError(err.message || 'AI-OCR処理中にエラーが発生しました。');
        } finally {
            setIsOcrLoading(false);
            e.target.value = '';
        }
    };

    const validateForm = () => {
        const errors = new Set<string>();
        if (!departmentId) errors.add('departmentId');
        if (!approvalRouteId) errors.add('approvalRouteId');
        if (details.length === 0) errors.add('details');

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        details.forEach(detail => {
            if (!detail.paymentDate) {
                errors.add(`${detail.id}-paymentDate`);
            } else {
                const paymentDate = new Date(detail.paymentDate);
                if (Number.isNaN(paymentDate.getTime()) || paymentDate.getTime() > today.getTime()) {
                    errors.add(`${detail.id}-paymentDate`);
                }
            }
            if (!detail.paymentRecipientId) errors.add(`${detail.id}-paymentRecipientId`);
            if (!detail.description.trim()) errors.add(`${detail.id}-description`);
            if (!detail.accountItemId) errors.add(`${detail.id}-accountItemId`);
            if (!detail.allocationDivisionId) errors.add(`${detail.id}-allocationDivisionId`);
            if (!detail.amount || detail.amount <= 0) errors.add(`${detail.id}-amount`);
            if (!detail.customerId) errors.add(`${detail.id}-customerId`);
            if (!detail.projectId) errors.add(`${detail.id}-projectId`);
            if (!isMqCodeComplete(detail.mqCode)) errors.add(`${detail.id}-mqCode`);
        });

        const { duplicates, message } = evaluateDuplicateWarnings(details);
        setDuplicateWarnings(duplicates);
        setDuplicateWarningMessage(message);

        return errors;
    };

    const mapDetailToPayload = (detail: ExpenseDetail) => ({
        payment_date: detail.paymentDate,
        payment_recipient_id: detail.paymentRecipientId || null,
        description: detail.description,
        account_item_id: detail.accountItemId || null,
        allocation_division_id: detail.allocationDivisionId || null,
        allocation_target_id: detail.allocationTargetId || null,
        cost_type: detail.costType,
        amount: detail.amount,
        customer_id: detail.customerId || null,
        project_id: detail.projectId || null,
        mq_code: detail.mqCode ?? null,
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const errors = validateForm();
        setValidationErrors(errors);
        
        if (errors.size > 0) {
            setError("必須項目をすべて入力してください。");
            return;
        }

        if (!currentUser) {
            setError("ユーザー情報が見つかりません。");
            return;
        }

        setIsSubmitting(true);
        setError('');
        try {
            const submissionData = {
                department_id: departmentId,
                details: details
                    .filter(d => d.description && d.amount > 0)
                    .map(mapDetailToPayload),
                notes,
                total_amount: totalAmount
            };
            await submitApplication({
                applicationCodeId,
                formData: submissionData,
                approvalRouteId
            }, currentUser.id);
            onSuccess();
        } catch (err) {
            setError(err instanceof Error ? err.message : '申請の提出に失敗しました。');
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const inputClass = "w-full text-sm bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-md p-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed";
    const hasError = (fieldId: string) => validationErrors.has(fieldId);

    // FIX: Add return statement to make this a valid React component
    return (
        <div className="relative">
             {(isLoading || formLoadError) && (
                <div className="absolute inset-0 bg-white/50 dark:bg-slate-800/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-2xl p-8" aria-live="polite" aria-busy={isLoading}>
                    {isLoading && <Loader className="w-12 h-12 animate-spin text-blue-500" aria-hidden="true" />}
                    {formLoadError && <div className="text-center"><AlertTriangle className="w-12 h-12 text-red-500 mx-auto" /><p className="mt-2 text-red-600">{formLoadError}</p></div>}
                </div>
            )}
             <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm space-y-8 animate-fade-in-up" aria-labelledby="form-title">
                <h2 id="form-title" className="text-2xl font-bold text-slate-800 dark:text-white text-center">経費精算フォーム</h2>
                 
                {formLoadError && (
                    <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert">
                        <p className="font-bold">フォーム読み込みエラー</p>
                        <p>{formLoadError}</p>
                    </div>
                )}
                
                <details className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700" open>
                    <summary className="text-base font-semibold cursor-pointer text-slate-700 dark:text-slate-200">明細書 (AI-OCR)</summary>
                    <div id="ocr-section" className="mt-4 flex items-center gap-4">
                        <label htmlFor="ocr-file-upload" className={`relative inline-flex items-center justify-center gap-2 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold py-2 px-4 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors cursor-pointer ${isOcrLoading || isAIOff || isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            {isOcrLoading ? <Loader className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                            <span>{isOcrLoading ? '解析中...' : 'ファイルから読み取り'}</span>
                            <input id="ocr-file-upload" type="file" className="sr-only" onChange={handleFileChange} accept="image/*,application/pdf" disabled={isOcrLoading || isAIOff || isDisabled} />
                        </label>
                        {isAIOff && <p className="text-sm text-red-500 dark:text-red-400">AI機能無効のため、OCR機能は利用できません。</p>}
                        {!isAIOff && <p className="text-sm text-slate-500 dark:text-slate-400">領収書ファイルを選択すると、下の表に自動で追加されます。</p>}
                    </div>
                </details>
                
                <div>
                    <label htmlFor="departmentId" className="block text-base font-semibold text-slate-700 dark:text-slate-200 mb-2">部門 *</label>
                    <DepartmentSelect
                        id="departmentId"
                        value={departmentId}
                        onChange={setDepartmentId}
                        required
                        disabled={isDisabled}
                        departments={departments}
                    />
                </div>
                
                <div>
                    <label className="block text-base font-semibold text-slate-700 dark:text-slate-200 mb-2">経費明細 *</label>
                    {duplicateWarningMessage && (
                        <div className="mb-3 flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-600 dark:bg-amber-900/30">
                            <AlertTriangle className="w-4 h-4" />
                            <span>{duplicateWarningMessage}</span>
                        </div>
                    )}
                    <div className="space-y-4">
                        {details.map((item, index) => {
                            const selectedRecipient = recipientMap.get(item.paymentRecipientId);
                            const allocationOptions = selectedRecipient?.allocationTargets ?? [];
                            const rowHasError = [
                                `${item.id}-paymentDate`,
                                `${item.id}-paymentRecipientId`,
                                `${item.id}-description`,
                                `${item.id}-amount`,
                                `${item.id}-accountItemId`,
                                `${item.id}-allocationDivisionId`,
                                `${item.id}-customerId`,
                                `${item.id}-projectId`,
                                `${item.id}-mqCode`,
                            ].some(hasError);
                            const rowHasWarning = duplicateWarnings.has(item.id);
                            const containerClass = rowHasError
                                ? 'border-red-400 bg-red-50 dark:bg-red-900/20'
                                : rowHasWarning
                                    ? 'border-amber-300 bg-amber-50 dark:bg-amber-900/20'
                                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30';

                            return (
                                <div key={item.id} className={`grid grid-cols-1 md:grid-cols-12 gap-x-4 gap-y-3 p-4 rounded-lg border ${containerClass}`}>
                                    <div className="md:col-span-2">
                                        <label className="text-xs font-semibold text-slate-500">支払日 *</label>
                                        <input
                                            type="date"
                                            value={item.paymentDate}
                                            onChange={e => updateDetail(item.id, { paymentDate: e.target.value })}
                                            className={`${inputClass} ${hasError(`${item.id}-paymentDate`) ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : ''}`}
                                            disabled={isDisabled}
                                        />
                                        {hasError(`${item.id}-paymentDate`) && (
                                            <p className="mt-1 text-[11px] text-red-600">未来日または未入力です。</p>
                                        )}
                                    </div>
                                    <div className="md:col-span-3 space-y-1">
                                        <label className="text-xs font-semibold text-slate-500">支払先 *</label>
                                        <PaymentRecipientSelect
                                            value={item.paymentRecipientId}
                                            onChange={val => updateDetail(item.id, { paymentRecipientId: val, allocationTargetId: '' })}
                                            recipients={paymentRecipients}
                                            disabled={isDisabled}
                                        />
                                        {selectedRecipient && (
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                                {[selectedRecipient.bankName, selectedRecipient.bankBranch, selectedRecipient.bankAccountNumber]
                                                    .filter(Boolean)
                                                    .join(' / ') || '銀行情報未登録'}
                                            </p>
                                        )}
                                        {hasError(`${item.id}-paymentRecipientId`) && (
                                            <p className="text-[11px] text-red-600">支払先を選択してください。</p>
                                        )}
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="text-xs font-semibold text-slate-500">振分先</label>
                                        <select
                                            value={item.allocationTargetId}
                                            onChange={e => updateDetail(item.id, { allocationTargetId: e.target.value })}
                                            className={inputClass}
                                            disabled={isDisabled || allocationOptions.length === 0}
                                        >
                                            <option value="">振分先なし</option>
                                            {allocationOptions.map(option => (
                                                <option key={option.id} value={option.id}>{option.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="md:col-span-5">
                                        <label className="text-xs font-semibold text-slate-500">内容 *</label>
                                        <input
                                            type="text"
                                            placeholder="例: 会議費用"
                                            value={item.description}
                                            onChange={e => updateDetail(item.id, { description: e.target.value })}
                                            className={`${inputClass} ${hasError(`${item.id}-description`) ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : ''}`}
                                            disabled={isDisabled}
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="text-xs font-semibold text-slate-500">金額 *</label>
                                        <input
                                            type="number"
                                            value={item.amount}
                                            onChange={e => updateDetail(item.id, { amount: Number(e.target.value) || 0 })}
                                            className={`${inputClass} text-right ${hasError(`${item.id}-amount`) ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : ''}`}
                                            disabled={isDisabled}
                                            min="1"
                                        />
                                    </div>
                                    <div className="md:col-span-3">
                                        <label className="text-xs font-semibold text-slate-500">顧客 *</label>
                                        <CustomerSearchSelect
                                            customers={customers}
                                            value={item.customerId}
                                            onChange={customerId => updateDetail(item.id, { customerId, projectId: '' })}
                                            disabled={isDisabled}
                                            required
                                        />
                                        {hasError(`${item.id}-customerId`) && (
                                            <p className="text-[11px] text-red-600">顧客を選択してください。</p>
                                        )}
                                    </div>
                                    <div className="md:col-span-3">
                                        <label className="text-xs font-semibold text-slate-500">案件 *</label>
                                        <ProjectSelect
                                            projects={projects}
                                            customerId={item.customerId}
                                            value={item.projectId}
                                            onChange={projectId => updateDetail(item.id, { projectId })}
                                            disabled={isDisabled}
                                            required
                                        />
                                        {hasError(`${item.id}-projectId`) && (
                                            <p className="text-[11px] text-red-600">案件を選択してください。</p>
                                        )}
                                    </div>
                                    <div className="md:col-span-3">
                                        <label className="text-xs font-semibold text-slate-500">勘定科目 *</label>
                                        <AccountItemSelect
                                            value={item.accountItemId}
                                            onChange={val => updateDetail(item.id, { accountItemId: val })}
                                            onSelect={selected => updateDetail(item.id, { accountItemId: selected?.id ?? '', mqCode: selected?.mqCode ?? null })}
                                            items={accountItems}
                                            disabled={isDisabled}
                                            required
                                        />
                                        {hasError(`${item.id}-accountItemId`) && (
                                            <p className="text-[11px] text-red-600">勘定科目を選択してください。</p>
                                        )}
                                    </div>
                                    <div className="md:col-span-3">
                                        <label className="text-xs font-semibold text-slate-500">MQコード *</label>
                                        <div className={`rounded-md border p-2 ${hasError(`${item.id}-mqCode`) ? 'border-red-400 bg-red-50 dark:bg-red-900/20' : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800'}`}>
                                            {item.mqCode ? (
                                                <dl className="grid grid-cols-3 gap-x-2 gap-y-1 text-xs">
                                                    {(['P', 'V', 'M', 'Q', 'F', 'G'] as const).map(label => {
                                                        const key = label.toLowerCase() as keyof MQCode;
                                                        return (
                                                            <div key={label}>
                                                                <dt className="font-semibold text-slate-500">{label}</dt>
                                                                <dd className="font-mono text-slate-800 dark:text-slate-200">{item.mqCode?.[key] || '-'}</dd>
                                                            </div>
                                                        );
                                                    })}
                                                </dl>
                                            ) : (
                                                <p className="text-[11px] text-slate-500">勘定科目を選択すると自動表示されます。</p>
                                            )}
                                        </div>
                                        {hasError(`${item.id}-mqCode`) && (
                                            <p className="text-[11px] text-red-600">MQコードの定義が不足しています。</p>
                                        )}
                                    </div>
                                    <div className="md:col-span-3">
                                        <label className="text-xs font-semibold text-slate-500">区分 *</label>
                                        <select
                                            value={item.allocationDivisionId}
                                            onChange={e => updateDetail(item.id, { allocationDivisionId: e.target.value })}
                                            className={`${inputClass} ${hasError(`${item.id}-allocationDivisionId`) ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : ''}`}
                                            disabled={isDisabled}
                                        >
                                            <option value="">区分選択</option>
                                            {activeAllocationDivisions.map(d => (
                                                <option key={d.id} value={d.id}>{d.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="text-xs font-semibold text-slate-500">費用種別</label>
                                        <select
                                            value={item.costType}
                                            onChange={e => updateDetail(item.id, { costType: e.target.value as 'V' | 'F' })}
                                            className={inputClass}
                                            disabled={isDisabled}
                                        >
                                            <option value="F">固定費(F)</option>
                                            <option value="V">変動費(V)</option>
                                        </select>
                                    </div>
                                    <div className="md:col-span-1 flex items-end justify-center">
                                        <button type="button" onClick={() => handleRemoveRow(item.id)} className="p-1 text-slate-400 hover:text-red-500" disabled={isDisabled}>
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                    {rowHasWarning && (
                                        <div className="md:col-span-12 flex items-center gap-1 text-[11px] text-amber-700">
                                            <AlertTriangle className="w-3.5 h-3.5" />
                                            <span>直前の明細と内容が重複しています。</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                        <button type="button" onClick={addNewRow} className="flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700" disabled={isDisabled}>
                            <PlusCircle className="w-4 h-4" /> 行を追加
                        </button>
                        <div className="text-right">
                            <span className="text-sm text-slate-500 dark:text-slate-400">合計金額: </span>
                            <span className="text-xl font-bold text-slate-800 dark:text-white">¥{totalAmount.toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                <div>
                    <label htmlFor="notes" className="block text-base font-semibold text-slate-700 dark:text-slate-200 mb-2">備考</label>
                    <textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} rows={3} className={inputClass} placeholder="補足事項があれば入力してください。" disabled={isDisabled} />
                </div>
                
                <ApprovalRouteSelector onChange={setApprovalRouteId} isSubmitting={isDisabled} requiredRouteName="社長決裁ルート" />

                {error && <p className="text-red-500 text-sm bg-red-100 dark:bg-red-900/50 p-3 rounded-lg">{error}</p>}
                
                <div className="flex justify-end gap-4 pt-6 border-t border-slate-200 dark:border-slate-700">
                    <button type="button" onClick={clearForm} className="bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold py-2 px-4 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600" disabled={isDisabled}>内容をクリア</button>
                    <button type="button" className="bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold py-2 px-4 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600" disabled={isDisabled}>下書き保存</button>
                    <button type="submit" className="w-40 flex justify-center items-center bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-blue-700 disabled:bg-slate-400" disabled={isDisabled || !isFormValid}>
                        {isSubmitting ? <Loader className="w-5 h-5 animate-spin" /> : '申請を送信する'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ExpenseReimbursementForm;
