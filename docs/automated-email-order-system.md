# 自動メール送信・受信・受注処理システムの設計

## 🎯 概要

現在のGmail下書き作成から、完全自動化的なメール送信・受信・受注処理システムへの拡張

## 📋 現状分析

### 現在の機能
- ✅ 見積作成（AI生成）
- ✅ Gmail下書き作成
- ✅ MQ会計分析
- ❌ 自動メール送信
- ❌ メール受信監視
- ❌ 自動受注処理

## 🏗️ システム設計

### 1. メール送信自動化

#### 1.1 既存sendEmail機能の拡張
```typescript
// services/emailService.ts
export const sendEstimateEmail = async (estimate: Estimate, lead: Lead) => {
  const { subject, html, body } = buildEstimateEmail(estimate, lead);
  
  const result = await sendEmail({
    to: [lead.email],
    subject,
    body,
    html,
    mode: 'production'
  });
  
  // 送信記録を保存
  await logEmailSent(estimate.id, result.id, lead.email);
  
  return result;
};
```

#### 1.2 送信設定
- 環境変数で本番送信を制御
- SMTP設定の自動検出
- 送信エラーのリトライ機能

### 2. メール受信監視システム

#### 2.1 IMAP/POP3連携
```typescript
// services/emailReceiver.ts
export class EmailReceiver {
  private imapConfig: IMAPConfig;
  
  async startMonitoring() {
    // IMAPサーバーに接続
    // 新着メールを監視
    // 見積関連メールをフィルタリング
  }
  
  async processIncomingEmail(email: EmailMessage) {
    // 送信者情報の抽出
    // 件名・本文の解析
    // 受注意図の判定
  }
}
```

#### 2.2 メール解析エンジン
```typescript
// services/emailParser.ts
export const parseOrderEmail = async (email: EmailMessage): Promise<OrderIntent> => {
  const prompt = `
    以下のメールから受注意図を解析してください：
    送信者: ${email.from}
    件名: ${email.subject}
    本文: ${email.body}
    
    解析項目：
    - 受注意図の有無
    - 見積番号の特定
    - 数量・仕様の変更
    - 納期・支払条件の確認
    - 特記事項
  `;
  
  return await generateOrderIntent(prompt);
};
```

### 3. 自動受注処理

#### 3.1 受注検出ロジック
```typescript
// services/orderProcessor.ts
export const processOrderIntent = async (intent: OrderIntent): Promise<Order> => {
  // 見積情報の取得
  const estimate = await getEstimateById(intent.estimateId);
  
  // 受注データの生成
  const order = {
    estimateId: estimate.id,
    customerId: estimate.customerId,
    items: intent.modifiedItems || estimate.items,
    totalAmount: calculateTotal(intent.modifiedItems),
    status: 'received',
    orderDate: new Date().toISOString(),
    deliveryDate: intent.requestedDeliveryDate,
    paymentTerms: intent.requestedPaymentTerms,
  };
  
  // 受注データの保存
  const savedOrder = await createOrder(order);
  
  // 在庫・生産スケジュールの更新
  await updateProductionSchedule(savedOrder);
  
  return savedOrder;
};
```

#### 3.2 ワークフロー統合
```typescript
// services/workflowService.ts
export const executeOrderWorkflow = async (order: Order) => {
  // 1. 受注確認メールの自動送信
  await sendOrderConfirmation(order);
  
  // 2. 担当者への通知
  await notifySalesTeam(order);
  
  // 3. 生産管理システムとの連携
  await syncToProductionSystem(order);
  
  // 4. 会計システムへのデータ登録
  await registerToAccountingSystem(order);
  
  // 5. 進捗トラッキングの開始
  await startProgressTracking(order);
};
```

## 🔧 技術実装

### 4. データベース拡張

#### 4.1 新規テーブル
```sql
-- メール送信記録
CREATE TABLE email_sent_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID REFERENCES estimates(id),
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  email_id TEXT,
  status TEXT DEFAULT 'sent'
);

-- 受注インテント記録
CREATE TABLE order_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  parsed_content JSONB,
  confidence_score DECIMAL(3,2),
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 受注データ
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID REFERENCES estimates(id),
  customer_id UUID REFERENCES customers(id),
  order_number TEXT UNIQUE NOT NULL,
  items JSONB NOT NULL,
  total_amount DECIMAL(14,2) NOT NULL,
  status TEXT DEFAULT 'received',
  order_date TIMESTAMPTZ DEFAULT NOW(),
  delivery_date TIMESTAMPTZ,
  payment_terms TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 5. UI/UX拡張

#### 5.1 見積管理ページの拡張
- 送信状況のリアルタイム表示
- 開封確認の表示
- 返信状況のトラッキング

#### 5.2 受注管理ダッシュボード
- 新規受注のアラート
- 受注処理状況の可視化
- 生産スケジュールとの連携

#### 5.3 自動化設定画面
- メール監視のON/OFF
- 処理ルールのカスタマイズ
- 通知設定の管理

## 🚀 実装ステップ

### Phase 1: メール送信自動化
1. `handleSendEstimateEmail`の修正
2. 環境変数設定
3. 送信記録機能
4. エラーハンドリング

### Phase 2: メール受信監視
1. IMAP接続ライブラリの導入
2. メール解析エンジン
3. 受信トレイの実装
4. フィルタリング機能

### Phase 3: 受注処理自動化
1. 受注インテント検出
2. 受注データ生成
3. ワークフロー統合
4. 外部システム連携

### Phase 4: UI/UX改善
1. リアルタイム状況表示
2. ダッシュボード拡張
3. 設定画面実装
4. モバイル対応

## 📊 期待効果

### 効率化
- メール操作時間の90%削減
- 受注処理の自動化
- ヒューマンエラーの防止

### 可視化
- リードから受注までの完全な追跡
- コンバージョン率のリアルタイム分析
- MQ分析と受注実績の相関分析

### 拡張性
- 他のCRMシステムとの連携
- 生産管理システムとの統合
- 会計システムの完全自動化

## 🔄 既存システムとの連携

### 見積管理システム
- 見積データの流用
- ステータスの同期
- MQ分析の活用

### MQ会計システム
- 受注データの自動反映
- 売上実績のリアルタイム更新
- 予算実績比較の自動化

### 生産管理システム
- 受注情報の自動連携
- 納期管理の統合
- 進捗状況の同期

この設計により、リード獲得から受注・生産までの完全な自動化を実現できます。
