/**
 * Which product this build is.
 *
 * One codebase ships two things: David's own planner, and the version sold to schools. The
 * difference is configuration, not a fork — a fork would need every fix applied twice and would
 * drift within weeks.
 *
 *   personal  everything on, sage theme, his Firebase project, consumer Gemini API
 *   school    white-labelled per school, org membership and licensing, compliance surfaces,
 *             and AI served from Gemini Enterprise Agent Platform under a Cloud DPA
 *
 * The edition is fixed at build time by VITE_EDITION, but the server can override it at runtime
 * through /env.js, so one image can serve either.
 */

export type Edition = 'personal' | 'school';

export interface EditionFlags {
  edition: Edition;
  /** Org branding replaces the product name, logo and theme. */
  whiteLabel: boolean;
  /** Organisations, membership, invites and licensing. */
  orgs: boolean;
  /** First-run AI safety notice and the standing "no pupil data" reminders. */
  complianceSurfaces: boolean;
  /** The sage palette, which is David's own and not part of what schools buy. */
  sagePreset: boolean;
  /** One-off migration of his pre-multi-user data. */
  legacyMigration: boolean;
  /** Live voice assistant. Off for schools until its data path has the same guarantees. */
  liveVoice: boolean;
  /** The Capacitor Android build, which bakes an API key and is personal-only. */
  nativeAndroid: boolean;
}

const FLAGS: Record<Edition, EditionFlags> = {
  personal: {
    edition: 'personal',
    whiteLabel: false,
    orgs: false,
    complianceSurfaces: false,
    sagePreset: true,
    legacyMigration: true,
    liveVoice: true,
    nativeAndroid: true,
  },
  school: {
    edition: 'school',
    whiteLabel: true,
    orgs: true,
    complianceSurfaces: true,
    sagePreset: false,
    legacyMigration: false,
    liveVoice: false,
    nativeAndroid: false,
  },
};

const resolveEdition = (): Edition => {
  // The server's value wins: it lets one built image be deployed as either edition.
  const runtime = typeof window !== 'undefined' ? window.ENV?.EDITION : undefined;
  const build = import.meta.env?.VITE_EDITION as string | undefined;
  const value = runtime || build || 'personal';
  return value === 'school' ? 'school' : 'personal';
};

export const EDITION: Edition = resolveEdition();
export const flags: EditionFlags = FLAGS[EDITION];

/** True for the version sold to schools. */
export const isSchoolEdition = (): boolean => EDITION === 'school';
