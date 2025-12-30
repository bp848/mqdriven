import React, { useEffect, useMemo, useState } from 'react';
import { Estimate, SortConfig, EmployeeUser, Customer, Toast, EstimateStatus, EstimateDetail } from '../../types';
import SortableHeader from '../ui/SortableHeader';
import EmptyState from '../ui/EmptyState';
import { FileText, PlusCircle, Pencil, X, Loader, Save } from '../Icons';
import { formatJPY, formatDate } from '../../utils';
import EstimateDetailModal from './EstimateDetailModal';
import { addEstimateDetail, deleteEstimateDetail, getEstimateDetails, updateEstimateDetail } from '../../services/dataService';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
} from 'recharts';

type TabKey = 'list' | 'detail' | 'analysis';
type MqFilter = 'all' | 'OK' | 'A' | 'B';

type EstimateFormState = {
    id?: string;
    projectId: string;
    patternNo: string;
    patternName: string;
    specification: string;
    copies: number;
    unitPrice: number;
    taxRate: number;
    deliveryPlace: string;
    transactionMethod: string;
    deliveryDate: string;
    expirationDate: string;
    note: string;
    status: EstimateStatus;
};

interface EstimateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (estimate: Partial<Estimate>) => Promise<void>;
    estimateToEdit?: Estimate | null;
    currentUser: EmployeeUser | null;
    isSaving: boolean;
}

interface EstimateManagementPageProps {
  estimates: Estimate[];
  estimateTotalCount: number;
  estimatePage: number;
  estimatePageSize: number;
  onEstimatePageChange: (page: number) => void | Promise<void>;
  customers: Customer[];
  allUsers: EmployeeUser[];
  onAddEstimate: (estimate: Partial<Estimate>) => Promise<void>;
  addToast: (message: string, type: Toast['type']) => void;
  currentUser: EmployeeUser | null;
  searchTerm: string;
  isAIOff: boolean;
}

const buildDefaultForm = (): EstimateFormState => ({
    projectId: '',
    patternNo: '',
    patternName: '',
    specification: '',
    copies: 0,
    unitPrice: 0,
    taxRate: 10,
    deliveryPlace: '',
    transactionMethod: '',
    deliveryDate: '',
    expirationDate: '',
    note: '',
    status: EstimateStatus.Draft,
});

const statusOptions: { value: EstimateStatus; label: string }[] = [
    { value: EstimateStatus.Draft, label: '見積中' },
    { value: EstimateStatus.Ordered, label: '受注' },
    { value: EstimateStatus.Lost, label: '失注' },
];

const statusBadgeStyle: Record<string, string> = {
    [EstimateStatus.Draft]: 'bg-slate-100 text-slate-700',
    [EstimateStatus.Ordered]: 'bg-green-100 text-green-700',
    [EstimateStatus.Lost]: 'bg-red-100 text-red-700',
    ordered: 'bg-green-100 text-green-700',
    lost: 'bg-red-100 text-red-700',
    draft: 'bg-slate-100 text-slate-700',
    submitted: 'bg-blue-100 text-blue-700',
};

const chartColors = ['#2563eb', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];

const EstimateModal: React.FC<EstimateModalProps> = ({ isOpen, onClose, onSave, estimateToEdit, currentUser, isSaving }) => {
    const [form, setForm] = useState<EstimateFormState>(buildDefaultForm());
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        if (estimateToEdit) {
            setForm({
                id: estimateToEdit.id,
                projectId: estimateToEdit.projectId ?? '',
                patternNo: estimateToEdit.patternNo ?? (estimateToEdit.estimateNumber ? String(estimateToEdit.estimateNumber) : ''),
                patternName: estimateToEdit.title ?? '',
                specification: estimateToEdit.deliveryTerms ?? estimateToEdit.notes ?? '',
                copies: estimateToEdit.copies ?? estimateToEdit.items?.[0]?.quantity ?? 0,
                unitPrice: estimateToEdit.unitPrice ?? estimateToEdit.items?.[0]?.unitPrice ?? 0,
                taxRate: estimateToEdit.taxRate ?? 10,
                deliveryPlace: estimateToEdit.deliveryMethod ?? '',
                transactionMethod: estimateToEdit.paymentTerms ?? '',
                deliveryDate: estimateToEdit.deliveryDate ?? '',
                expirationDate: estimateToEdit.expirationDate ?? '',
                note: estimateToEdit.notes ?? '',
                status: estimateToEdit.status ?? EstimateStatus.Draft,
            });
        } else {
            setForm(buildDefaultForm());
        }
        setError('');
    }, [isOpen, estimateToEdit]);

    const subtotal = useMemo(() => {
        const value = Math.round((form.copies || 0) * (form.unitPrice || 0));
        return Number.isFinite(value) ? value : 0;
    }, [form.copies, form.unitPrice]);

    const taxAmount = useMemo(() => {
        const value = Math.floor(subtotal * ((form.taxRate || 0) / 100));
        return Number.isFinite(value) ? value : 0;
    }, [subtotal, form.taxRate]);

    const total = useMemo(() => subtotal + taxAmount, [subtotal, taxAmount]);

    const handleChange = (field: keyof EstimateFormState, value: string | number) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.patternName.trim()) {
            setError('パターン名（件名）を入力してください。');
            return;
        }
        const payload: Partial<Estimate> = {
            id: form.id,
            projectId: form.projectId || null,
            patternNo: form.patternNo || null,
            title: form.patternName,
            deliveryTerms: form.specification,
            deliveryMethod: form.deliveryPlace,
            paymentTerms: form.transactionMethod,
            deliveryDate: form.deliveryDate || null,
            expirationDate: form.expirationDate || null,
            notes: form.note,
            status: form.status,
            version: Number(form.patternNo) || 1,
            userId: currentUser?.id ?? estimateToEdit?.userId ?? '',
            createdAt: estimateToEdit?.createdAt ?? new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            subtotal,
            taxRate: form.taxRate,
            consumption: taxAmount,
            total,
            grandTotal: total,
            estimateNumber: Number(form.patternNo || estimateToEdit?.estimateNumber || Date.now()),
            customerName: form.projectId ? `案件${form.projectId}` : estimateToEdit?.customerName ?? '未設定',
            items: [
                {
                    division: 'その他',
                    content: form.specification || form.patternName,
                    quantity: form.copies,
                    unit: '式',
                    unitPrice: form.unitPrice,
                    price: subtotal,
                    cost: 0,
                    costRate: 0,
                    subtotal,
                },
            ],
        };
        try {
            await onSave(payload);
        } catch (err: any) {
            setError(err?.message || '保存に失敗しました。');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-700">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{form.id ? '見積を編集' : '新規見積作成'}</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X className="w-6 h-6" /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
                    {error && <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg p-3 text-sm">{error}</div>}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold mb-1">案件ID</label>
                            <input value={form.projectId} onChange={e => handleChange('projectId', e.target.value)} className="w-full border rounded-lg px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="例: 12345" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold mb-1">パターンNo</label>
                            <input value={form.patternNo} onChange={e => handleChange('patternNo', e.target.value)} className="w-full border rounded-lg px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold mb-1">パターン名 / 件名 *</label>
                            <input value={form.patternName} onChange={e => handleChange('patternName', e.target.value)} className="w-full border rounded-lg px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold mb-1">仕様</label>
                            <input value={form.specification} onChange={e => handleChange('specification', e.target.value)} className="w-full border rounded-lg px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-semibold mb-1">部数</label>
                            <input type="number" value={form.copies} onChange={e => handleChange('copies', Number(e.target.value))} className="w-full border rounded-lg px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold mb-1">単価</label>
                            <input type="number" value={form.unitPrice} onChange={e => handleChange('unitPrice', Number(e.target.value))} className="w-full border rounded-lg px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold mb-1">消費税率 (%)</label>
                            <input type="number" value={form.taxRate} onChange={e => handleChange('taxRate', Number(e.target.value))} className="w-full border rounded-lg px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-semibold mb-1">納品場所</label>
                            <input value={form.deliveryPlace} onChange={e => handleChange('deliveryPlace', e.target.value)} className="w-full border rounded-lg px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold mb-1">取引条件</label>
                            <input value={form.transactionMethod} onChange={e => handleChange('transactionMethod', e.target.value)} className="w-full border rounded-lg px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold mb-1">納品日</label>
                            <input type="date" value={form.deliveryDate} onChange={e => handleChange('deliveryDate', e.target.value)} className="w-full border rounded-lg px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-semibold mb-1">有効期限</label>
                            <input type="date" value={form.expirationDate} onChange={e => handleChange('expirationDate', e.target.value)} className="w-full border rounded-lg px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold mb-1">ステータス</label>
                            <select value={form.status} onChange={e => handleChange('status', e.target.value as EstimateStatus)} className="w-full border rounded-lg px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
                                {statusOptions.map(option => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold mb-1">備考</label>
                            <input value={form.note} onChange={e => handleChange('note', e.target.value)} className="w-full border rounded-lg px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 rounded-xl p-4 border border-slate-200">
                        <div>
                            <p className="text-sm text-slate-500">小計</p>
                            <p className="text-lg font-semibold">{formatJPY(subtotal)}</p>
                        </div>
                        <div>
                            <p className="text-sm text-slate-500">消費税</p>
                            <p className="text-lg font-semibold">{formatJPY(taxAmount)}</p>
                        </div>
                        <div>
                            <p className="text-sm text-slate-500">合計</p>
                            <p className="text-lg font-semibold">{formatJPY(total)}</p>
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg font-semibold">キャンセル</button>
                        <button type="submit" disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-60">
                            {isSaving ? <Loader className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                            {isSaving ? '保存中...' : '保存する'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const EstimateManagementPage: React.FC<EstimateManagementPageProps> = ({
    estimates,
    estimateTotalCount,
    estimatePage,
    estimatePageSize,
    onEstimatePageChange,
    customers: _customers,
    allUsers: _allUsers,
    onAddEstimate,
    addToast,
    currentUser,
    searchTerm,
    isAIOff: _isAIOff,
}) => {
    const [sortConfig, setSortConfig] = useState<SortConfig | null>(null); // respect backend default (納品日 desc -> MQ優先)
    const [mqFilter, setMqFilter] = useState<MqFilter>('all');
    const [selectedEstimate, setSelectedEstimate] = useState<Estimate | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<TabKey>('list');
    const [detailSubTab, setDetailSubTab] = useState<'overview' | 'details' | 'anomalies'>('overview');
    const [details, setDetails] = useState<EstimateDetail[]>([]);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState<string | null>(null);
    const [editingDetailId, setEditingDetailId] = useState<string | null>(null);
    const [detailForm, setDetailForm] = useState<Partial<EstimateDetail>>({
        itemName: '',
        quantity: null,
        unitPrice: null,
        amount: null,
        variableCost: null,
        note: '',
    });
    const totalPages = useMemo(() => Math.max(1, Math.ceil((estimateTotalCount || 0) / estimatePageSize)), [estimateTotalCount, estimatePageSize]);
    const pageStart = useMemo(() => estimateTotalCount > 0 ? (estimatePageSize * (estimatePage - 1)) + 1 : 0, [estimatePage, estimatePageSize, estimateTotalCount]);
    const pageEnd = useMemo(() => estimateTotalCount > 0 ? Math.min(estimateTotalCount, estimatePage * estimatePageSize) : 0, [estimatePage, estimatePageSize, estimateTotalCount]);

    const filteredEstimates = useMemo(() => {
        let rows = estimates;
        if (mqFilter !== 'all') {
            rows = rows.filter(est => (est.mqMissingReason ?? 'OK') === mqFilter);
        }
        if (!searchTerm) return rows;
        const query = searchTerm.toLowerCase();
        return rows.filter(est =>
            (est.title && est.title.toLowerCase().includes(query)) ||
            (est.projectId && est.projectId.toLowerCase().includes(query)) ||
            (est.patternNo && est.patternNo.toLowerCase().includes(query)) ||
            (est.notes && est.notes.toLowerCase().includes(query))
        );
    }, [estimates, searchTerm, mqFilter]);

    const resolveSalesAmount = (est: Estimate): number | null => {
        const candidates = [est.salesAmount, est.subtotal, est.total];
        for (const candidate of candidates) {
            if (candidate === null || candidate === undefined) continue;
            const num = Number(candidate);
            if (Number.isFinite(num)) return num;
        }
        return null;
    };

    const resolveVariableCost = (est: Estimate): number | null => {
        if (est.variableCostAmount === null || est.variableCostAmount === undefined) return null;
        const num = Number(est.variableCostAmount);
        return Number.isFinite(num) ? num : null;
    };

    const resolveMqAmount = (est: Estimate, salesAmount?: number | null, variableCost?: number | null): number | null => {
        if (est.mqAmount !== undefined && est.mqAmount !== null && Number.isFinite(Number(est.mqAmount))) {
            return Number(est.mqAmount);
        }
        const sales = salesAmount ?? resolveSalesAmount(est);
        const cost = variableCost ?? resolveVariableCost(est);
        if (sales !== null && cost !== null) {
            const mq = sales - cost;
            return Number.isFinite(mq) ? mq : null;
        }
        return null;
    };

    const resolveMqRate = (est: Estimate, salesAmount?: number | null, mqAmount?: number | null): number | null => {
        if (est.mqRate !== undefined && est.mqRate !== null && Number.isFinite(Number(est.mqRate))) {
            return Number(est.mqRate);
        }
        const sales = salesAmount ?? resolveSalesAmount(est);
        const mq = mqAmount ?? resolveMqAmount(est, sales, resolveVariableCost(est));
        if (sales && sales > 0 && mq !== null) {
            const rate = mq / sales;
            return Number.isFinite(rate) ? rate : null;
        }
        return null;
    };

    const formatRate = (rate: number | null | undefined) => {
        if (rate === null || rate === undefined || !Number.isFinite(rate)) return '—';
        return `${(rate * 100).toFixed(1)}%`;
    };

    const getSortValue = (estimate: Estimate, key: string) => {
        if (key === 'deliveryDate' || key === 'createdAt' || key === 'updatedAt') {
            const raw = (estimate as any)[key] as string | undefined;
            if (!raw) return null;
            const ts = new Date(raw).getTime();
            return Number.isFinite(ts) ? ts : null;
        }
        if (key === 'salesAmount') return resolveSalesAmount(estimate);
        if (key === 'variableCostAmount') return resolveVariableCost(estimate);
        if (key === 'mqAmount') return resolveMqAmount(estimate);
        if (key === 'mqRate') return resolveMqRate(estimate);
        if (key === 'mqMissingReason') {
            const priority: Record<string, number> = { OK: 0, A: 1, B: 2 };
            const reason = (estimate.mqMissingReason ?? 'OK') as string;
            return priority[reason] ?? 99;
        }
        if (key === 'statusLabel') {
            const priority: Record<string, number> = { ordered: 0, draft: 1, submitted: 2, lost: 3 };
            const normalized = (estimate.statusLabel ?? estimate.status ?? '').toString().toLowerCase();
            return priority[normalized] ?? 99;
        }
        return (estimate as any)[key] ?? null;
    };

    const changePage = (nextPage: number) => {
        const clamped = Math.max(1, Math.min(totalPages, nextPage));
        onEstimatePageChange(clamped);
    };

    const sortedEstimates = useMemo(() => {
        const sortable = [...filteredEstimates];
        if (sortConfig) {
            sortable.sort((a, b) => {
                const aVal = getSortValue(a, sortConfig.key);
                const bVal = getSortValue(b, sortConfig.key);
                if (aVal === undefined || aVal === null) return 1;
                if (bVal === undefined || bVal === null) return -1;
                if (aVal < bVal) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return sortable;
    }, [filteredEstimates, sortConfig]);

    useEffect(() => {
        if (!selectedEstimate && sortedEstimates.length > 0) {
            setSelectedEstimate(sortedEstimates[0]);
        }
    }, [sortedEstimates, selectedEstimate]);

    useEffect(() => {
        const loadDetails = async () => {
            if (!selectedEstimate?.id) {
                setDetails([]);
                return;
            }
            setDetailLoading(true);
            setDetailError(null);
            try {
                const rows = await getEstimateDetails(selectedEstimate.id);
                setDetails(rows);
            } catch (e: any) {
                setDetailError(e?.message || '明細の取得に失敗しました。');
            } finally {
                setDetailLoading(false);
            }
        };
        loadDetails();
    }, [selectedEstimate?.id]);

    const statusSummary = useMemo(() => {
        const base = {
            [EstimateStatus.Draft]: { count: 0, total: 0 },
            [EstimateStatus.Ordered]: { count: 0, total: 0 },
            [EstimateStatus.Lost]: { count: 0, total: 0 },
        };
        for (const est of filteredEstimates) {
            const bucket = base[est.status] || base[EstimateStatus.Draft];
            bucket.count += 1;
            bucket.total += est.total || 0;
        }
        return base;
    }, [filteredEstimates]);
    const pageTotalAmount = useMemo(() => filteredEstimates.reduce((sum, est) => sum + (resolveSalesAmount(est) ?? 0), 0), [filteredEstimates]);
    const mqMissingSummary = useMemo(() => {
        const base = { OK: 0, A: 0, B: 0 };
        for (const est of estimates) {
            const reason = (est.mqMissingReason ?? 'OK') as 'OK' | 'A' | 'B';
            if (reason === 'OK' || reason === 'A' || reason === 'B') {
                base[reason] += 1;
            }
        }
        return base;
    }, [estimates]);

    const detailTotals = useMemo(() => {
        let sales = 0;
        let variableCost = 0;
        let hasSales = false;
        let hasCost = false;
        for (const row of details) {
            if (row.amount !== null && row.amount !== undefined) {
                sales += row.amount || 0;
                hasSales = true;
            }
            if (row.variableCost !== null && row.variableCost !== undefined) {
                variableCost += row.variableCost || 0;
                hasCost = true;
            }
        }
        const mq = hasSales && hasCost ? sales - variableCost : null;
        const rate = mq !== null && sales > 0 ? mq / sales : null;
        return {
            sales: hasSales ? sales : null,
            variableCost: hasCost ? variableCost : null,
            mq,
            rate,
        };
    }, [details]);

    const monthlyTotals = useMemo(() => {
        const buckets = new Map<string, { name: string; total: number; count: number }>();
        for (const est of filteredEstimates) {
            const date = est.deliveryDate || est.createdAt;
            if (!date) continue;
            const d = new Date(date);
            if (Number.isNaN(d.getTime())) continue;
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const label = `${d.getFullYear()}年${String(d.getMonth() + 1).padStart(2, '0')}月`;
            const bucket = buckets.get(key) ?? { name: label, total: 0, count: 0 };
            bucket.total += resolveSalesAmount(est) ?? 0;
            bucket.count += 1;
            buckets.set(key, bucket);
        }
        return Array.from(buckets.entries())
            .sort((a, b) => (a[0] < b[0] ? -1 : 1))
            .map(([, value]) => value);
    }, [filteredEstimates]);

    const handleSaveEstimate = async (estimateData: Partial<Estimate>) => {
        setIsSaving(true);
        try {
            await onAddEstimate(estimateData);
            addToast('見積を保存しました。', 'success');
            setIsModalOpen(false);
            setSelectedEstimate(null);
            setActiveTab('list');
        } catch (e: any) {
            const message = e?.message || '保存に失敗しました。';
            addToast(message, 'error');
            throw e instanceof Error ? e : new Error(message);
        } finally {
            setIsSaving(false);
        }
    };

    const requestSort = (key: string) => {
        const direction = sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending' ? 'descending' : 'ascending';
        setSortConfig({ key, direction });
    };

    const renderStatusBadge = (status?: string | EstimateStatus | null) => {
        const text = (status ?? '').toString();
        const normalized = text.toLowerCase();
        const className = statusBadgeStyle[normalized] || statusBadgeStyle[text] || 'bg-slate-100 text-slate-700';
        const display =
            normalized === 'ordered' ? '受注'
            : normalized === 'lost' ? '失注'
            : normalized === 'draft' ? '見積中'
            : normalized === 'submitted' ? '提出'
            : text || '—';
        return (
            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${className}`}>
                {display}
            </span>
        );
    };

    const renderMqMissingBadge = (reason?: string | null) => {
        const key = (reason ?? 'OK') as 'OK' | 'A' | 'B';
        const labelMap: Record<'OK' | 'A' | 'B', string> = {
            OK: 'MQ計算済',
            A: '明細なし',
            B: '原価未入力',
        };
        const styleMap: Record<'OK' | 'A' | 'B', string> = {
            OK: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            A: 'bg-rose-50 text-rose-700 border-rose-200',
            B: 'bg-amber-50 text-amber-800 border-amber-200',
        };
        return (
            <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${styleMap[key]}`}>
                {labelMap[key]}
            </span>
        );
    };

    const renderMqFilterCard = (reason: 'OK' | 'A' | 'B', title: string, sub: string, accentClass: string) => {
        const active = mqFilter === reason;
        const count = mqMissingSummary[reason] ?? 0;
        return (
            <button
                type="button"
                onClick={() => setMqFilter(active ? 'all' : reason)}
                className={`text-left rounded-2xl border p-4 shadow-sm transition bg-slate-800/60 border-slate-700 text-slate-50 ${active ? 'ring-2 ring-blue-400 border-blue-300 bg-slate-800/80' : 'hover:border-slate-500'}`}
            >
                <p className={`text-xs uppercase tracking-[0.18em] ${accentClass}`}>{title}</p>
                <p className="text-3xl font-extrabold mt-1 tracking-tight">{count} 件</p>
                <p className="text-xs mt-1 text-slate-300">{active ? 'フィルタ中（クリックで解除）' : sub}</p>
            </button>
        );
    };

    const formatValue = (value: any) => {
        if (value === null || value === undefined || value === '') return '—';
        if (typeof value === 'number') return Number.isFinite(value) ? value.toLocaleString() : '—';
        if (value instanceof Date) return formatDate(value.toISOString());
        if (typeof value === 'string') return value;
        return JSON.stringify(value);
    };

    const renderFieldGrid = (raw: Record<string, any>, fields: { key: string; label: string; formatter?: (v: any) => string; editable?: boolean; }[]) => (
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            {fields.map(field => (
                <div key={field.key} className="flex justify-between gap-3">
                    <dt className="text-slate-500 whitespace-nowrap">{field.label}</dt>
                    <dd className="text-right flex-1 text-slate-800 dark:text-slate-100">
                        {field.formatter ? field.formatter(raw[field.key]) : formatValue(raw[field.key])}
                    </dd>
                </div>
            ))}
        </dl>
    );

    const handleDetailInputChange = (field: keyof EstimateDetail, value: string) => {
        setDetailForm(prev => ({
            ...prev,
            [field]: value === '' ? null : value,
        }));
    };

    const resetDetailForm = () => {
        setDetailForm({
            itemName: '',
            quantity: null,
            unitPrice: null,
            amount: null,
            variableCost: null,
            note: '',
        });
        setEditingDetailId(null);
    };

    const normalizeNumber = (val: any): number | null => {
        const num = Number(val);
        return Number.isFinite(num) ? num : null;
    };

    const buildDetailPayload = () => {
        const quantity = normalizeNumber(detailForm.quantity);
        const unitPrice = normalizeNumber(detailForm.unitPrice);
        const amount = normalizeNumber(detailForm.amount) ?? (quantity !== null && unitPrice !== null ? quantity * unitPrice : null);
        const variableCost = normalizeNumber(detailForm.variableCost);
        return {
            itemName: (detailForm.itemName ?? '').toString().trim(),
            quantity,
            unitPrice,
            amount,
            variableCost,
            note: detailForm.note ?? '',
        };
    };

    const refreshDetails = async (estimateId: string) => {
        const rows = await getEstimateDetails(estimateId);
        setDetails(rows);
    };

    const handleSubmitDetail = async () => {
        if (!selectedEstimate?.id) return;
        const payload = buildDetailPayload();
        if (!payload.itemName) {
            addToast('明細名を入力してください。', 'error');
            return;
        }
        if (payload.quantity === null || payload.unitPrice === null) {
            addToast('数量と単価は必須です。', 'error');
            return;
        }
        try {
            setDetailLoading(true);
            if (editingDetailId) {
                await updateEstimateDetail(editingDetailId, payload);
                addToast('明細を更新しました。', 'success');
            } else {
                await addEstimateDetail({
                    estimateId: selectedEstimate.id,
                    ...payload,
                });
                addToast('明細を追加しました。', 'success');
            }
            await refreshDetails(selectedEstimate.id);
            resetDetailForm();
        } catch (e: any) {
            addToast(e?.message || '明細の保存に失敗しました。', 'error');
        } finally {
            setDetailLoading(false);
        }
    };

    const handleEditDetail = (detail: EstimateDetail) => {
        setEditingDetailId(detail.detailId || detail.id || null);
        setDetailForm({
            itemName: detail.itemName,
            quantity: detail.quantity,
            unitPrice: detail.unitPrice,
            amount: detail.amount,
            variableCost: detail.variableCost,
            note: detail.note ?? '',
        });
        setDetailSubTab('details');
    };

    const handleDeleteDetail = async (detail: EstimateDetail) => {
        if (!detail.detailId && !detail.id) {
            addToast('この明細は削除できません。', 'error');
            return;
        }
        try {
            setDetailLoading(true);
            await deleteEstimateDetail(detail.detailId || detail.id!);
            if (selectedEstimate?.id) {
                await refreshDetails(selectedEstimate.id);
            }
            addToast('明細を削除しました。', 'success');
        } catch (e: any) {
            addToast(e?.message || '明細の削除に失敗しました。', 'error');
        } finally {
            setDetailLoading(false);
        }
    };

    const handleDuplicateEstimate = async () => {
        if (!selectedEstimate) return;
        const payload: Partial<Estimate> = {
            ...selectedEstimate,
            id: undefined,
            estimateNumber: undefined,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        try {
            await onAddEstimate(payload);
            addToast('見積を複製しました。', 'success');
        } catch (e: any) {
            addToast(e?.message || '複製に失敗しました。', 'error');
        }
    };

    const tabButtonClass = (tab: TabKey) =>
        `px-4 py-2 rounded-lg font-semibold ${activeTab === tab ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`;

    const AnalysisCard = ({ title, value, sub, tone = 'light' }: { title: string; value: string; sub?: string; tone?: 'light' | 'dark' }) => {
        const isDark = tone === 'dark';
        return (
            <div className={`rounded-2xl border p-4 shadow-sm ${isDark ? 'bg-slate-800/80 border-slate-700 text-slate-50' : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700'}`}>
                <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600 dark:text-slate-300'}`}>{title}</p>
                <p className={`text-3xl font-extrabold mt-1 tracking-tight ${isDark ? 'text-white' : 'text-slate-900 dark:text-white'}`}>{value}</p>
                {sub && <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500 dark:text-slate-400'}`}>{sub}</p>}
            </div>
        );
    };

    const mqSummaryCards = (
        <div className="rounded-2xl bg-slate-900 text-slate-50 border border-slate-800 shadow-lg mb-6 p-4 md:p-6">
            <div className="flex flex-wrap justify-between items-start gap-3 mb-4">
                <div className="flex flex-col gap-1">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-blue-300">mq会計サマリ</p>
                    <div className="flex flex-wrap items-baseline gap-3">
                        <h3 className="text-lg font-semibold">MQ優先で最新表示</h3>
                        <span className="text-sm text-slate-300">納品日 desc → MQ計算済 → MQ額 desc</span>
                    </div>
                </div>
                {mqFilter !== 'all' && (
                    <button
                        onClick={() => setMqFilter('all')}
                        className="text-xs px-3 py-1 rounded-lg border border-blue-300 text-blue-100 hover:bg-blue-800/40"
                    >
                        MQフィルタ解除
                    </button>
                )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <AnalysisCard
                    tone="dark"
                    title="表示件数 / 売上合計"
                    value={`${filteredEstimates.length} / ${estimateTotalCount} 件`}
                    sub={`売上合計: ${formatJPY(pageTotalAmount)} （フィルタ後 ${filteredEstimates.length} 件表示）`}
                />
                {renderMqFilterCard('OK', 'OK (MQ計上)', 'MQが計算できる見積だけを表示', 'text-emerald-200')}
                {renderMqFilterCard('B', '原価未入力', '原価を入力してMQを出す', 'text-amber-200')}
                {renderMqFilterCard('A', '明細なし', '明細を追加してMQを出す', 'text-rose-200')}
            </div>
        </div>
    );

    return (
        <>
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-6 flex flex-col gap-4 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-xl font-semibold">見積管理</h2>
                            <p className="text-sm text-slate-500 mt-1">一覧・詳細・分析を切り替えて確認できます。</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button onClick={() => { setSelectedEstimate(null); setIsModalOpen(true); }} className="flex items-center gap-2 bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg">
                                <PlusCircle className="w-5 h-5" />
                                新規見積作成
                            </button>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setActiveTab('list')} className={tabButtonClass('list')}>一覧</button>
                        <button onClick={() => setActiveTab('detail')} className={tabButtonClass('detail')}>詳細</button>
                        <button onClick={() => setActiveTab('analysis')} className={tabButtonClass('analysis')}>分析</button>
                    </div>
                </div>

                {activeTab === 'list' && (
                    <div className="p-6 space-y-6">
                        {mqSummaryCards}
                        <div className="overflow-x-auto">
                            <table className="w-full text-base text-left text-slate-800 dark:text-slate-100">
                                <thead className="text-sm uppercase bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-100">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 font-medium">見積 / パターン</th>
                                        <SortableHeader sortKey="projectId" label="案件ID" sortConfig={sortConfig} requestSort={requestSort} />
                                        <SortableHeader sortKey="salesAmount" label="売上" sortConfig={sortConfig} requestSort={requestSort} />
                                        <SortableHeader sortKey="variableCostAmount" label="原価" sortConfig={sortConfig} requestSort={requestSort} />
                                        <SortableHeader sortKey="mqAmount" label="MQ" sortConfig={sortConfig} requestSort={requestSort} />
                                        <SortableHeader sortKey="mqRate" label="MQ率" sortConfig={sortConfig} requestSort={requestSort} />
                                        <SortableHeader sortKey="mqMissingReason" label="MQステータス" sortConfig={sortConfig} requestSort={requestSort} />
                                        <SortableHeader sortKey="statusLabel" label="ステータス" sortConfig={sortConfig} requestSort={requestSort} />
                                        <SortableHeader sortKey="deliveryDate" label="納品日" sortConfig={sortConfig} requestSort={requestSort} />
                                        <th scope="col" className="px-6 py-3 font-medium text-center">操作</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                    {sortedEstimates.map(est => {
                                        const salesAmount = resolveSalesAmount(est);
                                        const variableCostAmount = resolveVariableCost(est);
                                        const mqAmount = resolveMqAmount(est, salesAmount, variableCostAmount);
                                        const mqRateValue = resolveMqRate(est, salesAmount, mqAmount);
                                        const deliveryText = est.deliveryDate ? formatDate(est.deliveryDate) : (est.createdAt ? formatDate(est.createdAt) : '-');
                                        return (
                                            <tr
                                                key={est.id}
                                                className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 ${selectedEstimate?.id === est.id ? 'bg-blue-50/60 dark:bg-slate-700/40' : ''}`}
                                                onClick={() => setSelectedEstimate(est)}
                                            >
                                                <td className="px-6 py-4">
                                                    <div className="font-semibold">{est.title}</div>
                                                    <div className="text-xs text-slate-500">No. {est.patternNo ?? est.estimateNumber}</div>
                                                </td>
                                                <td className="px-6 py-4">{est.projectId ?? '-'}</td>
                                                <td className="px-6 py-4 text-right">{salesAmount !== null ? formatJPY(salesAmount) : '—'}</td>
                                                <td className="px-6 py-4 text-right">{variableCostAmount !== null ? formatJPY(variableCostAmount) : '—'}</td>
                                                <td className="px-6 py-4 text-right font-semibold">{mqAmount !== null ? formatJPY(mqAmount) : '—'}</td>
                                                <td className="px-6 py-4 text-right">{mqRateValue !== null ? formatRate(mqRateValue) : '—'}</td>
                                                <td className="px-6 py-4">{renderMqMissingBadge(est.mqMissingReason)}</td>
                                                <td className="px-6 py-4">{renderStatusBadge(est.statusLabel ?? est.status)}</td>
                                                <td className="px-6 py-4">{deliveryText}</td>
                                                <td className="px-6 py-4 text-center flex items-center justify-center gap-2">
                                                    <button onClick={(e) => { e.stopPropagation(); setSelectedEstimate(est); setActiveTab('detail'); }} className="p-2 text-slate-500 hover:text-blue-600"><FileText className="w-5 h-5" /></button>
                                                    <button onClick={(e) => { e.stopPropagation(); setSelectedEstimate(est); setIsModalOpen(true); }} className="p-2 text-slate-500 hover:text-green-600"><Pencil className="w-5 h-5" /></button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            {sortedEstimates.length === 0 && <EmptyState icon={FileText} title="見積がありません" message="Supabaseのestimatesテーブルにデータがありません。新規作成してください。" />}
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-slate-700">
                            <div>
                                {estimateTotalCount > 0
                                    ? `表示 ${pageStart} – ${pageEnd} / ${estimateTotalCount} 件`
                                    : '表示するデータがありません'}
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    className="px-3 py-1 rounded-md border border-slate-300 disabled:opacity-50"
                                    onClick={() => changePage(estimatePage - 1)}
                                    disabled={estimatePage <= 1}
                                >
                                    前へ
                                </button>
                                <span className="text-xs text-slate-500">Page {estimatePage} / {totalPages}</span>
                                <button
                                    className="px-3 py-1 rounded-md border border-slate-300 disabled:opacity-50"
                                    onClick={() => changePage(estimatePage + 1)}
                                    disabled={estimatePage >= totalPages}
                                >
                                    次へ
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'detail' && (
                    <div className="p-6 space-y-4">
                        {!selectedEstimate && <EmptyState icon={FileText} title="見積が未選択" message="一覧から見積を選択してください。" />}
                        {selectedEstimate && (
                            <>
                                <div className="flex flex-col lg:flex-row gap-4">
                                    <div className="flex-1 rounded-2xl border border-slate-200 p-4 shadow-sm bg-slate-50">
                                        <div className="flex items-center justify-between mb-2">
                                            <div>
                                                <p className="text-sm text-slate-500">パターン名 / 件名</p>
                                                <h3 className="text-2xl font-bold">{selectedEstimate.title}</h3>
                                            </div>
                                            {renderStatusBadge(selectedEstimate.status)}
                                        </div>
                                        <p className="text-sm text-slate-600">パターンNo: {selectedEstimate.patternNo ?? selectedEstimate.estimateNumber}</p>
                                        <p className="text-sm text-slate-600 mt-1">案件ID: {selectedEstimate.projectId ?? '-'}</p>
                                        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                                            <AnalysisCard title="合計" value={formatJPY(selectedEstimate.total)} />
                                            <AnalysisCard title="小計" value={formatJPY(selectedEstimate.subtotal ?? selectedEstimate.total)} />
                                            <AnalysisCard title="消費税" value={formatJPY(selectedEstimate.consumption ?? (selectedEstimate.taxTotal ?? 0))} />
                                        </div>
                                        <div className="mt-3 flex gap-2 flex-wrap">
                                            <button onClick={() => setIsModalOpen(true)} className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold flex items-center gap-2">
                                                <Pencil className="w-4 h-4" /> 編集
                                            </button>
                                            <button onClick={() => setIsDetailModalOpen(true)} className="px-4 py-2 rounded-lg border border-slate-300 font-semibold flex items-center gap-2">
                                                <FileText className="w-4 h-4" /> PDF/印刷
                                            </button>
                                        </div>
                                    </div>
                                    <div className="w-full lg:w-80 rounded-2xl border border-slate-200 p-4 shadow-sm">
                                        <h4 className="text-sm font-semibold mb-2 text-slate-700">基本情報</h4>
                                        <dl className="space-y-2 text-sm text-slate-700">
                                            <div className="flex justify-between"><dt className="text-slate-500">納品日</dt><dd>{selectedEstimate.deliveryDate ? formatDate(selectedEstimate.deliveryDate) : '-'}</dd></div>
                                            <div className="flex justify-between"><dt className="text-slate-500">有効期限</dt><dd>{selectedEstimate.expirationDate ? formatDate(selectedEstimate.expirationDate) : '-'}</dd></div>
                                            <div className="flex justify-between"><dt className="text-slate-500">取引条件</dt><dd className="text-right max-w-[60%]">{selectedEstimate.paymentTerms || '-'}</dd></div>
                                            <div className="flex justify-between"><dt className="text-slate-500">納品場所</dt><dd className="text-right max-w-[60%]">{selectedEstimate.deliveryMethod || '-'}</dd></div>
                                            <div className="flex justify-between"><dt className="text-slate-500">部数</dt><dd>{selectedEstimate.copies ?? selectedEstimate.items?.[0]?.quantity ?? '-'}</dd></div>
                                            <div className="flex justify-between"><dt className="text-slate-500">単価</dt><dd>{selectedEstimate.unitPrice ? formatJPY(selectedEstimate.unitPrice) : (selectedEstimate.items?.[0]?.unitPrice ? formatJPY(selectedEstimate.items[0].unitPrice) : '-')}</dd></div>
                                            <div className="flex justify-between"><dt className="text-slate-500">消費税率</dt><dd>{selectedEstimate.taxRate ?? 10}%</dd></div>
                                        </dl>
                                    </div>
                                </div>
                                <div className="rounded-2xl border border-slate-200 p-4 shadow-sm">
                                    <h4 className="text-lg font-semibold mb-3">明細</h4>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-50">
                                                <tr>
                                                    <th className="px-3 py-2 text-left">区分</th>
                                                    <th className="px-3 py-2 text-left">内容</th>
                                                    <th className="px-3 py-2 text-right">数量</th>
                                                    <th className="px-3 py-2 text-left">単位</th>
                                                    <th className="px-3 py-2 text-right">単価</th>
                                                    <th className="px-3 py-2 text-right">金額</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selectedEstimate.items?.map((item, idx) => (
                                                    <tr key={idx} className="border-t border-slate-200">
                                                        <td className="px-3 py-2">{item.division}</td>
                                                        <td className="px-3 py-2">{item.content}</td>
                                                        <td className="px-3 py-2 text-right">{item.quantity?.toLocaleString()}</td>
                                                        <td className="px-3 py-2">{item.unit}</td>
                                                        <td className="px-3 py-2 text-right">{formatJPY(item.unitPrice)}</td>
                                                        <td className="px-3 py-2 text-right">{formatJPY(item.price)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="mt-3">
                                        <p className="text-sm font-semibold text-slate-700 mb-1">備考</p>
                                        <p className="text-sm text-slate-600 whitespace-pre-wrap bg-slate-50 rounded-lg p-3 border border-slate-200">{selectedEstimate.notes || '—'}</p>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {activeTab === 'analysis' && (
                    <div className="p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <AnalysisCard title="総見積件数" value={`${estimateTotalCount} 件`} sub="全件数 (count=exact)" />
                            <AnalysisCard title="受注件数（このページ）" value={`${statusSummary[EstimateStatus.Ordered].count} 件`} sub="表示中ページ" />
                            <AnalysisCard title="失注件数（このページ）" value={`${statusSummary[EstimateStatus.Lost].count} 件`} sub="表示中ページ" />
                            <AnalysisCard title="平均見積額（このページ）" value={formatJPY(estimates.length ? Math.round(estimates.reduce((sum, est) => sum + (est.total || 0), 0) / estimates.length) : 0)} />
                        </div>
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                            <div className="border border-slate-200 rounded-2xl p-4 shadow-sm h-[340px]">
                                <div className="flex justify-between items-center mb-3">
                                    <h4 className="text-lg font-semibold">ステータス別金額</h4>
                                </div>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={Object.entries(statusSummary).map(([status, val], idx) => ({
                                        name: status,
                                        total: (val as any).total,
                                        fill: chartColors[idx % chartColors.length],
                                    }))}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="name" />
                                        <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                                        <Tooltip formatter={(value: number) => formatJPY(value)} />
                                        <Bar dataKey="total">
                                            {Object.entries(statusSummary).map((_, idx) => (
                                                <Cell key={idx} fill={chartColors[idx % chartColors.length]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="border border-slate-200 rounded-2xl p-4 shadow-sm h-[340px]">
                                <div className="flex justify-between items-center mb-3">
                                    <h4 className="text-lg font-semibold">月次推移（合計金額）</h4>
                                </div>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={monthlyTotals}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="name" />
                                        <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                                        <Tooltip formatter={(value: number) => formatJPY(value)} />
                                        <Bar dataKey="total" fill="#2563eb" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        <div className="border border-slate-200 rounded-2xl p-4 shadow-sm h-[360px]">
                            <div className="flex justify-between items-center mb-3">
                                <h4 className="text-lg font-semibold">ステータス構成比</h4>
                                <p className="text-sm text-slate-500">件数ベース</p>
                            </div>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={Object.entries(statusSummary).map(([status, val]) => ({
                                            name: status,
                                            value: (val as any).count,
                                        }))}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%"
                                        cy="50%"
                                        outerRadius={110}
                                        label
                                    >
                                        {Object.entries(statusSummary).map((_, idx) => (
                                            <Cell key={idx} fill={chartColors[idx % chartColors.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}
            </div>

            {isModalOpen && (
                <EstimateModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSave={handleSaveEstimate}
                    estimateToEdit={selectedEstimate}
                    currentUser={currentUser}
                    isSaving={isSaving}
                />
            )}
            {isDetailModalOpen && (
                <EstimateDetailModal
                    isOpen={isDetailModalOpen}
                    onClose={() => setIsDetailModalOpen(false)}
                    estimate={selectedEstimate}
                    addToast={addToast}
                    onEdit={() => {
                        setIsDetailModalOpen(false);
                        setIsModalOpen(true);
                    }}
                />
            )}
        </>
    );
};

export default EstimateManagementPage;
