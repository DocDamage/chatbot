import { GenericSpecialistAgent } from '../specialists/GenericSpecialistAgent';
import { CharacterArcTool } from '../../tools/story/CharacterArcTool';
import { ContinuityCheckerTool } from '../../tools/story/ContinuityCheckerTool';
import { DialogueToneTool } from '../../tools/story/DialogueToneTool';
import { GenreTropeAnalyzerTool } from '../../tools/story/GenreTropeAnalyzerTool';
import { LoreBibleTool } from '../../tools/story/LoreBibleTool';
import { ScenePacingTool } from '../../tools/story/ScenePacingTool';
import { StoryStructureTool } from '../../tools/story/StoryStructureTool';

const profile = {
  id: "story",
  label: "Story / Worldbuilding Genius",
  guardrails: [
    "Keep continuity explicit.",
    "Separate inspiration from copied copyrighted expression.",
    "Preserve user-owned lore as source of truth."
  ],
  workflows: [
    "Classify plot, character, worldbuilding, dialogue, or continuity intent.",
    "Retrieve project lore and chrono/pop-culture context.",
    "Return a structured creative artifact plus continuity notes."
  ],
  tools: [
    "StoryStructureTool",
    "CharacterArcTool",
    "DialogueToneTool",
    "LoreBibleTool",
    "ContinuityCheckerTool",
    "ScenePacingTool",
    "GenreTropeAnalyzerTool"
  ],
  defaultSources: [
    "knowledge-base-public/story/overview.md"
  ]
};

export class StoryGeniusAgent extends GenericSpecialistAgent {
  private storyStructure = new StoryStructureTool();
  private characterArc = new CharacterArcTool();
  private dialogueTone = new DialogueToneTool();
  private loreBible = new LoreBibleTool();
  private continuityChecker = new ContinuityCheckerTool();
  private scenePacing = new ScenePacingTool();
  private tropeAnalyzer = new GenreTropeAnalyzerTool();

  constructor(documentStore?: any) {
    super(profile, documentStore);
  }

  override async ask(query: string, mode = 'ask') {
    const toolResponse = this.toolFirstResponse(query, mode);
    if (toolResponse) {
      return toolResponse;
    }

    return super.ask(query, mode);
  }

  plot(query: string) {
    return this.ask(query, 'plot');
  }

  character(query: string) {
    return this.ask(query, 'character');
  }

  worldbuild(query: string) {
    return this.ask(query, 'worldbuild');
  }

  dialogue(query: string) {
    return this.ask(query, 'dialogue');
  }

  continuity(query: string) {
    return this.ask(query, 'continuity');
  }

  private toolFirstResponse(query: string, mode: string) {
    const text = query.toLowerCase();
    const results: Array<Record<string, any>> = [];

    if (mode === 'plot' || /\b(plot|act|structure|outline|chapter|arc)\b/.test(text)) {
      results.push(this.storyStructure.run({ query, genre: this.detectGenre(text) }));
      results.push(this.scenePacing.run({ sceneType: 'plot' }));
    }

    if (mode === 'character' || /\b(character|villain|hero|protagonist|antagonist|npc|boss)\b/.test(text)) {
      results.push(this.characterArc.run({ role: this.detectRole(text), want: 'power or safety', need: 'truth or connection' }));
    }

    if (mode === 'worldbuild' || /\b(worldbuild|worldbuilding|lore|faction|city|kingdom|culture|setting)\b/.test(text)) {
      results.push(this.loreBible.run({ query }));
      results.push(this.tropeAnalyzer.run({ genre: this.detectGenre(text) }));
    }

    if (mode === 'dialogue' || /\b(dialogue|voice|tone|banter|conversation|line)\b/.test(text)) {
      results.push(this.dialogueTone.run({ tone: text.includes('funny') ? 'funny' : 'tense' }));
      results.push(this.scenePacing.run({ sceneType: 'dialogue' }));
    }

    if (mode === 'continuity' || /\b(continuity|contradiction|canon|timeline|inconsistent|lore bible)\b/.test(text)) {
      results.push(this.continuityChecker.run({ query, scene: query, facts: [] }));
    }

    if (results.length === 0) {
      return undefined;
    }

    return this.formatToolResult(query, mode, results);
  }

  private formatToolResult(query: string, mode: string, results: Array<Record<string, any>>) {
    return {
      domain: 'story',
      mode,
      response: [
        `Story / Worldbuilding Genius (${mode})`,
        '',
        `Request: ${query}`,
        '',
        'Tool results:',
        ...results.map(result => `- ${result.tool}: ${JSON.stringify(result, null, 2)}`),
        '',
        'Guardrails:',
        ...profile.guardrails.map(rule => `- ${rule}`)
      ].join('\n'),
      sources: ['deterministic story tools'],
      guardrails: profile.guardrails,
      tools: results.map(result => String(result.tool || 'story-tool')),
      model: 'story-tools'
    };
  }

  private detectGenre(text: string) {
    if (text.includes('cyber') || text.includes('neon')) return 'cyberpunk';
    if (text.includes('fantasy') || text.includes('kingdom')) return 'fantasy';
    if (text.includes('horror')) return 'horror';
    if (text.includes('sci-fi') || text.includes('space')) return 'science fiction';
    return 'adventure';
  }

  private detectRole(text: string) {
    if (text.includes('villain') || text.includes('antagonist')) return 'antagonist';
    if (text.includes('boss')) return 'boss character';
    if (text.includes('npc')) return 'supporting NPC';
    return 'protagonist';
  }
}
