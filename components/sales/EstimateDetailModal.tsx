import React, { useState } from 'react';
import { Estimate, Toast } from '../../types';
import { X, FileText, Loader, Pencil } from '../Icons';
import { formatJPY, formatDate } from '../../utils';

declare const jspdf: any;
declare const html2canvas: any;

interface EstimateDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    estimate: Estimate | null;
    addToast: (message: string, type: Toast['type']) => void;
    onEdit: () => void;
}

const EstimateDetailModal: React.FC<EstimateDetailModalProps> = ({ isOpen, onClose, estimate, addToast, onEdit }) => {
    const [isPdfLoading, setIsPdfLoading] = useState(false);

    const handleGeneratePdf = async () => {
        if (!estimate) return;
        setIsPdfLoading(true);
        const input = document.getElementById('estimate-pdf-content');
        if (!input) {
            addToast('PDF生成用の要素が見つかりません。', 'error');
            setIsPdfLoading(false);
            return;
        }

        try {
            const canvas = await html2canvas(input, { scale: 2, useCORS: true });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jspdf.jsPDF({
                orientation: 'p',
                unit: 'px',
                format: [canvas.width, canvas.height]
            });
            pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
            pdf.save(`見積書_${estimate.estimateNumber}_${estimate.customerName}.pdf`);
            addToast('見積書PDFが正常に生成されました。', 'success');
        } catch (error) {
            console.error("PDF generation failed", error);
            addToast('PDFの生成に失敗しました。', 'error');
        } finally {
            setIsPdfLoading(false);
        }
    };

    if (!isOpen || !estimate) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[60] p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-700">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">見積詳細</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X className="w-6 h-6" /></button>
                </div>

                <div className="p-6 overflow-y-auto">
                    <div id="estimate-pdf-content" className="p-8 bg-white text-black">
                        <header className="flex justify-between items-start pb-4 border-b">
                            <div>
                                <h1 className="text-3xl font-bold">御 見 積 書</h1>
                                <p className="mt-4 text-lg border-b-2 border-black inline-block pb-1">{estimate.customerName} 御中</p>
                            </div>
                            <div className="text-right">
                                <p>No. {estimate.estimateNumber}</p>
                                <p>発行日: {formatDate(estimate.createdAt)}</p>
                                <div className="mt-4 border border-black p-2 text-left">
                                    <p className="font-bold text-lg">文唱堂印刷株式会社</p>
                                    <p>〒101-0025</p>
                                    <p>東京都千代田区神田佐久間町3-37</p>
                                    <p>TEL: 03-3851-0111</p>
                                </div>
                            </div>
                        </header>
                        <main className="mt-6">
                            <p><span className="font-bold">件名:</span> {estimate.title}</p>
                            <div className="text-right mt-2 mb-4">
                                <p className="text-2xl font-bold">合計金額: <span className="border-b-4 border-double border-black px-2">{formatJPY(Number(estimate.total) * 1.1)}</span></p>
                            </div>
                            <table className="w-full border-collapse border border-black text-sm">
                                <thead>
                                    <tr className="bg-slate-100">
                                        <th className="border border-black p-2">区分</th>
                                        <th className="border border-black p-2">内容</th>
                                        <th className="border border-black p-2">数量</th>
                                        <th className="border border-black p-2">単位</th>
                                        <th className="border border-black p-2">単価</th>
                                        <th className="border border-black p-2">金額</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {estimate.items.map((item, index) => (
                                        <tr key={index}>
                                            <td className="border border-black p-2">{item.division}</td>
                                            <td className="border border-black p-2">{item.content}</td>
                                            <td className="border border-black p-2 text-right">{item.quantity.toLocaleString()}</td>
                                            <td className="border border-black p-2">{item.unit}</td>
                                            <td className="border border-black p-2 text-right">{formatJPY(item.unitPrice)}</td>
                                            <td className="border border-black p-2 text-right">{formatJPY(item.price)}</td>
                                        </tr>
                                    ))}
                                    {/* Add empty rows for spacing */}
                                    {Array.from({ length: 10 - estimate.items.length }).map((_, i) => (
                                        <tr key={`empty-${i}`}><td className="border border-black p-2 h-8" colSpan={6}></td></tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td colSpan={4} className="border border-black p-2 text-right font-bold">小計</td>
                                        <td colSpan={2} className="border border-black p-2 text-right font-bold">{formatJPY(Number(estimate.total))}</td>
                                    </tr>
                                    <tr>
                                        <td colSpan={4} className="border border-black p-2 text-right font-bold">消費税 (10%)</td>
                                        <td colSpan={2} className="border border-black p-2 text-right font-bold">{formatJPY(Number(estimate.total) * 0.1)}</td>
                                    </tr>
                                    <tr>
                                        <td colSpan={4} className="border border-black p-2 text-right font-bold bg-slate-100">合計</td>
                                        <td colSpan={2} className="border border-black p-2 text-right font-bold bg-slate-100">{formatJPY(Number(estimate.total) * 1.1)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                            <div className="mt-4 border border-black p-2 text-sm">
                                <p className="font-bold">備考</p>
                                <p className="whitespace-pre-wrap">{estimate.notes}</p>
                            </div>
                        </main>
                    </div>
                </div>

                <div className="flex justify-between items-center gap-4 p-6 border-t border-slate-200 dark:border-slate-700">
                    <div>
                        <button onClick={onEdit} className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 font-semibold py-2 px-4 rounded-lg hover:bg-slate-200">
                            <Pencil className="w-4 h-4" /> 編集
                        </button>
                    </div>
                    <div className="flex gap-4">
                        <button onClick={onClose} className="font-semibold py-2 px-4 rounded-lg">キャンセル</button>
                        <button onClick={handleGeneratePdf} disabled={isPdfLoading} className="flex items-center gap-2 bg-green-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-green-700 disabled:bg-slate-400">
                            {isPdfLoading ? <Loader className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
                            PDF出力
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EstimateDetailModal;
