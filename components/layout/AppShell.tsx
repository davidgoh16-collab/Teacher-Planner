import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import BottomNav from '../ui/BottomNav';
import MoreSheet from '../ui/MoreSheet';
import { AppTab, AppItem, AcademicYear } from '../../types';

interface ShellUser { displayName?: string | null; email?: string | null; photoURL?: string | null; }

interface AppShellProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  favouriteApps: AppItem[];
  onOpenApp: (app: AppItem) => void;
  academicYears: AcademicYear[];
  selectedAcademicYearId: string | null;
  onAcademicYearChange: (id: string) => void;
  isReadOnly: boolean;
  isAdmin: boolean;
  user: ShellUser | null;
  theme: string;
  themeIcon: React.ReactNode;
  onCycleTheme: () => void;
  onSetTheme: (t: 'light' | 'dark' | 'system') => void;
  onOpenSettings: () => void;
  onOpenCalendar: () => void;
  onExport: () => void;
  onLogout: () => void;
  /** Global search element, shown in the top bar on every screen. */
  search?: React.ReactNode;
  /** View-specific toolbar (e.g. timetable term/week controls), shown in a sub-row. */
  topBar?: React.ReactNode;
  children: React.ReactNode;
}

const TITLES: Record<AppTab, string> = {
  home: 'Home',
  timetable: 'My Timetable',
  meetings: 'Meeting Planner',
  projects: 'Project Planner',
  apps: 'Apps',
  keyDates: 'Key Dates',
  shared: 'Shared',
};

/**
 * App frame: persistent left Sidebar (desktop) + a slim global top bar (title +
 * search) + an optional view-specific toolbar sub-row + the scrollable main
 * content. On mobile, navigation is a bottom tab bar with a More sheet.
 */
const AppShell: React.FC<AppShellProps> = ({ search, topBar, children, onSetTheme, ...rest }) => {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('tp_sidebar_collapsed') === '1');
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('tp_sidebar_collapsed', collapsed ? '1' : '0');
  }, [collapsed]);

  return (
    <div className="h-screen flex bg-[#faf7f2] dark:bg-[#1c1a17] text-slate-800 dark:text-slate-100 transition-colors duration-200 overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:flex shrink-0">
        <Sidebar {...rest} collapsed={collapsed} onToggleCollapsed={() => setCollapsed(c => !c)} />
      </div>

      {/* Content column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Global top bar — pt inset keeps content clear of the status bar in edge-to-edge mode */}
        <header
          className="shrink-0 flex items-center gap-3 px-3 sm:px-4 border-b border-black/[0.06] dark:border-white/[0.08] bg-[#faf7f2]/90 dark:bg-[#1c1a17]/90 backdrop-blur z-30"
          style={{ height: 'calc(3.5rem + env(safe-area-inset-top))', paddingTop: 'env(safe-area-inset-top)' }}
        >
          <h2 className="font-serif text-base sm:text-lg font-bold shrink-0 text-slate-900 dark:text-white">{TITLES[rest.activeTab]}</h2>
          {topBar ? (
            <div className="flex-1 flex items-center overflow-x-auto no-scrollbar">
              {topBar}
            </div>
          ) : (
            <div className="flex-1" />
          )}
          {search && <div className="w-full max-w-xs sm:max-w-sm shrink-0">{search}</div>}
        </header>

        <main className="flex-1 flex flex-col overflow-hidden relative">
          <div className="flex-1 overflow-auto pb-20 md:pb-0">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile navigation */}
      <BottomNav
        active={rest.activeTab}
        onChange={rest.onTabChange}
        onMore={() => setMoreOpen(true)}
        moreActive={moreOpen}
      />
      <MoreSheet
        isOpen={moreOpen}
        onClose={() => setMoreOpen(false)}
        user={rest.user}
        isAdmin={rest.isAdmin}
        theme={rest.theme as 'light' | 'dark' | 'system'}
        onSetTheme={onSetTheme}
        onTabChange={rest.onTabChange}
        onOpenCalendar={rest.onOpenCalendar}
        onExport={rest.onExport}
        onOpenSettings={rest.onOpenSettings}
        onLogout={rest.onLogout}
      />
    </div>
  );
};

export default AppShell;
