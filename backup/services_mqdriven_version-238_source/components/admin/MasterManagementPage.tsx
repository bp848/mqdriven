import React, { useState } from 'react';
import { AccountItem, PaymentRecipient, Toast, ConfirmationDialogProps, AllocationDivision, Department, Title } from '../../types';
import { Loader, PlusCircle, Pencil, Trash2, Eye } from '../Icons';
import AccountItemModal from './AccountItemModal';
import PaymentRecipientModal from './PaymentRecipientModal';
import AllocationDivisionModal from './AllocationDivisionModal';
import DepartmentModal from './DepartmentModal';
import TitleModal from './TitleModal';

interface MasterManagementPageProps {
  accountItems: AccountItem[];
  paymentRecipients: PaymentRecipient[];
  allocationDivisions: AllocationDivision[];
  departments: Department[];
  titles: Title[];
  onSaveAccountItem: (item: Partial<AccountItem>) => Promise<void>;
  onDeleteAccountItem: (id: string) => Promise<void>;
  onSavePaymentRecipient: (item: Partial<PaymentRecipient>) => Promise<void>;
  onDeletePaymentRecipient: (id: string) => Promise<void>;
  onSaveAllocationDivision: (item: Partial<AllocationDivision>) => Promise<void>;
  onDeleteAllocationDivision: (id: string) => Promise<void>;
  onSaveDepartment: (item: Partial<Department>) => Promise<void>;
  onDeleteDepartment: (id: string) => Promise<void>;
  onSaveTitle: (item: Partial<Title>) => Promise<void>;
  onDeleteTitle: (id: string) => Promise<void>;
  addToast: (message: string, type: Toast['type']) => void;
  requestConfirmation: (dialog: Omit<ConfirmationDialogProps, 'isOpen' | 'onClose'>) => void;
}

type Tab = 'accounts' | 'recipients' | 'allocations' | 'departments' | 'titles';

const MasterManagementPage: React.FC<MasterManagementPageProps> = (props) => {
  const [activeTab, setActiveTab] = useState<Tab>('accounts');

  const tabs: {id: Tab, label: string}[] = [
      { id: 'accounts', label: '勘定科目管理' },
      { id: 'recipients', label: '支払先管理' },
      { id: 'allocations', label: '振分区分管理' },
      { id: 'departments', label: '部署管理' },
      { id: 'titles', label: '役職管理' },
  ];

  return (
    <div className="space-y-6">
        <div className="border-b border-slate-200 dark:border-slate-700">
            <nav className="-mb-px flex space-x-6">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-base ${activeTab === tab.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </nav>
        </div>
        
        {activeTab === 'accounts' && <AccountItemsManager {...props} />}
        {activeTab === 'recipients' && <PaymentRecipientsManager {...props} />}
        {activeTab === 'allocations' && <AllocationDivisionsManager {...props} />}
        {activeTab === 'departments' && <DepartmentsManager {...props} />}
        {activeTab === 'titles' && <TitlesManager {...props} />}
    </div>
  );
};

// ... (AccountItemsManager and PaymentRecipientsManager remain the same)

const AccountItemsManager: React.FC<MasterManagementPageProps> = ({ accountItems, onSaveAccountItem, onDeleteAccountItem, requestConfirmation, addToast }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<AccountItem | null>(null);

    const handleOpenModal = (item: AccountItem | null) => {
        setSelectedItem(item);
        setIsModalOpen(true);
    };

    const handleSave = async (item: Partial<AccountItem>) => {
        await onSaveAccountItem(item);
        setIsModalOpen(false);
    };

    const handleDelete = (item: AccountItem) => {
        requestConfirmation({
            title: '勘定科目を無効化',
            message: `本当に勘定科目「${item.name}」を無効にしますか？関連データに影響する可能性があります。`,
            onConfirm: () => onDeleteAccountItem(item.id),
        });
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm">
             <div className="p-4 border-b flex justify-between items-center">
                 <h3 className="text-lg font-semibold">勘定科目マスタ</h3>
                 <button onClick={() => handleOpenModal(null)} className="flex items-center gap-2 bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg"><PlusCircle className="w-5 h-5"/>新規追加</button>
             </div>
             <table className="w-full text-base">
                 <thead className="text-sm bg-slate-50 dark:bg-slate-700"><tr>{['コード', '名称', 'カテゴリ', '有効', '操作'].map(h => <th key={h} className="px-6 py-3 text-left font-medium">{h}</th>)}</tr></thead>
                 <tbody>
                    {accountItems.sort((a,b) => a.code.localeCompare(b.code)).map(item => (
                        <tr key={item.id} className="border-b dark:border-slate-700">
                            <td className="px-6 py-4">{item.code}</td>
                            <td className="px-6 py-4 font-medium">{item.name}</td>
                            <td className="px-6 py-4">{item.categoryCode}</td>
                            <td className="px-6 py-4">{item.isActive ? 'はい' : 'いいえ'}</td>
                            <td className="px-6 py-4 flex items-center gap-2"><button onClick={() => handleOpenModal(item)} className="p-1"><Pencil className="w-5 h-5"/></button><button onClick={() => handleDelete(item)} className="p-1"><Trash2 className="w-5 h-5 text-red-500"/></button></td>
                        </tr>
                    ))}
                 </tbody>
             </table>
             {isModalOpen && <AccountItemModal item={selectedItem} onClose={() => setIsModalOpen(false)} onSave={handleSave} />}
        </div>
    );
};

const PaymentRecipientsManager: React.FC<MasterManagementPageProps> = ({ paymentRecipients, onSavePaymentRecipient, onDeletePaymentRecipient, requestConfirmation, addToast }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<PaymentRecipient | null>(null);

    const handleOpenModal = (item: PaymentRecipient | null) => {
        setSelectedItem(item);
        setIsModalOpen(true);
    };
    
    const handleSave = async (item: Partial<PaymentRecipient>) => {
        await onSavePaymentRecipient(item);
        setIsModalOpen(false);
    };

    const handleDelete = (item: PaymentRecipient) => {
        requestConfirmation({
            title: '支払先を削除',
            message: `本当に支払先「${item.companyName || item.recipientName}」を削除しますか？`,
            onConfirm: () => onDeletePaymentRecipient(item.id),
        });
    };
    
    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm">
             <div className="p-4 border-b flex justify-between items-center">
                 <h3 className="text-lg font-semibold">支払先マスタ</h3>
                 <button onClick={() => handleOpenModal(null)} className="flex items-center gap-2 bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg"><PlusCircle className="w-5 h-5"/>新規追加</button>
             </div>
             <table className="w-full text-base">
                 <thead className="text-sm bg-slate-50 dark:bg-slate-700"><tr>{['コード', '会社名', '受取人名', '操作'].map(h => <th key={h} className="px-6 py-3 text-left font-medium">{h}</th>)}</tr></thead>
                 <tbody>
                    {paymentRecipients.map(item => (
                        <tr key={item.id} className="border-b dark:border-slate-700">
                            <td className="px-6 py-4">{item.recipientCode}</td>
                            <td className="px-6 py-4 font-medium">{item.companyName}</td>
                            <td className="px-6 py-4">{item.recipientName}</td>
                            <td className="px-6 py-4 flex items-center gap-2"><button onClick={() => handleOpenModal(item)} className="p-1"><Pencil className="w-5 h-5"/></button><button onClick={() => handleDelete(item)} className="p-1"><Trash2 className="w-5 h-5 text-red-500"/></button></td>
                        </tr>
                    ))}
                 </tbody>
             </table>
             {isModalOpen && <PaymentRecipientModal item={selectedItem} onClose={() => setIsModalOpen(false)} onSave={handleSave} />}
        </div>
    );
};

const AllocationDivisionsManager: React.FC<MasterManagementPageProps> = ({ allocationDivisions, onSaveAllocationDivision, onDeleteAllocationDivision, requestConfirmation }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<AllocationDivision | null>(null);

    const handleOpenModal = (item: AllocationDivision | null) => {
        setSelectedItem(item);
        setIsModalOpen(true);
    };
    
    const handleSave = async (item: Partial<AllocationDivision>) => {
        await onSaveAllocationDivision(item);
        setIsModalOpen(false);
    };

    const handleDelete = (item: AllocationDivision) => {
        requestConfirmation({
            title: '振分区分を削除',
            message: `本当に振分区分「${item.name}」を削除しますか？`,
            onConfirm: () => onDeleteAllocationDivision(item.id),
        });
    };
    
    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm">
             <div className="p-4 border-b flex justify-between items-center">
                 <h3 className="text-lg font-semibold">振分区分マスタ</h3>
                 <button onClick={() => handleOpenModal(null)} className="flex items-center gap-2 bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg"><PlusCircle className="w-5 h-5"/>新規追加</button>
             </div>
             <table className="w-full text-base">
                 <thead className="text-sm bg-slate-50 dark:bg-slate-700"><tr>{['名称', '有効', '操作'].map(h => <th key={h} className="px-6 py-3 text-left font-medium">{h}</th>)}</tr></thead>
                 <tbody>
                    {allocationDivisions.map(item => (
                        <tr key={item.id} className="border-b dark:border-slate-700">
                            <td className="px-6 py-4 font-medium">{item.name}</td>
                            <td className="px-6 py-4">{item.isActive ? 'はい' : 'いいえ'}</td>
                            <td className="px-6 py-4 flex items-center gap-2"><button onClick={() => handleOpenModal(item)} className="p-1"><Pencil className="w-5 h-5"/></button><button onClick={() => handleDelete(item)} className="p-1"><Trash2 className="w-5 h-5 text-red-500"/></button></td>
                        </tr>
                    ))}
                 </tbody>
             </table>
             {isModalOpen && <AllocationDivisionModal item={selectedItem} onClose={() => setIsModalOpen(false)} onSave={handleSave} />}
        </div>
    );
};

const DepartmentsManager: React.FC<MasterManagementPageProps> = ({ departments, onSaveDepartment, onDeleteDepartment, requestConfirmation }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<Department | null>(null);

    const handleOpenModal = (item: Department | null) => {
        setSelectedItem(item);
        setIsModalOpen(true);
    };
    
    const handleSave = async (item: Partial<Department>) => {
        await onSaveDepartment(item);
        setIsModalOpen(false);
    };

    const handleDelete = (item: Department) => {
        requestConfirmation({
            title: '部署を削除',
            message: `本当に部署「${item.name}」を削除しますか？`,
            onConfirm: () => onDeleteDepartment(item.id),
        });
    };
    
    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm">
             <div className="p-4 border-b flex justify-between items-center">
                 <h3 className="text-lg font-semibold">部署マスタ</h3>
                 <button onClick={() => handleOpenModal(null)} className="flex items-center gap-2 bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg"><PlusCircle className="w-5 h-5"/>新規追加</button>
             </div>
             <table className="w-full text-base">
                 <thead className="text-sm bg-slate-50 dark:bg-slate-700"><tr>{['名称', '操作'].map(h => <th key={h} className="px-6 py-3 text-left font-medium">{h}</th>)}</tr></thead>
                 <tbody>
                    {departments.map(item => (
                        <tr key={item.id} className="border-b dark:border-slate-700">
                            <td className="px-6 py-4 font-medium">{item.name}</td>
                            <td className="px-6 py-4 flex items-center gap-2"><button onClick={() => handleOpenModal(item)} className="p-1"><Pencil className="w-5 h-5"/></button><button onClick={() => handleDelete(item)} className="p-1"><Trash2 className="w-5 h-5 text-red-500"/></button></td>
                        </tr>
                    ))}
                 </tbody>
             </table>
             {isModalOpen && <DepartmentModal item={selectedItem} onClose={() => setIsModalOpen(false)} onSave={handleSave} />}
        </div>
    );
};

const TitlesManager: React.FC<MasterManagementPageProps> = ({ titles, onSaveTitle, onDeleteTitle, requestConfirmation }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<Title | null>(null);

    const handleOpenModal = (item: Title | null) => {
        setSelectedItem(item);
        setIsModalOpen(true);
    };
    
    const handleSave = async (item: Partial<Title>) => {
        await onSaveTitle(item);
        setIsModalOpen(false);
    };

    const handleDelete = (item: Title) => {
        requestConfirmation({
            title: '役職を削除',
            message: `本当に役職「${item.name}」を削除しますか？`,
            onConfirm: () => onDeleteTitle(item.id),
        });
    };
    
    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm">
             <div className="p-4 border-b flex justify-between items-center">
                 <h3 className="text-lg font-semibold">役職マスタ</h3>
                 <button onClick={() => handleOpenModal(null)} className="flex items-center gap-2 bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg"><PlusCircle className="w-5 h-5"/>新規追加</button>
             </div>
             <table className="w-full text-base">
                 <thead className="text-sm bg-slate-50 dark:bg-slate-700"><tr>{['名称', '有効', '操作'].map(h => <th key={h} className="px-6 py-3 text-left font-medium">{h}</th>)}</tr></thead>
                 <tbody>
                    {titles.map(item => (
                        <tr key={item.id} className="border-b dark:border-slate-700">
                            <td className="px-6 py-4 font-medium">{item.name}</td>
                             <td className="px-6 py-4">{item.isActive ? 'はい' : 'いいえ'}</td>
                            <td className="px-6 py-4 flex items-center gap-2"><button onClick={() => handleOpenModal(item)} className="p-1"><Pencil className="w-5 h-5"/></button><button onClick={() => handleDelete(item)} className="p-1"><Trash2 className="w-5 h-5 text-red-500"/></button></td>
                        </tr>
                    ))}
                 </tbody>
             </table>
             {isModalOpen && <TitleModal item={selectedItem} onClose={() => setIsModalOpen(false)} onSave={handleSave} />}
        </div>
    );
};


export default MasterManagementPage;