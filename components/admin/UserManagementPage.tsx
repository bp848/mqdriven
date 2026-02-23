import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Toast, ConfirmationDialogProps, EmployeeUser } from '../../types';
import { getUsers, addUser, updateUser, deleteUser } from '../../services/dataService';
import { Loader, PlusCircle, X, Save, Trash2, Pencil, AlertTriangle } from '../Icons';

const UserModal: React.FC<{
    user: EmployeeUser | null;
    onClose: () => void;
    onSave: (user: Partial<EmployeeUser>) => Promise<void>;
}> = ({ user, onClose, onSave }) => {
    const [name, setName] = useState(user?.name || '');
    const [email, setEmail] = useState(user?.email || '');
    const [role, setRole] = useState<'admin' | 'user'>(() => {
        const userRole = user?.role;
        if (typeof userRole === 'function') {
            return userRole();
        }
        return userRole === 'admin' ? 'admin' : 'user';
    });
    const [isActive, setIsActive] = useState<boolean>(user?.isActive ?? true);
    const [notificationEnabled, setNotificationEnabled] = useState<boolean>(user?.notificationEnabled ?? true);
    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !email) return;
        setIsSaving(true);
        await onSave({ ...user, name, email, role, isActive, notificationEnabled });
        setIsSaving(false);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md">
                <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-700">
                    <h2 className="text-xl font-bold">{user ? 'ユーザー編集' : '新規ユーザー作成'}</h2>
                    <button type="button" onClick={onClose}><X className="w-6 h-6" /></button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium mb-1">氏名</label>
                        <input id="name" type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg p-2.5" />
                    </div>
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium mb-1">メールアドレス</label>
                        <input id="email" type="email" value={email || ''} onChange={e => setEmail(e.target.value)} required className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg p-2.5" />
                    </div>
                    <div>
                        <label htmlFor="role" className="block text-sm font-medium mb-1">役割</label>
                        <select id="role" value={role} onChange={e => setRole(e.target.value as 'admin' | 'user')} className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg p-2.5">
                            <option value="user">一般ユーザー</option>
                            <option value="admin">管理者</option>
                        </select>
                    </div>
                    <div>
                        <label className="inline-flex items-center space-x-2 text-sm font-medium">
                            <input
                                type="checkbox"
                                checked={isActive}
                                onChange={e => setIsActive(e.target.checked)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span>有効ユーザー</span>
                        </label>
                    </div>
                    <div>
                        <label className="inline-flex items-center space-x-2 text-sm font-medium">
                            <input
                                type="checkbox"
                                checked={notificationEnabled}
                                onChange={e => setNotificationEnabled(e.target.checked)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span>メール通知を有効にする</span>
                        </label>
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

interface UserManagementPageProps {
    currentUser: EmployeeUser | null;
    addToast: (message: string, type: Toast['type']) => void;
    onUserChange?: (user: EmployeeUser | null) => void;
    requestConfirmation: (dialog: Omit<ConfirmationDialogProps, 'isOpen' | 'onClose'>) => void;
}

const UserManagementPage: React.FC<UserManagementPageProps> = ({ addToast, requestConfirmation, currentUser, onUserChange }) => {
    const [users, setUsers] = useState<EmployeeUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<EmployeeUser | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const canManageUsers = currentUser?.role === 'admin';

    const loadUsers = useCallback(async () => {
        try {
            setIsLoading(true);
            const data = await getUsers();
            setUsers(data);
        } catch (err: any) {
            setError(err.message || 'ユーザーデータの読み込みに失敗しました。');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadUsers();
    }, [loadUsers]);

    const handleOpenModal = (user: EmployeeUser | null = null) => {
        if (!canManageUsers) {
            addToast('ユーザーの管理は管理者のみ可能です。', 'error');
            return;
        }
        setSelectedUser(user);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedUser(null);
    };

    const handleSaveUser = async (userData: Partial<EmployeeUser>) => {
        if (!canManageUsers) {
            addToast('ユーザーの管理は管理者のみ可能です。', 'error');
            return;
        }
        try {
            if (userData.id) {
                await updateUser(userData.id, userData);
                addToast('ユーザー情報が更新されました。', 'success');
            } else {
                await addUser({
                    name: userData.name || '',
                    email: userData.email || null,
                    role: userData.role === 'admin' ? 'admin' : 'user',
                    isActive: userData.isActive ?? true,
                    notificationEnabled: userData.notificationEnabled ?? true,
                });
                addToast('新規ユーザーが追加されました。', 'success');
            }
            await loadUsers();
            handleCloseModal();
        } catch (err: any) {
            addToast(`保存に失敗しました: ${err.message}`, 'error');
        }
    };

    const handleDeleteUser = (user: EmployeeUser) => {
        if (!canManageUsers) {
            addToast('ユーザーの管理は管理者のみ可能です。', 'error');
            return;
        }
        requestConfirmation({
            title: 'ユーザーを削除',
            message: `本当にユーザー「${user.name}」を削除しますか？この操作は元に戻せません。`,
            onConfirm: async () => {
                try {
                    await deleteUser(user.id);
                    addToast('ユーザーが削除されました。', 'success');
                    await loadUsers();
                } catch (err: any) {
                    const message = err?.message as string | undefined;
                    if (message && (message.includes('orders_create_user_id_fkey') || message.includes('is still referenced from table "orders"'))) {
                        addToast('このユーザーに紐づく注文が残っているため削除できません。担当者変更などの対応が必要です。', 'error');
                    } else {
                        addToast(`削除に失敗しました: ${message || '原因不明のエラーが発生しました。'}`, 'error');
                    }
                }
            }
        });
    };

    const filteredUsers = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        let filtered = users.filter(user => user.isActive !== false); // 無効ユーザーを除外
        if (!term) return filtered;
        return filtered.filter(user => {
            const fields = [
                user.name,
                user.email,
                user.department || '',
                user.title || '',
                user.role === 'admin' ? '管理者' : '一般ユーザー',
            ];
            return fields.some(field => field.toLowerCase().includes(term));
        });
    }, [users, searchTerm]);

    return (
        <div className="rounded-2xl shadow-sm">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="text-xl font-semibold">ユーザー管理</h2>
                    <p className="mt-1 text-base text-slate-500">ユーザーの追加、編集、役割の変更を行います。</p>
                    <p className="mt-1 text-sm text-slate-400">全 {users.length} 件中 {filteredUsers.length} 件を表示</p>
                </div>
                <div className="flex flex-col gap-3 md:flex-row md:items-center">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="氏名・メール・部門で検索..."
                        className="w-full md:w-72 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 text-sm focus:ring-blue-500 focus:border-blue-500"
                        aria-label="ユーザー検索"
                    />
                    <button
                        onClick={() => handleOpenModal()}
                        className={`flex items-center justify-center gap-2 font-semibold py-2 px-4 rounded-lg ${canManageUsers ? 'bg-blue-600 text-white' : 'bg-slate-400 text-slate-200 cursor-not-allowed'
                            }`}
                        disabled={!canManageUsers}
                    >
                        <PlusCircle className="w-5 h-5" />
                        新規ユーザー追加
                    </button>
                </div>
            </div>
            {!canManageUsers && (
                <div className="mx-6 mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-100">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                        <p>このページでのユーザー追加・変更・削除は管理者のみが実行できます。管理者アカウントでログインしてください。</p>
                    </div>
                </div>
            )}
            {isLoading ? (
                <div className="p-16 text-center"><Loader className="w-8 h-8 mx-auto animate-spin" /></div>
            ) : error ? (
                <div className="p-16 text-center text-red-600">{error}</div>
            ) : (
                <table className="w-full text-base text-left">
                    <thead className="text-sm uppercase bg-slate-50 dark:bg-slate-700">
                        <tr>
                            <th className="px-6 py-3">氏名</th>
                            <th className="px-6 py-3">部門</th>
                            <th className="px-6 py-3">役職</th>
                            <th className="px-6 py-3">メールアドレス</th>
                            <th className="px-6 py-3">役割</th>
                            <th className="px-6 py-3">状態</th>
                            <th className="px-6 py-3">通知</th>
                            <th className="px-6 py-3">登録日</th>
                            <th className="px-6 py-3 text-center">操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredUsers.length === 0 ? (
                            <tr>
                                <td className="px-6 py-8 text-center text-slate-500" colSpan={7}>
                                    条件に一致するユーザーが見つかりませんでした。
                                </td>
                            </tr>
                        ) : (
                            filteredUsers.map(user => (
                                <tr key={user.id} className="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                    <td className="px-6 py-4 font-medium">{user.name}</td>
                                    <td className="px-6 py-4 text-slate-500">{user.department || '未設定'}</td>
                                    <td className="px-6 py-4 text-slate-500">{user.title || '未設定'}</td>
                                    <td className="px-6 py-4 text-slate-500">{user.email}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-800'}`}>
                                            {user.role === 'admin' ? '管理者' : '一般ユーザー'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span
                                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${user.isActive === false
                                                ? 'bg-slate-200 text-slate-600'
                                                : 'bg-emerald-100 text-emerald-800'
                                                }`}
                                        >
                                            {user.isActive === false ? '無効' : '有効'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <button
                                            onClick={async () => {
                                                if (!canManageUsers) return;
                                                try {
                                                    await updateUser(user.id, { notificationEnabled: !user.notificationEnabled });
                                                    addToast(
                                                        !user.notificationEnabled
                                                            ? '通知を有効にしました。'
                                                            : '通知を無効にしました。',
                                                        'success'
                                                    );
                                                    await loadUsers();
                                                } catch (err: any) {
                                                    addToast(`更新に失敗しました: ${err.message}`, 'error');
                                                }
                                            }}
                                            className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${user.notificationEnabled !== false
                                                ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                                                : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                                                } ${!canManageUsers ? 'cursor-not-allowed opacity-50' : ''}`}
                                            disabled={!canManageUsers}
                                        >
                                            {user.notificationEnabled !== false ? 'ON' : 'OFF'}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4">{new Date(user.createdAt).toLocaleDateString()}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex justify-center items-center gap-2">
                                            {canManageUsers ? (
                                                <>
                                                    <button onClick={() => handleOpenModal(user)} className="p-2 text-slate-500 hover:text-blue-600"><Pencil className="w-5 h-5" /></button>
                                                    {user.isActive !== false && user.id !== currentUser?.id && onUserChange && (
                                                        <button
                                                            onClick={() => {
                                                                onUserChange(user);
                                                                addToast(`${user.name}として代理ログインしました`, 'success');
                                                            }}
                                                            className="p-2 text-slate-500 hover:text-green-600"
                                                            title="代理ログイン"
                                                        >
                                                            <AlertTriangle className="w-5 h-5" />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={async () => {
                                                            try {
                                                                await updateUser(user.id, { isActive: user.isActive === false ? true : false });
                                                                addToast(
                                                                    user.isActive === false
                                                                        ? 'ユーザーを有効にしました。'
                                                                        : 'ユーザーを無効にしました。',
                                                                    'success'
                                                                );
                                                                await loadUsers();
                                                            } catch (err: any) {
                                                                addToast(`更新に失敗しました: ${err.message}`, 'error');
                                                            }
                                                        }}
                                                        className="p-2 text-slate-500 hover:text-amber-600 text-xs"
                                                    >
                                                        {user.isActive === false ? '有効化' : '無効化'}
                                                    </button>
                                                    <button onClick={() => handleDeleteUser(user)} className="p-2 text-slate-500 hover:text-red-600"><Trash2 className="w-5 h-5" /></button>
                                                </>
                                            ) : (
                                                <span className="text-xs text-slate-400">権限がありません</span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            )}
            {isModalOpen && canManageUsers && <UserModal user={selectedUser} onClose={handleCloseModal} onSave={handleSaveUser} />}
        </div>
    );
};

export default UserManagementPage;
