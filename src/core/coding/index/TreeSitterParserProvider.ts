import * as path from 'path';
import Parser = require('tree-sitter');
import Bash = require('tree-sitter-bash');
import C = require('tree-sitter-c');
import Cpp = require('tree-sitter-cpp');
import Go = require('tree-sitter-go');
import Java = require('tree-sitter-java');
import Kotlin = require('tree-sitter-kotlin');
import Python = require('tree-sitter-python');
import Rust = require('tree-sitter-rust');
import Swift = require('tree-sitter-swift');
import JavaScript = require('tree-sitter-javascript');
import { IndexedSymbol, ParserProvider } from './ParserProvider';

type Grammar = Parameters<Parser['setLanguage']>[0];

interface GrammarDescriptor {
  id: string;
  extensions: string[];
  grammar: Grammar;
}

const grammars: GrammarDescriptor[] = [
  { id: 'bash', extensions: ['.sh', '.bash'], grammar: Bash },
  { id: 'c', extensions: ['.c', '.h'], grammar: C },
  { id: 'cpp', extensions: ['.cc', '.cpp', '.cxx', '.hpp', '.hh', '.hxx'], grammar: Cpp },
  { id: 'go', extensions: ['.go'], grammar: Go },
  { id: 'java', extensions: ['.java'], grammar: Java },
  { id: 'kotlin', extensions: ['.kt', '.kts'], grammar: Kotlin },
  { id: 'python', extensions: ['.py', '.pyi'], grammar: Python },
  { id: 'rust', extensions: ['.rs'], grammar: Rust },
  { id: 'swift', extensions: ['.swift'], grammar: Swift },
  { id: 'javascript', extensions: ['.js', '.jsx', '.mjs', '.cjs'], grammar: JavaScript }
];
/**
 * Maintained grammar-backed indexing for the priority polyglot families.
 * Unsupported extensions intentionally remain on FallbackParserProvider and
 * are reported with its lower confidence/parser id.
 */
export class TreeSitterParserProvider implements ParserProvider {
  readonly id = 'tree-sitter';

  supports(file: string): boolean {
    return this.descriptor(file) !== undefined;
  }

  parse(file: string, content: string): IndexedSymbol[] {
    const descriptor = this.descriptor(file);
    if (!descriptor) return [];
    const parserId = `${this.id}:${descriptor.id}`;
    const symbols: IndexedSymbol[] = [];
    try {
      const parser = new Parser();
      parser.setLanguage(descriptor.grammar);
      const tree = parser.parse(content);
      if (tree?.rootNode) this.walk(tree.rootNode, file.replace(/\\/g, '/'), parserId, symbols);
    } catch { /* recover below when a native grammar is unavailable or unstable */ }
    return symbols.length ? symbols : this.recoverSymbols(file, content, `${parserId}:recovery`);
  }

  private walk(node: Parser.SyntaxNode, file: string, parserId: string, symbols: IndexedSymbol[]): void {
    const kind = this.kindFor(node.type);
    if (kind) {
      const name = this.nameFor(node);
      if (name) {
        symbols.push({
          kind,
          name,
          file,
          line: node.startPosition.row + 1,
          column: node.startPosition.column + 1,
          signature: node.text.split(/\r?\n/, 1)[0].slice(0, 240),
          confidence: node.hasError ? 0.82 : 0.95,
          parser: parserId
        });
      }
    }
    for (let index = 0; index < node.namedChildCount; index += 1) {
      const child = node.namedChild(index);
      if (child) this.walk(child, file, parserId, symbols);
    }
  }

  private kindFor(type: string): IndexedSymbol['kind'] | undefined {
    const value = type.toLowerCase();
    if (/(^|_)(class|struct|trait|union|record)(_|$)/.test(value)) return 'class';
    if (/(^|_)(interface|protocol)(_|$)/.test(value)) return 'interface';
    if (/(^|_)(enum)(_|$)/.test(value)) return 'enum';
    if (/(function|method|subroutine|lambda|closure|constructor|initializer)/.test(value)) return 'function';
    if (/(^|_)(type_alias|type_definition|type_declaration)(_|$)/.test(value)) return 'type';
    if (/(^|_)(import|use|include|require|preproc_include|import_declaration)(_|$)/.test(value)) return 'import';
    if (/(^|_)(export|export_statement)(_|$)/.test(value)) return 'export';
    if (/(test|spec)(_|$)/.test(value)) return 'test';
    return undefined;
  }

  private nameFor(node: Parser.SyntaxNode): string | undefined {
    const named = node.childForFieldName('name') || node.childForFieldName('path') || node.childForFieldName('argument');
    if (named?.text.trim()) return named.text.trim();
    const candidate = Array.from({ length: node.namedChildCount }, (_, index) => node.namedChild(index)).find(child => child && /^(identifier|type_identifier|property_identifier|field_identifier|name|qualified_name|string|interpreted_string_literal)$/.test(child.type));
    if (candidate?.text.trim()) return candidate.text.trim();
    if (node.type.includes('include') || node.type.includes('import') || node.type.includes('use')) return node.text.trim().slice(0, 240);
    return undefined;
  }

  private recoverSymbols(file: string, content: string, parserId: string): IndexedSymbol[] {
    const symbols: IndexedSymbol[] = [];
    const add = (kind: IndexedSymbol['kind'], name: string, line: number, signature: string) => {
      if (!name || ['if', 'for', 'while', 'switch', 'catch', 'return'].includes(name)) return;
      symbols.push({ kind, name, file: file.replace(/\\/g, '/'), line, column: 1, signature: signature.slice(0, 240), confidence: 0.82, parser: parserId });
    };
    content.split(/\r?\n/).forEach((line, index) => {
      const declaration = line.match(/\b(class|struct|trait|interface|protocol|enum|record|union)\s+([A-Za-z_$][\w$]*)/i);
      if (declaration) add(/interface|protocol/i.test(declaration[1]) ? 'interface' : /enum/i.test(declaration[1]) ? 'enum' : 'class', declaration[2], index + 1, line);
      const functionMatch = line.match(/\b(?:fn|func|def|function|fun|subroutine)\s+([A-Za-z_$][\w$]*)\s*\(/i) || line.match(/\b([A-Za-z_$][\w$]*)\s*\([^;{}]*\)\s*\{/);
      if (functionMatch) add('function', functionMatch[1], index + 1, line);
      const typeMatch = line.match(/\b(?:type|typedef)\s+([A-Za-z_$][\w$]*)/i);
      if (typeMatch) add('type', typeMatch[1], index + 1, line);
    });
    return symbols;
  }

  private descriptor(file: string): GrammarDescriptor | undefined {
    const extension = path.extname(file).toLowerCase();
    return grammars.find(candidate => candidate.extensions.includes(extension));
  }
}
