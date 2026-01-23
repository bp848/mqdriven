/**
 * 会計データの整合性を守るガードレール
 * 事故防止のための物理的制限
 */

import { getSupabase } from './supabaseClient';
import { AccountingStatus } from '../types';

/**
 * 仕訳ステータス更新のガードレール
 */
export class AccountingStatusGuard {
  /**
   * postedへの遷移はdraftからのみ許可
   */
  static async canTransitionToPosted(journalId: string): Promise<boolean> {
    const supabase = getSupabase();
    
    // 現在のステータスを確認
    const { data: journal, error } = await supabase
      .from('journal_entries')
      .select('status, accounting_status')
      .eq('id', journalId)
      .single();
    
    if (error || !journal) {
      throw new Error('仕訳が見つかりません');
    }
    
    // draftからpostedへの遷移のみ許可
    return journal.status === 'draft' && 
           (!journal.accounting_status || journal.accounting_status === AccountingStatus.DRAFT);
  }
  
  /**
   * posted仕訳の更新・削除を禁止
   */
  static async preventPostedModification(journalId: string): Promise<void> {
    const supabase = getSupabase();
    
    const { data: journal, error } = await supabase
      .from('journal_entries')
      .select('status, accounting_status')
      .eq('id', journalId)
      .single();
    
    if (error || !journal) {
      throw new Error('仕訳が見つかりません');
    }
    
    if (journal.status === 'posted' || journal.accounting_status === AccountingStatus.POSTED) {
      throw new Error('確定済み仕訳は変更できません。修正仕訳を作成してください。');
    }
  }
  
  /**
   * 締処理期間のチェック
   */
  static async checkPeriodLock(date: string): Promise<boolean> {
    const supabase = getSupabase();
    
    // 指定月が締処理済みかチェック
    const targetMonth = date.substring(0, 7); // YYYY-MM
    
    const { data: lock, error } = await supabase
      .from('period_locks')
      .select('is_locked')
      .eq('period', targetMonth)
      .eq('is_locked', true)
      .single();
    
    // 締処理済みならfalse
    return !(lock && !error);
  }
  
  /**
   * 申請の会計ステータス遷移ガード
   */
  static async canUpdateApplicationStatus(
    applicationId: string, 
    newStatus: AccountingStatus
  ): Promise<boolean> {
    const supabase = getSupabase();
    
    const { data: app, error } = await supabase
      .from('applications')
      .select('status, accounting_status')
      .eq('id', applicationId)
      .single();
    
    if (error || !app) {
      throw new Error('申請が見つかりません');
    }
    
    // 業務承認済みのみ会計処理可能
    if (app.status !== 'approved') {
      throw new Error('業務承認済みの申請のみ会計処理できます');
    }
    
    const current = app.accounting_status || AccountingStatus.NONE;
    
    // 状態遷移ルール
    const allowedTransitions: Record<AccountingStatus, AccountingStatus[]> = {
      [AccountingStatus.NONE]: [AccountingStatus.PENDING],
      [AccountingStatus.PENDING]: [AccountingStatus.DRAFT],
      [AccountingStatus.DRAFT]: [AccountingStatus.POSTED],
      [AccountingStatus.POSTED]: [], // 確定後は変更不可
      [AccountingStatus.LOCKED]: [],  // 締処理後は変更不可
    };
    
    return allowedTransitions[current]?.includes(newStatus) || false;
  }
}

/**
 * 総勘定元帳のガードレール
 */
export class GeneralLedgerGuard {
  /**
   * posted仕訳のみを取得するクエリビルダー
   */
  static buildPostedOnlyQuery() {
    return {
      status: 'posted',
      accounting_status: AccountingStatus.POSTED
    };
  }
  
  /**
   * GLデータ取得時の必須チェック
   */
  static async validateGLData(data: any[]): Promise<void> {
    const invalidEntries = data.filter(entry => 
      entry.status !== 'posted' || 
      entry.accounting_status !== AccountingStatus.POSTED
    );
    
    if (invalidEntries.length > 0) {
      throw new Error(`不正な仕訳が${invalidEntries.length}件含まれています。GLはposted仕訳のみ表示可能です。`);
    }
  }
}
