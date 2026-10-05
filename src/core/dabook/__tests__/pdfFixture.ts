/**
 * Builds a tiny, valid, text-layer PDF without any dependency, for tests that need a real file.
 * Fonts: F1 = Helvetica-Bold (detected as bold -> heading), F2 = Times-Roman (body).
 */

export interface PdfLine {
  text: string;
  font: 'F1' | 'F2';
  size: number;
  x: number;
  y: number;
}

function escapePdfText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

export function buildPdf(pages: PdfLine[][]): Buffer {
  const objects: string[] = [];
  const add = (body: string): number => {
    objects.push(body);
    return objects.length;
  };

  const catalog = add('<< /Type /Catalog /Pages 2 0 R >>'); // object 1 (pages object is 2)
  const pagesObj = add('PLACEHOLDER'); // object 2
  const fontBold = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  const fontBody = add('<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>');
  void catalog;

  const pageIds: number[] = [];
  for (const lines of pages) {
    const stream = lines
      .map(line => `BT /${line.font} ${line.size} Tf ${line.x} ${line.y} Td (${escapePdfText(line.text)}) Tj ET`)
      .join('\n');
    const content = add(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
    const page = add(
      `<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 612 792] ` +
      `/Resources << /Font << /F1 ${fontBold} 0 R /F2 ${fontBody} 0 R >> >> /Contents ${content} 0 R >>`
    );
    pageIds.push(page);
  }
  objects[pagesObj - 1] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

  let output = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(output));
    output += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(output);
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) output += `${String(offset).padStart(10, '0')} 00000 n \n`;
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(output, 'latin1');
}

const BODY = [
  'The recovery tool scans the partition table and rebuilds the boot sector from a backup copy.',
  'Always work on a disk image rather than the failing drive to avoid overwriting recoverable data.',
  'A damaged file system header can usually be repaired when the backup superblock is intact.',
  'Select the partition type that matches the original layout before writing any changes to disk.'
];

/** Two pages: a bold chapter heading with body text, then a bold section heading with body text. */
export function sampleHandbookPdf(): Buffer {
  const body = (startY: number, offset: number): PdfLine[] =>
    BODY.map((text, i) => ({ text: BODY[(i + offset) % BODY.length] + ' ' + text, font: 'F2' as const, size: 11, x: 72, y: startY - i * 16 }));
  return buildPdf([
    [{ text: 'Partition Recovery Basics', font: 'F1', size: 18, x: 72, y: 700 }, ...body(660, 0)],
    [{ text: 'Using the Command Line', font: 'F1', size: 14, x: 72, y: 700 }, ...body(665, 1)]
  ]);
}
