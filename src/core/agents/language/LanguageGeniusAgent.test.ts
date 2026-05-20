import { LanguageGeniusAgent } from './LanguageGeniusAgent';

describe('LanguageGeniusAgent', () => {
  it('translates deterministic phrasebook phrases', async () => {
    const agent = new LanguageGeniusAgent();

    const result = await agent.translate('Translate "thank you" to Spanish.');

    expect(result.model).toBe('language-tools');
    expect(result.response).toContain('TranslationTool');
    expect(result.response).toContain('gracias');
  });

  it('rewrites with tone and readability checks', async () => {
    const agent = new LanguageGeniusAgent();

    const result = await agent.rewrite('Make this more professional: "send the file today"');

    expect(result.response).toContain('ToneRewriteTool');
    expect(result.response).toContain('ReadabilityTool');
    expect(result.response).toContain('professional');
  });

  it('analyzes rhetoric without manipulative framing', async () => {
    const agent = new LanguageGeniusAgent();

    const result = await agent.rhetoric('Make this persuasive because the data shows a cost benefit.');

    expect(result.response).toContain('RhetoricAnalyzerTool');
    expect(result.response).toContain('logos');
    expect(result.response).toContain('non-coercive');
  });

  it('builds speech outlines', async () => {
    const agent = new LanguageGeniusAgent();

    const result = await agent.speech('Outline a 5 minute speech about local history.');

    expect(result.response).toContain('SpeechOutlineTool');
    expect(result.response).toContain('Hook');
    expect(result.response).toContain('Three points');
  });

  it('diagnoses grammar and readability', async () => {
    const agent = new LanguageGeniusAgent();

    const result = await agent.ask('Proofread: your welcome');

    expect(result.response).toContain('GrammarDiagnosticTool');
    expect(result.response).toContain('you are welcome');
  });
});
