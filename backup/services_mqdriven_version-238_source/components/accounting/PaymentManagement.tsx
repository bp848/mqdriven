
import React, { useMemo, useState } from 'react';
import { JournalEntry } from '../../types';
import { Loader, CreditCard } from '../Icons';

interface PaymentManagementProps {
    journalEntries: JournalEntry[];
    onExecutePayment: (supplier: string, amount: number) => Promise<void>;
}

const PaymentManagement: React.FC<PaymentManagementProps> = ({ journalEntries, onExecutePayment }) => {
    const [isProcessing, setIsProcessing] = useState<Record<string, boolean>>({});

    const accountsPayable = useMemo(() => {
        const balances: Record<string, number> = {};
        const supplierRegex = /(?:仕入|経費)\s(.+?)(?:\s\(|$)/;

        journalEntries.forEach(entry => {
            if (entry.account === '買掛金') {
                const match = entry.description.match(supplierRegex);
                const supplier = match ? match[1] : '不明な仕入先';
                
                if (!balances[supplier]) {
                    balances[supplier] = 0;
                }
                balances[supplier] += entry.credit - entry.debit;
            }
        });

        return Object.entries(balances)
            .filter(([, balance]) => balance > 0)
            .map(([supplier, balance]) => ({ supplier, balance }));
    }, [journalEntries]);

    const handlePay = async (supplier: string, amount: number) => {
        setIsProcessing(prev => ({ ...prev, [supplier]: true }));
        try {
            await onExecutePayment(supplier, amount);
        } catch (error) {
            console.error(error);
            alert(`支払処理に失敗しました: ${supplier}`);
        } finally {
            setIsProcessing(prev => ({ ...prev, [supplier]: false }));
        }
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-6">
                <h2 className="text-xl font-semibold text-slate-800 dark:text-white">支払管理 (買掛金)</h2>
                <p className="mt-1 text-base text-slate-500 dark:text-slate-400">
                    仕入計上された未払いの請求書を管理し、支払処理を実行します。
                </p>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-base text-left text-slate-500 dark:text-slate-400">
                    <thead className="text-sm text-slate-700 uppercase bg-slate-50 dark:bg-slate-700 dark:text-slate-300">
                        <tr>
                            <th scope="col" className="px-6 py-3">仕入先</th>
                            <th scope="col" className="px-6 py-3 text-right">未払残高</th>
                            <th scope="col" className="px-6 py-3 text-center">アクション</th>
                        </tr>
                    </thead>
                    <tbody>
                        {accountsPayable.map(({ supplier, balance }) => (
                            <tr key={supplier} className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600">
                                <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">{supplier}</td>
                                <td className="px-6 py-4 text-right font-semibold">¥{balance.toLocaleString()}</td>
                                <td className="px-6 py-4 text-center">
                                    <button 
                                        onClick={() => handlePay(supplier, balance)}
                                        disabled={isProcessing[supplier]}
                                        className="flex items-center justify-center gap-2 w-full max-w-[150px] mx-auto bg-green-600 text-white font-semibold py-1.5 px-3 rounded-lg shadow-md hover:bg-green-700 disabled:bg-slate-400"
                                    >
                                        {isProcessing[supplier] ? <Loader className="w-5 h-5 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                                        <span>支払実行</span>
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {accountsPayable.length === 0 && (
                            <tr>
                                <td colSpan={3} className="text-center py-16 text-slate-500 dark:text-slate-400">
                                    <p>支払待ちの買掛金はありません。</p>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default React.memo(PaymentManagement);
