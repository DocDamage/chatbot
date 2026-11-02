import path from 'path';
import ts from 'typescript';
import { IndexedSymbol } from './ParserProvider';

/** Compiler-bound references: imported aliases are followed; comments and lookalike names are not. */
export class TypeScriptReferences {
  private readonly sources = new Map<string, string>();
  constructor(private readonly root: string) {}
  set(file: string, content: string): void { if (/\.[cm]?[jt]sx?$/i.test(file)) this.sources.set(path.resolve(this.root, file), content); }

  find(name: string, location?: { file: string; line: number; column: number }): IndexedSymbol[] {
    const files = [...this.sources.keys()];
    if (!files.length) return [];
    const options: ts.CompilerOptions = { allowJs: true, checkJs: true, target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS, moduleResolution: ts.ModuleResolutionKind.Node10, jsx: ts.JsxEmit.Preserve, noLib: true };
    const host: ts.LanguageServiceHost = {
      getScriptFileNames: () => files, getScriptVersion: () => '1', getCompilationSettings: () => options,
      getScriptSnapshot: file => { const text = this.sources.get(path.resolve(file)); return text === undefined ? undefined : ts.ScriptSnapshot.fromString(text); },
      getCurrentDirectory: () => this.root, getDefaultLibFileName: () => '',
      fileExists: file => this.sources.has(path.resolve(file)), readFile: file => this.sources.get(path.resolve(file)),
      directoryExists: directory => files.some(file => file.startsWith(path.resolve(directory) + path.sep)),
    };
    const service = ts.createLanguageService(host);
    try {
      const program = service.getProgram();
      const declarations: Array<{ file: string; position: number }> = [];
      if (location) {
        const file = path.resolve(this.root, location.file), source = program?.getSourceFile(file);
        if (source && location.line > 0 && location.column > 0) declarations.push({ file, position: source.getPositionOfLineAndCharacter(location.line - 1, location.column - 1) });
      } else {
        for (const file of files) {
          const source = program?.getSourceFile(file); if (!source) continue;
          const visit = (node: ts.Node) => {
            if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isMethodDeclaration(node)
              || ts.isVariableDeclaration(node) || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node))
              && node.name && ts.isIdentifier(node.name) && node.name.text === name) declarations.push({ file, position: node.name.getStart(source) });
            ts.forEachChild(node, visit);
          };
          visit(source);
        }
        // A name alone cannot distinguish unrelated declarations. Callers can provide an exact location.
        if (declarations.length !== 1) return [];
      }
      const result = new Map<string, IndexedSymbol>();
      for (const declaration of declarations) for (const group of service.findReferences(declaration.file, declaration.position) || []) {
        for (const reference of group.references) {
          if (reference.isDefinition) continue;
          const source = program?.getSourceFile(reference.fileName); if (!source || !this.sources.has(path.resolve(reference.fileName))) continue;
          const point = source.getLineAndCharacterOfPosition(reference.textSpan.start);
          const file = path.relative(this.root, reference.fileName).replace(/\\/g, '/');
          result.set(`${file}:${reference.textSpan.start}`, { kind: 'unknown', name, file, line: point.line + 1, column: point.character + 1,
            signature: source.text.split(/\r?\n/)[point.line]?.trim(), confidence: 0.98, parser: 'typescript-language-service:reference' });
        }
      }
      return [...result.values()];
    } finally { service.dispose(); }
  }
}
