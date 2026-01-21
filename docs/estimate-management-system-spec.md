# 見積もり管理システム - 設計仕様書

## 🎯 基本方針

**格納先**: 1つに統一（見積書・請求書の一体化管理）

## 📋 システム概要

### 🔄 ワークフロー
```
リード詳細 → 見積作成 → 見積送付 → 顧客確認 → 受注処理 → 納品・発送 → 請求書発行 → 支払い完了
```

### 🏗️ データベース設計

#### 主要テーブル
```sql
-- 見積・請求書統合テーブル
CREATE TABLE estimate_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) NOT NULL,
  document_number TEXT UNIQUE NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('estimate', 'invoice')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'cancelled', 'paid', 'overdue')),
  
  -- 共通フィールド
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  customer_address TEXT,
  
  -- 金額関連
  subtotal DECIMAL(12,2) DEFAULT 0,
  tax_rate DECIMAL(5,4) DEFAULT 0.10, -- 消費税率10%
  tax_amount DECIMAL(12,2) DEFAULT 0,
  total_amount DECIMAL(12,2) DEFAULT 0,
  
  -- 日付関連
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE, -- 請求書の場合のみ
  valid_until DATE, -- 見積有効期限
  
  -- 内容
  title TEXT NOT NULL,
  content JSONB, -- 明細データをJSONで保存
  notes TEXT,
  
  -- ファイル関連
  file_path TEXT,
  file_name TEXT,
  file_type TEXT,
  
  -- メール関連
  email_sent_at TIMESTAMP,
  email_opened_at TIMESTAMP,
  email_open_count INTEGER DEFAULT 0,
  
  -- システム管理
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 明細テーブル（正規化）
CREATE TABLE estimate_invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_invoice_id UUID REFERENCES estimate_invoices(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  description TEXT,
  quantity DECIMAL(10,3) DEFAULT 1,
  unit TEXT DEFAULT '個',
  unit_price DECIMAL(12,2) NOT NULL,
  discount_rate DECIMAL(5,4) DEFAULT 0,
  subtotal DECIMAL(12,2) GENERATED ALWAYS AS (quantity * unit_price * (1 - discount_rate)) STORED,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 添付ファイルテーブル
CREATE TABLE estimate_invoice_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_invoice_id UUID REFERENCES estimate_invoices(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT NOT NULL,
  uploaded_at TIMESTAMP DEFAULT NOW()
);
```

## 🎨 UI設計

### 1. 見積もり一覧ページ
```tsx
// 主な機能
- ドキュイングリッド表示
- ステータスによるフィルター（下書き、送付済み、受注済み、キャンセル）
- 顧客情報での検索
- 日付範囲での絞り込み
- 一括操作（送付、キャンセル、削除）
- PDF出力機能
```

### 2. 見積作成・編集ページ
```tsx
// AI自動生成機能
- 顧客情報の自動入力
- 過去の見積からの類似提案
- 仕様書・資料のアップロード
- リアルタイム金額計算
- プレビュー機能
```

### 3. 詳細管理
```tsx
// 明細行の追加・編集・削除
- 品名マスタからの選択
- 単価の自動入力
- 数量と割引の計算
- 小計の自動計算
```

## 🔧 AI機能の統合

### 自動見積生成
```typescript
interface EstimateGenerationRequest {
  leadId: string;
  customerRequirements?: string;
  similarEstimates?: string[];
  customItems?: string[];
}

interface EstimateGenerationResponse {
  items: EstimateItem[];
  totalAmount: number;
  taxAmount: number;
  notes: string;
  suggestedValidDays: number;
}
```

### 仕様書認識
```typescript
// OCR機能での仕様書読み取り
interface SpecDocument {
  fileName: string;
  extractedData: {
    paperSize: string;
    colorSpec: string;
    quantity: number;
    deliveryDate: string;
    specialRequirements: string;
  };
  confidence: number;
}
```

## 📧 メール連携機能

### 見積送付
```typescript
interface EmailTemplate {
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  attachments?: string[];
}

// トラッキング機能付き
await sendEstimateEmail({
  estimateId: 'uuid',
  template: 'standard',
  tracking: true
});
```

### 開封確認
```typescript
// メール開封状況の監視
interface EmailStatus {
  isSent: boolean;
  sentAt: string;
  isOpened: boolean;
  openedAt?: string;
  openCount: number;
}
```

## 📊 レポート機能

### 売業ダッシュボード
```typescript
interface SalesMetrics {
  totalEstimates: number;
  sentEstimates: number;
  acceptedEstimates: number;
  conversionRate: number;
  averageAmount: number;
  totalRevenue: number;
}
```

### 詳細レポート
```typescript
interface ItemAnalysis {
  itemName: string;
  usageFrequency: number;
  averageQuantity: number;
  averageUnitPrice: number;
  totalRevenue: number;
  profitMargin: number;
}
```

## 🔒 セキュリティ対策

### アクセス制御
```typescript
// ロールベースのアクセス制御
enum UserRole {
  ADMIN = 'admin',
  SALES_MANAGER = 'sales_manager',
  SALES_STAFF = 'sales_staff',
  ACCOUNTING = 'accounting',
  READ_ONLY = 'read_only'
}

// 権限チェック
const permissions = {
  [UserRole.ADMIN]: ['create', 'read', 'update', 'delete', 'approve'],
  [UserRole.SALES_MANAGER]: ['create', 'read', 'update', 'approve'],
  [UserRole.SALES_STAFF]: ['create', 'read', 'update'],
  [UserRole.ACCOUNTING]: ['read', 'approve'],
  [UserRole.READ_ONLY]: ['read']
};
```

### 監査証跡
```sql
-- 操作ログテーブル
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  operation TEXT NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE'
  old_values JSONB,
  new_values JSONB,
  user_id UUID REFERENCES users(id),
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 📱 API設計

### RESTful API
```typescript
// 見積関連APIエンドポイント
GET    /api/estimates              // 一覧取得
POST   /api/estimates              // 新規作成
GET    /api/estimates/:id          // 詳細取得
PUT    /api/estimates/:id          // 更新
DELETE /api/estimates/:id          // 削除
POST   /api/estimates/:id/send     // 送付
POST   /api/estimates/:id/convert  // 請求書変換
```

## 🚀 実装優先順位

### Phase 1: 基盤構築 (2週間)
1. データベース設計とマイグレーション
2. 基本的なCRUD機能の実装
3. 認証・認可システム
4. 基本的なUIコンポーネント

### Phase 2: AI機能統合 (3週間)
1. AI見積生成機能の実装
2. 仕様書OCR認識機能
3. メールテンプレート機能
4. トラッキング機能の連携

### Phase 3: 高度化機能 (4週間)
1. レポート機能の実装
2. 分析機能の追加
3. ワークフロー自動化
4. 外部システム連携

## 📈 期待される効果

### 業務効率の向上
- 見積作成時間: 50%削減
- 顧客対応品質: 30%向上
- 見積受注率: 25%改善

### データ駆動型経営
- 売業分析データの蓄積
- 予測分析機能の実現
- KPIダッシュボードの提供

### コンプライアンス強化
- 文書管理の電子化
- 監査証跡の確保
- 個人情報保護の徹底

この設計により、効率的でスケーラブルな見積もり管理システムが実現できます。
