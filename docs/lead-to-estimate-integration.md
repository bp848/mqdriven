# リード詳細から見積もり管理へのデータ連携仕様

## 🎯 概要

リード詳細ページで作成・更新された見積データを、見積もり管理一覧に自動で連携する機能を実装します。

## 🔄 データフロー

### 現在のフロー
```
リード詳細ページ → 見積作成 → 手動保存 → 見積一覧に反映
```

### 新しいフロー
```
リード詳細ページ → 見積作成 → 自動保存 → 見積一覧に即時反映
```

## 🏗️ 実装仕様

### 1. リード詳細ページの拡張

#### 見積作成機能の強化
```typescript
// 既存のhandleSaveEstimate関数を拡張
const handleSaveEstimate = async () => {
  // 既存の見積保存ロジック
  const estimateData = { /* 既存の処理 */ };
  
  // 新規：見積もり管理APIに保存
  await saveEstimateToManagement(estimateData);
  
  // 成功時のフィードバック
  addToast('見積もりを管理一覧に保存しました', 'success');
};
```

#### API連携関数の追加
```typescript
// 新規サービス関数
import { saveEstimateToManagement } from '@/services/estimateManagementService';

interface SaveEstimateRequest {
  leadId: string;
  estimateData: EstimateData;
  customerInfo: CustomerInfo;
}

export const saveEstimateToManagement = async (request: SaveEstimateRequest): Promise<void> => {
  try {
    const response = await fetch('/api/estimates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`,
      },
      body: JSON.stringify({
        leadId: request.leadId,
        documentType: 'estimate',
        status: 'draft',
        customerName: request.customerInfo.name,
        customerEmail: request.customerInfo.email,
        customerPhone: request.customerInfo.phone,
        customerAddress: request.customerInfo.address,
        title: request.estimateData.title,
        content: request.estimateData.items,
        subtotal: request.estimateData.subtotal,
        taxRate: request.estimateData.taxRate,
        taxAmount: request.estimateData.taxAmount,
        totalAmount: request.estimateData.totalAmount,
        issueDate: new Date().toISOString(),
        validUntil: request.estimateData.validUntil,
        notes: request.estimateData.notes,
        createdBy: getCurrentUserId(),
      }),
    });

    if (!response.ok) {
      throw new Error('見積の保存に失敗しました');
    }

    return response.json();
  } catch (error) {
    console.error('見積の保存エラー:', error);
      throw error;
  }
};
```

### 2. 見積管理APIの実装

#### エンドポイント設計
```typescript
// /api/estimates エンドポイント
app.post('/api/estimates', async (req, res) => {
  // 見積の作成・更新・取得
});

// /api/estimates/:id エンドポイント
app.get('/api/estimates/:id', async (req, res) => {
  // 特定見積の取得
});

app.put('/api/estimates/:id', async (req, res) => {
  // 見積の更新
});

app.delete('/api/estimates/:id', async (req, res) => {
  // 見積の削除
});
```

#### データベース連携
```sql
-- 見積管理API用のストアドプロシージャ
CREATE OR REPLACE FUNCTION save_estimate_to_management()
RETURNS TRIGGER AS $$
BEGIN
  -- リード詳細ページからの見積データを保存
  INSERT INTO estimate_invoices (
    lead_id,
    document_type,
    status,
    customer_name,
    customer_email,
    customer_phone,
    customer_address,
    title,
    content,
    subtotal,
    tax_rate,
    tax_amount,
    total_amount,
    issue_date,
    valid_until,
    notes,
    created_by,
    created_at,
    updated_at
  )
  VALUES (
    NEW.lead_id,
    'estimate',
    NEW.status,
    NEW.customer_name,
    NEW.customer_email,
    NEW.customer_phone,
    NEW.customer_address,
    NEW.title,
    NEW.content,
    NEW.subtotal,
    NEW.tax_rate,
    NEW.tax_amount,
    NEW.total_amount,
    NEW.issue_date,
    NEW.valid_until,
    NEW.notes,
    NEW.created_by,
    NOW(),
    NOW()
  )
  RETURN NEW.id;
END;
$$ LANGUAGE plpgsql;
```

### 3. リアルタイム同期

#### WebSocket連携
```typescript
// リアルタイム同期機能
import { useEffect } from 'react';

const useRealTimeSync = (estimateId: string) => {
  useEffect(() => {
    const ws = new WebSocket(`${process.env.NEXT_PUBLIC_WS_URL}/estimates`);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'estimate_updated' && data.id === estimateId) {
        // 見積データを更新
        queryClient.invalidateQueries(['estimate', 'estimates']);
      }
    };
    
    return () => {
      ws.close();
    };
  }, [estimateId]);
};
```

### 4. UIコンポーネントの更新

#### リード詳細ページの修正
```typescript
// LeadDetailModal.tsxの修正
const LeadDetailModal = () => {
  // 見積保存後に管理一覧への連携を追加
  const handleSaveEstimate = async () => {
    try {
      // 既存の処理
      const estimateData = buildEstimateData();
      
      // 管理一覧に保存
      await saveEstimateToManagement({
        leadId: lead.id,
        estimateData,
        customerInfo: {
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          address: lead.address,
        }
      });
      
      // UIの更新
      setFormData(prev => ({
        ...prev,
        estimateSentAt: new Date().toISOString(),
        infoSalesActivity: updatedInfo
      }));
      
      addToast('見積もりを管理一覧に保存しました', 'success');
    } catch (error) {
      console.error('保存エラー:', error);
      addToast('保存に失敗しました', 'error');
    }
  };
};
```

## 🔧 API実装詳細

### 1. 見積管理APIルート
```typescript
// pages/api/estimates/route.ts
import { NextRequest, NextResponse } from 'next';

export default async function handler(req: NextRequest, res: NextResponse) {
  const { method } = req;
  
  switch (method) {
    case 'GET':
      return handleGetEstimates(req, res);
    case 'POST':
      return handleCreateEstimate(req, res);
    case 'PUT':
      return handleUpdateEstimate(req, res);
    case 'DELETE':
      return handleDeleteEstimate(req, res);
    default:
      res.setHeader('Allow', 'GET, POST, PUT, DELETE');
      res.setHeader('Content-Type', 'application/json');
      res.status(405).json({ error: 'Method not allowed' });
  }
}
```

### 2. データベース操作関数
```typescript
// services/estimateManagementService.ts
import { supabase } from '@/lib/supabase';

export class EstimateManagementService {
  static async createEstimate(estimateData: CreateEstimateRequest) {
    const { data, error } = await supabase
      .from('estimate_invoices')
      .insert(estimateData);
    
    if (error) throw error;
    return data;
  }
  
  static async updateEstimate(id: string, updates: Partial<Estimate>) {
    const { data, error } = await supabase
      .from('estimate_invoices')
      .update({ id, ...updates })
      .eq('id', id);
    
    if (error) throw error;
    return data;
  }
  
  static async getEstimates(filters?: EstimateFilters) {
    let query = supabase.from('estimate_invoices');
    
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    
    if (filters?.customerId) {
      query = query.eq('customer_id', filters.customerId);
    }
    
    const { data, error } = await query;
    return data || [];
  }
}
```

### 3. リアルタイム更新機能
```typescript
// hooks/useRealTimeEstimates.ts
import { useEffect, useState } from 'react';
import { EstimateManagementService } from '@/services/estimateManagementService';

export const useRealTimeEstimates = () => {
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  
  useEffect(() => {
    const loadEstimates = async () => {
      const data = await EstimateManagementService.getEstimates();
      setEstimates(data);
    };
    
    loadEstimates();
    
    // WebSocketでのリアルタイム更新
    const ws = new WebSocket(process.env.NEXT_PUBLIC_ESTIMATES_WS_URL);
    
    ws.onmessage = (event) => {
      const { type, data } = JSON.parse(event.data);
      
      if (type === 'estimate_created' || type === 'estimate_updated') {
        setEstimates(prev => {
          const index = prev.findIndex(e => e.id === data.id);
          if (index >= 0) {
            const updated = [...prev];
            updated[index] = data;
            return updated;
          }
          return [...prev, data];
        });
      }
    };
    
    return () => ws.close();
  }, []);
};
```

## 📱 UI/UX改善

### 1. 同期状態の表示
```tsx
// 保存状態の視覚的フィードバック
const [isSaving, setIsSaving] = useState(false);
const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

// 保存ボタン
<Button 
  onClick={handleSaveEstimate}
  disabled={isSaving}
  className="relative"
>
  {isSaving && <Loader className="w-4 h-4 mr-2 animate-spin" />}
  {isSaving ? '保存中...' : '管理一覧に保存'}
  {lastSavedAt && (
    <span className="text-xs text-green-600 ml-2">
      最終保存: {lastSavedAt.toLocaleString()}
    </span>
  )}
</Button>
```

### 2. エラーハンドリング
```tsx
// エラー表示と再試機能
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  if (error) {
    const timer = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(timer);
  }
}, [error]);

// エラー表示
{error && (
  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
    <div className="flex items-center">
      <AlertCircle className="w-5 h-5 mr-2" />
      <span>{error}</span>
      <button 
        onClick={() => setError(null)}
        className="ml-auto text-red-600 underline"
      >
        閉じる
      </button>
    </div>
)}
```

## 🚀 実装ステップ

### Phase 1: API基盤構築 (1週間)
1. 見積管理APIの実装
2. データベーススキーマの定義
3. 基本的なCRUD操作
4. エラーハンドリング

### Phase 2: リード詳細ページ連携 (1週間)
1. 見積保存機能の拡張
2. API連携サービスの実装
3. リアルタイム同期の追加
4. UIコンポーネントの更新

### Phase 3: 高度化機能 (2週間)
1. WebSocketでのリアルタイム更新
2. 分析機能の追加
3. 外部システム連携
4. パフォーマンス機能

## 📊 期待される効果

### 業務効率の向上
- **二重入力排除**: リード詳細と管理一覧のデータ同期
- **即時反映**: 見積作成後、即座に管理一覧に反映
- **作業時間削減**: 手動データ入力が不要に

### データ品質の向上
- **一貫性**: 単一のデータソースとAPI
- **整合性**: リード詳細と管理一覧のデータ整合
- **追跡性**: 完全な操作ログと監査証跡

### ユーザーエクスペリエンスの向上
- **シームレスな操作**: リード詳細から管理一覧への遷移が自然
- **リアルタイムフィードバック**: 即時の状態更新が視覚的に確認可能
- **エラー処理**: 適切なエラーメッセージとリカバリー機能

## 🔒 セキュリティ考慮

### データ保護
```typescript
// API認証ミドルウェア
import { NextRequest, NextResponse } from 'next';
import { getToken } from '@/lib/auth';

export function withAuth(handler: Function) {
  return async (req: NextRequest, res: NextResponse) => {
    const token = getToken(req);
    
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // ユーザー情報をリクエストに追加
    req.user = { id: token.userId };
    
    return handler(req, res);
  };
}
```

### アクセス制御
```typescript
// ロールベースの権限管理
enum UserRole {
  ADMIN = 'admin',
  SALES_MANAGER = 'sales_manager',
  SALES_STAFF = 'sales_staff',
  ACCOUNTING = 'accounting',
  READ_ONLY = 'read_only'
}

const permissions = {
  [UserRole.ADMIN]: ['create', 'read', 'update', 'delete', 'approve'],
  [UserRole.SALES_MANAGER]: ['create', 'read', 'update', 'approve'],
  [UserRole.SALES_STAFF]: ['create', 'read', 'update'],
  [UserRole.ACCOUNTING]: ['read', 'approve'],
  [UserRole.READ_ONLY]: ['read']
};
```

この設計により、リード詳細ページで作成された見積もりが、自動で見積もり管理一覧に保存され、チーム全体で見積もり管理を効率的に行えるようになります。
