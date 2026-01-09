import React, { useEffect, useMemo, useState } from 'react';
import { Project } from '../../types';
import { getProjects } from '../../services/dataService';
import { formatCurrency, formatDate } from '../../utils';
import { Search, RefreshCw, ClipboardList, Hash, User } from '../Icons';

interface ProjectManagementPageProps {
  onRefresh?: () => void;
  isLoading?: boolean;
}

const ProjectManagementPage: React.FC<ProjectManagementPageProps> = ({ onRefresh, isLoading = false }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const groupBy: 'customer' = 'customer';

  useEffect(() => {
    getProjects().then(data => {
      setProjects(data);
    });
  }, []);

  const filteredProjects = useMemo(() => {
    if (!searchTerm) return projects;
    
    const lowerSearch = searchTerm.toLowerCase();
    return projects.filter(project => 
      (project.projectName?.toLowerCase().includes(lowerSearch) || false) ||
      (project.projectCode?.toString().toLowerCase().includes(lowerSearch) || false) ||
      (project.customerCode?.toLowerCase().includes(lowerSearch) || false)
    );
  }, [projects, searchTerm]);

  const groupedProjects = useMemo(() => {
    const grouped: Record<string, Project[]> = {};
    
    filteredProjects.forEach(project => {
      const key = project.customerName || project.customerCode || '顧客未設定';
      
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(project);
    });
    
    return grouped;
  }, [filteredProjects, groupBy]);

  const groupStats = useMemo(() => {
    const stats: Record<string, { totalAmount: number; totalCost: number; avgMargin: number }> = {};
    
    Object.entries(groupedProjects).forEach(([groupKey, groupProjects]) => {
      const totalAmount = groupProjects.reduce((sum, p) => sum + (p.amount || 0), 0);
      const totalCost = groupProjects.reduce((sum, p) => sum + (p.totalCost || 0), 0);
      const avgMargin = totalAmount > 0 ? ((totalAmount - totalCost) / totalAmount) * 100 : 0;
      
      stats[groupKey] = { totalAmount, totalCost, avgMargin };
    });
    
    return stats;
  }, [groupedProjects]);

  const selectedProject = projects.find(p => p.id === selectedId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-blue-500">Projects</p>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white">プロジェクト管理</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            顧客別にプロジェクトをまとめて表示しています。
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
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {filteredProjects.length} / {projects.length} 件
            </span>
          </div>
          
          {filteredProjects.length === 0 && (
            <div className="border border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-6 text-center text-slate-500 dark:text-slate-400 text-sm">
              条件に一致するプロジェクトがありません
            </div>
          )}

          <div className="space-y-3 max-h-[720px] overflow-y-auto pr-1">
            {Object.entries(groupedProjects).map(([groupKey, groupProjects]) => (
              <div key={groupKey} className="space-y-2">
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
                {groupProjects.map(project => {
                  const isActive = project.isActive !== false;
                  const customerLabel = project.customerName || project.customerCode || '未設定';
                  return (
                    <button
                      key={project.id}
                      onClick={() => setSelectedId(project.id === selectedId ? null : project.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        selectedId === project.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
                      } ${!isActive ? 'opacity-60' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-slate-900 dark:text-white truncate">
                              {project.projectName || '名称未設定'}
                            </span>
                            <span className="px-2 py-0.5 rounded text-xs font-medium border bg-slate-800/10 text-slate-700 dark:text-slate-100 dark:bg-slate-700/60 border-slate-300 dark:border-slate-600">
                              {project.projectStatus || 'ステータス未設定'}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
                            <span>コード: {project.projectCode || '未設定'}</span>
                            <span>顧客: {customerLabel}</span>
                            <span>作成: {formatDate(project.createDate)}</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" /> {project.salesUserCode || '担当未設定'}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
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
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        更新: {formatDate(selectedProject.updatedAt)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">顧客コード</p>
                    <p className="font-medium text-slate-900 dark:text-white">{selectedProject.customerCode || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">顧客名</p>
                    <p className="font-medium text-slate-900 dark:text-white">{selectedProject.customerName || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">納期</p>
                    <p className="font-medium text-slate-900 dark:text-white">{formatDate(selectedProject.deliveryDate)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">数量</p>
                    <p className="font-medium text-slate-900 dark:text-white">{selectedProject.quantity?.toLocaleString() || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">売上</p>
                    <p className="font-medium text-slate-900 dark:text-white">{formatCurrency(selectedProject.amount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">原価</p>
                    <p className="font-medium text-slate-900 dark:text-white">{formatCurrency(selectedProject.totalCost)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">利益率</p>
                    <p className="font-medium text-slate-900 dark:text-white">
                      {selectedProject.amount && selectedProject.totalCost 
                        ? `${(((selectedProject.amount - selectedProject.totalCost) / selectedProject.amount) * 100).toFixed(1)}%`
                        : '-'
                      }
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  <Hash className="w-4 h-4 text-slate-500" /> ID / セクション情報
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">プロジェクトID (project_id)</p>
                    <p className="font-medium text-slate-900 dark:text-white">{selectedProject.projectId || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">内部ID (id)</p>
                    <p className="font-medium text-slate-900 dark:text-white">{selectedProject.id || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">セクションコードID</p>
                    <p className="font-medium text-slate-900 dark:text-white">{selectedProject.sectionCodeId || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">担当者ID (sales_user_id)</p>
                    <p className="font-medium text-slate-900 dark:text-white">{selectedProject.salesUserId || '-'}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/30 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  <Hash className="w-4 h-4 text-slate-500" /> 関連コード / 作成・更新履歴
                </div>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">見積ID / コード</p>
                    <p className="font-medium text-slate-900 dark:text-white">
                      {selectedProject.estimateId || '-'} / {selectedProject.estimateCode || '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">受注ID / コード</p>
                    <p className="font-medium text-slate-900 dark:text-white">
                      {selectedProject.orderId || '-'} / {selectedProject.orderCode || '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">分類 / 製品クラス</p>
                    <p className="font-medium text-slate-900 dark:text-white">
                      {selectedProject.classificationId || '-'} / {selectedProject.productClassId || '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">作成者 / 更新者 (コード)</p>
                    <p className="font-medium text-slate-900 dark:text-white">
                      {selectedProject.createUserCode || '-'} / {selectedProject.updateUserCode || '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">作成日時</p>
                    <p className="font-medium text-slate-900 dark:text-white">{formatDate(selectedProject.createDate)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">更新日時</p>
                    <p className="font-medium text-slate-900 dark:text-white">{formatDate(selectedProject.updateDate || selectedProject.updatedAt)}</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectManagementPage;
