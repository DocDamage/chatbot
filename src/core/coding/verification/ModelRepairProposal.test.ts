import fs from 'fs';
import os from 'os';
import path from 'path';
import { proposeModelRepair } from './ModelRepairProposal';
import { CodingAgent } from '../../agents/CodingAgent';

describe('fresh model-driven repairs', () => {
  let root: string;
  beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'model-repair-')); fs.writeFileSync(path.join(root, 'calc.cjs'), 'module.exports = (a,b) => a-b;\n'); });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
  const adapter = (generate: jest.Mock) => ({ generate, getModelName: () => 'fixture', estimateCost: () => 0 });
  it('anchors fresh proposals to source captured before generation and rejects expansion of approved scope', async () => {
    const generate = jest.fn(async () => {
      fs.writeFileSync(path.join(root, 'calc.cjs'), 'concurrent user edit');
      return { content: JSON.stringify({ hypothesis: 'fix', operations: [{ operation: 'modify', path: 'calc.cjs', content: 'module.exports = (a,b) => a+b;' }] }), model: 'fixture' };
    });
    const result = await proposeModelRepair(adapter(generate), root, ['calc.cjs'], [], 2);
    expect(result.operations[0].expectedContent).toBe('module.exports = (a,b) => a-b;\n');
    const agent = new CodingAgent({ workspaceRoot: root });
    const patch = agent.createStructuredPatch(result.operations);
    expect(patch.conflicts.length).toBeGreaterThan(0);
    await expect(proposeModelRepair(adapter(jest.fn().mockResolvedValue({ content: '{"operations":[{"operation":"modify","path":"other.cjs","content":"x"}]}', model: 'fixture' })), root, ['calc.cjs'], [], 2)).rejects.toThrow(/unapproved/);
  });
  it('generates a new fix from the actual file and diagnostics after an initial proposal fails', async () => {
    fs.writeFileSync(path.join(root, 'package.json'), '{"scripts":{"test":"node --test check.cjs"}}');
    fs.writeFileSync(path.join(root, 'check.cjs'), "const {test}=require('node:test');const assert=require('node:assert/strict');test('sum',()=>assert.equal(require('./calc.cjs')(2,3),5));");
    const generate = jest.fn().mockResolvedValue({ content: JSON.stringify({ hypothesis: 'Use addition rather than multiplication', operations: [{ operation: 'modify', path: 'calc.cjs', content: 'module.exports = (a,b) => a+b;\n', reason: 'Resolve failing assertion' }] }), model: 'fixture' });
    const agent = new CodingAgent({ workspaceRoot: root });
    const result = await agent.repair({ mode: 'debug', modelAdapter: adapter(generate), operations: [{ operation: 'modify', path: 'calc.cjs', expectedContent: 'module.exports = (a,b) => a-b;\n', content: 'module.exports = (a,b) => a*b;\n', reason: 'Initial proposal', authorized: true }] });
    expect(result.status).toBe('passed'); expect(result.attempts).toHaveLength(2);
    expect(generate.mock.calls[0][0].prompt).toContain('a*b');
    expect(generate.mock.calls[0][0].prompt).toContain('diagnostics');
    expect(fs.readFileSync(path.join(root, 'calc.cjs'), 'utf8')).toContain('a+b');
  });
  it('supplies unchanged implementation context without expanding edit permission', async () => {
    fs.writeFileSync(path.join(root, 'helper.cjs'), 'module.exports = value => value.trim();');
    const generate = jest.fn().mockResolvedValue({ content: '{"operations":[{"operation":"modify","path":"helper.cjs","content":"bad"}]}', model: 'fixture' });
    await expect(proposeModelRepair(adapter(generate), root, ['calc.cjs'], [], 1, 'Fix tests', undefined, ['helper.cjs'])).rejects.toThrow(/unapproved/);
    expect(generate.mock.calls[0][0].prompt).toContain('module.exports = value => value.trim()');
    expect(generate.mock.calls[0][0].prompt).toContain('READ ONLY');
    expect(generate.mock.calls[0][0].jsonSchema.properties.operations.items.properties.path.enum).toEqual(['calc.cjs']);
  });
  it('feeds static errors back before an invalid repair can touch repository files', async () => {
    const previous = process.env.CODING_TOOLS_ENABLED; process.env.CODING_TOOLS_ENABLED = 'true';
    try {
      const generate = jest.fn().mockResolvedValueOnce({ content: JSON.stringify({ operations: [{ operation: 'modify', path: 'calc.cjs', content: 'module.exports = value => missing(value);' }] }), model: 'fixture' })
        .mockImplementationOnce(async () => {
          expect(fs.readFileSync(path.join(root, 'calc.cjs'), 'utf8')).toContain('a-b');
          return { content: JSON.stringify({ operations: [{ operation: 'modify', path: 'calc.cjs', content: 'module.exports = (a,b) => a+b;' }] }), model: 'fixture' };
        });
      const result = await proposeModelRepair(adapter(generate), root, ['calc.cjs'], [], 2, 'Fix addition');
      expect(generate).toHaveBeenCalledTimes(2); expect(generate.mock.calls[1][0].prompt).toContain('no-undef');
      expect(result.operations[0].content).toContain('a+b'); expect(fs.readFileSync(path.join(root, 'calc.cjs'), 'utf8')).toContain('a-b');
    } finally { if (previous === undefined) delete process.env.CODING_TOOLS_ENABLED; else process.env.CODING_TOOLS_ENABLED = previous; }
  }, 20000);
  it('retries malformed model JSON with a larger bounded output budget', async () => {
    const generate = jest.fn().mockResolvedValueOnce({ content: '{"operations":[', model: 'fixture' }).mockResolvedValueOnce({
      content: JSON.stringify({ operations: [{ operation: 'modify', path: 'calc.cjs', content: 'module.exports = (a,b) => a+b;' }] }), model: 'fixture',
    });
    const result = await proposeModelRepair(adapter(generate), root, ['calc.cjs'], [], 2);
    expect(result.operations).toHaveLength(1); expect(generate.mock.calls[1][0].prompt).toContain('invalid or incomplete JSON');
    expect(generate.mock.calls[1][0].maxTokens).toBe(6144);
    expect(fs.readFileSync(path.join(root, 'calc.cjs'), 'utf8')).toContain('a-b');
  });
});
