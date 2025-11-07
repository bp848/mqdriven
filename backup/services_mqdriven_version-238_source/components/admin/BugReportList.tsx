import React, { useState, useMemo } from 'react';
import { BugReport, BugReportStatus, SortConfig } from '../../types';
import { Loader, X, Bug, Eye } from '../Icons';
import SortableHeader from '../ui/SortableHeader';
import EmptyState from '../ui/EmptyState';
import { formatDate } from '../../utils';

const BugReportStatusBadge: React.FC<{ status: BugReportStatus }> = ({ status }) => {
    const styles: Record<BugReportStatus, string> = {
        [BugReportStatus.Open]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
        [BugReportStatus.InProgress]: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
        [BugReportStatus.Closed]: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
    };
    return <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${styles[status]}`}>{status}</span>;
};

const ReportDetailModal: React.FC<{ report: BugReport; onClose: () => void }> = ({ report, onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-700">
                <div>
                    <h2 className="text-xl font-bold">{report.summary}</h2>
                    <p className="text-sm text-slate-500">報告者: {report.reporterName} | {formatDate(report.createdAt)}</p>
                </div>
                <button onClick={onClose}><X className="w-6 h-6"/></button>
            </div>
            <div className="p-6 overflow-y-auto">
                <p className="whitespace-pre-wrap break-words">{report.description}</p>
            </div>
            <div className="p-4 border-t border-slate-200 dark:border-slate-700 text-right">
                <button onClick={onClose} className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg">閉じる</button>
            </div>
        </div>
    </div>
);


interface BugReportListProps {
  reports: BugReport[];
  onUpdateReport: (id: string, updates: Partial<BugReport>) => Promise<void>;
  searchTerm: string;
}

const BugReportList: React.FC<BugReportListProps> = ({ reports, onUpdateReport, searchTerm }) => {
    const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'createdAt', direction: 'descending' });
    const [selectedReport, setSelectedReport] = useState<BugReport | null>(null);

    const filteredReports = useMemo(() => {
        if (!searchTerm) return reports;
        const lower = searchTerm.toLowerCase();
        return reports.filter(r =>
            r.reporterName.toLowerCase().includes(lower) ||
            r.summary.toLowerCase().includes(lower) ||
            r.reportType.toLowerCase().includes(lower)
        );
    }, [reports, searchTerm]);

    const sortedReports = useMemo(() => {
        const sortable = [...filteredReports];
        if (sortConfig) {
            sortable.sort((a, b) => {
                const aVal = a[sortConfig.key as keyof BugReport];
                const bVal = b[sortConfig.key as keyof BugReport];
                if (aVal < bVal) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return sortable;
    }, [filteredReports, sortConfig]);

    const requestSort = (key: string) => {
        const direction = sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending' ? 'descending' : 'ascending';
        setSortConfig({ key, direction });
    };

    if (reports.length === 0) {
        return <EmptyState icon={Bug} title="報告はまだありません" message="右下のチャットボタンからバグ報告や改善要望を送ることができます。" />;
    }

    return (
        <>
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-base text-left">
                        <thead className="text-sm uppercase bg-slate-50 dark:bg-slate-700">
                            <tr>
                                <SortableHeader sortKey="createdAt" label="報告日時" sortConfig={sortConfig} requestSort={requestSort} />
                                <SortableHeader sortKey="reporterName" label="報告者" sortConfig={sortConfig} requestSort={requestSort} />
                                <SortableHeader sortKey="reportType" label="種別" sortConfig={sortConfig} requestSort={requestSort} />
                                <th scope="col" className="px-6 py-3 font-medium">概要</th>
                                <SortableHeader sortKey="status" label="ステータス" sortConfig={sortConfig} requestSort={requestSort} />
                                <th scope="col" className="px-6 py-3 font-medium text-center">詳細</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {sortedReports.map(report => (
                                <tr key={report.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                    <td className="px-6 py-4 whitespace-nowrap">{formatDate(report.createdAt)}</td>
                                    <td className="px-6 py-4 font-medium">{report.reporterName}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${report.reportType === 'bug' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                                            {report.reportType === 'bug' ? 'バグ報告' : '改善要望'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 max-w-sm truncate">{report.summary}</td>
                                    <td className="px-6 py-4">
                                        <select
                                            value={report.status}
                                            onChange={(e) => onUpdateReport(report.id, { status: e.target.value as BugReportStatus })}
                                            onClick={(e) => e.stopPropagation()}
                                            className="bg-transparent font-medium border-none focus:ring-0 p-0"
                                        >
                                            {Object.values(BugReportStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <button onClick={() => setSelectedReport(report)} className="p-2 text-slate-500 hover:text-blue-600"><Eye className="w-5 h-5"/></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            {selectedReport && <ReportDetailModal report={selectedReport} onClose={() => setSelectedReport(null)} />}
        </>
    );
};

export default BugReportList;