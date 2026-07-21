/**
 * App-wide accent theming.
 *
 * The Tailwind `primary` scale is defined in index.html as `rgb(var(--primary-N) / <alpha-value>)`,
 * so changing the `--primary-N` CSS variables recolours every `bg-primary-*` / `text-primary-*`
 * usage across the app at runtime. From a single base colour we derive a full 50–950 ramp.
 */

import { LEGACY_OWNER_UID } from '../services/migrationService';

export const DEFAULT_THEME_COLOR = '#436d88'; // ocean (default accent for new users)

/** Sage — the owner's personal brand colour, not offered to other accounts. */
export const OWNER_THEME_COLOR = '#5d7752';
export const SAGE_PRESET: { name: string; hex: string } = { name: 'Sage', hex: OWNER_THEME_COLOR };

/** Legacy brand green — old accounts that never picked an accent still store this. */
export const LEGACY_DEFAULT_THEME_COLOR = '#16a34a';

// Muted, earthy presets offered in onboarding / settings.
export const THEME_PRESETS: { name: string; hex: string }[] = [
  { name: 'Ocean', hex: '#436d88' },
  { name: 'Teal', hex: '#5f8f8b' },
  { name: 'Denim', hex: '#55628e' },
  { name: 'Heather', hex: '#7f6d9e' },
  { name: 'Plum', hex: '#8a5a6e' },
  { name: 'Terracotta', hex: '#b3684e' },
  { name: 'Clay', hex: '#b08968' },
  { name: 'Ochre', hex: '#c1972f' },
  { name: 'Rose', hex: '#a56a6a' },
  { name: 'Slate', hex: '#5b6470' },
];

/** Presets for a given user: everyone gets the muted set; the owner also gets Sage (first). */
export const getThemePresets = (uid?: string | null): { name: string; hex: string }[] =>
  uid === LEGACY_OWNER_UID ? [SAGE_PRESET, ...THEME_PRESETS] : THEME_PRESETS;

// Target lightness for each Tailwind stop (0–1). Hue + saturation come from the chosen colour.
const LIGHTNESS: Record<string, number> = {
  '50': 0.971, '100': 0.936, '200': 0.860, '300': 0.760, '400': 0.660,
  '500': 0.560, '600': 0.480, '700': 0.405, '800': 0.330, '900': 0.265, '950': 0.165,
};

const hexToRgb = (hex: string): [number, number, number] | null => {
  let h = (hex || '').replace('#', '').trim();
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return null;
  const num = parseInt(h, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
};

const rgbToHsl = (r: number, g: number, b: number): [number, number, number] => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0;
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
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

const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
};

/**
 * Hand-tuned ramps that the HSL formula can't reproduce faithfully — the canonical
 * sage scale shared with David's other apps sits darker/warmer than the formula's
 * lightness targets would place it.
 */
const EXACT_SCALES: Record<string, Record<string, string>> = {
  [OWNER_THEME_COLOR]: {
    '50': '244 247 242',
    '100': '230 237 226',
    '200': '206 220 198',
    '300': '173 194 162',
    '400': '139 165 125',
    '500': '121 148 110',
    '600': '93 119 82',
    '700': '74 95 66',
    '800': '61 78 55',
    '900': '51 64 46',
    '950': '26 34 23',
  },
};

/** Derive the 50–950 ramp from a base hex, as "R G B" channel strings for CSS vars. */
export const deriveScale = (baseHex: string): Record<string, string> => {
  const exact = EXACT_SCALES[(baseHex || '').toLowerCase()];
  if (exact) return { ...exact };
  const rgb = hexToRgb(baseHex) || hexToRgb(DEFAULT_THEME_COLOR)!;
  const [h, s] = rgbToHsl(rgb[0], rgb[1], rgb[2]);
  const sat = Math.min(1, Math.max(0.1, s)); // low floor: muted presets must stay muted
  const scale: Record<string, string> = {};
  for (const [stop, lightness] of Object.entries(LIGHTNESS)) {
    const [r, g, b] = hslToRgb(h, sat, lightness);
    scale[stop] = `${r} ${g} ${b}`;
  }
  return scale;
};

/** Apply a base colour to the document so all primary-* utilities update. */
export const applyThemeColor = (baseHex: string | null | undefined): void => {
  const scale = deriveScale(baseHex || DEFAULT_THEME_COLOR);
  const root = document.documentElement;
  for (const [stop, channels] of Object.entries(scale)) {
    root.style.setProperty(`--primary-${stop}`, channels);
  }
  // Cache the resolved ramp so the inline script in index.html can apply it before first paint
  // (avoids a one-frame flash of the default colour on reload).
  try { localStorage.setItem('eduPlan_themeVars', JSON.stringify(scale)); } catch { /* ignore */ }
};

export const isValidHex = (hex: string): boolean => hexToRgb(hex) !== null;
