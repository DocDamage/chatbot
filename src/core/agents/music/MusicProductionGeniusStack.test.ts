import { MusicProductionGeniusAgent } from './MusicProductionGeniusAgent';
import { SunoGeniusAgent } from './suno/SunoGeniusAgent';
import { FLStudioGeniusAgent } from './flstudio/FLStudioGeniusAgent';
import { ProToolsGeniusAgent } from './protools/ProToolsGeniusAgent';
import { LogicProGeniusAgent } from './logic/LogicProGeniusAgent';

describe('Music Production Genius DAW stack', () => {
  it('routes Suno prompts with structure and copyright guardrails', async () => {
    const agent = new MusicProductionGeniusAgent();

    const result = await agent.ask('Make a Suno prompt for a dark cinematic trap song with female vocals.');

    expect(result.model).toBe('suno-tools');
    expect(result.response).toContain('Prompt:');
    expect(result.response).toContain('Structure:');
    expect(result.response).toContain('Do not reference a living artist directly');
  });

  it('answers FL Studio 808 tuning questions', () => {
    const result = new FLStudioGeniusAgent().ask('My 808 sounds off-key in FL Studio. What should I check?');

    expect(result.model).toBe('fl-studio-tools');
    expect(result.response).toContain('root note');
    expect(result.response).toContain('Piano Roll');
    expect(result.response).toContain('tuning');
  });

  it('answers Pro Tools vocal session setup questions', () => {
    const result = new ProToolsGeniusAgent().ask('How should I set up a Pro Tools vocal recording session?');

    expect(result.response).toContain('sample rate');
    expect(result.response).toContain('audio tracks');
    expect(result.response).toContain('record');
    expect(result.response).toContain('playlists');
  });

  it('answers Logic stock vocal chain questions', () => {
    const result = new LogicProGeniusAgent().ask('Give me a stock Logic Pro vocal chain for modern rap vocals.');

    expect(result.response).toContain('Channel EQ');
    expect(result.response).toContain('Compressor');
    expect(result.response).toContain('DeEsser');
    expect(result.response).toContain('reverb');
  });

  it('translates FL Studio workflows into Logic', async () => {
    const agent = new MusicProductionGeniusAgent();

    const result = await agent.dawTranslate('Translate FL Studio Channel Rack workflow into Logic Pro.');

    expect(result.response).toContain('DawWorkflowMapTool');
    expect(result.response).toContain('FL Studio Channel Rack -> Logic');
    expect(result.response).toContain('software instrument tracks');
  });

  it('diagnoses kick and 808 masking', async () => {
    const agent = new MusicProductionGeniusAgent();

    const result = await agent.mix('My 808 and kick are fighting. What do I do?');

    expect(result.response).toContain('MixDiagnosticTool');
    expect(result.response).toContain('masking');
    expect(result.response).toContain('sidechain');
  });

  it('can call Suno sub-agent directly', () => {
    const result = new SunoGeniusAgent().ask('Instrumental futuristic trap prompt.');

    expect(result.response).toContain('Suno Genius');
    expect(result.response).toContain('Rights/copyright note');
  });
});
