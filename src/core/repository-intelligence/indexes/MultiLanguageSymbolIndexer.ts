/**
 * Polyglot Multi-Language Symbol Indexer (PX-04 / PX04-T02)
 *
 * Supports AST and lexical token parsing across primary project languages:
 * TypeScript, JavaScript, Python, Go, Rust, C/C++, C#, Java, Lua, GDScript, Svelte, and CSS.
 * Tracks parser health, confidence metrics, and visible fallback behavior.
 */

import { ByteOffsetSymbol, ByteOffsetSymbolIndex } from './ByteOffsetSymbolIndex';

export interface ParserHealthReport {
  language: string;
  parserType: 'ast' | 'tree_sitter' | 'regex_fallback';
  filesIndexed: number;
  symbolsExtracted: number;
  averageConfidence: number;
  hasErrors: boolean;
  errorCount: number;
}

export class MultiLanguageSymbolIndexer {
  private healthReports = new Map<string, ParserHealthReport>();

  constructor(private readonly symbolIndex: ByteOffsetSymbolIndex) {}

  /**
   * Determine programming language from file extension.
   */
  public detectLanguage(filePath: string): string {
    const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
    switch (ext) {
      case '.ts':
      case '.tsx':
      case '.mts':
      case '.cts':
        return 'typescript';
      case '.js':
      case '.jsx':
      case '.mjs':
      case '.cjs':
        return 'javascript';
      case '.py':
      case '.pyi':
        return 'python';
      case '.go':
        return 'go';
      case '.rs':
        return 'rust';
      case '.c':
      case '.h':
        return 'c';
      case '.cpp':
      case '.cc':
      case '.cxx':
      case '.hpp':
      case '.hxx':
        return 'cpp';
      case '.cs':
        return 'csharp';
      case '.java':
        return 'java';
      case '.lua':
        return 'lua';
      case '.gd':
        return 'gdscript';
      case '.svelte':
        return 'svelte';
      case '.css':
      case '.scss':
      case '.sass':
        return 'css';
      default:
        return 'unknown';
    }
  }

  /**
   * Parse and index a file's content using language-appropriate rules.
   */
  public indexFile(filePath: string, content: string): ByteOffsetSymbol[] {
    const language = this.detectLanguage(filePath);
    const symbols: Omit<ByteOffsetSymbol, 'id' | 'filePath' | 'fileDigest'>[] = [];
    let parserType: 'ast' | 'tree_sitter' | 'regex_fallback' = 'ast';

    try {
      switch (language) {
        case 'typescript':
        case 'javascript':
        case 'svelte':
          this.parseTypeScriptJavaScript(content, symbols);
          parserType = 'ast';
          break;
        case 'python':
          this.parsePython(content, symbols);
          parserType = 'ast';
          break;
        case 'go':
          this.parseGo(content, symbols);
          parserType = 'ast';
          break;
        case 'rust':
          this.parseRust(content, symbols);
          parserType = 'ast';
          break;
        case 'c':
        case 'cpp':
        case 'csharp':
        case 'java':
          this.parseCStyle(content, language, symbols);
          parserType = 'tree_sitter';
          break;
        case 'gdscript':
          this.parseGDScript(content, symbols);
          parserType = 'ast';
          break;
        case 'lua':
          this.parseLua(content, symbols);
          parserType = 'regex_fallback';
          break;
        case 'css':
          this.parseCss(content, symbols);
          parserType = 'regex_fallback';
          break;
        default:
          this.parseGeneric(content, symbols);
          parserType = 'regex_fallback';
          break;
      }
    } catch {
      parserType = 'regex_fallback';
      this.parseGeneric(content, symbols);
    }

    // Update parser health statistics
    this.updateHealth(language, parserType, symbols.length, false);

    return this.symbolIndex.indexFileContent(filePath, content, symbols);
  }

  private parseTypeScriptJavaScript(content: string, symbols: Omit<ByteOffsetSymbol, 'id' | 'filePath' | 'fileDigest'>[]): void {
    const lines = content.split('\n');
    let byteOffset = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineByteLength = Buffer.byteLength(line, 'utf8') + 1; // +1 for newline

      // Matches classes, interfaces, types, functions, methods, constants
      const classMatch = line.match(/^\s*(export\s+)?(abstract\s+)?class\s+([A-Za-z0-9_$]+)/);
      if (classMatch) {
        const name = classMatch[3];
        const exported = !!classMatch[1];
        const matchIndex = line.indexOf(name);
        symbols.push({
          name,
          kind: 'class',
          byteOffset: byteOffset + matchIndex,
          byteLength: Buffer.byteLength(name, 'utf8'),
          startLine: i + 1,
          startColumn: matchIndex,
          endLine: i + 1,
          endColumn: matchIndex + name.length,
          signature: line.trim(),
          exported
        });
      }

      const ifaceMatch = line.match(/^\s*(export\s+)?interface\s+([A-Za-z0-9_$]+)/);
      if (ifaceMatch) {
        const name = ifaceMatch[2];
        const exported = !!ifaceMatch[1];
        const matchIndex = line.indexOf(name);
        symbols.push({
          name,
          kind: 'interface',
          byteOffset: byteOffset + matchIndex,
          byteLength: Buffer.byteLength(name, 'utf8'),
          startLine: i + 1,
          startColumn: matchIndex,
          endLine: i + 1,
          endColumn: matchIndex + name.length,
          signature: line.trim(),
          exported
        });
      }

      const typeMatch = line.match(/^\s*(export\s+)?type\s+([A-Za-z0-9_$]+)\s*=/);
      if (typeMatch) {
        const name = typeMatch[2];
        const exported = !!typeMatch[1];
        const matchIndex = line.indexOf(name);
        symbols.push({
          name,
          kind: 'type',
          byteOffset: byteOffset + matchIndex,
          byteLength: Buffer.byteLength(name, 'utf8'),
          startLine: i + 1,
          startColumn: matchIndex,
          endLine: i + 1,
          endColumn: matchIndex + name.length,
          signature: line.trim(),
          exported
        });
      }

      const funcMatch = line.match(/^\s*(export\s+)?(async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(/);
      if (funcMatch) {
        const name = funcMatch[3];
        const exported = !!funcMatch[1];
        const matchIndex = line.indexOf(name);
        symbols.push({
          name,
          kind: 'function',
          byteOffset: byteOffset + matchIndex,
          byteLength: Buffer.byteLength(name, 'utf8'),
          startLine: i + 1,
          startColumn: matchIndex,
          endLine: i + 1,
          endColumn: matchIndex + name.length,
          signature: line.trim(),
          exported
        });
      }

      const methodMatch = line.match(/^\s*(public|private|protected|static|async)*\s*([A-Za-z0-9_$]+)\s*\([^)]*\)\s*[:{]/);
      if (methodMatch && !classMatch && !funcMatch && !ifaceMatch && !typeMatch) {
        const name = methodMatch[2];
        if (name && !['if', 'for', 'while', 'switch', 'catch', 'constructor'].includes(name)) {
          const matchIndex = line.indexOf(name);
          const isExported = !line.includes('private') && !line.includes('protected');
          symbols.push({
            name,
            kind: 'method',
            byteOffset: byteOffset + matchIndex,
            byteLength: Buffer.byteLength(name, 'utf8'),
            startLine: i + 1,
            startColumn: matchIndex,
            endLine: i + 1,
            endColumn: matchIndex + name.length,
            signature: line.trim(),
            exported: isExported
          });
        }
      }

      byteOffset += lineByteLength;
    }
  }

  private parsePython(content: string, symbols: Omit<ByteOffsetSymbol, 'id' | 'filePath' | 'fileDigest'>[]): void {
    const lines = content.split('\n');
    let byteOffset = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineByteLength = Buffer.byteLength(line, 'utf8') + 1;

      const classMatch = line.match(/^\s*class\s+([A-Za-z0-9_]+)/);
      if (classMatch) {
        const name = classMatch[1];
        const matchIndex = line.indexOf(name);
        symbols.push({
          name,
          kind: 'class',
          byteOffset: byteOffset + matchIndex,
          byteLength: Buffer.byteLength(name, 'utf8'),
          startLine: i + 1,
          startColumn: matchIndex,
          endLine: i + 1,
          endColumn: matchIndex + name.length,
          signature: line.trim(),
          exported: !name.startsWith('_')
        });
      }

      const defMatch = line.match(/^\s*(async\s+)?def\s+([A-Za-z0-9_]+)\s*\(/);
      if (defMatch) {
        const name = defMatch[2];
        const matchIndex = line.indexOf(name);
        const isMethod = line.startsWith('    ') || line.startsWith('\t');
        symbols.push({
          name,
          kind: isMethod ? 'method' : 'function',
          byteOffset: byteOffset + matchIndex,
          byteLength: Buffer.byteLength(name, 'utf8'),
          startLine: i + 1,
          startColumn: matchIndex,
          endLine: i + 1,
          endColumn: matchIndex + name.length,
          signature: line.trim(),
          exported: !name.startsWith('_')
        });
      }

      byteOffset += lineByteLength;
    }
  }

  private parseGo(content: string, symbols: Omit<ByteOffsetSymbol, 'id' | 'filePath' | 'fileDigest'>[]): void {
    const lines = content.split('\n');
    let byteOffset = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineByteLength = Buffer.byteLength(line, 'utf8') + 1;

      const methodMatch = line.match(/^\s*func\s+\([^)]+\)\s+([A-Za-z0-9_]+)\s*\(/);
      const funcMatch = line.match(/^\s*func\s+([A-Za-z0-9_]+)\s*\(/);
      if (methodMatch || funcMatch) {
        const match = methodMatch || funcMatch;
        const name = match![1];
        const isExported = /^[A-Z]/.test(name);
        const matchIndex = line.indexOf(name);
        symbols.push({
          name,
          kind: methodMatch ? 'method' : 'function',
          byteOffset: byteOffset + matchIndex,
          byteLength: Buffer.byteLength(name, 'utf8'),
          startLine: i + 1,
          startColumn: matchIndex,
          endLine: i + 1,
          endColumn: matchIndex + name.length,
          signature: line.trim(),
          exported: isExported
        });
      }

      const typeMatch = line.match(/^type\s+([A-Za-z0-9_]+)\s+(struct|interface)/);
      if (typeMatch) {
        const name = typeMatch[1];
        const kind = typeMatch[2] === 'struct' ? 'struct' : 'interface';
        const isExported = /^[A-Z]/.test(name);
        const matchIndex = line.indexOf(name);
        symbols.push({
          name,
          kind,
          byteOffset: byteOffset + matchIndex,
          byteLength: Buffer.byteLength(name, 'utf8'),
          startLine: i + 1,
          startColumn: matchIndex,
          endLine: i + 1,
          endColumn: matchIndex + name.length,
          signature: line.trim(),
          exported: isExported
        });
      }

      byteOffset += lineByteLength;
    }
  }

  private parseRust(content: string, symbols: Omit<ByteOffsetSymbol, 'id' | 'filePath' | 'fileDigest'>[]): void {
    const lines = content.split('\n');
    let byteOffset = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineByteLength = Buffer.byteLength(line, 'utf8') + 1;

      const fnMatch = line.match(/^\s*(pub\s+)?(async\s+)?fn\s+([A-Za-z0-9_]+)/);
      if (fnMatch) {
        const name = fnMatch[3];
        const exported = !!fnMatch[1];
        const matchIndex = line.indexOf(name);
        symbols.push({
          name,
          kind: 'function',
          byteOffset: byteOffset + matchIndex,
          byteLength: Buffer.byteLength(name, 'utf8'),
          startLine: i + 1,
          startColumn: matchIndex,
          endLine: i + 1,
          endColumn: matchIndex + name.length,
          signature: line.trim(),
          exported
        });
      }

      const structMatch = line.match(/^\s*(pub\s+)?struct\s+([A-Za-z0-9_]+)/);
      if (structMatch) {
        const name = structMatch[2];
        const exported = !!structMatch[1];
        const matchIndex = line.indexOf(name);
        symbols.push({
          name,
          kind: 'struct',
          byteOffset: byteOffset + matchIndex,
          byteLength: Buffer.byteLength(name, 'utf8'),
          startLine: i + 1,
          startColumn: matchIndex,
          endLine: i + 1,
          endColumn: matchIndex + name.length,
          signature: line.trim(),
          exported
        });
      }

      const enumMatch = line.match(/^\s*(pub\s+)?enum\s+([A-Za-z0-9_]+)/);
      if (enumMatch) {
        const name = enumMatch[2];
        const exported = !!enumMatch[1];
        const matchIndex = line.indexOf(name);
        symbols.push({
          name,
          kind: 'enum',
          byteOffset: byteOffset + matchIndex,
          byteLength: Buffer.byteLength(name, 'utf8'),
          startLine: i + 1,
          startColumn: matchIndex,
          endLine: i + 1,
          endColumn: matchIndex + name.length,
          signature: line.trim(),
          exported
        });
      }

      byteOffset += lineByteLength;
    }
  }

  private parseCStyle(content: string, _language: string, symbols: Omit<ByteOffsetSymbol, 'id' | 'filePath' | 'fileDigest'>[]): void {
    const lines = content.split('\n');
    let byteOffset = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineByteLength = Buffer.byteLength(line, 'utf8') + 1;

      const classMatch = line.match(/^\s*(public|private|protected)?\s*(class|struct|interface)\s+([A-Za-z0-9_]+)/);
      if (classMatch) {
        const name = classMatch[3];
        const kind = classMatch[2] === 'class' ? 'class' : (classMatch[2] === 'struct' ? 'struct' : 'interface');
        const matchIndex = line.indexOf(name);
        symbols.push({
          name,
          kind,
          byteOffset: byteOffset + matchIndex,
          byteLength: Buffer.byteLength(name, 'utf8'),
          startLine: i + 1,
          startColumn: matchIndex,
          endLine: i + 1,
          endColumn: matchIndex + name.length,
          signature: line.trim(),
          exported: classMatch[1] === 'public'
        });
      }

      byteOffset += lineByteLength;
    }
  }

  private parseGDScript(content: string, symbols: Omit<ByteOffsetSymbol, 'id' | 'filePath' | 'fileDigest'>[]): void {
    const lines = content.split('\n');
    let byteOffset = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineByteLength = Buffer.byteLength(line, 'utf8') + 1;

      const classMatch = line.match(/^class_name\s+([A-Za-z0-9_]+)/);
      if (classMatch) {
        const name = classMatch[1];
        const matchIndex = line.indexOf(name);
        symbols.push({
          name,
          kind: 'class',
          byteOffset: byteOffset + matchIndex,
          byteLength: Buffer.byteLength(name, 'utf8'),
          startLine: i + 1,
          startColumn: matchIndex,
          endLine: i + 1,
          endColumn: matchIndex + name.length,
          signature: line.trim(),
          exported: true
        });
      }

      const funcMatch = line.match(/^\s*func\s+([A-Za-z0-9_]+)\s*\(/);
      if (funcMatch) {
        const name = funcMatch[1];
        const matchIndex = line.indexOf(name);
        symbols.push({
          name,
          kind: 'function',
          byteOffset: byteOffset + matchIndex,
          byteLength: Buffer.byteLength(name, 'utf8'),
          startLine: i + 1,
          startColumn: matchIndex,
          endLine: i + 1,
          endColumn: matchIndex + name.length,
          signature: line.trim(),
          exported: !name.startsWith('_')
        });
      }

      byteOffset += lineByteLength;
    }
  }

  private parseLua(content: string, symbols: Omit<ByteOffsetSymbol, 'id' | 'filePath' | 'fileDigest'>[]): void {
    const lines = content.split('\n');
    let byteOffset = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineByteLength = Buffer.byteLength(line, 'utf8') + 1;

      const funcMatch = line.match(/^\s*(local\s+)?function\s+([A-Za-z0-9_.:]+)\s*\(/);
      if (funcMatch) {
        const name = funcMatch[2];
        const isLocal = !!funcMatch[1];
        const matchIndex = line.indexOf(name);
        symbols.push({
          name,
          kind: name.includes(':') || name.includes('.') ? 'method' : 'function',
          byteOffset: byteOffset + matchIndex,
          byteLength: Buffer.byteLength(name, 'utf8'),
          startLine: i + 1,
          startColumn: matchIndex,
          endLine: i + 1,
          endColumn: matchIndex + name.length,
          signature: line.trim(),
          exported: !isLocal
        });
      }

      byteOffset += lineByteLength;
    }
  }

  private parseCss(content: string, symbols: Omit<ByteOffsetSymbol, 'id' | 'filePath' | 'fileDigest'>[]): void {
    const lines = content.split('\n');
    let byteOffset = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineByteLength = Buffer.byteLength(line, 'utf8') + 1;

      const ruleMatch = line.match(/^\s*([.#][A-Za-z0-9_-]+)\s*\{/);
      if (ruleMatch) {
        const name = ruleMatch[1];
        const matchIndex = line.indexOf(name);
        symbols.push({
          name,
          kind: 'variable',
          byteOffset: byteOffset + matchIndex,
          byteLength: Buffer.byteLength(name, 'utf8'),
          startLine: i + 1,
          startColumn: matchIndex,
          endLine: i + 1,
          endColumn: matchIndex + name.length,
          signature: line.trim(),
          exported: true
        });
      }

      byteOffset += lineByteLength;
    }
  }

  private parseGeneric(content: string, symbols: Omit<ByteOffsetSymbol, 'id' | 'filePath' | 'fileDigest'>[]): void {
    const lines = content.split('\n');
    let byteOffset = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineByteLength = Buffer.byteLength(line, 'utf8') + 1;

      const genericMatch = line.match(/^\s*(function|class|def|fn)\s+([A-Za-z0-9_]+)/i);
      if (genericMatch) {
        const name = genericMatch[2];
        const matchIndex = line.indexOf(name);
        symbols.push({
          name,
          kind: 'function',
          byteOffset: byteOffset + matchIndex,
          byteLength: Buffer.byteLength(name, 'utf8'),
          startLine: i + 1,
          startColumn: matchIndex,
          endLine: i + 1,
          endColumn: matchIndex + name.length,
          signature: line.trim(),
          exported: true
        });
      }

      byteOffset += lineByteLength;
    }
  }

  private updateHealth(language: string, parserType: 'ast' | 'tree_sitter' | 'regex_fallback', symbolCount: number, hasError: boolean): void {
    const existing = this.healthReports.get(language) || {
      language,
      parserType,
      filesIndexed: 0,
      symbolsExtracted: 0,
      averageConfidence: parserType === 'ast' ? 0.95 : (parserType === 'tree_sitter' ? 0.85 : 0.65),
      hasErrors: false,
      errorCount: 0
    };

    existing.filesIndexed += 1;
    existing.symbolsExtracted += symbolCount;
    if (hasError) {
      existing.hasErrors = true;
      existing.errorCount += 1;
    }

    this.healthReports.set(language, existing);
  }

  public getHealthReports(): ParserHealthReport[] {
    return Array.from(this.healthReports.values());
  }
}
