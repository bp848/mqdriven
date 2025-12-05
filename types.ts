export interface DraftJournalEntry {
  batchId: string;
  entryId: string;
  source: string;
  date: string;
  description: string;
  status: 'draft' | 'posted';
  lines: {
    lineId: string;
    accountId: string;
    accountCode: string;
    accountName: string;
    debit: number;
    credit: number;
  }[];
  debitAccount?: string;
  debitAmount?: number;
  creditAccount?: string;
  creditAmount?: number;
  confidence?: number;
}