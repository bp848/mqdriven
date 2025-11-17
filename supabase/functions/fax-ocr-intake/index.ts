import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';
import { GoogleGenAI, Type } from 'npm:@google/genai';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type FaxOcrPayload = {
  intakeId: string;
  filePath: string;
  docType?: 'order' | 'estimate' | 'vendor_invoice' | 'unknown';
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const API_KEY = Deno.env.get('API_KEY');
const FAX_BUCKET = Deno.env.get('FAX_INTAKE_BUCKET') ?? 'fax-intakes';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const respondWithCors = (body: BodyInit | null, init?: ResponseInit) =>
  new Response(body, {
    ...(init ?? {}),
    headers: {
      ...corsHeaders,
      ...(init?.headers ?? {}),
    },
  });

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('[fax-ocr-intake] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
}
if (!API_KEY) {
  console.warn('[fax-ocr-intake] Missing API_KEY environment variable. Gemini OCR requests will fail.');
}

const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  : null;

const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;
const model = 'gemini-2.5-flash';

const docTypeLabels: Record<NonNullable<FaxOcrPayload['docType']>, string> = {
  order: '受注',
  estimate: '見積',
  vendor_invoice: '外注請求書',
  unknown: '資料',
};

const expenseLineSchema = {
  type: Type.OBJECT,
  properties: {
    description: { type: Type.STRING, description: '明細の品名や内容。' },
    lineDate: { type: Type.STRING, description: '対象日 (YYYY-MM-DD)。' },
    quantity: { type: Type.NUMBER, description: '数量。' },
    unit: { type: Type.STRING, description: '単位（式、枚など）。' },
    unitPrice: { type: Type.NUMBER, description: '単価（税抜）。' },
    amountExclTax: { type: Type.NUMBER, description: '金額（税抜）。' },
    taxRate: { type: Type.NUMBER, description: '税率(%)。' },
    customerName: { type: Type.STRING, description: '明細に記載された顧客名。' },
    projectName: { type: Type.STRING, description: '記載されている案件名。' },
  },
};

const bankAccountSchema = {
  type: Type.OBJECT,
  properties: {
    bankName: { type: Type.STRING, description: '金融機関名。' },
    branchName: { type: Type.STRING, description: '支店名。' },
    accountType: { type: Type.STRING, description: '口座種別（普通・当座など）。' },
    accountNumber: { type: Type.STRING, description: '口座番号。' },
  },
};

const expenseDraftSchema = {
  type: Type.OBJECT,
  properties: {
    supplierName: { type: Type.STRING, description: '請求書ヘッダーの発行元。' },
    registrationNumber: { type: Type.STRING, description: '請求書に記載の登録番号。' },
    invoiceDate: { type: Type.STRING, description: '請求日。' },
    dueDate: { type: Type.STRING, description: '支払期日。' },
    totalGross: { type: Type.NUMBER, description: '税込合計。' },
    totalNet: { type: Type.NUMBER, description: '税抜合計。' },
    taxAmount: { type: Type.NUMBER, description: '税額。' },
    paymentRecipientId: { type: Type.STRING, description: '社内マスタの支払先コードが明記されている場合。' },
    paymentRecipientName: { type: Type.STRING, description: '支払先名称。' },
    bankAccount: bankAccountSchema,
    lines: { type: Type.ARRAY, items: expenseLineSchema },
  },
};

const extractInvoiceSchema = {
  type: Type.OBJECT,
  properties: {
    vendorName: { type: Type.STRING, description: '請求書の発行元企業名。' },
    invoiceDate: { type: Type.STRING, description: '請求書の発行日 (YYYY-MM-DD形式)。' },
    dueDate: { type: Type.STRING, description: '支払期日。' },
    totalAmount: { type: Type.NUMBER, description: '請求書の合計金額（税込）。' },
    subtotalAmount: { type: Type.NUMBER, description: '税抜金額。' },
    taxAmount: { type: Type.NUMBER, description: '消費税額。' },
    description: { type: Type.STRING, description: '請求内容の簡潔な説明。' },
    costType: {
      type: Type.STRING,
      description: 'この費用が変動費(V)か固定費(F)かを推測してください。',
      enum: ['V', 'F'],
    },
    account: {
      type: Type.STRING,
      description: 'この請求内容に最も適した会計勘定科目を提案してください。例: 仕入高, 広告宣伝費, 事務用品費',
    },
    relatedCustomer: {
      type: Type.STRING,
      description: 'この費用に関連する顧客名（もしあれば）。',
    },
    project: {
      type: Type.STRING,
      description: 'この費用に関連する案件名やプロジェクト名（もしあれば）。',
    },
    registrationNumber: { type: Type.STRING, description: '請求書の登録番号。' },
    paymentRecipientName: { type: Type.STRING, description: '請求書に記載された支払先名。' },
    bankAccount: bankAccountSchema,
    lineItems: { type: Type.ARRAY, items: expenseLineSchema },
    expenseDraft: expenseDraftSchema,
  },
  required: ['vendorName', 'invoiceDate', 'totalAmount', 'description', 'costType', 'account'],
};

const guessMimeType = (filePath: string): string => {
  const lowered = filePath.toLowerCase();
  if (lowered.endsWith('.pdf')) return 'application/pdf';
  if (lowered.endsWith('.png')) return 'image/png';
  if (lowered.endsWith('.jpg') || lowered.endsWith('.jpeg')) return 'image/jpeg';
  if (lowered.endsWith('.tif') || lowered.endsWith('.tiff')) return 'image/tiff';
  if (lowered.endsWith('.gif')) return 'image/gif';
  if (lowered.endsWith('.bmp')) return 'image/bmp';
  if (lowered.endsWith('.webp')) return 'image/webp';
  return 'application/octet-stream';
};

const toBase64 = async (blob: Blob): Promise<string> => {
  const buffer = await blob.arrayBuffer();
  return encodeBase64(new Uint8Array(buffer));
};

const updateFaxIntakeStatus = async (
  intakeId: string,
  updates: Record<string, unknown>,
) => {
  if (!intakeId || !supabase) return;
  await supabase
    .from('fax_intakes')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', intakeId);
};

const normalizeText = (value?: string | null) => (value ?? '').replace(/\s+/g, '').toLowerCase();
const includesMatch = (needle: string, haystack: string) => haystack.includes(needle) || needle.includes(haystack);

const ensureExpenseDraft = (invoice: Record<string, any>) => {
  if (!invoice.expenseDraft || typeof invoice.expenseDraft !== 'object') {
    invoice.expenseDraft = {};
  }
  return invoice.expenseDraft as Record<string, any>;
};

const enrichInvoiceJsonWithMatches = async (invoice: Record<string, any>) => {
  if (!supabase) return;
  try {
    const [recipientsRes, customersRes] = await Promise.all([
      supabase.from('payment_recipients').select('id, company_name, recipient_name'),
      supabase.from('customers').select('id, customer_name'),
    ]);

    if (recipientsRes.error) {
      console.warn('[fax-ocr-intake] Failed to fetch payment recipients', recipientsRes.error);
    }
    if (customersRes.error) {
      console.warn('[fax-ocr-intake] Failed to fetch customers', customersRes.error);
    }

    const recipients = (recipientsRes.data ?? []).map(rec => ({
      id: rec.id,
      labels: [rec.company_name, rec.recipient_name]
        .map(label => normalizeText(label))
        .filter(Boolean),
      display: rec.company_name || rec.recipient_name || '',
    }));
    const customers = (customersRes.data ?? []).map(customer => ({
      id: customer.id,
      label: normalizeText(customer.customer_name),
      display: customer.customer_name,
    }));

    const supplierName = invoice.expenseDraft?.supplierName || invoice.vendorName;
    const normalizedSupplier = normalizeText(supplierName);
    if (normalizedSupplier && recipients.length > 0) {
      const recipientMatch =
        recipients.find(item => item.labels.includes(normalizedSupplier)) ||
        recipients.find(item => item.labels.some(label => includesMatch(normalizedSupplier, label)));
      if (recipientMatch) {
        invoice.matchedPaymentRecipientId = recipientMatch.id;
        invoice.matchedPaymentRecipientName = recipientMatch.display;
        const expenseDraft = ensureExpenseDraft(invoice);
        if (!expenseDraft.paymentRecipientId) {
          expenseDraft.paymentRecipientId = recipientMatch.id;
        }
        if (!expenseDraft.paymentRecipientName) {
          expenseDraft.paymentRecipientName = recipientMatch.display;
        }
      }
    }

    const lineCustomer = invoice.expenseDraft?.lines?.find((line: any) => line?.customerName)?.customerName;
    const fallbackCustomer = invoice.relatedCustomer || invoice.project;
    const normalizedCustomer = normalizeText(lineCustomer || fallbackCustomer);
    if (normalizedCustomer && customers.length > 0) {
      const customerMatch =
        customers.find(item => item.label === normalizedCustomer) ||
        customers.find(item => item.label && includesMatch(normalizedCustomer, item.label));
      if (customerMatch) {
        invoice.matchedCustomerId = customerMatch.id;
        invoice.matchedCustomerName = customerMatch.display;
      }
    }
  } catch (matchError) {
    console.warn('[fax-ocr-intake] Failed to enrich OCR JSON with matches', matchError);
  }
};

type ExpenseLineDraft = {
  id: string;
  lineDate: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  amountExclTax: number;
  taxRate: number;
  accountItemId: string;
  allocationDivisionId: string;
  customerId: string;
  projectId: string;
  linkedRevenueId: string;
};

type ExpenseInvoiceDraftPayload = {
  id: string;
  supplierName: string;
  paymentRecipientId: string;
  registrationNumber: string;
  invoiceDate: string;
  dueDate: string;
  totalGross: number;
  totalNet: number;
  taxAmount: number;
  status: 'Draft';
  bankAccount: {
    bankName: string;
    branchName: string;
    accountType: string;
    accountNumber: string;
  };
  lines: ExpenseLineDraft[];
};

type ExpenseDraftTotals = {
  net: number;
  tax: number;
  gross: number;
};

const nowDateString = () => new Date().toISOString().split('T')[0];
const generatePrefixedId = (prefix: string) => `${prefix}_${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2, 10)}`;

const toOptionalString = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
};

const toOptionalNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const normalized = value.replace(/[,￥¥\s]/g, '').replace(/[^\d.-]/g, '');
    if (!normalized) return undefined;
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const toDateString = (value: unknown): string => {
  const raw = toOptionalString(value);
  if (!raw) return nowDateString();
  return raw.replace(/[./]/g, '-');
};

const computeTotalsFromLines = (lines: ExpenseLineDraft[]): ExpenseDraftTotals => {
  const net = lines.reduce((sum, line) => sum + (Number.isFinite(line.amountExclTax) ? line.amountExclTax : 0), 0);
  const tax = lines.reduce((sum, line) => {
    const amount = Number.isFinite(line.amountExclTax) ? line.amountExclTax : 0;
    const rate = Number.isFinite(line.taxRate) ? line.taxRate : 0;
    return sum + amount * (rate / 100);
  }, 0);
  return { net, tax, gross: net + tax };
};

const normalizeExpenseLineFromOcr = (line: Record<string, any> | null | undefined, index: number): ExpenseLineDraft => {
  const quantity = toOptionalNumber(line?.quantity) ?? 1;
  const unitPrice = toOptionalNumber(line?.unitPrice) ?? toOptionalNumber((line as any)?.unit_price) ?? 0;
  const amountExclTax =
    toOptionalNumber(line?.amountExclTax) ??
    toOptionalNumber((line as any)?.amount_excl_tax) ??
    toOptionalNumber((line as any)?.amount) ??
    quantity * unitPrice;

  return {
    id: toOptionalString(line?.id) ?? generatePrefixedId(`line${index}`),
    lineDate: toDateString(line?.lineDate || line?.date),
    description: toOptionalString(line?.description) ?? `自動取込明細${index + 1}`,
    quantity: quantity > 0 ? quantity : 1,
    unit: toOptionalString(line?.unit) ?? '式',
    unitPrice,
    amountExclTax: amountExclTax > 0 ? amountExclTax : quantity * unitPrice,
    taxRate: toOptionalNumber(line?.taxRate) ?? 10,
    accountItemId: toOptionalString(line?.accountItemId) ?? '',
    allocationDivisionId: toOptionalString(line?.allocationDivisionId) ?? '',
    customerId: toOptionalString(line?.customerId) ?? '',
    projectId: toOptionalString(line?.projectId) ?? '',
    linkedRevenueId: toOptionalString(line?.linkedRevenueId) ?? '',
  };
};

const normalizeBankAccount = (account: Record<string, any> | null | undefined) => ({
  bankName: toOptionalString(account?.bankName) ?? '',
  branchName: toOptionalString(account?.branchName) ?? '',
  accountType: toOptionalString(account?.accountType) ?? '',
  accountNumber: toOptionalString(account?.accountNumber) ?? '',
});

const pickBestNumber = (candidates: Array<unknown>): number | undefined => {
  for (const candidate of candidates) {
    const value = toOptionalNumber(candidate);
    if (typeof value === 'number') return value;
  }
  return undefined;
};

const looksLikeVendorInvoice = (parsedJson: Record<string, any> | null | undefined): boolean => {
  if (!parsedJson || typeof parsedJson !== 'object') return false;
  const hasExpenseDraft = parsedJson.expenseDraft && typeof parsedJson.expenseDraft === 'object';
  const hasLineItems = Array.isArray(parsedJson.lineItems) && parsedJson.lineItems.length > 0;
  const hasTotals = Boolean(
    pickBestNumber([parsedJson.totalAmount, parsedJson.subtotalAmount, parsedJson.taxAmount]),
  );
  const hasVendorName = Boolean(toOptionalString(parsedJson.vendorName));
  return Boolean(hasExpenseDraft || hasLineItems || (hasVendorName && hasTotals));
};

const buildFallbackExpenseDraft = (parsedJson: Record<string, any>): Record<string, any> | null => {
  const supplierName =
    toOptionalString(parsedJson.vendorName) ??
    toOptionalString(parsedJson.paymentRecipientName) ??
    toOptionalString(parsedJson.expenseDraft?.supplierName);

  const totalGross = pickBestNumber([
    parsedJson.totalAmount,
    parsedJson.expenseDraft?.totalGross,
  ]);
  const totalNet = pickBestNumber([
    parsedJson.subtotalAmount,
    parsedJson.expenseDraft?.totalNet,
  ]);
  const taxAmount = pickBestNumber([
    parsedJson.taxAmount,
    parsedJson.expenseDraft?.taxAmount,
  ]);
  const lines = Array.isArray(parsedJson.lineItems) ? parsedJson.lineItems : [];
  const hasMeaningfulData = Boolean(supplierName || lines.length > 0 || totalGross || totalNet || taxAmount);

  if (!hasMeaningfulData) {
    return null;
  }

  return {
    supplierName,
    registrationNumber:
      toOptionalString(parsedJson.registrationNumber) ??
      toOptionalString(parsedJson.expenseDraft?.registrationNumber),
    invoiceDate: parsedJson.invoiceDate ?? parsedJson.expenseDraft?.invoiceDate,
    dueDate: parsedJson.dueDate ?? parsedJson.expenseDraft?.dueDate,
    totalGross,
    totalNet,
    taxAmount,
    paymentRecipientId:
      toOptionalString(parsedJson.matchedPaymentRecipientId) ??
      toOptionalString(parsedJson.expenseDraft?.paymentRecipientId),
    paymentRecipientName:
      toOptionalString(parsedJson.paymentRecipientName) ??
      toOptionalString(parsedJson.expenseDraft?.paymentRecipientName),
    bankAccount: parsedJson.bankAccount ?? parsedJson.expenseDraft?.bankAccount,
    lines,
  };
};

const buildExpenseInvoiceDraft = (
  rawDraft: Record<string, any>,
  parsedJson: Record<string, any>,
): { invoice: ExpenseInvoiceDraftPayload; totals: ExpenseDraftTotals } => {
  const supplierName =
    toOptionalString(rawDraft.supplierName) ??
    toOptionalString(parsedJson.vendorName) ??
    toOptionalString(parsedJson.paymentRecipientName) ??
    '未設定のサプライヤー';

  const rawLines = Array.isArray(rawDraft.lines) ? rawDraft.lines : [];
  const normalizedLines =
    rawLines.length > 0
      ? rawLines.map((line, index) => normalizeExpenseLineFromOcr(line, index))
      : [
        normalizeExpenseLineFromOcr(
          {
            description: `${supplierName} 向け経費`,
            amountExclTax: pickBestNumber([rawDraft.totalNet, parsedJson.subtotalAmount]) ?? 0,
          },
          0,
        ),
      ];

  const lineTotals = computeTotalsFromLines(normalizedLines);
  const totalNet = pickBestNumber([rawDraft.totalNet, parsedJson.subtotalAmount, lineTotals.net]) ?? lineTotals.net;
  let totalGross = pickBestNumber([rawDraft.totalGross, parsedJson.totalAmount]);
  let taxAmount = pickBestNumber([rawDraft.taxAmount, parsedJson.taxAmount]);

  if (typeof taxAmount !== 'number' && typeof totalGross === 'number') {
    taxAmount = totalGross - totalNet;
  }
  if (typeof totalGross !== 'number' && typeof taxAmount === 'number') {
    totalGross = totalNet + taxAmount;
  }
  if (typeof taxAmount !== 'number') {
    taxAmount = lineTotals.tax;
  }
  if (typeof totalGross !== 'number') {
    totalGross = totalNet + taxAmount;
  }

  const invoice: ExpenseInvoiceDraftPayload = {
    id: toOptionalString(rawDraft.id) ?? generatePrefixedId('invoice'),
    supplierName,
    paymentRecipientId:
      toOptionalString(rawDraft.paymentRecipientId) ??
      toOptionalString(parsedJson.matchedPaymentRecipientId) ??
      '',
    registrationNumber:
      toOptionalString(rawDraft.registrationNumber) ?? toOptionalString(parsedJson.registrationNumber) ?? '',
    invoiceDate: toDateString(rawDraft.invoiceDate ?? parsedJson.invoiceDate),
    dueDate: toDateString(rawDraft.dueDate ?? parsedJson.dueDate),
    totalGross,
    totalNet,
    taxAmount,
    status: 'Draft',
    bankAccount: normalizeBankAccount(rawDraft.bankAccount ?? parsedJson.bankAccount),
    lines: normalizedLines,
  };

  return { invoice, totals: { net: totalNet, tax: taxAmount, gross: totalGross } };
};

let cachedExpenseApplicationCodeId: string | null = null;

const getExpenseApplicationCodeId = async (): Promise<string | null> => {
  if (!supabase) return null;
  if (cachedExpenseApplicationCodeId) return cachedExpenseApplicationCodeId;
  const { data, error } = await supabase
    .from('application_codes')
    .select('id')
    .eq('code', 'EXP')
    .maybeSingle();
  if (error) {
    console.warn('[fax-ocr-intake] Failed to load EXP application code id', error);
    return null;
  }
  if (!data?.id) {
    console.warn('[fax-ocr-intake] EXP application code not found');
    return null;
  }
  cachedExpenseApplicationCodeId = data.id;
  return data.id;
};

const maybeCreateExpenseDraftFromOcr = async (
  docTypeKey: NonNullable<FaxOcrPayload['docType']>,
  intake: Record<string, any>,
  parsedJson: Record<string, any> | null,
) => {
  if (!supabase) return;
  const treatAsVendorInvoice =
    docTypeKey === 'vendor_invoice' || (docTypeKey === 'unknown' && looksLikeVendorInvoice(parsedJson));
  if (!treatAsVendorInvoice) return;
  if (!parsedJson || typeof parsedJson !== 'object') return;
  if (!intake?.uploaded_by) return;

  let rawExpenseDraft = parsedJson.expenseDraft;
  if (!rawExpenseDraft || typeof rawExpenseDraft !== 'object') {
    rawExpenseDraft = buildFallbackExpenseDraft(parsedJson) ?? undefined;
  }
  if (!rawExpenseDraft || typeof rawExpenseDraft !== 'object') return;

  const applicationCodeId = await getExpenseApplicationCodeId();
  if (!applicationCodeId) return;

  try {
    const { invoice, totals } = buildExpenseInvoiceDraft(rawExpenseDraft as Record<string, any>, parsedJson);
    const nowIso = new Date().toISOString();
    const notesBase = toOptionalString(rawExpenseDraft.notes) ?? '';
    const intakeLabel = toOptionalString(intake.file_name) ?? toOptionalString(intake.file_path) ?? intake.id;
    const autoNote = `FAX自動取込ドラフト: ${intakeLabel}`;
    const formData = {
      departmentId: '',
      approvalRouteId: '',
      invoiceDrafts: [invoice],
      selectedInvoiceId: invoice.id,
      invoice,
      mqAlerts: [],
      computedTotals: totals,
      notes: notesBase ? `${notesBase}\n${autoNote}` : autoNote,
      sourceFaxIntakeId: intake.id,
    };

    const { error } = await supabase
      .from('application_drafts')
      .upsert(
        {
          application_code_id: applicationCodeId,
          applicant_id: intake.uploaded_by,
          form_data: formData,
          approval_route_id: null,
          created_at: nowIso,
          updated_at: nowIso,
        },
        { onConflict: 'application_code_id,applicant_id' },
      )
      .select('id')
      .single();

    if (error) {
      throw error;
    }
    console.log('[fax-ocr-intake] Expense draft upserted for applicant', intake.uploaded_by);
  } catch (draftError) {
    console.warn('[fax-ocr-intake] Failed to create expense reimbursement draft', draftError);
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return respondWithCors('ok');
  }

  if (req.method !== 'POST') {
    return respondWithCors('Method Not Allowed', { status: 405 });
  }

  let payload: FaxOcrPayload;
  try {
    payload = await req.json();
  } catch {
    return respondWithCors('Invalid JSON payload', { status: 400 });
  }

  if (!payload?.intakeId || !payload.filePath) {
    return respondWithCors('Missing intakeId or filePath', { status: 400 });
  }

  if (!supabase || !API_KEY || !ai) {
    await updateFaxIntakeStatus(payload.intakeId, {
      ocr_status: 'failed',
      ocr_error_message: 'OCR backend is not configured properly.',
    });
    return respondWithCors('Server configuration error', { status: 500 });
  }

  try {
    const client = supabase;

    const { data: intake, error: fetchError } = await client
      .from('fax_intakes')
      .select('*')
      .eq('id', payload.intakeId)
      .single();

    if (fetchError || !intake) {
      return respondWithCors('fax_intakes record not found', { status: 404 });
    }

    await updateFaxIntakeStatus(payload.intakeId, {
      ocr_status: 'processing',
      ocr_error_message: null,
    });

    const { data: fileData, error: storageError } = await client.storage
      .from(FAX_BUCKET)
      .download(payload.filePath);

    if (storageError || !fileData) {
      throw new Error('Failed to download source file from storage.');
    }

    const base64Data = await toBase64(fileData);
    const mimeType: string = intake.file_mime_type || guessMimeType(payload.filePath);
    const docTypeKey = (payload.docType ?? intake.doc_type ?? 'unknown') as NonNullable<FaxOcrPayload['docType']>;
    const docTypeLabel = docTypeLabels[docTypeKey] ?? '資料';
    const promptText = docTypeKey === 'vendor_invoice'
      ? '添付された外注先からの請求書をOCRし、経費精算フォームと同じ構造（expenseDraft）でJSONを出力してください。サプライヤー名、請求日、支払期日、税抜/税込金額、銀行口座、明細行（品名・数量・単価・税率）を必ず含めてください。'
      : `添付されたFAX資料（想定種別: ${docTypeLabel}）から、請求書/受注/見積に関連する情報をJSONで抽出してください。金額、顧客名、案件番号が含まれる場合は必ず出力してください。`;

    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType } },
          { text: promptText },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: extractInvoiceSchema,
      },
    });

    const rawText = response.text?.trim() ?? '';
    if (!rawText) {
      throw new Error('Gemini OCR returned an empty response.');
    }

    let parsedJson: Record<string, unknown> | null = null;
    try {
      parsedJson = JSON.parse(rawText);
    } catch (jsonError) {
      console.warn('[fax-ocr-intake] Failed to parse Gemini JSON', jsonError);
    }

    if (parsedJson && typeof parsedJson === 'object') {
      await enrichInvoiceJsonWithMatches(parsedJson as Record<string, any>);
    }

    await updateFaxIntakeStatus(payload.intakeId, {
      ocr_status: 'done',
      ocr_json: parsedJson,
      ocr_raw_text: rawText,
      ocr_error_message: null,
    });
    await maybeCreateExpenseDraftFromOcr(docTypeKey, intake, parsedJson);

    return respondWithCors(JSON.stringify({ status: 'ok' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[fax-ocr-intake] Error while processing OCR', error);
    const message = error instanceof Error ? error.message : 'Unexpected fax OCR error';
    await updateFaxIntakeStatus(payload.intakeId, {
      ocr_status: 'failed',
      ocr_error_message: message,
    });
    return respondWithCors(message, { status: 500 });
  }
});
