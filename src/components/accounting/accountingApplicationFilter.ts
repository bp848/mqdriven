import type { ApplicationWithDetails } from '../../../types';

const EXCLUDED_APPLICATION_CODE_SET = new Set(['LEV', 'DLY', 'WKR', 'ATT', 'MNH', 'LBR']);
const EXCLUDED_NAME_KEYWORDS = ['休暇', '勤怠', '工数', '人件費', '日報', '週報'];

export const isAccountingTargetApplication = (app: ApplicationWithDetails): boolean => {
  const code = app.application_code?.code?.trim().toUpperCase() || '';
  if (code && EXCLUDED_APPLICATION_CODE_SET.has(code)) return false;

  const name = app.application_code?.name?.trim() || '';
  if (!name) return true;
  return !EXCLUDED_NAME_KEYWORDS.some(keyword => name.includes(keyword));
};

