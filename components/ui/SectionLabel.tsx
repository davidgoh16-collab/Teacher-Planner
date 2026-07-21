import React from 'react';

const SectionLabel: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <p className={`text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500 ${className}`}>
    {children}
  </p>
);

export default SectionLabel;
