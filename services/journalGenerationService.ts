// Journal Generation Service
// Rule-based journal entry line generation from applications

export interface JournalLineGenerationResult {
    journalEntryId: string;
    lines: Array<{
        lineId: string;
        accountId: string;
        accountName: string;
        debitAmount: number;
        creditAmount: number;
        lineType: 'debit' | 'credit';
        mqType: 'P' | 'Q' | 'V' | 'F';
        mqConfidence: number;
    }>;
}

export const generateJournalLinesFromApplication = async (
    applicationId: string,
    userId: string
): Promise<JournalLineGenerationResult> => {
    const supabase = getSupabase();
    
    const { data, error } = await supabase.rpc('generate_journal_lines_from_application', {
        p_application_id: applicationId,
        p_user_id: userId
    });

    if (error) {
        console.error('Failed to generate journal lines:', error);
        throw new Error('仕訳行の生成に失敗しました');
    }

    // Group by journal_entry_id
    const linesByJournal = new Map<string, any[]>();
    (data || []).forEach((row: any) => {
        if (!linesByJournal.has(row.journal_entry_id)) {
            linesByJournal.set(row.journal_entry_id, []);
        }
        linesByJournal.get(row.journal_entry_id)!.push(row);
    });

    // Return the first journal entry with its lines
    const [journalEntryId, lines] = Array.from(linesByJournal.entries())[0] || [null, []];
    
    if (!journalEntryId || lines.length === 0) {
        throw new Error('仕訳行が生成されませんでした');
    }

    return {
        journalEntryId,
        lines: lines.map(line => ({
            lineId: line.line_id,
            accountId: line.account_id,
            accountName: line.account_name,
            debitAmount: parseFloat(line.debit_amount),
            creditAmount: parseFloat(line.credit_amount),
            lineType: line.line_type,
            mqType: line.mq_type,
            mqConfidence: parseFloat(line.mq_confidence)
        }))
    };
};

// Helper function to get Supabase client
const getSupabase = () => {
    // Import dynamically to avoid circular dependencies
    const { getSupabase } = require('../lib/supabaseClient');
    return getSupabase();
};
