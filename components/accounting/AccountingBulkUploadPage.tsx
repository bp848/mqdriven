import React, { useEffect, useMemo, useState } from 'react';
import JSZip from 'jszip';
import { Upload, FileText, Loader, X, AlertTriangle, CheckCircle } from '../Icons.tsx';
import { Toast, InboxItem, InboxItemStatus } from '../../types.ts';
import { uploadFile, addInboxItem, getInboxItems, updateInboxItem } from '../../services/dataService.ts';
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
  const [isReloading, setIsReloading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastSyncAt, setLastSyncAt] = useState<string>('');
  const [simulatorMode, setSimulatorMode] = useState<boolean>(true);
  type SimFile = { file: File; extractedText?: string };
  const [simFiles, setSimFiles] = useState<SimFile[]>([]);
  const [isAgentRunning, setIsAgentRunning] = useState(false);
  const [agentLog, setAgentLog] = useState<string[]>([]);
  const [showMissingOnly, setShowMissingOnly] = useState<boolean>(false);

  const reloadInbox = async () => {
    setIsReloading(true);
    try {
      const items = await getInboxItems();
      setInbox(items);
      setLastSyncAt(new Date().toLocaleString());
    } catch {
      // ignore
    } finally {
      setIsReloading(false);
    }
  };

  const runAgent = async () => {
    if (isAgentRunning) return;
    setIsAgentRunning(true);
    setAgentLog([]);
    const log = (m: string) => setAgentLog(prev => [...prev, m]);
    try {
      if (simulatorMode) {
        // Re-extract for simulator files lacking text
        for (let i = 0; i < simFiles.length; i++) {
          const sf = simFiles[i];
          if (sf.extractedText && sf.extractedText.trim().length > 0) continue;
          const f = sf.file;
          const mime = (f.type || '').toLowerCase();
          const nameLower = f.name.toLowerCase();
          const isTextLike = mime.startsWith('text/') || mime === 'application/json' || nameLower.endsWith('.csv');
          const isDocx = nameLower.endsWith('.docx') || mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          const isXlsx = nameLower.endsWith('.xlsx') || mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          const isPdfOrImage = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(mime);
          try {
            let extracted = '';
            if (isTextLike) {
              extracted = await readFileAsText(f);
            } else if (isDocx) {
              extracted = await extractDocxText(f);
            } else if (isXlsx) {
              extracted = await extractXlsxStrings(f);
            } else if (!isAIOff && isPdfOrImage) {
              const base64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                  if (typeof reader.result === 'string') resolve(reader.result.split(',')[1]); else reject(new Error('base64変換に失敗'));
                };
                reader.onerror = reject;
                reader.readAsDataURL(f);
              });
              extracted = await extractDocumentText(base64, mime);
            }
            setSimFiles(prev => {
              const copy = [...prev];
              copy[i] = { ...sf, extractedText: extracted };
              return copy;
            });
            log(`SIM OK: ${f.name}`);
          } catch (e: any) {
            log(`SIM NG: ${f.name} - ${e?.message || e}`);
          }
        }
      } else {
        // Process inbox items lacking extractedData
        for (const item of inbox) {
          if (item.extractedData && String(item.extractedData).trim().length > 0) continue;
          try {
            const url = item.fileUrl;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`fetch ${res.status}`);
            const blob = await res.blob();
            const mime = (item.mimeType || blob.type || '').toLowerCase();
            let extracted = '';
            if (mime.startsWith('text/') || mime === 'application/json' || item.fileName.toLowerCase().endsWith('.csv')) {
              extracted = await blob.text();
            } else if (item.fileName.toLowerCase().endsWith('.docx') || mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
              extracted = await extractDocxText(new File([blob], item.fileName, { type: mime }));
            } else if (item.fileName.toLowerCase().endsWith('.xlsx') || mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
              extracted = await extractXlsxStrings(new File([blob], item.fileName, { type: mime }));
            } else if (!isAIOff && ['application/pdf','image/jpeg','image/png','image/webp'].includes(mime)) {
              const base64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => { if (typeof reader.result === 'string') resolve(reader.result.split(',')[1]); else reject(new Error('base64変換に失敗')); };
                reader.onerror = reject;
                reader.readAsDataURL(new File([blob], item.fileName, { type: mime }));
              });
              extracted = await extractDocumentText(base64, mime);
            }
            await updateInboxItem(item.id, {
              extractedData: extracted || null,
              status: extracted ? InboxItemStatus.PendingReview : InboxItemStatus.Processing,
              errorMessage: extracted ? null : '抽出結果が空でした',
            });
            log(`INBOX OK: ${item.fileName}`);
          } catch (e: any) {
            await updateInboxItem(item.id, {
              errorMessage: e?.message || '抽出失敗',
              status: InboxItemStatus.Processing,
            });
            log(`INBOX NG: ${item.fileName} - ${e?.message || e}`);
          }
        }
        await reloadInbox();
      }
      addToast('エージェント処理が完了しました', 'success');
    } catch (e) {
      addToast('エージェント処理に失敗しました', 'error');
    } finally {
      setIsAgentRunning(false);
    }
  };

  useEffect(() => { reloadInbox(); }, []);

  useEffect(() => {
    if (!autoRefresh || simulatorMode) return; // シミュレーター中は自動更新しない
    const id = setInterval(() => { if (!isUploading) reloadInbox(); }, 10000);
    return () => clearInterval(id);
  }, [autoRefresh, simulatorMode, isUploading]);

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
        if (simulatorMode) {
          // シミュレータ: クライアントで抽出のみ行い、保存はしない
          const mime = (f.type || '').toLowerCase();
          const nameLower = f.name.toLowerCase();
          const isTextLike = mime.startsWith('text/') || mime === 'application/json' || nameLower.endsWith('.csv');
          const isDocx = nameLower.endsWith('.docx') || mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          const isXlsx = nameLower.endsWith('.xlsx') || mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          const isPdfOrImage = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(mime);
          try {
            let extracted = '';
            if (isTextLike) {
              extracted = await readFileAsText(f);
            } else if (isDocx) {
              extracted = await extractDocxText(f);
            } else if (isXlsx) {
              extracted = await extractXlsxStrings(f);
            } else if (!isAIOff && isPdfOrImage) {
              const base64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                  if (typeof reader.result === 'string') resolve(reader.result.split(',')[1]); else reject(new Error('base64変換に失敗'));
                };
                reader.onerror = reject;
                reader.readAsDataURL(f);
              });
              extracted = await extractDocumentText(base64, mime);
            }
            setSimFiles(prev => [...prev, { file: f, extractedText: extracted }]);
          } catch (e) {
            console.warn('シミュレータ抽出失敗:', e);
            setSimFiles(prev => [...prev, { file: f }]);
          }
          continue; // 次のファイルへ（保存しない）
        }
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
      if (!simulatorMode) {
        setUploaded(prev => [...results, ...prev]);
        addToast(`${results.length} 件アップロードしました`, 'success');
        // 受信箱を更新
        const items = await getInboxItems();
        setInbox(items);
      } else {
        addToast(`${files.length} 件をシミュレーションに取り込みました（DB未保存）`, 'success');
      }
      setFiles([]);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'アップロード中にエラーが発生しました');
      addToast('アップロードに失敗しました', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const persistSimulation = async () => {
    if (simFiles.length === 0) return;
    setIsUploading(true);
    try {
      for (const sf of simFiles) {
        const f = sf.file;
        const { path, url } = await uploadFile(f, 'inbox');
        await addInboxItem({
          fileName: f.name,
          filePath: path,
          mimeType: f.type || 'application/octet-stream',
          status: InboxItemStatus.Processing,
          extractedData: null,
          errorMessage: null,
        });
        // 抽出テキストがあれば .txt を追加保存
        if (sf.extractedText && sf.extractedText.trim().length > 0) {
          const textBlob = new Blob([sf.extractedText], { type: 'text/plain' });
          const textFile = new File([textBlob], `${f.name}.txt`, { type: 'text/plain' });
          const { path: txtPath } = await uploadFile(textFile, 'inbox');
          await addInboxItem({
            fileName: `${f.name}.txt`,
            filePath: txtPath,
            mimeType: 'text/plain',
            status: InboxItemStatus.PendingReview,
            extractedData: null,
            errorMessage: null,
          });
        }
      }
      addToast(`${simFiles.length} 件を確定アップロードしました`, 'success');
      setSimFiles([]);
      await reloadInbox();
    } catch (e) {
      console.error('確定アップロード失敗:', e);
      addToast('確定アップロードに失敗しました', 'error');
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
    { id: 'social_insurance', label: '社会保険（納付書/算定）', keywords: ['社会保険', '健保', '厚生年金', '納付書', '算定'], examples: ['社会保険_2025-09.pdf'], required: false },
    { id: 'fa', label: '固定資産台帳/減価償却', keywords: ['固定資産', '減価償却', 'depreciation', 'fixed asset'], examples: ['fa_ledger.xlsx'], required: false },
    { id: 'loan', label: '借入金返済予定表', keywords: ['借入', '返済予定', 'loan schedule'], examples: ['loan_schedule.pdf'], required: false },
    { id: 'inventory', label: '棚卸表', keywords: ['棚卸', 'inventory'], examples: ['inventory_2025-03.xlsx'], required: false },
    { id: 'receipts', label: '請求書/領収書（PDF/画像）', keywords: ['請求書', '領収書', 'invoice', 'receipt'], examples: ['invoice_12345.pdf', 'receipt_2025-03-10.jpg'], required: false },
  ], []);

  // 動的材料ベース: 分類は抽出テキストのみで行う（ファイル名は使わない）
  type DocEntry = { name: string; createdAt?: string; text: string; usable: boolean; reason?: string };
  const docEntriesFromInbox: DocEntry[] = useMemo(() => {
    return inbox.map(i => ({
      name: i.fileName,
      createdAt: i.createdAt || undefined,
      text: `${i.extractedData || ''}`.toLowerCase(),
      usable: !!(i.extractedData && String(i.extractedData).trim().length > 0),
      reason: i.errorMessage || (i.extractedData ? undefined : '抽出データなし'),
    }));
  }, [inbox]);

  const docEntriesFromSimulator: DocEntry[] = useMemo(() => {
    return simFiles.map(sf => ({
      name: sf.file.name,
      createdAt: new Date().toISOString(),
      text: `${sf.extractedText || ''}`.toLowerCase(),
      usable: !!(sf.extractedText && sf.extractedText.trim().length > 0),
      reason: sf.extractedText ? undefined : '抽出データなし',
    }));
  }, [simFiles]);

  const docEntries: DocEntry[] = useMemo(() => {
    // シミュレーターONのときはシミュレーションのみを可視化（DBや受信箱は混ぜない）
    return simulatorMode ? docEntriesFromSimulator : docEntriesFromInbox;
  }, [simulatorMode, docEntriesFromInbox, docEntriesFromSimulator]);

  const allKnownFiles = useMemo(() => {
    const sessionNames = uploaded.map(u => u.name);
    const inboxNames = inbox.map(i => i.fileName);
    return [...new Set([...sessionNames, ...inboxNames])];
  }, [uploaded, inbox]);

  const usableEntries = useMemo(() => docEntries.filter(d => d.usable), [docEntries]);
  const checklistResult = useMemo(() => {
    return checklist.map(item => {
      const matchedNames = new Set<string>();
      usableEntries.forEach(d => {
        if (item.keywords.some(kw => d.text.includes(kw.toLowerCase()))) matchedNames.add(d.name);
      });
      const matched = Array.from(matchedNames);
      const found = matched.length > 0;
      return { ...item, found, matched } as ChecklistItem & { found: boolean; matched: string[] };
    });
  }, [usableEntries, checklist]);

  // 日付カバレッジ解析
  const extractMonthFromName = (name: string): string[] => {
    const hits = new Set<string>();
    const lower = name.toLowerCase();
    const patterns = [
      /(20\d{2})[-_./]?(0[1-9]|1[0-2])[-_./]?(0[1-9]|[12]\d|3[01])?/, // 2025-03-10 / 202503 / 2025_03
      /(\d{4})年(0?[1-9]|1[0-2])月/ // 2025年3月
    ];
    for (const re of patterns) {
      const m = lower.match(re as RegExp);
      if (m) {
        const year = m[1].padStart(4, '0');
        const month = (m[2].length === 1 ? '0' + m[2] : m[2]).slice(-2);
        hits.add(`${year}-${month}`);
      }
    }
    return Array.from(hits);
  };

  const extractMonthFromText = (text: string): string[] => extractMonthFromName(text);

  const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;

  const coverage = useMemo(() => {
    const months = new Set<string>();
    // from filenames and extracted text
    docEntries.forEach(d => {
      extractMonthFromName(d.name).forEach(m => months.add(m));
      extractMonthFromText(d.text).forEach(m => months.add(m));
      if (d.createdAt) months.add(monthKey(new Date(d.createdAt)));
    });

    if (months.size === 0) return { months: [], missing: [], range: null as null | { start: string; end: string } };
    const sorted = Array.from(months).sort();
    const start = sorted[0];
    const end = sorted[sorted.length - 1];
    // enumerate full months between start and end
    const [sy, sm] = start.split('-').map(Number);
    const [ey, em] = end.split('-').map(Number);
    const allBetween: string[] = [];
    for (let y = sy; y <= ey; y++) {
      const mStart = y === sy ? sm : 1;
      const mEnd = y === ey ? em : 12;
      for (let m = mStart; m <= mEnd; m++) {
        allBetween.push(`${y}-${String(m).padStart(2,'0')}`);
      }
    }
    const missing = allBetween.filter(m => !months.has(m));
    return { months: sorted, missing, range: { start, end } };
  }, [allKnownFiles, inbox]);

  // 月ベースの星取ガント用: 各項目×各月の提出有無
  const monthsAxis: string[] = useMemo(() => {
    if (!coverage.range) return [];
    const [sy, sm] = coverage.range.start.split('-').map(Number);
    const [ey, em] = coverage.range.end.split('-').map(Number);
    const list: string[] = [];
    for (let y = sy; y <= ey; y++) {
      const mStart = y === sy ? sm : 1;
      const mEnd = y === ey ? em : 12;
      for (let m = mStart; m <= mEnd; m++) list.push(`${y}-${String(m).padStart(2,'0')}`);
    }
    // 範囲が広すぎる場合は直近12ヶ月に絞る
    if (list.length > 24) return list.slice(-12);
    return list;
  }, [coverage.range]);

  // 未提出のみの列に絞る場合: いずれかの項目で欠損がある月だけ残す
  const monthsAxisFiltered: string[] = useMemo(() => {
    if (!showMissingOnly) return monthsAxis;
    const keep = new Set<string>();
    checklist.forEach(item => {
      monthsAxis.forEach(m => {
        const cell = perItemMonthly[item.id]?.[m];
        if (!cell || !cell.present) keep.add(m);
      });
    });
    return monthsAxis.filter(m => keep.has(m));
  }, [showMissingOnly, monthsAxis, checklist, /* perItemMonthly used later after defined */]);

  const perItemMonthly: Record<string, Record<string, { present: boolean; files: string[] }>> = useMemo(() => {
    const map: Record<string, Record<string, { present: boolean; files: string[] }>> = {};
    const monthCache = new Map<string, string[]>();
    const monthsOf = (d: DocEntry) => {
      const key = d.name + '|' + (d.createdAt || '');
      if (monthCache.has(key)) return monthCache.get(key)!;
      const ms = new Set<string>();
      extractMonthFromName(d.name).forEach(m => ms.add(m));
      extractMonthFromText(d.text).forEach(m => ms.add(m));
      if (ms.size === 0 && d.createdAt) ms.add(monthKey(new Date(d.createdAt)));
      const arr = Array.from(ms);
      monthCache.set(key, arr);
      return arr;
    };
    checklist.forEach(item => {
      const row: Record<string, { present: boolean; files: string[] }> = {};
      monthsAxis.forEach(m => { row[m] = { present: false, files: [] }; });
      // テキスト含めて分類（使用可能なデータのみ）
      const related = usableEntries.filter(d => item.keywords.some(kw => d.text.includes(kw.toLowerCase())));
      related.forEach(d => {
        const ms = monthsOf(d);
        if (ms.length === 0) return; // 月が特定できない
        ms.forEach(mon => { if (row[mon]) { row[mon].present = true; row[mon].files.push(d.name); } });
      });
      map[item.id] = row;
    });
    return map;
  }, [usableEntries, checklist, monthsAxis]);

  // 各項目の未提出タイムライン
  const missingTimeline: Record<string, string[]> = useMemo(() => {
    const out: Record<string, string[]> = {};
    checklist.forEach(item => {
      const row = perItemMonthly[item.id] || {};
      const missing = monthsAxis.filter(m => !row[m]?.present);
      if (missing.length > 0) out[item.id] = missing;
    });
    return out;
  }, [perItemMonthly, monthsAxis, checklist]);

  // 除外ファイル（理由付き）: キーワードは一致するが unusable なもの
  const excludedByItem: Record<string, { name: string; reason?: string }[]> = useMemo(() => {
    const out: Record<string, { name: string; reason?: string }[]> = {};
    checklist.forEach(item => {
      const list: { name: string; reason?: string }[] = [];
      docEntries.forEach(d => {
        if (d.usable) return; // usable は除外対象ではない
        if (item.keywords.some(kw => d.text.includes(kw.toLowerCase()))) {
          list.push({ name: d.name, reason: d.reason });
        }
      });
      if (list.length > 0) out[item.id] = list;
    });
    return out;
  }, [docEntries, checklist]);

  const exportCoverageCsv = () => {
    const lines = [
      'type,value',
      `range_start,${coverage.range?.start ?? ''}`,
      `range_end,${coverage.range?.end ?? ''}`,
      'covered_months,' + (coverage.months.join(' ')),
      'missing_months,' + (coverage.missing.join(' ')),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'coverage_report.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

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
        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-500">最終同期: {lastSyncAt || '未同期'}</div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
              <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} /> 自動更新
            </label>
            <button onClick={reloadInbox} disabled={isReloading || isUploading} className="px-2 py-1 text-xs rounded-md bg-slate-200 dark:bg-slate-700 disabled:opacity-50">再読込{isReloading ? '中' : ''}</button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={simulatorMode} onChange={e => setSimulatorMode(e.target.checked)} /> シミュレーター（DB登録せず可視化）
          </label>
          {simulatorMode && simFiles.length > 0 && (
            <button onClick={persistSimulation} disabled={isUploading} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md disabled:opacity-50">確定アップロード（{simFiles.length}件）</button>
          )}
        </div>

        <div className="flex items-center justify-between">
          <button onClick={runAgent} disabled={isAgentRunning} className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-md disabled:opacity-50">エージェントで再抽出{isAgentRunning ? '中' : ''}</button>
          {agentLog.length > 0 && (
            <div className="text-xs text-slate-500 truncate" title={agentLog.join('\n')}>{agentLog[agentLog.length-1]}</div>
          )}
        </div>

      {/* 月次ガント可視化 */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">月次カバレッジ（星取ガント）</h3>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={showMissingOnly} onChange={e => setShowMissingOnly(e.target.checked)} /> 未提出の月のみ表示
          </label>
        </div>
        {monthsAxis.length === 0 ? (
          <p className="text-sm text-slate-500">期間を推定できませんでした。日付入りのファイル名を含めてください。</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-1">
              <thead>
                <tr>
                  <th className="text-left text-xs text-slate-500 w-48">項目</th>
                  {(showMissingOnly ? monthsAxisFiltered : monthsAxis).map(m => (
                    <th key={m} className="text-xs text-slate-500 px-1 whitespace-nowrap">{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {checklist.map(item => (
                  <tr key={item.id}>
                    <td className="text-sm text-slate-700 dark:text-slate-200 pr-2 whitespace-nowrap">{item.label}</td>
                    {(showMissingOnly ? monthsAxisFiltered : monthsAxis).map(m => {
                      const cell = perItemMonthly[item.id]?.[m] || { present: false, files: [] };
                      const title = cell.files.join('\n');
                      return (
                        <td key={m} title={title} className="px-1">
                          <div className={`h-3 w-5 rounded ${cell.present ? 'bg-green-500' : 'bg-red-500'}`} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 未提出タイムライン（時系列一覧） */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6 space-y-3">
        <h3 className="text-lg font-semibold">未提出の月（時系列）</h3>
        {Object.keys(missingTimeline).length === 0 ? (
          <p className="text-sm text-slate-500">未提出の月はありません。</p>
        ) : (
          <ul className="space-y-2">
            {checklist.map(item => (
              missingTimeline[item.id] ? (
                <li key={item.id} className="text-sm">
                  <span className="font-medium">{item.label}</span>: <span className="text-amber-600">{missingTimeline[item.id].join(', ')}</span>
                </li>
              ) : null
            ))}
          </ul>
        )}
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
                {item.found && item.matched.length > 0 && (
                  <ul className="mt-1 text-xs text-slate-400 list-disc pl-5 space-y-0.5">
                    {item.matched.slice(0, 5).map((n, i) => (<li key={i} title={n} className="truncate">{n}</li>))}
                    {item.matched.length > 5 && <li>他 {item.matched.length - 5} 件...</li>}
                  </ul>
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

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6 space-y-3">
        <h3 className="text-lg font-semibold">提出期間カバレッジ</h3>
        {coverage.range ? (
          <>
            <p className="text-sm text-slate-500">検出期間: <span className="font-medium text-slate-700 dark:text-slate-300">{coverage.range.start}</span> 〜 <span className="font-medium text-slate-700 dark:text-slate-300">{coverage.range.end}</span></p>
            <div className="text-sm">
              <div className="mt-1"><span className="font-medium">カバー済み</span>: {coverage.months.join(', ') || '-'}</div>
              <div className="mt-1 text-amber-600"><span className="font-medium">欠損</span>: {coverage.missing.length > 0 ? coverage.missing.join(', ') : 'なし'}</div>
            </div>
            <div className="flex justify-end mt-2">
              <button onClick={exportCoverageCsv} className="px-3 py-1.5 text-sm bg-slate-200 dark:bg-slate-700 rounded-md">CSVエクスポート</button>
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-500">日付情報を含むファイル名またはアップロード履歴が見つかりませんでした。</p>
        )}
      </div>
    </div>
  );
};

export default AccountingBulkUploadPage;
