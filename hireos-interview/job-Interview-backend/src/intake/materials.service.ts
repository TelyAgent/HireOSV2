import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { dirname, extname, join } from 'node:path';
import { PDFParse } from 'pdf-parse';
import * as mammoth from 'mammoth';
import { PrismaService } from '../persistence/prisma.service';
import { CoreRecordClient } from '../core-record/core-record.client';
import type { Identity } from './workspace.guard';
import type { Segment } from './contracts';

// pdfjs-dist (pdf-parse's engine) needs its own cmaps/ resource files to resolve a PDF's
// predefined, non-embedded CJK CID fonts (a common pattern — ReportLab-generated Chinese
// PDFs included — where the font is referenced by name like "STSong-Light" with encoding
// "UniGB-UCS2-H" but no font program is embedded). Without cMapUrl configured, pdf.js
// silently drops every glyph it can't map and returns only whatever survives from simple
// Latin-encoded fonts (e.g. bullet markers) — not an error, just wrong, so it's easy to
// miss. require.resolve locates the installed package regardless of CWD.
const PDFJS_DIR = dirname(require.resolve('pdfjs-dist/package.json'));
const PDF_CMAP_URL = join(PDFJS_DIR, 'cmaps') + '/';
const PDF_STANDARD_FONT_DATA_URL = join(PDFJS_DIR, 'standard_fonts') + '/';

@Injectable()
export class MaterialsService {
  constructor(
    private readonly db: PrismaService,
    private readonly coreRecord: CoreRecordClient,
  ) {}

  /**
   * The raw file goes to Core Record first (see CoreRecordClient.uploadMaterial) --
   * that's the one shared master, and it hash-dedupes across every subsystem, not just
   * this one. Interview keeps a local Material row too, but only for its own extraction
   * output (text/segments); it no longer stores the bytes itself (see Material's schema
   * comment for why that local disk copy was dead weight to begin with).
   */
  async upload(identity: Identity, file?: Express.Multer.File) {
    if (!file || !file.size) throw new BadRequestException({ code: 'EMPTY_FILE' });
    // multer/busboy decode the multipart filename header as latin1; re-decode as UTF-8 so
    // non-ASCII names (e.g. Chinese résumé filenames) survive intact. ASCII names are unaffected.
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const ext = extname(originalName).toLowerCase();
    const mime = { '.pdf': 'application/pdf', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.txt': 'text/plain' }[ext];
    if (!mime || (ext === '.pdf' && file.buffer.subarray(0, 5).toString() !== '%PDF-') ||
      (ext === '.docx' && file.buffer.subarray(0, 2).toString() !== 'PK')) {
      throw new BadRequestException({ code: 'UNSUPPORTED_FILE_TYPE' });
    }
    // Register with Core Record first -- its hash dedup covers every subsystem, so if
    // this exact file already has a local row (however it got here), reuse it and skip
    // re-parsing entirely.
    const coreMaterial = await this.coreRecord.uploadMaterial(identity, { buffer: file.buffer, originalname: originalName, mimetype: mime });
    const existing = await this.db.material.findUnique({ where: { coreMaterialId: coreMaterial.id } });
    if (existing) return existing;

    const { segments, errorCode } = await this.extractText(ext, file.buffer);
    return this.db.material.create({
      data: {
        workspaceId: identity.workspaceId, coreMaterialId: coreMaterial.id,
        name: originalName.slice(0, 255), mime, size: file.size, hash: coreMaterial.hash,
        text: segments.map((s) => s.text).join('\n\n'), segments,
        readStatus: errorCode ? 'failed' : 'available', errorCode,
      },
    });
  }

  /**
   * Registers a résumé Core Record already holds (referenced by coreMaterialId, e.g. from
   * ScreeningHandoffService) as a local Material -- same extraction pipeline as upload(),
   * just sourced from a download instead of a fresh multipart file. Idempotent: a retried
   * hand-off for the same material reuses the row instead of re-downloading/re-parsing.
   */
  async fromCoreMaterial(identity: Identity, coreMaterialId: string) {
    const existing = await this.db.material.findUnique({ where: { coreMaterialId } });
    if (existing) return existing;

    const meta = await this.coreRecord.getMaterial(identity, coreMaterialId);
    const buffer = await this.coreRecord.downloadMaterialContent(identity, coreMaterialId);
    const ext = extname(meta.name).toLowerCase();
    // Unlike upload(), an unsupported type here degrades to a soft errorCode rather than
    // throwing -- this runs off Screening's outbox dispatcher, not a live user request, so
    // there's no one to show a 400 to and retrying forever on a permanently-bad file would
    // just wedge the dispatcher.
    const { segments, errorCode } = ext === '.pdf' || ext === '.docx' || ext === '.txt'
      ? await this.extractText(ext, buffer)
      : { segments: [] as Segment[], errorCode: 'UNSUPPORTED_FILE_TYPE' };

    return this.db.material.create({
      data: {
        workspaceId: identity.workspaceId, coreMaterialId,
        name: meta.name.slice(0, 255), mime: meta.mime, size: meta.size, hash: meta.hash,
        text: segments.map((s) => s.text).join('\n\n'), segments,
        readStatus: errorCode ? 'failed' : 'available', errorCode,
      },
    });
  }

  async get(workspaceId: string, id: string) {
    const material = await this.db.material.findFirst({ where: { id, workspaceId } });
    if (!material) throw new NotFoundException({ code: 'NOT_FOUND' });
    return material;
  }

  private async extractText(ext: string, buffer: Buffer): Promise<{ segments: Segment[]; errorCode: string | null }> {
    let segments: Segment[] = [];
    let errorCode: string | null = null;
    try {
      if (ext === '.pdf') {
        const parser = new PDFParse({ data: buffer, cMapUrl: PDF_CMAP_URL, cMapPacked: true, standardFontDataUrl: PDF_STANDARD_FONT_DATA_URL });
        try {
          const result = await parser.getText();
          segments = result.pages.flatMap((p) => splitText(p.text, p.num));
        } finally { await parser.destroy(); }
      } else {
        const text = ext === '.docx' ? (await mammoth.extractRawText({ buffer })).value
          : new TextDecoder('utf-8', { fatal: true }).decode(buffer);
        if (text.includes('\0')) throw new Error('binary');
        segments = splitText(text);
      }
      segments = segments.map((s, i) => ({ ...s, id: `s${i + 1}` }));
      if (!segments.length) errorCode = ext === '.pdf' ? 'OCR_REQUIRED' : 'NO_EXTRACTABLE_TEXT';
      if (segments.reduce((n, s) => n + s.text.length, 0) > 150000) { segments = []; errorCode = 'DOCUMENT_TOO_LONG'; }
    } catch { errorCode = 'FILE_UNREADABLE'; }
    return { segments, errorCode };
  }
}

export function splitText(text: string, page?: number): Segment[] {
  return text.split(/\n\s*\n/).flatMap((paragraph) => {
    const result: Segment[] = [];
    const trimmed = paragraph.trim();
    for (let start = 0; start < trimmed.length; start += 4000) {
      result.push({ id: '', text: trimmed.slice(start, start + 4000), ...(page ? { page } : {}) });
    }
    return result;
  }).map((s, i) => ({ ...s, id: `s${i + 1}` }));
}
