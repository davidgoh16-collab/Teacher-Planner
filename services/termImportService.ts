import { getAiClient, TEXT_MODEL, extractAndParseJSON } from './aiService';

/**
 * Extract school term dates from a public web page using Gemini's `url_context` tool: the model
 * fetches and reads the page server-side (so there's no browser CORS problem) and returns the
 * terms as JSON, which the caller reviews before saving. `google_search` is included so the model
 * can ground ambiguous pages (e.g. a council site listing several schools).
 */

export interface ExtractedTerm {
  name: string;
  startDate: string;            // YYYY-MM-DD
  endDate: string;              // YYYY-MM-DD
  halfTermStart?: string | null;
  halfTermEnd?: string | null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const isoOrNull = (value: unknown): string | null =>
  typeof value === 'string' && ISO_DATE.test(value) ? value : null;

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

  let response;
  try {
    const ai = getAiClient();
    // NOTE: tools cannot be combined with responseSchema, so the JSON shape is prompt-enforced
    // and recovered with extractAndParseJSON.
    response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: prompt,
      config: {
        tools: [{ urlContext: {} }, { googleSearch: {} }],
      },
    });
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (msg.includes('API key')) {
      throw new Error('The AI assistant is not configured (missing Gemini API key), so the page cannot be read. Add the dates manually instead.');
    }
    throw new Error(`Could not read that page (${msg.slice(0, 200)}). Check the link, or paste the dates instead.`);
  }

  const text = response.text || '';
  if (!text.trim()) {
    // When url_context fails to retrieve the page the model often returns nothing; the retrieval
    // status in urlContextMetadata distinguishes "blocked/unreachable page" from a model blip.
    const meta: any = (response as any).candidates?.[0]?.urlContextMetadata;
    const statuses = (meta?.urlMetadata || []).map((m: any) => m?.urlRetrievalStatus).join(', ');
    const blocked = statuses.includes('ERROR') || statuses.includes('UNSAFE') || statuses.includes('PAYWALL');
    throw new Error(blocked
      ? 'That page could not be read — it may require a login or block automated readers. Paste the dates instead.'
      : 'The assistant could not read that page. Please check the link or paste the dates instead.');
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
      startDate: isoOrNull(t?.startDate) as string,
      endDate: isoOrNull(t?.endDate) as string,
      halfTermStart: isoOrNull(t?.halfTermStart),
      halfTermEnd: isoOrNull(t?.halfTermEnd),
    }))
    .filter((t: ExtractedTerm) => !!t.startDate && !!t.endDate);

  if (terms.length === 0) {
    throw new Error('No term dates were found on that page.');
  }
  return terms;
};
