import React, { useState, useMemo, useEffect } from 'react';
import { allBusinessPlans } from '../../data/businessPlanData';
import { BusinessPlan, EmployeeUser } from '../../types';

const FACTUAL_NOTES = [
    {
        title: '全社',
        facts: [
            'PQ：6月 目標182.3に対し実績121.5、累計も目標2222.8に届かず',
            'M率：目標0.479に対し実績0.356と粗利率が大きく未達',
        ],
        actions: [
            '週次で粗利率0.48到達を確認（値上げ案件比率30%以上）し、低単価案件は足切りする',
            '短納期・高付加価値メニューの売上構成比を当月15%→25%に引き上げる',
        ],
    },
    {
        title: '営業部',
        facts: [
            'PQ：6月 目標90に対し実績68.4',
            'VQ：6月 目標36に対し実績32.5、MQ：目標54に対し実績35.9',
            'M率：目標0.6に対し実績0.525',
        ],
        actions: [
            '見積り最低粗利ライン0.50を下回る案件ゼロを維持（週次チェック）',
            '重点20案件の単価是正で粗利率を+3pt上乗せし、週次レビューで未達を即是正する',
        ],
    },
    {
        title: 'コミュニケーション営業部',
        facts: [
            'PQ：6月 目標60に対し実績38、VQ：目標54に対し実績33',
            'MQ：6月 目標6に対し実績1と粗利が極小',
        ],
        actions: [
            '既存顧客の再見積りで粗利率を0.05→0.10まで引き上げる（週次5件実施）',
            '高付加価値パッケージのアップセルを月5件獲得し、単価改定率30%以上を達成する',
        ],
    },
    {
        title: 'CSG',
        facts: [
            'PQ：6月 目標28.6に対し実績12、MQ：目標20.1に対し実績7.1',
            'M率：目標0.7に対し実績0.592',
        ],
        actions: [
            '高粗利商材比率を40%→55%へシフトし、低粗利新規受注を週次ゼロに抑える',
            '歩留まり悪化の案件を当日フィードバックし、粗利率を0.592→0.65まで戻す',
        ],
    },
    {
        title: '製造本部',
        facts: [
            '生産高(MQ)：6月 目標108.3に対し実績31.5と大きく不足',
            '数量(Q)：前年611に対し今期611→564など減少が顕著',
        ],
        actions: [
            '優先ラインを絞り稼働率を70%以上に回復、遊休ラインはシフト調整で残業抑制',
            '段取り・歩留まりロスを2pt削減し、外注・材料の発注を日次ゲートで厳格化する',
        ],
    },
    {
        title: '物流事業',
        facts: [
            'PQ：6月 目標16.4に対し実績7.1、MQ：目標8.5に対し実績4.4',
            '件数：目標25,000件に対し実績7,504件と大幅不足',
        ],
        actions: [
            '件数を月内で7,504件→15,000件まで積み上げ、単価を+10%改定する',
            'セット販売（保管＋発送＋加工）を月10件獲得し、リードタイム短縮の標準手順を全案件に適用する',
        ],
    },
];

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
            <div className="px-6 pb-4 space-y-4">
                <h3 className="text-base font-semibold text-slate-700 dark:text-slate-200">事実ベースの根拠とアクション</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {FACTUAL_NOTES.map(note => (
                        <div key={note.title} className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-slate-50/60 dark:bg-slate-900/40">
                            <div className="flex items-center justify-between">
                                <p className="text-base font-semibold text-slate-800 dark:text-white">{note.title}</p>
                                <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 dark:text-blue-200 dark:bg-blue-900/40 px-2 py-0.5 rounded-full">事実と対応</span>
                            </div>
                            <div className="mt-2">
                                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">根拠</p>
                                <ul className="mt-1 space-y-1 text-sm text-slate-700 dark:text-slate-200 list-disc list-inside">
                                    {note.facts.map((fact, idx) => (
                                        <li key={idx}>{fact}</li>
                                    ))}
                                </ul>
                            </div>
                            <div className="mt-3">
                                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">アクション</p>
                                <ul className="mt-1 space-y-1 text-sm text-slate-700 dark:text-slate-200 list-disc list-inside">
                                    {note.actions.map((action, idx) => (
                                        <li key={idx}>{action}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    ))}
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
