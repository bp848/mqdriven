import React, { useState } from 'react';

const EMBEDDED_APPS = [
  {
    id: 'app1',
    name: 'AI Document Wizard',
    description: 'AI Document Wizard',
    url: 'https://ai-document-wizard-365022685299.us-west1.run.app/',
    category: 'document',
  },
  {
    id: 'app2',
    name: 'Lumina Proposal Generator',
    description: 'Lumina Proposal Generator',
    url: 'https://lumina-proposal-generator-365022685299.us-west1.run.app',
    category: 'document',
  },
  {
    id: 'app3',
    name: 'SlideGenius AI',
    description: 'SlideGenius AI',
    url: 'https://slidegenius-ai-365022685299.us-west1.run.app',
    category: 'document',
  },
  {
    id: 'app4',
    name: 'AI Presentation Generator',
    description: 'AI Presentation Generator',
    url: 'https://ai-presentation-generator-365022685299.us-west1.run.app',
    category: 'document',
  },
  {
    id: 'sim1',
    name: 'AI Presentation Generator (シミュレーター)',
    description: 'AI Presentation Generator シミュレーター',
    url: 'https://aidriven-presentation-generator-365022685299.us-west1.run.app/',
    category: 'simulator',
  },
];

const iframeClass = 'w-full h-[calc(100vh-64px)] border-0';

const DocumentCreationHub: React.FC = () => {
  const [activeApp, setActiveApp] = useState<string>(EMBEDDED_APPS[0].id);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const handleSelectApp = (appId: string) => {
    setActiveApp(appId);
  };

  return (
    <div className="h-[calc(100vh-3rem)] flex bg-gray-100 text-gray-800 rounded-2xl overflow-hidden shadow-inner">
      <aside
        className={`bg-white border-r border-gray-200 flex-shrink-0 transition-all duration-300 ${
          isSidebarCollapsed ? 'w-0 overflow-hidden' : 'w-64'
        }`}
      >
        <div className="p-4 border-b border-gray-100">
          <h1 className="text-xl font-bold text-gray-900">資料作成メニュー</h1>
          <p className="text-xs text-gray-500 mt-1">アプリを選択してAIで資料を生成</p>
        </div>
        <div className="py-4">
          <div className="space-y-6">
            <div>
              <p className="px-4 pb-2 text-sm font-semibold text-gray-500 uppercase tracking-wide">資料作成</p>
              <nav className="space-y-1">
                {EMBEDDED_APPS.filter(app => app.category === 'document').map(app => (
                  <button
                    key={app.id}
                    onClick={() => handleSelectApp(app.id)}
                    className={`w-full text-left px-5 py-3 text-sm font-medium transition-colors ${
                      activeApp === app.id ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-blue-50'
                    }`}
                  >
                    {app.name}
                  </button>
                ))}
              </nav>
            </div>
            
            <div>
              <p className="px-4 pb-2 text-sm font-semibold text-gray-500 uppercase tracking-wide">シミュレーター</p>
              <nav className="space-y-1">
                {EMBEDDED_APPS.filter(app => app.category === 'simulator').map(app => (
                  <button
                    key={app.id}
                    onClick={() => handleSelectApp(app.id)}
                    className={`w-full text-left px-5 py-3 text-sm font-medium transition-colors ${
                      activeApp === app.id ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-blue-50'
                    }`}
                  >
                    {app.name}
                  </button>
                ))}
              </nav>
            </div>
          </div>
        </div>
      </aside>

      <section className="flex-1 flex flex-col">
        <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between shadow-sm">
          <button
            type="button"
            className="p-2 rounded-md text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            onClick={() => setIsSidebarCollapsed(prev => !prev)}
            aria-label="サイドバーを切り替え"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="text-center">
            <p className="text-xs uppercase tracking-wider text-gray-400">現在のアプリ</p>
            <h2 className="text-lg font-semibold text-gray-900">
              {EMBEDDED_APPS.find(app => app.id === activeApp)?.name || '資料作成'}
            </h2>
          </div>
          <div className="w-6" aria-hidden="true" />
        </header>

        <div className="flex-1 bg-gray-200">
          {EMBEDDED_APPS.map(app => (
            <iframe
              key={app.id}
              src={app.url}
              title={app.name}
              className={`${iframeClass} ${activeApp === app.id ? 'block' : 'hidden'}`}
              loading="lazy"
            />
          ))}
        </div>
      </section>
    </div>
  );
};

export default DocumentCreationHub;
