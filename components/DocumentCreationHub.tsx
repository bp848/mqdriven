import React, { useState } from 'react';

type ToolId = 'lumina';

type Tool = {
  id: ToolId;
  label: string;
  description: string;
  url: string;
};

const TOOLS: Tool[] = [
  {
    id: 'lumina',
    label: '提案書作成AI（Lumina）',
    description: '営業資料・企画書・提案書を自動生成する専用AIツール。',
    url: 'https://lumina-proposal-generator-365022685299.us-west1.run.app/',
  },
];

export default function DocumentCreationHub() {
  const [activeId, setActiveId] = useState<ToolId>('lumina');

  const active = TOOLS.find((t) => t.id === activeId) ?? TOOLS[0];

  return (
    <div className="flex h-screen w-full bg-slate-50">
      <aside className="w-64 border-r border-slate-200 bg-white flex flex-col">
        <div className="px-4 py-3 border-b border-slate-200">
          <h1 className="text-base font-semibold text-slate-900">資料作成</h1>
          <p className="mt-1 text-xs text-slate-500">
            提案書・企画書などの資料をAIで作成します。
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

      <main className="flex-1 flex flex-col min-w-0 h-full">
        <header className="px-4 py-3 border-b border-slate-200 bg-white flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">{active.label}</h2>
            <p className="text-xs text-slate-500">{active.description}</p>
          </div>
        </header>

        <div className="px-4 py-3 bg-slate-50 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">使いたいアプリを直接開く</p>
            <a
              href={active.url}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-blue-400 hover:text-blue-300"
            >
              {active.label} を新しいタブで開く
            </a>
          </div>
          <div className="flex flex-wrap gap-2">
            {TOOLS.map((tool) => (
              <a
                key={`link-${tool.id}`}
                href={tool.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-400 hover:text-slate-900 transition"
              >
                <span className="uppercase tracking-wide text-[11px] text-slate-400">{tool.id}</span>
                {tool.label}
              </a>
            ))}
          </div>
        </div>

        <div className="flex-1 min-h-0">
          <iframe
            key={active.id}
            src={active.url}
            className="w-full h-full min-h-full border-0"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </main>
    </div>
  );
}
