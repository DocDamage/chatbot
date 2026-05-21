import { GamingPlaybookService } from './GamingPlaybookService';

describe('GamingPlaybookService', () => {
  const service = new GamingPlaybookService();

  it('creates an engine selection playbook', () => {
    const result = service.create({
      kind: 'engine_selection',
      goal: 'choose an engine for a dark 2D RPG',
      genre: 'JRPG',
      targetPlatform: 'PC'
    });

    expect(result.kind).toBe('engine_selection');
    expect(result.recommendations.join('\n')).toContain('MonoGame');
    expect(result.checklist.length).toBeGreaterThan(0);
  });

  it('creates an asset pipeline playbook', () => {
    const result = service.create({
      kind: 'asset_pipeline',
      goal: 'organize sprite sheets and audio previews',
      engine: 'Godot'
    });

    expect(result.kind).toBe('asset_pipeline');
    expect(result.recommendations.join('\n')).toContain('asset manifest');
    expect(result.risks.join('\n')).toContain('Irregular atlases');
  });

  it('creates safe modding guidance', () => {
    const result = service.create({
      kind: 'modding_safety',
      goal: 'build a personal single-player plugin'
    });

    expect(result.kind).toBe('modding_safety');
    expect(result.recommendations.join('\n')).toContain('official modding APIs');
    expect(result.risks.join('\n')).toContain('Online games');
  });

  it('rejects empty goals', () => {
    expect(() => service.create({ kind: 'design_review', goal: '' })).toThrow(/goal is required/);
  });
});
