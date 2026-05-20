import { GenericSpecialistAgent } from '../specialists/GenericSpecialistAgent';
import { ArrangementCriticTool } from '../../tools/music/ArrangementCriticTool';
import { BpmKeyDetectorTool } from '../../tools/music/BpmKeyDetectorTool';
import { ChordProgressionTool } from '../../tools/music/ChordProgressionTool';
import { DrumPatternGeneratorTool } from '../../tools/music/DrumPatternGeneratorTool';
import { GenreInfluenceGraphTool } from '../../tools/music/GenreInfluenceGraphTool';
import { LoudnessMeterTool } from '../../tools/music/LoudnessMeterTool';
import { MixChecklistTool } from '../../tools/music/MixChecklistTool';
import { SampleClearanceAdvisorTool } from '../../tools/music/SampleClearanceAdvisorTool';
import { DawWorkflowMapTool } from '../../tools/music/DawWorkflowMapTool';
import { MasteringChecklistTool } from '../../tools/music/MasteringChecklistTool';
import { MixDiagnosticTool } from '../../tools/music/MixDiagnosticTool';
import { VocalChainTool } from '../../tools/music/VocalChainTool';
import { ArrangementMapTool } from '../../tools/music/ArrangementMapTool';
import { BpmTool } from '../../tools/music/BpmTool';
import { KeyScaleTool } from '../../tools/music/KeyScaleTool';
import { LoudnessTargetTool } from '../../tools/music/LoudnessTargetTool';
import { MusicWorkflowRouter } from './MusicWorkflowRouter';
import { MusicCopyrightGuardrails } from './MusicCopyrightGuardrails';
import { SongStructureCoach } from './SongStructureCoach';
import { SunoGeniusAgent } from './suno/SunoGeniusAgent';
import { FLStudioGeniusAgent } from './flstudio/FLStudioGeniusAgent';
import { ProToolsGeniusAgent } from './protools/ProToolsGeniusAgent';
import { LogicProGeniusAgent } from './logic/LogicProGeniusAgent';

const profile = {
  id: "music",
  label: "Music Production Genius",
  guardrails: [
    "No full copyrighted lyrics or commercial-song transcriptions.",
    "No sound-exactly-like artist cloning instructions.",
    "Prefer style analysis, original alternatives, and production-safe guidance."
  ],
  workflows: [
    "Classify theory, beat, mix, sample, genre, or arrangement intent.",
    "Retrieve local music/pop-culture/game-dev knowledge.",
    "Use deterministic music tools when possible.",
    "Return original, actionable production guidance."
  ],
  tools: [
    "SunoGeniusAgent",
    "FLStudioGeniusAgent",
    "ProToolsGeniusAgent",
    "LogicProGeniusAgent",
    "DawWorkflowTranslator",
    "BpmKeyDetectorTool",
    "ChordProgressionTool",
    "DrumPatternGeneratorTool",
    "ArrangementCriticTool",
    "MixChecklistTool",
    "LoudnessMeterTool",
    "SampleClearanceAdvisorTool",
    "GenreInfluenceGraphTool"
  ],
  defaultSources: [
    "knowledge-base-public/music/overview.md"
  ]
};

export interface MusicProductionGeniusConfig {
  documentStore?: any;
  suno?: SunoGeniusAgent;
  flStudio?: FLStudioGeniusAgent;
  proTools?: ProToolsGeniusAgent;
  logic?: LogicProGeniusAgent;
}

export class MusicProductionGeniusAgent extends GenericSpecialistAgent {
  private arrangementCritic = new ArrangementCriticTool();
  private bpmKeyDetector = new BpmKeyDetectorTool();
  private chordProgression = new ChordProgressionTool();
  private drumPattern = new DrumPatternGeneratorTool();
  private genreInfluence = new GenreInfluenceGraphTool();
  private loudnessMeter = new LoudnessMeterTool();
  private mixChecklist = new MixChecklistTool();
  private sampleClearance = new SampleClearanceAdvisorTool();
  private dawWorkflowMap = new DawWorkflowMapTool();
  private mixDiagnostic = new MixDiagnosticTool();
  private masteringChecklist = new MasteringChecklistTool();
  private vocalChain = new VocalChainTool();
  private arrangementMap = new ArrangementMapTool();
  private bpmTool = new BpmTool();
  private keyScaleTool = new KeyScaleTool();
  private loudnessTargetTool = new LoudnessTargetTool();
  private workflowRouter = new MusicWorkflowRouter();
  private copyrightGuardrails = new MusicCopyrightGuardrails();
  private songStructureCoach = new SongStructureCoach();
  private suno: SunoGeniusAgent;
  private flStudio: FLStudioGeniusAgent;
  private proTools: ProToolsGeniusAgent;
  private logic: LogicProGeniusAgent;

  constructor(configOrDocumentStore?: MusicProductionGeniusConfig | any) {
    const config = configOrDocumentStore && ('documentStore' in configOrDocumentStore || 'suno' in configOrDocumentStore)
      ? configOrDocumentStore as MusicProductionGeniusConfig
      : { documentStore: configOrDocumentStore };
    super(profile, config.documentStore);
    this.suno = config.suno || new SunoGeniusAgent();
    this.flStudio = config.flStudio || new FLStudioGeniusAgent();
    this.proTools = config.proTools || new ProToolsGeniusAgent();
    this.logic = config.logic || new LogicProGeniusAgent();
  }

  override async ask(query: string, mode = 'ask') {
    const toolResponse = this.toolFirstResponse(query, mode);
    if (toolResponse) {
      return toolResponse;
    }

    return super.ask(query, mode);
  }

  beat(query: string) {
    return this.ask(query, 'beat');
  }

  mix(query: string) {
    return this.ask(query, 'mix');
  }

  theory(query: string) {
    return this.ask(query, 'theory');
  }

  genreTimeline(query: string) {
    return this.ask(query, 'genre-timeline');
  }

  arrangementReview(query: string) {
    return this.ask(query, 'arrangement-review');
  }

  sunoPrompt(query: string) {
    return this.suno.ask(query);
  }

  flStudioWorkflow(query: string) {
    return this.flStudio.ask(query);
  }

  proToolsWorkflow(query: string) {
    return this.proTools.ask(query);
  }

  logicWorkflow(query: string) {
    return this.logic.ask(query);
  }

  master(query: string) {
    return this.ask(query, 'master');
  }

  arrangement(query: string) {
    return this.ask(query, 'arrangement');
  }

  dawTranslate(query: string) {
    return this.ask(query, 'daw-translate');
  }

  private toolFirstResponse(query: string, mode: string) {
    const text = query.toLowerCase();
    const route = this.workflowRouter.route(query, mode);
    const guardrail = this.copyrightGuardrails.check(query);
    if (!guardrail.allow) {
      return this.formatToolResult(query, mode, [guardrail]);
    }

    if (route.intent === 'suno') return this.suno.ask(query);
    if (route.intent === 'fl_studio') return this.flStudio.ask(query);
    if (route.intent === 'pro_tools') return this.proTools.ask(query);
    if (route.intent === 'logic') return this.logic.ask(query);

    const detected = this.bpmKeyDetector.run({ query });
    const bpm = detected.bpm || Number(text.match(/\b(\d{2,3})\b/)?.[1]) || 140;

    if (route.intent === 'daw_translate' || mode === 'daw-translate') {
      return this.formatToolResult(query, mode, [
        this.dawWorkflowMap.run({ query }),
        { tool: 'MusicWorkflowRouter', ...route }
      ]);
    }

    if (mode === 'master' || route.intent === 'master') {
      return this.formatToolResult(query, mode, [
        this.masteringChecklist.run({ query }),
        this.loudnessMeter.run({}),
        this.loudnessTargetTool.run({ query })
      ]);
    }

    if (mode === 'mix' || /\b(mix|muddy|lufs|loud|low-mid|clipping|slap|knock|bang|boxy|harsh|buried|sitting|expensive|eating the kick|low end cooked)\b/.test(text)) {
      return this.formatToolResult(query, mode, [
        this.mixDiagnostic.run({ query, problem: query }),
        this.mixChecklist.run({ issue: query }),
        this.loudnessMeter.run({}),
        this.vocalChain.run({ query })
      ]);
    }

    if (mode === 'beat' || /\b(808|drum|beat|trap|pattern|bpm|bounce|pocket|cook up|lay down drums)\b/.test(text)) {
      return this.formatToolResult(query, mode, [
        this.bpmTool.run({ query }),
        this.drumPattern.run({
          bpm,
          style: text.includes('trap') || text.includes('808') ? 'trap' : 'hip-hop'
        }),
        detected
      ]);
    }

    if (mode === 'theory' || /\b(chord|progression|key|scale|harmony)\b/.test(text)) {
      return this.formatToolResult(query, mode, [
        this.keyScaleTool.run({ query }),
        this.chordProgression.run({
          key: detected.key || 'A minor',
          mood: text.includes('bright') ? 'bright' : 'dark'
        }),
        detected
      ]);
    }

    if (mode === 'genre-timeline' || /\b(neptunes|genre|influence|style|early 2000s)\b/.test(text)) {
      return this.formatToolResult(query, mode, [
        this.genreInfluence.run({ reference: query }),
        this.arrangementCritic.run({ goal: query })
      ]);
    }

    if (mode === 'arrangement' || mode === 'arrangement-review' || /\b(arrangement|loop|section|boring|repetitive)\b/.test(text)) {
      return this.formatToolResult(query, mode, [
        this.arrangementMap.run({ query }),
        this.songStructureCoach.plan(query),
        this.arrangementCritic.run({ goal: query })
      ]);
    }

    if (/\b(sample|clearance|clear|copyright|royalty)\b/.test(text)) {
      return this.formatToolResult(query, mode, [
        this.sampleClearance.run({ useCase: query })
      ]);
    }

    return undefined;
  }

  private formatToolResult(query: string, mode: string, results: Array<Record<string, any>>) {
    return {
      domain: 'music',
      mode,
      response: [
        `Music Production Genius (${mode})`,
        '',
        `Request: ${query}`,
        '',
        'Tool results:',
        ...results.map(result => this.stringifyResult(result)),
        '',
        'Guardrails:',
        ...profile.guardrails.map(rule => `- ${rule}`)
      ].join('\n'),
      sources: ['deterministic music tools'],
      guardrails: profile.guardrails,
      tools: results.map(result => String(result.tool || 'music-tool')),
      model: 'music-tools'
    };
  }

  private stringifyResult(result: Record<string, any>) {
    return `- ${result.tool}: ${JSON.stringify(result, null, 2)}`;
  }
}
