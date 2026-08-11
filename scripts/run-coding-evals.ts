import fs from 'fs';
import path from 'path';
import { CodingBenchmarkRunner } from '../src/core/evaluation/CodingBenchmarkRunner';

const mode = process.argv.includes('--upgraded') ? 'upgraded' : 'baseline';
const root = path.resolve(process.cwd(), 'evals/coding/fixtures');
const runner = new CodingBenchmarkRunner(root);

async function main(): Promise<void> {
  const report = await runner.run(runner.loadManifest(), mode);
  const outputRoot = path.resolve(process.cwd(), 'docs/implementation/evidence/coding-upgrade', mode);
  fs.mkdirSync(outputRoot, { recursive: true });
  fs.writeFileSync(path.join(outputRoot, 'manifest.json'), JSON.stringify({ suite: report.suite, mode: report.mode, generatedAt: report.generatedAt, fixtureRoot: root, cases: report.cases.map(testCase => ({ id: testCase.id, fixture: testCase.fixture, fixtureHash: testCase.fixtureHash, toolchain: testCase.toolchain, toolchainAvailable: testCase.toolchainAvailable, status: testCase.status, reason: testCase.reason })) }, null, 2));
  fs.writeFileSync(path.join(outputRoot, 'report.json'), JSON.stringify(report, null, 2));
  const sourceManifest = runner.loadManifest();
  for (const result of report.cases) {
    const testCase = sourceManifest.cases.find(candidate => candidate.id === result.id);
    if (!testCase) continue;
    const caseRoot = path.join(outputRoot, 'cases', result.id);
    fs.mkdirSync(caseRoot, { recursive: true });
    fs.writeFileSync(path.join(caseRoot, 'request.json'), JSON.stringify({ id: testCase.id, prompt: testCase.prompt, expectedFiles: testCase.expectedFiles, hiddenChecks: testCase.hiddenChecks }, null, 2));
    fs.writeFileSync(path.join(caseRoot, 'response.json'), JSON.stringify({ mode, status: result.status, reason: result.reason, executor: result.inspection ? 'repository-controller-inspection' : 'toolchain-preflight-only', inspection: result.inspection }, null, 2));
    fs.writeFileSync(path.join(caseRoot, 'diff.patch'), '');
    fs.writeFileSync(path.join(caseRoot, 'commands.json'), JSON.stringify(result.checks || [], null, 2));
    fs.writeFileSync(path.join(caseRoot, 'diagnostics.json'), JSON.stringify({ parsed: false, reason: 'No generated patch was executed by the preflight runner' }, null, 2));
  }
  console.log(JSON.stringify(report, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
