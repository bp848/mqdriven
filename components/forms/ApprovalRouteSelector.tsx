import React, { useState, useEffect } from 'react';
import { ApprovalRoute } from '../../types';
import { getApprovalRoutes } from '../../services/dataService';

interface ApprovalRouteSelectorProps {
    onChange: (routeId: string) => void;
    isSubmitting: boolean;
    requiredRouteName?: string;
    variant?: 'default' | 'inline';
    highlightRequired?: boolean;
    labelAdornment?: React.ReactNode;
}

const ApprovalRouteSelector: React.FC<ApprovalRouteSelectorProps> = ({
    onChange,
    isSubmitting,
    requiredRouteName,
    variant = 'default',
    highlightRequired = false,
    labelAdornment,
}) => {
    const [routes, setRoutes] = useState<ApprovalRoute[]>([]);
    const [selectedRoute, setSelectedRoute] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<React.ReactNode | string>('');

    useEffect(() => {
        let isMounted = true;
        const fetchRoutes = async () => {
            try {
                const fetchedRoutes = await getApprovalRoutes();
                if (isMounted) {
                    setRoutes(fetchedRoutes);
                    
                    let defaultRoute: ApprovalRoute | undefined;
                    if (requiredRouteName) {
                        defaultRoute = fetchedRoutes.find(r => r.name === requiredRouteName);
                        if (!defaultRoute) {
                            setError(<>固定承認ルート「<strong>{requiredRouteName}</strong>」が見つかりませんでした。<br/>管理者はデータベース設定を確認し、この名前の承認ルートが存在し、承認者が正しく設定されていることを確認してください。</>);
                        }
                    }
                    
                    if (!defaultRoute && fetchedRoutes.length > 0) {
                        defaultRoute = fetchedRoutes[0];
                    }
                    
                    if (defaultRoute) {
                        setSelectedRoute(defaultRoute.id);
                        onChange(defaultRoute.id);
                    } else if (fetchedRoutes.length === 0) {
                        setError('利用可能な承認ルートがありません。管理者に連絡してください。');
                    }
                }
            } catch (error) {
                console.error("Failed to fetch approval routes", error);
                if (isMounted) setError("承認ルートの読み込みに失敗しました。");
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };
        fetchRoutes();
        return () => {
            isMounted = false;
        };
    }, [onChange, requiredRouteName]);

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const routeId = e.target.value;
        setSelectedRoute(routeId);
        onChange(routeId);
    };

    const selectClass = [
        'w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-70 disabled:bg-slate-200 dark:disabled:bg-slate-600',
        highlightRequired
            ? 'border-rose-300 bg-rose-50/70 focus:ring-rose-500 focus:border-rose-500 dark:bg-rose-500/10 dark:border-rose-400'
            : '',
    ]
        .filter(Boolean)
        .join(' ');

    const wrapperClass =
        variant === 'inline'
            ? 'space-y-2'
            : 'mt-6 pt-4 border-t border-slate-200 dark:border-slate-700 space-y-2';
    const labelClass =
        variant === 'inline'
            ? 'text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2'
            : 'block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2';

    return (
        <div className={wrapperClass}>
            <label htmlFor="approval-route-selector" className={labelClass}>
                <span>
                    承認ルート
                    {!labelAdornment && ' *'}
                </span>
                {labelAdornment}
            </label>
            <select
                id="approval-route-selector"
                value={selectedRoute}
                onChange={handleChange}
                className={selectClass}
                disabled={isSubmitting || isLoading}
                required
            >
                <option value="">{isLoading ? '読み込み中...' : '承認ルートを選択...'}</option>
                {routes.map(route => <option key={route.id} value={route.id}>{route.name}</option>)}
            </select>
            {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
        </div>
    );
};

export default ApprovalRouteSelector;
