import React, { useState } from 'react';

type ToolId =
  | 'genkoufix'
  | 'redpen'
  | 'autodtp'
  | 'printops'
  | 'opsflow'
  | 'bunsho'
  | 'reprint'
  | 'webtoprint'
  | 'dm'
  | 'dtpagent'
  | 'dtpoperator'
  | 'bidding';

type Tool = {
  id: ToolId;
  label: string;
  description: string;
  url: string;
};

const TOOLS: Tool[] = [
  {
    id: 'genkoufix',
    label: '原稿修正AI（GenkouFix）',
    description: '誤字脱字・言い回し・敬語などを自動でチェックして修正案を出します。',
    url: 'https://genkoufix-ai-365022685299.us-west1.run.app/',
  },
  {
    id: 'redpen',
    label: 'PDF赤ペンAI（RedPen）',
    description: 'PDF資料に対するコメント・修正指示・赤入れをAIで生成します。',
    url: 'https://redpen-ai-365022685299.us-west1.run.app/',
  },
  {
    id: 'autodtp',
    label: '自動DTPレイアウトAI（AutoDTP）',
    description: 'PDFレイアウト・段組・余白などを最適化するDTP支援AI。',
    url: 'https://autodtp-ai-365022685299.us-west1.run.app/',
  },
  {
    id: 'printops',
    label: 'AIエージェント（PrintOps）',
    description: '印刷業務向けのプロセス支援AIエージェント。',
    url: 'https://printops-ai-365022685299.us-west1.run.app/',
  },
  {
    id: 'bunsho',
    label: 'クラウド文書エージェント（Bunsho Master）',
    description: '文章整形・表現改善を行う Bunsho Master の AIエージェント。',
    url: 'https://bunsho-master-japanese-text-survival-kit-365022685299.us-west1.run.app/',
  },
  {
    id: 'reprint',
    label: 'PDF復刻（Professional Publishing Reprint）',
    description: '既存資料を復刻・再構成する AI サービス。',
    url: 'https://professional-publishing-reprint-app-365022685299.us-west1.run.app/',
  },
  {
    id: 'webtoprint',
    label: 'Web-to-Print AI',
    description: 'Webで印刷物を設計・出力する自動化アシスタント。',
    url: 'https://web-to-print-365022685299.us-west1.run.app/',
  },
  {
    id: 'dm',
    label: 'DM配信AI',
    description: 'DM配信戦略とメッセージを生成するAIツール。',
    url: 'https://ai-dm-365022685299.us-west1.run.app/',
  },
  {
    id: 'dtpagent',
    label: '組版AIエージェント',
    description: '組版プロセス全体をアシストするDTPエージェント。',
    url: 'https://dtp-operation-agent-365022685299.us-west1.run.app/',
  },
  {
    id: 'dtpoperator',
    label: 'DTPオペレーターAI',
    description: '組版業務／作業指示を支援する DTP Operator AI。',
    url: 'https://dtp-operator-ai-365022685299.us-west1.run.app/',
  },
  {
    id: 'bidding',
    label: '入札案件AI（Bidding Document Automation）',
    description: '入札資料をAIで自動生成・構成します。',
    url: 'https://ai-bidding-document-automation-365022685299.us-west1.run.app/',
  },
  {
    id: 'opsflow',
    label: 'AIエージェント（OpsFlow）',
    description: '業務フロー設計やタスク分解を行うAIエージェント。',
    url: 'https://opsflow-ai-365022685299.us-west1.run.app/',
  },
];

export default function PDFEditingHub() {
  const [activeId, setActiveId] = useState<ToolId>('genkoufix');

  const active = TOOLS.find((t) => t.id === activeId) ?? TOOLS[0];

  return (
    <div className="flex h-full w-full bg-slate-50">
      <aside className="w-72 border-r border-slate-200 bg-white flex flex-col">
        <div className="px-4 py-3 border-b border-slate-200">
          <h1 className="text-base font-semibold text-slate-900">PDF編集</h1>
          <p className="mt-1 text-xs text-slate-500">
            PDF原稿の修正・赤入れ・レイアウト調整をAIで行います。
          </p>
        </div>

        <nav className="flex-1 overflow-y-auto">
          <ul className="py-2">
            {TOOLS.map((tool) => {
              const isActive = tool.id === activeId;
              return (
                <li key={tool.id}>
                  <button
                    type="button"
                    onClick={() => setActiveId(tool.id)}
                    className={[
                      'w-full text-left px-4 py-2.5 text-xs',
                      'transition-colors',
                      isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100',
                    ].join(' ')}
                  >
                    <div className="font-medium">{tool.label}</div>
                    <div className={isActive ? 'text-[10px] opacity-80' : 'text-[10px] text-slate-500'}>
                      {tool.description}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="px-4 py-3 border-b border-slate-200 bg-white flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">{active.label}</h2>
            <p className="text-xs text-slate-500">{active.description}</p>
          </div>
        </header>

        <div className="flex-1 min-h-0">
          <iframe
            key={active.id}
            src={active.url}
            className="w-full h-full border-0"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </main>
    </div>
  );
}
