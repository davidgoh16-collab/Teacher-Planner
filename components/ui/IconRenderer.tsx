import React from 'react';
import * as LucideIcons from 'lucide-react';
import { AppItem } from '../../types';

interface IconRendererProps {
  app: AppItem;
  /** Glyph size in px. */
  size?: number;
  /** Container sizing classes, e.g. "w-16 h-16". */
  className?: string;
  /** Rounding class. */
  rounded?: string;
}

/**
 * Renders an app's icon — either a custom image URL (with a graceful Globe fallback)
 * or a preset lucide icon. Shared by AppsHub, the sidebar favourites, and the Home grid.
 */
const IconRenderer: React.FC<IconRendererProps> = ({ app, size = 32, className = 'w-16 h-16', rounded = 'rounded-2xl' }) => {
  if (app.iconType === 'imageUrl' && app.iconValue) {
    return (
      <div className={`${className} relative shrink-0`}>
        <img
          src={app.iconValue}
          alt={`${app.name} icon`}
          className={`${className} object-cover ${rounded}`}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
            (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
          }}
        />
        <div className={`${className} ${rounded} hidden items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-500`}>
          <LucideIcons.Globe size={size} />
        </div>
      </div>
    );
  }

  const IconComponent = (LucideIcons as any)[app.iconValue] || LucideIcons.Globe;
  return (
    <div className={`${className} ${app.colorClass || 'bg-white text-slate-800 border-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700'} ${rounded} flex items-center justify-center shadow-sm border shrink-0`}>
      <IconComponent size={size} className={app.colorClass ? 'opacity-80' : 'text-slate-600 dark:text-slate-300'} />
    </div>
  );
};

export default IconRenderer;
