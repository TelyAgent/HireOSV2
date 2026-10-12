import { BadRequestException } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';
import { extractRawText } from 'mammoth';
import { dirname, join } from 'node:path';

const MAX_EXTRACTED_CHARS = 12_000;

// PDFs often use non-embedded CJK fonts (e.g. STSong-Light + UniGB-UCS2-H) that pdf.js can only decode with
// its CMap files; without them Chinese text comes back empty. Resolved from pdf-parse's own pdfjs-dist copy.
const PDFJS_DIR = dirname(require.resolve('pdfjs-dist/package.json', { paths: [dirname(require.resolve('pdf-parse'))] }));
const PDFJS_OPTIONS = {
  cMapUrl: join(PDFJS_DIR, 'cmaps') + '/',
  cMapPacked: true,
  standardFontDataUrl: join(PDFJS_DIR, 'standard_fonts') + '/',
};

/** Plain-text extraction only — no attempt to preserve layout/formatting, per the M4 plan's scope. */
export async function extractTextFromFile(buffer: Buffer, mimeType: string, filename: string): Promise<string> {
  const extension = filename.toLowerCase().split('.').pop() || '';
  if (mimeType === 'application/pdf' || extension === 'pdf') {
    const parser = new PDFParse({ data: buffer, ...PDFJS_OPTIONS });
    try {
      const result = await parser.getText();
      // pdf-parse adds "-- 1 of 4 --" page markers; a PDF with nothing else (a scan or images) has no text to read.
      if (result.text.replace(/--\s*\d+\s+of\s+\d+\s*--/g, '').trim().length < 20) {
        throw new BadRequestException({
          code: 'ATTACHMENT_NO_TEXT',
          message: '这个 PDF 里没有可读取的文字（可能是扫描件或图片），请上传 DOCX/TXT 文件，或直接粘贴 JD 文案。',
        });
      }
      return truncate(result.text);
    } finally {
      await parser.destroy();
    }
  }
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    || extension === 'docx'
  ) {
    const result = await extractRawText({ buffer });
    return truncate(result.value);
  }
  if (mimeType.startsWith('text/') || extension === 'txt') {
    return truncate(buffer.toString('utf-8'));
  }
  throw new BadRequestException({
    code: 'ATTACHMENT_TYPE_UNSUPPORTED',
    message: '仅支持上传 PDF、DOCX 或 TXT 文件。',
  });
}

function truncate(text: string): string {
  const trimmed = text.trim();
  return trimmed.length > MAX_EXTRACTED_CHARS ? trimmed.slice(0, MAX_EXTRACTED_CHARS) : trimmed;
}
