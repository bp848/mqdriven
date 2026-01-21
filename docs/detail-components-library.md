# 詳細ページコンポーネントライブラリ

## 📋 概要

リード詳細ページから抽出した再利用可能なコンポーネント群。今後作成するすべての詳細ページでテンプレートとして使用できる。

## 🏗️ コンポーネント構成

### 基本コンポーネント

#### 1. DetailSection
詳細情報のセクションをまとめるコンポーネント
```tsx
<DetailSection title="基本情報">
  <Field label="会社名" name="company" value={data.company} isEditing={isEditing} onChange={handleChange} />
</DetailSection>
```

#### 2. Field
編集可能/不可能なフィールドを表示するコンポーネント
```tsx
<Field 
  label="メールアドレス" 
  name="email" 
  value={data.email} 
  isEditing={isEditing} 
  onChange={handleChange}
  type="email"
/>
```

#### 3. SummaryCard
要約情報を表示するカードコンポーネント
```tsx
<SummaryCard title="顧客情報">
  <div className="font-semibold">{company}</div>
  <div className="text-sm text-slate-600">{name}</div>
</SummaryCard>
```

### UIコンポーネント

#### 4. AITab
AIアシスタントのタブを表示するコンポーネント
```tsx
<AITab 
  title="企業調査" 
  isActive={activeTab === 'investigation'} 
  onClick={() => setActiveTab('investigation')}
  icon={<Search />}
/>
```

#### 5. StatusIndicator
ステータスを視覚的に表示するコンポーネント
```tsx
<StatusIndicator 
  label="開封済み" 
  status="success" 
  icon={<CheckCircle />}
/>
```

#### 6. ProgressStep
進捗ステップを表示するコンポーネント
```tsx
<ProgressStep 
  step={1} 
  currentStep={currentStep} 
  title="企業調査" 
  completed={true}
/>
```

#### 7. ActionButton
操作ボタンの統一コンポーネント
```tsx
<ActionButton 
  variant="primary"
  onClick={handleSave}
  loading={isLoading}
  icon={<Save />}
>
  保存
</ActionButton>
```

### レイアウトコンポーネント

#### 8. Grid
グリッドレイアウトを簡単に実装
```tsx
<Grid cols={3} gap={4}>
  <div>項目1</div>
  <div>項目2</div>
  <div>項目3</div>
</Grid>
```

#### 9. Flex
フレックスボックスレイアウトを簡単に実装
```tsx
<Flex direction="row" justify="between" align="center" gap={4}>
  <div>左側</div>
  <div>右側</div>
</Flex>
```

#### 10. Card
カードコンテナ
```tsx
<Card hover>
  <div className="p-4">カード内容</div>
</Card>
```

#### 11. Modal
モーダルダイアログ
```tsx
<Modal isOpen={isOpen} onClose={onClose} title="詳細" size="lg">
  <div>モーダル内容</div>
</Modal>
```

### 状態表示コンポーネント

#### 12. LoadingSpinner
ローディングスピナー
```tsx
<LoadingSpinner size="md" />
```

#### 13. EmptyState
空状態表示
```tsx
<EmptyState 
  title="データがありません"
  description="最初のデータを作成してください"
  icon={<FileText />}
  action={<ActionButton>作成</ActionButton>}
/>
```

#### 14. Badge
バッジ表示
```tsx
<Badge variant="success" size="sm">
  新規
</Badge>
```

#### 15. Container
コンテナ（レスポンシブ対応）
```tsx
<Container size="lg">
  <div>コンテンツ</div>
</Container>
```

## 🚀 使用方法

### インポート方法

#### 個別インポート
```tsx
import { DetailSection, Field, ActionButton } from '../components/sales/DetailComponents';
```

#### 名前空間インポート
```tsx
import DetailComponents from '../components/sales/DetailComponents';
const { DetailSection, Field, ActionButton } = DetailComponents;
```

#### 全体インポート
```tsx
import * as DetailComponents from '../components/sales/DetailComponents';
```

### 基本的な使用例

```tsx
import { DetailSection, Field, ActionButton, Card, Grid } from '../components/sales/DetailComponents';

const MyDetailPage = ({ data, isEditing, onSave }) => {
  return (
    <div className="p-6">
      <DetailSection title="基本情報">
        <Grid cols={2} gap={4}>
          <Field 
            label="会社名" 
            name="company" 
            value={data.company} 
            isEditing={isEditing} 
            onChange={handleChange} 
          />
          <Field 
            label="担当者名" 
            name="contact" 
            value={data.contact} 
            isEditing={isEditing} 
            onChange={handleChange} 
          />
        </Grid>
      </DetailSection>
      
      <DetailSection title="アクション">
        <ActionButton 
          variant="primary" 
          onClick={onSave}
          loading={isLoading}
        >
          保存
        </ActionButton>
      </DetailSection>
    </div>
  );
};
```

## 🎨 スタイリング

### Tailwind CSSクラス
すべてのコンポーネントはTailwind CSSクラスを使用しています。カスタマイズはclassNameプロパティで可能です。

### カラーテーマ
- プライマリー: blue-600
- サクセス: green-600
- 警告: amber-600
- エラー: red-600
- デフォルト: slate-600

### サイズ体系
- sm: 小サイズ
- md: 中サイズ（デフォルト）
- lg: 大サイズ
- xl: 特大サイズ

## 🔧 カスタマイズ

### テーマの変更
```tsx
// カスタムカラーテーマ
const customTheme = {
  primary: 'bg-indigo-600 hover:bg-indigo-700',
  success: 'bg-emerald-600 hover:bg-emerald-700',
  // ...
};
```

### 新しいコンポーネントの追加
```tsx
// DetailComponents.tsxに追加
export const CustomComponent: React.FC<CustomProps> = ({ ... }) => {
  return (
    <div className="custom-styles">
      {/* コンポーネント内容 */}
    </div>
  );
};
```

## 📱 レスポンシブ対応

すべてのコンポーネントはレスポンシブデザインを考慮しています。

```tsx
<Grid cols={{ base: 1, md: 2, lg: 3 }}>
  <div>レスポンシブグリッド</div>
</Grid>
```

## 🔄 状態管理

コンポーネントは状態管理に依存しません。親コンポーネントからpropsを受け取ります。

```tsx
const [isEditing, setIsEditing] = useState(false);
const [data, setData] = useState(initialData);

<Field 
  value={data.field}
  isEditing={isEditing}
  onChange={(e) => setData({ ...data, [e.target.name]: e.target.value })}
/>
```

## 🧪 テスト

各コンポーネントはテスト可能に設計されています。

```tsx
import { render, screen } from '@testing-library/react';
import { Field } from '../DetailComponents';

test('Field component renders correctly', () => {
  render(
    <Field 
      label="Test Field" 
      name="test" 
      value="test value" 
      isEditing={false} 
      onChange={jest.fn()} 
    />
  );
  
  expect(screen.getByText('Test Field')).toBeInTheDocument();
  expect(screen.getByText('test value')).toBeInTheDocument();
});
```

## 📚 使用例

### 顧客詳細ページ
```tsx
const CustomerDetailPage = () => {
  return (
    <Container size="xl">
      <Grid cols={3} gap={6}>
        <div>
          <DetailSection title="基本情報">
            <Field label="会社名" name="company" />
            <Field label="担当者名" name="contact" />
            <Field label="メールアドレス" name="email" type="email" />
          </DetailSection>
        </div>
        
        <div>
          <DetailSection title="AI分析">
            <SummaryCard title="要約">
              <AIAnalysisContent />
            </SummaryCard>
          </DetailSection>
        </div>
        
        <div>
          <DetailSection title="活動履歴">
            <ActivityLog />
          </DetailSection>
        </div>
      </Grid>
    </Container>
  );
};
```

### 製品詳細ページ
```tsx
const ProductDetailPage = () => {
  return (
    <Container size="lg">
      <Card>
        <DetailSection title="製品情報">
          <Grid cols={2} gap={4}>
            <Field label="製品名" name="name" />
            <Field label="カテゴリー" name="category" type="select" options={categories} />
            <Field label="価格" name="price" type="number" />
            <Field label="在庫数" name="stock" type="number" />
          </Grid>
        </DetailSection>
        
        <DetailSection title="説明">
          <Field label="詳細説明" name="description" type="textarea" />
        </DetailSection>
      </Card>
    </Container>
  );
};
```

## 🔄 将来的な拡張

### プランニング
- フォームバリデーション機能の追加
- アクセシビリティの向上
- 国際化（i18n）対応
- テーマシステムの拡充
- アニメーション効果の追加

### 貢献
新しいコンポーネントを追加する際は、以下のガイドラインに従ってください：
1. TypeScriptの型定義を含める
2. Tailwind CSSクラスを使用する
3. レスポンシブデザインを考慮する
4. アクセシビリティを確保する
5. テストケースを追加する

このコンポーネントライブラリにより、今後の詳細ページ開発が大幅に効率化されます。
