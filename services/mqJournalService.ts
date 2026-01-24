// AI Journal Generation Service with MQ Context
// This generates draft journal entries with MQ accounting context

export interface MQJournalInput {
  application: {
    id: string;
    type: 'EXP' | 'APL' | 'LEV' | 'OTR';
    amount: number;
    description: string;
    applicant: {
      name: string;
      department: string;
    };
  };
  related: {
    projectId?: string;
    hasInventory: boolean;
    hasManHours: boolean;
    hasOrders: boolean;
  };
  historical: Array<{
    account: string;
    mqType: 'P' | 'Q' | 'V' | 'F';
    count: number;
    confidence: number;
  }>;
}

export interface MQJournalOutput {
  journalEntry: {
    date: string;
    summary: string;
    confidence: number;
  };
  lines: Array<{
    side: 'debit' | 'credit';
    account: string;
    amount: number;
    reason: string;
    confidence: number;
    mqType: 'P' | 'Q' | 'V' | 'F';
    mqSource: string;
    mqConfidence: number;
  }>;
  tax: {
    type: string;
    rate: number;
    reason: string;
  };
  mqAnalysis: {
    primaryType: 'P' | 'Q' | 'V' | 'F';
    reasoning: string;
    projectImpact: boolean;
  };
}

export const generateMQDraftJournal = async (input: MQJournalInput): Promise<MQJournalOutput> => {
  // System prompt for MQ accounting
  const systemPrompt = `あなたは日本の中小企業会計とMQ会計ドリブン思想に精通した会計補助AIです。
あなたの役割は「人間の会計担当が判断できる仕訳の下書きを作ること」です。

重要な制約：
- 決定はしません。仮説を提示します
- MQ（P=価格/Q=数量/V=変動費/F=固定費）の分類を必ず行います
- なぜそのMQ分類になったか理由を説明します
- 確信度を数値で示します（0.0-1.0）
- 不確実な場合は不確実と明示します`;

  // User prompt with MQ context
  const userPrompt = `以下は承認済みの申請データです。
MQ会計ドリブンの思想に基づき、仕訳の下書きを作成してください。

申請情報：
- 種別: ${input.application.type}
- 金額: ¥${input.application.amount.toLocaleString()}
- 内容: ${input.application.description}
- 申請者: ${input.application.applicant.name}（${input.application.applicant.department}）

関連情報：
- プロジェクト関連: ${input.related.projectId ? 'あり' : 'なし'}
- 在庫関連: ${input.related.hasInventory ? 'あり' : 'なし'}
- 工数関連: ${input.related.hasManHours ? 'あり' : 'なし'}
- 受注関連: ${input.related.hasOrders ? 'あり' : 'なし'}

過去の類似事例：
${input.historical.map(h => `- ${h.account}（${h.mqType}型）: ${h.count}件、確信度${h.confidence}`).join('\n')}

出力形式：
{
  "journalEntry": {
    "date": "YYYY-MM-DD",
    "summary": "摘要",
    "confidence": 0.xx
  },
  "lines": [
    {
      "side": "debit",
      "account": "勘定科目",
      "amount": 数値,
      "reason": "理由",
      "confidence": 0.xx,
      "mqType": "P|Q|V|F",
      "mqSource": "ソース",
      "mqConfidence": 0.xx
    }
  ],
  "tax": {
    "type": "課税|非課税|不課税",
    "rate": 0.10,
    "reason": "理由"
  },
  "mqAnalysis": {
    "primaryType": "P|Q|V|F",
    "reasoning": "MQ分析の理由",
    "projectImpact": true|false
  }
}`;

  // Call AI (implementation depends on chosen AI service)
  // This would call Gemini/OpenAI/etc.
  const aiResponse = await callAIService(systemPrompt, userPrompt);
  
  return parseAIResponse(aiResponse);
};

// Fallback stubs to keep typecheck green (replace with real AI integration).
const callAIService = async (_systemPrompt: string, _userPrompt: string): Promise<string> => {
  return '';
};

const parseAIResponse = (_response: string): MQJournalOutput => {
  return {
    journalEntry: {
      date: new Date().toISOString().slice(0, 10),
      summary: '',
      confidence: 0,
    },
    lines: [],
    tax: {
      type: '非課税',
      rate: 0,
      reason: '',
    },
    mqAnalysis: {
      primaryType: 'F',
      reasoning: '',
      projectImpact: false,
    },
  };
};

// Helper function to determine MQ type based on application context
export const determineMQType = (input: MQJournalInput): 'P' | 'Q' | 'V' | 'F' => {
  const { type, amount } = input.application;
  const { hasInventory, hasManHours, hasOrders } = input.related;
  
  // Price-related
  if (type === 'APL' && hasOrders) return 'P';
  
  // Quantity-related  
  if (hasInventory) return 'Q';
  
  // Variable costs
  if (type === 'EXP' && !hasManHours) return 'V';
  
  // Fixed costs (default for expenses)
  return 'F';
};

// Helper function to save MQ journal draft
export const saveMQJournalDraft = async (output: MQJournalOutput, applicationId: string, userId: string) => {
  const journalData = {
    date: output.journalEntry.date,
    description: output.journalEntry.summary,
    status: 'draft',
    mq_type: output.mqAnalysis.primaryType,
    project_id: null,
    mq_source: 'ai_generated',
    mq_confidence: output.journalEntry.confidence,
    created_by: userId
  };

  // Save journal entry and lines with MQ context
  // Implementation would save to journal_entries and journal_entry_lines
};
