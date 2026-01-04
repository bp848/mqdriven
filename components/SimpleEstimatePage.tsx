import React, { useState, useEffect } from 'react';
import { PlusCircle, Search, Filter, Edit, Trash2, Eye, Download, TrendingUp, BarChart3, PieChart } from 'lucide-react';
import { getEstimates } from '../services/dataService';
import { Estimate } from '../types';

interface SimpleEstimatePageProps {
  currentUser: any;
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

const SimpleEstimatePage: React.FC<SimpleEstimatePageProps> = ({ currentUser, addToast }) => {
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEstimates = async () => {
      try {
        setLoading(true);
        console.log('Fetching estimates...');
        const data = await getEstimates();
        console.log('Fetched estimates:', data);
        setEstimates(data);
      } catch (error: any) {
        console.error('Failed to fetch estimates:', error);
        addToast(`見積データの読み込みに失敗しました: ${error.message || '不明なエラー'}`, 'error');
        // エラー時は空配列を設定してクラッシュを防ぐ
        setEstimates([]);
      } finally {
        setLoading(false);
      }
    };

    fetchEstimates();
  }, [addToast]);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEstimate, setSelectedEstimate] = useState<Estimate | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);

  // 分析データ
  const analyticsData = React.useMemo(() => {
    const totalEstimates = estimates.length;
    const totalAmount = estimates.reduce((sum, est) => sum + (est.total || est.grandTotal || 0), 0);
    const statusCounts = estimates.reduce((acc, est) => {
      acc[est.status] = (acc[est.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const avgAmount = totalEstimates > 0 ? totalAmount / totalEstimates : 0;
    
    return {
      totalEstimates,
      totalAmount,
      avgAmount,
      statusCounts,
      recentEstimates: estimates.slice(0, 5)
    };
  }, [estimates]);

  const filteredEstimates = estimates.filter(estimate => {
    try {
      const matchesSearch = estimate.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (estimate.projectName && estimate.projectName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                           estimate.estimateNumber.toString().includes(searchTerm);
      const matchesStatus = statusFilter === 'all' || estimate.status === statusFilter;
      return matchesSearch && matchesStatus;
    } catch (error) {
      console.error('Error filtering estimate:', error);
      return false;
    }
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
    if (!config) {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          {status || '不明'}
        </span>
      );
    }
    
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
        id: `est-${Date.now()}`,
        estimateNumber: Date.now(),
        customerName: estimateData.customerName || '新規顧客',
        title: estimateData.title || '新規見積',
        displayName: estimateData.displayName || estimateData.title || '新規見積',
        projectName: estimateData.projectName || '',
        items: [],
        total: estimateData.total || estimateData.grandTotal || 0,
        deliveryDate: '',
        paymentTerms: '',
        deliveryMethod: '',
        notes: '',
        status: 'draft' as any,
        version: 1,
        userId: currentUser?.id || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        subtotal: 0,
        taxTotal: 0,
        grandTotal: estimateData.total || estimateData.grandTotal || 0,
        deliveryTerms: '',
        projectId: null,
        patternNo: null,
        expirationDate: estimateData.expirationDate || null,
        taxRate: null,
        consumption: null,
        rawStatusCode: null,
        copies: null,
        unitPrice: null,
        salesAmount: null,
        variableCostAmount: null,
        mqAmount: null,
        mqRate: null,
        mqMissingReason: null,
        detailCount: null,
        statusLabel: null,
        raw: null,
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
        <div className="flex gap-2">
          <button
            onClick={() => setShowAnalytics(!showAnalytics)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              showAnalytics 
                ? 'bg-green-600 text-white hover:bg-green-700' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            <BarChart3 className="w-5 h-5" />
            {showAnalytics ? '分析を隠す' : '分析を表示'}
          </button>
          <button
            onClick={handleCreateEstimate}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <PlusCircle className="w-5 h-5" />
            新規見積作成
          </button>
        </div>
      </div>

      {/* 分析パネル */}
      {showAnalytics && (
        <div className="mb-6 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            見積分析
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
              <div className="text-sm text-gray-600 dark:text-gray-400">総見積件数</div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{analyticsData.totalEstimates}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
              <div className="text-sm text-gray-600 dark:text-gray-400">総金額</div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(analyticsData.totalAmount)}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
              <div className="text-sm text-gray-600 dark:text-gray-400">平均金額</div>
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{formatCurrency(analyticsData.avgAmount)}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
              <div className="text-sm text-gray-600 dark:text-gray-400">ステータス別</div>
              <div className="text-sm">
                {Object.entries(analyticsData.statusCounts).map(([status, count]) => (
                  <div key={status} className="flex justify-between">
                    <span>{getStatusBadge(status)}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

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
        {loading ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p>データを読み込み中...</p>
            <p className="text-sm mt-2">コンソールで詳細を確認してください</p>
          </div>
        ) : (
          <>
            <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                見積データ数: {estimates.length}件
              </p>
            </div>
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
                    <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">{estimate.estimateNumber || '-'}</td>
                    <td className="py-3 px-4 text-gray-700 dark:text-gray-300">{estimate.customerName || '-'}</td>
                    <td className="py-3 px-4 text-gray-700 dark:text-gray-300">{estimate.projectName || '-'}</td>
                    <td className="py-3 px-4 text-right font-medium text-gray-900 dark:text-white">{formatCurrency(estimate.total || estimate.grandTotal || 0)}</td>
                    <td className="py-3 px-4">{getStatusBadge(estimate.status)}</td>
                    <td className="py-3 px-4 text-gray-700 dark:text-gray-300">{estimate.createdAt ? new Date(estimate.createdAt).toLocaleDateString('ja-JP') : '-'}</td>
                    <td className="py-3 px-4 text-gray-700 dark:text-gray-300">{estimate.expirationDate ? new Date(estimate.expirationDate).toLocaleDateString('ja-JP') : '-'}</td>
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
            
            {filteredEstimates.length === 0 && !loading && (
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
          </>
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
                  defaultValue={selectedEstimate?.total || selectedEstimate?.grandTotal}
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
                  defaultValue={selectedEstimate?.expirationDate}
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
                      total: Number(formData.get('amount')) || selectedEstimate?.total || selectedEstimate?.grandTotal || 0,
                      grandTotal: Number(formData.get('amount')) || selectedEstimate?.total || selectedEstimate?.grandTotal || 0,
                      expirationDate: (formData.get('validUntil') as string) || selectedEstimate?.expirationDate || ''
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
