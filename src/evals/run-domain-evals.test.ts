import fs from 'fs';
import path from 'path';

describe('domain eval configuration', () => {
  it('exposes creative and roleplay npm eval scripts', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));

    expect(pkg.scripts['eval:creative']).toBe('tsx scripts/run-domain-evals.ts creative');
    expect(pkg.scripts['eval:roleplay']).toBe('tsx scripts/run-domain-evals.ts creative/roleplay');
  });

  it('contains creative eval metadata for release-critical behaviors', () => {
    const creativeDir = path.join(process.cwd(), 'evals', 'creative');
    const roleplayDir = path.join(creativeDir, 'roleplay');

    expect(fs.existsSync(path.join(creativeDir, 'creative_writing_eval_cases.json'))).toBe(true);
    expect(fs.existsSync(path.join(roleplayDir, 'roleplay_eval_cases.json'))).toBe(true);

    const creativeCases = JSON.parse(fs.readFileSync(path.join(creativeDir, 'creative_writing_eval_cases.json'), 'utf8'));
    const roleplayCases = JSON.parse(fs.readFileSync(path.join(roleplayDir, 'roleplay_eval_cases.json'), 'utf8'));
    const ids = [...creativeCases, ...roleplayCases].map((testCase: { id: string }) => testCase.id);

    expect(ids).toEqual(expect.arrayContaining([
      'creative-genre-fidelity-001',
      'creative-continuity-001',
      'creative-mature-boundary-001',
      'creative-copyright-style-001',
      'creative-revision-quality-001',
      'roleplay-boundary-state-001',
      'roleplay-character-voice-001',
    ]));
  });
});
