import React from 'react';
import { Info } from 'lucide-react';

/**
 * Consistent "what can I upload?" guidance shown next to every import control.
 * Keeps the accepted-formats line and tips in one visual style across
 * onboarding, Settings and the meeting planner.
 */
interface ImportHelpProps {
  formats: string;
  tips?: string[];
  className?: string;
}

const ImportHelp: React.FC<ImportHelpProps> = ({ formats, tips, className }) => (
  <div className={`rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs text-slate-600 dark:text-slate-300 space-y-1 ${className || ''}`}>
    <p className="flex items-start gap-1.5">
      <Info size={13} className="shrink-0 mt-0.5 text-primary-600 dark:text-primary-400" />
      <span><span className="font-semibold">Accepted:</span> {formats}</span>
    </p>
    {tips && tips.length > 0 && (
      <ul className="list-disc pl-6 space-y-0.5 text-slate-500 dark:text-slate-400">
        {tips.map((tip, i) => <li key={i}>{tip}</li>)}
      </ul>
    )}
  </div>
);

export default ImportHelp;
