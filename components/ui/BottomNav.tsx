import React from 'react';
import { Home, CalendarDays, FolderKanban, Users, Menu } from 'lucide-react';
import { AppTab } from '../../types';

interface BottomNavProps {
  active: AppTab;
  onChange: (tab: AppTab) => void;
  onMore: () => void;
  moreActive?: boolean;
}

const TABS: { id: AppTab; label: string; icon: React.ElementType }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'timetable', label: 'Timetable', icon: CalendarDays },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'meetings', label: 'Meetings', icon: Users },
];

const BottomNav: React.FC<BottomNavProps> = ({ active, onChange, onMore, moreActive }) => (
  <nav
    className="fixed inset-x-0 bottom-0 z-40 border-t border-black/[0.06] bg-[#faf7f2]/90 backdrop-blur dark:border-white/[0.08] dark:bg-[#1c1a17]/90 md:hidden"
    style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
  >
    <div className="flex h-16">
      {TABS.map(({ id, label, icon: Icon }) => {
        const isActive = active === id && !moreActive;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={`flex flex-1 flex-col items-center justify-center gap-1 transition-colors ${
              isActive ? 'text-primary-700 dark:text-primary-300' : 'text-slate-400 dark:text-slate-500'
            }`}
          >
            <Icon size={21} strokeWidth={isActive ? 2.2 : 1.8} />
            <span className="text-[11px] font-medium leading-none">{label}</span>
          </button>
        );
      })}
      <button
        onClick={onMore}
        className={`flex flex-1 flex-col items-center justify-center gap-1 transition-colors ${
          moreActive ? 'text-primary-700 dark:text-primary-300' : 'text-slate-400 dark:text-slate-500'
        }`}
      >
        <Menu size={21} strokeWidth={moreActive ? 2.2 : 1.8} />
        <span className="text-[11px] font-medium leading-none">More</span>
      </button>
    </div>
  </nav>
);

export default BottomNav;
