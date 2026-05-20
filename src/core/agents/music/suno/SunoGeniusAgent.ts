import { MusicCopyrightGuardrails } from '../MusicCopyrightGuardrails';
import { SunoHookTool } from '../../../tools/music/SunoHookTool';
import { SunoPromptBuilder } from './SunoPromptBuilder';
import { SunoRevisionCoach } from './SunoRevisionCoach';
import { SunoRightsAdvisor } from './SunoRightsAdvisor';
import { SunoSongStructurePlanner } from './SunoSongStructurePlanner';
import { SunoStyleTagAdvisor } from './SunoStyleTagAdvisor';

export class SunoGeniusAgent {
  private promptBuilder = new SunoPromptBuilder();
  private styleAdvisor = new SunoStyleTagAdvisor();
  private structurePlanner = new SunoSongStructurePlanner();
  private revisionCoach = new SunoRevisionCoach();
  private rightsAdvisor = new SunoRightsAdvisor();
  private guardrails = new MusicCopyrightGuardrails();
  private hookTool = new SunoHookTool();

  ask(query: string) {
    const guardrail = this.guardrails.check(query);
    const prompt = this.promptBuilder.build(query);
    const style = this.styleAdvisor.advise(query);
    const structure = this.structurePlanner.plan(query);
    const revision = this.revisionCoach.revise(query);
    const rights = this.rightsAdvisor.advise(query);
    const hook = this.hookTool.run({ query });

    return {
      domain: 'music',
      mode: 'suno',
      response: [
        'Suno Genius',
        '',
        `Request: ${query}`,
        '',
        'Prompt:',
        prompt.prompt,
        '',
        'Structure:',
        ...structure.structure.map(section => `- ${section}`),
        '',
        'Style tags:',
        `- ${style.styleTags.join(', ')}`,
        '',
        'Hook direction:',
        `- ${hook.hookDirection}`,
        '',
        'Revision prompt:',
        revision.revisionPrompt,
        '',
        'Avoid:',
        ...prompt.avoid.map(item => `- ${item}`),
        '',
        `Rights/copyright note: ${rights.rightsNote}`
      ].join('\n'),
      sources: ['knowledge-base-public/music/suno'],
      guardrails: [...guardrail.guidance, ...rights.guardrails],
      tools: ['SunoPromptTool', 'SunoStyleBlendTool', 'SunoStructureTool', 'SunoRevisionTool', 'SunoRightsGuardrailTool'],
      model: 'suno-tools'
    };
  }
}
