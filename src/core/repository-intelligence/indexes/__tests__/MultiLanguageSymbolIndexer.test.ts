import { ByteOffsetSymbolIndex } from '../ByteOffsetSymbolIndex';
import { MultiLanguageSymbolIndexer } from '../MultiLanguageSymbolIndexer';

describe('RT-INDEX-001: MultiLanguageSymbolIndexer Polyglot Parsing Suite', () => {
  let symbolIndex: ByteOffsetSymbolIndex;
  let indexer: MultiLanguageSymbolIndexer;

  beforeEach(() => {
    symbolIndex = new ByteOffsetSymbolIndex(process.cwd());
    indexer = new MultiLanguageSymbolIndexer(symbolIndex);
  });

  it('detects languages across various extensions', () => {
    expect(indexer.detectLanguage('app.ts')).toBe('typescript');
    expect(indexer.detectLanguage('app.jsx')).toBe('javascript');
    expect(indexer.detectLanguage('main.py')).toBe('python');
    expect(indexer.detectLanguage('server.go')).toBe('go');
    expect(indexer.detectLanguage('lib.rs')).toBe('rust');
    expect(indexer.detectLanguage('driver.c')).toBe('c');
    expect(indexer.detectLanguage('engine.cpp')).toBe('cpp');
    expect(indexer.detectLanguage('Service.cs')).toBe('csharp');
    expect(indexer.detectLanguage('App.java')).toBe('java');
    expect(indexer.detectLanguage('script.lua')).toBe('lua');
    expect(indexer.detectLanguage('player.gd')).toBe('gdscript');
    expect(indexer.detectLanguage('Component.svelte')).toBe('svelte');
    expect(indexer.detectLanguage('theme.scss')).toBe('css');
    expect(indexer.detectLanguage('unknown.xyz')).toBe('unknown');
  });

  it('indexes TypeScript/JavaScript classes, interfaces, types, functions, and constants', () => {
    const code = `
      export class AuthController {}
      export interface UserProfile {}
      export type ID = string | number;
      export function verifyToken() {}
      export const JWT_SECRET = 'secret';
    `;
    const symbols = indexer.indexFile('src/auth.ts', code);
    expect(symbols.length).toBeGreaterThanOrEqual(4);
    expect(symbols.some(s => s.name === 'AuthController' && s.kind === 'class')).toBe(true);
    expect(symbols.some(s => s.name === 'UserProfile' && s.kind === 'interface')).toBe(true);
    expect(symbols.some(s => s.name === 'ID' && s.kind === 'type')).toBe(true);
    expect(symbols.some(s => s.name === 'verifyToken' && s.kind === 'function')).toBe(true);
  });

  it('indexes Python classes and functions', () => {
    const code = `
class DataPipeline:
    def __init__(self):
        pass

def process_batch(items):
    return len(items)
    `;
    const symbols = indexer.indexFile('pipeline.py', code);
    expect(symbols.some(s => s.name === 'DataPipeline' && s.kind === 'class')).toBe(true);
    expect(symbols.some(s => s.name === 'process_batch' && s.kind === 'function')).toBe(true);
  });

  it('indexes Go types and functions', () => {
    const code = `
package main

type Config struct {
    Port int
}

func StartServer(cfg Config) error {
    return nil
}
    `;
    const symbols = indexer.indexFile('main.go', code);
    expect(symbols.some(s => s.name === 'Config' && s.kind === 'struct')).toBe(true);
    expect(symbols.some(s => s.name === 'StartServer' && s.kind === 'function')).toBe(true);
  });

  it('indexes Rust structs, enums, and functions', () => {
    const code = `
pub struct Matrix {
    data: Vec<f64>,
}

pub enum OpCode {
    Add,
    Sub,
}

pub fn compute_inverse(m: &Matrix) -> Matrix {
    Matrix { data: vec![] }
}
    `;
    const symbols = indexer.indexFile('matrix.rs', code);
    expect(symbols.some(s => s.name === 'Matrix' && s.kind === 'struct')).toBe(true);
    expect(symbols.some(s => s.name === 'OpCode' && s.kind === 'enum')).toBe(true);
    expect(symbols.some(s => s.name === 'compute_inverse' && s.kind === 'function')).toBe(true);
  });

  it('indexes C/C++/C#/Java structures and functions', () => {
    const cCode = `
struct Point {
    int x;
    int y;
};

int calculate_distance(struct Point* a, struct Point* b) {
    return 0;
}
    `;
    const cSymbols = indexer.indexFile('point.c', cCode);
    expect(cSymbols.length).toBeGreaterThan(0);

    const javaCode = `
public class ApplicationService {
    public void executeTask() {}
}
    `;
    const javaSymbols = indexer.indexFile('App.java', javaCode);
    expect(javaSymbols.length).toBeGreaterThan(0);
  });

  it('indexes GDScript, Lua, CSS, and generic files', () => {
    const gdCode = `
class_name EnemyCharacter
extends Node2D

func take_damage(amount: int) -> void:
    pass
    `;
    const gdSymbols = indexer.indexFile('enemy.gd', gdCode);
    expect(gdSymbols.length).toBeGreaterThan(0);

    const luaCode = `
function calculate_score(points)
    return points * 10
end
    `;
    const luaSymbols = indexer.indexFile('game.lua', luaCode);
    expect(luaSymbols.length).toBeGreaterThan(0);

    const cssCode = `
.header-container {
    display: flex;
}
#main-banner {
    color: red;
}
    `;
    const cssSymbols = indexer.indexFile('style.css', cssCode);
    expect(cssSymbols.length).toBeGreaterThan(0);

    const genericCode = `
KEY_A=VALUE_A
KEY_B=VALUE_B
    `;
    const genericSymbols = indexer.indexFile('config.env', genericCode);
    expect(Array.isArray(genericSymbols)).toBe(true);
  });

  it('tracks parser health reports across indexed languages', () => {
    indexer.indexFile('test.ts', 'export class HealthTest {}');
    const reports = indexer.getHealthReports();
    expect(reports.length).toBeGreaterThan(0);

    const tsHealth = reports.find(r => r.language === 'typescript');
    expect(tsHealth).toBeDefined();
    expect(tsHealth?.filesIndexed).toBeGreaterThan(0);
    expect(tsHealth?.hasErrors).toBe(false);
  });
});
