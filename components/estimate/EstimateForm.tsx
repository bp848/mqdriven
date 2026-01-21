// components/estimate/EstimateForm.tsx
import React, { useState, useEffect } from 'react';
import { Save, Trash2, Plus, Minus } from 'lucide-react';
import { Estimate, EstimateItem } from '../../types/estimate';

interface EstimateFormProps {
  estimate?: Partial<Estimate>;
  onSave?: (estimate: Partial<Estimate>) => void;
  onCancel?: () => void;
  readOnly?: boolean;
}

export const EstimateForm: React.FC<EstimateFormProps> = ({
  estimate,
  onSave,
  onCancel,
  readOnly = false
}) => {
  const [formData, setFormData] = useState<Partial<Estimate>>({
    title: '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    customerAddress: '',
    content: [],
    subtotal: 0,
    taxRate: 0.10,
    taxAmount: 0,
    totalAmount: 0,
    notes: '',
    issueDate: new Date().toISOString().split('T')[0],
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    ...estimate
  });

  const [items, setItems] = useState<EstimateItem[]>([
    { id: '1', itemName: '', description: '', quantity: 1, unit: '個', unitPrice: 0, discountRate: 0, subtotal: 0 }
  ]);

  useEffect(() => {
    if (estimate?.content) {
      setItems(estimate.content);
    }
  }, [estimate?.content]);

  useEffect(() => {
    // 小計と合計を計算
    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
    const taxAmount = subtotal * formData.taxRate!;
    const totalAmount = subtotal + taxAmount;

    setFormData(prev => ({
      ...prev,
      subtotal,
      taxAmount,
      totalAmount
    }));
  }, [items, formData.taxRate]);

  const addItem = () => {
    const newItem: EstimateItem = {
      id: Date.now().toString(),
      itemName: '',
      description: '',
      quantity: 1,
      unit: '個',
      unitPrice: 0,
      discountRate: 0,
      subtotal: 0
    };
    setItems([...items, newItem]);
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const updateItem = (id: string, field: keyof EstimateItem, value: any) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        // 小計を再計算
        updatedItem.subtotal = Math.round(updatedItem.quantity * updatedItem.unitPrice * (1 - updatedItem.discountRate / 100));
        return updatedItem;
      }
      return item;
    }));
  };

  const handleSave = () => {
    if (!formData.title || !formData.customerName) {
      alert('必須項目を入力してください');
      return;
    }

    const estimateData = {
      ...formData,
      content: items
    };

    onSave?.(estimateData);
  };

  if (readOnly) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">{formData.title}</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">顧客名</label>
            <p className="text-gray-900">{formData.customerName}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">連絡先</label>
            <p className="text-gray-900">{formData.customerEmail}</p>
            <p className="text-gray-900">{formData.customerPhone}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">発行日</label>
            <p className="text-gray-900">{formData.issueDate}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">有効期限</label>
            <p className="text-gray-900">{formData.validUntil}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">明細</label>
            <div className="border rounded-lg overflow-hidden">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">品名</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">数量</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">単価</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">金額</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-2 text-sm">{item.itemName}</td>
                      <td className="px-4 py-2 text-sm text-right">{item.quantity}</td>
                      <td className="px-4 py-2 text-sm text-right">¥{item.unitPrice.toLocaleString()}</td>
                      <td className="px-4 py-2 text-sm text-right">¥{item.subtotal.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="border-t pt-4">
            <div className="flex justify-between text-sm">
              <span>小計:</span>
              <span>¥{formData.subtotal?.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>消費税({(formData.taxRate! * 100).toFixed(0)}%):</span>
              <span>¥{formData.taxAmount?.toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>合計:</span>
              <span>¥{formData.totalAmount?.toLocaleString()}</span>
            </div>
          </div>
          {formData.notes && (
            <div>
              <label className="block text-sm font-medium text-gray-700">備考</label>
              <p className="text-gray-900 whitespace-pre-wrap">{formData.notes}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold mb-4">見積作成</h3>
      
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              見積タイトル *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="例：印刷サービス見積書"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              顧客名 *
            </label>
            <input
              type="text"
              value={formData.customerName}
              onChange={(e) => setFormData(prev => ({ ...prev, customerName: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="例：株式会社ABC"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              メールアドレス
            </label>
            <input
              type="email"
              value={formData.customerEmail}
              onChange={(e) => setFormData(prev => ({ ...prev, customerEmail: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="example@company.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              電話番号
            </label>
            <input
              type="tel"
              value={formData.customerPhone}
              onChange={(e) => setFormData(prev => ({ ...prev, customerPhone: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="03-1234-5678"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            住所
          </label>
          <textarea
            value={formData.customerAddress}
            onChange={(e) => setFormData(prev => ({ ...prev, customerAddress: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={2}
            placeholder="〒000-0000 東京都千代田区..."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              発行日
            </label>
            <input
              type="date"
              value={formData.issueDate}
              onChange={(e) => setFormData(prev => ({ ...prev, issueDate: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              有効期限
            </label>
            <input
              type="date"
              value={formData.validUntil}
              onChange={(e) => setFormData(prev => ({ ...prev, validUntil: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-gray-700">
              明細
            </label>
            <button
              onClick={addItem}
              className="text-blue-600 hover:text-blue-700 text-sm flex items-center"
            >
              <Plus className="w-4 h-4 mr-1" />
              明細を追加
            </button>
          </div>
          
          <div className="border rounded-lg overflow-hidden">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">品名</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">説明</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">数量</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">単位</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">単価</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">金額</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase"></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={item.itemName}
                        onChange={(e) => updateItem(item.id, 'itemName', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        placeholder="品名"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        placeholder="説明"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                        className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-right"
                        min="0"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={item.unit}
                        onChange={(e) => updateItem(item.id, 'unit', e.target.value)}
                        className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                        placeholder="個"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        value={item.unitPrice}
                        onChange={(e) => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                        className="w-24 px-2 py-1 border border-gray-300 rounded text-sm text-right"
                        min="0"
                      />
                    </td>
                    <td className="px-4 py-2 text-right text-sm">
                      ¥{item.subtotal.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="border-t pt-4">
          <div className="flex justify-between text-sm">
            <span>小計:</span>
            <span>¥{formData.subtotal?.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>消費税({(formData.taxRate! * 100).toFixed(0)}%):</span>
            <span>¥{formData.taxAmount?.toLocaleString()}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>合計:</span>
            <span>¥{formData.totalAmount?.toLocaleString()}</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            備考
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
            placeholder="納期、支払条件など"
          />
        </div>

        <div className="flex justify-end space-x-4 pt-4">
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              キャンセル
            </button>
          )}
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
          >
            <Save className="w-4 h-4 mr-2" />
            保存
          </button>
        </div>
      </div>
    </div>
  );
};
