import { normalizeFormCode } from "./normalizeFormCode";
import { v4 as uuidv4 } from 'uuid';
import type { PostgrestError, User as SupabaseAuthUser } from '@supabase/supabase-js';
import { createDemoDataState, DemoDataState } from './demoData.ts';
import { sendEmail } from './emailService.ts';
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
  ApplicationNotificationAudience,
  ApplicationNotificationEmail,
  ApplicationNotificationRecipient,
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
  canUseAnythingAnalysis: row.can_use_anything_analysis ?? false,
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
  branch_name?: string | null;
  account_number?: string | null;
  bank_branch?: string | null;
  bank_account_number?: string | null;
  is_active?: boolean | null;
  allocation_targets?: { id?: string | null; name?: string | null; target_id?: string | null; target_name?: string | null }[] | null;
};

type SupabasePaymentRecipientAllocationTargetRow = {
  id: string;
  payment_recipient_id?: string | null;
  target_id?: string | null;
  name?: string | null;
  target_name?: string | null;
  sort_order?: number | null;
  created_at?: string | null;
};

type SupabaseAllocationDivisionRow = {
  id: string;
  name?: string | null;
  is_active?: boolean | null;
  created_at?: string | null;
};

const normalizeErrorText = (value: unknown): string => {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().toLowerCase();
};

const isRelationNotFoundError = (error?: PostgrestError | null): boolean => {
  if (!error) {
    return false;
  }

  if (['42P01', 'PGRST114', 'PGRST204'].includes(error.code ?? '')) {
    return true;
  }

  const candidates = [error.message, error.details, error.hint];
  return candidates.some(text => {
    const normalized = normalizeErrorText(text);
    if (!normalized) {
      return false;
    }
    return (
      normalized.includes('relation') || normalized.includes('view') || normalized.includes('schema')
    ) && normalized.includes('does not exist');
  });
};

const isColumnNotFoundError = (error?: PostgrestError | null): boolean => {
  if (!error) {
    return false;
  }

  if (['42703', 'PGRST301', 'PGRST302'].includes(error.code ?? '')) {
    return true;
  }

  const candidates = [error.message, error.details, error.hint];
  return candidates.some(text => {
    const normalized = normalizeErrorText(text);
    if (!normalized) {
      return false;
    }
    return normalized.includes('column') && normalized.includes('does not exist');
  });
};

export const isSupabaseUnavailableError = (error: any): boolean => {
  if (!error) return false;

  const candidates = [error, error?.cause];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') {
      continue;
    }

    const code = (candidate as { code?: unknown }).code;
    if (typeof code === 'string') {
      if (['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT'].includes(code)) {
        return true;
      }
    }

    const status = (candidate as { status?: unknown }).status;
    if (typeof status === 'number' && (status === 0 || status === 503 || status === 504)) {
      return true;
    }
  }

  const message = typeof error === 'string'
    ? error
    : error.message || error.details || error.error_description || error.hint;
  if (!message) return false;

  const normalized = message.toLowerCase();
  if (
    normalized.includes('fetch failed') ||
    normalized.includes('failed to fetch') ||
    normalized.includes('network') ||
    normalized.includes('timeout') ||
    normalized.includes('supabase client is not initialized') ||
    normalized.includes('invalid api key')
  ) {
    return true;
  }

  if (message.includes('Supabaseの認証情報が設定されていません')) {
    return true;
  }

  return false;
};

const logSupabaseUnavailableWarning = (context: string, error: unknown): void => {
  if (typeof console !== 'undefined' && console.warn) {
    console.warn(`Supabase に接続できないため${context}をスキップし、デモデータにフォールバックします。`, error);
  }
};

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
    bankBranch:
      toStringValue(row.bank_branch ?? row.branch_name ?? (row as Record<string, unknown>)['bankBranch'], '') || null,
    bankAccountNumber:
      toStringValue(
        row.bank_account_number ?? row.account_number ?? (row as Record<string, unknown>)['bankAccountNumber'],
        '',
      ) || null,
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
  try {
    const supabaseClient = getSupabase();
    const sources = ['account_items', 'v_account_items', 'v_account_items_with_mq_code'] as const;

    for (const table of sources) {
      const { data, error } = await supabaseClient
        .from(table)
        .select('*');

      if (error) {
        if (isSupabaseUnavailableError(error)) {
          logSupabaseUnavailableWarning('勘定科目マスタの取得', error);
          return null;
        }
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
  } catch (error) {
    if (isSupabaseUnavailableError(error)) {
      logSupabaseUnavailableWarning('勘定科目マスタの取得', error);
      return null;
    }
    throw error;
  }
};

const fetchDepartmentsFromSupabase = async (): Promise<Department[] | null> => {
  try {
    const supabaseClient = getSupabase();
    const sources = [
      { table: 'v_departments', select: 'id, name' },
      { table: 'departments', select: 'id, name' },
    ] as const;

    for (const source of sources) {
      const { data, error } = await supabaseClient
        .from(source.table)
        .select(source.select);

      if (error) {
        if (isSupabaseUnavailableError(error)) {
          logSupabaseUnavailableWarning('部門マスタの取得', error);
          return null;
        }
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
  } catch (error) {
    if (isSupabaseUnavailableError(error)) {
      logSupabaseUnavailableWarning('部門マスタの取得', error);
      return null;
    }
    throw error;
  }
};

const fetchPaymentRecipientsFromSupabase = async (): Promise<PaymentRecipient[] | null> => {
  try {
    const supabaseClient = getSupabase();
    const selects = [
      'id, recipient_code, company_name, recipient_name, bank_name, bank_branch, bank_account_number, is_active',
      'id, recipient_code, company_name, recipient_name, bank_name, branch_name:bank_branch, account_number:bank_account_number, is_active',
      'id, recipient_code, company_name, recipient_name, bank_name, branch_name, account_number, is_active',
      '*',
    ] as const;

    let recipients: SupabasePaymentRecipientRow[] | null = null;
    let recipientsRelationMissing = false;

    for (const select of selects) {
      const { data, error } = await supabaseClient
        .from('payment_recipients')
        .select(select);

      if (error) {
        if (isSupabaseUnavailableError(error)) {
          logSupabaseUnavailableWarning('支払先マスタの取得', error);
          return null;
        }
        if (isRelationNotFoundError(error)) {
          recipientsRelationMissing = true;
          break;
        }
        if (isColumnNotFoundError(error)) {
          continue;
        }
        throw error;
      }

      if (!data) {
        continue;
      }

      recipients = data;
      break;
    }

    if (!recipients || recipientsRelationMissing) {
      return null;
    }

    const allocationTargetsByRecipientId = new Map<
      string,
      { data: NonNullable<SupabasePaymentRecipientRow['allocation_targets']>[number]; sortOrder: number; createdAt: string; name: string }
    >();

    // 指示書に従い、存在する6カラムのみを取得
    const { data, error } = await supabaseClient
      .from('payment_recipient_allocation_targets')
      .select('id, payment_recipient_id, name, sort_order, created_at, updated_at')
      .order('sort_order', { ascending: true });

    if (error) {
      if (isSupabaseUnavailableError(error)) {
        logSupabaseUnavailableWarning('支払先振分先マスタの取得', error);
      } else if (!isRelationNotFoundError(error)) {
        throw error;
      }
    } else if (data && data.length > 0) {
      (data as any[]).forEach((targetRow: any) => {
        const recipientId = toStringValue(targetRow.payment_recipient_id, '').trim();
        if (!recipientId) {
          return;
        }

        // target_id, target_name は存在しないため、name のみを使用
        const normalizedTarget: NonNullable<SupabasePaymentRecipientRow['allocation_targets']>[number] = {
          id: targetRow.id,
          name: targetRow.name ?? null,
          target_id: null, // カラムが存在しないため null
          target_name: null, // カラムが存在しないため null
        };

        const sortOrder = typeof targetRow.sort_order === 'number' ? targetRow.sort_order : Number.MAX_SAFE_INTEGER;
        const createdAt = toStringValue(targetRow.created_at, '');
        const sortName = toStringValue(targetRow.name, '');

        const existing = allocationTargetsByRecipientId.get(recipientId) ?? [];
        existing.push({ data: normalizedTarget, sortOrder, createdAt, name: sortName });
        allocationTargetsByRecipientId.set(recipientId, existing);
      });
    }

    allocationTargetsByRecipientId.forEach(targets => {
      targets.sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) {
          return a.sortOrder - b.sortOrder;
        }
        if (a.createdAt !== b.createdAt) {
          return a.createdAt.localeCompare(b.createdAt);
        }
        return a.name.localeCompare(b.name, 'ja');
      });
    });

    const mapped = recipients.map(row => {
      const groupedTargets = allocationTargetsByRecipientId.get(row.id);
      const allocationTargets =
        groupedTargets && groupedTargets.length > 0
          ? groupedTargets.map(target => target.data)
          : row.allocation_targets;

      const rowForMapping =
        allocationTargets && allocationTargets.length > 0
          ? ({ ...row, allocation_targets: allocationTargets } as SupabasePaymentRecipientRow)
          : row;

      return mapSupabasePaymentRecipientRow(rowForMapping);
    });

    mapped.sort((a, b) => {
      const aLabel = `${a.companyName ?? ''}${a.recipientName ?? ''}`;
      const bLabel = `${b.companyName ?? ''}${b.recipientName ?? ''}`;
      return aLabel.localeCompare(bLabel, 'ja');
    });
    return mapped;
  } catch (error) {
    if (isSupabaseUnavailableError(error)) {
      logSupabaseUnavailableWarning('支払先マスタの取得', error);
      return null;
    }
    throw error;
  }
};

const fetchAllocationDivisionsFromSupabase = async (): Promise<AllocationDivision[] | null> => {
  try {
    const supabaseClient = getSupabase();
    const sources = [
      { table: 'allocation_divisions', select: 'id, name, is_active, created_at' },
      { table: 'v_allocation_divisions', select: 'id, name, is_active, created_at' },
    ] as const;

    for (const source of sources) {
      const { data, error } = await supabaseClient
        .from(source.table)
        .select(source.select);

      if (error) {
        if (isSupabaseUnavailableError(error)) {
          logSupabaseUnavailableWarning('配賦区分マスタの取得', error);
          return null;
        }
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
  } catch (error) {
    if (isSupabaseUnavailableError(error)) {
      logSupabaseUnavailableWarning('配賦区分マスタの取得', error);
      return null;
    }
    throw error;
  }
};

const isUniqueViolation = (error?: PostgrestError | null): boolean => error?.code === '23505';

const fetchSupabaseEmployeeUser = async (userId: string): Promise<EmployeeUser | null> => {
  if (!hasSupabaseCredentials()) {
    return null;
  }

  try {
    const supabaseClient = getSupabase();

    // Fetch from users table directly
    const { data: userData, error: userError } = await supabaseClient
      .from('users')
      .select('id, name, email, employee_number, department_id, position_id, role, can_use_anything_analysis, created_at')
      .eq('id', userId)
      .maybeSingle();

    if (userError) {
      if (isSupabaseUnavailableError(userError)) {
        logSupabaseUnavailableWarning('ユーザー情報の取得', userError);
        return null;
      }
      if (isRelationNotFoundError(userError) || isColumnNotFoundError(userError)) {
        console.warn('usersテーブルが見つからないため、セッションユーザー情報の取得をスキップします。', userError);
        return null;
      }
      throw userError;
    }

    if (!userData) {
      return null;
    }

    // Map to EmployeeUser format
    return {
      id: userData.id,
      name: userData.name || '名前未設定',
      department: null,
      title: null,
      email: userData.email || '',
      role: (userData.role as 'admin' | 'user') || 'user',
      createdAt: userData.created_at || new Date().toISOString(),
      canUseAnythingAnalysis: userData.can_use_anything_analysis ?? true,
    };
  } catch (error) {
    if (isRelationNotFoundError(error as PostgrestError) || isColumnNotFoundError(error as PostgrestError)) {
      console.warn('Supabase のユーザー情報が利用できないため、セッションユーザー情報を取得できません。', error);
      return null;
    }
    if (isSupabaseUnavailableError(error)) {
      logSupabaseUnavailableWarning('ユーザー情報の取得', error);
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

  const buildFallbackEmployeeUser = (): EmployeeUser => {
    const fallbackFromDemo =
      demoState.employeeUsers.find((user) => user.id === authUser.id) ??
      (fallbackEmail ? demoState.employeeUsers.find((user) => user.email === fallbackEmail) : undefined);
    if (fallbackFromDemo) {
      return { ...fallbackFromDemo };
    }
    const nowIso = new Date().toISOString();
    return {
      id: authUser.id,
      name: displayName,
      department: null,
      title: null,
      email: fallbackEmail || '',
      role: 'user',
      createdAt: nowIso,
      canUseAnythingAnalysis: true,
    };
  };

  try {
    const { data: userRow, error: userError } = await supabaseClient
      .from('users')
      .select('id, name, email, employee_number, department_id, position_id, role, can_use_anything_analysis, created_at')
      .eq('id', authUser.id)
      .maybeSingle();

    if (userError) {
      if (isSupabaseUnavailableError(userError)) {
        logSupabaseUnavailableWarning('ユーザー情報の取得', userError);
        return buildFallbackEmployeeUser();
      }
      throw userError;
    }

    let ensuredUser = userRow ?? null;

    if (!ensuredUser) {
      const { data: insertedUser, error: insertError } = await supabaseClient
        .from('users')
        .insert({
          id: authUser.id,
          name: displayName,
          email: fallbackEmail || null,
          role: 'user',
          can_use_anything_analysis: true,
        })
        .select('id, name, email, employee_number, department_id, position_id, role, can_use_anything_analysis, created_at')
        .maybeSingle();

      if (insertError) {
        if (isSupabaseUnavailableError(insertError)) {
          logSupabaseUnavailableWarning('ユーザー情報の作成', insertError);
          return buildFallbackEmployeeUser();
        }

        if (!isUniqueViolation(insertError)) {
          throw insertError;
        }

        const { data: refetchedUser, error: refetchError } = await supabaseClient
          .from('users')
          .select('id, name, email, employee_number, department_id, position_id, role, can_use_anything_analysis, created_at')
          .eq('id', authUser.id)
          .maybeSingle();

        if (refetchError) {
          if (isSupabaseUnavailableError(refetchError)) {
            logSupabaseUnavailableWarning('ユーザー情報の再取得', refetchError);
            return buildFallbackEmployeeUser();
          }
          throw refetchError;
        }

        ensuredUser = refetchedUser ?? null;
      } else {
        ensuredUser = insertedUser ?? null;
      }
    }

    if (!ensuredUser) {
      throw new Error('Supabase上にユーザー情報が存在しません。管理者に問い合わせてください。');
    }

    const { data: employeeRow, error: employeeError } = await supabaseClient
      .from('employees')
      .select('id, user_id, name, department, title, created_at')
      .eq('user_id', authUser.id)
      .maybeSingle();

    if (employeeError && !isUniqueViolation(employeeError)) {
      if (isSupabaseUnavailableError(employeeError)) {
        logSupabaseUnavailableWarning('従業員レコードの取得', employeeError);
        return buildFallbackEmployeeUser();
      }
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
        if (isSupabaseUnavailableError(insertEmployeeError)) {
          logSupabaseUnavailableWarning('従業員レコードの作成', insertEmployeeError);
          return buildFallbackEmployeeUser();
        }
        throw insertEmployeeError;
      }
    }

    const viewUser = await fetchSupabaseEmployeeUser(authUser.id);
    if (viewUser) {
      return viewUser;
    }

    return {
      id: ensuredUser.id,
      name: ensuredUser.name ?? displayName,
      department: employeeRow?.department ?? null,
      title: employeeRow?.title ?? null,
      email: ensuredUser.email ?? fallbackEmail ?? '',
      role: ensuredUser.role === 'admin' ? 'admin' : 'user',
      createdAt: employeeRow?.created_at ?? ensuredUser.created_at ?? new Date().toISOString(),
      canUseAnythingAnalysis: ensuredUser.can_use_anything_analysis ?? false,
    };
  } catch (error) {
    if (isRelationNotFoundError(error as PostgrestError) || isColumnNotFoundError(error as PostgrestError)) {
      if (!hasLoggedMissingSupabaseUserTableWarning && typeof console !== 'undefined') {
        console.warn(
          'Supabase の users / employees テーブルまたはビューが見つかりません。暫定的に認証ユーザーの情報をメタデータから生成します。セットアップスクリプトの実行をご確認ください。',
          error
        );
        hasLoggedMissingSupabaseUserTableWarning = true;
      }
      return buildFallbackEmployeeUser();
    }
    if (isSupabaseUnavailableError(error)) {
      logSupabaseUnavailableWarning('ユーザー情報の確保', error);
      return buildFallbackEmployeeUser();
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

const APPLICATION_STATUS_LABELS: Record<Application['status'], string> = {
  draft: '下書き',
  pending_approval: '承認待ち',
  approved: '承認済み',
  rejected: '差戻し',
};

const resolveEmployeeUser = (id: string | null | undefined): EmployeeUser | undefined => {
  if (!id) {
    return undefined;
  }
  return demoState.employeeUsers.find(user => user.id === id);
};

const toNotificationRecipients = (
  users: (EmployeeUser | undefined)[],
): ApplicationNotificationRecipient[] => {
  const map = new Map<string, ApplicationNotificationRecipient>();
  users.forEach(user => {
    if (!user) return;
    map.set(user.id, {
      id: user.id,
      name: user.name,
      email: user.email ?? '',
    });
  });
  return Array.from(map.values());
};

const formatApprovalRouteSummary = (route?: ApprovalRoute): string => {
  if (!route?.routeData?.steps?.length) {
    return '';
  }
  return route.routeData.steps
    .map((step, index) => {
      const approver = resolveEmployeeUser(step.approverId);
      const approverLabel = approver
        ? `${approver.name}${approver.department ? `（${approver.department}）` : ''}`
        : '未設定';
      return `${index + 1}次承認: ${approverLabel}`;
    })
    .join('\n');
};

const filterDeliverableRecipients = (
  recipients: ApplicationNotificationRecipient[],
): ApplicationNotificationRecipient[] => {
  return recipients.filter((recipient) => recipient.email && /.+@.+\..+/.test(recipient.email));
};

const recordApplicationEmail = async (
  application: Application,
  audience: ApplicationNotificationAudience,
  recipients: ApplicationNotificationRecipient[],
  subject: string,
  body: string,
): Promise<ApplicationNotificationEmail | null> => {
  const deliverable = filterDeliverableRecipients(recipients);
  if (deliverable.length === 0) {
    return null;
  }

  const { id: messageId, sentAt } = await sendEmail({
    to: deliverable.map((recipient) => recipient.email),
    subject,
    body,
  });

  const record: ApplicationNotificationEmail = {
    id: messageId,
    applicationId: application.id,
    applicationCodeId: application.applicationCodeId,
    audience,
    subject,
    body,
    recipients: deliverable,
    sentAt,
    status: application.status,
  };

  demoState.applicationEmailNotifications.push(record);
  return record;
};

const createApplicationNotificationEmails = async (application: Application) => {
  const applicationCode = demoState.applicationCodes.find(code => code.id === application.applicationCodeId);
  const approvalRoute = demoState.approvalRoutes.find(route => route.id === application.approvalRouteId);
  const applicant = resolveEmployeeUser(application.applicantId);

  const applicationName = applicationCode?.name ?? '申請';
  const applicantName = applicant?.name ?? '申請者';
  const statusLabel = APPLICATION_STATUS_LABELS[application.status] ?? application.status;
  const routeSummary = formatApprovalRouteSummary(approvalRoute);

  const summaryLines = [
    `申請ID: ${application.id}`,
    `申請種別: ${applicationName}`,
    `申請者: ${applicantName}`,
    `現在のステータス: ${statusLabel}`,
  ];
  if (routeSummary) {
    summaryLines.push(`承認ルート:\n${routeSummary}`);
  }
  const summaryText = summaryLines.join('\n');

  const approverRecipients = toNotificationRecipients(
    approvalRoute?.routeData?.steps?.map(step => resolveEmployeeUser(step.approverId)) ?? [],
  );
  if (approverRecipients.length > 0) {
    const subject = `【承認依頼】${applicationName} - ${applicantName}`;
    const body = [
      `${applicantName}さんから${applicationName}の承認依頼が届きました。`,
      '',
      summaryText,
      '',
      '承認対応をお願いします。',
    ].join('\n');
    await recordApplicationEmail(application, 'approval_route', approverRecipients, subject, body);
  }

  const applicantRecipients = applicant ? toNotificationRecipients([applicant]) : [];
  if (applicantRecipients.length > 0) {
    const subject = `【申請受付】${applicationName} のステータス: ${statusLabel}`;
    const bodyLines = [
      `${applicantName}さん`,
      '',
      `${applicationName}の申請を受け付けました。`,
      `現在のステータス: ${statusLabel}`,
      '',
    ];
    if (routeSummary) {
      bodyLines.push('承認ルート:');
      bodyLines.push(routeSummary);
      bodyLines.push('');
    }
    bodyLines.push('承認状況はシステムの「承認一覧」で確認できます。');

    const body = bodyLines.join('\n');
    await recordApplicationEmail(application, 'applicant', applicantRecipients, subject, body);
  }
};

const createApplicationStatusChangeEmails = async (application: Application) => {
  const applicationCode = demoState.applicationCodes.find(code => code.id === application.applicationCodeId);
  const approvalRoute = demoState.approvalRoutes.find(route => route.id === application.approvalRouteId);
  const applicant = resolveEmployeeUser(application.applicantId);

  const applicationName = applicationCode?.name ?? '申請';
  const applicantName = applicant?.name ?? '申請者';
  const statusLabel = APPLICATION_STATUS_LABELS[application.status] ?? application.status;
  const routeSummary = formatApprovalRouteSummary(approvalRoute);

  const baseSummaryLines = [
    `申請ID: ${application.id}`,
    `申請種別: ${applicationName}`,
    `申請者: ${applicantName}`,
    `最終ステータス: ${statusLabel}`,
  ];

  if (application.rejectionReason) {
    baseSummaryLines.push(`差戻し理由: ${application.rejectionReason}`);
  }

  if (routeSummary) {
    baseSummaryLines.push(`承認ルート:\n${routeSummary}`);
  }

  const summaryText = baseSummaryLines.join('\n');

  const applicantRecipients = applicant ? toNotificationRecipients([applicant]) : [];
  if (applicantRecipients.length > 0) {
    const subjectPrefix = application.status === 'approved' ? '【承認完了】' : application.status === 'rejected' ? '【差戻し】' : '【ステータス更新】';
    const subject = `${subjectPrefix}${applicationName}`;
    const bodyLines = [
      `${applicantName}さん`,
      '',
      `${applicationName}の申請ステータスが「${statusLabel}」になりました。`,
      '',
      summaryText,
      '',
      '詳細は承認ワークフロー画面から確認できます。',
    ];

    await recordApplicationEmail(application, 'applicant', applicantRecipients, subject, bodyLines.join('\n'));
  }

  const approverRecipients = toNotificationRecipients(
    (approvalRoute?.routeData?.steps ?? [])
      .map(step => resolveEmployeeUser(step.approverId))
      .filter(user => (user?.id ?? '') !== (applicant?.id ?? '')),
  );

  if (approverRecipients.length > 0) {
    const subjectPrefix = application.status === 'approved' ? '【対応完了】' : application.status === 'rejected' ? '【差戻し完了】' : '【ステータス更新】';
    const subject = `${subjectPrefix}${applicationName} - ${applicantName}`;
    const bodyLines = [
      `${applicantName}さんの${applicationName}が「${statusLabel}」になりました。`,
      '',
      summaryText,
      '',
      '必要に応じて申請内容の確認をお願いします。',
    ];

    await recordApplicationEmail(application, 'approval_route', approverRecipients, subject, bodyLines.join('\n'));
  }
};


export const resolveUserSession = async (authUser: MinimalAuthUser): Promise<EmployeeUser> => {
  const fallbackEmail = authUser.email ?? '';

  if (!hasSupabaseCredentials()) {
    throw new Error('Supabaseの認証情報が設定されていません。');
  }

  const buildFallbackUser = (): EmployeeUser => {
    const fallbackFromDemo =
      demoState.employeeUsers.find((user) => user.id === authUser.id) ??
      (fallbackEmail ? demoState.employeeUsers.find((user) => user.email === fallbackEmail) : undefined) ??
      demoState.employeeUsers[0];
    if (fallbackFromDemo) {
      return { ...fallbackFromDemo };
    }
    const displayName =
      authUser.user_metadata?.full_name?.trim() ||
      authUser.user_metadata?.name?.trim?.() ||
      fallbackEmail ||
      'ゲストユーザー';
    return {
      id: authUser.id,
      name: displayName,
      department: null,
      title: null,
      email: fallbackEmail,
      role: 'user',
      createdAt: new Date().toISOString(),
      canUseAnythingAnalysis: true,
    };
  };

  try {
    const supabaseUser = await ensureSupabaseEmployeeUser(authUser, fallbackEmail);
    if (supabaseUser) {
      return supabaseUser;
    }
  } catch (error) {
    if (isSupabaseUnavailableError(error)) {
      logSupabaseUnavailableWarning('ユーザーセッションの解決', error);
      return buildFallbackUser();
    }
    throw error;
  }

  return buildFallbackUser();
};

export const getUsers = async (): Promise<EmployeeUser[]> => {
  if (hasSupabaseCredentials()) {
    try {
      const supabaseClient = getSupabase();

      // Fetch from users table (actual employee data)
      const { data: usersData, error: usersError } = await supabaseClient
        .from('users')
        .select('id, name, email, employee_number, department_id, position_id, role, can_use_anything_analysis, created_at')
        .order('name', { ascending: true });

      if (usersError) {
        if (isSupabaseUnavailableError(usersError)) {
          logSupabaseUnavailableWarning('ユーザーテーブルの取得', usersError);
          return deepClone(demoState.employeeUsers);
        }
        if (isRelationNotFoundError(usersError) || isColumnNotFoundError(usersError)) {
          console.warn('usersテーブルが見つかりません。デモデータにフォールバックします。', usersError);
          return deepClone(demoState.employeeUsers);
        }
        throw usersError;
      }

      if (usersData && usersData.length > 0) {
        // Map users data to EmployeeUser format
        const mappedUsers = usersData.map(user => ({
          id: user.id,
          name: user.name || '名前未設定',
          department: null, // Not available in users table
          title: null, // Not available in users table
          email: user.email || '',
          role: (user.role as 'admin' | 'user') || 'user',
          createdAt: user.created_at || new Date().toISOString(),
          canUseAnythingAnalysis: user.can_use_anything_analysis ?? true,
        }));
        
        // Sync to demoState for resolveEmployeeUser to work
        demoState.employeeUsers = mappedUsers;
        
        return deepClone(mappedUsers);
      }

    } catch (error) {
      if (isRelationNotFoundError(error as PostgrestError) || isColumnNotFoundError(error as PostgrestError)) {
        console.warn('Supabase のユーザーデータが存在しないため、ユーザー一覧をデモデータで代用します。', error);
        return deepClone(demoState.employeeUsers);
      }
      if (isSupabaseUnavailableError(error)) {
        logSupabaseUnavailableWarning('ユーザーデータの取得', error);
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
    if (
      Object.prototype.hasOwnProperty.call(updates, 'email') ||
      Object.prototype.hasOwnProperty.call(updates, 'role') ||
      Object.prototype.hasOwnProperty.call(updates, 'canUseAnythingAnalysis')
    ) {
      throw new Error('Supabase環境ではメール・権限の更新は管理者経由で行ってください。');
    }
    const supabaseClient = getSupabase();
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
        .from('employees')
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
    try {
      const supabaseClient = getSupabase();
      
      // Delete from users table
      const { error } = await supabaseClient
        .from('users')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('ユーザー削除エラー:', error);
        throw error;
      }

      // Also update demoState cache
      demoState.employeeUsers = demoState.employeeUsers.filter(user => user.id !== id);
      
      return;
    } catch (error) {
      console.error('ユーザーの削除に失敗しました:', error);
      throw error;
    }
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

const fetchCustomersFromSupabase = async (): Promise<Customer[] | null> => {
  try {
    const supabaseClient = getSupabase();
    const { data, error } = await supabaseClient
      .from('customers')
      .select('*')
      .order('customer_name', { ascending: true });

    if (error) {
      if (isSupabaseUnavailableError(error)) {
        logSupabaseUnavailableWarning('顧客マスタの取得', error);
        return null;
      }
      throw error;
    }

    if (!data) return [];

    return data.map((row: any) => ({
      id: row.id,
      customerCode: row.customer_code ?? undefined,
      customerName: row.customer_name,
      customerNameKana: row.customer_name_kana ?? undefined,
      representative: row.representative ?? undefined,
      phoneNumber: row.phone_number ?? undefined,
      address1: row.address1 ?? undefined,
      companyContent: row.company_content ?? undefined,
      annualSales: row.annual_sales ?? undefined,
      employeesCount: row.employees_count ?? undefined,
      note: row.note ?? undefined,
      infoSalesActivity: row.info_sales_activity ?? undefined,
      infoRequirements: row.info_requirements ?? undefined,
      infoHistory: row.info_history ?? undefined,
      createdAt: row.created_at,
      postNo: row.post_no ?? undefined,
      address2: row.address2 ?? row.address_2 ?? undefined, // 両方のカラム名に対応
      fax: row.fax ?? undefined,
      closingDay: row.closing_day ?? undefined,
      monthlyPlan: row.monthly_plan ?? undefined,
      payDay: row.pay_day ?? undefined,
      recoveryMethod: row.recovery_method ?? undefined,
      userId: row.user_id ?? undefined,
      name2: row.name2 ?? undefined,
      websiteUrl: row.website_url ?? undefined,
      zipCode: row.zip_code ?? undefined,
      foundationDate: row.foundation_date ?? undefined,
      capital: row.capital ?? undefined,
      customerRank: row.customer_rank ?? undefined,
      customerDivision: row.customer_division ?? undefined,
      salesType: row.sales_type ?? undefined,
      creditLimit: row.credit_limit ?? undefined,
      payMoney: row.pay_money ?? undefined,
      bankName: row.bank_name ?? undefined,
      branchName: row.branch_name ?? undefined,
      accountNo: row.account_no ?? undefined,
      salesUserCode: row.sales_user_code ?? undefined,
      startDate: row.start_date ?? undefined,
      endDate: row.end_date ?? undefined,
      drawingDate: row.drawing_date ?? undefined,
      salesGoal: row.sales_goal ?? undefined,
      infoSalesIdeas: row.info_sales_ideas ?? undefined,
      customerContactInfo: row.customer_contact_info ?? undefined,
      aiAnalysis: row.ai_analysis ?? null,
    }));
  } catch (err) {
    console.error('顧客マスタの取得に失敗しました:', err);
    return null;
  }
};

export const getCustomers = async (): Promise<Customer[]> => {
  if (hasSupabaseCredentials()) {
    const supabaseCustomers = await fetchCustomersFromSupabase();
    if (supabaseCustomers) {
      return supabaseCustomers;
    }
  }
  return deepClone(demoState.customers);
};

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

export const getApprovalRoutes = async (): Promise<ApprovalRoute[]> => {
  if (hasSupabaseCredentials()) {
    try {
      const supabaseClient = getSupabase();
      const { data, error } = await supabaseClient
        .from('approval_routes')
        .select('id, name, route_data, created_at')
        .order('name', { ascending: true });

      if (error) {
        if (isSupabaseUnavailableError(error)) {
          logSupabaseUnavailableWarning('承認ルートの取得', error);
          return deepClone(demoState.approvalRoutes);
        }
        if (isRelationNotFoundError(error) || isColumnNotFoundError(error)) {
          console.warn('approval_routesテーブルが見つかりません。デモデータにフォールバックします。', error);
          return deepClone(demoState.approvalRoutes);
        }
        throw error;
      }

      if (data && data.length > 0) {
        const routes = data.map(row => ({
          id: row.id,
          name: row.name || '名称未設定',
          routeData: row.route_data || { steps: [] },
          createdAt: row.created_at || new Date().toISOString(),
        }));
        // demoStateを更新してmapApplicationDetailsで使えるようにする
        demoState.approvalRoutes = routes;
        return routes;
      }
    } catch (error) {
      if (isSupabaseUnavailableError(error)) {
        logSupabaseUnavailableWarning('承認ルートの取得', error);
        return deepClone(demoState.approvalRoutes);
      }
      throw error;
    }
  }
  return deepClone(demoState.approvalRoutes);
};

export const addApprovalRoute = async (route: Omit<ApprovalRoute, 'id' | 'createdAt'>): Promise<ApprovalRoute> => {
  if (hasSupabaseCredentials()) {
    try {
      const supabaseClient = getSupabase();
      const { data, error } = await supabaseClient
        .from('approval_routes')
        .insert({
          name: route.name,
          route_data: route.routeData,
        })
        .select('id, name, route_data, created_at')
        .single();

      if (error) {
        throw error;
      }

      if (data) {
        return {
          id: data.id,
          name: data.name,
          routeData: data.route_data,
          createdAt: data.created_at,
        };
      }
    } catch (error) {
      console.error('承認ルートの作成に失敗しました:', error);
      throw error;
    }
  }

  // Fallback to demo data
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
  if (hasSupabaseCredentials()) {
    try {
      const supabaseClient = getSupabase();
      const updateData: any = {};
      if (updates.name) updateData.name = updates.name;
      if (updates.routeData) updateData.route_data = updates.routeData;

      const { data, error } = await supabaseClient
        .from('approval_routes')
        .update(updateData)
        .eq('id', id)
        .select('id, name, route_data, created_at')
        .single();

      if (error) {
        throw error;
      }

      if (data) {
        return {
          id: data.id,
          name: data.name,
          routeData: data.route_data,
          createdAt: data.created_at,
        };
      }
    } catch (error) {
      console.error('承認ルートの更新に失敗しました:', error);
      throw error;
    }
  }

  // Fallback to demo data
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
  if (hasSupabaseCredentials()) {
    try {
      const supabaseClient = getSupabase();
      const { error } = await supabaseClient
        .from('approval_routes')
        .delete()
        .eq('id', id);

      if (error) {
        throw error;
      }
      return;
    } catch (error) {
      console.error('承認ルートの削除に失敗しました:', error);
      throw error;
    }
  }

  // Fallback to demo data
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
  if (hasSupabaseCredentials()) {
    try {
      const supabaseClient = getSupabase();
      const { data, error } = await supabaseClient
        .from('applications')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        if (isSupabaseUnavailableError(error)) {
          logSupabaseUnavailableWarning('申請一覧の取得', error);
          return deepClone(demoState.applications.map(mapApplicationDetails));
        }
        if (isRelationNotFoundError(error) || isColumnNotFoundError(error)) {
          console.warn('applicationsテーブルが見つかりません。デモデータにフォールバックします。', error);
          return deepClone(demoState.applications.map(mapApplicationDetails));
        }
        throw error;
      }

      if (data && data.length > 0) {
        const applications: Application[] = data.map(row => ({
          id: row.id,
          applicantId: row.applicant_id,
          applicationCodeId: row.application_code_id,
          formData: row.form_data,
          status: row.status,
          submittedAt: row.submitted_at,
          approvedAt: row.approved_at,
          rejectedAt: row.rejected_at,
          currentLevel: row.current_level,
          approverId: row.approver_id,
          rejectionReason: row.rejection_reason,
          approvalRouteId: row.approval_route_id,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }));
        
        return deepClone(applications.map(mapApplicationDetails));
      }
    } catch (error) {
      if (isSupabaseUnavailableError(error)) {
        logSupabaseUnavailableWarning('申請一覧の取得', error);
        return deepClone(demoState.applications.map(mapApplicationDetails));
      }
      throw error;
    }
  }
  return deepClone(demoState.applications.map(mapApplicationDetails));
};

export const getApplicationEmailNotifications = async (): Promise<ApplicationNotificationEmail[]> => {
    return deepClone(demoState.applicationEmailNotifications);
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
  const now = new Date().toISOString();
  const status = payload.status ?? 'pending_approval';
  const currentLevel = payload.currentLevel ?? (status === 'pending_approval' ? 1 : 0);

  if (hasSupabaseCredentials()) {
    try {
      const supabaseClient = getSupabase();
      
      // Resolve application_code_id: if it's not a UUID, look it up by code
      let resolvedApplicationCodeId = payload.applicationCodeId;
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      
      if (!uuidRegex.test(payload.applicationCodeId)) {
        // It's a code, not a UUID - look up the actual ID
        // Extract the actual code (e.g., "code-lev" -> "LEV", "code-exp" -> "EXP")
        let searchCode = payload.applicationCodeId;
        if (searchCode.startsWith('code-')) {
          searchCode = searchCode.substring(5).toUpperCase(); // Remove "code-" prefix and uppercase
        }
        
        const { data: codeData, error: codeError } = await supabaseClient
          .from('application_codes')
          .select('id')
          .eq('code', searchCode)
          .single();
        
        if (codeError || !codeData) {
          throw new Error(`申請コード「${payload.applicationCodeId}」(検索: ${searchCode})が見つかりません`);
        }
        
        resolvedApplicationCodeId = codeData.id;
      }
      
      // Get approval route to determine first approver
      const { data: routeData, error: routeError } = await supabaseClient
        .from('approval_routes')
        .select('route_data')
        .eq('id', payload.approvalRouteId)
        .single();

      if (routeError) {
        throw new Error(`承認ルートの取得に失敗しました: ${routeError.message}`);
      }

      const approverId = payload.approverId ?? routeData?.route_data?.steps?.[currentLevel - 1]?.approverId ?? null;

      // Insert application
      const { data, error } = await supabaseClient
        .from('applications')
        .insert({
          applicant_id: applicantId,
          application_code_id: resolvedApplicationCodeId,
          form_data: payload.formData,
          status,
          submitted_at: status === 'draft' ? null : (payload.submittedAt ?? now),
          approved_at: null,
          rejected_at: null,
          current_level: currentLevel,
          approver_id: approverId,
          rejection_reason: payload.rejectionReason ?? null,
          approval_route_id: payload.approvalRouteId,
        })
        .select('*')
        .single();

      if (error) {
        console.error('Supabase INSERT error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }

      if (data) {
        const application: Application = {
          id: data.id,
          applicantId: data.applicant_id,
          applicationCodeId: data.application_code_id,
          formData: data.form_data,
          status: data.status,
          submittedAt: data.submitted_at,
          approvedAt: data.approved_at,
          rejectedAt: data.rejected_at,
          currentLevel: data.current_level,
          approverId: data.approver_id,
          rejectionReason: data.rejection_reason,
          approvalRouteId: data.approval_route_id,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        };
        
        // Note: Email notifications would need to be implemented separately
        // await createApplicationNotificationEmails(application);
        
        return deepClone(mapApplicationDetails(application));
      }
    } catch (error) {
      console.error('申請の提出に失敗しました:', error);
      throw error;
    }
  }

  // Fallback to demo data
  const route = findById(demoState.approvalRoutes, payload.approvalRouteId, '承認ルート');
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
  await createApplicationNotificationEmails(application);
  return deepClone(mapApplicationDetails(application));
};

// 経費申請承認後の会計処理
const processExpenseApproval = async (application: ApplicationWithDetails) => {
  const formData = application.formData as any;
  const details = formData.details || [];
  
  // 各明細行から仕訳を生成
  for (const detail of details) {
    if (!detail.accountItemId || !detail.amount) continue;
    
    const paymentDate = detail.paymentDate || new Date().toISOString().split('T')[0];
    
    // 仕訳エントリーを生成
    const journalEntry: Omit<JournalEntry, 'id'> = {
      date: paymentDate,
      account: detail.accountItemId,
      debit: detail.amount,
      credit: 0,
      description: detail.description || '経費精算',
    };
    
    await addJournalEntry(journalEntry);
    
    // 貸方（未払金）の仕訳も追加
    const creditEntry: Omit<JournalEntry, 'id'> = {
      date: paymentDate,
      account: '2110', // 未払金
      debit: 0,
      credit: detail.amount,
      description: detail.description || '経費精算',
    };
    
    await addJournalEntry(creditEntry);
    
    // MQ計算用のジョブを追加（mqCodeが完全な場合）
    if (detail.mqCode && detail.mqCode.p && detail.mqCode.v && detail.mqCode.m && detail.mqCode.q) {
      const mqJob = {
        id: `mq_${application.id}_${detail.id}`,
        applicationId: application.id,
        detailId: detail.id,
        mqCode: detail.mqCode,
        amount: detail.amount,
        paymentDate: paymentDate,
        status: 'pending' as const,
        createdAt: new Date().toISOString(),
      };
      
      // MQジョブキューに追加（実装されている場合）
      console.log('[MQ計算] ジョブ追加:', mqJob);
    }
  }
  
  console.log(`[経費承認] ${details.length}件の明細を処理しました`);
};

export const approveApplication = async (application: ApplicationWithDetails, approver: EmployeeUser): Promise<ApplicationWithDetails> => {
  const now = new Date().toISOString();
  
  if (hasSupabaseCredentials()) {
    try {
      const supabaseClient = getSupabase();
      const { data, error } = await supabaseClient
        .from('applications')
        .update({
          status: 'approved',
          approved_at: now,
          rejected_at: null,
          rejection_reason: null,
          current_level: (application.currentLevel ?? 0) + 1,
          approver_id: approver.id,
          updated_at: now,
        })
        .eq('id', application.id)
        .select('*')
        .single();

      if (error) {
        throw error;
      }

      if (data) {
        const updatedApp: Application = {
          id: data.id,
          applicantId: data.applicant_id,
          applicationCodeId: data.application_code_id,
          formData: data.form_data,
          status: data.status,
          submittedAt: data.submitted_at,
          approvedAt: data.approved_at,
          rejectedAt: data.rejected_at,
          currentLevel: data.current_level,
          approverId: data.approver_id,
          rejectionReason: data.rejection_reason,
          approvalRouteId: data.approval_route_id,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        };
        
        // 経費申請の場合は会計処理を実行
        const appDetails = mapApplicationDetails(updatedApp);
        if (appDetails.applicationCode?.code === 'EXP' || appDetails.applicationCode?.code === 'TRP') {
          await processExpenseApproval(appDetails);
        }
        
        return deepClone(appDetails);
      }
      
      throw new Error('承認処理後のデータ取得に失敗しました');
    } catch (error) {
      console.error('申請の承認に失敗しました:', error);
      throw error;
    }
  }

  // Fallback to demo data
  const stored = findById(demoState.applications, application.id, '申請');
  stored.status = 'approved';
  stored.approvedAt = now;
  stored.rejectedAt = null;
  stored.rejectionReason = null;
  stored.currentLevel = (stored.currentLevel ?? 0) + 1;
  stored.approverId = approver.id;
  stored.updatedAt = now;
  await createApplicationStatusChangeEmails(stored);
  
  // 経費申請の場合は会計処理を実行
  const appDetails = mapApplicationDetails(stored);
  if (appDetails.applicationCode?.code === 'EXP' || appDetails.applicationCode?.code === 'TRP') {
    await processExpenseApproval(appDetails);
  }
  
  return deepClone(appDetails);
};

export const rejectApplication = async (application: ApplicationWithDetails, reason: string, approver: EmployeeUser): Promise<ApplicationWithDetails> => {
  const now = new Date().toISOString();
  
  if (hasSupabaseCredentials()) {
    try {
      const supabaseClient = getSupabase();
      const { data, error } = await supabaseClient
        .from('applications')
        .update({
          status: 'rejected',
          rejected_at: now,
          approved_at: null,
          rejection_reason: reason,
          approver_id: approver.id,
          updated_at: now,
        })
        .eq('id', application.id)
        .select('*')
        .single();

      if (error) {
        throw error;
      }

      if (data) {
        const updatedApp: Application = {
          id: data.id,
          applicantId: data.applicant_id,
          applicationCodeId: data.application_code_id,
          formData: data.form_data,
          status: data.status,
          submittedAt: data.submitted_at,
          approvedAt: data.approved_at,
          rejectedAt: data.rejected_at,
          currentLevel: data.current_level,
          approverId: data.approver_id,
          rejectionReason: data.rejection_reason,
          approvalRouteId: data.approval_route_id,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        };
        return deepClone(mapApplicationDetails(updatedApp));
      }
      
      throw new Error('否認処理後のデータ取得に失敗しました');
    } catch (error) {
      console.error('申請の否認に失敗しました:', error);
      throw error;
    }
  }

  // Fallback to demo data
  const stored = findById(demoState.applications, application.id, '申請');
  stored.status = 'rejected';
  stored.rejectedAt = now;
  stored.approvedAt = null;
  stored.rejectionReason = reason;
  stored.approverId = approver.id;
  stored.updatedAt = now;
  await createApplicationStatusChangeEmails(stored);
  return deepClone(mapApplicationDetails(stored));
};

export const getApplicationCodes = async (): Promise<ApplicationCode[]> => {
  if (hasSupabaseCredentials()) {
    try {
      const supabaseClient = getSupabase();
      const { data, error } = await supabaseClient
        .from('application_codes')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        if (isSupabaseUnavailableError(error)) {
          logSupabaseUnavailableWarning('申請種別の取得', error);
          return deepClone(demoState.applicationCodes);
        }
        if (isRelationNotFoundError(error) || isColumnNotFoundError(error)) {
          console.warn('application_codesテーブルが見つかりません。デモデータにフォールバックします。', error);
          return deepClone(demoState.applicationCodes);
        }
        throw error;
      }

      if (data && data.length > 0) {
        const codes: ApplicationCode[] = data.map(row => ({
          id: row.id,
          code: row.code,
          name: row.name,
          description: row.description || '',
          createdAt: row.created_at,
        }));
        
        // Update demoState cache
        demoState.applicationCodes = codes;
        
        return deepClone(codes);
      }
    } catch (error) {
      if (isSupabaseUnavailableError(error)) {
        logSupabaseUnavailableWarning('申請種別の取得', error);
        return deepClone(demoState.applicationCodes);
      }
      throw error;
    }
  }
  return deepClone(demoState.applicationCodes);
};

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

export const getTitles = async (): Promise<Title[]> => {
  if (hasSupabaseCredentials()) {
    try {
      const supabaseClient = getSupabase();
      const { data, error } = await supabaseClient
        .from('employee_titles')
        .select('id, name, is_active, created_at')
        .order('name', { ascending: true });

      if (error) {
        if (isSupabaseUnavailableError(error)) {
          logSupabaseUnavailableWarning('役職マスタの取得', error);
          return deepClone(titles);
        }
        if (isRelationNotFoundError(error) || isColumnNotFoundError(error)) {
          console.warn('employee_titlesテーブルが見つかりません。デモデータにフォールバックします。', error);
          return deepClone(titles);
        }
        throw error;
      }

      if (data && data.length > 0) {
        return data.map(row => ({
          id: row.id,
          name: row.name || '名称未設定',
          isActive: row.is_active ?? true,
          createdAt: row.created_at || new Date().toISOString(),
        }));
      }
    } catch (error) {
      if (isSupabaseUnavailableError(error)) {
        logSupabaseUnavailableWarning('役職マスタの取得', error);
        return deepClone(titles);
      }
      throw error;
    }
  }
  return deepClone(titles);
};

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

export const getInboxItems = async (): Promise<InboxItem[]> => {
    if (hasSupabaseCredentials()) {
        const supabaseClient = getSupabase();
        const { data, error } = await supabaseClient
            .from('inbox_items')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw new Error(`インボックスアイテムの取得に失敗しました: ${error.message}`);
        
        return (data || []).map(item => ({
            id: item.id,
            fileName: item.file_name,
            filePath: item.file_path,
            fileUrl: supabaseClient.storage.from('inbox').getPublicUrl(item.file_path).data.publicUrl,
            mimeType: item.mime_type,
            status: item.status as InboxItemStatus,
            extractedData: item.extracted_data,
            errorMessage: item.error_message,
            createdAt: item.created_at,
        }));
    }
    return deepClone(demoState.inboxItems);
};

export const addInboxItem = async (item: Omit<InboxItem, 'id' | 'createdAt' | 'fileUrl'> & { fileUrl?: string }): Promise<InboxItem> => {
    if (hasSupabaseCredentials()) {
        const supabaseClient = getSupabase();
        const { data, error } = await supabaseClient
            .from('inbox_items')
            .insert({
                file_name: item.fileName,
                file_path: item.filePath,
                mime_type: item.mimeType,
                status: item.status,
                extracted_data: item.extractedData,
                error_message: item.errorMessage,
            })
            .select()
            .single();
        
        if (error) throw new Error(`インボックスアイテムの追加に失敗しました: ${error.message}`);
        
        return {
            id: data.id,
            fileName: data.file_name,
            filePath: data.file_path,
            fileUrl: supabaseClient.storage.from('inbox').getPublicUrl(data.file_path).data.publicUrl,
            mimeType: data.mime_type,
            status: data.status as InboxItemStatus,
            extractedData: data.extracted_data,
            errorMessage: data.error_message,
            createdAt: data.created_at,
        };
    }
    
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
    if (hasSupabaseCredentials()) {
        const supabaseClient = getSupabase();
        const dbUpdates: any = {};
        if (updates.status) dbUpdates.status = updates.status;
        if (updates.extractedData !== undefined) dbUpdates.extracted_data = updates.extractedData;
        if (updates.errorMessage !== undefined) dbUpdates.error_message = updates.errorMessage;
        
        const { data, error } = await supabaseClient
            .from('inbox_items')
            .update(dbUpdates)
            .eq('id', id)
            .select()
            .single();
        
        if (error) throw new Error(`インボックスアイテムの更新に失敗しました: ${error.message}`);
        
        return {
            id: data.id,
            fileName: data.file_name,
            filePath: data.file_path,
            fileUrl: supabaseClient.storage.from('inbox').getPublicUrl(data.file_path).data.publicUrl,
            mimeType: data.mime_type,
            status: data.status as InboxItemStatus,
            extractedData: data.extracted_data,
            errorMessage: data.error_message,
            createdAt: data.created_at,
        };
    }
    
    const item = findById(demoState.inboxItems, id, 'インボックス項目');
    Object.assign(item, updates);
    return deepClone(item);
};

export const deleteInboxItem = async (item: InboxItem): Promise<void> => {
    if (hasSupabaseCredentials()) {
        const supabaseClient = getSupabase();
        
        // Delete file from storage
        const { error: storageError } = await supabaseClient.storage
            .from('inbox')
            .remove([item.filePath]);
        
        if (storageError) console.warn('ストレージからのファイル削除に失敗しました:', storageError);
        
        // Delete record from database
        const { error } = await supabaseClient
            .from('inbox_items')
            .delete()
            .eq('id', item.id);
        
        if (error) throw new Error(`インボックスアイテムの削除に失敗しました: ${error.message}`);
        return;
    }
    
    demoState.inboxItems = demoState.inboxItems.filter(i => i.id !== item.id);
};

export const uploadFile = async (file: File, bucket: string): Promise<{ path: string; url: string }> => {
    if (hasSupabaseCredentials()) {
        const supabaseClient = getSupabase();
        const identifier = uuidv4();
        const fileName = file.name ?? `${identifier}.bin`;
        const path = `${identifier}-${fileName}`;
        
        const { data, error } = await supabaseClient.storage
            .from(bucket)
            .upload(path, file, {
                cacheControl: '3600',
                upsert: false,
            });
        
        if (error) throw new Error(`ファイルのアップロードに失敗しました: ${error.message}`);
        
        const { data: urlData } = supabaseClient.storage.from(bucket).getPublicUrl(path);
        
        return {
            path,
            url: urlData.publicUrl,
        };
    }
    
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