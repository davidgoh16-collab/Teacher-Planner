import { PseudonymMapping, rehydrateText, TOKEN_REGEX } from './pseudonymiser';

/**
 * Put real names back into files produced inside the agent sandbox.
 *
 * The sandbox only ever receives pseudonymised text, so a PowerPoint the agent builds says
 * "Student_3F2A19B4" where the teacher said a pupil's name. That is the right trade — nothing
 * identifying leaves the browser — but the teacher needs their own file back. Since the mapping is
 * a deterministic hash of the people in their planner, it can be rebuilt at any time and applied
 * at the moment of download.
 *
 * Office formats are zip archives of XML, so the substitution happens on the specific parts that
 * hold visible text. Anything not listed is copied through untouched.
 */

/** Zip entries that carry user-visible text, by document type. */
const TEXT_PARTS: Array<RegExp> = [
  /^word\/(document|footnotes|endnotes|comments|header\d*|footer\d*)\.xml$/,
  /^ppt\/slides\/slide\d+\.xml$/,
  /^ppt\/notesSlides\/notesSlide\d+\.xml$/,
  /^xl\/sharedStrings\.xml$/,
  /^xl\/worksheets\/sheet\d+\.xml$/,
  /^docProps\/(core|app)\.xml$/,
];

const isTextPart = (path: string) => TEXT_PARTS.some(re => re.test(path));

/** True if the bytes contain at least one pseudonym token worth rewriting. */
export const blobLikelyContainsTokens = async (blob: Blob): Promise<boolean> => {
  const text = await blob.text().catch(() => '');
  TOKEN_REGEX.lastIndex = 0;
  return TOKEN_REGEX.test(text);
};

/**
 * Rehydrate an Office document (docx/pptx/xlsx). Returns a new Blob; the original is untouched.
 * jszip is loaded on demand — it is already a dependency for reading .pptx uploads, and there is no
 * reason to carry it in the initial bundle.
 */
export const rehydrateOfficeDocument = async (
  blob: Blob,
  mapping: PseudonymMapping,
  mimeType: string,
): Promise<Blob> => {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(blob);

  const rewrites: Array<Promise<void>> = [];
  zip.forEach((path, entry) => {
    if (entry.dir || !isTextPart(path)) return;
    rewrites.push((async () => {
      const xml = await entry.async('string');
      const restored = rehydrateText(xml, mapping);
      if (restored !== xml) zip.file(path, restored);
    })());
  });
  await Promise.all(rewrites);

  return zip.generateAsync({ type: 'blob', mimeType });
};

/** Rehydrate a plain-text-ish file (md, txt, csv, html). */
export const rehydrateTextBlob = async (
  blob: Blob,
  mapping: PseudonymMapping,
  mimeType: string,
): Promise<Blob> => {
  const text = await blob.text();
  return new Blob([rehydrateText(text, mapping)], { type: mimeType });
};

/**
 * Rehydrate whatever we can, by type. PDFs are deliberately not handled: their text is inside a
 * compressed content stream that can't be rewritten without re-authoring the document, which is
 * why generated output is steered towards docx/pptx/xlsx/md/html instead.
 */
export const rehydrateResourceBlob = async (
  blob: Blob,
  mapping: PseudonymMapping,
  type: string,
  mimeType: string,
): Promise<Blob> => {
  if (type === 'docx' || type === 'pptx' || type === 'xlsx') {
    return rehydrateOfficeDocument(blob, mapping, mimeType);
  }
  if (type === 'md' || type === 'txt' || type === 'csv' || type === 'html') {
    return rehydrateTextBlob(blob, mapping, mimeType);
  }
  return blob;
};
