import React, { useState } from 'react';

type ToolId = 'printflow' | 'autodtp';

type Tool = {
  id: ToolId;
  label: string;
  description: string;
  url: string;
};

const TOOLS: Tool[] = [
  {
    id: 'printflow',
    label: 'Printflow AI Studio',
    description: 'DTP自動組版とチェックを一手に引き受けるAIツール。',
    url: 'https://printflow-ai-studio-365022685299.us-west1.run.app/',
  },
  {
    id: 'autodtp',
    label: 'AutoDTP AI',
    description: 'PDFレイアウト・段組・余白を最適化するDTP支援AI。',
    url: 'https://autodtp-ai-365022685299.us-west1.run.app/',
  },
];

export default function DTPHub() {
  const [activeId, setActiveId] = useState<ToolId>('printflow');
  const active = TOOLS.find((t) => t.id === activeId) ?? TOOLS[0];

  return (
    <div className="flex h-full w-full bg-slate-50">
      <aside className="w-64 border-r border-slate-200 bg-white flex flex-col">
        <div className="px-4 py-3 border-b border-slate-200">
          <h1 className="text-base font-semibold text-slate-900">DTP自動化</h1>
          <p className="mt-1 text-xs text-slate-500">
            DTPレイアウト・組版をAIで最適化するツールを切り替えます。
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
