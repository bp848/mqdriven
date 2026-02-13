import React, { useMemo } from 'react';
import { Estimate } from '../../types.ts';

type Props = { estimate: Estimate; footerLeft?: string; footerRight?: string };

const DEFAULT_TAX_RATE = 0.1;

const formatCurrency = (value?: number) => `¥${Number(value ?? 0).toLocaleString()}`;

export const EstimatePdfContent: React.FC<Props> = ({ estimate, footerLeft, footerRight }) => {
  const normalizedItems = useMemo(() => {
    return estimate.items.map(item => {
      const name = item.name ?? item.content ?? '';
      const qty = item.qty ?? item.quantity ?? 0;
      const unitPrice = item.unitPrice ?? 0;
      const subtotal = item.subtotal ?? item.price ?? qty * unitPrice;
      const taxAmount = item.taxAmount ?? Math.round(subtotal * DEFAULT_TAX_RATE);
      const total = item.total ?? subtotal + taxAmount;
      return {
        name,
        qty,
        unit: item.unit ?? '',
        unitPrice,
        subtotal,
        taxAmount,
        total,
      };
    });
  }, [estimate.items]);

  const totals = useMemo(() => {
    const subtotal = Number(estimate.subtotal) ?? normalizedItems.reduce((sum, item) => sum + Number(item.subtotal), 0);
    const taxTotal = Number(estimate.taxTotal) ?? Math.round(subtotal * DEFAULT_TAX_RATE);
    const grandTotal = estimate.grandTotal ?? subtotal + taxTotal;
    return { subtotal, taxTotal, grandTotal };
  }, [estimate.subtotal, estimate.taxTotal, estimate.grandTotal, normalizedItems]);

  // 画面プレビュー用（実PDFは generateMultipagePdf を使用）
  return (
    <div className="w-full h-full p-6 text-sm text-white bg-[#1E1E2F]" style={{ overflow: 'hidden' }}>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">御見積書</h1>
        <div>発行日: {new Date(estimate.createdAt).toLocaleDateString('ja-JP')}</div>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div>
          <div className="opacity-70">件名</div>
          <div className="font-medium">{estimate.title}</div>
        </div>
        <div>
          <div className="opacity-70">支払条件</div>
          <div className="font-medium">{estimate.paymentTerms ?? '—'}</div>
        </div>
        <div>
          <div className="opacity-70">納期</div>
          <div className="font-medium">{estimate.deliveryTerms ?? '—'}</div>
        </div>
      </div>
      <table className="w-full border border-[#444]">
        <thead className="bg-[#23233a]">
          <tr>
            <th className="border border-[#444] p-2 text-left">品目</th>
            <th className="border border-[#444] p-2">数量</th>
            <th className="border border-[#444] p-2">単価</th>
            <th className="border border-[#444] p-2">小計</th>
            <th className="border border-[#444] p-2">税額</th>
            <th className="border border-[#444] p-2">合計</th>
          </tr>
        </thead>
        <tbody>
          {normalizedItems.map((it, i) => (
            <tr key={i}>
              <td className="border border-[#444] p-2">{it.name || '-'}</td>
              <td className="border border-[#444] p-2 text-center">
                {it.qty}{it.unit}
              </td>
              <td className="border border-[#444] p-2 text-right">{formatCurrency(it.unitPrice)}</td>
              <td className="border border-[#444] p-2 text-right">{formatCurrency(it.subtotal)}</td>
              <td className="border border-[#444] p-2 text-right">{formatCurrency(it.taxAmount)}</td>
              <td className="border border-[#444] p-2 text-right">{formatCurrency(it.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="grid grid-cols-3 gap-3 mt-4">
        <div />
        <div />
        <div className="border border-[#444] p-3">
          <div className="flex justify-between">
            <span>小計</span><span>{formatCurrency(Number(totals.subtotal))}</span>
          </div>
          <div className="flex justify-between">
            <span>消費税</span><span>{formatCurrency(totals.taxTotal)}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>合計</span><span>{formatCurrency(totals.grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* フッター相当（固定ヘッダー運用のためPDF生成時のみ適用） */}
      <div className="mt-6 text-xs opacity-70 flex justify-between">
        <span>{footerLeft ?? ''}</span>
        <span>{footerRight ?? ''}</span>
      </div>
    </div>
  );
};

// 実PDF生成（jsPDF などに置換想定。ここは最小限のHTML→blob生成）
export async function generateMultipagePdf(html: string): Promise<Blob> {
  // 実運用は @react-pdf/renderer, jsPDF, pdf-lib 等に差し替え
  // ここでは簡易に HTML を Blob(PDF風)として返却（プリンタドライバでPDF化想定）
  return new Blob([html], { type: 'application/pdf' });
}
