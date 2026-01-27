import { PrintSpec, EstimationResult } from '../types';
import { getSupabase } from './supabaseClient';

const jsonHeaders = { 'Content-Type': 'application/json' };

export interface AiCustomer {
  id: string;
  name: string;
  code: string | null;
  representative: string | null;
  phoneNumber: string | null;
  address: string | null;
  createdAt: string | null;
}

export interface AiCategory {
  id: string;
  name: string;
  description: string | null;
  factoryArea: string | null;
}

export const fetchAiCustomers = async (): Promise<AiCustomer[]> => {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('customers')
    .select('id, customer_code, customer_name, representative, phone_number, address_1, created_at')
    .order('customer_name', { ascending: true })
    .limit(500);

  if (error) {
    console.error('fetchAiCustomers error:', error);
    throw new Error('顧客マスターの取得に失敗しました。');
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    name: row.customer_name || '名称未設定',
    code: row.customer_code || null,
    representative: row.representative || null,
    phoneNumber: row.phone_number || null,
    address: row.address_1 || null,
    createdAt: row.created_at || null,
  }));
};

export const fetchAiCategories = async (): Promise<AiCategory[]> => {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('ai_product_categories')
    .select('id, name, description, factory_area')
    .order('name', { ascending: true });

  if (error) {
    console.error('fetchAiCategories error:', error);
    throw new Error('カテゴリ情報の取得に失敗しました。');
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    name: row.name,
    description: row.description || null,
    factoryArea: row.factory_area || null,
  }));
};

export const createAiEstimate = async (params: {
  spec: PrintSpec;
  customerId: string;
  categoryId: string;
}): Promise<EstimationResult> => {
  const response = await fetch('/api/v1/ai-estimates', {
    method: 'POST',
    headers: {
      ...jsonHeaders,
    },
    body: JSON.stringify({
      spec: params.spec,
      customerId: params.customerId,
      categoryId: params.categoryId,
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message =
      body?.error ||
      body?.message ||
      'AI見積もりの生成に失敗しました。サーバー設定を確認してください。';
    throw new Error(message);
  }

  const data = await response.json();
  return data as EstimationResult;
};

export const listAiEstimates = async () => {
  const response = await fetch('/api/v1/ai-estimates');
  if (!response.ok) {
    throw new Error('AI見積一覧の取得に失敗しました。');
  }
  return response.json();
};

export const storeDeepWikiDocument = async (payload: {
  customerId?: string;
  title?: string;
  content?: string;
  snippet?: string;
  source?: string;
  metadata?: Record<string, unknown>;
}) => {
  const response = await fetch('/api/v1/ai/deep-wiki', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error('DeepWikiストレージへの保存に失敗しました。');
  }
  return response.json();
};

export const syncMemoryEntity = async (payload: {
  id?: string;
  name: string;
  entityType: string;
  observations: string[];
  customerId?: string;
  source?: string;
}) => {
  const response = await fetch('/api/v1/ai/memory', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error('Memory同期に失敗しました。');
  }
  return response.json();
};

export const captureTrainingCorpus = async (payload: {
  datasetName?: string;
  entryType?: string;
  payload: Record<string, unknown>;
  tags?: string[];
  provenance?: Record<string, unknown>;
}) => {
  const response = await fetch('/api/v1/ai/training-corpus', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error('学習コーパスの保存に失敗しました。');
  }
  return response.json();
};
