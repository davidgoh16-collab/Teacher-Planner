import React from 'react';
import {
  Home, CalendarDays, Users, FolderKanban, LayoutGrid, CalendarClock,
  Settings, LogOut, Download, Star, ChevronDown, PanelLeftClose, PanelLeftOpen, BookOpen, Share2,
} from 'lucide-react';
import { AppTab, AppItem, AcademicYear } from '../../types';
import IconRenderer from '../ui/IconRenderer';

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
  /** Current pixel width (desktop). When set, drives an inline width + drag handle. */
  width?: number;
  /** True while the user is dragging the resize handle (disables width transition). */
  dragging?: boolean;
  onResizeStart?: (e: React.PointerEvent) => void;
  onNavigate?: () => void;
}

const NAV: { id: AppTab; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
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
  collapsed, onToggleCollapsed, width, dragging, onResizeStart, onNavigate,
}) => {
  const handleNav = (tab: AppTab) => { onTabChange(tab); onNavigate?.(); };

  // When `width` is provided (desktop) we drive size via an inline style so it can be
  // dragged freely; otherwise (mobile drawer) fall back to a fixed Tailwind width.
  const widthClass = collapsed ? 'w-16' : 'w-64';

  return (
    <aside
      style={width != null ? { width } : undefined}
      className={`${width != null ? '' : widthClass} relative h-full flex flex-col bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 ${dragging ? '' : 'transition-[width] duration-200'}`}
    >
      {/* Brand + academic year */}
      <div className="p-3 border-b border-gray-200 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="bg-primary-600 p-2 rounded-xl shadow-sm shrink-0">
            <BookOpen size={20} className="text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <h1 className="text-base font-bold tracking-tight truncate">Teacher Planner</h1>
              <div className="flex items-center mt-0.5 relative group/year">
                <select
                  value={selectedAcademicYearId || ''}
                  onChange={(e) => onAcademicYearChange(e.target.value)}
                  className="appearance-none bg-transparent text-[11px] text-slate-500 dark:text-slate-400 font-medium cursor-pointer hover:text-primary-600 dark:hover:text-primary-400 pr-4 outline-none focus:ring-0 max-w-full truncate"
                >
                  {academicYears.map(y => (<option key={y.id} value={y.id}>{y.name}</option>))}
                </select>
                <ChevronDown size={10} className="absolute right-0 text-slate-400 pointer-events-none" />
              </div>
              {isReadOnly && <span className="text-orange-500 font-semibold text-[10px]">View Only</span>}
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
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
                  ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                  : 'text-slate-600 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              <Icon size={20} />
              {!collapsed && <span className="truncate">{label}</span>}
            </button>
          );
        })}

        {/* Favourite apps */}
        {favouriteApps.length > 0 && (
          <div className="pt-3 mt-2 border-t border-gray-100 dark:border-slate-800">
            {!collapsed && (
              <div className="flex items-center gap-1.5 px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                <Star size={12} /> Favourites
              </div>
            )}
            <div className={collapsed ? 'space-y-1' : 'space-y-0.5'}>
              {favouriteApps.map(app => (
                <button
                  key={app.id}
                  onClick={() => onOpenApp(app)}
                  title={app.name}
                  className={`w-full flex items-center gap-2.5 ${collapsed ? 'justify-center' : ''} px-2 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors`}
                >
                  <IconRenderer app={app} size={16} className="w-7 h-7" rounded="rounded-lg" />
                  {!collapsed && <span className="truncate">{app.name}</span>}
                </button>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Bottom cluster */}
      <div className="p-2 border-t border-gray-200 dark:border-slate-800 space-y-1">
        <button onClick={onOpenCalendar} title="School Calendar" className={`w-full flex items-center gap-3 ${collapsed ? 'justify-center' : ''} px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors`}>
          <CalendarDays size={18} />{!collapsed && <span>Calendar</span>}
        </button>
        {isAdmin && (
          <button onClick={onExport} title="Backup data" className={`w-full flex items-center gap-3 ${collapsed ? 'justify-center' : ''} px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors`}>
            <Download size={18} />{!collapsed && <span>Backup</span>}
          </button>
        )}
        <button onClick={onCycleTheme} title={`Theme: ${theme}`} className={`w-full flex items-center gap-3 ${collapsed ? 'justify-center' : ''} px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors`}>
          {themeIcon}{!collapsed && <span className="capitalize">{theme}</span>}
        </button>
        <button onClick={onOpenSettings} title="Settings" className={`w-full flex items-center gap-3 ${collapsed ? 'justify-center' : ''} px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors`}>
          <Settings size={18} />{!collapsed && <span>Settings</span>}
        </button>

        {/* Profile */}
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-2'} pt-2 mt-1 border-t border-gray-100 dark:border-slate-800`}>
          {user?.photoURL ? (
            <img src={user.photoURL} alt="User" className="w-8 h-8 rounded-full border border-gray-300 dark:border-slate-600 shadow-sm shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-xs font-bold text-white shadow-sm shrink-0">
              {user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U'}
            </div>
          )}
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold truncate">{user?.displayName || 'User'}</p>
                <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
              </div>
              <button onClick={onLogout} title="Sign Out" className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/20 rounded-lg transition-colors shrink-0">
                <LogOut size={16} />
              </button>
            </>
          )}
        </div>

        {/* Collapse toggle (desktop only) */}
        <button onClick={onToggleCollapsed} className="hidden md:flex w-full items-center justify-center gap-2 px-3 py-2 mt-1 rounded-lg text-xs text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors" title={collapsed ? 'Expand' : 'Collapse'}>
          {collapsed ? <PanelLeftOpen size={18} /> : <><PanelLeftClose size={18} /> <span>Collapse</span></>}
        </button>
      </div>

      {/* Resize handle (desktop) — drag to widen/narrow, double-click to snap. */}
      {onResizeStart && (
        <div
          onPointerDown={onResizeStart}
          onDoubleClick={onToggleCollapsed}
          role="separator"
          aria-orientation="vertical"
          title="Drag to resize · double-click to toggle"
          className="hidden md:block absolute top-0 right-0 h-full w-1.5 cursor-col-resize z-20 group"
        >
          <div className="absolute inset-y-0 right-0 w-px group-hover:bg-primary-400 group-active:bg-primary-500 transition-colors" />
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
