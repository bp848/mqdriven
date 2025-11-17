import { GoogleGenAI, Type, GenerateContentResponse, Chat } from "@google/genai";
// FIX: Import MarketResearchReport type.
import {
  AISuggestions,
  Customer,
  CompanyAnalysis,
  InvoiceData,
  AIJournalSuggestion,
  User,
  ApplicationCode,
  Estimate,
  EstimateItem,
  Lead,
  ApprovalRoute,
  Job,
  LeadStatus,
  JournalEntry,
  LeadScore,
  Application,
  ApplicationWithDetails,
  CompanyInvestigation,
  CustomProposalContent,
  LeadProposalPackage,
  MarketResearchReport,
} from "../types";
import { formatJPY } from "../utils";

// AI機能をグローバルに制御する環境変数
const NEXT_PUBLIC_AI_OFF = process.env.NEXT_PUBLIC_AI_OFF === "1";

const API_KEY = process.env.API_KEY;

if (!API_KEY && !NEXT_PUBLIC_AI_OFF) {
  console.error("API_KEY environment variable not set. AI functions might be unavailable.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY! });

const model = "gemini-2.5-flash";

const checkOnlineAndAIOff = () => {
  if (NEXT_PUBLIC_AI_OFF) {
    throw new Error("AI機能は現在無効です。");
  }
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new Error("オフラインです。ネットワーク接続を確認してください。");
  }
};

async function withRetry<T>(
  fn: (signal?: AbortSignal) => Promise<T>,
  retries = 2,
  delay = 500
): Promise<T> {
  const controller = new AbortController();
  const signal = controller.signal;

  try {
    return await fn(signal);
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw error; // Propagate AbortError directly
    }
    if (retries > 0) {
      console.warn(`AI API call failed, retrying (${retries} retries left):`, error);
      await new Promise((res) => setTimeout(res, delay));
      controller.abort(); // Abort previous attempt
      return withRetry(fn, retries - 1, delay * 2); // Exponential backoff
    }
    throw error;
  }
}

const suggestJobSchema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description:
        "印刷案件の簡潔でプロフェッショナルなタイトル。例：「カフェオープン記念 A5チラシ」",
    },
    quantity: {
      type: Type.INTEGER,
      description: "この種の案件で一般的または推奨される数量。例：1000",
    },
    paperType: {
      type: Type.STRING,
      description: "提供されたリストから最も適した用紙を選択。",
    },
    finishing: {
      type: Type.STRING,
      description: "提供されたリストから推奨される加工オプションを選択。",
    },
    details: {
      type: Type.STRING,
      description: "色、両面/片面、目的など、仕様を含む案件要件の詳細な説明。",
    },
    price: {
      type: Type.INTEGER,
      description:
        "この案件の現実的な販売価格（P）。数量、用紙、加工を考慮して見積もってください。例：85000",
    },
    variableCost: {
      type: Type.INTEGER,
      description:
        "この案件の現実的な変動費（V）。主に用紙代やインク代など。一般的に価格の40-60%程度です。例：35000",
    },
  },
  required: ["title", "quantity", "paperType", "finishing", "details", "price", "variableCost"],
};

export const suggestJobParameters = async (
  prompt: string,
  paperTypes: string[],
  finishingOptions: string[]
): Promise<AISuggestions> => {
  checkOnlineAndAIOff();
  return withRetry(async () => {
    const fullPrompt = `以下の依頼内容に基づき、印刷案件のパラメータを提案してください。
依頼内容: "${prompt}"

選択可能な用紙リスト: ${paperTypes.join(", ")}
選択可能な加工リスト: ${finishingOptions.join(", ")}

上記リストに最適なものがない場合は、依頼内容に最も近い一般的なものを提案してください。`;
    const response = await ai.models.generateContent({
      model,
      contents: fullPrompt,
      config: { responseMimeType: "application/json", responseSchema: suggestJobSchema },
    });
    const jsonStr = response.text.trim();
    return JSON.parse(jsonStr);
  });
};

export const analyzeCompany = async (customer: Customer): Promise<CompanyAnalysis> => {
  checkOnlineAndAIOff();
  return withRetry(async () => {
    const prompt = `以下の企業情報に基づいて、詳細な企業分析レポートをJSON形式で作成してください。Web検索も活用し、最新の情報を反映させてください。

企業名: ${customer.customerName}
ウェブサイト: ${customer.websiteUrl || "情報なし"}
事業内容: ${customer.companyContent || "情報なし"}
既存の営業活動情報: ${customer.infoSalesActivity || "情報なし"}
要求事項: ${customer.infoRequirements || "情報なし"}

JSONのフォーマットは以下のようにしてください:
{
  "swot": "企業の強み、弱み、機会、脅威を分析したSWOT分析の結果。箇条書きで記述。",
  "painPointsAndNeeds": "企業が抱えているであろう課題や潜在的なニーズ。箇条書きで記述。",
  "suggestedActions": "これらの分析に基づき、当社が提案できる具体的なアクションや印刷案件。箇条書きで記述。",
  "proposalEmail": {
    "subject": "提案メールの件名",
    "body": "提案メールの本文。担当者名は[あなたの名前]としてください。"
  }
}
`;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    let jsonStr = response.text.trim();
    if (jsonStr.startsWith("```json")) {
      jsonStr = jsonStr.substring(7, jsonStr.length - 3).trim();
    }

    try {
      const result = JSON.parse(jsonStr);
      const rawChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const sources = rawChunks
        .map((chunk: any) => chunk.web)
        .filter(Boolean)
        .map((webChunk: any) => ({ uri: webChunk.uri, title: webChunk.title }));
      const uniqueSources = Array.from(new Map(sources.map((item) => [item.uri, item])).values());

      return { ...result, sources: uniqueSources };
    } catch (e) {
      console.error("Failed to parse JSON from Gemini:", e);
      // Fallback: return the text as part of the analysis.
      return {
        swot: "JSON解析エラー",
        painPointsAndNeeds: jsonStr,
        suggestedActions: "",
        proposalEmail: { subject: "エラー", body: "AIからの応答を解析できませんでした。" },
      };
    }
  });
};

export const investigateLeadCompany = async (
  companyName: string
): Promise<CompanyInvestigation> => {
  checkOnlineAndAIOff();
  const modelWithSearch = "gemini-2.5-flash";
  return withRetry(async () => {
    const prompt = `企業名「${companyName}」について、その事業内容、最近のニュース、市場での評判を調査し、簡潔にまとめてください。`;
    const response = await ai.models.generateContent({
      model: modelWithSearch,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const summary = response.text;
    const rawChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    // FIX: Use a more robust type guard to ensure `sources` is correctly typed.
    const sources: { uri: string; title: string }[] = (rawChunks || [])
      .map((chunk: any) => chunk.web)
      .filter(
        (web: any): web is { uri: string; title: string } =>
          Boolean(web && typeof web.uri === "string" && typeof web.title === "string")
      );

    const uniqueSources = Array.from(new Map(sources.map((item) => [item.uri, item])).values());

    return { summary, sources: uniqueSources };
  });
};

export const enrichCustomerData = async (
  customerName: string
): Promise<Partial<Customer>> => {
  checkOnlineAndAIOff();
  return withRetry(async () => {
    const prompt = `企業名「${customerName}」について、Web検索を用いて以下の情報を調査し、必ずJSON形式で返してください。見つからない情報はnullとしてください。
- 公式ウェブサイトURL (websiteUrl)
- 事業内容 (companyContent)
- 年商 (annualSales)
- 従業員数 (employeesCount)
- 本社の住所 (address1)
- 代表電話番号 (phoneNumber)
- 代表者名 (representative)`;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    let jsonStr = response.text.trim();
    if (jsonStr.startsWith("```json")) {
      jsonStr = jsonStr.substring(7, jsonStr.length - 3).trim();
    }

    const parsed = JSON.parse(jsonStr);

    const cleanedData: Partial<Customer> = {};
    for (const key in parsed) {
      if (parsed[key] !== null && parsed[key] !== undefined) {
        cleanedData[key as keyof Customer] = parsed[key];
      }
    }
    return cleanedData;
  });
};

const expenseLineSchema = {
  type: Type.OBJECT,
  properties: {
    description: { type: Type.STRING, description: "明細の品名や内容。" },
    lineDate: { type: Type.STRING, description: "明細対象日 (YYYY-MM-DD)。" },
    quantity: { type: Type.NUMBER, description: "数量。" },
    unit: { type: Type.STRING, description: "単位（式、枚など）。" },
    unitPrice: { type: Type.NUMBER, description: "単価（税抜）。" },
    amountExclTax: { type: Type.NUMBER, description: "金額（税抜）。" },
    taxRate: { type: Type.NUMBER, description: "税率 (例: 10)。" },
    customerName: { type: Type.STRING, description: "紐づく顧客名。" },
    projectName: { type: Type.STRING, description: "紐づく案件/プロジェクト名。" },
  },
};

const bankAccountSchema = {
  type: Type.OBJECT,
  properties: {
    bankName: { type: Type.STRING, description: "金融機関名。" },
    branchName: { type: Type.STRING, description: "支店名。" },
    accountType: { type: Type.STRING, description: "口座種別（普通/当座など）。" },
    accountNumber: { type: Type.STRING, description: "口座番号。" },
  },
};

const expenseDraftSchema = {
  type: Type.OBJECT,
  properties: {
    supplierName: { type: Type.STRING, description: "請求書ヘッダーの発行元。" },
    registrationNumber: { type: Type.STRING, description: "請求書の登録番号。" },
    invoiceDate: { type: Type.STRING, description: "請求日。" },
    dueDate: { type: Type.STRING, description: "支払期日。" },
    totalGross: { type: Type.NUMBER, description: "税込合計。" },
    totalNet: { type: Type.NUMBER, description: "税抜合計。" },
    taxAmount: { type: Type.NUMBER, description: "税額。" },
    paymentRecipientId: { type: Type.STRING, description: "社内マスタの支払先コードが明記されていれば入力。" },
    paymentRecipientName: { type: Type.STRING, description: "支払先名称。" },
    bankAccount: bankAccountSchema,
    lines: { type: Type.ARRAY, items: expenseLineSchema },
  },
};

const extractInvoiceSchema = {
  type: Type.OBJECT,
  properties: {
    vendorName: { type: Type.STRING, description: "請求書の発行元企業名。" },
    invoiceDate: {
      type: Type.STRING,
      description: "請求書の発行日 (YYYY-MM-DD形式)。",
    },
    dueDate: { type: Type.STRING, description: "支払期日。" },
    totalAmount: { type: Type.NUMBER, description: "請求書の合計金額（税込）。" },
    subtotalAmount: { type: Type.NUMBER, description: "税抜金額。" },
    taxAmount: { type: Type.NUMBER, description: "消費税額。" },
    description: { type: Type.STRING, description: "請求内容の簡潔な説明。" },
    costType: {
      type: Type.STRING,
      description: "この費用が変動費(V)か固定費(F)かを推測してください。",
      enum: ["V", "F"],
    },
    account: {
      type: Type.STRING,
      description:
        "この請求内容に最も適した会計勘定科目を提案してください。例: 仕入高, 広告宣伝費, 事務用品費",
    },
    relatedCustomer: {
      type: Type.STRING,
      description: "この費用に関連する顧客名（もしあれば）。",
    },
    project: {
      type: Type.STRING,
      description: "この費用に関連する案件名やプロジェクト名（もしあれば）。",
    },
    registrationNumber: { type: Type.STRING, description: "請求書に記載の登録番号。" },
    paymentRecipientName: { type: Type.STRING, description: "請求書に記載された支払先名。" },
    bankAccount: bankAccountSchema,
    lineItems: { type: Type.ARRAY, items: expenseLineSchema },
    expenseDraft: expenseDraftSchema,
  },
  required: [
    "vendorName",
    "invoiceDate",
    "totalAmount",
    "description",
    "costType",
    "account",
  ],
};

export const extractInvoiceDetails = async (
  imageBase64: string,
  mimeType: string
): Promise<InvoiceData> => {
  checkOnlineAndAIOff();
  return withRetry(async () => {
    const imagePart = { inlineData: { data: imageBase64, mimeType } };
    const textPart = {
      text:
        "この画像から請求書の詳細情報をJSONで抽出してください。経費精算フォームと同じ構造になるように、支払期日・登録番号・支払先銀行情報・明細行（品名/数量/単価）も含めてください。",
    };
    const response = await ai.models.generateContent({
      model,
      contents: { parts: [imagePart, textPart] },
      config: {
        responseMimeType: "application/json",
        responseSchema: extractInvoiceSchema,
      },
    });
    const jsonStr = response.text.trim();
    return JSON.parse(jsonStr);
  });
};

const suggestJournalEntrySchema = {
  type: Type.OBJECT,
  properties: {
    account: { type: Type.STRING, description: "この取引に最も適した勘定科目。" },
    description: {
      type: Type.STRING,
      description: "取引内容を簡潔に説明する摘要。",
    },
    debit: { type: Type.NUMBER, description: "借方の金額。貸方の場合は0。" },
    credit: { type: Type.NUMBER, description: "貸方の金額。借方の場合は0。" },
  },
  required: ["account", "description", "debit", "credit"],
};

export const suggestJournalEntry = async (
  prompt: string
): Promise<AIJournalSuggestion> => {
  checkOnlineAndAIOff();
  return withRetry(async () => {
    const fullPrompt = `以下の日常的な取引内容を会計仕訳に変換してください。「${prompt}」`;
    const response = await ai.models.generateContent({
      model,
      contents: fullPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: suggestJournalEntrySchema,
      },
    });
    const jsonStr = response.text.trim();
    return JSON.parse(jsonStr);
  });
};

export const generateSalesEmail = async (
  customer: Customer,
  senderName: string
): Promise<{ subject: string; body: string }> => {
  checkOnlineAndAIOff();
  return withRetry(async () => {
    const prompt = `顧客名「${customer.customerName}」向けの営業提案メールを作成してください。送信者は「${senderName}」です。`;
    const response = await ai.models.generateContent({ model, contents: prompt });
    const text = response.text;
    const subjectMatch = text.match(/件名:\s*(.*)/);
    const bodyMatch = text.match(/本文:\s*([\s\S]*)/);
    return {
      subject: subjectMatch ? subjectMatch[1].trim() : "ご提案の件",
      body: bodyMatch ? bodyMatch[1].trim() : text,
    };
  });
};

export const generateLeadReplyEmail = async (
  lead: Lead,
  senderName: string
): Promise<{ subject: string; body: string }> => {
  checkOnlineAndAIOff();
  return withRetry(async () => {
    const prompt = `以下のリード情報に対して、初回の返信メールを作成してください。
会社名: ${lead.company}
担当者名: ${lead.name}様
問い合わせ内容: ${lead.message || "記載なし"}
送信者: ${senderName}`;
    const response = await ai.models.generateContent({ model, contents: prompt });
    const text = response.text;
    const subjectMatch = text.match(/件名:\s*(.*)/);
    const bodyMatch = text.match(/本文:\s*([\s\S]*)/);
    return {
      subject: subjectMatch ? subjectMatch[1].trim() : "お問い合わせありがとうございます",
      body: bodyMatch ? bodyMatch[1].trim() : text,
    };
  });
};

// FIX: Add missing 'analyzeLeadData' function.
export const analyzeLeadData = async (leads: Lead[]): Promise<string> => {
  checkOnlineAndAIOff();
  return withRetry(async () => {
    const prompt = `以下のリードデータ（${leads.length}件）を分析し、営業活動に関する簡潔なインサイトや提案を1つ生成してください。
        特に、有望なリードの傾向や、アプローチすべきセグメントなどを指摘してください。
        
        データサンプル:
        ${JSON.stringify(
          leads
            .slice(0, 3)
            .map((l) => ({
              company: l.company,
              status: l.status,
              inquiryType: l.inquiryType,
              message: l.message,
            })),
          null,
          2
        )}
        `;
    const response = await ai.models.generateContent({ model, contents: prompt });
    return response.text;
  });
};

export const getDashboardSuggestion = async (jobs: Job[]): Promise<string> => {
  checkOnlineAndAIOff();
  return withRetry(async () => {
    const recentJobs = jobs.slice(0, 5).map((j) => ({
      title: j.title,
      price: j.price,
      variableCost: j.variableCost,
      margin: j.price - j.variableCost,
      marginRate: j.price > 0 ? ((j.price - j.variableCost) / j.price) * 100 : 0,
    }));

    const prompt = `あなたは印刷会社の経営コンサルタントです。以下の最近の案件データ（${recentJobs.length}件）を分析し、経営改善のための具体的で簡潔な提案を1つしてください。多角的な視点（収益性、効率性、戦略的価値）から分析し、 actionable な提案を生成してください。

データサンプル:
${JSON.stringify(recentJobs, null, 2)}
`;
    const response = await ai.models.generateContent({ model, contents: prompt });
    return response.text;
  });
};

export const generateDailyReportSummary = async (
  customerName: string,
  activityContent: string
): Promise<string> => {
  checkOnlineAndAIOff();
  return withRetry(async () => {
    const prompt = `以下のキーワードを元に、営業日報の活動内容をビジネス文書としてまとめてください。
訪問先: ${customerName}
キーワード: ${activityContent}`;
    const response = await ai.models.generateContent({ model, contents: prompt });
    return response.text;
  });
};

export const generateWeeklyReportSummary = async (keywords: string): Promise<string> => {
  checkOnlineAndAIOff();
  return withRetry(async () => {
    const prompt = `以下のキーワードを元に、週報の報告内容をビジネス文書としてまとめてください。
キーワード: ${keywords}`;
    const response = await ai.models.generateContent({ model, contents: prompt });
    return response.text;
  });
};

const draftEstimateSchema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description:
        "見積の件名。顧客の依頼内容を反映し、具体的で分かりやすいものにする。例：「2025年度 会社案内パンフレット制作」",
    },
    items: {
      type: Type.ARRAY,
      description: "見積の明細項目。印刷会社の標準的な項目で構成する。",
      items: {
        type: Type.OBJECT,
        properties: {
          division: {
            type: Type.STRING,
            description: "項目区分",
            enum: [
              "用紙代",
              "デザイン・DTP代",
              "刷版代",
              "印刷代",
              "加工代",
              "その他",
              "初期費用",
              "月額費用",
            ],
          },
          content: {
            type: Type.STRING,
            description:
              "具体的な作業内容や品名。用紙の種類や厚さ、加工の種類などを記載。",
          },
          quantity: {
            type: Type.NUMBER,
            description: "数量。単位と対応させる。",
          },
          unit: {
            type: Type.STRING,
            description: "単位（例：部, 枚, 式, 連, 月）",
          },
          unitPrice: { type: Type.NUMBER, description: "単価" },
          price: { type: Type.NUMBER, description: "金額 (数量 * 単価)" },
          cost: { type: Type.NUMBER, description: "この項目にかかる原価" },
        },
        required: ["division", "content", "quantity", "unit", "unitPrice", "price", "cost"],
      },
    },
    deliveryDate: {
      type: Type.STRING,
      description: "希望納期 (YYYY-MM-DD形式)",
    },
    paymentTerms: {
      type: Type.STRING,
      description: "支払条件。例：「月末締め翌月末払い」",
    },
    deliveryMethod: {
      type: Type.STRING,
      description: "納品方法。例：「指定倉庫へ一括納品」",
    },
    notes: {
      type: Type.STRING,
      description: "補足事項や備考。見積の有効期限なども記載する。",
    },
  },
  required: ["title", "items", "deliveryDate", "paymentTerms"],
};

export const draftEstimate = async (prompt: string): Promise<Partial<Estimate>> => {
  checkOnlineAndAIOff();
  return withRetry(async () => {
    const fullPrompt = `あなたは日本の印刷会社で20年以上の経験を持つベテランの見積担当者です。以下の顧客からの要望に基づき、現実的で詳細な見積の下書きをJSON形式で作成してください。原価計算も行い、適切な利益を乗せた単価と金額を設定してください。

【重要】もし顧客の要望が倉庫管理、定期発送、サブスクリプション型のサービスを示唆している場合、必ず「初期費用」と「月額費用」の項目を立てて見積を作成してください。その際の単位は、初期費用なら「式」、月額費用なら「月」としてください。

顧客の要望: "${prompt}"`;
    const response = await ai.models.generateContent({
      model,
      contents: fullPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: draftEstimateSchema as any,
      },
    });
    const jsonStr = response.text.trim();
    const parsed = JSON.parse(jsonStr);
    // Ensure items array exists
    if (!parsed.items) {
      parsed.items = [];
    }
    return parsed;
  });
};

export const generateProposalSection = async (
  sectionTitle: string,
  customer: Customer,
  job?: Job | null,
  estimate?: Estimate | null
): Promise<string> => {
  checkOnlineAndAIOff();
  return withRetry(async () => {
    let context = `
顧客情報:
- 顧客名: ${customer.customerName}
- 事業内容: ${customer.companyContent || "N/A"}
- 既知の要求事項: ${customer.infoRequirements || "N/A"}
- これまでの営業活動: ${customer.infoSalesActivity || "N/A"}
- Webサイト: ${customer.websiteUrl || "N/A"}
`;

    if (job) {
      context += `
関連案件情報:
- 案件名: ${job.title}
- 案件詳細: ${job.details}
- 金額: ${formatJPY(job.price)}
`;
    }

    if (estimate) {
      context += `
関連見積情報:
- 見積件名: ${estimate.title}
- 見積合計: ${formatJPY(estimate.total)}
- 見積項目: ${estimate.items
          .map((i) => `${i.content} (${formatJPY(i.price)})`)
          .join(", ")}
`;
    }

    const prompt = `
あなたはプロのビジネスコンサルタントです。以下のコンテキスト情報と、必要に応じてWeb検索の結果を活用して、提案書の「${sectionTitle}」セクションの文章を作成してください。プロフェッショナルで、説得力があり、顧客の利益に焦点を当てた文章を生成してください。

${context}

「${sectionTitle}」セクションの下書きを生成してください。
`;
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });
    return response.text;
  });
};

const scoreLeadSchema = {
  type: Type.OBJECT,
  properties: {
    score: {
      type: Type.INTEGER,
      description: "このリードの有望度を0から100のスコアで評価してください。",
    },
    rationale: {
      type: Type.STRING,
      description: "スコアの根拠を簡潔に説明してください。",
    },
  },
  required: ["score", "rationale"],
};

export const scoreLead = async (lead: Lead): Promise<LeadScore> => {
  checkOnlineAndAIOff();
  return withRetry(async () => {
    const prompt = `以下のリード情報を分析し、有望度をスコアリングしてください。
会社名: ${lead.company}
問い合わせ種別: ${lead.inquiryTypes?.join(", ") || lead.inquiryType}
メッセージ: ${lead.message}`;
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: scoreLeadSchema,
      },
    });
    const jsonStr = response.text.trim();
    return JSON.parse(jsonStr);
  });
};

export const startBugReportChat = (): Chat => {
  checkOnlineAndAIOff(); // Will throw if AI is off or offline
  const systemInstruction = `あなたはバグ報告と改善要望を受け付けるアシスタントです。ユーザーからの報告内容をヒアリングし、以下のJSON形式で最終的に出力してください。
    { "report_type": "bug" | "improvement", "summary": "簡潔な件名", "description": "詳細な内容" }
    このJSONを出力するまでは、自然な会話でユーザーから情報を引き出してください。`;
  return ai.chats.create({ model, config: { systemInstruction } });
};

export const processApplicationChat = async (
  history: { role: "user" | "model"; content: string }[],
  appCodes: ApplicationCode[],
  users: User[],
  routes: ApprovalRoute[]
): Promise<string> => {
  checkOnlineAndAIOff();
  return withRetry(async () => {
    const prompt = `あなたは申請アシスタントです。ユーザーとの会話履歴と以下のマスター情報に基づき、ユーザーの申請を手伝ってください。
最終的に、ユーザーの申請内容を以下のJSON形式で出力してください。それまでは自然な会話を続けてください。
{ "applicationCodeId": "...", "formData": { ... }, "approvalRouteId": "..." }

会話履歴: ${JSON.stringify(history)}
申請種別マスター: ${JSON.stringify(appCodes)}
承認ルートマスター: ${JSON.stringify(routes)}
`;
    const response = await ai.models.generateContent({ model, contents: prompt });
    return response.text;
  });
};

// --- From older chat models ---
export const generateClosingSummary = async (
  type: "月次" | "年次",
  currentJobs: Job[],
  prevJobs: Job[],
  currentJournal: JournalEntry[],
  prevJournal: JournalEntry[]
): Promise<string> => {
  checkOnlineAndAIOff();
  return withRetry(async () => {
    const prompt = `以下のデータに基づき、${type}決算のサマリーを生成してください。前月比や課題、改善提案を含めてください。`;
    // In a real scenario, you'd pass the data, but for brevity we'll just send the prompt.
    const response = await ai.models.generateContent({ model, contents: prompt });
    return response.text;
  });
};

export const startBusinessConsultantChat = (): Chat => {
  checkOnlineAndAIOff(); // Will throw if AI is off or offline
  const systemInstruction = `あなたは、中小企業の印刷会社を専門とする経験豊富な経営コンサルタントです。あなたの目的は、経営者がデータに基づいたより良い意思決定を行えるよう支援することです。提供されたデータコンテキストとユーザーからの質問に基づき、Web検索も活用して、具体的で実行可能なアドバイスを提供してください。専門的かつデータに基づいた、簡潔な回答を心がけてください。`;
  return ai.chats.create({
    model,
    config: {
      systemInstruction,
      tools: [{ googleSearch: {} }],
    },
  });
};

export const generateLeadAnalysisAndProposal = async (
  lead: Lead
): Promise<{ analysisReport: string; draftProposal: string }> => {
  checkOnlineAndAIOff();
  return withRetry(async () => {
    const prompt = `以下のリード情報とWeb検索の結果を組み合わせて、企業分析レポートと提案書のドラフトを生成し、指定されたJSON形式で出力してください。

リード情報:
- 会社名: ${lead.company}
- 担当者名: ${lead.name}
- 問い合わせ内容: ${lead.message || "具体的な内容は記載されていません。"}

Web検索を活用して、企業の事業内容、最近の動向、および問い合わせ内容に関連する業界の課題を調査してください。
その上で、当社の印刷・物流サービスがどのように役立つかを具体的に提案してください。

出力JSONフォーマット:
{
  "analysisReport": "リードの会社、問い合わせ内容、Webサイト(あれば)を基にした簡潔な分析レポート。企業の潜在的なニーズや、当社が提供できる価値についてMarkdown形式で記述してください。",
  "draftProposal": "分析レポートに基づいた提案書のドラフト。Markdown形式で記述し、「1. 背景と課題」「2. 提案内容」「3. 期待される効果」「4. 概算費用」のセクションを含めてください。「4. 概算費用」: 概算費用を具体的に提示してください。もし書籍の保管や発送代行のような継続的なサービスが含まれる場合、必ず「初期費用」と「月額費用」に分けて、保管料、発送手数料などの具体的な項目と金額を提示してください。"
}
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    let jsonStr = response.text.trim();
    if (jsonStr.startsWith("```json")) {
      jsonStr = jsonStr.substring(7, jsonStr.length - 3).trim();
    }

    try {
      return JSON.parse(jsonStr);
    } catch (e) {
      console.error("Failed to parse JSON from Gemini for lead analysis:", e);
      console.error("Received text:", jsonStr);
      // Fallback: return the text as part of the analysis if JSON parsing fails.
      return {
        analysisReport:
          "AIからの応答を解析できませんでした。以下に生の応答を示します。\n\n" + jsonStr,
        draftProposal: "AIからの応答を解析できませんでした。",
      };
    }
  });
};

export const generateMarketResearchReport = async (
  topic: string
): Promise<MarketResearchReport> => {
  checkOnlineAndAIOff();
  return withRetry(async () => {
    const prompt = `以下のトピックについて、Web検索を活用して詳細な市場調査レポートを、必ず指定されたJSON形式で作成してください。

調査トピック: "${topic}"

レポートには、市場の概要、主要トレンド、競合分析、ビジネスチャンス、脅威/リスクを含めてください。
JSONフォーマット:
{
    "title": "調査トピックを反映した、レポート全体のタイトル。",
    "summary": "調査結果全体の簡潔なエグゼクティブサマリー。",
    "trends": ["市場の主要なトレンド。箇条書きで複数挙げる。"],
    "competitorAnalysis": "主要な競合他社の動向や戦略に関する分析。",
    "opportunities": ["調査結果から導き出されるビジネスチャンスや機会。箇条書きで複数挙げる。"],
    "threats": ["市場に潜む脅威やリスク。箇条書きで複数挙げる。"]
}`;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        thinkingConfig: { thinkingBudget: 32768 },
      },
    });

    let jsonStr = response.text.trim();
    if (jsonStr.startsWith("```json")) {
      jsonStr = jsonStr.substring(7, jsonStr.length - 3).trim();
    }
    const result = JSON.parse(jsonStr);

    const rawChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources = rawChunks
      .map((chunk: any) => chunk.web)
      .filter(Boolean)
      .map((webChunk: any) => ({ uri: webChunk.uri, title: webChunk.title }));
    const uniqueSources = Array.from(new Map(sources.map((item) => [item.uri, item])).values());

    return { ...result, sources: uniqueSources };
  });
};

export const generateCustomProposalContent = async (
  lead: Lead
): Promise<CustomProposalContent> => {
  checkOnlineAndAIOff();
  return withRetry(async () => {
    const prompt = `あなたは「文唱堂印刷株式会社」の優秀なセールスコンサルタントです。以下のリード情報を基に、Webリサーチを徹底的に行い、その企業のためだけの本格的な提案資料のコンテンツを、必ず指定されたJSON形式で生成してください。

## リード情報
- 企業名: ${lead.company}
- Webサイト: ${lead.landingPageUrl || "不明"}
- 問い合わせ内容: ${lead.message || "具体的な内容は記載されていません。"}

## 指示
1.  **ディープリサーチ**: Google検索を駆使して、上記企業の事業内容、最近のニュース、業界での立ち位置、IR情報などを調査し、深く理解してください。
2.  **コンテンツ生成**: リサーチ結果と問い合わせ内容を統合し、以下の各セクションの文章を生成してください。文章はプロフェッショナルかつ説得力のあるものにしてください。
3.  **JSON出力**: 必ず以下のJSONフォーマットに従って出力してください。
{
    "coverTitle": "提案書の表紙のタイトル。例:「株式会社〇〇様向け 物流効率化のご提案」",
    "businessUnderstanding": "Webリサーチに基づいた、提案先企業の事業内容の理解。客観的な事実を簡潔にまとめる。",
    "challenges": "リサーチ結果と問い合わせ内容から推測される、提案先企業が抱える課題やニーズの仮説。箇条書きで記述。",
    "proposal": "上記の課題を解決するための、自社（文唱堂印刷）の具体的なサービス提案。提供する価値やメリットを明確にする。",
    "conclusion": "提案の締めくくりと、次のアクションを促す力強い結びの言葉。"
}`;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        thinkingConfig: { thinkingBudget: 32768 },
      },
    });

    let jsonStr = response.text.trim();
    if (jsonStr.startsWith("```json")) {
      jsonStr = jsonStr.substring(7, jsonStr.length - 3).trim();
    }
    try {
      return JSON.parse(jsonStr);
    } catch (e) {
      console.error("Failed to parse JSON from Gemini for custom proposal:", e);
      console.error("Received text:", jsonStr);
      throw new Error("AIからの提案書コンテンツの生成に失敗しました。");
    }
  });
};

export const createLeadProposalPackage = async (
  lead: Lead
): Promise<LeadProposalPackage> => {
  checkOnlineAndAIOff();
  return withRetry(async () => {
    const prompt = `あなたは「文唱堂印刷株式会社」の非常に優秀なセールスコンサルタントです。以下のリード情報を分析し、次のタスクを実行してください。

## リード情報
- 企業名: ${lead.company}
- Webサイト: ${lead.landingPageUrl || "不明"}
- 問い合わせ内容: ${lead.message || "具体的な内容は記載されていません。"}

## タスク
1.  **リードの分類**: この問い合わせが、当社のサービスに対する**本物の関心**にもとづくものか、あるいは単なる**営業メール（売り込み）**かを判断してください。
2.  **本物のリードの場合**:
    a. **ディープリサーチ**: Google検索を駆使して、上記企業の事業内容、最近のニュース、業界での立ち位置などを調査し、深く理解してください。
    b. **提案書コンテンツ生成**: リサーチ結果と問い合わせ内容を統合し、プロフェッショナルで説得力のある提案書コンテンツを生成してください。
    c. **見積案作成**: 提案内容に基づき、現実的で詳細な見積の明細項目を作成してください。もし顧客の要望が倉庫管理、定期発送、サブスクリプション型のサービスを示唆している場合、必ず「初期費用」と「月額費用」の項目を立てて見積を作成してください。
3.  **営業メールの場合**:
    a. なぜそのように判断したか、簡潔な理由を述べてください。proposal と estimate フィールドは省略してください。

## JSON出力
必ず指定されたJSONフォーマットに従って、結果を単一のJSONオブジェクトとして出力してください。
フォーマット:
{
    "isSalesLead": "boolean",
    "reason": "string, isSalesLeadがfalseの場合のみ",
    "proposal": {
        "coverTitle": "string",
        "businessUnderstanding": "string",
        "challenges": "string",
        "proposal": "string",
        "conclusion": "string"
    },
    "estimate": [
        {
            "division": "string, enum: ['用紙代', 'デザイン・DTP代', '刷版代', '印刷代', '加工代', 'その他', '初期費用', '月額費用']",
            "content": "string",
            "quantity": "number",
            "unit": "string",
            "unitPrice": "number",
            "price": "number",
            "cost": "number"
        }
    ]
}`;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        thinkingConfig: { thinkingBudget: 32768 },
      },
    });

    let jsonStr = response.text.trim();
    if (jsonStr.startsWith("```json")) {
      jsonStr = jsonStr.substring(7, jsonStr.length - 3).trim();
    }
    try {
      return JSON.parse(jsonStr);
    } catch (e) {
      console.error("Failed to parse JSON from Gemini for lead proposal package:", e);
      console.error("Received text:", jsonStr);
      throw new Error("AIからの提案パッケージの生成に失敗しました。");
    }
  });
};
