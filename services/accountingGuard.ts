/**
 * 莨夊ｨ医ョ繝ｼ繧ｿ縺ｮ謨ｴ蜷域ｧ繧貞ｮ医ｋ繧ｬ繝ｼ繝峨Ξ繝ｼ繝ｫ
 * 莠区腐髦ｲ豁｢縺ｮ縺溘ａ縺ｮ迚ｩ逅・噪蛻ｶ髯・
 */

import { getSupabase } from './supabaseClient';
import { AccountingStatus } from '../types';

/**
 * 莉戊ｨｳ繧ｹ繝・・繧ｿ繧ｹ譖ｴ譁ｰ縺ｮ繧ｬ繝ｼ繝峨Ξ繝ｼ繝ｫ
 */
export class AccountingStatusGuard {
  /**
   * posted縺ｸ縺ｮ驕ｷ遘ｻ縺ｯdraft縺九ｉ縺ｮ縺ｿ險ｱ蜿ｯ
   */
  static async canTransitionToPosted(journalId: string): Promise<boolean> {
    const supabase = getSupabase();
    
    // 迴ｾ蝨ｨ縺ｮ繧ｹ繝・・繧ｿ繧ｹ繧堤｢ｺ隱・
    const { data: journal, error } = await supabase
      .from('journal_entries')
      .select('status, accounting_status')
      .eq('id', journalId)
      .single();
    
    if (error || !journal) {
      throw new Error('仕訳が見つかりません。');
    }
    
    // draft縺九ｉposted縺ｸ縺ｮ驕ｷ遘ｻ縺ｮ縺ｿ險ｱ蜿ｯ
    return journal.status === 'draft' && 
           (!journal.accounting_status || journal.accounting_status === AccountingStatus.DRAFT);
  }
  
  /**
   * posted莉戊ｨｳ縺ｮ譖ｴ譁ｰ繝ｻ蜑企勁繧堤ｦ∵ｭ｢
   */
  static async preventPostedModification(journalId: string): Promise<void> {
    const supabase = getSupabase();
    
    const { data: journal, error } = await supabase
      .from('journal_entries')
      .select('status, accounting_status')
      .eq('id', journalId)
      .single();
    
    if (error || !journal) {
      throw new Error('仕訳が見つかりません。');
    }
    
    if (journal.status === 'posted' || journal.accounting_status === AccountingStatus.POSTED) {
      throw new Error('確定済み仕訳は変更できません。修正するには再オープンが必要です。');
    }
  }
  
  /**
   * 邱蜃ｦ逅・悄髢薙・繝√ぉ繝・け
   */
  static async checkPeriodLock(date: string): Promise<boolean> {
    const supabase = getSupabase();
    
    // 謖・ｮ壽怦縺檎ｷ蜃ｦ逅・ｸ医∩縺九メ繧ｧ繝・け
    const targetMonth = date.substring(0, 7); // YYYY-MM
    
    const { data: lock, error } = await supabase
      .from('period_locks')
      .select('is_locked')
      .eq('period', targetMonth)
      .eq('is_locked', true)
      .single();
    
    // 邱蜃ｦ逅・ｸ医∩縺ｪ繧映alse
    return !(lock && !error);
  }
  
  /**
   * 逕ｳ隲九・莨夊ｨ医せ繝・・繧ｿ繧ｹ驕ｷ遘ｻ繧ｬ繝ｼ繝・
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
      throw new Error('申請が見つかりません。');
    }
    
    // 讌ｭ蜍呎価隱肴ｸ医∩縺ｮ縺ｿ莨夊ｨ亥・逅・庄閭ｽ
    if (app.status !== 'approved') {
      throw new Error('承認済み申請のみ会計状態を変更できます。');
    }
    
    const current = app.accounting_status || AccountingStatus.NONE;
    
    // 迥ｶ諷矩・遘ｻ繝ｫ繝ｼ繝ｫ
    const allowedTransitions: Record<AccountingStatus, AccountingStatus[]> = {
      [AccountingStatus.NONE]: [AccountingStatus.DRAFT],
      [AccountingStatus.DRAFT]: [AccountingStatus.POSTED],
      [AccountingStatus.POSTED]: [], // posted後は変更不可
    };
    
    return allowedTransitions[current]?.includes(newStatus) || false;
  }
}

/**
 * 邱丞鋸螳壼・蟶ｳ縺ｮ繧ｬ繝ｼ繝峨Ξ繝ｼ繝ｫ
 */
export class GeneralLedgerGuard {
  /**
   * posted莉戊ｨｳ縺ｮ縺ｿ繧貞叙蠕励☆繧九け繧ｨ繝ｪ繝薙Ν繝繝ｼ
   */
  static buildPostedOnlyQuery() {
    return {
      status: 'posted',
      accounting_status: AccountingStatus.POSTED
    };
  }
  
  /**
   * GL繝・・繧ｿ蜿門ｾ玲凾縺ｮ蠢・医メ繧ｧ繝・け
   */
  static async validateGLData(data: any[]): Promise<void> {
    const invalidEntries = data.filter(entry => 
      entry.status !== 'posted' || 
      entry.accounting_status !== AccountingStatus.POSTED
    );
    
    if (invalidEntries.length > 0) {
      throw new Error(`未確定の仕訳が ${invalidEntries.length} 件含まれています。GL は posted のみ表示可能です。`);
    }
  }
}

