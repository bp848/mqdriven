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

    switch(page as Page) {
        case 'accounting_journal':
            return <JournalLedger entries={journalEntries} onAddEntry={onAddEntry} isAIOff={props.isAIOff} />;

        case 'sales_billing':
            return <BillingManagement jobs={jobs} onRefreshData={onRefreshData} onMarkPaid={() => {}} />;

        case 'purchasing_invoices':
            const handleSaveExpenses = (data: InvoiceData) => {
                const creditEntry = {
                    account: '買掛金',
                    description: `仕入 ${data.vendorName} (${data.description})`,
                    credit: data.totalAmount,
                    debit: 0,
                };
                onAddEntry(creditEntry);
                
                const debitEntry = {
                    account: data.account || '仕入高',
                    description: `仕入 ${data.vendorName}`,
                    debit: data.totalAmount,
                    credit: 0
                }
                onAddEntry(debitEntry);
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
