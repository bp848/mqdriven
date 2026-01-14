# 経費申請ラベル表示問題の分析と修正

## 📊 問題の特定

### 現状確認
- **問題**: 経費申請一覧で「経費申請」というラベルが表示されない
- **原因**: データのラベル値と表示ロジックの不整合

### 🔍 原因調査

#### 1. データベースのラベル値を確認
```sql
-- 経費申請データのラベル値を確認
SELECT DISTINCT 
    request_type,
    COUNT(*) as count,
    STRING_AGG(DISTINCT request_type) as labels
FROM public.expense_requests 
WHERE request_type IS NOT NULL
GROUP BY request_type
ORDER BY count DESC;
```

#### 2. 表示ロジックの確認
```typescript
// 経費申請一覧の表示ロジックを確認
const getExpenseRequestType = (requestType: string): string => {
    switch (requestType) {
        case '経費精算申請':
            return '経費精算';
        case '経費申請':
            return '経費申請';
        case '出張旅費精算':
            return '出張旅費精算';
        case '接待費':
            return '接待費';
        case '交際費':
            return '交際費';
        case '消耗品費':
            return '消耗品費';
        case '通信費':
            return '通信費';
        case '修繕費':
            return '修繕費';
        default:
            return requestType; // フォールバック：元のラベルをそのまま表示
    }
};
```

### 🎯 解決策

#### 1. 表示ロジックの修正（即時対応）
```typescript
// 経費申請一覧コンポーネントの修正
const ExpenseRequestList: React.FC = () => {
    const [requests, setRequests] = useState<ExpenseRequest[]>([]);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                const data = await getExpenseRequests();
                setRequests(data);
            } catch (err) {
                console.error('Failed to load expense requests:', err);
            } finally {
                setLoading(false);
            }
        };
        
        loadData();
    }, []);

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow">
                <h2 className="text-2xl font-bold mb-4">経費申請一覧</h2>
                
                <div className="space-y-4">
                    {requests.map(request => (
                        <div key={request.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h3 className="font-semibold text-slate-900 dark:text-white">
                                        {getExpenseRequestType(request.request_type)}
                                    </h3>
                                    <p className="text-sm text-slate-600 dark:text-slate-400">
                                        申請者: {request.applicant_name || '未設定'}
                                    </p>
                                    <p className="text-sm text-slate-600 dark:text-slate-400">
                                        金額: ¥{request.amount?.toLocaleString() || '0'}
                                    </p>
                                    <p className="text-sm text-slate-600 dark:text-slate-400">
                                        申請日: {request.created_at || '未設定'}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                                        request.status === 'approved' ? 'bg-green-100 text-green-800' :
                                        request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                        'bg-red-100 text-red-800'
                                    }`}>
                                        {request.status || '未設定'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
```

#### 2. ラベル値のマッピング強化（中長期対応）
```typescript
// ラベル値のマッピング定義
const EXPENSE_TYPE_LABELS: Record<string, string> = {
    '経費精算申請': '経費精算',
    '経費申請': '経費申請',
    '出張旅費精算': '出張旅費精算',
    '接待費': '接待費',
    '交際費': '交際費',
    '消耗品費': '消耗品費',
    '通信費': '通信費',
    '修繕費': '修繕費',
    'その他': 'その他'
};

// マッピング関数の改善
const getExpenseRequestType = (requestType: string): string => {
    return EXPENSE_TYPE_LABELS[requestType] || requestType;
};
```

## 📋 中長期的改善策

### 1. マスタデータ管理
- 経費申請種別のマスタデータ管理機能
- ラベル値の動的管理システム
- 表示ロジックの統一化

### 2. UI/UXの改善
- 経費申請のフィルタリング機能
- 種別の表示と検索機能
- ステータス管理画面の実装

### 3. 業務プロセスの標準化
- 経費申請ワークフローの確立
- 承認ルールの文書化と共有
- 月次処理の自動化とレポート生成

## 🚀 実行計画

### フェーズ1: 即時対応（1週間）
1. 表示ロジックの修正とテスト
2. マッピング定義の拡張
3. ユーザーへの説明と教育

### フェーズ2: 機能拡張（1ヶ月）
1. 経費申請種別の管理機能実装
2. フィルタリング機能の強化
3. 検索とソート機能の実装

### フェーズ3: 本格運用（2ヶ月以降）
1. 全自動化された経費申請処理システム
2. 監査機能とレポート生成
3. 経費申請の分析と予算管理

## 💡 期待される効果

- ✅ **表示の正確性**: すべての経費申請が正しいラベルで表示される
- ✅ **業務効率の向上**: 種別管理と検索が容易に
- ✅ **データ管理の標準化**: マスタデータの一元管理と統一性
- ✅ **ユーザビリティの向上**: 直感的な操作と明確な表示

これにより**経費申請のラベル表示問題が解決され、業務効率が向上します**。
