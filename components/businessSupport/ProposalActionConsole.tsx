import React, { useEffect, useRef } from 'react';

interface ProposalActionConsoleProps {
  actions: string[];
}

const ProposalActionConsole: React.FC<ProposalActionConsoleProps> = ({ actions }) => {
  const consoleEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [actions]);

  if (actions.length === 0) {
    return null;
  }

  return (
    <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-4 h-56 overflow-y-auto font-mono text-sm space-y-1 shadow-inner">
      {actions.map((action, index) => (
        <div key={`${action}-${index}`} className="flex items-start gap-2">
          <span className="text-cyan-400">&gt;</span>
          <p className="text-slate-200 whitespace-pre-wrap">{action}</p>
        </div>
      ))}
      <div ref={consoleEndRef} />
    </div>
  );
};

export default ProposalActionConsole;
