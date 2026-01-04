import React, { useEffect, useMemo, useState } from 'react';
import { Project } from '../../types';
import {
  Building2,
  CalendarClock,
  ClipboardList,
  Hash,
  ListTree,
  Package,
  RefreshCw,
  Search,
  User,
  Wallet,
  BarChart3,
} from 'lucide-react';

type ProjectManagementPageProps = {
  projects: Project[];
  isLoading?: boolean;
  onRefresh?: () => void;
};

const formatCurrency = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return `¥${value.toLocaleString('ja-JP')}`;
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('ja-JP');
};

const formatQuantity = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === '') return '-';
  return typeof value === 'number' ? value.toLocaleString('ja-JP') : value;
};

const DetailField: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="space-y-1">
    <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
    <p className="text-sm font-semibold text-slate-800 dark:text-white break-words">{value ?? '-'}</p>
  </div>
);

const ProjectManagementPage: React.FC<ProjectManagementPageProps> = ({ projects, isLoading, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<'none' | 'customer' | 'status' | 'month'>('none');

  const filteredProjects = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return projects;
    return projects.filter(project => {
      return [
        project.projectName,
        project.projectCode,
        project.customerCode,
        project.projectStatus,
        project.salesUserCode,
        project.salesUserId,
      ]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(keyword));
    });
  }, [projects, searchTerm]);

  // 案件別グループ化
  const groupedProjects = useMemo(() => {
    if (groupBy === 'none') {
      return { 'すべて': filteredProjects };
    }

    const groups: Record<string, typeof filteredProjects> = {};
    
    filteredProjects.forEach(project => {
      let key = '';
      
      switch (groupBy) {
        case 'customer':
          key = project.customerCode || '未設定';
          break;
        case 'status':
          key = project.projectStatus || '未設定';
          break;
        case 'month':
          if (project.createDate) {
            const date = new Date(project.createDate);
            key = `${date.getFullYear()}年${date.getMonth() + 1}月`;
          } else {
            key = '未設定';
          }
          break;
      }
      
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(project);
    });

    return groups;
  }, [filteredProjects, groupBy]);

  // グループ別集計
  const groupStats = useMemo(() => {
    const stats: Record<string, { count: number; totalAmount: number; totalCost: number; avgMargin: number }> = {};
    
    Object.entries(groupedProjects).forEach(([groupKey, groupProjects]) => {
      const validProjects = groupProjects.filter(p => p.amount && !Number.isNaN(p.amount));
      const totalAmount = validProjects.reduce((sum, p) => sum + (p.amount || 0), 0);
      const totalCost = validProjects.reduce((sum, p) => sum + (p.totalCost || 0), 0);
      const avgMargin = validProjects.length > 0 ? (totalAmount - totalCost) / totalAmount * 100 : 0;
      
      stats[groupKey] = {
        count: groupProjects.length,
        totalAmount,
        totalCost,
        avgMargin
      };
    });

    return stats;
  }, [groupedProjects]);

  useEffect(() => {
    if (!filteredProjects.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !filteredProjects.find(p => p.id === selectedId)) {
      setSelectedId(filteredProjects[0].id);
    }
  }, [filteredProjects, selectedId]);

  const selectedProject =
    filteredProjects.find(project => project.id === selectedId) ||
    projects.find(project => project.id === selectedId) ||
    null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-blue-500">Projects</p>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white">プロジェクト管理</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            プロジェクトの一覧と詳細を同じ画面で確認できます。
          </p>
        </div>
        <div className="flex items-center gap-3 w-full lg:w-auto">
          <div className="relative flex-1 lg:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="案件名 / コード / 顧客コードで検索"
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full pl-10 pr-4 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as any)}
            className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
          >
            <option value="none">グループ化なし</option>
            <option value="customer">顧客別</option>
            <option value="status">ステータス別</option>
            <option value="month">月別</option>
          </select>
          <button
            type="button"
            onClick={() => onRefresh?.()}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            再読み込み
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.05fr,1fr]">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-100 font-semibold">
              <ClipboardList className="w-4 h-4" />
              <span>プロジェクト一覧</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">({filteredProjects.length}件)</span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {isLoading ? '更新中...' : '最新の順に表示'}
            </div>
          </div>

          {filteredProjects.length === 0 && (
            <div className="border border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-6 text-center text-slate-500 dark:text-slate-400 text-sm">
              条件に一致するプロジェクトがありません
            </div>
          )}

          <div className="space-y-3 max-h-[720px] overflow-y-auto pr-1">
            {Object.entries(groupedProjects).map(([groupKey, groupProjects]) => (
              <div key={groupKey} className="space-y-2">
                {groupBy !== 'none' && (
                  <>
                  <div className="flex items-center justify-between px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-100">
                        {groupKey}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        ({groupProjects.length}件)
                      </span>
                    </div>
                    {groupStats[groupKey] && (
                      <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
                        <span>売上: {formatCurrency(groupStats[groupKey].totalAmount)}</span>
                        <span>原価: {formatCurrency(groupStats[groupKey].totalCost)}</span>
                        <span>利益率: {groupStats[groupKey].avgMargin.toFixed(1)}%</span>
                      </div>
                    )}
                  </div>
                )}
                {groupProjects.map(project => {
              const isActive = project.isActive !== false;
              return (
                <button
                  key={project.id}
                  onClick={() => setSelectedId(project.id)}
                  className={`w-full text-left rounded-xl border transition-all ${
                    project.id === selectedId
                      ? 'border-blue-500/60 bg-blue-50 dark:bg-blue-900/20 shadow-inner shadow-blue-900/10'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/40 hover:border-slate-400 dark:hover:border-slate-500'
                  }`}
                >
                  <div className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-800 to-slate-700 flex items-center justify-center text-slate-50">
                          <Hash className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{project.projectCode || 'コード未設定'}</p>
                          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{project.projectName || '名称未設定'}</h3>
                          <div className="flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                            <span className="flex items-center gap-1">
                              <Building2 className="w-3 h-3" /> {project.customerCode || '顧客未設定'}
                            </span>
                            <span className="flex items-center gap-1">
                              <CalendarClock className="w-3 h-3" /> 納期 {formatDate(project.deliveryDate)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Wallet className="w-3 h-3" /> {formatCurrency(project.amount)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${
                          project.projectStatus
                            ? 'bg-slate-800/10 text-slate-700 dark:text-slate-100 dark:bg-slate-700/60 border-slate-300 dark:border-slate-600'
                            : 'bg-slate-100 text-slate-500 border-slate-300 dark:bg-slate-700/60 dark:text-slate-300 dark:border-slate-600'
                        }`}>
                          {project.projectStatus || 'ステータス未設定'}
                        </span>
                        {!isActive && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                            非アクティブ
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-700">
                      <span className="flex items-center gap-1">
                        <ListTree className="w-3 h-3" /> {project.classificationId || '分類未設定'}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" /> {project.salesUserCode || '担当未設定'}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm space-y-5">
          {!selectedProject ? (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 gap-3">
              <ClipboardList className="w-10 h-10" />
              <p className="text-sm">表示するプロジェクトを選択してください。</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{selectedProject.projectCode || 'コード未設定'}</p>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white leading-tight">
                      {selectedProject.projectName || '名称未設定'}
                    </h3>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="px-3 py-1 rounded-full text-xs font-semibold border bg-slate-800/10 text-slate-700 dark:text-slate-100 dark:bg-slate-700/60 border-slate-300 dark:border-slate-600">
                      {selectedProject.projectStatus || 'ステータス未設定'}
                    </span>
                    {selectedProject.updatedAt && (
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        更新: {formatDate(selectedProject.updatedAt)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1">
                    <CalendarClock className="w-3 h-3" /> 納期 {formatDate(selectedProject.deliveryDate)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Package className="w-3 h-3" /> 数量 {formatQuantity(selectedProject.quantity)}
                  </span>
                  <span className="flex items-center gap-1">
                    <BarChart3 className="w-3 h-3" /> {selectedProject.classificationId || '分類未設定'} / {selectedProject.sectionCodeId || 'セクション未設定'}
                  </span>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    <Wallet className="w-4 h-4 text-emerald-500" /> 金額
                  </div>
                  <DetailField label="案件金額 (amount)" value={formatCurrency(selectedProject.amount)} />
                  <DetailField label="見積金額 (subamount)" value={formatCurrency(selectedProject.subamount)} />
                  <DetailField label="原価合計 (total_cost)" value={formatCurrency(selectedProject.totalCost)} />
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    <Building2 className="w-4 h-4 text-blue-500" /> 顧客・担当
                  </div>
                  <DetailField label="顧客コード" value={selectedProject.customerCode || '未設定'} />
                  <DetailField label="顧客ID" value={selectedProject.customerId || '未設定'} />
                  <DetailField label="営業担当" value={selectedProject.salesUserCode || selectedProject.salesUserId || '未設定'} />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    <ListTree className="w-4 h-4 text-indigo-500" /> 見積・受注・分類
                  </div>
                  <DetailField label="見積 ID / コード" value={`${selectedProject.estimateId ?? '-'} / ${selectedProject.estimateCode ?? '-'}`} />
                  <DetailField label="受注 ID / コード" value={`${selectedProject.orderId ?? '-'} / ${selectedProject.orderCode ?? '-'}`} />
                  <DetailField label="分類 / 製品クラス" value={`${selectedProject.classificationId ?? '-'} / ${selectedProject.productClassId ?? '-'}`} />
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    <User className="w-4 h-4 text-amber-500" /> 作成・更新
                  </div>
                  <DetailField label="作成日時 / ユーザー" value={`${formatDate(selectedProject.createDate)} / ${selectedProject.createUserCode ?? selectedProject.createUserId ?? '-'}`} />
                  <DetailField label="更新日時 / ユーザー" value={`${formatDate(selectedProject.updateDate)} / ${selectedProject.updateUserCode ?? selectedProject.updateUserId ?? '-'}`} />
                  <DetailField label="system updated_at" value={formatDate(selectedProject.updatedAt)} />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  <Hash className="w-4 h-4 text-slate-500" /> ID / セクション情報
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <DetailField label="プロジェクトID (project_id)" value={selectedProject.projectId || '-'} />
                  <DetailField label="内部ID (id)" value={selectedProject.id || '-'} />
                  <DetailField label="セクションコードID" value={selectedProject.sectionCodeId || '-'} />
                  <DetailField label="担当者ID (sales_user_id)" value={selectedProject.salesUserId || '-'} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  </div>
  </div>
  );
};

export default ProjectManagementPage;
