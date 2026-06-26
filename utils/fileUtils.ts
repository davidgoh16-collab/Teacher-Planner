import mammoth from 'mammoth';

// `xlsx` and `jszip` are heavy and only needed when a spreadsheet/presentation is uploaded,
// so they are loaded on demand (dynamic import) rather than bloating the initial bundle.

/**
 * The shape every uploaded file is normalised to before it reaches the AI.
 *
 * - `isBase64: true`  → `text` is base64-encoded binary sent to the model as inline data
 *   (used for PDFs and images, which Gemini reads natively).
 * - `isBase64: false` → `text` is plain text extracted client-side (docx, spreadsheets,
 *   csv, pptx, txt…) and appended to the prompt as "Attached Document Content".
 */
export interface ReadFileResult {
  text: string;
  mimeType: string;
  isBase64: boolean;
  /** Original filename, so the AI knows what it's looking at (e.g. "timetable.xlsx"). */
  fileName?: string;
}

/** Lower-cased file extension without the dot, or '' if none. */
const getExtension = (name: string): string => {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
};

/** Decode the handful of XML entities that appear in Office Open XML text runs. */
const decodeXmlEntities = (s: string): string =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

/** Read a File as a base64 string (without the data-URL prefix). */
const readAsBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      resolve(result.split(',')[1] ?? '');
    };
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });

/** Extract every spreadsheet tab as CSV text, prefixed with its sheet name. */
const extractSpreadsheet = async (file: File): Promise<string> => {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheets = workbook.SheetNames.map((name) => {
    const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[name], { blankrows: false });
    return `### Sheet: ${name}\n${csv.trim()}`;
  }).filter((s) => s.trim().length > 0);
  if (sheets.length === 0) return '(The spreadsheet appears to be empty.)';
  return sheets.join('\n\n');
};

/** Pull the visible text (and speaker notes) out of a .pptx deck, slide by slide. */
const extractPptx = async (file: File): Promise<string> => {
  const { default: JSZip } = await import('jszip');
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);

  const slideNumber = (path: string): number => {
    const m = path.match(/(\d+)\.xml$/);
    return m ? parseInt(m[1], 10) : 0;
  };

  // Concatenate <a:t> text runs, treating each paragraph (</a:p>) as a line break.
  const xmlToText = (xml: string): string =>
    xml
      .replace(/<\/a:p>/g, '\n')
      .replace(/<a:t>([\s\S]*?)<\/a:t>/g, (_, t) => decodeXmlEntities(t) + ' ')
      .replace(/<[^>]+>/g, '')
      .split('\n')
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join('\n');

  const collect = (prefix: string): string[] =>
    Object.keys(zip.files)
      .filter((p) => p.startsWith(prefix) && /\d+\.xml$/.test(p))
      .sort((a, b) => slideNumber(a) - slideNumber(b));

  const slidePaths = collect('ppt/slides/slide');
  const notePaths = collect('ppt/notesSlides/notesSlide');

  const sections: string[] = [];
  for (let i = 0; i < slidePaths.length; i++) {
    const body = xmlToText(await zip.files[slidePaths[i]].async('string'));
    const notePath = notePaths.find((p) => slideNumber(p) === slideNumber(slidePaths[i]));
    const notes = notePath ? xmlToText(await zip.files[notePath].async('string')) : '';
    let section = `### Slide ${i + 1}\n${body || '(no text)'}`;
    if (notes) section += `\n[Speaker notes] ${notes}`;
    sections.push(section);
  }

  if (sections.length === 0) return '(No slides with text were found in this presentation.)';
  return sections.join('\n\n');
};

/**
 * Read an uploaded file into a form the AI assistant / agent can consume.
 *
 * Supported: PDF & images (sent natively), plain text/markdown/csv/tsv/json, Word (.docx),
 * Excel/spreadsheets (.xlsx/.xls/.xlsm/.xlsb/.ods/.csv) and PowerPoint (.pptx).
 * Legacy binary .doc and .ppt are rejected with a clear hint to convert to the modern format.
 */
export const readFileContent = async (file: File): Promise<ReadFileResult> => {
  const fileType = file.type;
  const ext = getExtension(file.name);

  // 1. PDFs and images — sent to the model as native inline data (it reads them directly).
  if (
    fileType === 'application/pdf' ||
    ext === 'pdf' ||
    fileType === 'image/jpeg' ||
    fileType === 'image/png' ||
    fileType === 'image/webp' ||
    (fileType.startsWith('image/') && ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext))
  ) {
    const mimeType = fileType || (ext === 'pdf' ? 'application/pdf' : 'image/png');
    const base64Data = await readAsBase64(file);
    return { text: base64Data, mimeType, isBase64: true, fileName: file.name };
  }

  // 2. Word documents — extract raw text with mammoth.
  if (
    fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ext === 'docx'
  ) {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return { text: result.value, mimeType: 'text/plain', isBase64: false, fileName: file.name };
  }

  // 3. Spreadsheets — Excel and OpenDocument, every sheet flattened to CSV text.
  if (['xlsx', 'xls', 'xlsm', 'xlsb', 'ods'].includes(ext)) {
    const text = await extractSpreadsheet(file);
    return { text, mimeType: 'text/plain', isBase64: false, fileName: file.name };
  }

  // 4. CSV / TSV — plain delimited text (handled before the generic text branch so the
  //    extension wins even when the browser reports an odd MIME type).
  if (ext === 'csv' || ext === 'tsv' || fileType === 'text/csv') {
    const text = await file.text();
    return { text, mimeType: 'text/plain', isBase64: false, fileName: file.name };
  }

  // 5. PowerPoint — extract slide text and speaker notes from the .pptx package.
  if (ext === 'pptx') {
    const text = await extractPptx(file);
    return { text, mimeType: 'text/plain', isBase64: false, fileName: file.name };
  }

  // 6. Plain-text-ish formats (txt, markdown, json, xml, code, etc.).
  if (
    fileType.startsWith('text/') ||
    fileType === 'application/json' ||
    ['txt', 'md', 'markdown', 'json', 'xml', 'rtf', 'log', 'yml', 'yaml'].includes(ext)
  ) {
    const text = await file.text();
    return { text, mimeType: 'text/plain', isBase64: false, fileName: file.name };
  }

  // 7. Legacy binary Office formats we can't parse in the browser — give an actionable error.
  if (ext === 'doc' || ext === 'ppt') {
    throw new Error(
      `Legacy "${ext}" files aren't supported. Please re-save it as .${ext}x (e.g. in Word/PowerPoint use "Save As") and upload that.`
    );
  }

  throw new Error(`Unsupported file type: ${fileType || ext || 'unknown'}`);
};
