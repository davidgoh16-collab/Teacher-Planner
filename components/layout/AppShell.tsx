import React, { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import Sidebar from './Sidebar';
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
 * App frame: persistent left Sidebar + a slim global top bar (title + search) +
 * an optional view-specific toolbar sub-row + the scrollable main content.
 * On mobile the sidebar becomes an off-canvas drawer.
 */
const SIDEBAR_MIN = 64;      // narrowest: icon-only
const SIDEBAR_MAX = 340;
const SIDEBAR_NARROW = 64;   // default width (icons only)
const SIDEBAR_WIDE = 248;    // snap target when expanding
const COLLAPSE_AT = 150;     // below this width, labels are hidden

const AppShell: React.FC<AppShellProps> = ({ search, topBar, children, ...rest }) => {
  const [width, setWidth] = useState(() => {
    const saved = Number(localStorage.getItem('tp_sidebar_width'));
    return saved >= SIDEBAR_MIN && saved <= SIDEBAR_MAX ? saved : SIDEBAR_NARROW;
  });
  const [dragging, setDragging] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('tp_sidebar_width', String(width));
  }, [width]);

  const collapsed = width < COLLAPSE_AT;
  const toggleCollapsed = () => setWidth(w => (w < COLLAPSE_AT ? SIDEBAR_WIDE : SIDEBAR_NARROW));

  // Pointer-driven resize: track the drag on the window so it keeps working even if
  // the cursor leaves the thin handle. Snap back to icon-width if dragged below the threshold.
  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = width;
    setDragging(true);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    const onMove = (ev: PointerEvent) => {
      setWidth(Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, startW + ev.clientX - startX)));
    };
    const onUp = () => {
      setDragging(false);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setWidth(w => (w < COLLAPSE_AT ? SIDEBAR_NARROW : w));
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <div className="h-screen flex bg-gray-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors duration-200 overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:flex shrink-0">
        <Sidebar {...rest} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} width={width} dragging={dragging} onResizeStart={startResize} />
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-[60] flex">
          <div className="fixed inset-0 bg-black/50 animate-in fade-in" onClick={() => setMobileOpen(false)} />
          <div className="relative z-10 h-full shadow-2xl animate-in slide-in-from-left-16">
            <Sidebar
              {...rest}
              collapsed={false}
              onToggleCollapsed={() => {}}
              onNavigate={() => setMobileOpen(false)}
            />
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-3 -right-12 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 p-2 rounded-lg shadow-lg"
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Content column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Global top bar */}
        <header className="shrink-0 h-14 flex items-center gap-3 px-3 sm:px-4 border-b border-gray-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm z-30">
          <button
            onClick={() => setMobileOpen(true)}
            className="md:hidden p-2 -ml-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <h2 className="font-bold text-base sm:text-lg shrink-0">{TITLES[rest.activeTab]}</h2>
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
          <div className="flex-1 overflow-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppShell;
