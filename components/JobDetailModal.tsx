import React, { useState, useEffect } from 'react';
import { Job, JobStatus, InvoiceStatus, ConfirmationDialogProps, Page, Toast, ManufacturingStatus, ProjectBudgetSummary, PurchaseOrderStatus } from '../types';
import { PAPER_TYPES, FINISHING_OPTIONS } from '../constants';
import { X, Pencil, Save, Loader, Trash2, HardHat, FileText } from './Icons';
import JobStatusBadge from './JobStatusBadge';
import { generateMultipagePdf, formatDate, formatJPY } from '../utils';
import ManufacturingOrderPdfContent from './manufacturing/ManufacturingOrderPdfContent';

interface JobDetailModalProps {
  job: Job | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateJob: (jobId: string, updatedData: Partial<Job>) => Promise<void>;
  onDeleteJob: (jobId: string) => Promise<void>;
  requestConfirmation: (dialog: Omit<ConfirmationDialogProps, 'isOpen' | 'onClose'>) => void;
  onNavigate: (page: Page) => void;
  addToast: (message: string, type: Toast['type']) => void;
}

const orderStatusStyles: Record<PurchaseOrderStatus, string> = {
  [PurchaseOrderStatus.Ordered]: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  [PurchaseOrderStatus.Received]: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  [PurchaseOrderStatus.Cancelled]: 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-300',
};

const JobDetailModal: React.FC<JobDetailModalProps> = ({ job, isOpen, onUpdateJob, onDeleteJob, requestConfirmation, onNavigate, addToast, ...props }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<Job>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isPdfLoading, setIsPdfLoading] = useState(false);

  const onClose = () => {
    setIsPdfLoading(false);
    props.onClose();
  };

  useEffect(() => {
    if (job) {
      setFormData(job);
      setIsEditing(false);
    }
  }, [job]);

  const handleGeneratePdf = async () => {
      if (!job) return;
      setIsPdfLoading(true);
      try {
        await new Promise(resolve => setTimeout(resolve, 100)); // allow content to render
        await generateMultipagePdf(
          'manufacturing-order-pdf-content',
          `製造指示書_${job.jobNumber}_${job.title}.pdf`
        );
        addToast('製造指示書PDFが正常に生成されました。', 'success');
      } catch(e) {
          addToast(e instanceof Error ? e.message : 'PDFの生成に失敗しました。', 'error');
      } finally {
          setIsPdfLoading(false);
      }
  };

  if (!isOpen || !job) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: ['quantity', 'price', 'variableCost'].includes(name) ? parseInt(value) || 0 : value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    const updatedData = { ...formData };
    if (job.status !== JobStatus.Completed && updatedData.status === JobStatus.Completed) {
        updatedData.readyToInvoice = true;
        addToast('案件が完了しました。請求管理ページから請求書を作成できます。', 'info');
    }
    await onUpdateJob(job.id, updatedData);
    setIsSaving(false);
    setIsEditing(false);
  };

  const handleDelete = () => {
    requestConfirmation({
        title: '案件を削除',
        message: `本当に案件「${job.title}」を削除しますか？この操作は元に戻せません。`,
        onConfirm: () => onDeleteJob(job.id),
    });
  };

  const renderField = (label: string, value: any, key: keyof Job, type: 'text' | 'number' | 'date' | 'select' | 'textarea', options?: any) => (
    <div>
      <label className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</label>
      <div className="mt-1">
        {isEditing ? (
          <>
            {type === 'select' && (
              <select name={key} value={formData[key] as string || ''} onChange={handleChange} className={inputClass}>
                {options.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            )}
            {type === 'textarea' && <textarea name={key} value={formData[key] as string || ''} onChange={handleChange} className={inputClass} rows={4} />}
            {['text', 'number', 'date'].includes(type) && <input type={type} name={key} value={formData[key] as string || ''} onChange={handleChange} className={inputClass} />}
          </>
        ) : (
          <p className="text-base text-slate-900 dark:text-white min-h-[44px] flex items-center">{value}</p>
        )}
      </div>
    </div>
  );

  const inputClass = "w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500";
  const margin = (formData.price || 0) - (formData.variableCost || 0);
  const summaryJob = job as ProjectBudgetSummary;
  const relatedOrders = summaryJob?.orders ?? [];
  const aggregatedOrderCount = summaryJob?.orderCount ?? relatedOrders.length;
  const aggregatedQuantity = summaryJob?.orderTotalQuantity ?? summaryJob?.totalQuantity ?? job.quantity ?? 0;
  const aggregatedSales = summaryJob?.orderTotalAmount ?? summaryJob?.totalAmount ?? job.price ?? 0;
  const aggregatedCost = summaryJob?.orderTotalCost ?? summaryJob?.totalCost ?? job.variableCost ?? 0;
  const aggregatedMargin = summaryJob?.grossMargin ?? (aggregatedSales - aggregatedCost);

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
          <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-700">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{isEditing ? '案件編集' : '案件詳細'}</h2>
              <p className="text-sm text-slate-500">{job.title} (案件番号: {job.jobNumber})</p>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
          </div>

          <div className="p-6 overflow-y-auto space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="md:col-span-2">{renderField('クライアント名', job.clientName, 'clientName', 'text')}</div>
              <div>
                  <label className="text-sm font-medium text-slate-500 dark:text-slate-400">ステータス</label>
                  <div className="mt-1">
                      {isEditing ? (
                          <select name="status" value={formData.status} onChange={handleChange} className={inputClass}>
                              {Object.values(JobStatus).map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                      ) : <div className="min-h-[44px] flex items-center"><JobStatusBadge status={job.status} /></div>}
                  </div>
              </div>
              <div>
                  <label className="text-sm font-medium text-slate-500 dark:text-slate-400">製造ステータス</label>
                  <div className="mt-1">
                      {isEditing ? (
                          <select name="manufacturingStatus" value={formData.manufacturingStatus} onChange={handleChange} className={inputClass}>
                              {Object.values(ManufacturingStatus).map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                      ) : <div className="min-h-[44px] flex items-center">
                              <span className={`px-2.5 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300`}>
                                  {job.manufacturingStatus || '未設定'}
                              </span>
                          </div>
                      }
                  </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="md:col-span-2"></div>
              {renderField('納期', job.dueDate, 'dueDate', 'date')}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
              {renderField('売上高 (P)', job.price, 'price', 'number')}
              {renderField('変動費 (V)', job.variableCost, 'variableCost', 'number')}
              <div>
                  <label className="text-sm font-medium text-slate-500 dark:text-slate-400">限界利益 (M)</label>
                  <p className="text-xl font-bold p-2.5 text-blue-600 dark:text-blue-400 min-h-[44px] flex items-center">¥{margin.toLocaleString()}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {renderField('数量', job.quantity, 'quantity', 'number')}
              {renderField('用紙', job.paperType, 'paperType', 'select', PAPER_TYPES)}
              {renderField('加工', job.finishing, 'finishing', 'select', FINISHING_OPTIONS)}
            </div>
            {renderField('詳細', job.details, 'details', 'textarea')}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">受注サマリー（orders連携）</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">キャンセル済みの受注は集計から除外しています。</p>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  受注件数: <span className="font-semibold text-slate-900 dark:text-slate-100">{aggregatedOrderCount.toLocaleString()}</span>件 / 合計部数: {aggregatedQuantity.toLocaleString()}
                </div>
              </div>
              {relatedOrders.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 p-4 text-sm text-slate-500 dark:text-slate-400">
                  この案件に紐づく orders レコードがまだありません。
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="rounded-xl bg-slate-50 dark:bg-slate-900/40 p-4">
                      <p className="text-xs uppercase text-slate-500 dark:text-slate-400">売上高 (P)</p>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{formatJPY(aggregatedSales)}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 dark:bg-slate-900/40 p-4">
                      <p className="text-xs uppercase text-slate-500 dark:text-slate-400">原価</p>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{formatJPY(aggregatedCost)}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 dark:bg-emerald-600/10 p-4">
                      <p className="text-xs uppercase text-slate-500 dark:text-emerald-200">限界利益 (M)</p>
                      <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-200 mt-1">{formatJPY(aggregatedMargin)}</p>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl">
                      <thead className="bg-slate-100 dark:bg-slate-700/40 text-xs uppercase text-slate-500 dark:text-slate-200">
                        <tr>
                          <th className="px-3 py-2 text-left">受注ID</th>
                          <th className="px-3 py-2 text-left">受注日</th>
                          <th className="px-3 py-2 text-left">顧客</th>
                          <th className="px-3 py-2 text-right">数量</th>
                          <th className="px-3 py-2 text-right">単価</th>
                          <th className="px-3 py-2 text-right">売上高</th>
                          <th className="px-3 py-2 text-right">ステータス</th>
                        </tr>
                      </thead>
                      <tbody>
                        {relatedOrders.map(order => {
                          const quantity = Number(order.quantity ?? 0);
                          const total = quantity * Number(order.unitPrice ?? 0);
                          return (
                            <tr key={order.id} className="odd:bg-white even:bg-slate-50/60 dark:odd:bg-slate-800 dark:even:bg-slate-900/30 border-b border-slate-100 dark:border-slate-800/70">
                              <td className="px-3 py-2 font-mono text-xs">{order.id?.slice(0, 8)}...</td>
                              <td className="px-3 py-2">{formatDate(order.orderDate)}</td>
                              <td className="px-3 py-2">{order.supplierName || job.clientName}</td>
                              <td className="px-3 py-2 text-right">{quantity.toLocaleString()}</td>
                              <td className="px-3 py-2 text-right">{formatJPY(order.unitPrice ?? 0)}</td>
                              <td className="px-3 py-2 text-right font-semibold">{formatJPY(total)}</td>
                              <td className="px-3 py-2 text-right">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${orderStatusStyles[order.status] || 'bg-slate-200 text-slate-700'}`}>
                                  {order.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex justify-between items-center gap-4 p-6 border-t border-slate-200 dark:border-slate-700">
            <div>
              {isEditing ? (
                  <button onClick={handleDelete} className="flex items-center gap-2 text-red-600 font-semibold py-2 px-4 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/50">
                      <Trash2 className="w-4 h-4" /> 削除
                  </button>
              ) : (
                  <button onClick={handleGeneratePdf} disabled={isPdfLoading} className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold py-2 px-4 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50">
                      {isPdfLoading ? <Loader className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
                      製造指示書作成
                  </button>
              )}
            </div>
            <div className="flex gap-4">
              {!isEditing ? (
                <>
                  <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold py-2 px-4 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600">
                    <Pencil className="w-4 h-4" /> 編集
                  </button>
                  <button onClick={onClose} className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg">閉じる</button>
                </>
              ) : (
                <>
                  <button onClick={() => setIsEditing(false)} className="bg-slate-100 dark:bg-slate-700 font-semibold py-2 px-4 rounded-lg">キャンセル</button>
                  <button onClick={handleSave} disabled={isSaving} className="w-32 flex items-center justify-center bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg disabled:bg-slate-400">
                    {isSaving ? <Loader className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5 mr-2" />保存</>}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      {isPdfLoading && (
        <div style={{ position: 'absolute', left: '-9999px', top: 0, fontFamily: "'Noto Sans JP', sans-serif" }}>
          <ManufacturingOrderPdfContent job={job} />
        </div>
      )}
    </>
  );
};

export default JobDetailModal;
