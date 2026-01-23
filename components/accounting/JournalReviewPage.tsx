import React, { useState, useEffect, useCallback } from 'react';
import { Search, Filter, Calendar, ChevronDown, Loader, FileText, CheckCircle, AlertTriangle } from 'lucide-react';
import { ApplicationWithDetails, User, AccountingStatus, ApplicationStatus } from '../../types';
import * as dataService from '../../services/dataService';

interface JournalReviewPageProps {
  currentUser?: User | null;
}

const JournalReviewPage: React.FC<JournalReviewPageProps> = ({ currentUser }) => {
  const [applications, setApplications] = useState<ApplicationWithDetails[]>([]);
  const [filteredApplications, setFilteredApplications] = useState<ApplicationWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedApplication, setSelectedApplication] = useState<ApplicationWithDetails | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<AccountingStatus | 'all'>('all');

  // 承認済みかつ会計処理待ちの申請を取得
  const loadApplications = useCallback(async () => {
    if (!currentUser) return;
    setIsLoading(true);
    setError(null);
    
    try {
      const allApplications = await dataService.getApplications(currentUser.id);
      // 正しい流れ：業務承認済み → 会計処理待ち
      const targetApplications = allApplications.filter(app => 
        app.status === ApplicationStatus.APPROVED && 
        (!app.accounting_status || app.accounting_status === AccountingStatus.NONE)
      );
      setApplications(targetApplications);
      setFilteredApplications(targetApplications);
    } catch (err) {
      setError('承認済み申請の読み込みに失敗しました。');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  // 仕訳作成処理
  const handleCreateJournal = async (application: ApplicationWithDetails) => {
    if (!currentUser) {
      alert('ログインが必要です。');
      return;
    }

    try {
      // まず会計ステータスを「レビュー待ち」に更新
      await dataService.updateApplicationAccountingStatus(application.id, AccountingStatus.PENDING);
      
      // 仕訳を作成（draft状態）
      await dataService.createJournalFromApplication(application.id, currentUser.id);
      
      alert('仕訳を作成しました。仕訳帳で確認してください。');
      await loadApplications(); // リストを更新
      setSelectedApplication(null);
    } catch (error: any) {
      console.error('仕訳作成エラー:', error);
      alert(`仕訳の作成に失敗しました: ${error.message}`);
    }
  };

  // フィルタリング
  useEffect(() => {
    let filtered = applications;
    
    if (searchTerm) {
      filtered = filtered.filter(app => 
        app.formData?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.applicant?.name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(app => app.accounting_status === statusFilter);
    }
    
    setFilteredApplications(filtered);
  }, [applications, searchTerm, statusFilter]);

  useEffect(() => {
    loadApplications();
  }, [loadApplications]);

  const formatAmount = (app: ApplicationWithDetails) => {
    const amount = app.formData?.totalAmount || app.formData?.amount || 0;
    return `¥${Number(amount).toLocaleString()}`;
  };

  const getStatusBadge = (status: AccountingStatus | undefined) => {
    switch (status) {
      case AccountingStatus.NONE:
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded">処理待ち</span>;
      case AccountingStatus.PENDING:
        return <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded">レビュー中</span>;
      case AccountingStatus.DRAFT:
        return <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs font-semibold rounded">仕訳作成済み</span>;
      case AccountingStatus.POSTED:
        return <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded">仕訳確定</span>;
      default:
        return <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs font-semibold rounded">未設定</span>;
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* ヘッダー */}
      <div className="p-6 border-b border-slate-200 bg-slate-50/50">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <FileText className="w-6 h-6 text-blue-600" />
              仕訳レビュー
            </h1>
            <p className="text-slate-600 mt-1">
              承認済み申請の会計処理を行います
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-600">{filteredApplications.length}</div>
            <div className="text-sm text-slate-600">処理待ち件数</div>
          </div>
        </div>

        {/* 検索・フィルター */}
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[300px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="申請タイトルや申請者で検索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as AccountingStatus | 'all')}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">すべて</option>
            <option value={AccountingStatus.NONE}>処理待ち</option>
            <option value={AccountingStatus.PENDING}>レビュー中</option>
            <option value={AccountingStatus.DRAFT}>仕訳作成済み</option>
          </select>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader className="w-8 h-8 animate-spin text-blue-600" />
            <span className="ml-2 text-slate-600">読み込み中...</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full text-red-500">
            <AlertTriangle className="w-6 h-6 mr-2" />
            {error}
          </div>
        ) : filteredApplications.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-500">
            <div className="text-center">
              <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
              <h3 className="text-lg font-semibold mb-2">すべて処理済みです</h3>
              <p>現在、仕訳レビュー待ちの申請はありません</p>
            </div>
          </div>
        ) : (
          <div className="h-full overflow-y-auto">
            <div className="divide-y divide-slate-200">
              {filteredApplications.map((app) => (
                <div key={app.id} className="p-6 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-slate-800">
                          {app.formData?.title || app.formData?.description || '申請'}
                        </h3>
                        {getStatusBadge(app.accounting_status)}
                        <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded">
                          {app.applicationCode?.name || '申請'}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-slate-600">
                        <div>
                          <span className="font-medium">申請者:</span>
                          <div>{app.applicant?.name || '不明'}</div>
                        </div>
                        <div>
                          <span className="font-medium">承認日:</span>
                          <div>{app.approvedAt ? new Date(app.approvedAt).toLocaleDateString('ja-JP') : '-'}</div>
                        </div>
                        <div>
                          <span className="font-medium">金額:</span>
                          <div className="font-bold text-slate-800">{formatAmount(app)}</div>
                        </div>
                        <div>
                          <span className="font-medium">申請ID:</span>
                          <div className="font-mono text-xs">{app.id.slice(0, 8)}...</div>
                        </div>
                      </div>
                      
                      {app.formData?.description && (
                        <div className="mt-3 p-3 bg-slate-50 rounded text-sm text-slate-600">
                          {app.formData.description}
                        </div>
                      )}
                    </div>
                    
                    <div className="ml-4 flex flex-col gap-2">
                      {!app.accounting_status || app.accounting_status === AccountingStatus.NONE ? (
                        <button
                          onClick={() => handleCreateJournal(app)}
                          className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                        >
                          <FileText className="w-4 h-4" />
                          仕訳作成
                        </button>
                      ) : (
                        <div className="text-center text-sm text-slate-500">
                          {getStatusBadge(app.accounting_status)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default JournalReviewPage;
