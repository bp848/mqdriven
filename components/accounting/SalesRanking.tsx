import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { JobStatus, ProjectBudgetSummary, ProjectBudgetFilter, Customer } from '../../types';
import { Trophy, DollarSign, TrendingUp, Briefcase } from '../Icons';
import StatCard from '../StatCard';
import { formatJPY } from '../../utils';
import * as dataService from '../../services/dataService';

interface SalesRankingProps {
    initialSummaries: ProjectBudgetSummary[];
    customers: Customer[];
}

interface CustomerSalesData {
    key: string;
    clientName: string;
    projectCount: number;
    orderCount: number;
    totalSales: number;
    totalMargin: number;
}

const normalizeKey = (value?: string | number | null): string | null => {
    if (value === null || value === undefined) return null;
    const trimmed = String(value).trim();
    return trimmed.length ? trimmed : null;
};

const defaultRange = (): ProjectBudgetFilter => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);
    return {
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10),
    };
};

const SalesRanking: React.FC<SalesRankingProps> = ({ initialSummaries, customers }) => {
    const defaultFilters = useMemo(() => defaultRange(), []);
    const [summaries, setSummaries] = useState<ProjectBudgetSummary[]>(initialSummaries);
    const [filters, setFilters] = useState<ProjectBudgetFilter>(defaultFilters);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const customerLookups = useMemo(() => {
        const byId = new Map<string, Customer>();
        const byCode = new Map<string, Customer>();
        const byName = new Map<string, Customer>();

        customers.forEach(customer => {
            const idKey = normalizeKey(customer.id);
            if (idKey) {
                byId.set(idKey, customer);
            }
            const codeKey = normalizeKey(customer.customerCode);
            if (codeKey) {
                byCode.set(codeKey, customer);
            }
            const nameKey = normalizeKey(customer.customerName)?.toLowerCase();
            if (nameKey) {
                byName.set(nameKey, customer);
            }
        });

        return { byId, byCode, byName };
    }, [customers]);

    const resolveCustomerIdentity = useCallback(
        (summary: ProjectBudgetSummary) => {
            const idKey = normalizeKey(summary.customerId);
            if (idKey && customerLookups.byId.has(idKey)) {
                const customer = customerLookups.byId.get(idKey)!;
                return { key: `id:${idKey}`, name: customer.customerName };
            }

            const codeCandidates = [
                normalizeKey(summary.customerCode),
                normalizeKey(summary.clientName),
            ].filter(Boolean) as string[];
            for (const codeKey of codeCandidates) {
                if (customerLookups.byCode.has(codeKey)) {
                    const customer = customerLookups.byCode.get(codeKey)!;
                    return { key: `code:${codeKey}`, name: customer.customerName };
                }
            }

            const directName = summary.clientName?.trim();
            if (directName) {
                const lower = directName.toLowerCase();
                if (customerLookups.byName.has(lower)) {
                    const customer = customerLookups.byName.get(lower)!;
                    return { key: `name:${lower}`, name: customer.customerName };
                }
                return { key: `name:${lower}`, name: directName };
            }

            const fallbackKey =
                normalizeKey(summary.projectCode) ||
                normalizeKey(summary.jobNumber) ||
                normalizeKey(summary.id) ||
                `unknown-${summary.title}`;

            return { key: `unknown:${fallbackKey ?? 'na'}`, name: '顧客未設定' };
        },
        [customerLookups],
    );

    useEffect(() => {
        setSummaries(initialSummaries);
    }, [initialSummaries]);

    const fetchSummaries = useCallback(async (range: ProjectBudgetFilter) => {
        setIsLoading(true);
        try {
            const data = await dataService.getProjectBudgetSummaries(range);
            setSummaries(data);
            setError(null);
        } catch (err) {
            console.error('Failed to load ranking data', err);
            setError(err instanceof Error ? err.message : '集計に失敗しました。');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSummaries(defaultFilters);
    }, [fetchSummaries, defaultFilters]);

    const handleRefresh = useCallback(() => {
        fetchSummaries(filters);
    }, [fetchSummaries, filters]);

    const groupedCustomerData = useMemo(() => {
        const data = summaries.reduce((acc: Record<string, CustomerSalesData>, summary) => {
            if (summary.status === JobStatus.Cancelled) return acc;
            const { key, name } = resolveCustomerIdentity(summary);
            if (!acc[key]) {
                acc[key] = { key, clientName: name, projectCount: 0, orderCount: 0, totalSales: 0, totalMargin: 0 };
            }
            const sales = summary.orderTotalAmount ?? summary.totalAmount ?? summary.price ?? 0;
            const cost = summary.orderTotalCost ?? summary.totalCost ?? summary.variableCost ?? 0;
            const margin = summary.grossMargin ?? (sales - cost);
            acc[key].projectCount += 1;
            acc[key].orderCount += summary.orderCount ?? (summary.orders?.length ?? 0);
            acc[key].totalSales += sales;
            acc[key].totalMargin += margin;
            return acc;
        }, {});

        return Object.values(data).sort((a, b) => b.totalSales - a.totalSales);
    }, [summaries, resolveCustomerIdentity]);

    const customerData = useMemo(
        () =>
            groupedCustomerData.filter(
                customer =>
                    customer.totalSales !== 0 ||
                    customer.totalMargin !== 0 ||
                    customer.orderCount !== 0,
            ),
        [groupedCustomerData],
    );

    const totals = useMemo(() => {
        return customerData.reduce(
            (acc, customer) => {
                acc.sales += customer.totalSales;
                acc.margin += customer.totalMargin;
                acc.orders += customer.orderCount;
                return acc;
            },
            { sales: 0, margin: 0, orders: 0 }
        );
    }, [customerData]);

    const getRankIcon = (index: number) => {
        const rank = index + 1;
        if (rank === 1) return <Trophy className="w-6 h-6 text-yellow-400" />;
        if (rank === 2) return <Trophy className="w-6 h-6 text-slate-400" />;
        if (rank === 3) return <Trophy className="w-6 h-6 text-yellow-600" />;
        return <span className="font-semibold text-slate-500 text-lg">{rank}</span>;
    };

    const handleFilterChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = event.target;
        setFilters(prev => ({
            ...prev,
            [name]: value || undefined,
        }));
    };

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="期間内 売上高 (P)" value={formatJPY(totals.sales)} icon={<DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />} />
                <StatCard title="期間内 限界利益 (M)" value={formatJPY(totals.margin)} icon={<TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />} />
                <StatCard title="受注件数" value={totals.orders.toLocaleString()} icon={<Briefcase className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />} />
                <StatCard title="対象クライアント数" value={customerData.length.toString()} icon={<Trophy className="w-6 h-6 text-amber-500" />} />
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-6 space-y-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300">開始日</label>
                                <input
                                    type="date"
                                    name="startDate"
                                    value={filters.startDate ?? ''}
                                    onChange={handleFilterChange}
                                    className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-700 px-3 py-2 text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300">終了日</label>
                                <input
                                    type="date"
                                    name="endDate"
                                    value={filters.endDate ?? ''}
                                    onChange={handleFilterChange}
                                    className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-700 px-3 py-2 text-sm"
                                />
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={handleRefresh}
                            disabled={isLoading}
                            className="inline-flex items-center justify-center rounded-lg bg-blue-600 text-white font-semibold px-6 py-2 hover:bg-blue-700 disabled:bg-slate-500 disabled:cursor-not-allowed"
                        >
                            {isLoading ? '集計中...' : '集計する'}
                        </button>
                    </div>
                    {error && <p className="text-sm text-red-600">{error}</p>}
                    <p className="text-xs text-slate-500 dark:text-slate-400">※ 受注件数 = 選択期間内の orders 件数（キャンセル除外）。</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-base text-left text-slate-500 dark:text-slate-400">
                        <thead className="text-sm text-slate-700 uppercase bg-slate-50 dark:bg-slate-700 dark:text-slate-300">
                            <tr>
                                <th scope="col" className="px-6 py-3 w-16 text-center">順位</th>
                                <th scope="col" className="px-6 py-3">クライアント名</th>
                                <th scope="col" className="px-6 py-3 text-right">受注件数</th>
                                <th scope="col" className="px-6 py-3 text-right">売上高 (P)</th>
                                <th scope="col" className="px-6 py-3 text-right">限界利益 (M)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {customerData.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-300">
                                        選択した期間に一致する売上データがありません。
                                    </td>
                                </tr>
                            ) : (
                                customerData.map((customer, index) => (
                                    <tr
                                        key={customer.key}
                                        className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600"
                                    >
                                        <td className="px-6 py-4 text-center">
                                            <div className="w-8 h-8 flex items-center justify-center mx-auto">
                                                {getRankIcon(index)}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">
                                            <div>{customer.clientName}</div>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                案件数: {customer.projectCount}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {customer.orderCount.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-right font-semibold">
                                            {formatJPY(customer.totalSales)}
                                        </td>
                                        <td className="px-6 py-4 text-right font-semibold text-blue-600 dark:text-blue-400">
                                            {formatJPY(customer.totalMargin)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default SalesRanking;
