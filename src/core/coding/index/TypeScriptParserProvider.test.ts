import { TypeScriptParserProvider } from './TypeScriptParserProvider';

describe('TypeScriptParserProvider', () => {
  it('returns source ranges and high-confidence AST symbols', () => {
    const symbols = new TypeScriptParserProvider().parse('src/app.ts', 'export interface User { id: string; }\nexport function loadUser() { return null; }\ntest("loads a user", () => loadUser());');
    expect(symbols).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'interface', name: 'User', line: 1, confidence: 0.98 }),
      expect.objectContaining({ kind: 'function', name: 'loadUser', line: 2 }),
      expect.objectContaining({ kind: 'test', name: 'loads a user', line: 3 })
    ]));
  });
});
