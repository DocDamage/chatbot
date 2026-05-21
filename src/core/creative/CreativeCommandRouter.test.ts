import { CreativeCommandRouter } from './CreativeCommandRouter';

describe('CreativeCommandRouter', () => {
  it('routes revision slash commands to structured revision operations', () => {
    const routed = CreativeCommandRouter.route('/revise increase tension in the interrogation scene');

    expect(routed).toEqual(expect.objectContaining({
      handled: true,
      operation: 'revise_passage',
      revisionOperation: 'increase_tension',
      prompt: 'increase tension in the interrogation scene',
    }));
  });

  it('routes roleplay control slash commands with arguments', () => {
    const routed = CreativeCommandRouter.route('/boundary no graphic torture, fade early');

    expect(routed).toEqual(expect.objectContaining({
      handled: true,
      operation: 'roleplay_turn',
      roleplayAction: 'boundary',
      prompt: 'no graphic torture, fade early',
    }));
  });

  it('returns command help for unknown creative slash commands', () => {
    const routed = CreativeCommandRouter.route('/dance wildly');

    expect(routed.handled).toBe(true);
    expect(routed.operation).toBe('roleplay_turn');
    expect(routed.roleplayAction).toBe('help');
    expect(routed.prompt).toContain('/ooc');
  });

  it('ignores ordinary prose', () => {
    expect(CreativeCommandRouter.route('Continue the scene.').handled).toBe(false);
  });
});
