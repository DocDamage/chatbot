import { Diagnostic } from '../types';

export class DiagnosticParser {
  parse(tool: string, output: string): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    for (const raw of output.split(/\r?\n/).map(line => line.trim()).filter(Boolean)) {
      const parsed = this.parseLine(tool, raw);
      if (parsed) diagnostics.push(parsed);
    }
    return diagnostics;
  }

  private parseLine(tool: string, raw: string): Diagnostic | undefined {
    let match = raw.match(/^(.*?)(?::|\()([0-9]+)(?::|,)([0-9]+)?(?:\)|:)?\s*-?\s*(?:(error|warning|warn)\b[: ]*)?(.*)$/i);
    if (match && this.looksLikePath(match[1])) return { tool, file: match[1], line: Number(match[2]), column: match[3] ? Number(match[3]) : undefined, severity: this.severity(match[4], raw), message: (match[5] || raw).trim(), code: this.code(raw), raw };
    match = raw.match(/^error\[([^\]]+)\]:\s*(.*)$/i);
    if (match) return { tool, severity: 'error', code: match[1], message: match[2], raw };
    if (/\b(error|failed|failure)\b/i.test(raw)) return { tool, severity: 'error', message: raw, raw };
    if (/\bwarning\b/i.test(raw)) return { tool, severity: 'warning', message: raw, raw };
    return undefined;
  }

  private looksLikePath(value: string): boolean { return /[\\/]|\.[A-Za-z0-9]+$/.test(value.trim()); }
  private severity(label: string | undefined, raw: string): Diagnostic['severity'] { return /error|failed/i.test(label || raw) ? 'error' : /warn/i.test(label || raw) ? 'warning' : 'info'; }
  private code(raw: string): string | undefined { return raw.match(/\b([A-Z]{2,}[0-9A-Z-]+|E[0-9]{2,}|TS[0-9]{3,})\b/)?.[1]; }
}
