import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';
import { GoogleGenAI, Type } from 'npm:@google/genai';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type FaxOcrPayload = {
  intakeId: string;
  filePath: string;
  docType?: 'order' | 'estimate' | 'unknown';
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

const extractInvoiceSchema = {
  type: Type.OBJECT,
  properties: {
    vendorName: { type: Type.STRING, description: '請求書の発行元企業名。' },
    invoiceDate: { type: Type.STRING, description: '請求書の発行日 (YYYY-MM-DD形式)。' },
    totalAmount: { type: Type.NUMBER, description: '請求書の合計金額（税込）。' },
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
    const docTypeLabel = payload.docType ?? intake.doc_type ?? 'unknown';

    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType } },
          {
            text: `添付されたFAX資料（想定種別: ${docTypeLabel}）から、請求書/受注/見積に関連する情報をJSONで抽出してください。金額、顧客名、案件番号が含まれる場合は必ず出力してください。`,
          },
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
