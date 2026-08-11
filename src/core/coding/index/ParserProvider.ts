export interface IndexedSymbol {
  kind: 'class' | 'function' | 'method' | 'interface' | 'type' | 'module' | 'import' | 'export' | 'route' | 'test' | 'struct' | 'enum' | 'unknown';
  name: string;
  file: string;
  line: number;
  column?: number;
  signature?: string;
  confidence: number;
  parser: string;
}

export interface ParserProvider { id: string; supports(file: string): boolean; parse(file: string, content: string): IndexedSymbol[]; }
