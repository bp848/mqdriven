
import React from 'react';
import ExpenseManagement from './ExpenseManagement';

interface ExpenseManagementPageProps {
  addToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  isAIOff: boolean;
}

const ExpenseManagementPage: React.FC<ExpenseManagementPageProps> = ({ addToast, isAIOff }) => {
    return (
        <ExpenseManagement addToast={addToast} isAIOff={isAIOff} />
    );
};

export default ExpenseManagementPage;
