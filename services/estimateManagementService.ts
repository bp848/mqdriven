// services/estimateManagementService.ts
import { createSupabaseBrowser } from '../lib/supabase';
import { Estimate, CreateEstimateRequest, EstimateFilters } from '../types/estimate';

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

export const saveEstimateToManagement = async (request: SaveEstimateRequest): Promise<Estimate> => {
  try {
    const supabase = createSupabaseBrowser();
    const documentNumber = `EST-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
    
    const estimateData = {
      lead_id: request.leadId,
      document_number: documentNumber,
      document_type: 'estimate' as const,
      status: 'draft' as const,
      customer_name: request.customerInfo.name,
      customer_email: request.customerInfo.email,
      customer_phone: request.customerInfo.phone,
      customer_address: request.customerInfo.address,
      title: request.estimateData.title,
      content: request.estimateData.items.map(item => ({
        id: Math.random().toString(36).substr(2, 9),
        itemName: item.name,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        discountRate: 0,
        subtotal: item.subtotal
      })),
      subtotal: request.estimateData.subtotal,
      tax_rate: request.estimateData.taxRate,
      tax_amount: request.estimateData.taxAmount,
      total_amount: request.estimateData.totalAmount,
      issue_date: new Date().toISOString().split('T')[0],
      valid_until: request.estimateData.validUntil,
      notes: request.estimateData.notes,
      created_by: 'current-user', // TODO: 実際のユーザーIDを取得
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('estimate_invoices')
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

export const getEstimatesByLeadId = async (leadId: string): Promise<Estimate[]> => {
  try {
    const supabase = createSupabaseBrowser();
    const { data, error } = await supabase
      .from('estimate_invoices')
      .select('*')
      .eq('lead_id', leadId)
      .eq('document_type', 'estimate')
      .order('created_at', { ascending: false });

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

export const updateEstimateStatus = async (estimateId: string, status: Estimate['status']): Promise<void> => {
  try {
    const supabase = createSupabaseBrowser();
    const { error } = await supabase
      .from('estimate_invoices')
      .update({ 
        status,
        updated_at: new Date().toISOString()
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
      .from('estimate_invoices')
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
