import React, { useState, useEffect, useCallback } from 'react';
import { ApprovalRoute, EmployeeUser, Toast, ConfirmationDialogProps } from '../../types';
import { getApprovalRoutes, addApprovalRoute, updateApprovalRoute, deleteApprovalRoute, getUsers } from '../../services/dataService';
import { Loader, PlusCircle, X, Save, Trash2, Pencil, Send } from '../Icons';
import EmptyState from '../ui/EmptyState';

interface ApprovalRouteModalProps {
    route: ApprovalRoute | null;
    allUsers: EmployeeUser[];
    onClose: () => void;
    onSave: (route: Partial<ApprovalRoute>) => Promise<void>;
    addToast: (message: string, type: Toast['type']) => void;
}

const ApprovalRouteModal: React.FC<ApprovalRouteModalProps> = ({ route, allUsers, onClose, onSave, addToast }) => {
    const [name, setName] = useState(route?.name || '');
    const [steps, setSteps] = useState<{ approverId: string }[]>(route?.routeData.steps || [{ approverId: '' }]);
    const [isSaving, setIsSaving] = useState(false);

    const handleStepChange = (index: number, approverId: string) => {
        const newSteps = [...steps];
        newSteps[index] = { approverId: approverId };
        setSteps(newSteps);
    };

    const addStep = () => setSteps([...steps, { approverId: '' }]);
    const removeStep = (index: number) => {
        if (steps.length > 1) {
            setSteps(steps.filter((_, i) => i !== index));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || steps.some(s => !s.approverId)) {
            addToast('ルート名とすべてのステップの承認者は必須です。', 'error');
            return;
        }
        setIsSaving(true);
        try {
            await onSave({ ...route, name, routeData: { steps } });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg">
                <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-700">
                    <h2 className="text-xl font-bold">{route ? '承認ルート編集' : '新規承認ルート作成'}</h2>
                    <button type="button" onClick={onClose}><X className="w-6 h-6" /></button>
                </div>
                <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium mb-1">ルート名</label>
                        <input id="name" type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg p-2.5" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">承認ステップ</label>
                        <div className="space-y-3">
                            {steps.map((step, index) => (
                                <div key={index} className="flex items-center gap-2">
                                    <span className="font-semibold">{index + 1}.</span>
                                    <select value={step.approverId} onChange={e => handleStepChange(index, e.target.value)} className="flex-grow bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg p-2.5">
                                        <option value="">承認者を選択...</option>
                                        {allUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                    </select>
                                    <button type="button" onClick={() => removeStep(index)} disabled={steps.length <= 1} className="p-2 text-slate-400 hover:text-red-500 disabled:opacity-50"><Trash2 className="w-5 h-5"/></button>
                                </div>
                            ))}
                        </div>
                        <button type="button" onClick={addStep} className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700">
                            <PlusCircle className="w-4 h-4"/>ステップを追加
                        </button>
                    </div>
                </div>
                <div className="flex justify-end gap-4 p-6 border-t border-slate-200 dark:border-slate-700">
                    <button type="button" onClick={onClose} className="bg-slate-200 dark:bg-slate-600 font-semibold py-2 px-4 rounded-lg">キャンセル</button>
                    <button type="submit" disabled={isSaving} className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2 disabled:bg-slate-400">
                        {isSaving ? <Loader className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        {isSaving ? '保存中...' : '保存'}
                    </button>
                </div>
            </form>
        </div>
    );
};

interface ApprovalRouteManagementPageProps {
    addToast: (message: string, type: Toast['type']) => void;
    requestConfirmation: (dialog: Omit<ConfirmationDialogProps, 'isOpen' | 'onClose'>) => void;
}

const ApprovalRouteManagementPage: React.FC<ApprovalRouteManagementPageProps> = ({ addToast, requestConfirmation }) => {
    const [routes, setRoutes] = useState<ApprovalRoute[]>([]);
    const [allUsers, setAllUsers] = useState<EmployeeUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedRoute, setSelectedRoute] = useState<ApprovalRoute | null>(null);

    const usersById = React.useMemo(() => new Map(allUsers.map(u => [u.id, u.name])), [allUsers]);

    const loadData = useCallback(async () => {
        try {
            setIsLoading(true);
            const [routesData, usersData] = await Promise.all([getApprovalRoutes(), getUsers()]);
            setRoutes(routesData);
            setAllUsers(usersData);
            setError('');
        } catch (err: any) {
            setError(err.message || 'データの読み込みに失敗しました。');
            addToast(err.message || 'データの読み込みに失敗しました。', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [addToast]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleOpenModal = (route: ApprovalRoute | null = null) => {
        setSelectedRoute(route);
        setIsModalOpen(true);
    };
    
    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedRoute(null);
    };

    const handleSaveRoute = async (routeData: Partial<ApprovalRoute>) => {
        try {
            if (routeData.id) {
                await updateApprovalRoute(routeData.id, { name: routeData.name, routeData: routeData.routeData });
                addToast('承認ルートが更新されました。', 'success');
            } else {
                await addApprovalRoute({ name: routeData.name || '', routeData: routeData.routeData || { steps: [] } });
                addToast('新しい承認ルートが作成されました。', 'success');
            }
            await loadData();
            handleCloseModal();
        } catch (err: any) {
            addToast(`保存に失敗しました: ${err.message}`, 'error');
        }
    };
    
    const handleDeleteRoute = (route: ApprovalRoute) => {
        requestConfirmation({
            title: '承認ルートを削除',
            message: `本当に承認ルート「${route.name}」を削除しますか？このルートを使用している申請に影響が出る可能性があります。`,
            onConfirm: async () => {
                try {
                    await deleteApprovalRoute(route.id);
                    addToast('承認ルートが削除されました。', 'success');
                    await loadData();
                } catch (err: any) {
                    addToast(`削除に失敗しました: ${err.message}`, 'error');
                }
            }
        });
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-semibold">承認ルート管理</h2>
                    <p className="mt-1 text-base text-slate-500">申請で使用する承認ルートを定義します。</p>
                </div>
                <button onClick={() => handleOpenModal()} className="flex items-center gap-2 bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg">
                    <PlusCircle className="w-5 h-5" />
                    新規ルート作成
                </button>
            </div>
            {isLoading ? (
                <div className="p-16 text-center"><Loader className="w-8 h-8 mx-auto animate-spin" /></div>
            ) : error ? (
                <div className="p-16 text-center text-red-600">{error}</div>
            ) : routes.length === 0 ? (
                <EmptyState
                    icon={Send}
                    title="承認ルートがありません"
                    message="最初の承認ルートを作成して、申請ワークフローを始めましょう。"
                    action={{label: "新規ルート作成", onClick: () => handleOpenModal(), icon: PlusCircle}}
                />
            ) : (
                 <table className="w-full text-base text-left">
                    <thead className="text-sm uppercase bg-slate-50 dark:bg-slate-700">
                        <tr>
                            <th className="px-6 py-3">ルート名</th>
                            <th className="px-6 py-3">承認ステップ</th>
                            <th className="px-6 py-3 text-center">操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {routes.map(route => (
                            <tr key={route.id} className="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                <td className="px-6 py-4 font-medium">{route.name}</td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        {route.routeData.steps.map((step, i) => (
                                            <React.Fragment key={i}>
                                                <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded-md text-sm">{usersById.get(step.approverId) || '不明'}</span>
                                                {i < route.routeData.steps.length - 1 && <span className="text-slate-400">&rarr;</span>}
                                            </React.Fragment>
                                        ))}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex justify-center items-center gap-2">
                                        <button onClick={() => handleOpenModal(route)} className="p-2 text-slate-500 hover:text-blue-600"><Pencil className="w-5 h-5" /></button>
                                        <button onClick={() => handleDeleteRoute(route)} className="p-2 text-slate-500 hover:text-red-600"><Trash2 className="w-5 h-5" /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
             {isModalOpen && <ApprovalRouteModal route={selectedRoute} allUsers={allUsers} onClose={handleCloseModal} onSave={handleSaveRoute} addToast={addToast} />}
        </div>
    );
};

export default ApprovalRouteManagementPage;