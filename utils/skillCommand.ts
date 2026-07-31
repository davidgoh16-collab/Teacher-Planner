import { TeacherSkill } from '../types';

/**
 * Finding and removing a /skill-slug command in a chat message.
 *
 * Shared because two places have to agree exactly: the chat input, which shows the teacher which
 * skill is about to be used, and the send handler, which strips the command before the model sees
 * it. If they disagree, the chip promises a skill the run never invokes.
 *
 * The command may appear anywhere in the message, not just at the start — people type the request
 * first and reach for the skill afterwards.
 */

// Deliberately not requiring whitespace before the slash. People type "a booklet/exclusion-…" with
// no space, and demanding one silently swallowed the command — the run then went ahead with no
// skill at all. Being permissive is safe: a token only counts if it exactly names a real skill.
const COMMAND_TOKENS = /\/(\S+)/g;

/** The first /token in `message` that names an enabled skill, if any. */
export const findInvokedSkill = (message: string, skills: TeacherSkill[]): TeacherSkill | undefined => {
  if (!message.includes('/')) return undefined;
  for (const match of message.matchAll(COMMAND_TOKENS)) {
    // Trailing punctuation is part of the sentence, not the slug.
    const slug = match[1].toLowerCase().replace(/[.,;:!?)\]}"']+$/, '');
    const skill = skills.find(s => s.enabled && s.slug === slug);
    if (skill) return skill;
  }
  return undefined;
};

/** The message with that command removed, so the model reads the request rather than a stray token. */
export const stripSkillCommand = (message: string, skill: TeacherSkill): string =>
  message
    // Slugs are `[a-z0-9-]` by construction, so nothing here needs regex-escaping.
    .replace(new RegExp(`/${skill.slug}(?=$|\\s|[.,;:!?)\\]])`, 'i'), '')
    .replace(/\(\s*\)|\[\s*\]/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim();
