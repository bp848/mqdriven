
import React, { useState } from 'react';
import { CreditCard, Truck, AlertCircle, CheckCircle2, FileText, Download, Calendar, ArrowRight, Zap, Filter, ListFilter } from 'lucide-react';

interface PayablesProps {
  notify?: (message: string, type: 'success' | 'info') => void;
}

// Data Type
interface PayableItem {
    id: string;
    supplier: string;
    category: string;
    amount: number;
    date: string;
    due: string;
    status: 'pending' | 'approved' | 'scheduled';
    method: string;
    invoiceImg: string;
}

export const Payables: React.FC<PayablesProps> = ({ notify }) => {
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState<'pending' | 'approved' | 'all'>('pending');
  
  // Local state to manage status changes for the demo
  const [payables, setPayables] = useState<Pay