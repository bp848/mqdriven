import React, { useState, useEffect } from 'react';
import { Customer } from '../types';
import { Save, ArrowLeft, Loader2, CheckCircle2, Database } from 'lucide-react';
import { insertCustomer } from '../services/customerService';

interface ScanFormProps {
  initialData: Partial<Customer>;
  imageData: string | null;
  onSave: (customer: Customer) => void;
  onCancel: () => void;
}

export const ScanForm: React.FC<ScanFormProps> = ({ initialData, imageData, onSave, onCancel }) => {
  const [formData, setFormData] = useState<Partial<Customer>>(initialData);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setFormData(initialData);
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const payload = {
      customer_code: formData.customer_code,
      customer_name: formData.customer_name?.trim() || '',
      customer_name_kana: formData.customer_name_kana,
      post_no: formData.post_no,
      address_1: formData.address_1,
      address_2: formData.address_2,
      phone_number: formData.phone_number,
      fax: formData.fax,
      customer_contact_info: formData.customer_contact_info,
      website_url: formData.website_url,
      representative_name: formData.representative_name?.trim() || '',
      representative: formData.representative,
      zip_code: formData.zip_code,
      note: formData.note,
    };

    try {
      const inserted = await insertCustomer(payload);
      onSave(inserted);
    } catch (error: any) {
      console.error(error);
      alert(error?.message ?? 'Failed to insert customer. Check console for details.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 h-[calc(100vh-140px)] animate-in slide-in-from-right duration-500">
      {/* Left: Image Preview */}
      <div className="w-full lg:w-1/3 bg-gray-900 rounded-xl overflow-hidden shadow-lg flex flex-col">
        <div className="p-4 bg-gray-800 text-white font-medium flex justify-between items-center">
            <span>Source Image</span>
            <span className="text-xs bg-gray-700 px-2 py-1 rounded text-gray-300">BizCard</span>
        </div>
        <div className="flex-1 relative bg-black flex items-center justify-center p-4">
          {imageData ? (
            <img 
              src={imageData} 
              alt="Scanned Card" 
              className="max-w-full max-h-full object-contain rounded border border-gray-700 shadow-2xl" 
            />
          ) : (
            <div className="text-gray-500">No Image</div>
          )}
        </div>
      </div>

      {/* Right: Form */}
      <div className="w-full lg:w-2/3 flex flex-col">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                       <Database className="w-4 h-4 text-indigo-600"/>
                       Insert into `customers`
                    </h2>
                    <p className="text-sm text-gray-500">Map OCR data to database columns</p>
                </div>
                <div className="flex items-center text-green-600 gap-1 text-sm bg-green-50 px-3 py-1 rounded-full border border-green-100">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Mapped</span>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* Representative Name */}
                    <div className="space-y-2">
                        <label className="text-xs font-mono font-medium text-gray-500 uppercase">representative_name</label>
                        <input
                            required
                            name="representative_name"
                            value={formData.representative_name || ''}
                            onChange={handleChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                            placeholder="John Doe"
                        />
                    </div>
                    
                    {/* Note (Job Title) */}
                    <div className="space-y-2">
                        <label className="text-xs font-mono font-medium text-gray-500 uppercase">note (Job Title)</label>
                        <input
                            name="note"
                            value={formData.note || ''}
                            onChange={handleChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                            placeholder="Senior Manager"
                        />
                    </div>

                    {/* Customer Name (Company) */}
                    <div className="space-y-2">
                        <label className="text-xs font-mono font-medium text-gray-500 uppercase">customer_name</label>
                        <input
                            required
                            name="customer_name"
                            value={formData.customer_name || ''}
                            onChange={handleChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                            placeholder="Acme Corp"
                        />
                    </div>

                    {/* Customer Name Kana */}
                    <div className="space-y-2">
                        <label className="text-xs font-mono font-medium text-gray-500 uppercase">customer_name_kana</label>
                        <input
                            name="customer_name_kana"
                            value={formData.customer_name_kana || ''}
                            onChange={handleChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                            placeholder="アクメ"
                        />
                    </div>

                    {/* Contact Info (Email) */}
                    <div className="space-y-2 md:col-span-2">
                        <label className="text-xs font-mono font-medium text-gray-500 uppercase">customer_contact_info (Email)</label>
                        <input
                            type="text"
                            name="customer_contact_info"
                            value={formData.customer_contact_info || ''}
                            onChange={handleChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                            placeholder="john@example.com"
                        />
                    </div>

                    {/* Phone */}
                    <div className="space-y-2">
                        <label className="text-xs font-mono font-medium text-gray-500 uppercase">phone_number</label>
                        <input
                            name="phone_number"
                            value={formData.phone_number || ''}
                            onChange={handleChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                            placeholder="+1 (555) 000-0000"
                        />
                    </div>

                    {/* Website */}
                    <div className="space-y-2">
                        <label className="text-xs font-mono font-medium text-gray-500 uppercase">website_url</label>
                        <input
                            name="website_url"
                            value={formData.website_url || ''}
                            onChange={handleChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                            placeholder="https://..."
                        />
                    </div>

                    {/* Zip */}
                    <div className="space-y-2">
                        <label className="text-xs font-mono font-medium text-gray-500 uppercase">zip_code</label>
                        <input
                            name="zip_code"
                            value={formData.zip_code || ''}
                            onChange={handleChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                            placeholder="100-0001"
                        />
                    </div>

                     {/* Address */}
                    <div className="space-y-2 md:col-span-2">
                        <label className="text-xs font-mono font-medium text-gray-500 uppercase">address_1</label>
                        <input
                            name="address_1"
                            value={formData.address_1 || ''}
                            onChange={handleChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                            placeholder="123 Business Rd"
                        />
                    </div>
                </div>
            </form>

            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
                <button
                    type="button"
                    onClick={onCancel}
                    className="flex items-center gap-2 px-6 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Discard
                </button>
                <button
                    onClick={handleSubmit}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 rounded-lg text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-sm"
                >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {isSaving ? 'INSERT ROW' : 'INSERT ROW'}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};
