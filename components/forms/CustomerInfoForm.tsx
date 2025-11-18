import React, { useEffect, useState } from 'react';
import { CustomerInfo } from '../../types';
import { getCustomerInfo, saveCustomerInfo } from '../../services/dataService';
import { Loader, Save, AlertTriangle, CheckCircle } from '../Icons';

type FieldType = 'text' | 'textarea';

interface FieldDefinition {
    key: keyof CustomerInfo;
    label: string;
    type?: FieldType;
    rows?: number;
}

interface SectionDefinition {
    key: string;
    title: string;
    description?: string;
    fields: FieldDefinition[];
}

interface CustomerInfoFormProps {
    customerId?: string | null;
}

const formatDateTime = (value: string | null) => {
    if (!value) return '-';
    try {
        return new Date(value).toLocaleString('ja-JP', { hour12: false });
    } catch (error) {
        console.warn('Failed to format timestamp', error);
        return value;
    }
};

const createEmptyCustomerInfo = (customerId = ''): CustomerInfo => ({
    id: customerId,
    rank: null,
    phoneNumber: null,
    faxNumber: null,
    introducer: null,
    introductionDetail: null,
    previousPerson: null,
    salesTrends: null,
    grossProfit: null,
    grossProfitByProduct: null,
    companyContent: null,
    keyPerson: null,
    orderRate: null,
    generalNewspaperCoverage: null,
    specialtyMagazineCoverage: null,
    industryNewspaperCoverage: null,
    chamberOfCommerce: null,
    correspondenceEducation: null,
    otherMedia: null,
    codeNo: null,
    businessResult: null,
    companyFeatures: null,
    customerTrends: null,
    incidents: null,
    competitors: null,
    competitorMeasures: null,
    salesTarget: null,
    businessSummary: null,
    externalItems: null,
    internalItems: null,
    quotationPoints: null,
    orderProcess: null,
    mainProducts: null,
    totalOrderAmount: null,
    needsAndIssues: null,
    competitorInfo: null,
    employeeCount: null,
    businessStartYear: null,
    creditLimit: null,
    personInCharge: null,
    closingDate: null,
    paymentDate: null,
    paymentTerms: null,
    companyName: null,
    address: null,
    representativeName: null,
    establishmentYear: null,
    capital: null,
    annualSales: null,
    keyPersonInfo: null,
    customerContactInfo: null,
    orgChart: null,
    pq: null,
    vq: null,
    mq: null,
    mRate: null,
    accidentHistory: null,
    customerVoice: null,
    annualActionPlan: null,
    lostOrders: null,
    growthPotential: null,
    requirements: null,
    other: null,
    createdAt: null,
    updatedAt: null,
});

const FINANCIAL_SECTION: SectionDefinition = {
    key: 'financial',
    title: 'Financial / Terms',
    description: '信用・支払い条件',
    fields: [
        { key: 'capital', label: '資本金' },
        { key: 'annualSales', label: '年商' },
        { key: 'creditLimit', label: '与信限度額' },
        { key: 'closingDate', label: '締日' },
        { key: 'paymentDate', label: '支払日' },
        { key: 'paymentTerms', label: '支払条件 / サイクル' },
    ],
};

const SALES_SECTION: SectionDefinition = {
    key: 'sales',
    title: 'Sales / KPI',
    description: '取引状況と指標',
    fields: [
        { key: 'pq', label: 'PQ' },
        { key: 'vq', label: 'VQ' },
        { key: 'mq', label: 'MQ' },
        { key: 'mRate', label: 'M率' },
        { key: 'orderRate', label: '受注率' },
        { key: 'salesTrends', label: '売上推移', type: 'textarea', rows: 3 },
        { key: 'grossProfit', label: '粗利', type: 'textarea', rows: 2 },
        { key: 'grossProfitByProduct', label: '製品別粗利', type: 'textarea', rows: 2 },
        { key: 'businessResult', label: '営業成績', type: 'textarea', rows: 3 },
        { key: 'salesTarget', label: '営業目標', type: 'textarea', rows: 3 },
    ],
};

const MEDIA_SECTION: SectionDefinition = {
    key: 'media',
    title: 'Media / Publication',
    description: '露出状況',
    fields: [
        { key: 'generalNewspaperCoverage', label: '一般紙掲載' },
        { key: 'specialtyMagazineCoverage', label: '専門誌掲載' },
        { key: 'industryNewspaperCoverage', label: '業界紙掲載' },
        { key: 'chamberOfCommerce', label: '商工会加入状況' },
        { key: 'correspondenceEducation', label: '通信教育利用' },
        { key: 'otherMedia', label: 'その他メディア' },
    ],
};

const RELATIONSHIP_SECTION: SectionDefinition = {
    key: 'relationship',
    title: 'Relationship / Memo',
    description: '人物・引継ぎ情報',
    fields: [
        { key: 'introducer', label: '紹介者' },
        { key: 'introductionDetail', label: '紹介経緯', type: 'textarea', rows: 3 },
        { key: 'previousPerson', label: '前担当者' },
        { key: 'personInCharge', label: '自社担当者' },
        { key: 'keyPerson', label: 'キーパーソン' },
        { key: 'keyPersonInfo', label: 'キーパーソン情報', type: 'textarea', rows: 3 },
        { key: 'customerContactInfo', label: '顧客窓口情報', type: 'textarea', rows: 3 },
        { key: 'orgChart', label: '組織図 / 体制', type: 'textarea', rows: 3 },
    ],
};

const KARTE_SECTION: SectionDefinition = {
    key: 'karte',
    title: 'Karte Text Fields',
    description: '顧客カルテ記述欄',
    fields: [
        { key: 'companyContent', label: '会社概要', type: 'textarea', rows: 3 },
        { key: 'companyFeatures', label: '会社の特徴', type: 'textarea', rows: 3 },
        { key: 'customerTrends', label: '顧客動向', type: 'textarea', rows: 3 },
        { key: 'incidents', label: '事故・トラブル', type: 'textarea', rows: 3 },
        { key: 'competitors', label: '競合他社', type: 'textarea', rows: 3 },
        { key: 'competitorMeasures', label: '競合対策', type: 'textarea', rows: 3 },
        { key: 'businessSummary', label: '取引概要', type: 'textarea', rows: 3 },
        { key: 'externalItems', label: '外部要素', type: 'textarea', rows: 3 },
        { key: 'internalItems', label: '内部要素', type: 'textarea', rows: 3 },
        { key: 'quotationPoints', label: '見積ポイント', type: 'textarea', rows: 3 },
        { key: 'orderProcess', label: '受注プロセス', type: 'textarea', rows: 3 },
        { key: 'mainProducts', label: '主要製品', type: 'textarea', rows: 3 },
        { key: 'totalOrderAmount', label: '累計受注額', type: 'textarea', rows: 2 },
        { key: 'needsAndIssues', label: 'ニーズ・課題', type: 'textarea', rows: 3 },
        { key: 'competitorInfo', label: '競合情報', type: 'textarea', rows: 3 },
        { key: 'accidentHistory', label: '事故履歴', type: 'textarea', rows: 3 },
        { key: 'customerVoice', label: '顧客の声', type: 'textarea', rows: 3 },
        { key: 'annualActionPlan', label: '年間行動計画', type: 'textarea', rows: 3 },
        { key: 'lostOrders', label: '失注案件', type: 'textarea', rows: 3 },
        { key: 'growthPotential', label: '成長可能性', type: 'textarea', rows: 3 },
        { key: 'requirements', label: '要望事項', type: 'textarea', rows: 3 },
        { key: 'other', label: 'その他メモ', type: 'textarea', rows: 3 },
    ],
};

const SECTIONS: SectionDefinition[] = [
    FINANCIAL_SECTION,
    SALES_SECTION,
    MEDIA_SECTION,
    RELATIONSHIP_SECTION,
    KARTE_SECTION,
];

const CustomerInfoForm: React.FC<CustomerInfoFormProps> = ({ customerId }) => {
    const [info, setInfo] = useState<CustomerInfo>(() => createEmptyCustomerInfo(customerId ?? ''));
    const [isLoading, setIsLoading] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [refreshIndex, setRefreshIndex] = useState(0);

    useEffect(() => {
        if (!customerId) {
            setInfo(createEmptyCustomerInfo(''));
            setHasLoaded(false);
            setLoadError(null);
            return;
        }
        let isMounted = true;
        setIsLoading(true);
        setHasLoaded(false);
        setLoadError(null);
        setStatus(null);
        setInfo(createEmptyCustomerInfo(customerId));

        getCustomerInfo(customerId)
            .then(data => {
                if (!isMounted) return;
                setInfo(data);
                setHasLoaded(true);
            })
            .catch(error => {
                if (!isMounted) return;
                console.error('Failed to load customer info', error);
                setLoadError('お客様カルテの取得に失敗しました。接続情報をご確認のうえ、再試行してください。');
            })
            .finally(() => {
                if (isMounted) {
                    setIsLoading(false);
                }
            });

        return () => {
            isMounted = false;
        };
    }, [customerId, refreshIndex]);

    const handleRetry = () => {
        setRefreshIndex(prev => prev + 1);
    };

    const handleFieldChange = (key: keyof CustomerInfo, value: string) => {
        setInfo(prev => ({ ...prev, [key]: value }));
        if (status) {
            setStatus(null);
        }
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!customerId || !hasLoaded) return;
        setIsSaving(true);
        setStatus(null);
        try {
            const saved = await saveCustomerInfo(customerId, info);
            setInfo(saved);
            setStatus({ type: 'success', message: 'お客様カルテを保存しました。' });
        } catch (error) {
            console.error('Failed to save customer info', error);
            setStatus({ type: 'error', message: '保存に失敗しました。入力内容と接続を確認してから再試行してください。' });
        } finally {
            setIsSaving(false);
        }
    };

    const inputClass = 'block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-400 dark:disabled:bg-slate-700 dark:disabled:text-slate-300';

    if (!customerId) {
        return (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-900/40 dark:text-amber-100">
                顧客情報を保存すると、お客様カルテを編集できます。
            </div>
        );
    }

    if (!hasLoaded && isLoading) {
        return (
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white/70 p-4 text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200">
                <Loader className="h-5 w-5 animate-spin" />
                お客様カルテを読み込み中です…
            </div>
        );
    }

    if (!hasLoaded && loadError) {
        return (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-100">
                <AlertTriangle className="h-5 w-5" />
                <span className="flex-1">{loadError}</span>
                <button type="button" onClick={handleRetry} className="rounded-md border border-red-200 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 dark:border-red-500/50 dark:text-red-100 dark:hover:bg-red-900/40">
                    再試行
                </button>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {status && (
                <div className={`flex items-center gap-3 rounded-lg border p-4 text-sm ${status.type === 'success'
                    ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-500/40 dark:bg-green-900/40 dark:text-green-100'
                    : 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-100'
                }`}>
                    {status.type === 'success' ? <CheckCircle className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                    {status.message}
                </div>
            )}

            <div className="grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 md:grid-cols-3 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">顧客ID</p>
                    <p className="mt-1 text-base font-medium text-slate-900 dark:text-white">{info.id || '-'}</p>
                </div>
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">作成日時</p>
                    <p className="mt-1 text-base text-slate-900 dark:text-white">{formatDateTime(info.createdAt)}</p>
                </div>
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">最終更新</p>
                    <p className="mt-1 text-base text-slate-900 dark:text-white">{formatDateTime(info.updatedAt)}</p>
                </div>
            </div>

            {SECTIONS.map(section => (
                <section key={section.key} className="space-y-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    {(section.title || section.description) && (
                        <div>
                            {section.title && <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{section.title}</h3>}
                            {section.description && (
                                <p className="text-sm text-slate-500 dark:text-slate-300">{section.description}</p>
                            )}
                        </div>
                    )}
                    <div className={`grid grid-cols-1 gap-4 ${section.key === 'karte' ? '' : 'md:grid-cols-2'}`}>
                        {section.fields.map(field => (
                            <div key={`${section.key}_${String(field.key)}`} className="flex flex-col gap-1">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor={`${section.key}_${String(field.key)}`}>
                                    {field.label}
                                </label>
                                {field.type === 'textarea' ? (
                                    <textarea
                                        id={`${section.key}_${String(field.key)}`}
                                        name={String(field.key)}
                                        rows={field.rows ?? 3}
                                        className={`${inputClass} text-sm`}
                                        value={info[field.key] ?? ''}
                                        onChange={event => handleFieldChange(field.key, event.target.value)}
                                        disabled={isSaving || !hasLoaded}
                                    />
                                ) : (
                                    <input
                                        id={`${section.key}_${String(field.key)}`}
                                        name={String(field.key)}
                                        type="text"
                                        className={`${inputClass} text-sm`}
                                        value={info[field.key] ?? ''}
                                        onChange={event => handleFieldChange(field.key, event.target.value)}
                                        disabled={isSaving || !hasLoaded}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            ))}

            <div className="flex justify-end">
                <button
                    type="submit"
                    disabled={isSaving || !hasLoaded}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400 dark:bg-blue-500 dark:hover:bg-blue-400 dark:disabled:bg-slate-600"
                >
                    {isSaving ? <Loader className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}保存
                </button>
            </div>
        </form>
    );
};

export default CustomerInfoForm;
