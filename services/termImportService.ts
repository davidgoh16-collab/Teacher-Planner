import { createAgentInteraction } from './agentService';
import { extractAndParseJSON } from './aiService';

/**
 * Extract school term dates from a web page using the Antigravity agent's built-in `url_context`
 * tool. The agent fetches and reads the page server-side (so there's no browser CORS problem) and
 * returns the terms as JSON, which the caller reviews before saving.
 */

export interface ExtractedTerm {
  name: string;
  startDate: string;            // YYYY-MM-DD
  endDate: string;              // YYYY-MM-DD
  halfTermStart?: string | null;
  halfTermEnd?: string | null;
}

export const extractTermsFromUrl = async (url: string): Promise<ExtractedTerm[]> => {
  const prompt = `Visit this web page and read the school term dates: ${url}

Extract every academic TERM for the academic year(s) shown, with the dates pupils attend.
If half-term break dates are listed within a term, include them.

Return ONLY a JSON array — no prose, no markdown code fences. Each element:
{"name":"Autumn Term 2025","startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD","halfTermStart":"YYYY-MM-DD or null","halfTermEnd":"YYYY-MM-DD or null"}

Rules:
- startDate/endDate are the first and last day pupils attend that term.
- Use ISO dates (YYYY-MM-DD); infer the year from the page context.
- Ignore standalone INSET/staff training days unless they define a term boundary.
- If multiple academic years are shown, include them all.`;

  const interaction = await createAgentInteraction({
    input: prompt,
    tools: [{ type: 'url_context' }, { type: 'google_search' }],
  });

  const text = interaction.output_text || '';
  if (!text.trim()) {
    throw new Error('The agent could not read that page. Please check the link or paste the dates instead.');
  }

  let parsed: any;
  try {
    parsed = extractAndParseJSON(text);
  } catch {
    throw new Error('Could not understand the term dates on that page. Try pasting them instead.');
  }

  const arr = Array.isArray(parsed) ? parsed : (parsed?.terms || []);
  const terms: ExtractedTerm[] = (Array.isArray(arr) ? arr : [])
    .map((t: any) => ({
      name: String(t?.name || '').trim() || 'Term',
      startDate: t?.startDate,
      endDate: t?.endDate,
      halfTermStart: t?.halfTermStart || null,
      halfTermEnd: t?.halfTermEnd || null,
    }))
    .filter((t: ExtractedTerm) => !!t.startDate && !!t.endDate);

  if (terms.length === 0) {
    throw new Error('No term dates were found on that page.');
  }
  return terms;
};
