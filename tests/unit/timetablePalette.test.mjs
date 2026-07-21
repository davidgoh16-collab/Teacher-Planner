// Run with: npx tsx --test tests/unit/timetablePalette.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TIMETABLE_PALETTE,
  mapLegacyColor,
  clampTimetableColors,
  getTimetableDot,
} from '../../utils/timetablePalette.ts';

const chip = (id) => TIMETABLE_PALETTE.find(c => c.id === id).chipClass;

test('legacy Tailwind families map to the expected palette', () => {
  assert.equal(mapLegacyColor('bg-red-100 text-red-900 border-red-200 dark:bg-red-900/30 dark:text-red-100 dark:border-red-800'), chip('terracotta'));
  assert.equal(mapLegacyColor('bg-green-100 text-green-900 border-green-200 dark:bg-green-900/30 dark:text-green-100 dark:border-green-800'), chip('sage'));
  assert.equal(mapLegacyColor('bg-emerald-100 text-emerald-900 border-emerald-200'), chip('moss'));
  assert.equal(mapLegacyColor('bg-lime-100 text-lime-900 border-lime-200'), chip('sage'));
  assert.equal(mapLegacyColor('bg-yellow-100 text-yellow-900 border-yellow-200'), chip('ochre'));
  assert.equal(mapLegacyColor('bg-teal-100 text-teal-900 border-teal-200'), chip('jade'));
  assert.equal(mapLegacyColor('bg-orange-100 text-orange-900 border-orange-200'), chip('clay'));
  assert.equal(mapLegacyColor('bg-sky-200 text-sky-900 border-sky-300'), chip('ocean'));
  assert.equal(mapLegacyColor('bg-blue-100 text-blue-900 border-blue-200'), chip('ocean'));
  assert.equal(mapLegacyColor('bg-indigo-50 text-indigo-900 border-indigo-200'), chip('heather'));
  assert.equal(mapLegacyColor('bg-fuchsia-100 text-fuchsia-900 border-fuchsia-200'), chip('plum'));
  assert.equal(mapLegacyColor('bg-pink-50 text-pink-900 border-pink-200'), chip('blush'));
});

test('PPA gray keeps its italic modifier', () => {
  const mapped = mapLegacyColor('bg-gray-50 text-gray-500 border-gray-200 italic dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700');
  assert.ok(mapped.includes('italic'));
  assert.ok(mapped.startsWith(chip('slate')));
});

test('mapping is idempotent', () => {
  for (const c of TIMETABLE_PALETTE) {
    assert.equal(mapLegacyColor(c.chipClass), c.chipClass);
    assert.equal(mapLegacyColor(mapLegacyColor(c.chipClass)), c.chipClass);
  }
  const legacy = 'bg-red-100 text-red-900 border-red-200';
  assert.equal(mapLegacyColor(mapLegacyColor(legacy)), mapLegacyColor(legacy));
});

test('hex values bucket by hue', () => {
  assert.equal(mapLegacyColor('#bbf7d0'), chip('sage'));   // pale mint
  assert.equal(mapLegacyColor('#bfdbfe'), chip('ocean'));  // pale blue
  assert.equal(mapLegacyColor('#dc2626'), chip('terracotta')); // red
  assert.equal(mapLegacyColor('#f59e0b'), chip('clay'));   // amber
  assert.equal(mapLegacyColor('#7c3aed'), chip('heather')); // violet
  assert.equal(mapLegacyColor('#64748b'), chip('slate'));  // low-sat slate
  assert.equal(mapLegacyColor('#ffffff'), chip('slate'));  // near-white
});

test('unknown or empty values', () => {
  assert.equal(mapLegacyColor(''), '');
  assert.equal(mapLegacyColor(null), '');
  assert.equal(mapLegacyColor(undefined), '');
  assert.equal(mapLegacyColor('lol-not-a-class'), chip('slate'));
});

test('clampTimetableColors maps every entry and preserves nulls', () => {
  const week = {
    Monday: {
      'Period 1': { subject: '10M', colorClass: 'bg-emerald-100 text-emerald-900 border-emerald-200' },
      'Period 2': null,
      'Break': null,
    },
  };
  const out = clampTimetableColors(week);
  assert.equal(out.Monday['Period 1'].colorClass, chip('moss'));
  assert.equal(out.Monday['Period 1'].subject, '10M');
  assert.equal(out.Monday['Period 2'], null);
});

test('getTimetableDot resolves to a palette dot with slate fallback', () => {
  assert.equal(getTimetableDot('bg-red-100 text-red-900 border-red-200'), 'bg-terracotta-400');
  assert.equal(getTimetableDot(undefined), 'bg-slate-300 dark:bg-slate-600');
});
