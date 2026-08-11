import path from 'path';
import { CodingBenchmarkRunner } from './CodingBenchmarkRunner';

describe('CodingBenchmarkRunner', () => {
  it('loads the fixed polyglot fixture manifest and records unsupported tools honestly', () => {
    const root = path.resolve(process.cwd(), 'evals/coding/fixtures');
    const report = new CodingBenchmarkRunner(root).inspect(new CodingBenchmarkRunner(root).loadManifest(), 'baseline');
    expect(report.cases.length).toBeGreaterThanOrEqual(8);
    expect(report.cases.every(testCase => testCase.fixtureHash.length > 0)).toBe(true);
    expect(report.cases.some(testCase => testCase.status === 'unsupported' || testCase.status === 'ready')).toBe(true);
  });
});
