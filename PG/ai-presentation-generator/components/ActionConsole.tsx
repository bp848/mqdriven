
import React, { useEffect, useRef } from 'react';

interface ActionConsoleProps {
  actions: string[];
}

const ActionConsole: React.FC<ActionConsoleProps> = ({ actions }) => {
  const consoleEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [actions]);

  return (
    <div className="w-full mt-6 bg-slate-900/70 border border-slate-700 rounded-lg p-4 h-48 overflow-y-auto font-mono text-sm text-left">
      {actions.map((action, index) => (
        <div key={index} className="flex items-center gap-2">
          <span className="text-cyan-400">&gt;</span>
          <p className="text-slate-300 whitespace-pre-wrap">{action}</p>
        </div>
      ))}
      <div ref={consoleEndRef} />
    </div>
  );
};

export default ActionConsole;
