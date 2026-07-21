/**
 * Curated timetable colour palette (muted earth tones matching the sage theme).
 *
 * This module is deliberately dependency-free (no React/Firebase/type imports) so the
 * one-off Firestore migration script can import it directly under tsx — the app and the
 * migration share a single source of truth for colour mapping.
 *
 * The literal class strings below are what Tailwind's JIT sees (this file is inside the
 * content globs), and they are also the exact strings stored in Firestore `colorClass`
 * fields after migration. Do not template or compute them.
 */

export interface TimetableColor {
  id: string;
  name: string;
  /** Full light+dark Tailwind string stored in Firestore and rendered on cells. */
  chipClass: string;
  /** Solid dot class for list rows / summaries. */
  dot: string;
  /** Base hex — swatch rendering + nearest-hue matching for legacy hex values. */
  hex: string;
}

export const TIMETABLE_PALETTE: TimetableColor[] = [
  { id: 'sage', name: 'Sage', hex: '#79946e', dot: 'bg-sage-400',
    chipClass: 'bg-sage-100 text-sage-900 border-sage-200 dark:bg-sage-900/30 dark:text-sage-100 dark:border-sage-800' },
  { id: 'ocean', name: 'Ocean', hex: '#436d88', dot: 'bg-ocean-400',
    chipClass: 'bg-ocean-100 text-ocean-900 border-ocean-200 dark:bg-ocean-900/30 dark:text-ocean-100 dark:border-ocean-800' },
  { id: 'clay', name: 'Clay', hex: '#b08968', dot: 'bg-clay-400',
    chipClass: 'bg-clay-100 text-clay-900 border-clay-200 dark:bg-clay-900/30 dark:text-clay-100 dark:border-clay-800' },
  { id: 'ochre', name: 'Ochre', hex: '#c1972f', dot: 'bg-ochre-400',
    chipClass: 'bg-ochre-100 text-ochre-900 border-ochre-200 dark:bg-ochre-900/30 dark:text-ochre-100 dark:border-ochre-800' },
  { id: 'terracotta', name: 'Terracotta', hex: '#b3684e', dot: 'bg-terracotta-400',
    chipClass: 'bg-terracotta-100 text-terracotta-900 border-terracotta-200 dark:bg-terracotta-900/30 dark:text-terracotta-100 dark:border-terracotta-800' },
  { id: 'heather', name: 'Heather', hex: '#7f6d9e', dot: 'bg-heather-400',
    chipClass: 'bg-heather-100 text-heather-900 border-heather-200 dark:bg-heather-900/30 dark:text-heather-100 dark:border-heather-800' },
  { id: 'plum', name: 'Plum', hex: '#8a5a6e', dot: 'bg-plum-400',
    chipClass: 'bg-plum-100 text-plum-900 border-plum-200 dark:bg-plum-900/30 dark:text-plum-100 dark:border-plum-800' },
  { id: 'jade', name: 'Jade', hex: '#5f8f8b', dot: 'bg-jade-400',
    chipClass: 'bg-jade-100 text-jade-900 border-jade-200 dark:bg-jade-900/30 dark:text-jade-100 dark:border-jade-800' },
  { id: 'blush', name: 'Blush', hex: '#a56a6a', dot: 'bg-blush-400',
    chipClass: 'bg-blush-100 text-blush-900 border-blush-200 dark:bg-blush-900/30 dark:text-blush-100 dark:border-blush-800' },
  { id: 'slate', name: 'Slate', hex: '#5b6470', dot: 'bg-slate-400',
    chipClass: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700' },
  // Kept distinct from sage: registration/form-group entries (legacy 'emerald') would
  // otherwise collide with green/lime subject colours in the same timetable.
  { id: 'moss', name: 'Moss', hex: '#7c8b5a', dot: 'bg-moss-400',
    chipClass: 'bg-moss-100 text-moss-900 border-moss-200 dark:bg-moss-900/30 dark:text-moss-100 dark:border-moss-800' },
];

const BY_ID: Record<string, TimetableColor> = Object.fromEntries(TIMETABLE_PALETTE.map(c => [c.id, c]));
const CHIP_SET = new Set(TIMETABLE_PALETTE.map(c => c.chipClass));

/** Legacy Tailwind colour family → palette id. */
const FAMILY_MAP: Record<string, string> = {
  red: 'terracotta',
  orange: 'clay', amber: 'clay',
  yellow: 'ochre',
  lime: 'sage', green: 'sage', emerald: 'moss',
  teal: 'jade',
  sky: 'ocean', blue: 'ocean', cyan: 'ocean',
  indigo: 'heather', violet: 'heather',
  purple: 'plum', fuchsia: 'plum',
  pink: 'blush', rose: 'blush',
  gray: 'slate', slate: 'slate', zinc: 'slate', neutral: 'slate', stone: 'slate',
};

const hexToHsl = (hex: string): [number, number, number] | null => {
  const m = /^#?([0-9a-f]{6})/i.exec(hex.trim());
  if (!m) return null;
  const num = parseInt(m[1], 16);
  const r = ((num >> 16) & 255) / 255, g = ((num >> 8) & 255) / 255, b = (num & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d !== 0) {
    switch (max) {
      case r: h = ((g - b) / d) % 6; break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4; break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s, l];
};

const hexToPaletteId = (hex: string): string => {
  const hsl = hexToHsl(hex);
  if (!hsl) return 'slate';
  const [h, s, l] = hsl;
  if (s < 0.18 || l > 0.94 || l < 0.08) return 'slate';
  if (h < 15 || h >= 345) return h >= 330 && h < 345 ? 'blush' : 'terracotta';
  if (h < 45) return 'clay';
  if (h < 70) return 'ochre';
  if (h < 160) return 'sage';
  if (h < 185) return 'jade';
  if (h < 255) return 'ocean';
  if (h < 290) return 'heather';
  if (h < 330) return 'plum';
  return 'blush';
};

/**
 * Map any stored colorClass value (legacy Tailwind string, hex, or already-migrated
 * palette chip) to a palette chipClass. Pure and idempotent.
 */
export const mapLegacyColor = (colorClass: string | null | undefined): string => {
  if (!colorClass) return '';
  const value = colorClass.trim();
  const italic = /\bitalic\b/.test(value);
  const bare = value.replace(/\s*\bitalic\b\s*/g, ' ').trim();

  // Already on-palette (with or without the italic modifier)
  if (CHIP_SET.has(bare)) return italic ? `${bare} italic` : bare;

  // Hex → hue bucket
  if (/^#[0-9a-f]{6}/i.test(bare)) {
    const chip = BY_ID[hexToPaletteId(bare)].chipClass;
    return italic ? `${chip} italic` : chip;
  }

  // Tailwind class string → family of the first bg- utility
  const fam = /(?:^|\s)bg-([a-z]+)-/.exec(bare)?.[1];
  const id = (fam && FAMILY_MAP[fam]) || 'slate';
  const chip = BY_ID[id].chipClass;
  return italic ? `${chip} italic` : chip;
};

type EntryLike = { colorClass?: string } | null | undefined;
type WeekLike = Record<string, Record<string, EntryLike>>;

/** Map every entry.colorClass in a WeeklyTimetable-shaped object. Returns a new object. */
export const clampTimetableColors = <T extends WeekLike>(week: T): T => {
  if (!week || typeof week !== 'object') return week;
  const out: any = {};
  for (const day of Object.keys(week)) {
    const periods = week[day];
    if (!periods || typeof periods !== 'object') { out[day] = periods; continue; }
    out[day] = {};
    for (const period of Object.keys(periods)) {
      const entry = periods[period];
      out[day][period] = entry && entry.colorClass
        ? { ...entry, colorClass: mapLegacyColor(entry.colorClass) }
        : entry;
    }
  }
  return out;
};

/** Palette entry whose chipClass matches the (mapped) colour, or null. */
export const getPaletteForClass = (colorClass: string | null | undefined): TimetableColor | null => {
  if (!colorClass) return null;
  const mapped = mapLegacyColor(colorClass).replace(/\s*\bitalic\b\s*/g, ' ').trim();
  return TIMETABLE_PALETTE.find(c => c.chipClass === mapped) || null;
};

/** Solid dot class for a colour (list rows, summaries). */
export const getTimetableDot = (colorClass: string | null | undefined): string =>
  getPaletteForClass(colorClass)?.dot || 'bg-slate-300 dark:bg-slate-600';
