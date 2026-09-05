/**
 * Tabular Data & CSV/Markdown Table Compressor (PX-03 / PX03-T03)
 * Retains table header, schema columns, statistical row counts,
 * and representative head/tail sample rows while pruning huge repetitive rows.
 */

export class TableSampleCompressor {
  public static compress(tableText: string, sampleRows: number = 5): { compressed: string; omittedRowsCount: number; totalRowsCount: number } {
    const lines = tableText.split('\n').filter(l => l.trim().length > 0);
    if (lines.length <= sampleRows + 2) {
      return { compressed: tableText, omittedRowsCount: 0, totalRowsCount: lines.length };
    }

    const isMarkdownTable = lines[0].includes('|');
    const isCsv = lines[0].includes(',');

    if (!isMarkdownTable && !isCsv) {
      return { compressed: tableText, omittedRowsCount: 0, totalRowsCount: lines.length };
    }

    const headerLines = isMarkdownTable && lines.length > 1 && lines[1].includes('---') ? 2 : 1;
    const headers = lines.slice(0, headerLines);
    const dataRows = lines.slice(headerLines);

    if (dataRows.length <= sampleRows) {
      return { compressed: tableText, omittedRowsCount: 0, totalRowsCount: lines.length };
    }

    const headCount = Math.ceil(sampleRows / 2);
    const tailCount = Math.floor(sampleRows / 2);

    const headRows = dataRows.slice(0, headCount);
    const tailRows = dataRows.slice(-tailCount);
    const omittedCount = dataRows.length - (headCount + tailCount);

    const placeholder = isMarkdownTable
      ? `| ... [${omittedCount} rows omitted (total: ${dataRows.length} rows)] |`
      : `# ... [${omittedCount} rows omitted (total: ${dataRows.length} rows)] ...`;

    const compressedLines = [
      ...headers,
      ...headRows,
      placeholder,
      ...tailRows
    ];

    return {
      compressed: compressedLines.join('\n'),
      omittedRowsCount: omittedCount,
      totalRowsCount: lines.length
    };
  }
}
