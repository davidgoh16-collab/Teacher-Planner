import React from 'react';

// The single serif heading per screen, with optional subtitle and actions row.
interface PageHeadingProps {
  title: string;
  sub?: string;
  actions?: React.ReactNode;
}

const PageHeading: React.FC<PageHeadingProps> = ({ title, sub, actions }) => (
  <div className="mb-6 flex items-end justify-between gap-3">
    <div className="min-w-0">
      <h1 className="font-serif text-2xl text-slate-900 dark:text-white">{title}</h1>
      {sub && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{sub}</p>}
    </div>
    {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
  </div>
);

export default PageHeading;
