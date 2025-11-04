import React, { useState, useCallback, useEffect, useRef } from 'react';
import { extractInvoiceDetails } from '../services/geminiService.ts';
import { getInboxItems, addInboxItem, updateInboxItem, deleteInboxItem, uploadFile } from '../services/dataService.ts';
import { InboxItem, InvoiceData, InboxItemStatus, Toast, ConfirmationDialogProps, AccountItem, AllocationDivision } from '../types.ts';
import { Upload, Loader, X, CheckCircle, Save, Trash2, AlertTriangle, RefreshCw } from './Icons.tsx';

interface InvoiceOCRProps {
    onSaveExpenses: (data: InvoiceData) => void;
    addToast: (message: string, type: Toast['type']) => void;
    requestConfirmation: (dialog: Omit<ConfirmationDialogProps, 'isOpen' | 'onClose'>) => void;
    isAIOff: boolean;
    accountItems: AccountItem[];
    allocationDivisions: AllocationDivision[];
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
    accountItems: AccountItem[];
    allocationDivisions: AllocationDivision[];
}> = ({ item, onUpdate, onDelete, onApprove, requestConfirmation, accountItems, allocationDivisions }) => {
    const [localData, setLocalData] = useState<InvoiceData | null>(item.extractedData);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isApproving, setIsApproving] = useState(false);

    useEffect(() => {
        setLocalData(item.extractedData);
    }, [item.extractedData]);

    // FIX: Add HTMLTextAreaElement to the event type to allow usage with textareas.
    const handleLocalChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setLocalData(prev => prev ? { ...prev, [name]: value } : null);
    };

    const handleSave = async () => {
        setIsSaving(true);
        await onUpdate(item.id, { extractedData: localData });
        setIsSaving(false);
    };

    const handleDeleteClick = () => {
        requestConfirmation({
            title: 'アイテムを削除',
            message: `本当にファイル「${item.fileName}」をインボックスから削除しますか？`,
            onConfirm: async () => {
                setIsDeleting(true);
                await onDelete(item);
            }
        });
    };
    
    const handleApprove = async () => {
        if (!localData) return;
        setIsApproving(true);
        await onApprove(item);
    };

    if (item.status === InboxItemStatus.Processing) {
        return (
             <div className="p-4 border rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center gap-4">
                <Loader className="w-5 h-5 animate-spin" />
                <div>
                    <p className="font-medium">{item.fileName}</p>
                    <StatusBadge status={item.status} />
                </div>
            </div>
        );
    }
    
    if (item.status === InboxItemStatus.Error) {
         return (
             <div className="p-4 border rounded-lg bg-red-50 dark:bg-red-900/30 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <AlertTriangle className="w-5 h-5 text-red-500"/>
                    <div>
                        <p className="font-medium">{item.fileName}</p>
                        <p className="text-sm text-red-600 dark:text-red-300">{item.errorMessage}</p>
                    </div>
                </div>
                <button onClick={handleDeleteClick} disabled={isDeleting} className="p-2 text-red-500 hover:bg-red-100 rounded-full"><Trash2 className="w-5 h-5"/></button>
            </div>
        );
    }
    
    return (
        <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
            <div className="p-4 bg-slate-50 dark:bg-slate-900/30 flex justify-between items-start">
                <div>
                    <p className="font-semibold">{item.fileName}</p>
                    <StatusBadge status={item.status} />
                </div>
                <img src={item.fileUrl} alt={item.fileName} className="w-24 h-auto rounded-md object-contain border dark:border-slate-600"/>
            </div>
            {localData && (
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input name="vendorName" value={localData.vendorName || ''} onChange={handleLocalChange} placeholder="発行元" className="md:col-span-2 w-full bg-slate-50 dark:bg-slate-700 p-2 rounded-md border"/>
                    <input name="invoiceDate" type="date" value={localData.invoiceDate || ''} onChange={handleLocalChange} className="w-full bg-slate-50 dark:bg-slate-700 p-2 rounded-md border"/>
                    <input name="totalAmount" type="number" value={localData.totalAmount || ''} onChange={handleLocalChange} placeholder="合計金額" className="w-full bg-slate-50 dark:bg-slate-700 p-2 rounded-md border"/>
                    <textarea name="description" value={localData.description || ''} onChange={handleLocalChange} placeholder="内容" className="md:col-span-2 w-full bg-slate-50 dark:bg-slate-700 p-2 rounded-md border"/>
                    <select name="account" value={localData.account || ''} onChange={handleLocalChange} className="w-full bg-slate-50 dark:bg-slate-700 p-2 rounded-md border">
                        <option value="">勘定科目を選択</option>
                        {accountItems.map(ai => <option key={ai.id} value={ai.name}>{ai.name}</option>)}
                    </select>
                     <select name="allocationDivision" value={localData.allocationDivision || ''} onChange={handleLocalChange} className="w-full bg-slate-50 dark:bg-slate-700 p-2 rounded-md border">
                        <option value="">振分区分を選択</option>
                        {allocationDivisions.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                    </select>
                </div>
            )}
             <div className="p-3 bg-slate-50 dark:bg-slate-900/30 flex justify-end items-center gap-2">
                 <button onClick={handleDeleteClick} disabled={isDeleting} className="p-2 text-slate-500 hover:text-red-500"><Trash2 className="w-5 h-5"/></button>
                 <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-1.5 text-sm font-semibold py-1.5 px-3 rounded-md border"><Save className="w-4 h-4"/>保存</button>
                 <button onClick={handleApprove} disabled={isApproving || !localData} className="flex items-center gap-1.5 text-sm font-semibold py-1.5 px-3 rounded-md bg-green-600 text-white"><CheckCircle className="w-4 h-4"/>承認して計上</button>
            </div>
        </div>
    )
};

const InvoiceOCR: React.FC<InvoiceOCRProps> = ({ onSaveExpenses, addToast, requestConfirmation, isAIOff, accountItems, allocationDivisions }) => {
    const [items, setItems] = useState<InboxItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const loadItems = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const fetchedItems = await getInboxItems();
            setItems(fetchedItems);
        } catch (err: any) {
            setError('インボックスアイテムの読み込みに失敗しました。');
            addToast('インボックスアイテムの読み込みに失敗しました。', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [addToast]);

    useEffect(() => {
        loadItems();
    }, [loadItems]);

    const handleFileUpload = async (file: File) => {
        if (!file) return;

        let tempId = `temp-${Date.now()}`;
        try {
            console.log('[OCR] ファイルアップロード開始:', file.name, 'タイプ:', file.type, 'サイズ:', file.size);
            
            const tempItem: InboxItem = {
                id: tempId, fileName: file.name, filePath: '', fileUrl: URL.createObjectURL(file), mimeType: file.type,
                status: InboxItemStatus.Processing, extractedData: null, errorMessage: null, createdAt: new Date().toISOString(),
            };
            setItems(prev => [tempItem, ...prev]);

            console.log('[OCR] ファイルをストレージにアップロード中...');
            const { path } = await uploadFile(file, 'inbox');
            console.log('[OCR] ストレージアップロード完了:', path);
            
            // FIX: Add missing properties errorMessage and extractedData when calling addInboxItem
            const newDbItem = await addInboxItem({ fileName: file.name, filePath: path, mimeType: file.type, status: InboxItemStatus.Processing, extractedData: null, errorMessage: null });
            console.log('[OCR] DBアイテム作成完了:', newDbItem.id);
            tempId = newDbItem.id; 
            setItems(prev => prev.map(i => i.id.startsWith('temp-') ? { ...newDbItem, fileUrl: URL.createObjectURL(file) } : i));

            if (isAIOff) {
                console.log('[OCR] AI機能が無効です。自動解析をスキップします。');
                await updateInboxItem(newDbItem.id, { status: InboxItemStatus.PendingReview, errorMessage: 'AI機能無効のため自動解析スキップ' });
                await loadItems();
                addToast('AI機能が無効のため、自動解析をスキップしました', 'info');
                return;
            }

            console.log('[OCR] ファイルをBase64に変換中...');
            const base64String = await readFileAsBase64(file);
            console.log('[OCR] Base64変換完了。文字列長:', base64String.length);
            
            console.log('[OCR] AI-OCR解析開始...');
            const ocrData = await extractInvoiceDetails(base64String, file.type, accountItems, allocationDivisions);
            console.log('[OCR] AI-OCR解析完了:', ocrData);
            
            await updateInboxItem(newDbItem.id, { status: InboxItemStatus.PendingReview, extractedData: ocrData });
            await loadItems();
            addToast('OCR解析が完了しました', 'success');
        } catch (err: any) {
            console.error('[OCR] エラー発生:', err);
            const errorMessage = err.message || 'ファイルのアップロードまたは解析中にエラーが発生しました。';
            setError(errorMessage);
            addToast(`ファイル処理エラー: ${errorMessage}`, 'error');
            if (tempId && !tempId.startsWith('temp-')) {
                await updateInboxItem(tempId, { status: InboxItemStatus.Error, errorMessage: err.message });
            }
            await loadItems();
        }
    };
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFileUpload(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };
    
    const handleUpdate = async (id: string, data: Partial<InboxItem>) => {
        await updateInboxItem(id, data);
        await loadItems();
    };
    
    const handleDelete = async (item: InboxItem) => {
        await deleteInboxItem(item);
        await loadItems();
    };

    const handleApprove = async (item: InboxItem) => {
        if (!item.extractedData) return;
        onSaveExpenses(item.extractedData);
        await updateInboxItem(item.id, { status: InboxItemStatus.Approved });
        await loadItems();
    };

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-semibold text-slate-800 dark:text-white">インボックス (AI-OCR)</h2>
                        <p className="mt-1 text-base text-slate-500 dark:text-slate-400">請求書や領収書をアップロードして、AIで自動的に仕訳データを作成します。</p>
                    </div>
                     <button onClick={loadItems} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"><RefreshCw className="w-5 h-5"/></button>
                </div>
                 <div className="mt-4">
                    <label htmlFor="ocr-file-upload" className="relative block w-full border-2 border-dashed rounded-lg p-8 text-center hover:border-blue-400 cursor-pointer">
                        <Upload className="mx-auto h-12 w-12 text-slate-400" />
                        <span className="mt-2 block text-sm font-medium text-slate-900 dark:text-slate-200">クリックしてファイルを選択またはドラッグ＆ドロップ</span>
                        <input ref={fileInputRef} id="ocr-file-upload" type="file" className="sr-only" onChange={handleFileChange} accept="image/*,application/pdf" />
                    </label>
                </div>
            </div>

            <div className="space-y-4">
                {isLoading && <div className="text-center p-8"><Loader className="w-8 h-8 animate-spin mx-auto"/></div>}
                {error && <div className="text-center p-8 text-red-500">{error}</div>}
                {!isLoading && items.length === 0 && <div className="text-center p-8 text-slate-500">アップロードされた請求書はありません。</div>}
                {items.map(item => (
                    <InboxItemCard key={item.id} item={item} onUpdate={handleUpdate} onDelete={handleDelete} onApprove={handleApprove} requestConfirmation={requestConfirmation} accountItems={accountItems} allocationDivisions={allocationDivisions} />
                ))}
            </div>
        </div>
    );
};

export default InvoiceOCR;