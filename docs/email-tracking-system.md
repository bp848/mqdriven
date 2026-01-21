# システムメール送信と開封確認機能の設計

## 🎯 概要

現在のGmail下書き作成から、システム直接送信と開封確認機能の実装

## 📋 現状分析

### 現在の機能
- ✅ 見積メールのシステム送信（実装済み）
- ✅ Gmail下書き作成（フォールバック）
- ❌ 開封確認機能
- ❌ Gmail送信の開封確認
- ❌ ステータスの自動更新

## 🏗️ システム設計

### 1. 開封確認技術

#### 1.1 トラッキングピクセル実装
```typescript
// services/emailTrackingService.ts
export const generateTrackingPixel = (emailId: string): string => {
  const baseUrl = window.location.origin;
  return `${baseUrl}/api/tracking/pixel/${emailId}`;
};

export const generateTrackingUrl = (emailId: string): string => {
  const baseUrl = window.location.origin;
  return `${baseUrl}/api/tracking/open/${emailId}`;
};
```

#### 1.2 メールテンプレート更新
```typescript
// 既存のbuildEstimateEmail関数を拡張
export const buildEstimateEmail = () => {
  // ... 既存コード ...
  
  // トラッキングピクセルをHTMLに追加
  const trackingPixel = `<img src="${generateTrackingPixel(estimate.id)}" width="1" height="1" style="display:none;" alt="" />`;
  
  const html = `
    ${existingHtmlContent}
    ${trackingPixel}
  `.trim();
  
  return { subject, html, body };
};
```

### 2. APIエンドポイント実装

#### 2.1 トラッキングAPI
```sql
-- 新規テーブル
CREATE TABLE email_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id UUID NOT NULL,
  lead_id UUID REFERENCES leads(id),
  opened_at TIMESTAMPTZ,
  open_count INTEGER DEFAULT 1,
  user_agent TEXT,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 開封確認API
CREATE OR REPLACE FUNCTION track_email_open(email_id_param UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO email_tracking (email_id, opened_at, user_agent, ip_address)
  VALUES (email_id_param, NOW(), current_setting('request.user_agent')::TEXT, inet_client_addr())
  ON CONFLICT (email_id) 
  DO UPDATE SET 
    opened_at = NOW(),
    open_count = email_tracking.open_count + 1;
END;
$$ LANGUAGE plpgsql;
```

#### 2.2 Supabase Edge Function
```typescript
// supabase/functions/tracking/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req) => {
  const url = new URL(req.url);
  const pathParts = url.pathname.split('/');
  
  if (pathParts[1] === 'tracking' && pathParts[2] === 'pixel') {
    const emailId = pathParts[3];
    
    // 開封を記録
    const { data, error } = await supabase.rpc('track_email_open', { 
      email_id_param: emailId 
    });
    
    // 1x1透明PNGを返す
    const pngData = new Uint8Array([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
      0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
      0x54, 0x08, 0x99, 0x01, 0x01, 0x01, 0x00, 0x00,
      0xFE, 0xFF, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
    ]);
    
    return new Response(pngData, {
      headers: { 'Content-Type': 'image/png' }
    });
  }
  
  return new Response('Not Found', { status: 404 });
});
```

### 3. Gmail連携の開封確認

#### 3.1 Gmail API連携
```typescript
// services/gmailTrackingService.ts
export class GmailTrackingService {
  private accessToken: string;
  
  async trackGmailEmail(messageId: string): Promise<EmailStatus> {
    // Gmail APIでメッセージ詳細を取得
    const message = await this.getMessage(messageId);
    
    // 開封状況を確認
    const isOpened = this.checkIfOpened(message);
    
    // 開封日時を取得
    const openedAt = this.getOpenedAt(message);
    
    return {
      messageId,
      isOpened,
      openedAt,
      openCount: this.getOpenCount(message)
    };
  }
  
  private async getMessage(messageId: string) {
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=metadata`,
      {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      }
    );
    return response.json();
  }
}
```

### 4. リアルタイムステータス表示

#### 4.1 ステータスコンポーネント
```typescript
// components/sales/EmailStatusIndicator.tsx
interface EmailStatusIndicatorProps {
  emailId: string;
  sentAt: string;
  recipientEmail: string;
}

export const EmailStatusIndicator: React.FC<EmailStatusIndicatorProps> = ({
  emailId,
  sentAt,
  recipientEmail
}) => {
  const [status, setStatus] = useState<EmailStatus>({
    isOpened: false,
    openedAt: null,
    openCount: 0
  });
  
  // リアルタイムで開封状況を監視
  useEffect(() => {
    const checkStatus = async () => {
      const emailStatus = await getEmailStatus(emailId);
      setStatus(emailStatus);
    };
    
    checkStatus();
    const interval = setInterval(checkStatus, 30000); // 30秒ごとに確認
    
    return () => clearInterval(interval);
  }, [emailId]);
  
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className={`w-2 h-2 rounded-full ${
        status.isOpened ? 'bg-green-500' : 'bg-gray-300'
      }`} />
      <span className="text-slate-600">
        {status.isOpened ? 
          `開封済 (${formatDateTime(status.openedAt)})` : 
          '未開封'
        }
      </span>
      {status.openCount > 1 && (
        <span className="text-amber-600">
          ({status.openCount}回開封)
        </span>
      )}
    </div>
  );
};
```

### 5. リード詳細モーダルの更新

#### 5.1 メール送信機能の拡張
```typescript
// components/sales/LeadDetailModal.tsx
const handleSendEstimateEmail = async () => {
  if (!lead.email || !proposalPackage?.estimate || !currentUser) return;
  setIsSendingEstimateEmail(true);
  
  try {
    // システム送信を実行
    const { sendEmail } = await import('../../services/emailService');
    const result = await sendEmail({
      to: [lead.email],
      subject,
      body,
      html, // トラッキングピクセルを含むHTML
    });
    
    // メールトラッキング情報を保存
    await saveEmailTracking({
      emailId: result.id,
      leadId: lead.id,
      recipientEmail: lead.email,
      sentAt: new Date().toISOString()
    });
    
    // リードステータスを更新
    await onSave(lead.id, {
      estimateSentAt: new Date().toISOString(),
      estimateSentBy: currentUser?.name || null,
      lastEmailId: result.id,
      infoSalesActivity: updatedInfo,
    });
    
    addToast('見積メールを送信しました。開封状況を監視します。', 'success');
    
  } catch (e) {
    // Gmailフォールバック
    // ... 既存のフォールバック処理
  } finally {
    if (mounted.current) setIsSendingEstimateEmail(false);
  }
};
```

### 6. データベース拡張

#### 6.1 新規テーブル
```sql
-- メール送信記録（拡張）
CREATE TABLE email_sent_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id),
  email_id TEXT NOT NULL UNIQUE,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  is_tracked BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- メールトラッキング
CREATE TABLE email_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id TEXT REFERENCES email_sent_logs(email_id),
  lead_id UUID REFERENCES leads(id),
  opened_at TIMESTAMPTZ,
  open_count INTEGER DEFAULT 1,
  user_agent TEXT,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- リードテーブルに最終メールIDを追加
ALTER TABLE leads ADD COLUMN last_email_id TEXT;
```

### 7. UI/UX改善

#### 7.1 メール状況ダッシュボード
```typescript
// components/sales/EmailStatusDashboard.tsx
export const EmailStatusDashboard: React.FC = () => {
  const [emailStats, setEmailStats] = useState<EmailStats>();
  
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-4">メール送信状況</h3>
      
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">
            {emailStats?.totalSent || 0}
          </div>
          <div className="text-sm text-slate-600">送信済み</div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">
            {emailStats?.totalOpened || 0}
          </div>
          <div className="text-sm text-slate-600">開封済み</div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-bold text-amber-600">
            {emailStats?.openRate || 0}%
          </div>
          <div className="text-sm text-slate-600">開封率</div>
        </div>
      </div>
      
      <div className="mt-4">
        <EmailStatusList />
      </div>
    </div>
  );
};
```

## 🚀 実装ステップ

### Phase 1: トラッキングシステム基盤
1. データベーステーブル作成
2. トラッキングピクセル生成
3. Supabase Edge Function実装
4. メールテンプレート更新

### Phase 2: UIコンポーネント
1. EmailStatusIndicatorコンポーネント
2. リアルタイム監視機能
3. メール状況ダッシュボード
4. リード詳細モーダル更新

### Phase 3: Gmail連携
1. Gmail API認証設定
2. Gmailトラッキングサービス
3. 双方向同期機能
4. エラーハンドリング

### Phase 4: 分析機能
1. 開封率分析
2. 最適送信タイミング分析
3. コンバージョン率追跡
4. レポート機能

## 📊 期待効果

### 営業効率の向上
- **開封確認**: リアルタイムでメール開封状況を把握
- **フォローアップ最適化**: 開封タイミングに基づいたアクション
- **コンバージョン分析**: メール効果の測定と改善

### データ駆動型営業
- **開封率の可視化**: メール効果の定量的評価
- **最適化サイクル**: データに基づいたメール改善
- **顧客理解**: 開封行動からのインサイト獲得

## 🔧 技術的考慮事項

### プライバシーとセキュリティ
- トラッキングピクセルは1x1の透明画像
- 個人情報の保護と適切な通知
- GDPR準拠の実装

### 信頼性
- すべてのメールクライアントで開封を検知できるわけではない
- 画像ブロック機能の影響を考慮
- フォールバック戦略の実装

この設計により、システムメール送信と開封確認の完全な自動化が実現できます。
