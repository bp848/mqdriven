import React, { useState } from 'react';
import { PlusCircle, Search, Filter, Edit, Trash2, Eye, Download } from 'lucide-react';

interface Estimate {
  id: string;
  estimateNumber: string;
  customerName: string;
  projectName: string;
  amount: number;
  status: 'draft' | 'sent' | 'approved' | 'rejected' | 'expired';
  createdAt: string;
  validUntil: string;
}

interface SimpleEstimatePageProps {
  currentUser: any;
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

const SimpleEstimatePage: React.FC<SimpleEstimatePageProps> = ({ currentUser, addToast }) => {
  const [estimates, setEstimates] = useState<Estimate[]>([
    {
      id: '1',
      estimateNumber: 'EST-2024-001',
      customerName: '株式会社ABC',
      projectName: 'ウェブサイト開発',
      amount: 500000,
      status: 'draft',
      createdAt: '2024-01-15',
      validUntil: '2024-02-15'
    },
    {
      id: '2',
      estimateNumber: 'EST-2024-002',
      customerName: '株式会社XYZ',
      projectName: 'モバイルアプリ開発',
      amount: 800000,
      status: 'sent',
      createdAt: '2024-01-20',
      validUntil: '2024-02-20'
    },
    {
      id: '3',
      estimateNumber: 'EST-2024-003',
      customerName: '有限会社DEF',
      projectName: 'システム保守',
      amount: 300000,
      status: 'approved',
      createdAt: '2024-01-25',
      validUntil: '2024-02-25'
    }
  ]);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEstimate, setSelectedEstimate] = useState<Estimate | null>(null);

  const filteredEstimates = estimates.filter(estimate => {
    const matchesSearch = estimate.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         estimate.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         estimate.estimateNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || estimate.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { bg: 'bg-gray-100', text: 'text-gray-800', label: '下書き' },
      sent: { bg: 'bg-blue-100', text: 'text-blue-800', label: '送付済み' },
      approved: { bg: 'bg-green-100', text: 'text-green-800', label: '承認済み' },
      rejected: { bg: 'bg-red-100', text: 'text-red-800', label: '却下' },
      expired: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: '期限切れ' }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig];
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY'
    }).format(amount);
  };

  const handleCreateEstimate = () => {
    setSelectedEstimate(null);
    setIsModalOpen(true);
  };

  const handleEditEstimate = (estimate: Estimate) => {
    setSelectedEstimate(estimate);
    setIsModalOpen(true);
  };

  const handleDeleteEstimate = (estimateId: string) => {
    if (confirm('この見積書を削除してもよろしいですか？')) {
      setEstimates(prev => prev.filter(e => e.id !== estimateId));
      addToast('見積書を削除しました', 'success');
    }
  };

  const handleSaveEstimate = (estimateData: Partial<Estimate>) => {
    if (selectedEstimate) {
      // 編集
      setEstimates(prev => prev.map(e => 
        e.id === selectedEstimate.id 
          ? { ...e, ...estimateData }
          : e
      ));
      addToast('見積書を更新しました', 'success');
    } else {
      // 新規作成
      const newEstimate: Estimate = {
        id: Date.now().toString(),
        estimateNumber: `EST-2024-${String(estimates.length + 1).padStart(3, '0')}`,
        customerName: estimateData.customerName || '',
        projectName: estimateData.projectName || '',
        amount: estimateData.amount || 0,
        status: 'draft',
        createdAt: new Date().toISOString().split('T')[0],
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      };
      setEstimates(prev => [...prev, newEstimate]);
      addToast('見積書を作成しました', 'success');
    }
    setIsModalOpen(false);
    setSelectedEstimate(null);
  };

  return (
    <div className="p-6 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">見積管理</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">見積書の作成・管理・追跡</p>
        </div>
        <button
          onClick={handleCreateEstimate}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <PlusCircle className="w-5 h-5" />
          新規見積作成
        </button>
      </div>

      {/* 検索・フィルター */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="顧客名、案件名、見積番号で検索..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
        >
          <option value="all">すべてのステータス</option>
          <option value="draft">下書き</option>
          <option value="sent">送付済み</option>
          <option value="approved">承認済み</option>
          <option value="rejected">却下</option>
          <option value="expired">期限切れ</option>
        </select>
      </div>

      {/* 見積書一覧 */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">見積番号</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">顧客名</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">案件名</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">金額</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">ステータス</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">作成日</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">有効期限</th>
              <th className="text-center py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredEstimates.map((estimate) => (
              <tr key={estimate.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">{estimate.estimateNumber}</td>
                <td className="py-3 px-4 text-gray-700 dark:text-gray-300">{estimate.customerName}</td>
                <td className="py-3 px-4 text-gray-700 dark:text-gray-300">{estimate.projectName}</td>
                <td className="py-3 px-4 text-right font-medium text-gray-900 dark:text-white">{formatCurrency(estimate.amount)}</td>
                <td className="py-3 px-4">{getStatusBadge(estimate.status)}</td>
                <td className="py-3 px-4 text-gray-700 dark:text-gray-300">{estimate.createdAt}</td>
                <td className="py-3 px-4 text-gray-700 dark:text-gray-300">{estimate.validUntil}</td>
                <td className="py-3 px-4">
                  <div className="flex justify-center gap-2">
                    <button
                      onClick={() => handleEditEstimate(estimate)}
                      className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                      title="編集"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                      title="プレビュー"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      className="p-1 text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 rounded"
                      title="ダウンロード"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteEstimate(estimate.id)}
                      className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                      title="削除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {filteredEstimates.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p>見積書がありません</p>
            <button
              onClick={handleCreateEstimate}
              className="mt-2 text-blue-600 hover:text-blue-700 font-medium"
            >
              最初の見積書を作成する
            </button>
          </div>
        )}
      </div>

      {/* 見積書作成・編集モーダル */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
              {selectedEstimate ? '見積書編集' : '新規見積書作成'}
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  顧客名
                </label>
                <input
                  type="text"
                  defaultValue={selectedEstimate?.customerName}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="株式会社ABC"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  案件名
                </label>
                <input
                  type="text"
                  defaultValue={selectedEstimate?.projectName}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="ウェブサイト開発"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  金額
                </label>
                <input
                  type="number"
                  defaultValue={selectedEstimate?.amount}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="500000"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  有効期限
                </label>
                <input
                  type="date"
                  defaultValue={selectedEstimate?.validUntil}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                キャンセル
              </button>
              <button
                onClick={() => {
                  const form = document.querySelector('form');
                  if (form) {
                    const formData = new FormData(form as HTMLFormElement);
                    const estimateData = {
                      customerName: (formData.get('customerName') as string) || selectedEstimate?.customerName || '',
                      projectName: (formData.get('projectName') as string) || selectedEstimate?.projectName || '',
                      amount: Number(formData.get('amount')) || selectedEstimate?.amount || 0,
                      validUntil: (formData.get('validUntil') as string) || selectedEstimate?.validUntil || ''
                    };
                    handleSaveEstimate(estimateData);
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {selectedEstimate ? '更新' : '作成'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SimpleEstimatePage;
