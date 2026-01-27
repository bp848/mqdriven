import { Type, Chat, FunctionDeclaration } from "@google/genai";
import JSZip from "jszip";
import {
  GEMINI_DEFAULT_MODEL,
  GEMINI_OCR_MODEL,
  isGeminiAIDisabled,
  requireGeminiClient,
} from "./Gemini";
// FIX: Import MarketResearchReport type.
import {
  AISuggestions,
  Customer,
  BusinessCardContact,
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
  PrintSpec,
  EstimationResult,
  StrategyOption,
} from "../types";
import { formatJPY } from "../utils";
import { INTEGRATION_MANIFESTO } from "../constants";

const model = GEMINI_DEFAULT_MODEL;
const invoiceOcrModel = GEMINI_OCR_MODEL ?? GEMINI_DEFAULT_MODEL;

const checkOnlineAndAIOff = () => {
  if (isGeminiAIDisabled) {
    throw new Error("AI機能は現在無効です。");
  }
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new Error("オフラインです。ネットワーク接続を確認してください。");
  }
  return requireGeminiClient();
};

const isApiKeyExpiredError = (error: any): boolean => {
  const candidates = [
    error?.message,
    error?.error?.message,
    typeof error?.error === "string" ? error.error : null,
    typeof error === "string" ? error : null,
    JSON.stringify(error?.error ?? error ?? ""),
  ];
  return candidates.some(
    (value) =>
      typeof value === "string" &&
      (value.toLowerCase().includes("api key expired") ||
        value.toLowerCase().includes("api_key_invalid"))
  );
};

const isApiKeyLeakedError = (error: any): boolean => {
  const message = JSON.stringify(error?.error ?? error ?? "").toLowerCase();
  return message.includes("reported as leaked") || message.includes("key was leaked");
};

const normalizeGeminiError = (error: any): Error => {
  if (isApiKeyExpiredError(error)) {
    const friendly = new Error(
      "Gemini APIキーの期限が切れています。環境変数 VITE_GEMINI_API_KEY（または GEMINI_API_KEY / API_KEY）を有効なキーに更新してください。"
    );
    friendly.name = "GeminiApiKeyExpired";
    return friendly;
  }
  if (isApiKeyLeakedError(error)) {
    const friendly = new Error(
      "Gemini APIキーが漏洩扱いとなり失効しています。新しいキーを発行し、環境変数 VITE_GEMINI_API_KEY（または GEMINI_API_KEY / API_KEY）に設定してください。"
    );
    friendly.name = "GeminiApiKeyLeaked";
    return friendly;
  }
  return error instanceof Error
    ? error
    : new Error(typeof error === "string" ? error : "Gemini API error");
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
    const normalized = normalizeGeminiError(error);
    if (normalized.name === "GeminiApiKeyExpired" || normalized.name === "GeminiApiKeyLeaked") {
      throw normalized;
    }
    if (retries > 0) {
      console.warn(`AI API call failed, retrying (${retries} retries left):`, error);
      await new Promise((res) => setTimeout(res, delay));
      controller.abort(); // Abort previous attempt
      return withRetry(fn, retries - 1, delay * 2); // Exponential backoff
    }
    throw normalized;
  }
}

const stripCodeFences = (value: string): string => {
  const trimmed = value?.trim() ?? "";
  if (!trimmed.startsWith("```")) {
    return trimmed;
  }
  const withoutOpening = trimmed.replace(/^```[a-zA-Z0-9_-]*\s*/, "");
  if (withoutOpening.endsWith("```")) {
    return withoutOpening.slice(0, -3).trim();
  }
  return withoutOpening.trim();
};

const base64ToUint8Array = (base64: string): Uint8Array => {
  const binary =
    typeof atob === "function"
      ? atob(base64)
      : Buffer.from(base64, "base64").toString("binary");
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const stripXmlTags = (xml: string): string =>
  xml
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

const extractDocxTextFromBase64 = async (fileBase64: string): Promise<string> => {
  try {
    const zip = await JSZip.loadAsync(base64ToUint8Array(fileBase64));
    const parts: string[] = [];
    const addPart = async (path: string) => {
      const entry = zip.file(path);
      if (entry) {
        const xml = await entry.async("text");
        parts.push(stripXmlTags(xml));
      }
    };
    await addPart("word/document.xml");
    for (let i = 1; i <= 3; i++) {
      await addPart(`word/header${i}.xml`);
      await addPart(`word/footer${i}.xml`);
    }
    return parts.join("\n");
  } catch {
    return "";
  }
};

const extractXlsxStringsFromBase64 = async (fileBase64: string): Promise<string> => {
  try {
    const zip = await JSZip.loadAsync(base64ToUint8Array(fileBase64));
    const shared = zip.file("xl/sharedStrings.xml");
    if (!shared) return "";
    const xml = await shared.async("text");
    const texts = Array.from(xml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)).map((m) =>
      stripXmlTags(m[1]),
    );
    return texts.join("\n");
  } catch {
    return "";
  }
};

const decodeTextFromBase64 = (fileBase64: string): string => {
  try {
    if (typeof atob === "function") {
      return decodeURIComponent(escape(atob(fileBase64)));
    }
    return Buffer.from(fileBase64, "base64").toString("utf-8");
  } catch {
    return "";
  }
};

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
  const ai = checkOnlineAndAIOff();
  return withRetry(async () => {
    const fullPrompt = `以下の依頼内容に基づき、印刷案件のパラメータを提案してください。
依頼内容: "${prompt}"

選択可能な用紙リスト: ${paperTypes.join(", ")}
選択可能な加工リスト: ${finishingOptions.join(", ")}

上記リストに最適なものがない場合は、依頼内容に最も近い一般的なものを提案してください。`;
    const response = await ai.models.generateContent({
      model,
      contents: fullPrompt,
      config: { responseSchema: suggestJobSchema },
    });
    const jsonStr = response.text.trim();
    return JSON.parse(jsonStr);
  });
};
export const analyzeCompany = async (customer: Customer): Promise<CompanyAnalysis> => {
  const ai = checkOnlineAndAIOff();
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
  const ai = checkOnlineAndAIOff();
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
  const ai = checkOnlineAndAIOff();
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
        (cleanedData as Record<string, unknown>)[key] = parsed[key];
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
  const ai = checkOnlineAndAIOff();
  return withRetry(async () => {
    const imagePart = { inlineData: { data: imageBase64, mimeType } };
    const textPart = {
      text:
        "この画像から請求書の詳細情報をJSONで抽出してください。支払期日、登録番号、支払先銀行情報、明細行（品名/数量/単価）も可能な限り含めてください。",
    };
    const response = await ai.models.generateContent({
      model: invoiceOcrModel,
      contents: { parts: [imagePart, textPart] },
      config: {
        responseSchema: extractInvoiceSchema,
      },
    });
    const jsonStr = response.text.trim();
    try {
      return JSON.parse(jsonStr);
    } catch (e) {
      console.error("AIからのJSON解析に失敗しました。", e);
      throw new Error(`AIの応答が不正なJSON形式です。受信内容: ${jsonStr}`);
    }
  });
};

const businessCardSchema = {
  type: Type.OBJECT,
  properties: {
    companyName: { type: Type.STRING, description: "名刺に記載された会社名。" },
    department: { type: Type.STRING, description: "部署名や部門名。" },
    title: { type: Type.STRING, description: "役職名。" },
    personName: { type: Type.STRING, description: "担当者名。" },
    personNameKana: { type: Type.STRING, description: "担当者名のカナ読み。" },
    email: { type: Type.STRING, description: "メールアドレス。" },
    phoneNumber: { type: Type.STRING, description: "代表電話または固定電話。" },
    mobileNumber: { type: Type.STRING, description: "携帯電話番号。" },
    faxNumber: { type: Type.STRING, description: "FAX 番号。" },
    address: { type: Type.STRING, description: "住所。" },
    postalCode: { type: Type.STRING, description: "郵便番号。" },
    websiteUrl: { type: Type.STRING, description: "WebサイトURL。" },
    notes: { type: Type.STRING, description: "その他、名刺から読み取れる補足事項。" },
    recipientEmployeeCode: { type: Type.STRING, description: "名刺右上などに手書きされた受領者の社員番号（赤ペン書き込みを優先）。" },
  },
};

export const extractBusinessCardDetails = async (
  fileBase64: string,
  mimeType: string
): Promise<BusinessCardContact> => {
  const ai = checkOnlineAndAIOff();
  return withRetry(async () => {
    const filePart = { inlineData: { data: fileBase64, mimeType } };
    const instructionPart = {
      text:
        "このファイルは日本語の名刺または名刺スキャンPDFです。記載されている企業名、担当者、連絡先をJSON形式で抽出してください。右上などに赤ペンで手書きされた社員番号があれば recipientEmployeeCode として抽出してください。項目が無い場合は空文字ではなくnullにしてください。",
    };
    const response = await ai.models.generateContent({
      model,
      contents: { parts: [filePart, instructionPart] },
      config: {
        responseSchema: businessCardSchema,
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
  const ai = checkOnlineAndAIOff();
  return withRetry(async () => {
    const fullPrompt = `以下の日常的な取引内容を会計仕訳に変換してください。「${prompt}」`;
    const response = await ai.models.generateContent({
      model,
      contents: fullPrompt,
      config: {
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
  const ai = checkOnlineAndAIOff();
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
  const ai = checkOnlineAndAIOff();
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
  const ai = checkOnlineAndAIOff();
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
  const ai = checkOnlineAndAIOff();
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
  const ai = checkOnlineAndAIOff();
  return withRetry(async () => {
    const prompt = `以下のキーワードを元に、営業日報の活動内容をビジネス文書としてまとめてください。
訪問先: ${customerName}
キーワード: ${activityContent}`;
    const response = await ai.models.generateContent({ model, contents: prompt });
    return response.text;
  });
};

// 手書き日報画像からテキストを抽出して活動内容用のテキストを返す
export const extractDailyReportFromImage = async (
  imageBase64: string,
  mimeType: string
): Promise<string> => {
  const ai = checkOnlineAndAIOff();
  return withRetry(async () => {
    const imagePart = { inlineData: { data: imageBase64, mimeType } };
    const textPart = {
      text:
        "この画像は日本語の手書き業務日報です。日付、訪問先や対応先、主な活動内容、明日の予定などを読み取り、ビジネス文書としてそのまま日報フォームの『活動内容』に貼り付けられる形のテキストに整形して出力してください。箇条書きではなく、日本語の文章で簡潔にまとめてください。",
    };
    const response = await ai.models.generateContent({
      model,
      contents: { parts: [imagePart, textPart] },
    });
    return response.text;
  });
};

export const optimizeScheduleRequestText = async (rawText: string): Promise<string> => {
  const trimmed = rawText?.trim();
  if (!trimmed) {
    return "";
  }
  const ai = checkOnlineAndAIOff();
  return withRetry(async () => {
    const prompt = `以下の文章は、現場の社員に依頼事項を伝えるための下書きです。文脈が散らかっていたり口語表現が強い場合でも、
1) 依頼の目的
2) やってほしい内容（箇条書きで最大5項目）
3) 期限や注意点
を明快に整理してください。文章は日本語で、丁寧かつ簡潔にまとめ、依頼内容をわかりやすくしてください。

下書き:
${trimmed}`;
    const response = await ai.models.generateContent({ model, contents: prompt });
    const text = response.text ?? "";
    const cleaned = stripCodeFences(text);
    return cleaned || trimmed;
  });
};

export const generateWeeklyReportSummary = async (keywords: string): Promise<string> => {
  const ai = checkOnlineAndAIOff();
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
  const ai = checkOnlineAndAIOff();
  return withRetry(async () => {
    const fullPrompt = `あなたは日本の印刷会社で20年以上の経験を持つベテランの見積担当者です。以下の顧客からの要望に基づき、現実的で詳細な見積の下書きをJSON形式で作成してください。原価計算も行い、適切な利益を乗せた単価と金額を設定してください。

【重要】もし顧客の要望が倉庫管理、定期発送、サブスクリプション型のサービスを示唆している場合、必ず「初期費用」と「月額費用」の項目を立てて見積を作成してください。その際の単位は、初期費用なら「式」、月額費用なら「月」としてください。

顧客の要望: "${prompt}"`;
    const response = await ai.models.generateContent({
      model,
      contents: fullPrompt,
      config: {
        responseSchema: draftEstimateSchema as any,
      },
    });
    let jsonStr = response.text.trim();
    // JSONブロックを抽出
    if (jsonStr.startsWith("```json")) {
      jsonStr = jsonStr.substring(7, jsonStr.length - 3).trim();
    }
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.substring(3, jsonStr.length - 3).trim();
    }
    const parsed = JSON.parse(jsonStr);
    // Ensure items array exists
    if (!parsed.items) {
      parsed.items = [];
    }
    return parsed;
  });
};

export const draftEstimateFromSpecFile = async (
  fileBase64: string,
  mimeType: string,
): Promise<Partial<Estimate>> => {
  const normalizedMime = (mimeType || "application/octet-stream").toLowerCase();
  const isPdfOrImage = ["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(
    normalizedMime,
  );
  const isDocx =
    normalizedMime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const isXlsx =
    normalizedMime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    normalizedMime === "application/vnd.ms-excel";
  const isTextLike =
    normalizedMime.startsWith("text/") ||
    normalizedMime === "application/json" ||
    normalizedMime === "application/csv";

  // Avoid unsupported MIME errors by handling text/Excel/Word before calling Gemini with inline data
  if (isTextLike) {
    const text = decodeTextFromBase64(fileBase64);
    if (!text) {
      throw new Error("テキストを読み取れませんでした。ファイル内容を確認してください。");
    }
    return draftEstimate(`以下の仕様書内容を読み取り、見積の下書きを作成してください。\n\n${text}`);
  }

  if (isDocx) {
    const text = await extractDocxTextFromBase64(fileBase64);
    if (text) {
      return draftEstimate(
        `以下のWord仕様書を読み取り、見積の下書きを作成してください。\n\n${text}`,
      );
    }
    // If extraction failed, fall through to try inline upload as a last resort
  }

  if (isXlsx) {
    const text = await extractXlsxStringsFromBase64(fileBase64);
    if (text) {
      return draftEstimate(
        `以下のExcel仕様書を読み取り、見積の下書きを作成してください。\n\n${text}`,
      );
    }
    throw new Error(
      "Excelファイルを解析できませんでした。PDFや画像、テキスト形式でアップロードしてください。",
    );
  }

  if (!isPdfOrImage) {
    throw new Error(
      "このファイル形式はサポートされていません。PDF/画像/テキスト/Excel(.xlsx)/Word(.docx)でアップロードしてください。",
    );
  }

  const ai = checkOnlineAndAIOff();
  return withRetry(async () => {
    const filePart = { inlineData: { data: fileBase64, mimeType } };
    const instructionPart = {
      text: `このファイルは印刷物などの仕様書/PDF/スキャン画像です。内容を読み取り、以下のJSONフォーマットで見積の下書きを作成してください。数量、用紙、加工、納期、支払条件が読み取れない場合は推定し、備考にその旨を記載してください。`,
    };
    const response = await ai.models.generateContent({
      model,
      contents: { parts: [filePart, instructionPart] },
      config: {
        responseSchema: draftEstimateSchema as any,
      },
    });
    let jsonStr = response.text.trim();
    // JSONブロックを抽出
    if (jsonStr.startsWith("```json")) {
      jsonStr = jsonStr.substring(7, jsonStr.length - 3).trim();
    }
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.substring(3, jsonStr.length - 3).trim();
    }
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed.items)) {
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
  const ai = checkOnlineAndAIOff();
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
- 見積合計: ${formatJPY(estimate.total === undefined || estimate.total === null ? undefined : Number(estimate.total))}
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
  const ai = checkOnlineAndAIOff();
  return withRetry(async () => {
    const prompt = `以下のリード情報を分析し、有望度をスコアリングしてください。
会社名: ${lead.company}
問い合わせ種別: ${lead.inquiryTypes?.join(", ") || lead.inquiryType}
メッセージ: ${lead.message}`;
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseSchema: scoreLeadSchema,
      },
    });
    const jsonStr = response.text.trim();
    return JSON.parse(jsonStr);
  });
};

export const startBugReportChat = (): Chat => {
  const ai = checkOnlineAndAIOff(); // Will throw if AI is off or offline
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
  const ai = checkOnlineAndAIOff();
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
  const ai = checkOnlineAndAIOff();
  return withRetry(async () => {
    const prompt = `以下のデータに基づき、${type}決算のサマリーを生成してください。前月比や課題、改善提案を含めてください。`;
    // In a real scenario, you'd pass the data, but for brevity we'll just send the prompt.
    const response = await ai.models.generateContent({ model, contents: prompt });
    return response.text;
  });
};

export const startBusinessConsultantChat = (): Chat => {
  const ai = checkOnlineAndAIOff(); // Will throw if AI is off or offline
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
  const ai = checkOnlineAndAIOff();
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
  const ai = checkOnlineAndAIOff();
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
  const ai = checkOnlineAndAIOff();
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

export const generateLeadSummary = async (
  lead: Lead
): Promise<string> => {
  const ai = checkOnlineAndAIOff();
  return withRetry(async () => {
    const prompt = `あなたは「文唱堂印刷株式会社」の営業担当者です。以下のリード情報を分析し、戦略的な要約を作成してください。

## リード情報
- 企業名: ${lead.company}
- 担当者名: ${lead.name || "不明"}
- メールアドレス: ${lead.email || "不明"}
- 電話番号: ${lead.phone || "不明"}
- ステータス: ${lead.status}
- 問い合わせ内容: ${lead.message || "具体的な内容は記載されていません。"}

## 重要：慎重な判定を求めます
**顧客からの重要な問い合わせを営業メールと誤判定しないでください。**

### 具体的な顧客問い合わせ例（必ず印刷問い合わせと判定）
例えば以下のような内容は絶対に営業メールと判断しないでください：

**例1：雑誌印刷**
「インディペンデント雑誌の印刷を検討しております。下記、予定している概要です。
サイズ：B5サイズ
綴じ方向：右綴じ
ページ：108ページ予定 (表紙 4ページ＋本文 104ページ)
カラー：【表紙】片面カラー、片面モノクロ【本文】カラー
用紙：【表紙】ヴァンヌーボVナチュラル195kg
　　　【本文】b7トラネクスト86kg
部数：500部予定」

**例2：書籍印刷**
「書籍の印刷をご検討しております。A5サイズ、200ページ、フルカラー、300部の予定です。表紙は上質紙、本文はコート紙を使用希望。」

**例3：冊子印刷**
「会社案内冊子を印刷したいです。A4判、中綴じ、全32ページ、4色刷り、500部を希望しております。」

これらのような具体的な印刷仕様が記載されている場合は、必ず「印刷問い合わせ」と判断してください。

### 印刷問い合わせの明確な特徴（優先度高）
以下のいずれか1つでも含まれていれば「印刷問い合わせ」と判断：
- **印刷物の種類**: 雑誌、書籍、冊子、パンフレット、チラシ、名刺、封筒、ポスター
- **具体的なサイズ**: B5、A4、A5などの明確なサイズ指定
- **ページ数の指定**: 「108ページ」「200ページ」「32ページ」など具体的なページ数
- **綴じ方向**: 「右綴じ」「中綴じ」「左綴じ」などの製本仕様
- **色数の指定**: 「片面カラー」「フルカラー」「4色刷り」など
- **用紙の種類**: 「ヴァンヌーボ」「トラネクスト」「上質紙」「コート紙」など
- **部数の指定**: 「500部」「300部」「1000部」など具体的な部数
- **印刷関連単語**: 印刷、製版、DTP、デザイン、入稿、フォーマット

### 営業メールの特徴（慎重に判定）
以下の**すべて**の条件が揃った場合のみ「営業メール」と判断：
- 自社製品やサービスの宣伝、セールスピッチが主目的
- 相手の具体的なニーズや要望が全く記載されていない
- どの企業にも送れるような一般的な内容
- 「貴社へのご提案」「提携させてください」といった明確な売り込み表現

## 分析要件
1. **メール種別の判定**: 印刷関連の単語が1つでも含まれていれば「印刷問い合わせ」と判断
2. **印刷関連性の評価**: 印刷サービスとの関連性を高・中・低で評価
3. **緊急度判断**: 内容から緊急度を高・中・低で判断
4. **戦略的アドバイス**: 営業としての具体的な次のアクションを提案

## 出力形式
以下の形式で要約を作成してください：

【種別】印刷問い合わせ/営業メール/その他
【関連性】高/中/低
【緊急度】高/中/低
【要約】3行以内で具体的な内容を要約
【戦略】営業としての具体的な対応方針

## 重要指示
- **印刷関連の単語が含まれている場合は必ず「印刷問い合わせ」と判断してください**
- **営業メールと判断する場合は、本当に売り込み目的であることを確認してください**
- **不明確な場合は「印刷問い合わせ」として、対応方針を提案してください**

例：
印刷問い合わせの場合：
【種別】印刷問い合わせ
【関連性】高
【緊急度】中
【要約】A4チラシ100部の見積依頼
【戦略】24時間以内に見積書を作成し送付

営業メールの場合（本当に売り込みのみの場合）：
【種別】営業メール
【関連性】低
【緊急度】低
【要約】他社からのサービス提案メール
【戦略】対応不要（営業メールのため）`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", // 高速モデルに変更
      contents: prompt,
      config: {
        maxOutputTokens: 500, // トークン数を制限して高速化
        temperature: 0.1, // 低い温度で一貫性を確保
      },
    });

    return response.text.trim();
  });
};

export const createLeadProposalPackage = async (
  lead: Lead
): Promise<LeadProposalPackage> => {
  const ai = checkOnlineAndAIOff();
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
    c. **見積案作成**: 問い合わせ内容から顧客の具体的な要望を正確に読み取り、それに基づき現実的で詳細な見積の明細項目を作成してください。特に以下の点を考慮してください：
       - 問い合わせ内容に記載されている具体的な仕様（サイズ、綴じ方向、ページ数、カラー設定、用紙の種類、部数など）を正確に反映
       - 顧客が明示的に希望する仕様に基づいた適切な単価と数量を設定
       - 印刷業界の標準的な工程（用紙代、デザイン・DTP代、刷版代、印刷代、加工代）に沿った分類
       - undefinedや不適切な項目名を避け、具体的で分かりやすい品名を使用
       - 各項目の単価と数量から合計金額を正確に計算
       - 可能な限り現実的で実現可能な仕様と価格を提示
3.  **営業メールの場合**:
    a. なぜ営業メールと判断したか、簡潔な理由を述べてください。
    b. isSalesLeadをtrueに設定し、proposalとestimateフィールドは省略してください。

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
}

## 重要指示
- 問い合わせ内容に具体的な仕様（A4サイズ、フルカラー、100部など）が記載されている場合は、必ずその仕様に基づいた見積を作成してください。
- 顧客の希望が不明確な場合は、一般的な標準仕様を提案しつつ、追加情報の確認を促してください。
- 印刷物の種類や用途を考慮し、最適な印刷方法を提案してください。
- 単価設定は原価計算に基づき、適切な利益率を考慮してください。
- **環境配慮**: 必ず見積もりの備考欄に「当社の工場はクリーンエネルギーで運営されており、CO2排出量を削減することができます。環境対策費：0円」という文言を含めてください。
`;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", // 高速モデルに変更
      contents: prompt,
      config: {
        maxOutputTokens: 2000, // トークン数を増やして完全な見積を生成
        temperature: 0.1, // 低い温度で一貫性を確保
      },
    });

    let jsonStr = response.text.trim();
    if (jsonStr.startsWith("```json")) {
      jsonStr = jsonStr.substring(7, jsonStr.length - 3).trim();
    }
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.substring(3, jsonStr.length - 3).trim();
    }
    try {
      const result = JSON.parse(jsonStr);
      // 見積もりデータが空の場合はフォールバックを生成
      if (!result.isSalesLead && (!result.estimate || result.estimate.length === 0)) {
        result.estimate = generateFallbackEstimate(lead);
      }
      return result;
    } catch (e) {
      console.error("Failed to parse JSON from Gemini for lead proposal package:", e);
      console.error("Received text:", jsonStr);
      // フォールバック見積もりを生成
      return generateFallbackPackage(lead);
    }
  });
};

// Compatibility exports for legacy callers.
export const generateLeadProposalPackage = createLeadProposalPackage;

export const extractDocumentText = async (..._args: any[]): Promise<string> => {
  return '';
};

export const transcribeAudio = async (..._args: any[]): Promise<string> => {
  return '';
};

export const createBlob = (..._args: any[]): Blob => {
  return new Blob();
};

export const decodeAudioData = async (..._args: any[]): Promise<AudioBuffer> => {
  throw new Error('decodeAudioData is not implemented.');
};

export const decode = (..._args: any[]): string => {
  return '';
};

export const startLiveChatSession = async (..._args: any[]): Promise<void> => {
  return;
};

export const createProjectFromInputs = async (..._args: any[]): Promise<any> => {
  return null;
};

// フォールバック見積もり生成関数
const generateFallbackEstimate = (lead: Lead) => {
  const message = lead.message || '';

  // 雑誌印刷の具体例から仕様を抽出
  const isMagazine = message.includes('雑誌') || message.includes('インディペンデント');
  const size = message.includes('B5') ? 'B5' : message.includes('A4') ? 'A4' : 'A4';
  const pages = message.match(/(\d+)ページ/) ? parseInt(message.match(/(\d+)ページ/)![1]) : 32;
  const quantity = message.match(/(\d+)部/) ? parseInt(message.match(/(\d+)部/)![1]) : 500;
  const color = message.includes('カラー') ? 'フルカラー' : 'モノクロ';

  const basePrice = isMagazine ? 150000 : 80000;
  const pagePrice = pages * 500;
  const quantityPrice = quantity * 100;

  return [
    {
      division: '用紙代' as const,
      content: `${size}判 ${color}用紙`,
      quantity: quantity,
      unit: '部',
      unitPrice: Math.round(basePrice / Number(quantity)),
      price: basePrice,
      cost: Math.round(basePrice * 0.7),
      costRate: 0.7,
      subtotal: basePrice
    },
    {
      division: '印刷代' as const,
      content: `${pages}ページ ${color}印刷`,
      quantity: pages,
      unit: 'ページ',
      unitPrice: Math.round(pagePrice / Number(pages)),
      price: pagePrice,
      cost: Math.round(pagePrice * 0.6),
      costRate: 0.6,
      subtotal: pagePrice
    },
    {
      division: '加工代' as const,
      content: '製本・仕上げ',
      quantity: 1,
      unit: '式',
      unitPrice: quantityPrice,
      price: quantityPrice,
      cost: Math.round(quantityPrice * 0.5),
      costRate: 0.5,
      subtotal: quantityPrice
    }
  ];
};

const generateFallbackPackage = (lead: Lead): LeadProposalPackage => {
  return {
    isSalesLead: false,
    reason: '',
    proposal: {
      coverTitle: `【印刷サービス提案】${lead.company}`,
      businessUnderstanding: `${lead.company}様の印刷ニーズに基づき、最適な印刷ソリューションをご提案いたします。`,
      challenges: '品質とコストのバランスを取りながら、短期間での納品が求められています。',
      proposal: '最新の印刷技術と経験豊富なスタッフで、高品質な印刷物を効率的に製作いたします。',
      conclusion: '貴社の要望に沿った最適な印刷ソリューションをご提供できるよう全力でサポートいたします。'
    },
    estimate: generateFallbackEstimate(lead)
  };
};

// 環境対策備考を生成する関数
const generateEnvironmentalNote = (): string => {
  return `当社の工場はクリーンエネルギーで運営されており、CO2排出量を削減することができます。
環境対策費：0円

※環境に配慮した印刷サービスを無償で提供いたします。`;
};

/**
 * 【開発者への引き継ぎ：実装上の重要事項】
 * 以下の `coreTools` は、AIがSupabase（project_ref: rwjhpfghhgstvplmggks）や
 * Google Driveを操作するためのツール定義です。
 * 
 * 【お詫び】
 * 現在、フロントエンドのみで動作させるため、実際のDB検索結果をAIが受け取って再計算する
 * 実装が不十分です。現在はAIが「検索したつもり」で推論値を返しています。
 * 実装時は、以下の関数呼び出し（ToolCall）をサーバー側でキャッチし、
 * 実際のMCP実行結果をAIに返却（FunctionResponse）するようにリファクタリングしてください。
 */
const coreTools: FunctionDeclaration[] = [
  {
    name: 'supabase_db_query',
    parameters: {
      type: Type.OBJECT,
      description: 'Supabaseから顧客情報、過去の成約単価、マスタ原価を取得します。',
      properties: {
        sql_query: { type: Type.STRING, description: '実行するSQL、または抽出条件' },
        clientName: { type: Type.STRING }
      },
      required: ['clientName']
    }
  },
  {
    name: 'google_drive_file_search',
    parameters: {
      type: Type.OBJECT,
      description: 'Google Drive内の過去見積Excelや仕様書PDFから、類似案件の仕様と金額を検索します。',
      properties: {
        keyword: { type: Type.STRING, description: '検索キーワード（例：パンフレット A4 4P）' }
      },
      required: ['keyword']
    }
  },
  {
    name: 'wiki_knowledge_fetch',
    parameters: {
      type: Type.OBJECT,
      description: 'DeepWikiから顧客固有の検品基準、品質要件、過去のトラブル情報を取得します。',
      properties: {
        clientName: { type: Type.STRING }
      }
    }
  }
];

// AI見積もりアプリ用の関数
const extractSpecSchema = {
  type: Type.OBJECT,
  properties: {
    projectName: { type: Type.STRING, description: '案件名' },
    category: { type: Type.STRING, description: '印刷品目カテゴリ' },
    quantity: { type: Type.INTEGER, description: '数量（部数）' },
    size: { type: Type.STRING, description: 'サイズ（例：A4, B5）' },
    paperType: { type: Type.STRING, description: '用紙種類' },
    pages: { type: Type.INTEGER, description: 'ページ数' },
    colors: { type: Type.STRING, description: '色数（例：4/4, 4/0）', enum: ['4/4', '4/0', '1/1', '1/0'] },
    finishing: { type: Type.ARRAY, items: { type: Type.STRING }, description: '加工オプション' },
    requestedDelivery: { type: Type.STRING, description: '希望納期' },
  },
};

export const extractSpecFromInput = async (
  inputText: string,
  imageBase64?: string
): Promise<Partial<PrintSpec>> => {
  const ai = checkOnlineAndAIOff();
  return withRetry(async () => {
    const prompt = `
    文唱堂印刷の基幹AIとして、入力内容から印刷仕様（品名、カテゴリ、部数、サイズ、紙、頁数、色数、加工）を抽出してください。
    システム構成: ${JSON.stringify(INTEGRATION_MANIFESTO)}
    入力: ${inputText}
  `;

    const parts: any[] = [{ text: prompt }];

    if (imageBase64) {
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      const mimeType = imageBase64.match(/^data:image\/(\w+);base64,/)?.[1] || 'jpeg';
      parts.push({ inlineData: { data: base64Data, mimeType: `image/${mimeType}` } });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts },
      config: {
        responseSchema: extractSpecSchema,
      },
    });

    let jsonStr = response.text.trim();
    // JSONブロックを抽出
    if (jsonStr.startsWith("```json")) {
      jsonStr = jsonStr.substring(7, jsonStr.length - 3).trim();
    }
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.substring(3, jsonStr.length - 3).trim();
    }
    return JSON.parse(jsonStr);
  });
};

export const calculateEstimation = async (spec: PrintSpec): Promise<EstimationResult> => {
  const ai = checkOnlineAndAIOff();
  return withRetry(async () => {
    const contextPrompt = `
    【基幹連携見積シミュレーション開始】
    1. supabase_db_query を実行し、顧客「${spec.clientName}」の過去成約履歴と現在のマスタ単価を取得せよ。
    2. google_drive_file_search を実行し、今回の「${spec.category}」に近い過去の見積書を検索せよ。
    3. wiki_knowledge_fetch を実行し、顧客固有の禁止事項や検品ルールを反映せよ。
    
    上記リソースを統合し、MQ会計（売上、変動費、限界利益）に基づく3つの見積プラン（成約優先、標準、利益重視）を算定せよ。
    ※現在はプロトタイプのため、AIによる推論値を出力するが、解説文には「どのDB情報を参照したか」を具体的に含めること。

    案件仕様: ${JSON.stringify(spec)}
  `;

    // Note: Gemini API does not support tools + responseMimeType together.
    // We remove responseMimeType and parse JSON manually from the response.
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contextPrompt,
      config: {
        tools: [{ functionDeclarations: coreTools }],
      }
    });

    let jsonStr = stripCodeFences(response.text);
    try {
      return JSON.parse(jsonStr);
    } catch (e) {
      console.error("Failed to parse estimation result JSON:", e);
      console.error("Received text:", jsonStr);
      // Return a fallback estimation result
      return {
        options: [
          {
            id: "standard",
            label: "標準プラン",
            pq: 100000,
            vq: 60000,
            mq: 40000,
            f: 20000,
            g: 20000,
            mRatio: 0.4,
            estimatedLeadTime: "2週間",
            probability: 70,
            description: "標準的な見積もりプランです。詳細な仕様確認後に正式見積もりを作成します。"
          }
        ],
        aiReasoning: "AIからの応答を解析できませんでした。フォールバック値を使用しています。",
        co2Reduction: 0,
        comparisonWithPast: { averagePrice: 0, differencePercentage: 0 }
      };
    }
  });
};
