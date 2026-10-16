type PdfLine = { text: string; bold?: boolean };

function pdfText(value: unknown) {
  return String(value ?? '')
    .replace(/[^\x20-\x7E]/g, '?')
    .replace(/[\\()]/g, '\\$&');
}

function wrap(value: unknown, width = 92): string[] {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return [''];
  const lines: string[] = [];
  for (let i = 0; i < text.length; i += width) lines.push(text.slice(i, i + width));
  return lines;
}

/** Small dependency-free PDF writer for the printable package manifest. */
export function buildPackagePdf(lines: PdfLine[]): Buffer {
  const content = [
    'BT',
    '/F1 10 Tf',
    '48 760 Td',
    ...lines.flatMap((line) => [
      ...(line.bold ? ['/F2 10 Tf'] : ['/F1 10 Tf']),
      `(${pdfText(line.text)}) Tj`,
      '0 -14 Td',
    ]),
    'ET',
  ].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i += 1) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

export function packagePdfLines(data: {
  candidateName: string; jobTitle: string; decision: string | null; decisionAt: Date | null;
  evidence: { requirement: string; score: number | null; note: string; roundName: string | null; sourceRefs: { quote: string }[] }[];
  hrConfirmedBy: string | null; hrConfirmedAt: Date | null; hmConfirmedBy: string | null; hmConfirmedAt: Date | null;
}) {
  const lines: PdfLine[] = [
    { text: 'Hiring Evaluation Package', bold: true },
    { text: `Candidate: ${data.candidateName}` },
    { text: `Role: ${data.jobTitle}` },
    { text: `Decision: ${data.decision ?? 'Unconfirmed'}` },
    { text: `Decision time: ${data.decisionAt?.toISOString() ?? 'Not recorded'}` },
    { text: '' },
    { text: 'Rubric and evidence', bold: true },
  ];
  for (const item of data.evidence) {
    lines.push({ text: `${item.requirement} | score: ${item.score == null ? 'Unknown' : `${item.score}/5`} | round: ${item.roundName ?? 'None'}` });
    for (const line of wrap(item.note)) lines.push({ text: `Reason: ${line}` });
    for (const ref of item.sourceRefs) for (const line of wrap(ref.quote, 84)) lines.push({ text: `Evidence: ${line}` });
  }
  lines.push({ text: '' }, { text: 'Human review', bold: true });
  lines.push({ text: `HR: ${data.hrConfirmedBy ?? 'Not confirmed'} | ${data.hrConfirmedAt?.toISOString() ?? 'No confirmation time'}` });
  lines.push({ text: `Hiring Manager: ${data.hmConfirmedBy ?? 'Not confirmed'} | ${data.hmConfirmedAt?.toISOString() ?? 'No confirmation time'}` });
  return lines;
}
