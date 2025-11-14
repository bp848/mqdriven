import React, { useMemo } from 'react';
import { Employee } from '../../types';
import StatCard from '../StatCard';
import { Users, DollarSign } from '../Icons';

interface LaborCostManagementProps {
    employees: Employee[];
}

const LaborCostManagement: React.FC<LaborCostManagementProps> = ({ employees }) => {

    const { totalMonthlySalary, averageMonthlySalary } = useMemo(() => {
        const total = employees.reduce((sum, emp) => sum + emp.salary, 0);
        const average = employees.length > 0 ? total / employees.length : 0;
        return { totalMonthlySalary: total, averageMonthlySalary: average };
    }, [employees]);

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <StatCard title="従業員数" value={`${employees.length}人`} icon={<Users className="w-6 h-6 text-indigo-600 dark:text-indigo-400"/>} />
                <StatCard title="月間人件費合計" value={`¥${totalMonthlySalary.toLocaleString()}`} icon={<DollarSign className="w-6 h-6 text-green-600 dark:text-green-400"/>} />
                <StatCard title="平均月給" value={`¥${Math.round(averageMonthlySalary).toLocaleString()}`} icon={<DollarSign className="w-6 h-6 text-blue-600 dark:text-blue-400"/>} />
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden">
                 <div className="p-6">
                    <h2 className="text-xl font-semibold text-slate-800 dark:text-white">従業員・人件費一覧</h2>
                    <p className="mt-1 text-base text-slate-500 dark:text-slate-400">
                      登録されている従業員の給与情報を管理します。
                    </p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-base text-left text-slate-500 dark:text-slate-400">
                        <thead className="text-sm text-slate-700 uppercase bg-slate-50 dark:bg-slate-700 dark:text-slate-300">
                            <tr>
                                <th scope="col" className="px-6 py-3">従業員ID</th>
                                <th scope="col" className="px-6 py-3">氏名</th>
                                <th scope="col" className="px-6 py-3">部署</th>
                                <th scope="col" className="px-6 py-3">役職</th>
                                <th scope="col" className="px-6 py-3 text-right">月給</th>
                                <th scope="col" className="px-6 py-3 text-right">年収（想定）</th>
                            </tr>
                        </thead>
                        <tbody>
                            {employees.map((emp) => (
                                <tr key={emp.id} className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600">
                                    <td className="px-6 py-4 font-mono text-sm">{emp.id}</td>
                                    <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">{emp.name}</td>
                                    <td className="px-6 py-4">{emp.department}</td>
                                    <td className="px-6 py-4">{emp.title}</td>
                                    <td className="px-6 py-4 text-right">¥{emp.salary.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-right font-semibold">¥{(emp.salary * 12).toLocaleString()}</td>
                                </tr>
                            ))}
                            {employees.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="text-center py-16 text-slate-500 dark:text-slate-400">
                                        <p>従業員データがありません。</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default React.memo(LaborCostManagement);
