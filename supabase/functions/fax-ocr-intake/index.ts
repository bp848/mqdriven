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

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let payload: FaxOcrPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response('Invalid JSON payload', { status: 400 });
  }

  if (!payload?.intakeId || !payload.filePath) {
    return new Response('Missing intakeId or filePath', { status: 400 });
  }

  if (!supabase || !API_KEY || !ai) {
    await updateFaxIntakeStatus(payload.intakeId, {
      ocr_status: 'failed',
      ocr_error_message: 'OCR backend is not configured properly.',
    });
    return new Response('Server configuration error', { status: 500 });
  }

  try {
    const client = supabase;

    const { data: intake, error: fetchError } = await client
      .from('fax_intakes')
      .select('*')
      .eq('id', payload.intakeId)
      .single();

    if (fetchError || !intake) {
      return new Response('fax_intakes record not found', { status: 404 });
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

    return new Response(JSON.stringify({ status: 'ok' }), {
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
    return new Response(message, { status: 500 });
  }
});
