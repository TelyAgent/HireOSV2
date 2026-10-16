type PdfLine = { text: string; bold?: boolean };

function pdfText(value: unknown) {
  return Buffer.from(String(value ?? ''), 'utf16le').swap16().toString('hex');
}

function wrap(value: unknown, width = 50): string[] {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return [''];
  const lines: string[] = [];
  let line = '';
  let lineWidth = 0;
  for (const char of text) {
    const charWidth = char.charCodeAt(0) < 128 ? 1 : 2;
    if (line && lineWidth + charWidth > width) { lines.push(line); line = ''; lineWidth = 0; }
    line += char; lineWidth += charWidth;
  }
  if (line) lines.push(line);
  return lines;
}

function pageContent(lines: PdfLine[]) {
  return ['BT', '/F1 10 Tf', '48 760 Td', ...lines.flatMap((line) => [`<${pdfText(line.text)}> Tj`, '0 -14 Td']), 'ET'].join('\n');
}

/** Dependency-free PDF writer using the standard Simplified Chinese CID font. */
export function buildPackagePdf(lines: PdfLine[]): Buffer {
  const pages: string[] = [];
  for (let i = 0; i < lines.length; i += 48) pages.push(pageContent(lines.slice(i, i + 48)));
  if (!pages.length) pages.push(pageContent([{ text: 'Hiring Evaluation Package' }]));
  const pageObjects = pages.map((_, i) => `${3 + i} 0 R`).join(' ');
  const firstContent = 3 + pages.length;
  const fontObject = firstContent + pages.length;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pageObjects}] /Count ${pages.length} >>`,
    ...pages.map((_, i) => `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontObject} 0 R >> >> /Contents ${firstContent + i} 0 R >>`),
    ...pages.map((content) => `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`),
    `<< /Type /Font /Subtype /Type0 /BaseFont /STSong-Light /Encoding /UniGB-UCS2-H /DescendantFonts [${fontObject + 1} 0 R] >>`,
    '<< /Type /Font /Subtype /CIDFontType0 /BaseFont /STSong-Light /CIDSystemInfo << /Registry (Adobe) /Ordering (GB1) /Supplement 4 >> >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let i = 0; i < objects.length; i += 1) { offsets.push(Buffer.byteLength(pdf, 'latin1')); pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`; }
  const xref = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i += 1) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

export function packagePdfLines(data: {
  candidateName: string; jobTitle: string; decision: string | null; decisionAt: Date | null;
  needsReview?: boolean; reviewReason?: string | null; invalidatedAt?: Date | null;
  evidence: { requirement: string; expectedEvidence?: string; levelAnchors?: unknown; score: number | null; note: string; roundId?: string | null; roundName: string | null; sourceRefs: { segmentId: string; quote: string }[] }[];
  hrConfirmedBy: string | null; hrConfirmedAt: Date | null; hmConfirmedBy: string | null; hmConfirmedAt: Date | null;
}) {
  const lines: PdfLine[] = [
    { text: 'Hiring Evaluation Package', bold: true }, { text: `Candidate: ${data.candidateName}` },
    { text: `Role: ${data.jobTitle}` }, { text: `Decision: ${data.decision ?? 'Unconfirmed'}` },
    { text: `Decision time: ${data.decisionAt?.toISOString() ?? 'Not recorded'}` }, { text: '' },
    { text: 'Rubric and interview evidence', bold: true },
  ];
  if (data.needsReview) {
    lines.splice(1, 0, { text: `REVIEW REQUIRED: ${data.reviewReason ?? 'Upstream data changed'}${data.invalidatedAt ? ` (${data.invalidatedAt.toISOString()})` : ''}`, bold: true });
  }
  for (const item of data.evidence) {
    for (const line of wrap(`${item.requirement} | score: ${item.score == null ? 'Unknown' : `${item.score}/5`} | round: ${item.roundName ?? 'None'}`)) lines.push({ text: line });
    if (item.expectedEvidence) for (const line of wrap(`Rubric evidence standard: ${item.expectedEvidence}`)) lines.push({ text: line });
    if (item.levelAnchors) for (const line of wrap(`Rubric level anchors: ${JSON.stringify(item.levelAnchors)}`)) lines.push({ text: line });
    for (const line of wrap(`Reason: ${item.note}`)) lines.push({ text: line });
    for (const ref of item.sourceRefs) {
      for (const line of wrap(`Evidence ${ref.segmentId}: ${ref.quote}`)) lines.push({ text: line });
      if (item.roundId) for (const line of wrap(`Evidence link: /interview/api/rounds/${item.roundId}/transcript#${ref.segmentId}`)) lines.push({ text: line });
    }
  }
  lines.push({ text: '' }, { text: 'Human review', bold: true });
  for (const line of wrap(`HR: ${data.hrConfirmedBy ?? 'Not confirmed'} | ${data.hrConfirmedAt?.toISOString() ?? 'No confirmation time'}`)) lines.push({ text: line });
  for (const line of wrap(`Hiring Manager: ${data.hmConfirmedBy ?? 'Not confirmed'} | ${data.hmConfirmedAt?.toISOString() ?? 'No confirmation time'}`)) lines.push({ text: line });
  return lines;
}
