// Shared category color palette. Used by the Manage Categories modal and any
// feature that needs to create a category (e.g. the Vibe Project generator).
export const CATEGORY_COLORS = [
  { label: 'Gray', class: 'bg-gray-100 text-gray-800 border-gray-300' },
  { label: 'Red', class: 'bg-red-100 text-red-800 border-red-300' },
  { label: 'Orange', class: 'bg-orange-100 text-orange-800 border-orange-300' },
  { label: 'Amber', class: 'bg-amber-100 text-amber-800 border-amber-300' },
  { label: 'Yellow', class: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  { label: 'Lime', class: 'bg-lime-100 text-lime-800 border-lime-300' },
  { label: 'Green', class: 'bg-green-100 text-green-800 border-green-300' },
  { label: 'Emerald', class: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  { label: 'Teal', class: 'bg-teal-100 text-teal-800 border-teal-300' },
  { label: 'Cyan', class: 'bg-cyan-100 text-cyan-800 border-cyan-300' },
  { label: 'Sky', class: 'bg-sky-100 text-sky-800 border-sky-300' },
  { label: 'Blue', class: 'bg-blue-100 text-blue-800 border-blue-300' },
  { label: 'Indigo', class: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
  { label: 'Violet', class: 'bg-violet-100 text-violet-800 border-violet-300' },
  { label: 'Purple', class: 'bg-purple-100 text-purple-800 border-purple-300' },
  { label: 'Fuchsia', class: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300' },
  { label: 'Pink', class: 'bg-pink-100 text-pink-800 border-pink-300' },
  { label: 'Rose', class: 'bg-rose-100 text-rose-800 border-rose-300' }
];

// Picks a category color class at random (skips Gray so new categories are vivid).
export const getRandomCategoryColor = (): string => {
  const vivid = CATEGORY_COLORS.slice(1);
  return vivid[Math.floor(Math.random() * vivid.length)].class;
};

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
