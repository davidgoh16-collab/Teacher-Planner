import React from 'react';
import {
  LayoutGrid, CalendarClock, Share2, CalendarDays, Download, Settings, LogOut, ChevronRight,
} from 'lucide-react';
import Sheet from './Sheet';
import SectionLabel from './SectionLabel';
import { AppTab } from '../../types';

type Theme = 'light' | 'dark' | 'system';

interface MoreUser { displayName?: string | null; email?: string | null; photoURL?: string | null; }

interface MoreSheetProps {
  isOpen: boolean;
  onClose: () => void;
  user: MoreUser | null;
  isAdmin: boolean;
  theme: Theme;
  onSetTheme: (t: Theme) => void;
  onTabChange: (tab: AppTab) => void;
  onOpenCalendar: () => void;
  onExport: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
}

const Row: React.FC<{
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  danger?: boolean;
}> = ({ icon: Icon, label, onClick, danger }) => (
  <button
    onClick={onClick}
    className={`flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors ${
      danger
        ? 'text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/20'
        : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700/60'
    }`}
  >
    <Icon size={18} strokeWidth={1.8} />
    <span className="flex-1 text-left">{label}</span>
    <ChevronRight size={16} className="text-slate-300 dark:text-slate-600" />
  </button>
);

const MoreSheet: React.FC<MoreSheetProps> = ({
  isOpen, onClose, user, isAdmin, theme, onSetTheme,
  onTabChange, onOpenCalendar, onExport, onOpenSettings, onLogout,
}) => {
  const go = (fn: () => void) => () => { onClose(); fn(); };
  const nav = (tab: AppTab) => () => { onClose(); onTabChange(tab); };

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title="More">
      <div className="flex items-center gap-3 rounded-2xl border border-black/[0.06] p-3.5 dark:border-white/[0.08]">
        {user?.photoURL ? (
          <img src={user.photoURL} alt="" className="h-11 w-11 rounded-full" />
        ) : (
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-600 text-sm font-bold text-white">
            {user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U'}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{user?.displayName || 'User'}</p>
          <p className="truncate text-xs text-slate-400">{user?.email}</p>
        </div>
      </div>

      <SectionLabel className="mb-1 mt-6">Navigate</SectionLabel>
      <Row icon={LayoutGrid} label="Apps" onClick={nav('apps')} />
      <Row icon={CalendarClock} label="Key Dates" onClick={nav('keyDates')} />
      <Row icon={Share2} label="Shared" onClick={nav('shared')} />

      <SectionLabel className="mb-1 mt-6">Appearance</SectionLabel>
      <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-700/60" role="radiogroup" aria-label="Theme">
        {(['light', 'dark', 'system'] as Theme[]).map(t => (
          <button
            key={t}
            role="radio"
            aria-checked={theme === t}
            onClick={() => onSetTheme(t)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium capitalize transition-all ${
              theme === t
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-600 dark:text-slate-100'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <SectionLabel className="mb-1 mt-6">Tools</SectionLabel>
      <Row icon={CalendarDays} label="School Calendar" onClick={go(onOpenCalendar)} />
      {isAdmin && <Row icon={Download} label="Backup data" onClick={go(onExport)} />}

      <SectionLabel className="mb-1 mt-6">Account</SectionLabel>
      <Row icon={Settings} label="Settings" onClick={go(onOpenSettings)} />
      <Row icon={LogOut} label="Sign out" onClick={onLogout} danger />
    </Sheet>
  );
};

export default MoreSheet;
