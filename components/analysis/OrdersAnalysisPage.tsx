import React, { useEffect, useMemo, useState } from 'react';
import { getSupabase } from '../../services/supabaseClient';

type TimeRange = '7d' | '30d' | '90d';

const extractErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error && 'message' in error && typeof (error as any).message === 'string') {
    return (error as any).message;
  }
  return 'ordersテーブルの取得に失敗しました';
};

const pad2 = (value: number) => String(value).padStart(2, '0');

const toDbDateTimeKey = (date: Date, endOfDay: boolean): string => {
  const local = new Date(date);
  if (endOfDay) {
    local.setHours(23, 59, 59, 0);
  } else {
    local.setHours(0, 0, 0, 0);
  }
  return `${local.getFullYear()}-${pad2(local.getMonth() + 1)}-${pad2(local.getDate())} ${pad2(local.getHours())}:${pad2(local.getMinutes())}:${pad2(local.getSeconds())}`;
};

const parseDbDate = (value: unknown): Date | null => {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw) return null;
  const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
  const date = new Date(normalized);
  if (!Number.isFinite(date.getTime())) return null;
  return date;
};

const toNumberOrNull = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/,/g, '');
  const number = Number(normalized);
  if (!Number.isFinite(number)) return null;
  return number;
};

const stringifyCell = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const formatCellForTable = (value: unknown, maxLen = 48): { text: string; full: string } => {
  const full = stringifyCell(value);
  const text = full.length > maxLen ? `${full.slice(0, maxLen)}…` : full;
  return { text, full };
};

const OrdersAnalysisPage: React.FC = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [selectedRow, setSelectedRow] = useState<any | null>(null);
  const [selectedColumn, setSelectedColumn] = useState<string>('');

  const { startKey, endKey, label } = useMemo(() => {
    const end = new Date();
    const start = new Date();
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    start.setDate(end.getDate() - days);
    return {
      startKey: toDbDateTimeKey(start, false),
      endKey: toDbDateTimeKey(end, true),
      label: timeRange === '7d' ? '過去7日間' : timeRange === '30d' ? '過去30日間' : '過去90日間',
    };
  }, [timeRange]);

  useEffect(() => {
    setPageIndex(0);
    setSelectedRow(null);
  }, [timeRange, pageSize]);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true);
        setError(null);
        const supabase = getSupabase();

        const rangeFrom = pageIndex * pageSize;
        const rangeTo = rangeFrom + pageSize - 1;

        const { data, error, count } = await supabase
          .from('orders')
          .select('*', { count: 'exact' })
          .gte('order_date', startKey)
          .lte('order_date', endKey)
          .order('order_date', { ascending: false })
          .range(rangeFrom, rangeTo);

        if (error) throw error;

        const nextRows = data || [];
        const columnSet = new Set<string>();
        nextRows.forEach((row: any) => {
          Object.keys(row || {}).forEach((k) => columnSet.add(k));
        });
        const nextColumns = Array.from(columnSet).sort((a, b) => a.localeCompare(b));

        setRows(nextRows);
        setColumns(nextColumns);
        setTotalCount(typeof count === 'number' ? count : null);
        setSelectedColumn((prev) => (prev && nextColumns.includes(prev) ? prev : nextColumns[0] || ''));
      } catch (e) {
        console.error('ordersテーブルの取得に失敗しました:', e);
        setError(extractErrorMessage(e));
        setRows([]);
        setColumns([]);
        setTotalCount(null);
        setSelectedRow(null);
        setSelectedColumn('');
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [endKey, pageIndex, pageSize, startKey]);

  const totalPages = useMemo(() => {
    if (!totalCount) return null;
    return Math.max(1, Math.ceil(totalCount / pageSize));
  }, [pageSize, totalCount]);

  const selectedColumnStats = useMemo(() => {
    if (!selectedColumn) return null;
    const values = rows.map((r) => r?.[selectedColumn]).filter((v) => v !== null && v !== undefined);
    const stringValues = values.map(stringifyCell);
    const distinctCount = new Set(stringValues).size;

    const numericValues: number[] = [];
    const dateValues: Date[] = [];
    values.forEach((v) => {
      const n = toNumberOrNull(v);
      if (n !== null) numericValues.push(n);
      const d = parseDbDate(v);
      if (d) dateValues.push(d);
    });

    const allNumeric = values.length > 0 && numericValues.length === values.length;
    const allDate = values.length > 0 && dateValues.length === values.length;

    if (allNumeric) {
      const sum = numericValues.reduce((s, n) => s + n, 0);
      const min = Math.min(...numericValues);
      const max = Math.max(...numericValues);
      const avg = numericValues.length ? sum / numericValues.length : 0;
      return { kind: 'number' as const, count: values.length, distinctCount, sum, min, max, avg };
    }

    if (allDate) {
      const min = new Date(Math.min(...dateValues.map((d) => d.getTime())));
      const max = new Date(Math.max(...dateValues.map((d) => d.getTime())));
      return { kind: 'date' as const, count: values.length, distinctCount, min, max };
    }

    const counts = new Map<string, number>();
    stringValues.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
    const topValues = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    return { kind: 'string' as const, count: values.length, distinctCount, topValues };
  }, [rows, selectedColumn]);

  const downloadCsv = () => {
    const headers = columns;
    const escapeCsv = (value: unknown): string => {
      const raw = stringifyCell(value);
      const needsQuotes = raw.includes(',') || raw.includes('"') || raw.includes('\n') || raw.includes('\r');
      const escaped = raw.replace(/\"/g, '""');
      return needsQuotes ? `"${escaped}"` : escaped;
    };
    const lines = [
      headers.join(','),
      ...rows.map((row) => headers.map((h) => escapeCsv(row?.[h])).join(',')),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders_${startKey.replace(/[: ]/g, '-')}_to_${endKey.replace(/[: ]/g, '-')}_p${pageIndex + 1}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">受注テーブル分析（orders）</h1>
        <p className="text-gray-600">ordersテーブルの全カラムを閲覧し、選択カラムの簡易集計を行います（期間: {label}）。</p>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {(['7d', '30d', '90d'] as const).map((range) => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              timeRange === range ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {range === '7d' ? '過去7日間' : range === '30d' ? '過去30日間' : '過去90日間'}
          </button>
        ))}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label className="text-sm text-gray-600">
            表示件数:
            <select
              className="ml-2 border border-gray-300 rounded-md px-2 py-1 text-sm"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
            >
              {[10, 25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={downloadCsv}
            disabled={!rows.length}
            className="px-3 py-2 rounded-lg text-sm font-medium border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            CSV出力（表示中）
          </button>
        </div>
      </div>

      <div className="mb-6 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-sm text-gray-700">
            取得範囲: <span className="font-mono">{startKey}</span> 〜 <span className="font-mono">{endKey}</span>
          </div>
          <div className="text-sm text-gray-700">
            件数: <span className="font-semibold">{totalCount ?? '—'}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
              disabled={pageIndex === 0 || loading}
              className="px-3 py-2 rounded-lg text-sm font-medium border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              前へ
            </button>
            <div className="text-sm text-gray-700">
              ページ: <span className="font-semibold">{pageIndex + 1}</span>
              {totalPages ? <span className="text-gray-500"> / {totalPages}</span> : null}
            </div>
            <button
              onClick={() => setPageIndex((p) => p + 1)}
              disabled={loading || (totalPages !== null && pageIndex + 1 >= totalPages)}
              className="px-3 py-2 rounded-lg text-sm font-medium border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              次へ
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-6 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">ordersデータを読み込み中...</p>
          </div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-red-900 mb-2">データ取得に失敗しました</h2>
          <p className="text-red-800 text-sm break-words">{error}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">データ（全カラム）</h2>
                <div className="text-sm text-gray-600">クリックで行詳細（JSON）</div>
              </div>
              <div className="overflow-auto max-h-[70vh]">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      {columns.map((col) => (
                        <th key={col} className="text-left font-medium text-gray-700 px-3 py-2 whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.map((row, idx) => (
                      <tr
                        key={idx}
                        className={`cursor-pointer hover:bg-blue-50 ${selectedRow === row ? 'bg-blue-50' : ''}`}
                        onClick={() => setSelectedRow(row)}
                      >
                        {columns.map((col) => {
                          const { text, full } = formatCellForTable(row?.[col]);
                          return (
                            <td key={col} className="px-3 py-2 whitespace-nowrap text-gray-900" title={full}>
                              {text || <span className="text-gray-400">—</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={columns.length || 1} className="px-4 py-6 text-center text-gray-600">
                          対象期間のデータがありません。
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">カラム分析（選択式）</h2>
              <label className="block text-sm text-gray-600 mb-2">
                対象カラム
                <select
                  className="mt-2 w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  value={selectedColumn}
                  onChange={(e) => setSelectedColumn(e.target.value)}
                >
                  {columns.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>

              {selectedColumnStats ? (
                <div className="mt-3 text-sm text-gray-800 space-y-2">
                  <div>
                    件数: <span className="font-semibold">{selectedColumnStats.count}</span> / distinct:{' '}
                    <span className="font-semibold">{selectedColumnStats.distinctCount}</span>
                  </div>

                  {selectedColumnStats.kind === 'number' ? (
                    <div className="space-y-1">
                      <div>sum: {selectedColumnStats.sum.toLocaleString()}</div>
                      <div>avg: {selectedColumnStats.avg.toLocaleString()}</div>
                      <div>min: {selectedColumnStats.min.toLocaleString()}</div>
                      <div>max: {selectedColumnStats.max.toLocaleString()}</div>
                    </div>
                  ) : selectedColumnStats.kind === 'date' ? (
                    <div className="space-y-1">
                      <div>min: {selectedColumnStats.min.toLocaleString()}</div>
                      <div>max: {selectedColumnStats.max.toLocaleString()}</div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-gray-600">上位（表示中の行から集計）</div>
                      <div className="space-y-1">
                        {selectedColumnStats.topValues.map(([value, count]) => (
                          <div key={value} className="flex items-center justify-between gap-3">
                            <div className="truncate" title={value}>
                              {value || <span className="text-gray-400">（空）</span>}
                            </div>
                            <div className="font-semibold">{count}</div>
                          </div>
                        ))}
                        {selectedColumnStats.topValues.length === 0 ? (
                          <div className="text-gray-500">（値なし）</div>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-gray-500">カラムを選択してください。</div>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">行詳細（JSON）</h2>
              {selectedRow ? (
                <pre className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-3 overflow-auto max-h-[45vh]">
                  {JSON.stringify(selectedRow, null, 2)}
                </pre>
              ) : (
                <div className="text-sm text-gray-500">左の表で行をクリックしてください。</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrdersAnalysisPage;

