
import React, { useState } from 'react';
import { QuoteFormData } from '../types';
import { BOOK_SIZES, PAPER_TYPES, COLOR_OPTIONS, BINDING_OPTIONS, SPECIAL_PROCESSING_OPTIONS, MAIN_CATEGORIES, SUB_CATEGORIES } from '../constants';
import FormInput from './FormInput';
import FormSelect from './FormSelect';

interface QuoteFormProps {
  onSubmit: (formData: Omit<QuoteFormData, 'markup'> & { markup: number }) => void;
  isLoading: boolean;
}

const QuoteForm: React.FC<QuoteFormProps> = ({ onSubmit, isLoading }) => {
  // Added missing QuoteFormData fields to initial state to resolve TypeScript errors
  const [formData, setFormData] = useState<Omit<QuoteFormData, 'markup'> & { markup: string }>({
    customerName: '',
    salesStaff: '',
    mainCategory: MAIN_CATEGORIES[0].id,
    subCategory: SUB_CATEGORIES[0],
    title: '',
    pages: 48,
    size: BOOK_SIZES[0],
    coverPaper: PAPER_TYPES[1],
    // Corrected index to be within bounds (PAPER_TYPES has 6 items, index 6 was invalid)
    innerPaper: PAPER_TYPES[0],
    color: COLOR_OPTIONS[0],
    binding: BINDING_OPTIONS[0],
    quantity: 100,
    specialProcessing: SPECIAL_PROCESSING_OPTIONS[0],
    markup: '30',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
     setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
        ...formData,
        pages: parseInt(formData.pages.toString(), 10),
        quantity: parseInt(formData.quantity.toString(), 10),
        markup: parseFloat(formData.markup),
    });
  };

  return (
    <div className="bg-white/80 backdrop-blur-sm p-6 md:p-8 rounded-2xl shadow-lg border border-gray-200">
      <h2 className="text-2xl font-bold mb-6 text-slate-900">印刷仕様入力</h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <FormInput
          label="書籍タイトル (任意)"
          name="title"
          type="text"
          value={formData.title}
          onChange={handleChange}
          placeholder="例: 2024年度事業計画書"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <FormInput
            label="ページ数"
            name="pages"
            type="number"
            value={formData.pages.toString()}
            onChange={handleChange}
            min="4"
            required
          />
          <FormInput
            label="部数"
            name="quantity"
            type="number"
            value={formData.quantity.toString()}
            onChange={handleChange}
            min="1"
            required
          />
        </div>
        <FormSelect label="サイズ" name="size" value={formData.size} onChange={handleChange} options={BOOK_SIZES} />
        <FormSelect label="色" name="color" value={formData.color} onChange={handleChange} options={COLOR_OPTIONS} />
        <FormSelect label="製本方法" name="binding" value={formData.binding} onChange={handleChange} options={BINDING_OPTIONS} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <FormSelect label="表紙用紙" name="coverPaper" value={formData.coverPaper} onChange={handleChange} options={PAPER_TYPES} />
            <FormSelect label="本文用紙" name="innerPaper" value={formData.innerPaper} onChange={handleChange} options={PAPER_TYPES} />
        </div>
        <FormSelect label="特殊加工" name="specialProcessing" value={formData.specialProcessing} onChange={handleChange} options={SPECIAL_PROCESSING_OPTIONS} />
        
        <FormInput
            label="利益率 (%)"
            name="markup"
            type="number"
            value={formData.markup}
            onChange={handleChange}
            min="0"
            step="0.1"
            required
        />

        <button
          type="submit"
          disabled={isLoading}
          className="w-full mt-4 bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-300 ease-in-out disabled:bg-blue-300 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              見積もり作成中...
            </>
          ) : (
            '見積もり作成'
          )}
        </button>
      </form>
    </div>
  );
};

export default QuoteForm;
