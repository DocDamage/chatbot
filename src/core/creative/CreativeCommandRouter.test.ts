import { CreativeCommandRouter } from './CreativeCommandRouter';

describe('CreativeCommandRouter', () => {
  it('routes revision slash commands across all subcommands and edge cases', () => {
    // increase tension
    expect(CreativeCommandRouter.route('/revise increase tension in the scene')).toEqual(expect.objectContaining({
      handled: true,
      operation: 'revise_passage',
      revisionOperation: 'increase_tension',
      prompt: 'increase tension in the scene'
    }));

    // show don't tell
    expect(CreativeCommandRouter.route('/revise show don\'t tell the anger')).toEqual(expect.objectContaining({
      handled: true,
      operation: 'revise_passage',
      revisionOperation: 'show_dont_tell',
      prompt: 'show don\'t tell the anger'
    }));

    // other revision commands
    const commands = ['expand', 'condense', 'darker', 'funnier', 'dialogue', 'line', 'copy', 'continuity', 'rating'];
    for (const cmd of commands) {
      const res = CreativeCommandRouter.route(`/revise ${cmd} some passage`);
      expect(res.handled).toBe(true);
      expect(res.operation).toBe('revise_passage');
    }

    // fallback empty /revise
    const emptyRevise = CreativeCommandRouter.route('/revise');
    expect(emptyRevise.handled).toBe(true);
    expect(emptyRevise.prompt).toBe('Revise the current passage.');
  });

  it('routes roleplay control slash commands including summary and cast', () => {
    const summaryRes = CreativeCommandRouter.route('/summary of the previous chapter');
    expect(summaryRes.handled).toBe(true);
    expect(summaryRes.operation).toBe('summarize_continuity');

    const castRes = CreativeCommandRouter.route('/cast introduce detective');
    expect(castRes.handled).toBe(true);
    expect(castRes.operation).toBe('roleplay_turn');
    expect(castRes.roleplayAction).toBe('cast');

    const oocRes = CreativeCommandRouter.route('/ooc check character motivation');
    expect(oocRes.roleplayAction).toBe('ooc');
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
