import { Buffer } from 'node:buffer';
import { createRequire } from 'node:module';
import { dirname, extname, join } from 'node:path';
import { cwd } from 'node:process';
import { BadRequestException } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';
import * as mammoth from 'mammoth';

// pdfjs-dist needs its cmaps/standard_fonts to resolve non-embedded CJK fonts (common in Chinese
// PDFs); without them glyphs are silently dropped. Same setup as hireos-interview's MaterialsService.
const PDFJS_DIR = dirname(createRequire(join(cwd(), 'package.json')).resolve('pdfjs-dist/package.json'));
const PDF_CMAP_URL = join(PDFJS_DIR, 'cmaps') + '/';
const PDF_STANDARD_FONT_DATA_URL = join(PDFJS_DIR, 'standard_fonts') + '/';

const MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain',
};

export type UploadedFile = { originalname: string; buffer: Buffer; size: number };

/** Checks an upload is a real PDF/DOCX/TXT and returns its UTF-8 name and mime type. */
export function checkUpload(file?: UploadedFile) {
  if (!file || !file.size) throw new BadRequestException({ code: 'EMPTY_FILE' });
  // multer decodes the multipart filename as latin1; re-decode so Chinese file names survive.
  const name = Buffer.from(file.originalname, 'latin1').toString('utf8');
  const ext = extname(name).toLowerCase();
  const mime = MIME[ext];
  if (!mime || (ext === '.pdf' && file.buffer.subarray(0, 5).toString() !== '%PDF-') ||
    (ext === '.docx' && file.buffer.subarray(0, 2).toString() !== 'PK')) {
    throw new BadRequestException({ code: 'UNSUPPORTED_FILE_TYPE' });
  }
  return { name, mime };
}

/** Plain text of a PDF/DOCX/TXT, or an error code the UI knows how to explain. */
export async function extractText(name: string, buffer: Buffer): Promise<{ text: string; errorCode: string | null }> {
  const ext = extname(name).toLowerCase();
  if (!MIME[ext]) return { text: '', errorCode: 'UNSUPPORTED_FILE_TYPE' };
  try {
    let text: string;
    if (ext === '.pdf') {
      const parser = new PDFParse({ data: buffer, cMapUrl: PDF_CMAP_URL, cMapPacked: true, standardFontDataUrl: PDF_STANDARD_FONT_DATA_URL });
      try { text = (await parser.getText()).pages.map((p) => p.text).join('\n\n'); } finally { await parser.destroy(); }
    } else {
      text = ext === '.docx' ? (await mammoth.extractRawText({ buffer })).value : new TextDecoder('utf-8', { fatal: true }).decode(buffer);
      if (text.includes('\0')) throw new Error('binary');
    }
    text = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).join('\n\n');
    if (!text) return { text: '', errorCode: ext === '.pdf' ? 'OCR_REQUIRED' : 'NO_EXTRACTABLE_TEXT' };
    if (text.length > 150000) return { text: '', errorCode: 'DOCUMENT_TOO_LONG' };
    return { text, errorCode: null };
  } catch {
    return { text: '', errorCode: 'FILE_UNREADABLE' };
  }
}
