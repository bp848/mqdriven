

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { extractInvoiceDetails } from '../services/geminiService';
import { getInboxItems, addInboxItem, updateInboxItem, deleteInboxItem, uploadFile } from '../services/dataService';
import { InboxItem, InvoiceData, InboxItemStatus, Toast, ConfirmationDialogProps } from '../types';
import { Upload, Loader, X, CheckCircle, Save, Trash2, AlertTriangle, RefreshCw } from './Icons';

interface InvoiceOCRProps {
    onSaveExpenses: (data: InvoiceData) => void;
    addToast: (message: string, type: Toast['type']) => void;
    requestConfirmation: (dialog: Omit<ConfirmationDialogProps, 'isOpen' | 'onClose'>) => void;
    isAIOff: boolean;
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

const StatusBadge: React.FC<{ status: InboxItemStatus }> = ({ status }) => {
    const statusMap: Record<InboxItemStatus, { text: string; className: string }> = {
        [InboxItemStatus.Processing]: { text: '処理中', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' },
        [InboxItemStatus.PendingReview]: { text: '要確認', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' },
        [InboxItemStatus.Approved]: { text: '承認済', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' },
        [InboxItemStatus.Error]: { text: 'エラー', className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' },
    };
    const { text, className } = statusMap[status];
    return <span className={`px-2.5 py-1 text-sm font-medium rounded-full ${className}`}>{text}</span>;
};

const InboxItemCard: React.FC<{
    item: InboxItem;
    onUpdate: (id: string, data: Partial<InboxItem>) => Promise<void>;
    onDelete: (item: InboxItem) => Promise<void>;
    onApprove: (item: InboxItem) => Promise<void>;
    requestConfirmation: (dialog: Omit<ConfirmationDialogProps, 'isOpen' | 'onClose'>) => void;
}> = ({ item, onUpdate, onDelete, onApprove, requestConfirmation }) => {
    const [localData, setLocalData] = useState<InvoiceData | null>(item.extractedData);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isApproving, setIsApproving] = useState(false);

    useEffect(() => {
        setLocalData(item.extractedData);
    }, [item.extractedData]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        if (!localData) return;
        const { name, value } = e.target;
        setLocalData({
            ...localData,
            [name]: name === 'totalAmount' ? parseFloat(value) || 0 : value
        });
    };

    const handleSave = async () => {
        if (!localData) return;
        setIsSaving(true);
        await onUpdate(item.id, { extractedData: localData });
        setIsSaving(false);
    };
    
    const handleDelete = async () => {
        requestConfirmation({
            title: 'ファイルを削除',
            message: `本当に「${item.fileName}」を削除しますか？この操作は元に戻せません。`,
            onConfirm: async () => {
                setIsDeleting(true);
                await onDelete(item);
            }
        });
    };
    
    const handleApprove = async () => {
        if (!localData) return;
        setIsApproving(true);
        const itemToApprove: InboxItem = {
            ...item,
            extractedData: localData,
        };
        await onApprove(itemToApprove);
        setIsApproving(false);
    };

    const inputClass = "w-full text-base bg-slate-50 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500";
    const selectClass = "w-full text-base bg-slate-50 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500";


    return (
        <div className={`bg-white dark:bg-slate-800 p-4 rounded-xl shadow-md border ${item.status === 'approved' ? 'border-green-300 dark:border-green-700' : 'border-slate-200 dark:border-slate-700'}`}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <div className="w-full h-auto max-h-96 border border-slate-200 dark:border-slate-700 rounded-md overflow-hidden">
                        {item.mimeType === 'application/pdf' ? (
                            <iframe src={item.fileUrl} className="w-full h-96" title={item.fileName}></iframe>
                        ) : (
                            <a href={item.fileUrl} target="_blank" rel="noopener noreferrer">
                                <img src={item.fileUrl} alt={item.fileName} className="w-full h-auto object-contain" />
                            </a>
                        )}
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 truncate" title={item.fileName}>{item.fileName}</p>
                </div>
                <div className="flex flex-col">
                    <div className="flex justify-between items-center mb-3">
                        <StatusBadge status={item.status} />
                        <div className="flex items-center gap-2">
                            {item.status === 'pending_review' && (
                                <button onClick={handleSave} disabled={isSaving} className="p-2 text-slate-500 hover:text-blue-600 disabled:opacity-50" aria-label="保存">
                                    {isSaving ? <Loader className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                </button>
                            )}
                            <button onClick={handleDelete} disabled={isDeleting} className="p-2 text-slate-500 hover:text-red-600 disabled:opacity-50" aria-label="削除">
                                {isDeleting ? <Loader className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>
                    {item.status === 'processing' && <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-700/50 rounded-lg"><Loader className="w-8 h-8 animate-spin text-blue-500" /><p className="mt-2 text-slate-500">AIが解析中...</p></div>}
                    {item.status === 'error' && <div className="flex-1 flex flex-col items-center justify-center bg-red-50 dark:bg-red-900/30 rounded-lg p-4"><AlertTriangle className="w-8 h-8 text-red-500" /><p className="mt-2 text-red-700 dark:text-red-300 font-semibold">解析エラー</p><p className="text-sm text-red-600 dark:text-red-400 mt-1 text-center">{item.errorMessage}</p></div>}
                    {localData && (
                        <div className="space-y-3">
                             <div>
                                <label htmlFor={`vendorName-${item.id}`} className="text-sm font-medium text-slate-600 dark:text-slate-300">発行元</label>
                                <input id={`vendorName-${item.id}`} name="vendorName" type="text" value={localData.vendorName} onChange={handleChange} placeholder="発行元" className={inputClass} readOnly={item.status === 'approved'} />
                            </div>
                            <div>
                                <label htmlFor={`invoiceDate-${item.id}`} className="text-sm font-medium text-slate-600 dark:text-slate-300">発行日</label>
                                <input id={`invoiceDate-${item.id}`} name="invoiceDate" type="date" value={localData.invoiceDate} onChange={handleChange} placeholder="発行日" className={inputClass} readOnly={item.status === 'approved'} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor={`totalAmount-${item.id}`} className="text-sm font-medium text-slate-600 dark:text-slate-300">合計金額</label>
                                    <input id={`totalAmount-${item.id}`} name="totalAmount" type="number" value={localData.totalAmount} onChange={handleChange} placeholder="合計金額" className={inputClass} readOnly={item.status === 'approved'} />
                                </div>
                                 <div>
                                    <label htmlFor={`costType-${item.id}`} className="text-sm font-medium text-slate-600 dark:text-slate-300">費用の種類 (AI提案)</label>
                                    <select id={`costType-${item.id}`} name="costType" value={localData.costType} onChange={handleChange} className={selectClass} disabled={item.status === 'approved'}>
                                        <option value="V">変動費 (V)</option>
                                        <option value="F">固定費 (F)</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label htmlFor={`description-${item.id}`} className="text-sm font-medium text-slate-600 dark:text-slate-300">内容</label>
                                <textarea id={`description-${item.id}`} name="description" value={localData.description} onChange={handleChange} placeholder="内容" rows={2} className={inputClass} readOnly={item.status === 'approved'} />
                            </div>
                        </div>
                    )}
                    {item.status === 'pending_review' && (
                        <button onClick={handleApprove} disabled={isApproving} className="mt-auto w-full flex items-center justify-center gap-2 bg-green-600 text-white font-semibold py-2.5 px-4 rounded-lg shadow-md hover:bg-green-700 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed">
                            {isApproving ? <Loader className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                            承認して計上
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

const InvoiceOCR: React.FC<InvoiceOCRProps> = ({ onSaveExpenses, addToast, requestConfirmation, isAIOff }) => {
    const [items, setItems] = useState<InboxItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState('');
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);
    
    const loadItems = useCallback(async () => {
        try {
            if (mounted.current) setIsLoading(true);
            const data = await getInboxItems();
            if (mounted.current) setItems(data);
        } catch (err: any) {
            if (mounted.current) setError(err.message || 'データの読み込みに失敗しました。');
        } finally {
            if (mounted.current) setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadItems();
    }, [loadItems]);

    // Added a separate function to handle file processing (upload, OCR, add to inbox)
    const processFile = async (file: File) => {
        let tempItem: Omit<InboxItem, 'id' | 'createdAt' | 'fileUrl'> = {
            fileName: file.name,
            filePath: '',
            mimeType: file.type,
            status: InboxItemStatus.Processing,
            extractedData: null,
            errorMessage: null,
        };
        
        const tempId = `temp_${Date.now()}`;
        if (mounted.current) {
            setItems(prev => [{ ...tempItem, id: tempId, createdAt: new Date().toISOString(), fileUrl: URL.createObjectURL(file) }, ...prev]);
        }

        try {
            const { path } = await uploadFile(file, 'inbox');
            tempItem.filePath = path;

            const base64String = await readFileAsBase64(file);
            const data = await extractInvoiceDetails(base64String, file.type);
            
            if (mounted.current) {
                tempItem.extractedData = data;
                tempItem.status = InboxItemStatus.PendingReview;
            }

        } catch (err: any) {
            if (mounted.current) {
                tempItem.status = InboxItemStatus.Error;
                tempItem.errorMessage = err.message || '不明なエラーが発生しました。';
            }
        } finally {
             if (mounted.current) {
                setItems(prev => prev.filter(i => i.id !== tempId)); // Remove temp item
             }
            if (tempItem.filePath) {
                await addInboxItem(tempItem); // Add final item if path exists
            }
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (isAIOff) {
            addToast('AI機能は現在無効です。ファイルからの読み取りはできません。', 'error');
            return;
        }

        setIsUploading(true);
        setError('');
        try {
            // Call the existing processFile function that handles upload and OCR for inbox items
            await processFile(file);
        } catch (err: any) {
            if (mounted.current) {
                setError(err.message || 'ファイル処理中にエラーが発生しました。');
            }
        } finally {
            if (mounted.current) {
                setIsUploading(false); // Reset uploading status
            }
            e.target.value = ''; // Clear file input
        }
    };

    const handleUpdateItem = async (id: string, data: Partial<InboxItem>) => {
        try {
            const updatedItem = await updateInboxItem(id, data);
            if (mounted.current) {
                setItems(prev => prev.map(item => item.id === id ? updatedItem : item));
                addToast('更新しました。', 'success');
            }
        } catch (err: any) {
            if (mounted.current) addToast(`更新に失敗しました: ${err.message}`, 'error');
        }
    };
    
    const handleDeleteItem = async (itemToDelete: InboxItem) => {
        try {
            await deleteInboxItem(itemToDelete);
            if (mounted.current) {
                setItems(prev => prev.filter(item => item.id !== itemToDelete.id));
                addToast('削除しました。', 'success');
            }
        } catch (err: any) {
            if (mounted.current) addToast(`削除に失敗しました: ${err.message}`, 'error');
        }
    };
    
    const handleApproveItem = async (itemToApprove: InboxItem) => {
        if (!itemToApprove.extractedData) return;
        try {
            onSaveExpenses(itemToApprove.extractedData);
            await handleUpdateItem(itemToApprove.id, { status: InboxItemStatus.Approved });
        } catch (err: any) {
            if (mounted.current) addToast(`承認処理に失敗しました: ${err.message}`, 'error');
        }
    };


    return (
        <div className="space-y-6">
            <div>
                <div className="flex justify-between items-center">
                    <label htmlFor="file-upload" className={`relative inline-flex items-center justify-center gap-2 bg-blue-600 text-white font-semibold py-2.5 px-5 rounded-lg shadow-md hover:bg-blue-700 transition-colors ${isUploading || isAIOff ? 'bg-slate-400 cursor-not-allowed' : ''}`}>
                        <Upload className="w-5 h-5" />
                        <span>請求書・領収書を追加</span>
                        <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept="image/png, image/jpeg, image/webp" multiple disabled={isUploading || isAIOff} />
                    </label>
                    {isAIOff && <p className="text-sm text-red-500 dark:text-red-400 ml-4">AI機能無効のため、OCR機能は利用できません。</p>}
                </div>
                 {isUploading && !isAIOff && <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">アップロードと解析を実行中です...</p>}
            </div>

            {error && (
                <div className="bg-red-100 dark:bg-red-900/50 p-4 rounded-lg text-red-700 dark:text-red-300">
                    <strong>エラー:</strong> {error}
                </div>
            )}
            
            {isLoading ? (
                <div className="text-center py-10">
                    <Loader className="w-8 h-8 mx-auto animate-spin text-blue-500" />
                    <p className="mt-2 text-slate-500 dark:text-slate-400">受信トレイを読み込んでいます...</p>
                </div>
            ) : (
                items.length > 0 ? (
                    <div className="space-y-6">
                        {items.map(item => (
                            <InboxItemCard key={item.id} item={item} onUpdate={handleUpdateItem} onDelete={handleDeleteItem} onApprove={handleApproveItem} requestConfirmation={requestConfirmation} />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl">
                        <p className="font-semibold text-slate-700 dark:text-slate-300">仕入計上する請求書はありません</p>
                        <p className="mt-1 text-slate-500 dark:text-slate-400">請求書や領収書をアップロードして仕入計上を開始します。</p>
                    </div>
                )
            )}
        </div>
    );
};

export default InvoiceOCR;
