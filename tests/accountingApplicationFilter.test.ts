import { describe, expect, it } from 'vitest';
import { isAccountingTargetApplication } from '../src/components/accounting/accountingApplicationFilter';

const buildApp = (code?: string, name?: string) => ({
  id: 'app-1',
  application_code: code || name ? { code: code ?? '', name: name ?? '' } : undefined,
}) as any;

describe('isAccountingTargetApplication', () => {
  it('returns false for leave and attendance related codes', () => {
    expect(isAccountingTargetApplication(buildApp('LEV', '休暇申請'))).toBe(false);
    expect(isAccountingTargetApplication(buildApp('ATT', '勤怠申請'))).toBe(false);
    expect(isAccountingTargetApplication(buildApp('DLY', '日報'))).toBe(false);
  });

  it('returns false when application name contains excluded keywords', () => {
    expect(isAccountingTargetApplication(buildApp('OTHER', '工数管理申請'))).toBe(false);
    expect(isAccountingTargetApplication(buildApp(undefined, '人件費登録'))).toBe(false);
  });

  it('returns true for accounting related applications', () => {
    expect(isAccountingTargetApplication(buildApp('EXP', '経費精算'))).toBe(true);
    expect(isAccountingTargetApplication(buildApp('TRP', '交通費申請'))).toBe(true);
    expect(isAccountingTargetApplication(buildApp(undefined, undefined))).toBe(true);
  });
});
