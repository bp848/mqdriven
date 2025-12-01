import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Customer, SortConfig, Toast, EmployeeUser } from '../types';
import { Pencil, Eye, Mail, Lightbulb, Users, PlusCircle, Loader, Save, X, Search } from './Icons';
import EmptyState from './ui/EmptyState';
import SortableHeader from './ui/SortableHeader';
import { generateSalesEmail, enrichCustomerData } from '../services/geminiService';
import { createSignature } from '../utils';

interface CustomerListProps {
  customers: Customer[];
  searchTerm: string;
  onSelectCustomer: (customer: Customer) => void;
  onUpdateCustomer: (customerId: string, customerData: Partial<Customer>) => Promise<void>;
  onAnalyzeCustomer: (customer: Customer) => void;
  addToast: (message: string, type: Toast['type']) => void;
  currentUser: EmployeeUser | null;
  onNewCustomer: () => void;
  isAIOff: boolean;
}

const CustomerList: React.FC<CustomerListProps> = ({ customers, searchTerm, onSelectCustomer, onUpdateCustomer, onAnalyzeCustomer, addToast, currentUser, onNewCustomer, isAIOff }) => {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'createdAt', direction: 'descending' });
  const [isGeneratingEmail, setIsGeneratingEmail] = useState<string | null>(null);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editedData, setEditedData] = useState<Partial<Customer>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [enrichingId, setEnrichingId] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
        mounted.current = false;
    };
  }, []);

  const handleEditClick = (e: React.MouseEvent, customer: Customer) => {
    e.stopPropagation();
    setEditingRowId(customer.id);
    setEditedData(customer);
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingRowId(null);
    setEditedData({});
  };

  const handleSaveEdit = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editingRowId) return;
    setIsSaving(true);
    try {
        await onUpdateCustomer(editingRowId, editedData);
    } finally {
        if (mounted.current) {
            setIsSaving(false);
            setEditingRowId(null);
        }
    }
  };

  const handleFieldChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditedData(prev => ({ ...prev, [name]: value }));
  };

  const handleGenerateProposal = async (e: React.MouseEvent, customer: Customer) => {
    e.stopPropagation();
    if (isAIOff) {
        addToast('AI機能は現在無効です。', 'error');
        return;
    }
    if (!currentUser) {
      addToast('ログインユーザー情報が見つかりません。', 'error');
      return;
    }
    setIsGeneratingEmail(customer.id);
    try {
      const { subject, body } = await generateSalesEmail(customer, currentUser.name);
      const signature = createSignature();
      const finalBody = `${body}${signature}`;
      const mailto = `mailto:${customer.customerContactInfo || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(finalBody)}`;
      window.open(mailto, '_blank');
      if (mounted.current) {
          addToast(`「${customer.customerName}」向けのメール下書きを作成しました。`, 'success');
      }
    } catch (error) {
      if (mounted.current) {
          addToast(error instanceof Error ? error.message : 'メール作成に失敗しました', 'error');
      }
    } finally {
      if (mounted.current) {
          setIsGeneratingEmail(null);
      }
    }
  };
  
  const handleEnrich = async (e: React.MouseEvent, customer: Customer) => {
    e.stopPropagation();
    if (isAIOff) {
        addToast('AI機能は現在無効です。', 'error');
        return;
    }
    setEnrichingId(customer.id);
    try {
        const enrichedData = await enrichCustomerData(customer.customerName);
        await onUpdateCustomer(customer.id, enrichedData);
        addToast(`「${customer.customerName}」の情報をAIで更新しました。`, 'success');
    } catch (error) {
        addToast(error instanceof Error ? `情報補完エラー: ${error.message}` : '企業情報の補完に失敗しました。', 'error');
    } finally {
        if (mounted.current) {
            setEnrichingId(null);
        }
    }
  };

  const filteredCustomers = useMemo(() => {
    if (!searchTerm) return customers;
    const lowercasedTerm = searchTerm.toLowerCase();
    return customers.filter(customer => 
      customer.customerName.toLowerCase().includes(lowercasedTerm) ||
      (customer.phoneNumber && customer.phoneNumber.includes(lowercasedTerm))
    );
  }, [customers, searchTerm]);

  const sortedCustomers = useMemo(() => {
    let sortableItems = [...filteredCustomers];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        if (sortConfig.key === 'createdAt') {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return sortConfig.direction === 'ascending' ? aTime - bTime : bTime - aTime;
        }

        const aValue = a[sortConfig.key as keyof Customer];
        const bValue = b[sortConfig.key as keyof Customer];

        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;

        if (String(aValue).toLowerCase() < String(bValue).toLowerCase()) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (String(aValue).toLowerCase() > String(bValue).toLowerCase()) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [filteredCustomers, sortConfig]);

  const requestSort = (key: string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };
  
  if (customers.length === 0 && !searchTerm) {
      return <EmptyState icon={Users} title="顧客が登録されていません" message="最初の顧客を登録して、取引を開始しましょう。" action={{ label: "新規顧客登録", onClick: onNewCustomer, icon: PlusCircle }} />;
  }

  const InlineEditInput: React.FC<{name: keyof Customer, value: any, onChange: (e:React.ChangeEvent<HTMLInputElement>) => void}> = ({ name, value, onChange}) => (
    <input
      type="text"
      name={name}
      value={value || ''}
      onChange={onChange}
      onClick={e => e.stopPropagation()}
      className="w-full bg-blue-50 dark:bg-slate-700 p-1 rounded-md border border-blue-300 dark:border-blue-600 focus:ring-2 focus:ring-blue-500 focus:outline-none"
    />
  );

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-base text-left text-slate-500 dark:text-slate-400">
          <thead className="text-sm text-slate-700 uppercase bg-slate-50 dark:bg-slate-700 dark:text-slate-300">
            <tr>
              <SortableHeader sortKey="customerName" label="顧客名" sortConfig={sortConfig} requestSort={requestSort}/>
              <SortableHeader sortKey="phoneNumber" label="電話番号" sortConfig={sortConfig} requestSort={requestSort} />
              <SortableHeader sortKey="address1" label="住所" sortConfig={sortConfig} requestSort={requestSort} />
              <SortableHeader sortKey="websiteUrl" label="Webサイト" sortConfig={sortConfig} requestSort={requestSort} />
              <th scope="col" className="px-6 py-3 font-medium text-center">操作</th>
            </tr>
          </thead>
          <tbody>
            {sortedCustomers.map((customer) => {
              const isEditing = editingRowId === customer.id;
              return (
              <tr key={customer.id} onClick={() => onSelectCustomer(customer)} className="group bg-white dark:bg-slate-800 border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 odd:bg-slate-50 dark:odd:bg-slate-800/50 cursor-pointer">
                <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">
                  {isEditing ? <InlineEditInput name="customerName" value={editedData.customerName} onChange={handleFieldChange} /> : customer.customerName}
                </td>
                <td className="px-6 py-4">
                    {isEditing ? <InlineEditInput name="phoneNumber" value={editedData.phoneNumber} onChange={handleFieldChange} /> : customer.phoneNumber || '-'}
                </td>
                <td className="px-6 py-4 truncate max-w-sm">
                    {isEditing ? <InlineEditInput name="address1" value={editedData.address1} onChange={handleFieldChange} /> : customer.address1 || '-'}
                </td>
                <td className="px-6 py-4 truncate max-w-xs">
                    {isEditing ? <InlineEditInput name="websiteUrl" value={editedData.websiteUrl} onChange={handleFieldChange} /> : (
                      customer.websiteUrl ? <a href={customer.websiteUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-blue-600 hover:underline">{customer.websiteUrl}</a> : '-'
                    )}
                </td>
                <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                        {isEditing ? (
                            <>
                                <button onClick={handleSaveEdit} disabled={isSaving} className="p-2 rounded-full text-slate-500 hover:bg-green-100 hover:text-green-600 dark:hover:bg-green-900/50" title="保存">
                                    {isSaving ? <Loader className="w-5 h-5 animate-spin"/> : <Save className="w-5 h-5"/>}
                                </button>
                                <button onClick={handleCancelEdit} className="p-2 rounded-full text-slate-500 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/50" title="キャンセル">
                                    <X className="w-5 h-5"/>
                                </button>
                            </>
                        ) : (
                            <>
                                <button onClick={() => onSelectCustomer(customer)} className="p-2 rounded-full text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700" title="詳細表示"><Eye className="w-5 h-5"/></button>
                                <button onClick={(e) => handleEditClick(e, customer)} className="p-2 rounded-full text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700" title="インライン編集"><Pencil className="w-5 h-5"/></button>
                                {!isAIOff && <button onClick={(e) => handleEnrich(e, customer)} disabled={enrichingId === customer.id} className="p-2 rounded-full text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700" title="AIで企業情報補完">
                                    {enrichingId === customer.id ? <Loader className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                                </button>}
                                <button onClick={(e) => {e.stopPropagation(); onAnalyzeCustomer(customer)}} disabled={isAIOff} className="p-2 rounded-full text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50" title="AI企業分析"><Lightbulb className="w-5 h-5"/></button>
                                <button onClick={(e) => handleGenerateProposal(e, customer)} disabled={isGeneratingEmail === customer.id || isAIOff} className="p-2 rounded-full text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50" title="提案メール作成">
                                  {isGeneratingEmail === customer.id ? <Loader className="w-5 h-5 animate-spin" /> : <Mail className="w-5 h-5" />}
                                </button>
                            </>
                        )}
                    </div>
                </td>
              </tr>
            )})}
             {sortedCustomers.length === 0 && (
              <tr>
                <td colSpan={5}>
                    <EmptyState 
                        icon={Users}
                        title="検索結果がありません"
                        message="検索条件を変更して、もう一度お試しください。"
                    />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default React.memo(CustomerList);
