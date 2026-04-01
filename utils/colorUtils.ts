export const getContrastTextColor = (colorVal: string): string => {
  // If no colorVal is provided, use default white text for dark mode
  if (!colorVal) return 'text-slate-900 dark:text-white';

  // Support for Hex color codes (e.g. from freeform color picker)
  if (colorVal.startsWith('#')) {
    const hex = colorVal.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    // Calculate relative luminance (approximate)
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;

    // If it's a bright color, use dark text. Otherwise light text.
    return (yiq >= 128) ? 'text-slate-900' : 'text-slate-50';
  }

  // Support for Tailwind classes
  const brightBackgrounds = [
    'bg-yellow-100', 'bg-lime-100', 'bg-cyan-100', 'bg-sky-200',
    'bg-teal-100', 'bg-green-100', 'bg-emerald-100', 'bg-orange-100',
    'bg-amber-100', 'bg-pink-100', 'bg-rose-100'
  ];

  const isBright = brightBackgrounds.some(brightClass => colorVal.includes(brightClass));

  if (isBright) {
    // If it's a bright background, force dark text even in dark mode
    return 'text-slate-900 dark:text-slate-900';
  }

  // Default text color: dark in light mode, white in dark mode
  return 'text-slate-900 dark:text-white';
};

export const getEntryStyle = (entry: any | null | undefined) => {
   if (!entry) return {};

   if (entry.colorClass?.startsWith('#')) {
       const textColorClass = getContrastTextColor(entry.colorClass);
       return {
         backgroundColor: entry.colorClass,
         color: textColorClass === 'text-slate-900' ? '#0f172a' : '#f8fafc',
         borderColor: `${entry.colorClass}80`
       };
   }
   return {};
};

export const getEntryClassName = (entry: any | null | undefined) => {
   if (!entry) return 'bg-gray-50 dark:bg-slate-800/50 border-gray-300 dark:border-slate-600';

   if (entry.colorClass?.startsWith('#')) {
       return 'border-dashed border shadow-sm';
   }

   return entry.colorClass || 'bg-gray-50 dark:bg-slate-800/50 border-gray-300 dark:border-slate-600 border-dashed border';
};
