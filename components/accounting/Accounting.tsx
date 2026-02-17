import React from 'react';
import JournalLedger from '../JournalLedger';
import GeneralLedger from './GeneralLedger';
import TrialBalancePage from './TrialBalancePage';
import InvoiceOCR from '../InvoiceOCR';
import PaymentManagement from './PaymentManagement';
import LaborCostManagement from './LaborCostManagement';
import PeriodClosingPage from './PeriodClosingPage';
import PlaceholderPage from '../PlaceholderPage';
import BillingManagement from './BillingManagement';

import { JournalEntry, InvoiceData, Page } from '../../types';

interface AccountingPageProps {
    page: Page;
    journalEntries: JournalEntry[];
    accountItems: any[];
    onAddEntry: (entry: Omit<JournalEntry, 'id'> | JournalEntry) => void | Promise<void>;
    addToast: (message: string, type: 'success' | 'error' | 'warning') => void;
    requestConfirmation: (dialog: any) => void;
    jobs: any[];
    applications: any[];
    onNavigate: (page: Page) => void;
    customers: any[];
    employees: any[];
    onRefreshData: () => void;
    allocationDivisions?: any[];
    isAIOff?: boolean;
}

const AccountingPage: React.FC<AccountingPageProps> = (props) => {
    const { page, journalEntries, accountItems, onAddEntry, addToast, requestConfirmation, jobs, applications, onNavigate, customers, employees, onRefreshData, allocationDivisions } = props;

    switch (page as Page) {
        case 'accounting_journal':
            return <JournalLedger entries={journalEntries} onAddEntry={onAddEntry} isAIOff={props.isAIOff} />;

        case 'sales_billing':
            return <BillingManagement jobs={jobs} onRefreshData={onRefreshData} onMarkPaid={() => { }} />;

        case 'purchasing_invoices':
            const handleSaveExpenses = (data: InvoiceData) => {
                // 税込/税抜を判定し、適切に仕訳を作成
                let expenseAmount: number;
                let consumptionTaxAmount: number;

                if (data.taxInclusive) {
                    // 税込請求書の場合: 税額を分離
                    // 税額が明示されていればそれを使用、なければ合計から逆算
                    if (data.taxAmount && data.taxAmount > 0) {
                        consumptionTaxAmount = data.taxAmount;
                        expenseAmount = data.totalAmount - consumptionTaxAmount;
                    } else if (data.subtotalAmount && data.subtotalAmount > 0) {
                        expenseAmount = data.subtotalAmount;
                        consumptionTaxAmount = data.totalAmount - expenseAmount;
                    } else {
                        // 税額も税抜額も不明な場合、10%として計算
                        expenseAmount = Math.round(data.totalAmount / 1.1);
                        consumptionTaxAmount = data.totalAmount - expenseAmount;
                    }
                } else {
                    // 税抜請求書の場合: そのまま使用
                    expenseAmount = data.totalAmount;
                    consumptionTaxAmount = data.taxAmount || Math.round(data.totalAmount * 0.1);
                }

                // 買掛金（負債）の計上 - 税込合計
                const creditEntry = {
                    account: '買掛金',
                    description: `仕入 ${data.vendorName} (${data.description})`,
                    credit: data.totalAmount,
                    debit: 0,
                };
                onAddEntry(creditEntry);

                // 経費（費用）の計上 - 税抜金額
                const debitEntry = {
                    account: data.account || '仕入高',
                    description: `仕入 ${data.vendorName}`,
                    debit: expenseAmount,
                    credit: 0
                };
                onAddEntry(debitEntry);

                // 仮払消費税の計上
                if (consumptionTaxAmount > 0) {
                    const taxEntry = {
                        account: '仮払消費税',
                        description: `仮払消費税 ${data.vendorName}`,
                        debit: consumptionTaxAmount,
                        credit: 0
                    };
                    onAddEntry(taxEntry);
                }

                addToast('買掛金と経費が計上されました。', 'success');
            };
            return <InvoiceOCR onSaveExpenses={handleSaveExpenses} addToast={addToast} requestConfirmation={requestConfirmation} isAIOff={props.isAIOff} />;

        case 'purchasing_payments':
            const handleExecutePayment = async (supplier: string, amount: number) => {
                const paymentEntry = {
                    account: '買掛金',
                    description: `支払実施: ${supplier}`,
                    debit: amount,
                    credit: 0,
                };
                const cashEntry = {
                    account: '普通預金',
                    description: `支払: ${supplier}`,
                    debit: 0,
                    credit: amount,
                };
                await onAddEntry(paymentEntry);
                await onAddEntry(cashEntry);
                addToast(`${supplier}への支払処理が完了し、仕訳が作成されました。`, 'success');
            };
            return <PaymentManagement journalEntries={journalEntries} onExecutePayment={handleExecutePayment} />;

        case 'hr_labor_cost':
            return <LaborCostManagement employees={employees || []} />;

        case 'accounting_general_ledger':
            return <GeneralLedger entries={journalEntries} accountItems={accountItems} />;

        case 'accounting_trial_balance':
            return <TrialBalancePage journalEntries={journalEntries} />;

        case 'accounting_period_closing':
            return <PeriodClosingPage addToast={addToast} jobs={jobs} applications={applications} journalEntries={journalEntries} onNavigate={onNavigate} />;

        default:
            return <PlaceholderPage title={page} />;
    }
};

export default AccountingPage;
