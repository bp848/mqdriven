// services/estimateManagementService.ts
import { createSupabaseBrowser } from '../lib/supabase';
import { Estimate } from '../types';

export interface SaveEstimateRequest {
  leadId: string;
  estimateData: {
    title: string;
    items: Array<{
      name: string;
      description: string;
      quantity: number;
      unit: string;
      unitPrice: number;
      subtotal: number;
    }>;
    subtotal: number;
    taxRate: number;
    taxAmount: number;
    totalAmount: number;
    validUntil?: string;
    notes: string;
  };
  customerInfo: {
    name: string;
    email: string;
    phone: string;
    address: string;
  };
}

export const saveEstimateToManagement = async (request: SaveEstimateRequest): Promise<any> => {
  try {
    const supabase = createSupabaseBrowser();
    const documentNumber = `EST-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
    
    const estimateData = {
      estimates_id: documentNumber,
      project_id: request.customerInfo.name,
      pattern_no: '1',
      pattern_name: request.estimateData.title,
      specification: request.estimateData.notes,
      copies: 1,
      unit_price: request.estimateData.totalAmount,
      tax_rate: request.estimateData.taxRate * 100,
      total: request.estimateData.totalAmount.toString(),
      subtotal: request.estimateData.subtotal.toString(),
      consumption: request.estimateData.taxAmount.toString(),
      delivery_date: request.estimateData.validUntil,
      expiration_date: request.estimateData.validUntil,
      delivery_place: '',
      transaction_method: '',
      note: request.estimateData.notes,
      status: '0', // draft
      create_id: 'current-user',
      create_date: new Date().toISOString(),
      update_id: 'current-user',
      update_date: new Date().toISOString(),
      valiable_cost: '0',
      margin: '0',
      margin_rate: '0'
    };

    const { data, error } = await supabase
      .from('estimates')
      .insert(estimateData)
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      throw new Error(`見積の保存に失敗しました: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('見積の保存エラー:', error);
    throw error;
  }
};

export const getEstimatesByLeadId = async (leadId: string): Promise<any[]> => {
  try {
    const supabase = createSupabaseBrowser();
    const { data, error } = await supabase
      .from('estimates')
      .select('*')
      .eq('project_id', leadId)
      .order('create_date', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      throw new Error(`見積の取得に失敗しました: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error('見積の取得エラー:', error);
    throw error;
  }
};

export const updateEstimateStatus = async (estimateId: string, status: string): Promise<void> => {
  try {
    const supabase = createSupabaseBrowser();
    const { error } = await supabase
      .from('estimates')
      .update({ 
        status,
        update_date: new Date().toISOString()
      })
      .eq('id', estimateId);

    if (error) {
      console.error('Supabase error:', error);
      throw new Error(`ステータスの更新に失敗しました: ${error.message}`);
    }
  } catch (error) {
    console.error('ステータス更新エラー:', error);
    throw error;
  }
};

export const deleteEstimate = async (estimateId: string): Promise<void> => {
  try {
    const supabase = createSupabaseBrowser();
    const { error } = await supabase
      .from('estimates')
      .delete()
      .eq('id', estimateId);

    if (error) {
      console.error('Supabase error:', error);
      throw new Error(`見積の削除に失敗しました: ${error.message}`);
    }
  } catch (error) {
    console.error('見積の削除エラー:', error);
    throw error;
  }
};
