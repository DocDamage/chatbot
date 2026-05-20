import { ToolRegistry } from '../ToolRegistry';
import { createMusicTools } from './createMusicTools';

describe('createMusicTools', () => {
  it('registers callable Suno, DAW, and DAW-specific music tools', async () => {
    const registry = new ToolRegistry();
    for (const tool of createMusicTools()) {
      registry.register(tool);
    }

    expect(registry.get('suno_prompt')).toBeTruthy();
    expect(registry.get('music_daw_workflow_map')).toBeTruthy();
    expect(registry.get('fl_mixer_routing')).toBeTruthy();
    expect(registry.get('protools_session_setup')).toBeTruthy();
    expect(registry.get('logic_vocal_chain')).toBeTruthy();

    const suno = await registry.get('suno_prompt')!.execute({
      query: 'Make a Suno prompt for dark cinematic trap with female vocals.'
    });
    expect(suno.success).toBe(true);
    expect(JSON.stringify(suno.data)).toContain('Do not reference a living artist directly');

    const daw = await registry.get('music_daw_workflow_map')!.execute({
      query: 'Translate FL Studio Channel Rack workflow into Logic Pro.'
    });
    expect(daw.success).toBe(true);
    expect(JSON.stringify(daw.data)).toContain('FL Studio Channel Rack -> Logic');
  });
});
