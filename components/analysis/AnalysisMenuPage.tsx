import React, { useState } from 'react';
import { BarChart3, TrendingUp, FileText, DollarSign, Users, ShoppingCart } from 'lucide-react';
import type { Page } from '../../types';

interface AnalysisMenuItem {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  page: Page;
  color: string;
}

interface AnalysisMenuPageProps {
  onNavigate?: (page: Page) => void;
}

const AnalysisMenuPage: React.FC<AnalysisMenuPageProps> = ({ onNavigate }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const menuItems: AnalysisMenuItem[] = [
    {
      id: 'sales-analysis',
      title: '販売分析',
      description: '売上データ、受注状況、顧客分析など販売関連の総合分析',
      icon: <TrendingUp className="w-8 h-8" />,
      page: 'analysis_sales',
      color: 'bg-blue-500'
    },
    {
      id: 'approval-expense',
      title: '承認稟議・経費分析',
      description: '稟議承認状況、経費申請分析、承認フロー最適化',
      icon: <FileText className="w-8 h-8" />,
      page: 'analysis_approval_expense',
      color: 'bg-green-500'
    },
    {
      id: 'business-plan',
      title: '経営計画',
      description: '事業計画、予算管理、目標達成状況の分析',
      icon: <BarChart3 className="w-8 h-8" />,
      page: 'analysis_business_plan',
      color: 'bg-purple-500'
    },
    {
      id: 'sales-status',
      title: '販売状況',
      description: 'リアルタイム販売状況、在庫分析、販売パフォーマンス',
      icon: <ShoppingCart className="w-8 h-8" />,
      page: 'analysis_sales_status',
      color: 'bg-orange-500'
    },
    {
      id: 'customer-analysis',
      title: '顧客分析',
      description: '顧客データ、購買履歴、顧客セグメント分析',
      icon: <Users className="w-8 h-8" />,
      page: 'analysis_customer',
      color: 'bg-indigo-500'
    },
    {
      id: 'financial-analysis',
      title: '財務分析',
      description: '損益計算、キャッシュフロー、財務健全性分析',
      icon: <DollarSign className="w-8 h-8" />,
      page: 'analysis_financial',
      color: 'bg-red-500'
    }
  ];

  const filteredItems = selectedCategory === 'all' 
    ? menuItems 
    : menuItems.filter(item => item.id.includes(selectedCategory));

  const handleNavigation = (page: Page) => {
    if (onNavigate) {
      onNavigate(page);
      return;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">分析一覧</h1>
        <p className="text-gray-600">ビジネスデータの分析・レポート機能へアクセス</p>
      </div>

      {/* カテゴリーフィルター */}
      <div className="mb-6 flex gap-2 flex-wrap">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            selectedCategory === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          すべて
        </button>
        <button
          onClick={() => setSelectedCategory('sales')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            selectedCategory === 'sales'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          販売関連
        </button>
        <button
          onClick={() => setSelectedCategory('approval')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            selectedCategory === 'approval'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          承認・経費
        </button>
        <button
          onClick={() => setSelectedCategory('business')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            selectedCategory === 'business'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          経営計画
        </button>
      </div>

      {/* 分析メニューグリッド */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredItems.map((item) => (
          <div
            key={item.id}
            onClick={() => handleNavigation(item.page)}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer hover:border-blue-300"
          >
            <div className="flex items-start space-x-4">
              <div className={`${item.color} p-3 rounded-lg text-white`}>
                {item.icon}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* クイックアクセス */}
      <div className="mt-12 bg-blue-50 rounded-xl p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">クイックアクセス</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => handleNavigation('analysis_sales')}
            className="bg-white p-4 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors text-left"
          >
            <div className="font-medium text-blue-900">今日の売上レポート</div>
            <div className="text-sm text-blue-700 mt-1">リアルタイム売上データを確認</div>
          </button>
          <button
            onClick={() => handleNavigation('analysis_approval_expense')}
            className="bg-white p-4 rounded-lg border border-green-200 hover:bg-green-100 transition-colors text-left"
          >
            <div className="font-medium text-green-900">承認待ち案件</div>
            <div className="text-sm text-green-700 mt-1">現在の承認状況を確認</div>
          </button>
          <button
            onClick={() => handleNavigation('analysis_business_plan')}
            className="bg-white p-4 rounded-lg border border-purple-200 hover:bg-purple-100 transition-colors text-left"
          >
            <div className="font-medium text-purple-900">月次目標達成率</div>
            <div className="text-sm text-purple-700 mt-1">目標に対する進捗を確認</div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnalysisMenuPage;
