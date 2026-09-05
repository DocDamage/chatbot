/**
 * Code Outline & Symbol Body Compressor (PX-03 / PX03-T03)
 * Extracts class, interface, type, function signatures, and exports
 * with exact source anchors (`file:line-range`) while collapsing verbose function bodies.
 */

export interface CodeCompressionResult {
  compressedCode: string;
  symbolsExtracted: string[];
  omittedLinesCount: number;
  anchors: Array<{ symbol: string; startLine: number; endLine: number }>;
}

export class CodeOutlineCompressor {
  public static compress(code: string, filePath?: string): CodeCompressionResult {
    const lines = code.split('\n');
    const symbolsExtracted: string[] = [];
    const anchors: Array<{ symbol: string; startLine: number; endLine: number }> = [];
    const outputLines: string[] = [];
    let omittedLinesCount = 0;

    let inFunctionBody = false;
    let braceDepth = 0;
    let currentSymbol = '';
    let symbolStartLine = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Check for declaration patterns
      const isDecl = /^(export\s+)?(public|private|protected|static|async|\s)*(function|class|interface|type|const|let|enum)\s+([a-zA-Z0-9_$]+)/.test(trimmed) ||
                     /^(public|private|protected|static|async|\s)*\b([a-zA-Z0-9_$]+)\s*\([^)]*\)\s*(:\s*[^{]+)?\s*\{?$/.test(trimmed);

      if (!inFunctionBody && isDecl) {
        const match = trimmed.match(/(?:function|class|interface|type|enum|const|let)\s+([a-zA-Z0-9_$]+)/) ||
                      trimmed.match(/(?:public|private|protected|static|async|\s)*\b([a-zA-Z0-9_$]+)\s*\(/);
        currentSymbol = match ? match[match.length - 1] : 'anonymous';
        symbolsExtracted.push(currentSymbol);
        symbolStartLine = i + 1;

        if (line.includes('{')) {
          braceDepth = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
          const isStructural = trimmed.includes('class ') || trimmed.includes('interface ') || trimmed.includes('type ') || trimmed.includes('enum ');
          if (braceDepth > 0 && !isStructural) {
            inFunctionBody = true;
            outputLines.push(line.substring(0, line.indexOf('{') + 1));
            continue;
          }
        }
        outputLines.push(line);
        continue;
      }

      if (inFunctionBody) {
        braceDepth += (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
        if (braceDepth <= 0) {
          inFunctionBody = false;
          anchors.push({
            symbol: currentSymbol,
            startLine: symbolStartLine,
            endLine: i + 1
          });
          outputLines.push(`    /* ... [body omitted from lines ${symbolStartLine}-${i + 1}] ... */`);
          outputLines.push(line);
        } else {
          omittedLinesCount++;
        }
        continue;
      }

      // Preserve imports, comments, exports, and top-level statements
      outputLines.push(line);
    }

    return {
      compressedCode: outputLines.join('\n'),
      symbolsExtracted,
      omittedLinesCount,
      anchors
    };
  }
}
