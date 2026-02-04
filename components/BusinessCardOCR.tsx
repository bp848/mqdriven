import React, { useState, useCallback, useEffect, useRef } from 'react';
import { extractBusinessCardDetails } from '../services/geminiService';
import { getSupabase } from '../services/supabaseClient';
import { Customer, Toast, ConfirmationDialogProps } from '../types';
import { Upload, Loader, X, CheckCircle, Trash2, AlertTriangle, Users, PlusCircle } from './Icons';
import { buildCustomerInsertPayload, mapExtractedDetailsToCustomer } from './businessCardOcrHelpers';

interface BusinessCardOCRProps {
    addToast: (message: string, type: Toast['type']) => void;
    requestConfirmation: (dialog: Omit<ConfirmationDialogProps, 'isOpen' | 'onClose'>) => void;
    isAIOff: boolean;
    onCustomerAdded?: (customer: Customer) => void;
}

interface ProcessedCard {
    id: string;
    fileName: string;
    fileUrl: string;
    mimeType: string;
    status: 'processing' | 'pending_review' | 'approved' | 'error';
    extractedData?: Partial<Customer>;
    errorMessage?: string;
    createdAt: string;
}

const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result.split(',')[1]);
            } else {
                reject(new Error("ファイル読み取りに失敗しました。"));
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });
};

const StatusBadge: React.FC<{ status: ProcessedCard['status'] }> = ({ status }) => {
    const statusMap: Record<ProcessedCard['status'], { text: string; className: string }> = {
        processing: { text: 'AI解析中', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' },
        pending_review: { text: '要確認', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' },
        approved: { text: '登録済', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' },
        error: { text: 'エラー', className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' },
    };
    const { text, className } = statusMap[status];
    return <span className={`px-2.5 py-1 text-sm font-medium rounded-full ${className}`}>{text}</span>;
};

const ProcessedCardCard: React.FC<{
    card: ProcessedCard;
    onDelete: (id: string) => Promise<void>;
    onApprove: (card: ProcessedCard) => Promise<void>;
    requestConfirmation: (dialog: Omit<ConfirmationDialogProps, 'isOpen' | 'onClose'>) => void;
    isSelected: boolean;
    onToggleSelect: (id: string) => void;
}> = ({ card, onDelete, onApprove, requestConfirmation, isSelected, onToggleSelect }) => {
    const [localData, setLocalData] = useState<Partial<Customer>>(card.extractedData || {});
    const [isDeleting, setIsDeleting] = useState(false);
    const [isApproving, setIsApproving] = useState(false);

    useEffect(() => {
        setLocalData(card.extractedData || {});
    }, [card.extractedData]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setLocalData({
            ...localData,
            [name]: value
        });
    };

    const handleDelete = async (e: React.MouseEvent) => {
        e.stopPropagation();
        requestConfirmation({
            title: '名刺データを削除',
            message: `本当に「${card.fileName}」の解析データを削除しますか？この操作は元に戻せません。`,
            onConfirm: async () => {
                setIsDeleting(true);
                await onDelete(card.id);
                setIsDeleting(false);
            }
        });
    };

    const handleApprove = async () => {
        if (!localData.customer_name) return;
        setIsApproving(true);
        const cardToApprove: ProcessedCard = {
            ...card,
            extractedData: localData,
        };
        await onApprove(cardToApprove);
        setIsApproving(false);
    };

    const inputClass = "w-full text-base bg-slate-50 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500";

    return (
        <div className={`bg-white dark:bg-slate-800 p-4 rounded-xl shadow-md border ${card.status === 'approved' ? 'border-green-300 dark:border-green-700' : 'border-slate-200 dark:border-slate-700'}`}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <div className="w-full h-auto max-h-96 border border-slate-200 dark:border-slate-700 rounded-md overflow-hidden bg-white flex items-center justify-center">
                        {card.mimeType === 'application/pdf' || card.fileName.toLowerCase().endsWith('.pdf') ? (
                            <object
                                data={card.fileUrl}
                                type="application/pdf"
                                className="w-full h-full min-h-96"
                                aria-label={card.fileName}
                            >
                                <p className="text-sm text-slate-500">
                                    PDFを表示できません。
                                    <a className="ml-1 text-blue-600 hover:underline" href={card.fileUrl} target="_blank" rel="noopener noreferrer">
                                        新しいタブで開く
                                    </a>
                                </p>
                            </object>
                        ) : (
                            <img src={card.fileUrl} alt={card.fileName} className="max-w-full max-h-96 w-auto h-auto object-contain" />
                        )}
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 truncate" title={card.fileName}>{card.fileName}</p>
                </div>
                <div className="flex flex-col">
                    <div className="flex justify-between items-center mb-3">
                        <StatusBadge status={card.status} />
                        <div className="flex items-center gap-2">
                            <button onClick={handleDelete} disabled={isDeleting} className="p-2 text-slate-500 hover:text-red-600 disabled:opacity-50" aria-label="削除">
                                {isDeleting ? <Loader className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>
                    {card.status === 'processing' && <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-700/50 rounded-lg"><Loader className="w-8 h-8 animate-spin text-blue-500" /><p className="mt-2 text-slate-500">AIが名刺を解析中...</p></div>}
                    {card.status === 'error' && <div className="flex-1 flex flex-col items-center justify-center bg-red-50 dark:bg-red-900/30 rounded-lg p-4"><AlertTriangle className="w-8 h-8 text-red-500" /><p className="mt-2 text-red-700 dark:text-red-300 font-semibold">解析エラー</p><p className="text-sm text-red-600 dark:text-red-400 mt-1 text-center">{card.errorMessage}</p></div>}
                    {localData && card.status !== 'processing' && card.status !== 'error' && (
                        <div className="space-y-3">
                            <div>
                                <label htmlFor={`customerName-${card.id}`} className="text-sm font-medium text-slate-600 dark:text-slate-300">会社名 *</label>
                                <input id={`customerName-${card.id}`} name="customer_name" type="text" value={localData.customer_name || ''} onChange={handleChange} placeholder="会社名" className={inputClass} readOnly={card.status === 'approved'} />
                            </div>
                            <div>
                                <label htmlFor={`representative-${card.id}`} className="text-sm font-medium text-slate-600 dark:text-slate-300">担当者名</label>
                                <input id={`representative-${card.id}`} name="representative_name" type="text" value={localData.representative_name || ''} onChange={handleChange} placeholder="担当者名" className={inputClass} readOnly={card.status === 'approved'} />
                            </div>
                            <div>
                                <label htmlFor={`department-${card.id}`} className="text-sm font-medium text-slate-600 dark:text-slate-300">部署</label>
                                <input id={`department-${card.id}`} name="department" type="text" value={localData.department || ''} onChange={handleChange} placeholder="部署" className={inputClass} readOnly={card.status === 'approved'} />
                            </div>
                            <div>
                                <label htmlFor={`position-${card.id}`} className="text-sm font-medium text-slate-600 dark:text-slate-300">役職</label>
                                <input id={`position-${card.id}`} name="position" type="text" value={localData.position || ''} onChange={handleChange} placeholder="役職" className={inputClass} readOnly={card.status === 'approved'} />
                            </div>
                            <div>
                                <label htmlFor={`phoneNumber-${card.id}`} className="text-sm font-medium text-slate-600 dark:text-slate-300">電話番号</label>
                                <input id={`phoneNumber-${card.id}`} name="phone_number" type="text" value={localData.phone_number || ''} onChange={handleChange} placeholder="電話番号" className={inputClass} readOnly={card.status === 'approved'} />
                            </div>
                            <div>
                                <label htmlFor={`fax-${card.id}`} className="text-sm font-medium text-slate-600 dark:text-slate-300">FAX</label>
                                <input id={`fax-${card.id}`} name="fax" type="text" value={localData.fax || ''} onChange={handleChange} placeholder="FAX" className={inputClass} readOnly={card.status === 'approved'} />
                            </div>
                            <div>
                                <label htmlFor={`mobile-${card.id}`} className="text-sm font-medium text-slate-600 dark:text-slate-300">携帯</label>
                                <input id={`mobile-${card.id}`} name="mobile_number" type="text" value={localData.mobile_number || ''} onChange={handleChange} placeholder="携帯" className={inputClass} readOnly={card.status === 'approved'} />
                            </div>
                            <div>
                                <label htmlFor={`email-${card.id}`} className="text-sm font-medium text-slate-600 dark:text-slate-300">メールアドレス</label>
                                <input id={`email-${card.id}`} name="email" type="email" value={localData.email || ''} onChange={handleChange} placeholder="メールアドレス" className={inputClass} readOnly={card.status === 'approved'} />
                            </div>
                            <div>
                                <label htmlFor={`zip-${card.id}`} className="text-sm font-medium text-slate-600 dark:text-slate-300">郵便番号</label>
                                <input id={`zip-${card.id}`} name="zip_code" type="text" value={localData.zip_code || ''} onChange={handleChange} placeholder="郵便番号" className={inputClass} readOnly={card.status === 'approved'} />
                            </div>
                            <div>
                                <label htmlFor={`address-${card.id}`} className="text-sm font-medium text-slate-600 dark:text-slate-300">住所</label>
                                <input id={`address-${card.id}`} name="address_1" type="text" value={localData.address_1 || ''} onChange={handleChange} placeholder="住所" className={inputClass} readOnly={card.status === 'approved'} />
                            </div>
                            <div>
                                <label htmlFor={`website-${card.id}`} className="text-sm font-medium text-slate-600 dark:text-slate-300">Webサイト</label>
                                <input id={`website-${card.id}`} name="website_url" type="url" value={localData.website_url || ''} onChange={handleChange} placeholder="Webサイト" className={inputClass} readOnly={card.status === 'approved'} />
                            </div>
                            <div>
                                <label htmlFor={`receivedBy-${card.id}`} className="text-sm font-medium text-slate-600 dark:text-slate-300">受領者社員番号</label>
                                <input id={`receivedBy-${card.id}`} name="received_by_employee_code" type="text" value={localData.received_by_employee_code || ''} onChange={handleChange} placeholder="受領者社員番号" className={inputClass} readOnly={card.status === 'approved'} />
                            </div>
                            <div>
                                <label htmlFor={`note-${card.id}`} className="text-sm font-medium text-slate-600 dark:text-slate-300">メモ/備考</label>
                                <textarea id={`note-${card.id}`} name="note" value={localData.note || ''} onChange={handleChange} placeholder="メモ/備考" className={inputClass} readOnly={card.status === 'approved'} rows={3} />
                            </div>
                        </div>
                    )}
                    {card.status === 'pending_review' && (
                        <div className="mt-auto flex items-center justify-between gap-3">
                            <label className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                    checked={isSelected}
                                    onChange={() => onToggleSelect(card.id)}
                                />
                                登録対象に追加
                            </label>
                            <button onClick={handleApprove} disabled={isApproving || !localData.customer_name} className="flex items-center justify-center gap-2 bg-green-600 text-white font-semibold py-2.5 px-4 rounded-lg shadow-md hover:bg-green-700 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed">
                                {isApproving ? <Loader className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                                顧客として登録
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const BusinessCardOCR: React.FC<BusinessCardOCRProps> = ({ addToast, requestConfirmation, isAIOff, onCustomerAdded }) => {
    // ネストされた値を安全に取得するヘルパー関数
    const getNestedValue = (obj: any, ...keys: (string | number)[]): any => {
        if (!obj) return undefined;
        let current = obj;
        for (const key of keys) {
            if (current && typeof current === 'object' && key in current) {
                current = current[key];
            } else {
                return undefined;
            }
        }
        return current;
    };

    const [processedCards, setProcessedCards] = useState<ProcessedCard[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());
    const [isBulkApproving, setIsBulkApproving] = useState(false);
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    const processFile = async (file: File): Promise<ProcessedCard> => {
        const tempId = `temp_${Date.now()}_${Math.random()}`;
        const fileUrl = URL.createObjectURL(file);

        const tempCard: ProcessedCard = {
            id: tempId,
            fileName: file.name,
            fileUrl,
            mimeType: file.type || 'application/octet-stream',
            status: 'processing',
            createdAt: new Date().toISOString(),
        };

        if (mounted.current) {
            setProcessedCards(prev => [tempCard, ...prev]);
        }

        try {
            const base64String = await readFileAsBase64(file);
            const extractedData = await extractBusinessCardDetails(base64String, file.type);

            // デバッグ情報を出力
            console.log('[BusinessCardOCR] AI応答データ:', extractedData);

            const processedCard: ProcessedCard = {
                ...tempCard,
                status: 'pending_review',
                extractedData: mapExtractedDetailsToCustomer(extractedData)
            };

            if (mounted.current) {
                setProcessedCards(prev => prev.map(card => card.id === tempId ? processedCard : card));
                addToast(`「${file.name}」の解析が完了しました`, 'success');
            }

            return processedCard;
        } catch (err: any) {
            const errorCard: ProcessedCard = {
                ...tempCard,
                status: 'error',
                errorMessage: err.message || '解析に失敗しました'
            };

            if (mounted.current) {
                setProcessedCards(prev => prev.map(card => card.id === tempId ? errorCard : card));
                addToast(`「${file.name}」の解析に失敗しました`, 'error');
            }

            return errorCard;
        }
    };

    const handleFiles = async (files: FileList | File[]) => {
        if (isAIOff) {
            addToast('AI機能は現在無効です。名刺の解析はできません。', 'error');
            return;
        }

        setIsProcessing(true);
        const fileArray = Array.from(files);

        try {
            await Promise.all(fileArray.map(file => processFile(file)));
            addToast(`${fileArray.length}件の名刺を処理しました`, 'success');
        } catch (err: any) {
            addToast(`処理中にエラーが発生しました: ${err.message}`, 'error');
        } finally {
            if (mounted.current) {
                setIsProcessing(false);
            }
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFiles(files);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            handleFiles(files);
        }
        e.target.value = '';
    };

    const handleDeleteCard = async (id: string) => {
        if (mounted.current) {
            setSelectedCardIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
            setProcessedCards(prev => prev.filter(card => card.id !== id));
            addToast('削除しました', 'success');
        }
    };

    const handleApproveCard = async (card: ProcessedCard) => {
        if (!card.extractedData?.customer_name) return;

        try {
            const supabase = getSupabase();

            const customerData = buildCustomerInsertPayload(card.extractedData, new Date().toISOString());

            const { data, error } = await supabase
                .from('customers')
                .insert(customerData)
                .select()
                .single();

            if (error) throw error;

            if (mounted.current) {
                setProcessedCards(prev => {
                    const target = prev.find(c => c.id === card.id);
                    if (target?.fileUrl) {
                        URL.revokeObjectURL(target.fileUrl);
                    }
                    return prev.filter(c => c.id !== card.id);
                });
                setSelectedCardIds(prev => {
                    const next = new Set(prev);
                    next.delete(card.id);
                    return next;
                });
                addToast(`「${card.extractedData.customer_name}」を顧客として登録しました`, 'success');

                if (onCustomerAdded) {
                    onCustomerAdded(data);
                }
            }
        } catch (err: any) {
            addToast(`顧客登録に失敗しました: ${err.message}`, 'error');
        }
    };

    const toggleSelectCard = useCallback((id: string) => {
        setSelectedCardIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }, []);

    const selectAllPendingCards = useCallback(() => {
        const pendingCardIds = processedCards
            .filter(card => card.status === 'pending_review')
            .map(card => card.id);
        setSelectedCardIds(new Set(pendingCardIds));
    }, [processedCards]);

    const deselectAllCards = useCallback(() => {
        setSelectedCardIds(new Set());
    }, []);

    const handleBulkApprove = async () => {
        if (isBulkApproving) return;
        const targets = processedCards.filter(card => card.status === 'pending_review' && selectedCardIds.has(card.id));
        if (targets.length === 0) return;
        setIsBulkApproving(true);
        try {
            for (const card of targets) {
                await handleApproveCard(card);
            }
        } finally {
            if (mounted.current) {
                setIsBulkApproving(false);
            }
        }
    };

    return (
        <div className="space-y-6">
            <div className="text-center">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">名刺一括OCR取り込み</h1>
                <p className="text-slate-600 dark:text-slate-400">名刺画像をドラッグ＆ドロップまたは選択して、一括で顧客情報を解析・登録します</p>
            </div>

            <div
                className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors ${isDragging
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50'
                    } ${isProcessing || isAIOff ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-blue-400'}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                <input
                    type="file"
                    multiple
                    accept="image/png, image/jpeg, image/webp, image/heic, image/heif, application/pdf"
                    onChange={handleFileChange}
                    disabled={isProcessing || isAIOff}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />

                <div className="pointer-events-none">
                    <Upload className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                        {isProcessing ? '処理中...' : '名刺画像をドラッグ＆ドロップ'}
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400 mb-4">
                        またはクリックしてファイルを選択
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-500">
                        対応形式: PNG, JPEG, WebP, HEIC, HEIF
                    </p>
                    {isAIOff && (
                        <p className="text-sm text-red-500 dark:text-red-400 mt-2">
                            AI機能が無効のため、名刺解析は利用できません
                        </p>
                    )}
                </div>
            </div>

            {processedCards.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                処理結果 ({processedCards.length}件)
                            </h2>
                            {processedCards.some(card => card.status === 'pending_review') && (
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={selectAllPendingCards}
                                        disabled={processedCards.filter(card => card.status === 'pending_review').length === 0}
                                        className="inline-flex items-center gap-1 rounded-lg bg-slate-600 px-2 py-1 text-xs font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                                    >
                                        全て選択
                                    </button>
                                    <button
                                        type="button"
                                        onClick={deselectAllCards}
                                        disabled={selectedCardIds.size === 0}
                                        className="inline-flex items-center gap-1 rounded-lg bg-slate-600 px-2 py-1 text-xs font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                                    >
                                        選択解除
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleBulkApprove}
                                        disabled={selectedCardIds.size === 0 || isBulkApproving}
                                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                                    >
                                        {isBulkApproving ? <Loader className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                        選択した名刺を登録 ({selectedCardIds.size})
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                                解析中: {processedCards.filter(c => c.status === 'processing').length}
                            </span>
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">
                                要確認: {processedCards.filter(c => c.status === 'pending_review').length}
                            </span>
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                                登録済: {processedCards.filter(c => c.status === 'approved').length}
                            </span>
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
                                エラー: {processedCards.filter(c => c.status === 'error').length}
                            </span>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {processedCards.map(card => (
                            <ProcessedCardCard
                                key={card.id}
                                card={card}
                                onDelete={handleDeleteCard}
                                onApprove={handleApproveCard}
                                requestConfirmation={requestConfirmation}
                                isSelected={selectedCardIds.has(card.id)}
                                onToggleSelect={toggleSelectCard}
                            />
                        ))}
                    </div>
                </div>
            )}

            {processedCards.length === 0 && !isProcessing && (
                <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                    <Users className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                    <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">
                        処理された名刺がありません
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400">
                        名刺画像をアップロードして顧客情報の解析を開始します
                    </p>
                </div>
            )}
        </div>
    );
};

export default BusinessCardOCR;
