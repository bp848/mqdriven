import React, { useState, useEffect, useCallback } from 'react';
import { Search, Filter, Calendar, ChevronDown, Loader, FileText, CheckCircle, AlertTriangle, Eye, Plus, Check } from 'lucide-react';
import { ApplicationWithDetails, User, AccountingStatus, ApplicationStatus, JournalEntry, JournalEntryLine } from '../../types';
import * as dataService from '../../services/dataService';

interface JournalReviewPageProps {
  currentUser?: User | null;
}

interface JournalEntryWithLines extends JournalEntry {
  lines: JournalEntryLine[];
}

const JournalReviewPage: React.FC<JournalReviewPageProps> = ({ currentUser }) => {
  const [applications, setApplications] = useState<ApplicationWithDetails[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntryWithLines[]>([]);
  const [archivedApplications, setArchivedApplications] = useState<ApplicationWithDetails[]>([]);
  const [archivedJournalEntries, setArchivedJournalEntries] = useState<JournalEntryWithLines[]>([]);
  const [filteredApplications, setFilteredApplications] = useState<ApplicationWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedApplication, setSelectedApplication] = useState<ApplicationWithDetails | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<AccountingStatus | 'all'>('all');

  // 謇ｿ隱肴ｸ医∩逕ｳ隲九→draft迥ｶ諷九・莉戊ｨｳ繧貞叙蠕・
  const loadData = useCallback(async () => {
    if (!currentUser) return;
    setIsLoading(true);
    setError(null);

    try {
      // 謇ｿ隱肴ｸ医∩逕ｳ隲九ｒ蜿門ｾ・
      const allApplications = await dataService.getApplications(currentUser.id);
      const targetApplications = allApplications.filter(app =>
        app.status === ApplicationStatus.APPROVED &&
        (!app.accounting_status || app.accounting_status === AccountingStatus.NONE) &&
        // 休暇申請を除外
        !app.applicationCode?.name?.includes('休暇') &&
        !app.applicationCode?.name?.includes('休み')
      );
      setApplications(targetApplications);
      setFilteredApplications(targetApplications);

      const archivedApps = allApplications.filter(app =>
        app.status === ApplicationStatus.APPROVED &&
        app.accounting_status === AccountingStatus.POSTED &&
        // 休暇申請を除外
        !app.applicationCode?.name?.includes('休暇') &&
        !app.applicationCode?.name?.includes('休み')
      );
      setArchivedApplications(archivedApps);

      // draft迥ｶ諷九・莉戊ｨｳ繧貞叙蠕・
      const draftEntries = await dataService.getJournalEntriesByStatus('draft');
      setJournalEntries(draftEntries.map(entry => ({
        ...entry,
        lines: entry.lines || []
      })));

      const postedEntries = await dataService.getJournalEntriesByStatus('posted');
      setArchivedJournalEntries(postedEntries.map(entry => ({
        ...entry,
        lines: entry.lines || []
      })));
    } catch (err: any) {
      setError('データの読み込みに失敗しました。');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  // 莉戊ｨｳ逕滓・蜃ｦ逅・
  const handleGenerateJournal = async (application: ApplicationWithDetails) => {
    if (!currentUser) {
      alert('ログインが必要です。');
      return;
    }

    try {
      // 莉戊ｨｳ譏守ｴｰ繧堤函謌・
      const result = await dataService.generateJournalLinesFromApplication(application.id);

      alert(`仕訳を生成しました。${result.lines.length}行の仕訳が作成されました。`);
      await loadData(); // 繝・・繧ｿ繧貞・隱ｭ縺ｿ霎ｼ縺ｿ
    } catch (error: any) {
      console.error('莉戊ｨｳ逕滓・繧ｨ繝ｩ繝ｼ:', error);
      alert(`莉戊ｨｳ縺ｮ逕滓・縺ｫ螟ｱ謨励＠縺ｾ縺励◆: ${error.message}`);
    }
  };

  // 莉戊ｨｳ遒ｺ螳壼・逅・
  const handleConfirmJournal = async (journalEntryId: string | number) => {
    if (!currentUser) {
      alert('ログインが必要です。');
      return;
    }

    try {
      const entry = journalEntries.find(target => String(target.id) === String(journalEntryId));
      const sourceApplicationId = entry?.reference_id;
      const applicationToArchive = sourceApplicationId
        ? applications.find(app => app.id === sourceApplicationId)
        : undefined;

      // 莉戊ｨｳ繧堤｢ｺ螳夲ｼ・tatus繧恥osted縺ｫ譖ｴ譁ｰ・・
      await dataService.updateJournalEntryStatus(String(journalEntryId), 'posted');

      if (entry) {
        setJournalEntries(prev => prev.filter(item => String(item.id) !== String(journalEntryId)));
        setArchivedJournalEntries(prev => [
          { ...entry, status: 'posted' },
          ...prev,
        ]);
      }

      if (applicationToArchive) {
        const archivedApplication: ApplicationWithDetails = {
          ...applicationToArchive,
          accounting_status: AccountingStatus.POSTED,
        };
        setApplications(prev => prev.filter(app => app.id !== applicationToArchive.id));
        setFilteredApplications(prev => prev.filter(app => app.id !== applicationToArchive.id));
        setArchivedApplications(prev => [archivedApplication, ...prev]);
      }

      alert('仕訳を確定しました。');
    } catch (error: any) {
      console.error('莉戊ｨｳ遒ｺ螳壹お繝ｩ繝ｼ:', error);
      alert(`莉戊ｨｳ縺ｮ遒ｺ螳壹↓螟ｱ謨励＠縺ｾ縺励◆: ${error.message}`);
    }
  };

  // 繝輔ぅ繝ｫ繧ｿ繝ｪ繝ｳ繧ｰ
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
    loadData();
  }, [loadData]);

  const formatAmount = (app: ApplicationWithDetails) => {
    const amount = app.formData?.totalAmount || app.formData?.amount || 0;
    return `¥${Number(amount).toLocaleString()}`;
  };

  const getStatusBadge = (status: AccountingStatus | undefined) => {
    switch (status) {
      case AccountingStatus.NONE:
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded">仕訳未生成</span>;
      case AccountingStatus.DRAFT:
        return <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded">仕訳下書き</span>;
      case AccountingStatus.POSTED:
        return <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded">仕訳確定</span>;
      default:
        return <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs font-semibold rounded">不明</span>;
    }
  };

  const getArchivedEntryForApplication = (applicationId: string): JournalEntryWithLines | null => {
    return archivedJournalEntries.find(entry =>
      entry.reference_id === applicationId && entry.status === 'posted'
    ) || null;
  };

  // 逕ｳ隲九↓蟇ｾ蠢懊☆繧倶ｻ戊ｨｳ譏守ｴｰ繧貞叙蠕・
  const getJournalLinesForApplication = (applicationId: string): JournalEntryWithLines | null => {
    return journalEntries.find(entry =>
      entry.reference_id === applicationId && entry.status === 'draft'
    ) || null;
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* 繝倥ャ繝繝ｼ */}
      <div className="p-6 border-b border-slate-200 bg-slate-50/50">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <FileText className="w-6 h-6 text-blue-600" />
              仕訳レビュー
            </h1>
            <p className="text-slate-600 mt-1">
              承認済み申請の仕訳生成と確認を行います。
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-600">{filteredApplications.length}</div>
            <div className="text-sm text-slate-600">対象件数</div>
          </div>
        </div>

        {/* 讀懃ｴ｢繝ｻ繝輔ぅ繝ｫ繧ｿ繝ｼ */}
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[300px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="申請タイトル・申請者名で検索..."
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
            <option value={AccountingStatus.NONE}>仕訳未生成</option>
            <option value={AccountingStatus.DRAFT}>仕訳下書き</option>
          </select>
        </div>
      </div>

      {/* 繝｡繧､繝ｳ繧ｳ繝ｳ繝・Φ繝・*/}
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
              <h3 className="text-lg font-semibold mb-2">対象の申請はありません</h3>
              <p className="mb-2">現在、仕訳レビュー対象の申請がありません。</p>
              <div className="text-sm text-slate-400 bg-slate-50 rounded-lg p-3 mt-4">
                <p>申請が承認されると仕訳レビューに表示されます。</p>
                <ul className="text-left mt-2 space-y-1">
                  <li>・申請が承認されていること</li>
                  <li>・まだ仕訳が生成されていないこと</li>
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full overflow-y-auto">
            <div className="divide-y divide-slate-200">
              {filteredApplications.map((app) => {
                const journalEntry = getJournalLinesForApplication(app.id);
                return (
                  <div key={app.id} className="p-6 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-slate-800">
                            {app.formData?.title || app.formData?.description || '申請'}
                          </h3>
                          {journalEntry ? (
                            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded">
                              仕訳下書き ({journalEntry.lines.length}行)
                            </span>
                          ) : (
                            getStatusBadge(app.accounting_status)
                          )}
                          <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded">
                            {app.applicationCode?.name || '申請種別'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-slate-600">
                          <div>
                            <span className="font-medium">申請者</span>
                            <div>{app.applicant?.name || '-'}</div>
                          </div>
                          <div>
                            <span className="font-medium">承認日</span>
                            <div>{app.approvedAt ? new Date(app.approvedAt).toLocaleDateString('ja-JP') : '-'}</div>
                          </div>
                          <div>
                            <span className="font-medium">金額</span>
                            <div className="font-bold text-slate-800">{formatAmount(app)}</div>
                          </div>
                          <div>
                            <span className="font-medium">申請ID</span>
                            <div className="font-mono text-xs">{app.id.slice(0, 8)}...</div>
                          </div>
                        </div>

                        {/* 莉戊ｨｳ譏守ｴｰ縺ｮ陦ｨ遉ｺ */}
                        {journalEntry && (
                          <div className="mt-4 p-4 bg-slate-50 rounded-lg">
                            <h4 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                              <Eye className="w-4 h-4" />
                              仕訳明細 (draft)
                            </h4>
                            <div className="space-y-2">
                              {journalEntry.lines.map((line) => (
                                <div key={line.id} className="flex items-center justify-between p-2 bg-white rounded border border-slate-200">
                                  <div className="flex items-center gap-3">
                                    <span className="font-mono text-sm text-slate-600">{line.account_code}</span>
                                    <span className="font-medium text-slate-800">{line.account_name}</span>
                                  </div>
                                  <div className="text-right">
                                    {line.debit_amount && line.debit_amount > 0 ? (
                                      <span className="font-bold text-red-600">¥{Number(line.debit_amount).toLocaleString()}</span>
                                    ) : (
                                      <span className="font-bold text-blue-600">¥{Number(line.credit_amount).toLocaleString()}</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {app.formData?.description && (
                          <div className="mt-3 p-3 bg-slate-50 rounded text-sm text-slate-600">
                            {app.formData.description}
                          </div>
                        )}
                      </div>

                      <div className="ml-4 flex flex-col gap-2">
                        {!journalEntry ? (
                          <button
                            onClick={() => handleGenerateJournal(app)}
                            className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                          >
                            <Plus className="w-4 h-4" />
                            仕訳を生成
                          </button>
                        ) : (
                          <button
                            onClick={() => handleConfirmJournal(journalEntry.id)}
                            className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                          >
                            <Check className="w-4 h-4" />
                            仕訳を確定
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {archivedApplications.length > 0 ? (
          <div className="mt-6 border border-slate-200 rounded-2xl bg-slate-50/40 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">アーカイブ済みの仕訳</h3>
                <p className="text-xs text-slate-500">
                  仕訳確定済みの申請カードはこのエリアに移動し、レビュー一覧からは消えます。
                </p>
              </div>
              <span className="text-sm font-semibold text-blue-600">{archivedApplications.length}件保存済み</span>
            </div>
            <div className="grid gap-3">
              {archivedApplications.map((app) => {
                const journalEntry = getArchivedEntryForApplication(app.id);
                return (
                  <div key={`archive-${app.id}`} className="flex items-start justify-between p-4 bg-white rounded-xl border border-slate-200">
                    <div className="flex-1 space-y-1">
                      <p className="text-sm text-slate-400">申請ID {app.id.slice(0, 8)}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-semibold text-slate-800">{app.formData?.title || app.formData?.description || '申請'}</h4>
                        <span className="px-2 py-1 text-xs font-semibold bg-green-100 text-green-800 rounded-full">
                          仕訳確定済
                        </span>
                      </div>
                      <p className="text-sm text-slate-600">
                        {app.applicant?.name || '申請者不明'}・{app.approvedAt ? new Date(app.approvedAt).toLocaleDateString('ja-JP') : '承認日なし'}
                      </p>
                      <p className="text-sm font-semibold text-slate-800">{formatAmount(app)}</p>
                      {journalEntry && (
                        <p className="text-xs text-slate-500">
                          {journalEntry.lines.length}行 (posted at {journalEntry.date ? new Date(journalEntry.date).toLocaleDateString('ja-JP') : '―'})
                        </p>
                      )}
                    </div>
                    <div className="text-right text-xs text-slate-500">
                      <p>アーカイブ済</p>
                      <p>{journalEntry?.created_at ? new Date(journalEntry.created_at).toLocaleDateString('ja-JP') : '登録日不明'}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default JournalReviewPage;
