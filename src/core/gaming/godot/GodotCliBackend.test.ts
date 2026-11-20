import { GodotCliBackend } from './GodotCliBackend';
import { runNativeCommand } from '../../native-runtime/NativeCommandRunner';
import { EngineAssertion } from '../engine/GameEngineTypes';

jest.mock('../../native-runtime/NativeCommandRunner', () => ({ runNativeCommand: jest.fn() }));
const run = jest.mocked(runNativeCommand);
const requested: EngineAssertion[] = [{ type: 'node_exists', target: 'Player', expected: true }];

describe('G00 Godot CLI evidence boundary (mocked process, no native certification)', () => {
  const backend = new GodotCliBackend('godot-fixture', process.cwd());
  const root = process.cwd();
  const observations = [{ assertionId: 0, actual: true, passed: true }];
  beforeEach(() => run.mockReset());

  function emit(transform: (payload: any) => unknown = payload => payload, exitCode = 0) {
    run.mockImplementationOnce(async (_executable, _args, options) => {
      const evidence = JSON.parse(options!.env!.CHATBOT_GODOT_EVIDENCE!);
      return { exitCode, stdout: `CHATBOT_RUNTIME_JSON:${JSON.stringify(transform({ mode: 'scenario', evidence, assertions: observations }))}`, stderr: '', durationMs: 1 };
    });
  }

  it('accepts complete, fresh observations and preserves host expectations', async () => {
    emit(payload => ({ ...payload, assertions: [{ ...observations[0], expected: false, target: 'Foreign', type: 'custom' }] }));
    const report = await backend.runScenario(root, { scenePath: 'Main.tscn' }, requested);
    expect(report).toMatchObject({ passed: true, checkKind: 'scene_observation', assertions: [{ expected: true, target: 'Player', type: 'node_exists', actual: true }] });
  });

  it.each([
    ['missing report', () => null],
    ['foreign report mode', (p: any) => ({ ...p, mode: 'profile' })],
    ['empty observations', (p: any) => ({ ...p, assertions: [] })],
    ['missing observations', (p: any) => ({ evidence: p.evidence })],
    ['foreign project', (p: any) => ({ ...p, evidence: { ...p.evidence, projectRoot: 'other' } })],
    ['stale run', (p: any) => ({ ...p, evidence: { ...p.evidence, runId: 'old' } })],
    ['changed request', (p: any) => ({ ...p, evidence: { ...p.evidence, requestDigest: 'other' } })],
    ['foreign scene', (p: any) => ({ ...p, evidence: { ...p.evidence, scenePath: 'Other.tscn' } })],
    ['foreign engine', (p: any) => ({ ...p, evidence: { ...p.evidence, engine: 'unity' } })],
    ['missing identity', (p: any) => ({ ...p, assertions: [{ actual: true, passed: true }] })],
    ['string passed', (p: any) => ({ ...p, assertions: [{ ...observations[0], passed: 'true' }] })],
    ['missing actual', (p: any) => ({ ...p, assertions: [{ assertionId: 0, passed: true }] })],
    ['mismatched actual', (p: any) => ({ ...p, assertions: [{ ...observations[0], actual: false }] })],
    ['extra observation', (p: any) => ({ ...p, assertions: [...observations, ...observations] })],
    ['malformed actualJson', (p: any) => ({ ...p, assertions: [{ ...observations[0], actualJson: 'invalid' }] })]
  ] as const)('rejects %s', async (_name, transform) => {
    emit(transform);
    expect((await backend.runScenario(root, {}, requested)).passed).toBe(false);
  });

  it.each([{ assertions: [] }, { assertions: [{ type: 'custom' as const, target: 'x', expected: true }] }])('never passes empty or unsupported assertions: %p', async ({ assertions }) => {
    emit();
    expect((await backend.runScenario(root, {}, assertions)).passed).toBe(false);
  });

  it('rejects a replay even for the same project and assertions', async () => {
    let previous: unknown;
    emit(payload => { previous = payload; return payload; });
    expect((await backend.runScenario(root, {}, requested)).passed).toBe(true);
    emit(() => previous);
    expect((await backend.runScenario(root, {}, requested)).passed).toBe(false);
  });

  it.each(['', 'CHATBOT_RUNTIME_JSON:{broken', 'CHATBOT_RUNTIME_JSON:{}\nCHATBOT_RUNTIME_JSON:{}'])('rejects missing, malformed, or duplicate stdout payload: %s', async stdout => {
    run.mockResolvedValueOnce({ exitCode: 0, stdout, stderr: '', durationMs: 1 });
    expect((await backend.runScenario(root, {}, requested)).passed).toBe(false);
  });

  it('rejects a nonzero exit even when every observation claims success', async () => {
    emit(undefined, 7);
    const report = await backend.runScenario(root, {}, requested);
    expect(report).toMatchObject({ passed: false, assertions: [{ passed: false }] });
    expect(report.error).toContain('code 7');
  });

  it('compares boolean absence correctly and rejects false-positive probe flags', async () => {
    emit(payload => ({ ...payload, assertions: [{ assertionId: 0, actual: false, passed: true }] }));
    expect((await backend.runScenario(root, {}, [{ type: 'node_exists', target: 'Absent', expected: false }])).passed).toBe(true);
    emit(payload => ({ ...payload, assertions: [{ assertionId: 0, actual: 1, passed: true }] }));
    expect((await backend.runScenario(root, {}, [{ type: 'property_equals', target: 'Player', property: 'health', expected: 100 }])).passed).toBe(false);
  });
});
