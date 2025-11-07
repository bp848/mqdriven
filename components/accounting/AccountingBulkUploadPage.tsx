import React, { useEffect, useMemo, useState } from 'react';
import JSZip from 'jszip';
import { Upload, FileText, Loader, X, AlertTriangle, CheckCircle } from '../Icons.tsx';
import { Toast, InboxItem, InboxItemStatus } from '../../types.ts';
import { uploadFile, addInboxItem, getInboxItems } from '../../services/dataService.ts';
import { extractDocumentText } from '../../services/geminiService.ts';

interface AccountingBulkUploadPageProps {
  addToast: (message: string, type: Toast['type']) => void;
  isAIOff: boolean; // not used, kept for consistent props
}

const isZip = (file: File) => file.type === 'application/zip' || file.type === 'application/x-zip-compressed' || file.name.toLowerCase().endsWith('.zip');

const AccountingBulkUploadPage: React.FC<AccountingBulkUploadPageProps> = ({ addToast, isAIOff }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [uploaded, setUploaded] = useState<{ name: string; url: string }[]>([]);
  const [inbox, setInbox] = useState<InboxItem[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const items = await getInboxItems();
        setInbox(items);
      } catch {
        // ignore
      }
    };
    load();
  }, []);

  const unzipAndAddFiles = async (zipFile: File) => {
    try {
      const zip = await JSZip.loadAsync(zipFile);
      const newFiles: File[] = [];
      for (const filename in zip.files) {
        const entry = zip.files[filename];
        if (!entry.dir) {
          const blob = await entry.async('blob');
          const f = new File([blob], filename, { type: blob.type });
          newFiles.push(f);
        }
      }
      setFiles(prev => [...prev, ...newFiles]);
      addToast(`${zipFile.name} を展開し、${newFiles.length} ファイルを追加しました`, 'success');
    } catch (e) {
      console.error('Failed to unzip', e);
      addToast(`${zipFile.name} の展開に失敗しました`, 'error');
    }
  };

  const handleFileChange = (selected: FileList | null) => {
    if (!selected) return;
    const regular: File[] = [];
    const zips: File[] = [];
    Array.from(selected).forEach(f => {
      if (isZip(f)) zips.push(f); else regular.push(f);
    });
    setFiles(prev => [...prev, ...regular]);
    zips.forEach(unzipAndAddFiles);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    handleFileChange(e.dataTransfer.files);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const stripXmlTags = (xml: string): string => {
    // Remove tags and decode basic entities
    const noTags = xml.replace(/<[^>]+>/g, ' ');
    const decoded = noTags
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    return decoded.replace(/\s+/g, ' ').trim();
  };

  const extractDocxText = async (file: File): Promise<string> => {
    try {
      const zip = await JSZip.loadAsync(file);
      const parts = [] as string[];
      const addPart = async (path: string) => {
        const entry = zip.file(path);
        if (entry) {
          const xml = await entry.async('text');
          parts.push(stripXmlTags(xml));
        }
      };
      await addPart('word/document.xml');
      // Try headers/footers
      for (let i = 1; i <= 3; i++) {
        await addPart(`word/header${i}.xml`);
        await addPart(`word/footer${i}.xml`);
      }
      return parts.join('\n');
    } catch {
      return '';
    }
  };

  const extractXlsxStrings = async (file: File): Promise<string> => {
    try {
      const zip = await JSZip.loadAsync(file);
      const shared = zip.file('xl/sharedStrings.xml');
      if (!shared) return '';
      const xml = await shared.async('text');
      // sharedStrings.xml contains <si><t>text</t></si>
      const texts = Array.from(xml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)).map(m => stripXmlTags(m[1]));
      return texts.join('\n');
    } catch {
      return '';
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      setError('ファイルを選択してください');
      return;
    }
    setError('');
    setIsUploading(true);
    const results: { name: string; url: string }[] = [];
    try {
      for (const f of files) {
        const { path, url } = await uploadFile(f, 'inbox');
        // 登録: inbox_items にも記録
        await addInboxItem({
          fileName: f.name,
          filePath: path,
          mimeType: f.type || 'application/octet-stream',
          status: InboxItemStatus.Processing,
          extractedData: null,
          errorMessage: null,
        });
        results.push({ name: f.name, url });

        // ドキュメントテキスト抽出
        const mime = (f.type || '').toLowerCase();
        const nameLower = f.name.toLowerCase();
        const isPdfOrImage = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(mime);
        const isTextLike = mime.startsWith('text/') || mime === 'application/json' || nameLower.endsWith('.csv');
        const isDocx = nameLower.endsWith('.docx') || mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        const isXlsx = nameLower.endsWith('.xlsx') || mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

        if (isTextLike) {
          try {
            const text = await readFileAsText(f);
            if (text && text.length > 0) {
              const textBlob = new Blob([text], { type: 'text/plain' });
              const textFile = new File([textBlob], `${f.name}.txt`, { type: 'text/plain' });
              const { path: txtPath, url: txtUrl } = await uploadFile(textFile, 'inbox');
              await addInboxItem({
                fileName: `${f.name}.txt`,
                filePath: txtPath,
                mimeType: 'text/plain',
                status: InboxItemStatus.PendingReview,
                extractedData: null,
                errorMessage: null,
              });
              results.push({ name: `${f.name}.txt`, url: txtUrl });
            }
          } catch (e) {
            console.warn('テキスト読み込み失敗:', e);
          }
        } else if (isDocx) {
          try {
            const text = await extractDocxText(f);
            if (text && text.length > 0) {
              const textBlob = new Blob([text], { type: 'text/plain' });
              const textFile = new File([textBlob], `${f.name}.txt`, { type: 'text/plain' });
              const { path: txtPath, url: txtUrl } = await uploadFile(textFile, 'inbox');
              await addInboxItem({
                fileName: `${f.name}.txt`,
                filePath: txtPath,
                mimeType: 'text/plain',
                status: InboxItemStatus.PendingReview,
                extractedData: null,
                errorMessage: null,
              });
              results.push({ name: `${f.name}.txt`, url: txtUrl });
            }
          } catch (e) {
            console.warn('DOCX抽出失敗:', e);
          }
        } else if (isXlsx) {
          try {
            const text = await extractXlsxStrings(f);
            if (text && text.length > 0) {
              const textBlob = new Blob([text], { type: 'text/plain' });
              const textFile = new File([textBlob], `${f.name}.txt`, { type: 'text/plain' });
              const { path: txtPath, url: txtUrl } = await uploadFile(textFile, 'inbox');
              await addInboxItem({
                fileName: `${f.name}.txt`,
                filePath: txtPath,
                mimeType: 'text/plain',
                status: InboxItemStatus.PendingReview,
                extractedData: null,
                errorMessage: null,
              });
              results.push({ name: `${f.name}.txt`, url: txtUrl });
            }
          } catch (e) {
            console.warn('XLSX抽出失敗:', e);
          }
        } else if (!isAIOff && isPdfOrImage) {
          try {
            const base64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => {
                if (typeof reader.result === 'string') {
                  resolve(reader.result.split(',')[1]);
                } else {
                  reject(new Error('base64変換に失敗'));
                }
              };
              reader.onerror = reject;
              reader.readAsDataURL(f);
            });
            const text = await extractDocumentText(base64, mime);
            if (text && text.length > 0) {
              const textBlob = new Blob([text], { type: 'text/plain' });
              const textFile = new File([textBlob], `${f.name}.txt`, { type: 'text/plain' });
              const { path: txtPath, url: txtUrl } = await uploadFile(textFile, 'inbox');
              await addInboxItem({
                fileName: `${f.name}.txt`,
                filePath: txtPath,
                mimeType: 'text/plain',
                status: InboxItemStatus.PendingReview,
                extractedData: null,
                errorMessage: null,
              });
              results.push({ name: `${f.name}.txt`, url: txtUrl });
            }
          } catch (extractErr) {
            console.warn('テキスト抽出に失敗:', extractErr);
          }
        } else {
          // メタ情報だけでも残す（再生成準備）
          try {
            const meta = {
              name: f.name,
              mimeType: f.type || 'application/octet-stream',
              size: f.size,
              note: '自動抽出対象外または未対応形式。後続エンジンでの解析を予定。'
            };
            const metaBlob = new Blob([JSON.stringify(meta, null, 2)], { type: 'application/json' });
            const metaFile = new File([metaBlob], `${f.name}.meta.json`, { type: 'application/json' });
            const { path: metaPath, url: metaUrl } = await uploadFile(metaFile, 'inbox');
            await addInboxItem({
              fileName: `${f.name}.meta.json`,
              filePath: metaPath,
              mimeType: 'application/json',
              status: InboxItemStatus.PendingReview,
              extractedData: null,
              errorMessage: null,
            });
            results.push({ name: `${f.name}.meta.json`, url: metaUrl });
          } catch (e) {
            console.warn('メタ生成に失敗:', e);
          }
        }
      }
      setUploaded(prev => [...results, ...prev]);
      setFiles([]);
      addToast(`${results.length} 件アップロードしました`, 'success');
      // 受信箱を更新
      const items = await getInboxItems();
      setInbox(items);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'アップロード中にエラーが発生しました');
      addToast('アップロードに失敗しました', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  // 星取表: キャッシュフロー計算書の必要書類
  type ChecklistItem = { id: string; label: string; keywords: string[]; examples?: string[]; required: boolean };
  const checklist: ChecklistItem[] = useMemo(() => [
    { id: 'pl', label: '損益計算書（P/L）', keywords: ['損益', 'PL', 'Profit and Loss'], examples: ['pl_2025.xlsx', '損益_2025Q1.pdf'], required: true },
    { id: 'bs', label: '貸借対照表（B/S）', keywords: ['貸借', 'BS', 'Balance Sheet'], examples: ['bs_2025.xlsx'], required: true },
    { id: 'tb', label: '試算表（月次）', keywords: ['試算表', 'trial balance'], examples: ['trial_balance_2025-03.csv'], required: true },
    { id: 'gl', label: '総勘定元帳（仕訳データ含む）', keywords: ['総勘定元帳', 'GL', '仕訳', 'journal'], examples: ['gl_2025.mjf', 'journal_2025-03.csv'], required: true },
    { id: 'bank', label: '銀行取引明細（CSV/PDF）', keywords: ['入出金明細', '通帳', 'bank', '明細'], examples: ['bank_mufg_2025-03.csv', '通帳_3月.pdf'], required: true },
    { id: 'cashbook', label: '現金出納帳', keywords: ['現金出納', 'cashbook'], examples: ['cashbook_2025-03.xlsx'], required: true },
    { id: 'ar', label: '売掛金明細', keywords: ['売掛', 'AR', 'accounts receivable'], examples: ['ar_list_2025-03.xlsx'], required: true },
    { id: 'ap', label: '買掛金明細', keywords: ['買掛', 'AP', 'accounts payable'], examples: ['ap_list_2025-03.xlsx'], required: true },
    { id: 'fa', label: '固定資産台帳/減価償却', keywords: ['固定資産', '減価償却', 'depreciation', 'fixed asset'], examples: ['fa_ledger.xlsx'], required: false },
    { id: 'loan', label: '借入金返済予定表', keywords: ['借入', '返済予定', 'loan schedule'], examples: ['loan_schedule.pdf'], required: false },
    { id: 'inventory', label: '棚卸表', keywords: ['棚卸', 'inventory'], examples: ['inventory_2025-03.xlsx'], required: false },
    { id: 'receipts', label: '請求書/領収書（PDF/画像）', keywords: ['請求書', '領収書', 'invoice', 'receipt'], examples: ['invoice_12345.pdf', 'receipt_2025-03-10.jpg'], required: false },
  ], []);

  const allKnownFiles = useMemo(() => {
    const sessionNames = uploaded.map(u => u.name);
    const inboxNames = inbox.map(i => i.fileName);
    return [...new Set([...sessionNames, ...inboxNames])];
  }, [uploaded, inbox]);

  const checklistResult = useMemo(() => {
    return checklist.map(item => {
      const found = allKnownFiles.some(name => item.keywords.some(kw => name.toLowerCase().includes(kw.toLowerCase())));
      return { ...item, found };
    });
  }, [allKnownFiles, checklist]);

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6 space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Upload className="w-6 h-6 text-blue-500" />
          会計資料一括アップロード (管理者専用)
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm">対応形式: すべてのファイル（CSV, PDF, 画像, スキャン, ZIP など）</p>
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          className={`relative border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-6 text-center transition-colors ${isDragOver ? 'bg-blue-50 dark:bg-blue-900/50 border-blue-400' : ''}`}
        >
          <input
            type="file"
            id="accounting-bulk-upload"
            multiple
            className="sr-only"
            accept="*/*"
            onChange={(e) => handleFileChange(e.target.files)}
            disabled={isUploading}
          />
          <label htmlFor="accounting-bulk-upload" className="cursor-pointer select-none">
            <Upload className="w-10 h-10 mx-auto text-slate-400" />
            <p className="mt-2 text-slate-500">ここにファイルをドラッグ＆ドロップ</p>
            <p className="text-xs text-slate-400">またはクリックしてファイルを選択</p>
          </label>
        </div>
        {files.length > 0 && (
          <div className="mt-2 space-y-2">
            {files.map((file, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-700 rounded-md text-sm">
                <div className="flex items-center gap-2 overflow-hidden">
                  <FileText className="w-5 h-5 text-slate-500 flex-shrink-0" />
                  <span className="font-medium truncate" title={file.name}>{file.name}</span>
                  <span className="text-slate-500 flex-shrink-0">({(file.size / 1024).toFixed(1)} KB)</span>
                </div>
                <button onClick={() => removeFile(idx)} disabled={isUploading} className="p-1 text-slate-400 hover:text-red-500 flex-shrink-0"><X className="w-4 h-4"/></button>
              </div>
            ))}
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 dark:bg-red-900/30 p-3 rounded-md text-sm">
            <AlertTriangle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}
        <div className="flex justify-end">
          <button
            onClick={handleUpload}
            disabled={isUploading || files.length === 0}
            className="min-w-40 flex items-center justify-center bg-blue-600 text-white font-semibold py-2.5 px-4 rounded-lg shadow-md hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed"
          >
            {isUploading ? <Loader className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5 mr-2" />}
            {isUploading ? 'アップロード中...' : 'アップロード'}
          </button>
        </div>
      </div>

      {uploaded.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6 space-y-3">
          <h3 className="text-lg font-semibold">アップロード履歴 (この画面内)</h3>
          <ul className="space-y-2">
            {uploaded.map((u, i) => (
              <li key={`${u.name}-${i}`} className="flex items-center justify-between text-sm p-2 bg-slate-50 dark:bg-slate-700 rounded-md">
                <span className="truncate mr-2" title={u.name}>{u.name}</span>
                <a href={u.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">開く</a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6 space-y-4">
        <h3 className="text-lg font-semibold">キャッシュフロー計算書 書類星取表</h3>
        <p className="text-slate-500 dark:text-slate-400 text-sm">アップロード済みファイル（本画面＋インボックス）から自動判定します。</p>
        <div className="divide-y divide-slate-200 dark:divide-slate-700">
          {checklistResult.map(item => (
            <div key={item.id} className="py-2 flex items-start justify-between gap-4">
              <div>
                <div className="font-medium">{item.label}{item.required ? '（必須）' : ''}</div>
                {!item.found && (
                  <div className="text-xs text-slate-500 mt-1">
                    例: {item.examples?.join(', ') || '適切な名称のファイルをアップロードしてください'}
                  </div>
                )}
              </div>
              {item.found ? (
                <span className="inline-flex items-center gap-1 text-green-600 text-sm"><CheckCircle className="w-4 h-4"/>確認済</span>
              ) : (
                <span className="inline-flex items-center gap-1 text-amber-600 text-sm"><AlertTriangle className="w-4 h-4"/>未提出</span>
              )}
            </div>
          ))}
        </div>
        {checklistResult.some(i => !i.found && i.required) && (
          <div className="mt-3 text-sm text-red-600">必須項目に不足があります。該当資料をアップロードしてください。</div>
        )}
      </div>
    </div>
  );
};

export default AccountingBulkUploadPage;
