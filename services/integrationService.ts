import { PrintSpec, EstimationResult } from '../types';

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
  const response = await fetch('/api/v1/customers');
  if (!response.ok) {
    throw new Error('顧客マスターの取得に失敗しました。');
  }
  const payload = await response.json();
  return payload.customers || [];
};

export const fetchAiCategories = async (): Promise<AiCategory[]> => {
  const response = await fetch('/api/v1/categories');
  if (!response.ok) {
    throw new Error('カテゴリ情報の取得に失敗しました。');
  }
  const payload = await response.json();
  return payload.categories || [];
};

export const createAiEstimate = async (params: {
  spec: PrintSpec;
  customerId: string;
  categoryId: string;
}): Promise<EstimationResult> => {
  const response = await fetch('/api/v1/ai-estimates', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({
      spec: params.spec,
      customerId: params.customerId,
      categoryId: params.categoryId,
    }),
  });
  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    const message = errorPayload?.error || 'AI見積生成エラーが発生しました。';
    throw new Error(message);
  }
  return response.json();
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
