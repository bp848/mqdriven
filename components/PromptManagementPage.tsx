import React, { useState, useEffect } from 'react';
import InteractivePromptBuilder from './InteractivePromptBuilder';
import { Save, Trash2, Copy, Edit, Plus, Lightbulb, MessageSquare } from './Icons';

interface SavedPrompt {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  usageCount: number;
}

interface PromptManagementPageProps {
  currentUser: any;
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

const PromptManagementPage: React.FC<PromptManagementPageProps> = ({ currentUser, addToast }) => {
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<SavedPrompt | null>(null);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<SavedPrompt | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '',
    content: '',
    category: '',
    tags: ''
  });

  const categories = [
    '提案書',
    '報告書',
    'メール',
    'プレゼン',
    '企画書',
    'その他'
  ];

  useEffect(() => {
    loadSavedPrompts();
  }, []);

  const loadSavedPrompts = () => {
    // ローカルストレージから保存されたプロンプトを読み込み
    const stored = localStorage.getItem('savedPrompts');
    if (stored) {
      setSavedPrompts(JSON.parse(stored));
    } else {
      // サンプルプロンプトを追加
      const samplePrompts: SavedPrompt[] = [
        {
          id: '1',
          title: '新商品提案書の作成',
          content: `【作成する資料】
新商品提案書

【対象者・提出先】
経営層向け

【含めるべき内容】
1. 商品の概要と特徴
2. 市場ニーズと競合分析
3. 販売戦略と価格設定
4. 導入効果とROI

【出力形式】
箇条書き

【期限】
1週間以内

上記の情報をもとに、わかりやすく、説得力のある資料を作成してください。`,
          category: '提案書',
          tags: ['商品', '新規', '経営層'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          usageCount: 5
        },
        {
          id: '2',
          title: '週次進捗報告書',
          content: `【作成する資料】
週次進捗報告書

【対象者・提出先】
プロジェクトマネージャー向け

【含めるべき内容】
1. 今週の完了タスク
2. 進捗状況（達成率）
3. 問題点と課題
4. 来週の計画

【出力形式】
表形式

【期限】
毎週金曜日

上記の情報をもとに、わかりやすく、説得力のある資料を作成してください。`,
          category: '報告書',
          tags: ['週次', '進捗', '定例'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          usageCount: 12
        }
      ];
      setSavedPrompts(samplePrompts);
      localStorage.setItem('savedPrompts', JSON.stringify(samplePrompts));
    }
  };

  const savePrompt = (promptContent: string) => {
    const newPrompt: SavedPrompt = {
      id: Date.now().toString(),
      title: `プロンプト ${new Date().toLocaleDateString('ja-JP')}`,
      content: promptContent,
      category: 'その他',
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      usageCount: 0
    };

    const updatedPrompts = [...savedPrompts, newPrompt];
    setSavedPrompts(updatedPrompts);
    localStorage.setItem('savedPrompts', JSON.stringify(updatedPrompts));
    addToast('プロンプトを保存しました', 'success');
    setIsBuilderOpen(false);
  };

  const deletePrompt = (id: string) => {
    const updatedPrompts = savedPrompts.filter(p => p.id !== id);
    setSavedPrompts(updatedPrompts);
    localStorage.setItem('savedPrompts', JSON.stringify(updatedPrompts));
    addToast('プロンプトを削除しました', 'success');
    if (selectedPrompt?.id === id) {
      setSelectedPrompt(null);
    }
  };

  const duplicatePrompt = (prompt: SavedPrompt) => {
    const newPrompt: SavedPrompt = {
      ...prompt,
      id: Date.now().toString(),
      title: `${prompt.title} (コピー)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      usageCount: 0
    };

    const updatedPrompts = [...savedPrompts, newPrompt];
    setSavedPrompts(updatedPrompts);
    localStorage.setItem('savedPrompts', JSON.stringify(updatedPrompts));
    addToast('プロンプトを複製しました', 'success');
  };

  const startEditPrompt = (prompt: SavedPrompt) => {
    setEditingPrompt(prompt);
    setEditForm({
      title: prompt.title,
      content: prompt.content,
      category: prompt.category,
      tags: prompt.tags.join(', ')
    });
    setIsEditing(true);
  };

  const saveEditPrompt = () => {
    if (!editingPrompt) return;

    const updatedPrompt: SavedPrompt = {
      ...editingPrompt,
      title: editForm.title,
      content: editForm.content,
      category: editForm.category,
      tags: editForm.tags.split(',').map(tag => tag.trim()).filter(tag => tag),
      updatedAt: new Date().toISOString()
    };

    const updatedPrompts = savedPrompts.map(p => p.id === editingPrompt.id ? updatedPrompt : p);
    setSavedPrompts(updatedPrompts);
    localStorage.setItem('savedPrompts', JSON.stringify(updatedPrompts));
    addToast('プロンプトを更新しました', 'success');
    setIsEditing(false);
    setEditingPrompt(null);
    if (selectedPrompt?.id === editingPrompt.id) {
      setSelectedPrompt(updatedPrompt);
    }
  };

  const usePrompt = (prompt: SavedPrompt) => {
    // 使用回数を増やす
    const updatedPrompt = { ...prompt, usageCount: prompt.usageCount + 1 };
    const updatedPrompts = savedPrompts.map(p => p.id === prompt.id ? updatedPrompt : p);
    setSavedPrompts(updatedPrompts);
    localStorage.setItem('savedPrompts', JSON.stringify(updatedPrompts));
    
    // クリップボードにコピー
    navigator.clipboard.writeText(prompt.content).then(() => {
      addToast('プロンプトをクリップボードにコピーしました', 'success');
    });
  };

  const filteredPrompts = savedPrompts.filter(prompt => {
    const matchesSearch = prompt.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         prompt.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         prompt.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = selectedCategory === 'all' || prompt.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">プロンプト管理</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            AIへの指示をテンプレートとして保存・管理し、作業効率を向上させます
          </p>
        </div>
        <button
          onClick={() => setIsBuilderOpen(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg"
        >
          <Plus className="w-5 h-5" />
          新規プロンプト作成
        </button>
      </div>

      {/* 検索とフィルター */}
      <div className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="プロンプトを検索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-white"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-white"
            >
              <option value="all">すべてのカテゴリ</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* プロンプトリスト */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                保存されたプロンプト ({filteredPrompts.length})
              </h2>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {filteredPrompts.length === 0 ? (
                <div className="p-8 text-center">
                  <Lightbulb className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-600 dark:text-slate-400">
                    {searchTerm || selectedCategory !== 'all' ? '条件に一致するプロンプトがありません' : '保存されたプロンプトがありません'}
                  </p>
                  <p className="text-slate-500 dark:text-slate-500 text-sm mt-2">
                    新規プロンプトを作成して始めましょう
                  </p>
                </div>
              ) : (
                filteredPrompts.map(prompt => (
                  <div
                    key={prompt.id}
                    className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer transition-colors ${
                      selectedPrompt?.id === prompt.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                    onClick={() => setSelectedPrompt(prompt)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h3 className="font-semibold text-slate-900 dark:text-white">{prompt.title}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded">
                            {prompt.category}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            使用 {prompt.usageCount}回
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            usePrompt(prompt);
                          }}
                          className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded"
                          title="使用する"
                        >
                          <Copy className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditPrompt(prompt);
                          }}
                          className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded"
                          title="編集"
                        >
                          <Edit className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            duplicatePrompt(prompt);
                          }}
                          className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded"
                          title="複製"
                        >
                          <Copy className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deletePrompt(prompt.id);
                          }}
                          className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded"
                          title="削除"
                        >
                          <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                      {prompt.content}
                    </p>
                    {prompt.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {prompt.tags.map(tag => (
                          <span
                            key={tag}
                            className="text-xs px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* プロンプト詳細 */}
        <div className="space-y-4">
          {selectedPrompt ? (
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm">
              <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">プロンプト詳細</h2>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-slate-900 dark:text-white mb-2">{selectedPrompt.title}</h3>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded">
                    {selectedPrompt.category}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    使用 {selectedPrompt.usageCount}回
                  </span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4">
                  <pre className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300 font-mono">
                    {selectedPrompt.content}
                  </pre>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => usePrompt(selectedPrompt)}
                    className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg"
                  >
                    <Copy className="w-4 h-4" />
                    コピーして使用
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-8 text-center">
              <MessageSquare className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600 dark:text-slate-400">
                プロンプトを選択すると詳細が表示されます
              </p>
            </div>
          )}
        </div>
      </div>

      {/* プロンプトビルダーモーダル */}
      {isBuilderOpen && (
        <InteractivePromptBuilder
          onPromptGenerated={savePrompt}
          onClose={() => setIsBuilderOpen(false)}
        />
      )}

      {/* 編集モーダル */}
      {isEditing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">プロンプト編集</h2>
              <button
                onClick={() => setIsEditing(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">タイトル</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">カテゴリ</label>
                <select
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">タグ（カンマ区切り）</label>
                <input
                  type="text"
                  value={editForm.tags}
                  onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="例: 営業, 提案, 新規"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">プロンプト内容</label>
                <textarea
                  value={editForm.content}
                  onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                  rows={10}
                  className="w-full border rounded-lg px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 rounded-lg font-semibold"
              >
                キャンセル
              </button>
              <button
                onClick={saveEditPrompt}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PromptManagementPage;
