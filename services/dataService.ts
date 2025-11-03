import { normalizeFormCode } from "./normalizeFormCode";
import { v4 as uuidv4 } from 'uuid';
import type { PostgrestError, User as SupabaseAuthUser } from '@supabase/supabase-js';
import { createDemoDataState, DemoDataState } from './demoData.ts';
import { getSupabase, hasSupabaseCredentials } from './supabaseClient.ts';
import {
  EmployeeUser,
  Job,
  Customer,
  JournalEntry,
  User,
  AccountItem,
  Lead,
  AllocationDivision,
  AnalysisHistory,
  Application,
  ApplicationCode,
  ApplicationWithDetails,
  ApprovalRoute,
  BugReport,
  BugReportStatus,
  Department,
  Employee,
  Estimate,
  EstimateLineItem,
  EstimateStatus,
  InboxItem,
  InboxItemStatus,
  InventoryItem,
  Invoice,
  InvoiceData,
  InvoiceItem,
  InvoiceStatus,
  JobStatus,
  LeadStatus,
  MailOpenStatus,
  ManufacturingStatus,
  MasterAccountItem,
  PaymentRecipient,
  PostalInfo,
  PostalStatus,
  Project,
  ProjectAttachment,
  ProjectStatus,
  PurchaseOrder,
  PurchaseOrderStatus,
  Title,
  Toast,
  TrackingInfo,
  UUID,
  ConfirmationDialogProps,
} from '../types.ts';

type MinimalAuthUser = Pick<SupabaseAuthUser, 'id'> & {
  email?: string | null;
  user_metadata?: { [key: string]: any; full_name?: string | null } | null;
};

const DEMO_AUTH_USER: MinimalAuthUser = {
  id: 'demo-user',
  email: 'demo.user@mqprint.co.jp',
  user_metadata: { full_name: 'デモユーザー' },
};

export const createDemoAuthUser = (): MinimalAuthUser => ({
  ...DEMO_AUTH_USER,
  user_metadata: DEMO_AUTH_USER.user_metadata
    ? { ...DEMO_AUTH_USER.user_metadata }
    : undefined,
});

const demoState: DemoDataState = createDemoDataState();

type SupabaseUserRow = {
  id: string;
  name: string | null;
  email: string | null;
  role: 'admin' | 'user' | null;
  created_at: string;
  can_use_anything_analysis: boolean | null;
};

type SupabaseEmployeeRow = {
  id: string;
  user_id: string | null;
  name: string | null;
  department: string | null;
  title: string | null;
  created_at: string;
};

type SupabaseEmployeeViewRow = {
  user_id: string;
  name: string | null;
  department: string | null;
  title: string | null;
  email: string | null;
  role: 'admin' | 'user' | null;
  can_use_anything_analysis: boolean | null;
  created_at: string | null;
};

const SUPABASE_VIEW_COLUMNS = 'user_id, name, department, title, email, role, can_use_anything_analysis, created_at';

let hasLoggedMissingEmployeeViewWarning = false;
let hasLoggedMissingSupabaseUserTableWarning = false;

const mapViewRowToEmployeeUser = (row: SupabaseEmployeeViewRow): EmployeeUser => ({
  id: row.user_id,
  name: row.name ?? '',
  department: row.department,
  title: row.title,
  email: row.email ?? '',
  role: row.role === 'admin' ? 'admin' : 'user',
  createdAt: row.created_at ?? new Date().toISOString(),
  canUseAnythingAnalysis: row.can_use_anything_analysis ?? true,
});

type SupabaseAccountItemRow = {
  id: string;
  code?: string | null;
  name?: string | null;
  category_code?: string | null;
  is_active?: boolean | null;
  sort_order?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  mq_code?: Record<string, string | null> | null;
  mq_code_p?: string | null;
  mq_code_v?: string | null;
  mq_code_m?: string | null;
  mq_code_q?: string | null;
  mq_code_f?: string | null;
  mq_code_g?: string | null;
};

type SupabaseDepartmentRow = {
  id: string;
  name?: string | null;
};

type SupabasePaymentRecipientRow = {
  id: string;
  recipient_code?: string | null;
  company_name?: string | null;
  recipient_name?: string | null;
  bank_name?: string | null;
  bank_branch?: string | null;
  bank_account_number?: string | null;
  is_active?: boolean | null;
  allocation_targets?: { id?: string | null; name?: string | null; target_id?: string | null; target_name?: string | null }[] | null;
};

type SupabaseAllocationDivisionRow = {
  id: string;
  name?: string | null;
  is_active?: boolean | null;
  created_at?: string | null;
};

const isRelationNotFoundError = (error?: PostgrestError | null): boolean => error?.code === '42P01';
const isColumnNotFoundError = (error?: PostgrestError | null): boolean => error?.code === '42703';

const toStringValue = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return fallback;
};

const isBlankString = (value: string | null | undefined): boolean => {
  if (typeof value !== 'string') {
    return true;
  }
  return value.trim() === '';
};

const MQ_CODE_KEYS = ['p', 'v', 'm', 'q', 'f', 'g'] as const;
type MqCodeKey = typeof MQ_CODE_KEYS[number];

const resolveMqCodeSegment = (row: SupabaseAccountItemRow, key: MqCodeKey): string | undefined => {
  const mqObject = typeof row.mq_code === 'object' && row.mq_code !== null ? row.mq_code : null;
  const uppercaseKey = key.toUpperCase();
  const candidates: unknown[] = [
    mqObject?.[key],
    mqObject?.[uppercaseKey],
    (row as Record<string, unknown>)[`mq_code_${key}`],
    (row as Record<string, unknown>)[`mq_code_${uppercaseKey}`],
    (row as Record<string, unknown>)[key],
    (row as Record<string, unknown>)[uppercaseKey],
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim() !== '') {
      return candidate;
    }
  }
  return undefined;
};

const mapSupabaseAccountItemRow = (row: SupabaseAccountItemRow): AccountItem => {
  const nowIso = new Date().toISOString();
  const mqCode = MQ_CODE_KEYS.reduce<Record<MqCodeKey, string>>((acc, key) => {
    acc[key] = toStringValue(resolveMqCodeSegment(row, key), '');
    return acc;
  }, { p: '', v: '', m: '', q: '', f: '', g: '' });

  return {
    id: row.id,
    code: toStringValue(row.code, ''),
    name: toStringValue(row.name, ''),
    categoryCode: toStringValue(row.category_code, ''),
    isActive: row.is_active ?? true,
    sortOrder: typeof row.sort_order === 'number' ? row.sort_order : 0,
    createdAt: toStringValue(row.created_at, nowIso),
    updatedAt: toStringValue(row.updated_at, row.created_at ?? nowIso),
    mqCode,
  };
};

const mapSupabaseDepartmentRow = (row: SupabaseDepartmentRow): Department | null => {
  const name = toStringValue(row.name, '').trim();
  if (!row.id || !name) {
    return null;
  }
  return { id: row.id, name };
};

const mapSupabasePaymentRecipientRow = (row: SupabasePaymentRecipientRow): PaymentRecipient => {
  const allocationTargetsRaw =
    (row.allocation_targets as unknown) ?? (row as Record<string, unknown>)['allocationTargets'];
  const allocationTargets: { id: string; name: string }[] = Array.isArray(allocationTargetsRaw)
    ? (allocationTargetsRaw as Array<Record<string, unknown>>)
        .map((target) => {
          if (!target) return null;
          const idCandidate = toStringValue(target.id ?? target.target_id ?? null, '').trim();
          const nameCandidate = toStringValue(target.name ?? target.target_name ?? null, '').trim();
          if (!idCandidate || !nameCandidate) {
            return null;
          }
          return { id: idCandidate, name: nameCandidate };
        })
        .filter((target): target is { id: string; name: string } => Boolean(target))
    : [];

  return {
    id: row.id,
    recipientCode: toStringValue(row.recipient_code, row.id),
    companyName: toStringValue(row.company_name, '') || null,
    recipientName: toStringValue(row.recipient_name, '') || null,
    bankName: toStringValue(row.bank_name, '') || null,
    bankBranch: toStringValue(row.bank_branch, '') || null,
    bankAccountNumber: toStringValue(row.bank_account_number, '') || null,
    isActive: row.is_active ?? true,
    allocationTargets,
  };
};

const mapSupabaseAllocationDivisionRow = (row: SupabaseAllocationDivisionRow): AllocationDivision => {
  const nowIso = new Date().toISOString();
  return {
    id: row.id,
    name: toStringValue(row.name, ''),
    isActive: row.is_active ?? true,
    createdAt: toStringValue(row.created_at, nowIso),
  };
};

const fetchAccountItemsFromSupabase = async (): Promise<AccountItem[] | null> => {
  const supabaseClient = getSupabase();
  const sources = ['v_account_items_with_mq_code', 'v_account_items', 'account_items'] as const;

  for (const table of sources) {
    const { data, error } = await supabaseClient
      .from<SupabaseAccountItemRow>(table)
      .select('*');

    if (error) {
      if (isRelationNotFoundError(error) || isColumnNotFoundError(error)) {
        continue;
      }
      throw error;
    }

    if (!data) {
      continue;
    }

    const mapped = data.map(mapSupabaseAccountItemRow);
    const demoAccountItemMap = new Map(demoState.accountItems.map(item => [item.code, item]));
    mapped.forEach(item => {
      const fallback = demoAccountItemMap.get(item.code);
      if (!fallback) {
        return;
      }
      if (isBlankString(item.categoryCode) && !isBlankString(fallback.categoryCode)) {
        item.categoryCode = fallback.categoryCode;
      }
      if (isBlankString(item.createdAt) && !isBlankString(fallback.createdAt)) {
        item.createdAt = fallback.createdAt;
      }
      if (isBlankString(item.updatedAt) && !isBlankString(fallback.updatedAt)) {
        item.updatedAt = fallback.updatedAt;
      }
      if ((item.sortOrder === 0 || typeof item.sortOrder !== 'number') && typeof fallback.sortOrder === 'number' && fallback.sortOrder !== 0) {
        item.sortOrder = fallback.sortOrder;
      }
      MQ_CODE_KEYS.forEach(key => {
        if (isBlankString(item.mqCode[key]) && fallback.mqCode?.[key]) {
          item.mqCode[key] = fallback.mqCode[key];
        }
      });
    });
    mapped.sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder;
      }
      return a.code.localeCompare(b.code, 'ja');
    });
    return mapped;
  }

  return null;
};

const fetchDepartmentsFromSupabase = async (): Promise<Department[] | null> => {
  const supabaseClient = getSupabase();
  const sources = [
    { table: 'v_departments', select: 'id, name' },
    { table: 'departments', select: 'id, name' },
  ] as const;

  for (const source of sources) {
    const { data, error } = await supabaseClient
      .from<SupabaseDepartmentRow>(source.table)
      .select(source.select);

    if (error) {
      if (isRelationNotFoundError(error) || isColumnNotFoundError(error)) {
        continue;
      }
      throw error;
    }

    if (!data) {
      continue;
    }

    const mapped = data
      .map(mapSupabaseDepartmentRow)
      .filter((dept): dept is Department => dept !== null);

    mapped.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
    return mapped;
  }

  return null;
};

const fetchPaymentRecipientsFromSupabase = async (): Promise<PaymentRecipient[] | null> => {
  const supabaseClient = getSupabase();
  const selects = [
    'id, recipient_code, company_name, recipient_name, bank_name, bank_branch, bank_account_number, is_active, allocation_targets:payment_recipient_allocation_targets(id, name)',
    'id, recipient_code, company_name, recipient_name, bank_name, bank_branch, bank_account_number, is_active',
    '*',
  ] as const;

  for (const select of selects) {
    const { data, error } = await supabaseClient
      .from<SupabasePaymentRecipientRow>('payment_recipients')
      .select(select);

    if (error) {
      if (isRelationNotFoundError(error) || isColumnNotFoundError(error)) {
        continue;
      }
      throw error;
    }

    if (!data) {
      continue;
    }

    const mapped = data.map(mapSupabasePaymentRecipientRow);
    mapped.sort((a, b) => {
      const aLabel = `${a.companyName ?? ''}${a.recipientName ?? ''}`;
      const bLabel = `${b.companyName ?? ''}${b.recipientName ?? ''}`;
      return aLabel.localeCompare(bLabel, 'ja');
    });
    return mapped;
  }

  return null;
};

const fetchAllocationDivisionsFromSupabase = async (): Promise<AllocationDivision[] | null> => {
  const supabaseClient = getSupabase();
  const sources = [
    { table: 'allocation_divisions', select: 'id, name, is_active, created_at' },
    { table: 'v_allocation_divisions', select: 'id, name, is_active, created_at' },
  ] as const;

  for (const source of sources) {
    const { data, error } = await supabaseClient
      .from<SupabaseAllocationDivisionRow>(source.table)
      .select(source.select);

    if (error) {
      if (isRelationNotFoundError(error) || isColumnNotFoundError(error)) {
        continue;
      }
      throw error;
    }

    if (!data) {
      continue;
    }

    const mapped = data.map(mapSupabaseAllocationDivisionRow);
    mapped.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
    return mapped;
  }

  return null;
};

const isUniqueViolation = (error?: PostgrestError | null): boolean => error?.code === '23505';

const fetchSupabaseEmployeeUser = async (userId: string): Promise<EmployeeUser | null> => {
  if (!hasSupabaseCredentials()) {
    return null;
  }

  try {
    const supabaseClient = getSupabase();

    const { data, error } = await supabaseClient
      .from<SupabaseEmployeeViewRow>('v_employees_active')
      .select(SUPABASE_VIEW_COLUMNS)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      if (isRelationNotFoundError(error) || isColumnNotFoundError(error)) {
        if (!hasLoggedMissingEmployeeViewWarning && typeof console !== 'undefined') {
          console.warn(
            'Supabase view "v_employees_active" が見つからないため、セッションユーザー情報の取得をスキップします。',
            error
          );
          hasLoggedMissingEmployeeViewWarning = true;
        }
        return null;
      }
      throw error;
    }

    return data ? mapViewRowToEmployeeUser(data) : null;
  } catch (error) {
    if (isRelationNotFoundError(error as PostgrestError) || isColumnNotFoundError(error as PostgrestError)) {
      if (!hasLoggedMissingEmployeeViewWarning && typeof console !== 'undefined') {
        console.warn(
          'Supabase の従業員ビューが利用できないため、セッションユーザー情報を Supabase から取得できません。',
          error
        );
        hasLoggedMissingEmployeeViewWarning = true;
      }
      return null;
    }
    throw error;
  }
};

const ensureSupabaseEmployeeUser = async (
  authUser: MinimalAuthUser,
  fallbackEmail: string
): Promise<EmployeeUser | null> => {
  if (!hasSupabaseCredentials()) {
    throw new Error('Supabaseの認証情報が設定されていません。');
  }

  const supabaseClient = getSupabase();

  const displayName =
    authUser.user_metadata?.full_name?.trim() ||
    authUser.user_metadata?.name?.trim?.() ||
    fallbackEmail ||
    'ゲストユーザー';

  try {
    const { data: userRow, error: userError } = await supabaseClient
      .from<SupabaseUserRow>('users')
      .select('id, name, email, role, can_use_anything_analysis, created_at')
      .eq('id', authUser.id)
      .maybeSingle();

    if (userError) {
      throw userError;
    }

    let ensuredUser = userRow;

    if (!ensuredUser) {
      const { data: insertedUser, error: insertError } = await supabaseClient
        .from<SupabaseUserRow>('users')
        .insert({
          id: authUser.id,
          name: displayName,
          email: fallbackEmail || null,
          role: 'user',
          can_use_anything_analysis: true,
        })
        .select('id, name, email, role, can_use_anything_analysis, created_at')
        .maybeSingle();

      if (insertError && !isUniqueViolation(insertError)) {
        throw insertError;
      }

      ensuredUser = insertedUser ?? userRow ?? null;
    }

    const { data: employeeRow, error: employeeError } = await supabaseClient
      .from<SupabaseEmployeeRow>('employees')
      .select('id, user_id, name, department, title, created_at')
      .eq('user_id', authUser.id)
      .maybeSingle();

    if (employeeError && !isUniqueViolation(employeeError)) {
      throw employeeError;
    }

    if (!employeeRow) {
      const today = new Date().toISOString().slice(0, 10);
      const { error: insertEmployeeError } = await supabaseClient
        .from('employees')
        .insert({
          user_id: authUser.id,
          name: displayName,
          department: null,
          title: null,
          hire_date: today,
          salary: 0,
        });

      if (insertEmployeeError && !isUniqueViolation(insertEmployeeError)) {
        throw insertEmployeeError;
      }
    }

    const viewUser = await fetchSupabaseEmployeeUser(authUser.id);
    if (viewUser) {
      return viewUser;
    }

    if (ensuredUser) {
      return {
        id: ensuredUser.id,
        name: ensuredUser.name ?? displayName,
        department: employeeRow?.department ?? null,
        title: employeeRow?.title ?? null,
        email: ensuredUser.email ?? fallbackEmail ?? '',
        role: ensuredUser.role === 'admin' ? 'admin' : 'user',
        createdAt: employeeRow?.created_at ?? ensuredUser.created_at ?? new Date().toISOString(),
        canUseAnythingAnalysis: ensuredUser.can_use_anything_analysis ?? true,
      };
    }
  } catch (error) {
    if (isRelationNotFoundError(error as PostgrestError) || isColumnNotFoundError(error as PostgrestError)) {
      if (!hasLoggedMissingSupabaseUserTableWarning && typeof console !== 'undefined') {
        console.warn(
          'Supabase の users / employees テーブルまたはビューが見つかりません。暫定的に認証ユーザーの情報をメタデータから生成します。セットアップスクリプトの実行をご確認ください。',
          error
        );
        hasLoggedMissingSupabaseUserTableWarning = true;
      }
      return {
        id: authUser.id,
        name: displayName,
        department: null,
        title: null,
        email: fallbackEmail ?? '',
        role: 'user',
        createdAt: new Date().toISOString(),
        canUseAnythingAnalysis: true,
      };
    }
    if (isSupabaseUnavailableError(error)) {
      const wrappedError = new Error('Supabaseへの接続に失敗しました。ネットワークまたはSupabaseの設定を確認してください。');
      (wrappedError as any).cause = error;
      throw wrappedError;
    }
    throw error;
  }

  return null;
};

let projects: Project[] = [
  {
    id: uuidv4(),
    projectName: '秋季キャンペーンプロジェクト',
    customerName: '株式会社ネオプリント',
    customerId: demoState.customers[0]?.id,
    status: ProjectStatus.InProgress,
    overview: '秋季キャンペーン向け販促物一式の制作と配送を行うプロジェクトです。',
    extracted_details: '主要 deliverables: チラシ、ポスター、SNSバナー。スケジュールは10月末まで。',
    createdAt: '2025-09-20T08:00:00Z',
    updatedAt: '2025-10-01T09:00:00Z',
    userId: demoState.employeeUsers[0]?.id || 'user-001',
    attachments: [],
    relatedEstimates: demoState.estimates.filter(
      (est) => est.customerName === '株式会社ネオプリント'
    ),
    relatedJobs: demoState.jobs.filter((job) => job.clientName === '株式会社ネオプリント'),
    isActive: true,
  },
  {
    id: uuidv4(),
    projectName: '新製品カタログ刷新',
    customerName: '株式会社リンクス',
    customerId: demoState.customers[2]?.id,
    status: ProjectStatus.New,
    overview: '2026年度版カタログの刷新に向けたコンテンツ整理とデザイン制作。',
    extracted_details: '最新製品ラインナップの取材、撮影、デザイン制作。納品予定は11月下旬。',
    createdAt: '2025-10-10T03:30:00Z',
    updatedAt: '2025-10-10T03:30:00Z',
    userId: demoState.employeeUsers[1]?.id || 'user-002',
    attachments: [],
    relatedEstimates: [],
    relatedJobs: [],
    isActive: true,
  },
];
let allocationDivisions: AllocationDivision[] = [
    { id: 'alloc-1', name: '営業部配賦', isActive: true, createdAt: '2024-01-05T00:00:00Z' },
    { id: 'alloc-2', name: '製造部配賦', isActive: true, createdAt: '2024-01-05T00:00:00Z' },
];
let titles: Title[] = [
    { id: 'title-1', name: '部長', isActive: true, createdAt: '2024-01-01T00:00:00Z' },
    { id: 'title-2', name: '課長', isActive: true, createdAt: '2024-01-01T00:00:00Z' },
    { id: 'title-3', name: '主任', isActive: true, createdAt: '2024-01-01T00:00:00Z' },
];
let analysisHistory: AnalysisHistory[] = [];
let nextEstimateNumber = Math.max(0, ...demoState.estimates.map(est => est.estimateNumber)) + 1;


const deepClone = <T>(value: T): T => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
};

const findById = <T extends { id: string }>(
  collection: T[],
  id: string,
  entityName: string
): T => {
  const item = collection.find((it) => it.id === id);
  if (!item) {
    throw new Error(`${entityName} with ID ${id} not found`);
  }
  return item;
};

function calculateEstimateTotals(items: EstimateLineItem[], taxInclusive: boolean) {
  let subtotal = 0;
  let taxTotal = 0;
  const normalized = items.map((it) => {
    const rowSubtotal = it.qty * it.unitPrice;
    const rate = it.taxRate ?? 0.1;
    const rowTax = taxInclusive ? Math.round(rowSubtotal - rowSubtotal / (1 + rate)) : Math.round(rowSubtotal * rate);
    const rowTotal = taxInclusive ? rowSubtotal : rowSubtotal + rowTax;
    subtotal += rowSubtotal;
    taxTotal += rowTax;
    return {
      ...it,
      subtotal: Math.round(rowSubtotal),
      taxAmount: rowTax,
      total: rowTotal,
    };
  });
  const grandTotal = taxInclusive ? Math.round(subtotal) : Math.round(subtotal + taxTotal);
  return { items: normalized, subtotal: Math.round(subtotal), taxTotal, grandTotal };
}

const mapApplicationDetails = (app: Application): ApplicationWithDetails => ({
    ...app,
    applicant: demoState.employeeUsers.find(u => u.id === app.applicantId),
    applicationCode: demoState.applicationCodes.find(code => code.id === app.applicationCodeId),
    approvalRoute: demoState.approvalRoutes.find(route => route.id === app.approvalRouteId),
});


export const isSupabaseUnavailableError = (error: any): boolean => {
  if (!error) return false;
  const message = typeof error === 'string' ? error : error.message || error.details || error.error_description;
  if (!message) return false;
  return /fetch failed/i.test(message) || /failed to fetch/i.test(message) || /network/i.test(message);
};

export const resolveUserSession = async (authUser: MinimalAuthUser): Promise<EmployeeUser> => {
  const fallbackEmail = authUser.email ?? '';

  if (!hasSupabaseCredentials()) {
    throw new Error('Supabaseの認証情報が設定されていません。');
  }

  const supabaseUser = await ensureSupabaseEmployeeUser(authUser, fallbackEmail);
  if (supabaseUser) {
    return supabaseUser;
  }

  throw new Error('Supabase上にユーザー情報が見つかりません。管理者にお問い合わせください。');
};

export const getUsers = async (): Promise<EmployeeUser[]> => {
  if (hasSupabaseCredentials()) {
    try {
      const supabaseClient = getSupabase();

      const { data, error } = await supabaseClient
        .from<SupabaseEmployeeViewRow>('v_employees_active')
        .select(SUPABASE_VIEW_COLUMNS)
        .order('name', { ascending: true });

      if (error) {
        if (isRelationNotFoundError(error) || isColumnNotFoundError(error)) {
          if (!hasLoggedMissingEmployeeViewWarning && typeof console !== 'undefined') {
            console.warn(
              'Supabase view "v_employees_active" が見つかりません。デモデータにフォールバックします。Supabase に付属のセットアップスクリプトを実行してください。',
              error
            );
            hasLoggedMissingEmployeeViewWarning = true;
          }
          return deepClone(demoState.employeeUsers);
        }
        throw error;
      }

      if (data) {
        return data.map(mapViewRowToEmployeeUser);
      }
    } catch (error) {
      if (isRelationNotFoundError(error as PostgrestError) || isColumnNotFoundError(error as PostgrestError)) {
        if (!hasLoggedMissingEmployeeViewWarning && typeof console !== 'undefined') {
          console.warn(
            'Supabase の従業員ビューが存在しないため、ユーザー一覧をデモデータで代用します。',
            error
          );
          hasLoggedMissingEmployeeViewWarning = true;
        }
        return deepClone(demoState.employeeUsers);
      }
      throw error;
    }
  }

  return deepClone(demoState.employeeUsers);
};

export const addUser = async (input: {
  name: string;
  email: string | null;
  role: 'admin' | 'user';
  canUseAnythingAnalysis?: boolean;
  department?: string | null;
  title?: string | null;
}): Promise<EmployeeUser> => {
  if (hasSupabaseCredentials()) {
    throw new Error('Supabase環境ではアプリからのユーザー新規追加はサポートされていません。Supabase Authから招待を行ってください。');
  }

  const now = new Date().toISOString();
  const newUser: EmployeeUser = {
    id: uuidv4(),
    name: input.name,
    email: input.email ?? '',
    role: input.role,
    department: input.department ?? null,
    title: input.title ?? null,
    createdAt: now,
    canUseAnythingAnalysis: input.canUseAnythingAnalysis ?? true,
  };

  demoState.employeeUsers.push(newUser);
  demoState.employees.push({
    id: uuidv4(),
    name: newUser.name,
    department: newUser.department ?? '',
    title: newUser.title ?? '',
    hireDate: now,
    salary: 0,
    createdAt: now,
  });

  return deepClone(newUser);
};

export const updateUser = async (id: string, updates: Partial<EmployeeUser>): Promise<EmployeeUser> => {
  if (hasSupabaseCredentials()) {
    const supabaseClient = getSupabase();
    const userUpdates: Partial<SupabaseUserRow> = {};
    if (Object.prototype.hasOwnProperty.call(updates, 'name')) {
      userUpdates.name = updates.name ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'email')) {
      userUpdates.email = updates.email ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'role') && updates.role) {
      userUpdates.role = updates.role;
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'canUseAnythingAnalysis')) {
      userUpdates.can_use_anything_analysis = updates.canUseAnythingAnalysis ?? null;
    }

    if (Object.keys(userUpdates).length > 0) {
      const { error: userError } = await supabaseClient
        .from('users')
        .update(userUpdates)
        .eq('id', id);

      if (userError) {
        throw userError;
      }
    }

    const employeeUpdates: Partial<SupabaseEmployeeRow> = {};
    if (Object.prototype.hasOwnProperty.call(updates, 'name')) {
      employeeUpdates.name = updates.name ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'department')) {
      employeeUpdates.department = updates.department ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'title')) {
      employeeUpdates.title = updates.title ?? null;
    }

    if (Object.keys(employeeUpdates).length > 0) {
      const { data: employeeRow, error: employeeSelectError } = await supabaseClient
        .from<SupabaseEmployeeRow>('employees')
        .select('id')
        .eq('user_id', id)
        .maybeSingle();

      if (employeeSelectError && !isSupabaseUnavailableError(employeeSelectError)) {
        throw employeeSelectError;
      }

      if (employeeRow) {
        const { error: employeeUpdateError } = await supabaseClient
          .from('employees')
          .update(employeeUpdates)
          .eq('id', employeeRow.id);

        if (employeeUpdateError) {
          throw employeeUpdateError;
        }
      } else {
        const { error: employeeInsertError } = await supabaseClient
          .from('employees')
          .insert({ user_id: id, ...employeeUpdates });

        if (employeeInsertError && !isUniqueViolation(employeeInsertError)) {
          throw employeeInsertError;
        }
      }
    }

    const refreshed = await fetchSupabaseEmployeeUser(id);
    if (!refreshed) {
      throw new Error('ユーザー情報の再取得に失敗しました。');
    }
    return refreshed;
  }

  const target = findById(demoState.employeeUsers, id, 'ユーザー');
  Object.assign(target, updates);

  const employee = demoState.employees.find(emp => emp.name === target.name);
  if (employee) {
    employee.department = updates.department ?? employee.department;
    employee.title = updates.title ?? employee.title;
  }
  return deepClone(target);
};

export const deleteUser = async (id: string): Promise<void> => {
  if (hasSupabaseCredentials()) {
    const supabaseClient = getSupabase();
    const { error: employeeError } = await supabaseClient
      .from('employees')
      .update({ active: false })
      .eq('user_id', id);

    if (employeeError) {
      throw employeeError;
    }

    return;
  }

  const removed = demoState.employeeUsers.find(user => user.id === id);
  demoState.employeeUsers = demoState.employeeUsers.filter(user => user.id !== id);
  if (removed) {
    demoState.employees = demoState.employees.filter(emp => emp.name !== removed.name);
  }
};

export const getJobs = async (): Promise<Job[]> => deepClone(demoState.jobs);

export const addJob = async (job: Partial<Job>): Promise<Job> => {
  const now = new Date().toISOString();
  const newJob: Job = {
    id: uuidv4(),
    jobNumber: job.jobNumber ?? Math.floor(Math.random() * 100000),
    clientName: job.clientName ?? '新規顧客',
    title: job.title ?? '新規案件',
    status: job.status ?? demoState.jobs[0]?.status ?? JobStatus.Pending,
    dueDate: job.dueDate ?? now.substring(0, 10),
    quantity: job.quantity ?? 1,
    paperType: job.paperType ?? '',
    finishing: job.finishing ?? '',
    details: job.details ?? '',
    createdAt: now,
    price: job.price ?? 0,
    variableCost: job.variableCost ?? 0,
    invoiceStatus: job.invoiceStatus ?? InvoiceStatus.Uninvoiced,
    invoicedAt: job.invoicedAt ?? null,
    paidAt: job.paidAt ?? null,
    readyToInvoice: job.readyToInvoice ?? false,
    invoiceId: job.invoiceId ?? null,
    manufacturingStatus: job.manufacturingStatus,
    projectId: job.projectId,
    projectName: job.projectName,
    userId: job.userId,
  };
  demoState.jobs.push(newJob);
  return deepClone(newJob);
};

export const updateJob = async (id: string, updates: Partial<Job>): Promise<Job> => {
  const job = findById(demoState.jobs, id, '案件');
  Object.assign(job, updates);
  return deepClone(job);
};

export const deleteJob = async (id: string): Promise<void> => {
  demoState.jobs = demoState.jobs.filter(job => job.id !== id);
};

export const updateJobReadyToInvoice = async (id: string, ready: boolean): Promise<Job> => {
    const job = findById(demoState.jobs, id, '案件');
    job.readyToInvoice = ready;
    return deepClone(job);
};

export const createInvoiceFromJobs = async (jobIds: string[]): Promise<Invoice> => {
    if (jobIds.length === 0) {
      throw new Error('請求対象の案件が選択されていません。');
    }
    const jobs = jobIds.map(id => findById(demoState.jobs, id, '案件'));
    const customerName = jobs[0].clientName;
    if (!jobs.every(job => job.clientName === customerName)) {
      throw new Error('同じ顧客の案件のみまとめて請求できます。');
    }
    
    const subtotal = jobs.reduce((sum, job) => sum + (job.price ?? 0), 0);
    const taxAmount = Math.round(subtotal * 0.1);
    const totalAmount = subtotal + taxAmount;
    const now = new Date();
    const invoiceId = uuidv4();

    const items: InvoiceItem[] = jobs.map((job, index) => ({
        id: uuidv4(),
        invoiceId,
        jobId: job.id,
        description: job.title,
        quantity: 1,
        unit: '式',
        unitPrice: job.price ?? 0,
        lineTotal: job.price ?? 0,
        sortIndex: index,
    }));
    
    const invoice: Invoice = {
        id: invoiceId,
        invoiceNo: `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${now.getTime()}`,
        invoiceDate: now.toISOString().slice(0, 10),
        customerName,
        subtotalAmount: subtotal,
        taxAmount: taxAmount,
        totalAmount: totalAmount,
        status: 'issued',
        createdAt: now.toISOString(),
        items,
    };
    
    demoState.invoices.push(invoice);
    
    jobs.forEach(job => {
        job.invoiceStatus = InvoiceStatus.Invoiced;
        job.invoiceId = invoiceId;
        job.invoicedAt = now.toISOString();
        job.readyToInvoice = false;
    });

    return deepClone(invoice);
};

export const getCustomers = async (): Promise<Customer[]> => deepClone(demoState.customers);

export const addCustomer = async (customer: Partial<Customer>): Promise<Customer> => {
    const newCustomer: Customer = {
      id: uuidv4(),
      customerName: customer.customerName ?? '名称未設定',
      createdAt: customer.createdAt ?? new Date().toISOString(),
      representative: customer.representative,
      phoneNumber: customer.phoneNumber,
      address1: customer.address1,
      companyContent: customer.companyContent,
      annualSales: customer.annualSales,
      employeesCount: customer.employeesCount,
      note: customer.note,
      infoSalesActivity: customer.infoSalesActivity,
      infoRequirements: customer.infoRequirements,
      infoHistory: customer.infoHistory,
      postNo: customer.postNo,
      address2: customer.address2,
      fax: customer.fax,
      closingDay: customer.closingDay,
      monthlyPlan: customer.monthlyPlan,
      payDay: customer.payDay,
      recoveryMethod: customer.recoveryMethod,
      userId: customer.userId,
      name2: customer.name2,
      websiteUrl: customer.websiteUrl,
      zipCode: customer.zipCode,
      foundationDate: customer.foundationDate,
      capital: customer.capital,
      customerRank: customer.customerRank,
      customerDivision: customer.customerDivision,
      salesType: customer.salesType,
      creditLimit: customer.creditLimit,
      payMoney: customer.payMoney,
      bankName: customer.bankName,
      branchName: customer.branchName,
      accountNo: customer.accountNo,
      salesUserCode: customer.salesUserCode,
      startDate: customer.startDate,
      endDate: customer.endDate,
      drawingDate: customer.drawingDate,
      salesGoal: customer.salesGoal,
      infoSalesIdeas: customer.infoSalesIdeas,
      customerContactInfo: customer.customerContactInfo,
      aiAnalysis: customer.aiAnalysis ?? null,
    };
    demoState.customers.push(newCustomer);
    return deepClone(newCustomer);
};

export const updateCustomer = async (id: string, updates: Partial<Customer>): Promise<Customer> => {
    const customer = findById(demoState.customers, id, '顧客');
    Object.assign(customer, updates);
    return deepClone(customer);
};

export const getJournalEntries = async (): Promise<JournalEntry[]> => deepClone(demoState.journalEntries);

export const addJournalEntry = async (entry: Omit<JournalEntry, 'id'>): Promise<JournalEntry> => {
    const lastEntry = demoState.journalEntries[demoState.journalEntries.length - 1];
    const newEntry: JournalEntry = {
        ...entry,
        id: (lastEntry?.id ?? 0) + 1,
    };
    demoState.journalEntries.push(newEntry);
    return deepClone(newEntry);
};

export const getAccountItems = async (): Promise<AccountItem[]> => {
  if (hasSupabaseCredentials()) {
    const supabaseItems = await fetchAccountItemsFromSupabase();
    if (supabaseItems) {
      return supabaseItems;
    }
  }
  return deepClone(demoState.accountItems);
};

export const getActiveAccountItems = async (): Promise<AccountItem[]> => {
  const items = await getAccountItems();
  return items.filter(item => item.isActive);
};

export const saveAccountItem = async (item: Partial<AccountItem>): Promise<AccountItem> => {
    if (item.id) {
      const existing = findById(demoState.accountItems, item.id, '勘定科目');
      if (item.mqCode) {
        existing.mqCode = { ...existing.mqCode, ...item.mqCode };
      }
      Object.assign(existing, { ...item, mqCode: existing.mqCode, updatedAt: new Date().toISOString() });
      return deepClone(existing);
    }
    const now = new Date().toISOString();
    const newItem: AccountItem = {
      id: uuidv4(),
      code: item.code ?? `ACCT-${demoState.accountItems.length + 1}`,
      name: item.name ?? '新規勘定科目',
      categoryCode: item.categoryCode ?? '',
      isActive: item.isActive ?? true,
      sortOrder: item.sortOrder ?? demoState.accountItems.length,
      createdAt: now,
      updatedAt: now,
      mqCode: {
        p: item.mqCode?.p ?? '',
        v: item.mqCode?.v ?? '',
        m: item.mqCode?.m ?? '',
        q: item.mqCode?.q ?? '',
        f: item.mqCode?.f ?? '',
        g: item.mqCode?.g ?? '',
      },
    };
    demoState.accountItems.push(newItem);
    return deepClone(newItem);
};

export const deactivateAccountItem = async (id: string): Promise<AccountItem> => {
    const item = findById(demoState.accountItems, id, '勘定科目');
    item.isActive = false;
    item.updatedAt = new Date().toISOString();
    return deepClone(item);
};

export const getLeads = async (): Promise<Lead[]> => deepClone(demoState.leads);

export const addLead = async (lead: Partial<Lead>): Promise<Lead> => {
    const now = new Date().toISOString();
    const newLead: Lead = {
      id: uuidv4(),
      status: lead.status ?? LeadStatus.New,
      createdAt: now,
      name: lead.name ?? '無名',
      email: lead.email ?? '',
      phone: lead.phone ?? '',
      company: lead.company ?? '',
      source: lead.source ?? '',
      tags: lead.tags ?? [],
      message: lead.message ?? '',
      updatedAt: now,
      referrer: lead.referrer,
      referrerUrl: lead.referrerUrl,
      landingPageUrl: lead.landingPageUrl,
      searchKeywords: lead.searchKeywords,
      utmSource: lead.utmSource,
      utmMedium: lead.utmMedium,
      utmCampaign: lead.utmCampaign,
      utmTerm: lead.utmTerm,
      utmContent: lead.utmContent,
      userAgent: lead.userAgent,
      ipAddress: lead.ipAddress,
      deviceType: lead.deviceType,
      browserName: lead.browserName,
      osName: lead.osName,
      country: lead.country,
      city: lead.city,
      region: lead.region,
      employees: lead.employees,
      budget: lead.budget,
      timeline: lead.timeline,
      inquiryType: lead.inquiryType,
      inquiryTypes: lead.inquiryTypes,
      infoSalesActivity: lead.infoSalesActivity,
      score: lead.score,
      aiAnalysisReport: lead.aiAnalysisReport,
      aiDraftProposal: lead.aiDraftProposal,
      aiInvestigation: lead.aiInvestigation,
    };
    demoState.leads.push(newLead);
    return deepClone(newLead);
};

export const updateLead = async (id: string, updates: Partial<Lead>): Promise<Lead> => {
    const lead = findById(demoState.leads, id, 'リード');
    Object.assign(lead, updates, { updatedAt: new Date().toISOString() });
    return deepClone(lead);
};

export const deleteLead = async (id: string): Promise<void> => {
    demoState.leads = demoState.leads.filter(lead => lead.id !== id);
};

export const getApprovalRoutes = async (): Promise<ApprovalRoute[]> => deepClone(demoState.approvalRoutes);

export const addApprovalRoute = async (route: Omit<ApprovalRoute, 'id' | 'createdAt'>): Promise<ApprovalRoute> => {
    const newRoute: ApprovalRoute = {
      id: uuidv4(),
      name: route.name,
      routeData: deepClone(route.routeData),
      createdAt: new Date().toISOString(),
    };
    demoState.approvalRoutes.push(newRoute);
    return deepClone(newRoute);
};

export const updateApprovalRoute = async (id: string, updates: Partial<ApprovalRoute>): Promise<ApprovalRoute> => {
    const route = findById(demoState.approvalRoutes, id, '承認ルート');
    if (updates.routeData) {
      route.routeData = deepClone(updates.routeData);
    }
    if (updates.name) {
      route.name = updates.name;
    }
    return deepClone(route);
};

export const deleteApprovalRoute = async (id: string): Promise<void> => {
    demoState.approvalRoutes = demoState.approvalRoutes.filter(route => route.id !== id);
};

export const getPurchaseOrders = async (): Promise<PurchaseOrder[]> => deepClone(demoState.purchaseOrders);

export const addPurchaseOrder = async (order: Partial<PurchaseOrder>): Promise<PurchaseOrder> => {
    const newOrder: PurchaseOrder = {
      id: uuidv4(),
      supplierName: order.supplierName ?? '仕入先未設定',
      itemName: order.itemName ?? '品目未設定',
      orderDate: order.orderDate ?? new Date().toISOString().slice(0, 10),
      quantity: order.quantity ?? 0,
      unitPrice: order.unitPrice ?? 0,
      status: order.status ?? PurchaseOrderStatus.Ordered,
    };
    demoState.purchaseOrders.push(newOrder);
    return deepClone(newOrder);
};

export const getInventoryItems = async (): Promise<InventoryItem[]> => deepClone(demoState.inventoryItems);

export const addInventoryItem = async (item: Partial<InventoryItem>): Promise<InventoryItem> => {
    const newItem: InventoryItem = {
      id: uuidv4(),
      name: item.name ?? '新規資材',
      category: item.category ?? 'その他',
      quantity: item.quantity ?? 0,
      unit: item.unit ?? '個',
      unitPrice: item.unitPrice ?? 0,
    };
    demoState.inventoryItems.push(newItem);
    return deepClone(newItem);
};

export const updateInventoryItem = async (id: string, updates: Partial<InventoryItem>): Promise<InventoryItem> => {
    const item = findById(demoState.inventoryItems, id, '在庫品目');
    Object.assign(item, updates);
    return deepClone(item);
};

export const getEmployees = async (): Promise<Employee[]> => deepClone(demoState.employees);

export const getBugReports = async (): Promise<BugReport[]> => deepClone(demoState.bugReports);

export const addBugReport = async (report: Omit<BugReport, 'id' | 'createdAt' | 'status'> & { status?: BugReportStatus }): Promise<BugReport> => {
    const newReport: BugReport = {
      id: uuidv4(),
      reporterName: report.reporterName,
      reportType: report.reportType,
      summary: report.summary,
      description: report.description,
      status: report.status ?? BugReportStatus.Open,
      createdAt: new Date().toISOString(),
    };
    demoState.bugReports.push(newReport);
    return deepClone(newReport);
};

export const updateBugReport = async (id: string, updates: Partial<BugReport>): Promise<BugReport> => {
    const report = findById(demoState.bugReports, id, 'バグ報告');
    Object.assign(report, updates);
    return deepClone(report);
};

export const getEstimates = async (): Promise<Estimate[]> => deepClone(demoState.estimates);

export const addEstimate = async (estimate: Partial<Estimate>): Promise<Estimate> => {
    const now = new Date().toISOString();
    const totals = calculateEstimateTotals(estimate.items ?? [], estimate.taxInclusive ?? false);
    const newEstimate: Estimate = {
      id: uuidv4() as UUID,
      estimateNumber: estimate.estimateNumber ?? nextEstimateNumber++,
      customerName: estimate.customerName ?? '顧客未設定',
      title: estimate.title ?? '新規見積',
      items: totals.items,
      subtotal: totals.subtotal,
      taxTotal: totals.taxTotal,
      grandTotal: totals.grandTotal,
      deliveryDate: estimate.deliveryDate ?? now.slice(0, 10),
      paymentTerms: estimate.paymentTerms ?? '末締め翌月末払い',
      deliveryTerms: estimate.deliveryTerms,
      deliveryMethod: estimate.deliveryMethod ?? 'メール送付',
      notes: estimate.notes ?? '',
      status: estimate.status ?? EstimateStatus.Draft,
      version: estimate.version ?? 1,
      userId: estimate.userId ?? (demoState.employeeUsers[0]?.id || 'user-001'),
      user: estimate.user ?? demoState.employeeUsers.find(u => u.id === estimate.userId) ?? demoState.employeeUsers[0],
      createdAt: now,
      updatedAt: now,
      projectId: estimate.projectId,
      projectName: estimate.projectName,
      taxInclusive: estimate.taxInclusive ?? false,
      pdfUrl: estimate.pdfUrl,
      tracking: estimate.tracking,
      postal: estimate.postal,
    };
    demoState.estimates.push(newEstimate);
    return deepClone(newEstimate);
};

export const updateEstimate = async (id: UUID, updates: Partial<Estimate>): Promise<Estimate> => {
    const estimate = findById(demoState.estimates, id, '見積');

    if (updates.items || typeof updates.taxInclusive !== 'undefined') {
      const totals = calculateEstimateTotals(updates.items ?? estimate.items, updates.taxInclusive ?? estimate.taxInclusive ?? false);
      estimate.items = totals.items;
      estimate.subtotal = totals.subtotal;
      estimate.taxTotal = totals.taxTotal;
      estimate.grandTotal = totals.grandTotal;
    }
    if (updates.postal) {
      estimate.postal = { ...(estimate.postal ?? { method: 'inhouse_print', status: 'preparing', toName: estimate.customerName }), ...updates.postal };
    }
    if (updates.tracking) {
      estimate.tracking = { ...(estimate.tracking ?? { trackId: uuidv4(), mailStatus: 'unopened', totalOpens: 0, totalClicks: 0 }), ...updates.tracking };
    }

    Object.assign(estimate, updates, { updatedAt: new Date().toISOString() });
    return deepClone(estimate);
};

export const savePostal = async (estimateId: UUID, updates: Partial<PostalInfo>): Promise<Estimate> => {
    const estimate = findById(demoState.estimates, estimateId, '見積');
    const nextPostal: PostalInfo = {
      method: estimate.postal?.method ?? 'inhouse_print',
      status: estimate.postal?.status ?? 'preparing',
      toName: estimate.postal?.toName ?? estimate.customerName,
      ...estimate.postal,
      ...updates,
    };
    if (nextPostal.toName && !nextPostal.labelPreviewSvg) {
      nextPostal.labelPreviewSvg = renderPostalLabelSvg(nextPostal.toName, nextPostal.toCompany);
    }
    estimate.postal = nextPostal;
    estimate.updatedAt = new Date().toISOString();
    return deepClone(estimate);
};

export const saveTracking = async (estimateId: UUID, updates: Partial<TrackingInfo>): Promise<Estimate> => {
    const estimate = findById(demoState.estimates, estimateId, '見積');
    const tracking: TrackingInfo = {
      trackId: estimate.tracking?.trackId ?? uuidv4(),
      mailStatus: updates.mailStatus ?? estimate.tracking?.mailStatus ?? 'unopened',
      totalOpens: updates.totalOpens ?? estimate.tracking?.totalOpens ?? 0,
      totalClicks: updates.totalClicks ?? estimate.tracking?.totalClicks ?? 0,
      lastEventAt: updates.lastEventAt ?? estimate.tracking?.lastEventAt,
      firstOpenedAt: updates.firstOpenedAt ?? estimate.tracking?.firstOpenedAt,
    };
    estimate.tracking = tracking;
    estimate.updatedAt = new Date().toISOString();
    return deepClone(estimate);
};

export const renderPostalLabelSvg = (toName: string, toCompany?: string): string => {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="250">
<rect width="400" height="250" fill="#ffffff" stroke="#1f2937" stroke-width="2" rx="12" ry="12" />
<text x="200" y="90" font-size="28" text-anchor="middle" font-family="'Noto Sans JP', sans-serif">${toCompany ?? ''}</text>
<text x="200" y="140" font-size="36" text-anchor="middle" font-family="'Noto Sans JP', sans-serif" font-weight="bold">${toName} 様</text>
<text x="200" y="190" font-size="16" text-anchor="middle" fill="#4b5563">印刷DXソリューションズ株式会社</text>
</svg>`;
};

export const getApplications = async (_currentUser: EmployeeUser | null): Promise<ApplicationWithDetails[]> => {
    return deepClone(demoState.applications.map(mapApplicationDetails));
};

interface SubmissionPayload {
  applicationCodeId: string;
  formData: any;
  approvalRouteId: string;
  status?: Application['status'];
  submittedAt?: string | null;
  approverId?: string | null;
  currentLevel?: number;
  rejectionReason?: string | null;
}

export const submitApplication = async (payload: SubmissionPayload, applicantId: string): Promise<ApplicationWithDetails> => {
    const route = findById(demoState.approvalRoutes, payload.approvalRouteId, '承認ルート');
    const now = new Date().toISOString();
    const status = payload.status ?? 'pending_approval';
    const currentLevel = payload.currentLevel ?? (status === 'pending_approval' ? 1 : 0);
    const application: Application = {
      id: uuidv4(),
      applicantId,
      applicationCodeId: payload.applicationCodeId,
      formData: payload.formData,
      status,
      submittedAt: status === 'draft' ? null : (payload.submittedAt ?? now),
      approvedAt: null,
      rejectedAt: null,
      currentLevel,
      approverId: payload.approverId ?? route.routeData.steps[currentLevel - 1]?.approverId ?? null,
      rejectionReason: payload.rejectionReason ?? null,
      approvalRouteId: payload.approvalRouteId,
      createdAt: now,
      updatedAt: now,
    };
    demoState.applications.push(application);
    return deepClone(mapApplicationDetails(application));
};

export const approveApplication = async (application: ApplicationWithDetails, approver: EmployeeUser): Promise<ApplicationWithDetails> => {
    const stored = findById(demoState.applications, application.id, '申請');
    stored.status = 'approved';
    stored.approvedAt = new Date().toISOString();
    stored.rejectedAt = null;
    stored.rejectionReason = null;
    stored.currentLevel = (stored.currentLevel ?? 0) + 1;
    stored.approverId = approver.id;
    stored.updatedAt = new Date().toISOString();
    return deepClone(mapApplicationDetails(stored));
};

export const rejectApplication = async (application: ApplicationWithDetails, reason: string, approver: EmployeeUser): Promise<ApplicationWithDetails> => {
    const stored = findById(demoState.applications, application.id, '申請');
    stored.status = 'rejected';
    stored.rejectedAt = new Date().toISOString();
    stored.approvedAt = null;
    stored.rejectionReason = reason;
    stored.approverId = approver.id;
    stored.updatedAt = new Date().toISOString();
    return deepClone(mapApplicationDetails(stored));
};

export const getApplicationCodes = async (): Promise<ApplicationCode[]> => deepClone(demoState.applicationCodes);

export const getInvoices = async (): Promise<Invoice[]> => deepClone(demoState.invoices);

export const getProjects = async (): Promise<Project[]> => deepClone(projects);

type AttachmentInput = { file: File | { name: string; type?: string }; category?: string };

export const addProject = async (data: Partial<Project>, attachments: AttachmentInput[] = []): Promise<Project> => {
    const now = new Date().toISOString();
    const projectId = uuidv4();
    const projectAttachments: ProjectAttachment[] = attachments.map((item, index) => ({
      id: uuidv4(),
      projectId,
      fileName: (item.file as File).name ?? (item.file as { name: string }).name ?? `attachment-${index + 1}`,
      filePath: `project_files/${projectId}/${index + 1}`,
      fileUrl: `https://example.com/project_files/${projectId}/${index + 1}`,
      mimeType: (item.file as File).type ?? (item.file as { type?: string }).type ?? 'application/octet-stream',
      category: item.category ?? 'その他',
      createdAt: now,
    }));

    const newProject: Project = {
      id: projectId,
      projectName: data.projectName ?? '新規案件',
      customerName: data.customerName ?? '顧客未設定',
      customerId: data.customerId,
      status: data.status ?? ProjectStatus.New,
      overview: data.overview ?? '',
      extracted_details: data.extracted_details ?? '',
      createdAt: now,
      updatedAt: now,
      userId: data.userId ?? demoState.employeeUsers[0]?.id ?? 'user-001',
      attachments: projectAttachments,
      relatedEstimates: [],
      relatedJobs: [],
    };
    projects.push(newProject);
    return deepClone(newProject);
};

export const getDepartments = async (): Promise<Department[]> => {
  if (hasSupabaseCredentials()) {
    const supabaseDepartments = await fetchDepartmentsFromSupabase();
    if (supabaseDepartments) {
      return supabaseDepartments;
    }
  }
  return deepClone(demoState.departments);
};

export const saveDepartment = async (department: Partial<Department>): Promise<Department> => {
    if (department.id) {
      const existing = findById(demoState.departments, department.id, '部署');
      Object.assign(existing, department);
      return deepClone(existing);
    }
    const newDepartment: Department = {
      id: uuidv4(),
      name: department.name ?? '新規部署',
    };
    demoState.departments.push(newDepartment);
    return deepClone(newDepartment);
};

export const deleteDepartment = async (id: string): Promise<void> => {
    demoState.departments = demoState.departments.filter(dep => dep.id !== id);
};

export const getPaymentRecipients = async (): Promise<PaymentRecipient[]> => {
  if (hasSupabaseCredentials()) {
    const supabaseRecipients = await fetchPaymentRecipientsFromSupabase();
    if (supabaseRecipients) {
      return supabaseRecipients;
    }
  }
  return deepClone(demoState.paymentRecipients);
};

export const savePaymentRecipient = async (recipient: Partial<PaymentRecipient>): Promise<PaymentRecipient> => {
    if (recipient.id) {
        const existing = findById(demoState.paymentRecipients, recipient.id, '支払先');
        if (recipient.allocationTargets) {
          existing.allocationTargets = recipient.allocationTargets.map(target => ({ ...target, id: target.id ?? uuidv4() }));
        }
        Object.assign(existing, recipient, { isActive: recipient.isActive ?? existing.isActive ?? true });
        return deepClone(existing);
    }
    const newRecipient: PaymentRecipient = {
        id: uuidv4(),
        recipientCode: recipient.recipientCode ?? `V${String(demoState.paymentRecipients.length + 1).padStart(3, '0')}`,
        companyName: recipient.companyName ?? '',
        recipientName: recipient.recipientName ?? '',
        bankName: recipient.bankName ?? '',
        bankBranch: recipient.bankBranch ?? '',
        bankAccountNumber: recipient.bankAccountNumber ?? '',
        isActive: recipient.isActive ?? true,
        allocationTargets: (recipient.allocationTargets ?? []).map(target => ({ ...target, id: target.id ?? uuidv4() })),
    };
    demoState.paymentRecipients.push(newRecipient);
    return deepClone(newRecipient);
};

export const deletePaymentRecipient = async (id: string): Promise<void> => {
    demoState.paymentRecipients = demoState.paymentRecipients.filter(rec => rec.id !== id);
};

export const getAllocationDivisions = async (): Promise<AllocationDivision[]> => {
  if (hasSupabaseCredentials()) {
    const supabaseDivisions = await fetchAllocationDivisionsFromSupabase();
    if (supabaseDivisions) {
      return supabaseDivisions;
    }
  }
  return deepClone(allocationDivisions);
};

export const saveAllocationDivision = async (division: Partial<AllocationDivision>): Promise<AllocationDivision> => {
    if (division.id) {
        const existing = findById(allocationDivisions, division.id, '振分区分');
        Object.assign(existing, division);
        return deepClone(existing);
    }
    const newDivision: AllocationDivision = {
        id: uuidv4(),
        name: division.name ?? '新規振分区分',
        isActive: division.isActive ?? true,
        createdAt: new Date().toISOString(),
    };
    allocationDivisions.push(newDivision);
    return deepClone(newDivision);
};

export const deleteAllocationDivision = async (id: string): Promise<void> => {
    allocationDivisions = allocationDivisions.filter(div => div.id !== id);
};

export const getTitles = async (): Promise<Title[]> => deepClone(titles);

export const saveTitle = async (title: Partial<Title>): Promise<Title> => {
    if (title.id) {
        const existing = findById(titles, title.id, '役職');
        Object.assign(existing, title);
        return deepClone(existing);
    }
    const newTitle: Title = {
        id: uuidv4(),
        name: title.name ?? '新規役職',
        isActive: title.isActive ?? true,
        createdAt: new Date().toISOString(),
    };
    titles.push(newTitle);
    return deepClone(newTitle);
};

export const deleteTitle = async (id: string): Promise<void> => {
    titles = titles.filter(title => title.id !== id);
};

export const getInboxItems = async (): Promise<InboxItem[]> => deepClone(demoState.inboxItems);

export const addInboxItem = async (item: Omit<InboxItem, 'id' | 'createdAt' | 'fileUrl'> & { fileUrl?: string }): Promise<InboxItem> => {
    const newItem: InboxItem = {
      id: uuidv4(),
      fileName: item.fileName,
      filePath: item.filePath,
      fileUrl: item.fileUrl ?? `https://example.com/storage/${item.filePath}`,
      mimeType: item.mimeType,
      status: item.status,
      extractedData: item.extractedData ?? null,
      errorMessage: item.errorMessage ?? null,
      createdAt: new Date().toISOString(),
    };
    demoState.inboxItems.unshift(newItem);
    return deepClone(newItem);
};

export const updateInboxItem = async (id: string, updates: Partial<InboxItem>): Promise<InboxItem> => {
    const item = findById(demoState.inboxItems, id, 'インボックス項目');
    Object.assign(item, updates);
    return deepClone(item);
};

export const deleteInboxItem = async (item: InboxItem): Promise<void> => {
    demoState.inboxItems = demoState.inboxItems.filter(i => i.id !== item.id);
};

export const uploadFile = async (file: File, bucket: string): Promise<{ path: string; url: string }> => {
    const identifier = uuidv4();
    const fileName = file.name ?? `${identifier}.bin`;
    const path = `${bucket}/${identifier}-${fileName}`;
    return {
      path,
      url: `https://example.com/storage/${path}`,
    };
};

export const getAnalysisHistory = async (): Promise<AnalysisHistory[]> => {
    const sorted = [...analysisHistory].sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
    return deepClone(sorted);
};

export const addAnalysisHistory = async (entry: Omit<AnalysisHistory, 'id' | 'createdAt'> & { createdAt?: string; id?: UUID }): Promise<AnalysisHistory> => {
    const newEntry: AnalysisHistory = {
      id: entry.id ?? uuidv4(),
      userId: entry.userId,
      viewpoint: entry.viewpoint,
      dataSources: entry.dataSources,
      result: entry.result,
      createdAt: entry.createdAt ?? new Date().toISOString(),
    };
    analysisHistory.unshift(newEntry);
    return deepClone(newEntry);
};
