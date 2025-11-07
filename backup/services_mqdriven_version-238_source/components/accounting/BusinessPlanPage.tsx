import React, { useState, useMemo, useEffect } from 'react';
import { allBusinessPlans } from '../../data/businessPlanData';
import { BusinessPlan, EmployeeUser } from '../../types';

const JPY = (n: number | string) => {
    const num = typeof n === 'string' ? parseFloat(n) : n;
    if (isNaN(num)) return n;
    // 単位は百万円なので1,000,000を掛ける
    return `¥${(num * 1_000_000).toLocaleString()}`;
};

const formatNumber = (n: number | string) => {
    const num = typeof n === 'string' ? parseFloat(n) : n;
    if (isNaN(num)) return n;
    return num.toLocaleString();
}

const GValue: React.FC<{ value: number | string }> = ({ value }) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    const isNegative = !isNaN(num) && num < 0;
    return (
        <span className={isNegative ? 'text-red-500' : ''}>
            {formatNumber(value)}
        </span>
    );
};

interface BusinessPlanPageProps {
    allUsers: EmployeeUser[];
}

const BusinessPlanPage: React.FC<BusinessPlanPageProps> = ({ allUsers }) => {
    const [selectedDepartment, setSelectedDepartment] = useState('');

    const departments = useMemo(() => {
        const departmentSet = new Set<string>();
        // Add departments from hardcoded business plan data
        allBusinessPlans.forEach(plan => {
            if (plan.name && plan.name.endsWith('部')) {
                departmentSet.add(plan.name);
            }
        });
        // Add departments from user data
        allUsers.forEach(user => {
            if (user.department) {
                departmentSet.add(user.department);
            }
        });
        return Array.from(departmentSet).sort();
    }, [allUsers]);

    useEffect(() => {
        if (departments.length > 0 && !departments.includes(selectedDepartment)) {
            setSelectedDepartment(departments[0]);
        }
    }, [departments, selectedDepartment]);

    const handlePlanChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedDepartment(event.target.value);
    };

    const businessPlanData = allBusinessPlans.find(plan => plan.name === selectedDepartment);
    
    const name = businessPlanData?.name || selectedDepartment || "経営計画";
    const headers = businessPlanData?.headers && businessPlanData.headers.length > 0 ? businessPlanData.headers : ['6月', '7月', '8月', '9月', '10月', '11月', '12月', '1月', '2月', '3月', '4月', '5月'];
    const items = businessPlanData?.items || [];

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-6 flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-semibold text-slate-800 dark:text-white">経営計画: {name}</h2>
                    <p className="mt-1 text-base text-slate-500 dark:text-slate-400">
                        月次および累計の業績を目標・実績・前年比で確認します。(単位: 百万円)
                    </p>
                </div>
                <div>
                    <select
                        value={selectedDepartment}
                        onChange={handlePlanChange}
                        className="w-full max-w-xs text-base bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500"
                    >
                        {departments.length > 0 ? (
                            departments.map((dept) => (
                                <option key={dept} value={dept}>{dept}</option>
                            ))
                        ) : (
                            <option>部門データなし</option>
                        )}
                    </select>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-slate-500 dark:text-slate-400 border-collapse">
                    <thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-700 dark:text-slate-300 sticky top-0 z-10">
                        <tr>
                            <th scope="col" className="px-2 py-3 border border-slate-200 dark:border-slate-700" rowSpan={2}>項目</th>
                            <th scope="col" className="px-2 py-3 border border-slate-200 dark:border-slate-700" rowSpan={2}>金額</th>
                            <th scope="col" className="px-2 py-3 border border-slate-200 dark:border-slate-700" rowSpan={2}>区分</th>
                            {headers.map(header => (
                                <th scope="col" className="px-2 py-3 border border-slate-200 dark:border-slate-700 text-center" colSpan={2} key={header}>{header}</th>
                            ))}
                        </tr>
                        <tr>
                            {headers.map(header => (
                                <React.Fragment key={`${header}-sub`}>
                                    <th scope="col" className="px-2 py-3 border border-slate-200 dark:border-slate-700 font-medium">当月</th>
                                    <th scope="col" className="px-2 py-3 border border-slate-200 dark:border-slate-700 font-medium">累計</th>
                                </React.Fragment>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {items.length === 0 ? (
                            <tr>
                                <td colSpan={27} className="text-center py-16">この部門のデータはまだありません。</td>
                            </tr>
                        ) : (
                        items.map((item, itemIndex) => (
                            <React.Fragment key={item.name}>
                                {item.data.map((row, rowIndex) => (
                                    <tr key={`${item.name}-${row.type}`} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                        {rowIndex === 0 && (
                                            <td className="px-2 py-2 font-semibold text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700" rowSpan={item.data.length}>
                                                {item.name}
                                            </td>
                                        )}
                                         {rowIndex === 0 && (
                                            <td className="px-2 py-2 font-semibold text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-right" rowSpan={item.data.length}>
                                                {formatNumber(item.totalValue)}
                                            </td>
                                        )}
                                        <td className="px-2 py-2 border border-slate-200 dark:border-slate-700">{row.type}</td>
                                        {row.monthly.map((val, i) => (
                                            <React.Fragment key={i}>
                                                <td className="px-2 py-2 border border-slate-200 dark:border-slate-700 text-right">
                                                    {item.name === 'G' ? <GValue value={val} /> : formatNumber(val)}
                                                </td>
                                                <td className="px-2 py-2 border border-slate-200 dark:border-slate-700 text-right bg-slate-50 dark:bg-slate-700/50">
                                                    {item.name === 'G' ? <GValue value={row.cumulative[i]} /> : formatNumber(row.cumulative[i])}
                                                </td>
                                            </React.Fragment>
                                        ))}
                                    </tr>
                                ))}
                            </React.Fragment>
                        )))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default BusinessPlanPage;