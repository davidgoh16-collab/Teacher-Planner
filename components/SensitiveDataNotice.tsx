import React from 'react';
import { ShieldAlert, Info } from 'lucide-react';

/**
 * The standing reminder about what not to put into the AI.
 *
 * Two strengths, because the two situations are different. Under a chat box a permanent block of
 * warning text becomes wallpaper within a day, so `inline` is one quiet line. When someone is
 * writing standing instructions or turning on memory, whatever they type persists and gets sent on
 * every future run — that deserves to be read, so `creation` is a block they have to look at.
 *
 * The app pseudonymises names before anything is sent, but that is a safety net, not a licence:
 * free text can carry plenty that no name-matcher will catch.
 */

interface SensitiveDataNoticeProps {
  variant?: 'inline' | 'creation';
  className?: string;
}

const SensitiveDataNotice: React.FC<SensitiveDataNoticeProps> = ({ variant = 'inline', className = '' }) => {
  if (variant === 'inline') {
    return (
      <p className={`flex items-start gap-1.5 text-xs text-slate-500 dark:text-slate-400 ${className}`}>
        <Info className="mt-0.5 h-3 w-3 shrink-0" />
        <span>
          No pupil-identifiable details, please — names you do use are replaced with pseudonyms
          before anything is sent.
        </span>
      </p>
    );
  }

  return (
    <div
      className={`rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-700/60 dark:bg-amber-900/20 ${className}`}
    >
      <p className="flex items-start gap-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
        Before you save this
      </p>
      <ul className="mt-2 space-y-1 pl-6 text-sm text-amber-900/90 dark:text-amber-200/90">
        <li className="list-disc">
          Anything you write here is sent with <em>every</em> future run of this assistant. Keep it
          to how you want work done — not to information about particular children.
        </li>
        <li className="list-disc">
          Never include class lists, reports, SEND or safeguarding records, medical details or
          contact details.
        </li>
        <li className="list-disc">
          Safeguarding concerns are never for an assistant. Speak to your Designated Safeguarding
          Lead and follow your school's procedures.
        </li>
      </ul>
    </div>
  );
};

export default SensitiveDataNotice;
