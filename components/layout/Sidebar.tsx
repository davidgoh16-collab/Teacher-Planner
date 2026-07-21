import React from 'react';
import {
  Home, CalendarDays, Users, FolderKanban, LayoutGrid, CalendarClock,
  Settings, LogOut, Download, ChevronDown, PanelLeftClose, PanelLeftOpen, Share2,
} from 'lucide-react';
import { AppTab, AppItem, AcademicYear } from '../../types';
import IconRenderer from '../ui/IconRenderer';
import SectionLabel from '../ui/SectionLabel';

interface SidebarUser { displayName?: string | null; email?: string | null; photoURL?: string | null; }

interface SidebarProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  favouriteApps: AppItem[];
  onOpenApp: (app: AppItem) => void;
  academicYears: AcademicYear[];
  selectedAcademicYearId: string | null;
  onAcademicYearChange: (id: string) => void;
  isReadOnly: boolean;
  isAdmin: boolean;
  user: SidebarUser | null;
  theme: string;
  themeIcon: React.ReactNode;
  onCycleTheme: () => void;
  onOpenSettings: () => void;
  onOpenCalendar: () => void;
  onExport: () => void;
  onLogout: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onNavigate?: () => void;
}

const NAV: { id: AppTab; label: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number }> }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'timetable', label: 'My Timetable', icon: CalendarDays },
  { id: 'meetings', label: 'Meeting Planner', icon: Users },
  { id: 'projects', label: 'Project Planner', icon: FolderKanban },
  { id: 'apps', label: 'Apps', icon: LayoutGrid },
  { id: 'keyDates', label: 'Key Dates', icon: CalendarClock },
  { id: 'shared', label: 'Shared', icon: Share2 },
];

const Sidebar: React.FC<SidebarProps> = ({
  activeTab, onTabChange, favouriteApps, onOpenApp,
  academicYears, selectedAcademicYearId, onAcademicYearChange, isReadOnly,
  isAdmin, user, theme, themeIcon, onCycleTheme, onOpenSettings, onOpenCalendar, onExport, onLogout,
  collapsed, onToggleCollapsed, onNavigate,
}) => {
  const handleNav = (tab: AppTab) => { onTabChange(tab); onNavigate?.(); };

  return (
    <aside
      className={`${collapsed ? 'w-16' : 'w-60'} h-full flex flex-col border-r border-black/[0.06] bg-[#faf7f2] dark:border-white/[0.08] dark:bg-[#1c1a17] transition-[width] duration-200`}
    >
      {/* Brand + academic year */}
      <div className="p-3">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="" className="h-8 w-8 shrink-0" />
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <h1 className="font-serif text-base font-bold tracking-tight truncate text-slate-900 dark:text-white">Teacher Planner</h1>
              <div className="flex items-center mt-0.5 relative">
                <select
                  value={selectedAcademicYearId || ''}
                  onChange={(e) => onAcademicYearChange(e.target.value)}
                  className="appearance-none bg-transparent text-[11px] text-slate-500 dark:text-slate-400 font-medium cursor-pointer hover:text-primary-700 dark:hover:text-primary-300 pr-4 outline-none focus:ring-0 max-w-full truncate"
                >
                  {academicYears.map(y => (<option key={y.id} value={y.id}>{y.name}</option>))}
                </select>
                <ChevronDown size={10} className="absolute right-0 text-slate-400 pointer-events-none" />
              </div>
              {isReadOnly && <span className="text-amber-600 dark:text-amber-400 font-semibold text-[10px]">View Only</span>}
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {NAV.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => handleNav(id)}
              aria-current={active ? 'page' : undefined}
              title={collapsed ? label : undefined}
              className={`w-full flex items-center gap-3 ${collapsed ? 'justify-center' : ''} px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                active
                  ? 'bg-primary-50 text-primary-800 dark:bg-primary-900/30 dark:text-primary-200'
                  : 'text-slate-600 hover:bg-black/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.06]'
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
              {!collapsed && <span className="truncate">{label}</span>}
            </button>
          );
        })}

        {/* Favourite apps */}
        {favouriteApps.length > 0 && (
          <div className="pt-3 mt-2 border-t border-black/[0.06] dark:border-white/[0.08]">
            {!collapsed && <SectionLabel className="px-3 pb-1.5">Favourites</SectionLabel>}
            <div className={collapsed ? 'space-y-1' : 'space-y-0.5'}>
              {favouriteApps.map(app => (
                <button
                  key={app.id}
                  onClick={() => onOpenApp(app)}
                  title={app.name}
                  className={`w-full flex items-center gap-2.5 ${collapsed ? 'justify-center' : ''} px-2 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-black/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.06] transition-colors`}
                >
                  <IconRenderer app={app} size={16} className="w-7 h-7" rounded="rounded-lg" />
                  {!collapsed && <span className="truncate">{app.name}</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quiet tool rows */}
        <div className="pt-3 mt-2 border-t border-black/[0.06] dark:border-white/[0.08] space-y-0.5">
          <button onClick={onOpenCalendar} title="School Calendar" className={`w-full flex items-center gap-3 ${collapsed ? 'justify-center' : ''} px-3 py-2 rounded-xl text-sm text-slate-600 hover:bg-black/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.06] transition-colors`}>
            <CalendarDays size={18} strokeWidth={1.8} />{!collapsed && <span>Calendar</span>}
          </button>
          {isAdmin && (
            <button onClick={onExport} title="Backup data" className={`w-full flex items-center gap-3 ${collapsed ? 'justify-center' : ''} px-3 py-2 rounded-xl text-sm text-slate-600 hover:bg-black/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.06] transition-colors`}>
              <Download size={18} strokeWidth={1.8} />{!collapsed && <span>Backup</span>}
            </button>
          )}
          <button onClick={onOpenSettings} title="Settings" className={`w-full flex items-center gap-3 ${collapsed ? 'justify-center' : ''} px-3 py-2 rounded-xl text-sm text-slate-600 hover:bg-black/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.06] transition-colors`}>
            <Settings size={18} strokeWidth={1.8} />{!collapsed && <span>Settings</span>}
          </button>
        </div>
      </nav>

      {/* Footer: profile + theme + collapse */}
      <div className="mt-auto p-2 border-t border-black/[0.06] dark:border-white/[0.08]">
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-2'} p-1.5`}>
          {user?.photoURL ? (
            <img src={user.photoURL} alt="User" className="w-8 h-8 rounded-full shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
              {user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U'}
            </div>
          )}
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold truncate text-slate-800 dark:text-slate-100">{user?.displayName || 'User'}</p>
                <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
              </div>
              <button onClick={onCycleTheme} title={`Theme: ${theme}`} className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-black/[0.04] hover:text-slate-600 dark:hover:bg-white/[0.06] dark:hover:text-slate-300 transition-colors shrink-0">
                {themeIcon}
              </button>
              <button onClick={onLogout} title="Sign Out" className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20 dark:hover:text-rose-400 transition-colors shrink-0">
                <LogOut size={16} />
              </button>
            </>
          )}
        </div>
        <button onClick={onToggleCollapsed} className="hidden md:flex w-full items-center justify-center gap-2 px-3 py-2 mt-1 rounded-xl text-xs text-slate-400 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors" title={collapsed ? 'Expand' : 'Collapse'}>
          {collapsed ? <PanelLeftOpen size={18} /> : <><PanelLeftClose size={18} /> <span>Collapse</span></>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
