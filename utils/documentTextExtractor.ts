// Local PDF text extraction (browser side) — extracts the text layer with pdfjs
// so the raw file never leaves the app. Scanned/imageonly PDFs return
// hasTextLayer=false so the caller can fall back to the consent gate.

import * as pdfjsLib from 'pdfjs-dist';
// Bundled worker (no external CDN) — Vite resolves `?url` to an emitted asset URL.
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc as string;

export interface ExtractedDocument {
    text: string;
    rows: string[][];
    charCount: number;
    pageCount: number;
    hasTextLayer: boolean;
}

interface RowItem { x: number; str: string }

export function clusterItemsToRows(items: { str: string; x: number; y: number }[]): { text: string; rows: string[][] } {
    const rows: string[][] = [];
    let text = '';
    const lineMap = new Map<number, RowItem[]>();
    for (const it of items) {
        if (!it || typeof it.str !== 'string') continue;
        const key = Math.round(it.y / 2);
        if (!lineMap.has(key)) lineMap.set(key, []);
        lineMap.get(key)!.push({ x: it.x, str: it.str });
    }
    const keys = [...lineMap.keys()].sort((a, b) => b - a);
    for (const k of keys) {
        const lineItems = lineMap.get(k)!.sort((a, b) => a.x - b.x);
        const cells = lineItems.map((i) => i.str.trim()).filter(Boolean);
        const lineText = lineItems.map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim();
        if (lineText) {
            text += lineText + '\n';
            rows.push(cells);
        }
    }
    return { text, rows };
}

export function assessTextLayer(charCount: number, pageCount: number): boolean {
    return pageCount > 0 && charCount / pageCount >= 20;
}

export async function extractPdfText(data: ArrayBuffer | Uint8Array): Promise<ExtractedDocument> {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
    let text = '';
    const rows: string[][] = [];
    for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        const items = content.items
            .filter((i: any) => typeof i.str === 'string')
            .map((i: any) => ({ str: i.str, x: i.transform[4], y: i.transform[5] }));
        const clustered = clusterItemsToRows(items);
        text += clustered.text + '\n';
        for (const r of clustered.rows) rows.push(r);
    }
    const charCount = text.replace(/\s/g, '').length;
    const pageCount = pdf.numPages;
    return { text, rows, charCount, pageCount, hasTextLayer: assessTextLayer(charCount, pageCount) };
}

export async function extractFileText(file: File): Promise<ExtractedDocument> {
    const buf = await file.arrayBuffer();
    return extractPdfText(buf);
}
