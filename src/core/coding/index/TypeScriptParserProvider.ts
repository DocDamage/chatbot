import * as path from 'path';
import ts from 'typescript';
import { IndexedSymbol, ParserProvider } from './ParserProvider';

export class TypeScriptParserProvider implements ParserProvider {
  id = `typescript-${ts.version}`;
  supports(file: string): boolean { return ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(path.extname(file).toLowerCase()); }

  parse(file: string, content: string): IndexedSymbol[] {
    const scriptKind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : file.endsWith('.jsx') ? ts.ScriptKind.JSX : ts.ScriptKind.TS;
    const source = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, scriptKind);
    const symbols: IndexedSymbol[] = [];
    const add = (kind: IndexedSymbol['kind'], name: string, node: ts.Node) => {
      const position = source.getLineAndCharacterOfPosition(node.getStart(source));
      symbols.push({ kind, name, file: file.replace(/\\/g, '/'), line: position.line + 1, column: position.character + 1, signature: node.getText(source).split(/\r?\n/)[0].slice(0, 240), confidence: 0.98, parser: this.id });
    };
    const visit = (node: ts.Node) => {
      if (ts.isClassDeclaration(node) && node.name) add('class', node.name.text, node);
      else if (ts.isInterfaceDeclaration(node)) add('interface', node.name.text, node);
      else if (ts.isTypeAliasDeclaration(node)) add('type', node.name.text, node);
      else if (ts.isEnumDeclaration(node)) add('enum', node.name.text, node);
      else if (ts.isFunctionDeclaration(node) && node.name) add('function', node.name.text, node);
      else if (ts.isMethodDeclaration(node) && node.name && ts.isIdentifier(node.name)) add('method', node.name.text, node);
      else if (ts.isImportDeclaration(node)) add('import', node.moduleSpecifier.getText(source).replace(/["']/g, ''), node);
      else if (ts.isExportDeclaration(node)) add('export', node.moduleSpecifier?.getText(source).replace(/["']/g, '') || 'export', node);
      else if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && ['test', 'it', 'describe'].includes(node.expression.text) && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) add('test', node.arguments[0].text, node);
      ts.forEachChild(node, visit);
    };
    visit(source);
    return symbols;
  }
}
