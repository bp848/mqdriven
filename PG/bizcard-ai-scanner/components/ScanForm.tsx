import React, { useState, useEffect } from 'react';
import { Customer } from '../types';
import { Save, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    // Simulate database network latency
    setTimeout(() => {
      const newCustomer: Customer = {
        id: crypto.randomUUID(),
        fullName: formData.fullName || '',
        companyName: formData.companyName || '',
        jobTitle: formData.jobTitle || '',
        email: formData.email || '',
        phoneNumber: formData.phoneNumber || '',
        address: formData.address || '',
        website: formData.website || '',
        scanDate: new Date().toISOString(),
      };
      onSave(newCustomer);
      setIsSaving(false);
    }, 800);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 h-[calc(100vh-140px)] animate-in slide-in-from-right duration-500">
      {/* Left: Image Preview */}
      <div className="w-full lg:w-1/3 bg-gray-900 rounded-xl overflow-hidden shadow-lg flex flex-col">
        <div className="p-4 bg-gray-800 text-white font-medium flex justify-between items-center">
            <span>Original Source</span>
            <span className="text-xs bg-gray-700 px-2 py-1 rounded text-gray-300">Image</span>
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
                    <h2 className="text-lg font-semibold text-gray-900">Verify & Save</h2>
                    <p className="text-sm text-gray-500">Review the AI extracted data before committing to database.</p>
                </div>
                <div className="flex items-center text-green-600 gap-1 text-sm bg-green-50 px-3 py-1 rounded-full border border-green-100">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Gemini OCR Active</span>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Full Name</label>
                        <input
                            required
                            name="fullName"
                            value={formData.fullName || ''}
                            onChange={handleChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                            placeholder="e.g. John Doe"
                        />
                    </div>
                    
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Job Title</label>
                        <input
                            name="jobTitle"
                            value={formData.jobTitle || ''}
                            onChange={handleChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                            placeholder="e.g. Senior Manager"
                        />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                        <label className="text-sm font-medium text-gray-700">Company Name</label>
                        <input
                            required
                            name="companyName"
                            value={formData.companyName || ''}
                            onChange={handleChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                            placeholder="e.g. Acme Corp"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Email</label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email || ''}
                            onChange={handleChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                            placeholder="john@example.com"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Phone</label>
                        <input
                            name="phoneNumber"
                            value={formData.phoneNumber || ''}
                            onChange={handleChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                            placeholder="+1 (555) 000-0000"
                        />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                        <label className="text-sm font-medium text-gray-700">Website</label>
                        <input
                            name="website"
                            value={formData.website || ''}
                            onChange={handleChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                            placeholder="www.example.com"
                        />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                        <label className="text-sm font-medium text-gray-700">Address</label>
                        <input
                            name="address"
                            value={formData.address || ''}
                            onChange={handleChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                            placeholder="123 Business Rd, Tech City"
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
                    {isSaving ? 'Inserting...' : 'Insert into Database'}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};