/**
 * Unified Diff & Patch Compressor (PX-03 / PX03-T03)
 * Reduces large diff outputs to changed files, headers, modified lines (+/-),
 * and minimal surrounding context lines.
 */

export class UnifiedDiffCompressor {
  public static compress(diffText: string, contextLines: number = 2): { compressed: string; changedFiles: string[]; omittedContextLines: number } {
    const lines = diffText.split('\n');
    const changedFiles: string[] = [];
    const output: string[] = [];
    let omittedContext = 0;

    let inHunk = false;
    let unchangedBuffer: string[] = [];

    for (const line of lines) {
      if (line.startsWith('diff --git') || line.startsWith('--- ') || line.startsWith('+++ ')) {
        if (unchangedBuffer.length > 0) {
          output.push(...unchangedBuffer.slice(0, contextLines));
          if (unchangedBuffer.length > contextLines * 2) {
            omittedContext += unchangedBuffer.length - contextLines * 2;
            output.push(`  ... [${unchangedBuffer.length - contextLines * 2} unchanged lines omitted] ...`);
          }
          if (unchangedBuffer.length > contextLines) {
            output.push(...unchangedBuffer.slice(-contextLines));
          }
          unchangedBuffer = [];
        }

        if (line.startsWith('+++ b/')) {
          changedFiles.push(line.replace('+++ b/', '').trim());
        }
        output.push(line);
        inHunk = false;
        continue;
      }

      if (line.startsWith('@@')) {
        output.push(line);
        inHunk = true;
        unchangedBuffer = [];
        continue;
      }

      if (inHunk) {
        if (line.startsWith('+') || line.startsWith('-')) {
          if (unchangedBuffer.length > 0) {
            if (unchangedBuffer.length <= contextLines * 2) {
              output.push(...unchangedBuffer);
            } else {
              output.push(...unchangedBuffer.slice(0, contextLines));
              omittedContext += unchangedBuffer.length - contextLines * 2;
              output.push(`  ... [${unchangedBuffer.length - contextLines * 2} unchanged lines omitted] ...`);
              output.push(...unchangedBuffer.slice(-contextLines));
            }
            unchangedBuffer = [];
          }
          output.push(line);
        } else {
          unchangedBuffer.push(line);
        }
      } else {
        output.push(line);
      }
    }

    if (unchangedBuffer.length > 0) {
      if (unchangedBuffer.length <= contextLines * 2) {
        output.push(...unchangedBuffer);
      } else {
        output.push(...unchangedBuffer.slice(0, contextLines));
        omittedContext += unchangedBuffer.length - contextLines * 2;
        output.push(`  ... [${unchangedBuffer.length - contextLines * 2} unchanged lines omitted] ...`);
      }
    }

    return {
      compressed: output.join('\n'),
      changedFiles: Array.from(new Set(changedFiles)),
      omittedContextLines: omittedContext
    };
  }
}
