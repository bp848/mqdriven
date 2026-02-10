import React from 'react';

type PageShellProps = {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'md';
};

const PageShell: React.FC<PageShellProps> = ({ children, className, padding = 'md' }) => {
  const paddingClass = padding === 'none' ? 'p-0' : 'p-6';
  const classes = [
    'bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700',
    paddingClass,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return <section className={classes}>{children}</section>;
};

export default PageShell;
