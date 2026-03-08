export const getContrastTextColor = (bgClass: string): string => {
  // If no bgClass is provided, use default white text for dark mode
  if (!bgClass) return 'text-slate-900 dark:text-white';

  // Bright background colors that need dark text in dark mode for visibility
  const brightBackgrounds = [
    'bg-yellow-100', 'bg-lime-100', 'bg-cyan-100', 'bg-sky-200',
    'bg-teal-100', 'bg-green-100', 'bg-emerald-100', 'bg-orange-100',
    'bg-amber-100', 'bg-pink-100', 'bg-rose-100'
  ];

  // Check if the bgClass contains any of the bright background colors
  const isBright = brightBackgrounds.some(brightClass => bgClass.includes(brightClass));

  if (isBright) {
    // If it's a bright background, force dark text even in dark mode
    return 'text-slate-900 dark:text-slate-900';
  }

  // Default text color: dark in light mode, white in dark mode
  return 'text-slate-900 dark:text-white';
};
