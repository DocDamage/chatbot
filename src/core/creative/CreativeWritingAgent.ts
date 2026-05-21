import {
  CreativeAgentResult,
  CreativeOperation,
  CreativeRequest,
  CreativeRequestInput,
  creativeRequestSchema,
} from './CreativeTypes';
import { CreativeCommandRouter } from './CreativeCommandRouter';
import { CreativeCapabilityDetector } from './CreativeCapabilityDetector';
import { CreativeQualityReviewer } from './CreativeQualityReviewer';
import { CreativeStylePolicy, CreativeStylePolicyResult } from './CreativeStylePolicy';

const boundaryPolicy = [
  'Adult fiction requires explicit mature-mode opt-in.',
  'Block illegal, exploitative, minor-involved, real-person sexual, non-consensual sexual, privacy-invasive, and self-harm enabling requests.',
  'Offer a safer rewrite path instead of bypassing boundaries.',
].join(' ');

const disallowedPatterns = [
  /\b(?:underage|minor|child|teenager|16-year-old|17-year-old|15-year-old)\b.{0,80}\b(?:sex|sexual|explicit|erotic|xxx)\b/i,
  /\b(?:sex|sexual|explicit|erotic|xxx)\b.{0,80}\b(?:underage|minor|child|teenager|16-year-old|17-year-old|15-year-old)\b/i,
  /\b(?:rape|non[-\s]?consensual sexual|sexual assault)\b/i,
  /\b(?:real person|celebrity|public figure)\b.{0,80}\b(?:sex|sexual|erotic|xxx)\b/i,
];

export class CreativeWritingAgent {
  draftScene(request: CreativeRequestInput) {
    return this.handle('draft_scene', request);
  }

  continueScene(request: CreativeRequestInput) {
    return this.handle('continue_scene', request);
  }

  revisePassage(request: CreativeRequestInput) {
    return this.handle('revise_passage', request);
  }

  outlineNovel(request: CreativeRequestInput) {
    return this.handle('outline_novel', request);
  }

  buildCharacter(request: CreativeRequestInput) {
    return this.handle('build_character', request);
  }

  buildWorld(request: CreativeRequestInput) {
    return this.handle('build_world', request);
  }

  roleplayTurn(request: CreativeRequestInput) {
    return this.handle('roleplay_turn', request);
  }

  summarizeContinuity(request: CreativeRequestInput) {
    return this.handle('summarize_continuity', request);
  }

  exportDraft(request: CreativeRequestInput) {
    return this.handle('export_draft', request);
  }

  ask(prompt: string, request: Partial<CreativeRequestInput> = {}) {
    const operation = request.operation || this.inferOperation(prompt);
    return this.handle(operation, { ...request, prompt } as CreativeRequest);
  }

  private handle(operation: CreativeOperation, rawRequest: CreativeRequestInput): CreativeAgentResult {
    const commandRoute = CreativeCommandRouter.route(rawRequest.prompt || '');
    const routedOperation = commandRoute.operation || operation;
    const request = creativeRequestSchema.parse({
      operation: routedOperation,
      ...rawRequest,
      prompt: commandRoute.handled ? commandRoute.prompt : rawRequest.prompt || 'Continue the creative project.',
      revisionOperation: commandRoute.revisionOperation || rawRequest.revisionOperation,
      roleplayAction: commandRoute.roleplayAction || rawRequest.roleplayAction,
    });
    const stylePolicy = CreativeStylePolicy.evaluate(request.prompt);
    if (!stylePolicy.allowed) {
      return this.styleRedirect(routedOperation, request, stylePolicy);
    }
    const styleSafeRequest = stylePolicy.safePrompt
      ? { ...request, prompt: stylePolicy.safePrompt }
      : request;
    const unsafe = this.findBoundaryIssue(request);
    if (unsafe) {
      return this.boundaryRedirect(routedOperation, request);
    }

    const degradedMode = request.providerCapability
      ? new CreativeCapabilityDetector().evaluate([request.providerCapability])
      : undefined;
    const baseResponse = this.renderResponse(routedOperation, styleSafeRequest, stylePolicy, degradedMode?.userMessage);
    const qualityReview = request.qualityPass
      ? new CreativeQualityReviewer().review({
          draft: baseResponse,
          prompt: request.prompt,
          genre: request.genre,
          storyBible: request.storyBible,
        })
      : undefined;
    const response = qualityReview
      ? [
          baseResponse,
          '',
          'Quality review:',
          `- overallScore: ${qualityReview.overallScore}`,
          `- strengths: ${qualityReview.strengths.join(', ') || 'none yet'}`,
          `- issues: ${qualityReview.issues.join(', ') || 'none flagged'}`,
          `- revisionPlan: ${qualityReview.revisionPlan}`,
        ].join('\n')
      : baseResponse;
    return {
      domain: 'creative_writing',
      mode: routedOperation,
      response,
      sources: ['creative-writing-agent'],
      model: 'creative-writing-deterministic-v1',
      safety: {
        rating: request.rating,
        matureMode: request.matureMode,
        boundaryPolicy,
      },
      actions: routedOperation === 'roleplay_turn'
        ? ['continue', 'ooc', 'summarize', 'branch']
        : ['revise', 'continue', 'export'],
      command: commandRoute.handled
        ? {
            roleplayAction: request.roleplayAction,
            revisionOperation: request.revisionOperation,
          }
        : undefined,
      qualityReview,
      degradedMode,
      export: routedOperation === 'export_draft'
        ? { format: 'markdown', content: response }
        : undefined,
    };
  }

  private renderResponse(
    operation: CreativeOperation,
    request: CreativeRequest,
    stylePolicy?: CreativeStylePolicyResult,
    degradedModeMessage?: string
  ): string {
    const title = this.titleFor(operation);
    const lines = [
      title,
      '',
      `Prompt: ${request.prompt}`,
      `Genre: ${request.genre || 'custom'}`,
      `Format: ${request.format || this.defaultFormat(operation)}`,
      `Rating: ${request.rating}${request.matureMode ? ' (mature mode enabled)' : ''}`,
    ];

    if (request.presetId || request.presetInstructions.length > 0) {
      lines.push('', `Preset: ${request.presetId || 'custom'}`);
      if (request.presetInstructions.length > 0) {
        lines.push(...request.presetInstructions.map(instruction => `- ${instruction}`));
      }
    }

    if (stylePolicy && (stylePolicy.safeStyle || stylePolicy.notes.length > 0)) {
      lines.push('', 'Copyright-safe style handling:');
      if (stylePolicy.safeStyle) {
        lines.push(`- safeStyle: ${stylePolicy.safeStyle}`);
      }
      lines.push(...(stylePolicy.notes || []).map(note => `- ${note}`));
    }

    if (request.config) {
      lines.push('', 'Creative controls:', ...Object.entries(request.config).map(([key, value]) => `- ${key}: ${value}`));
    }

    if (request.storyBible) {
      lines.push('', 'Continuity context:', ...this.renderRecordList(request.storyBible));
    }

    if (request.roleplay) {
      lines.push('', 'Roleplay session:', ...this.renderRecordList(request.roleplay));
      if (request.roleplay.boundaries) {
        lines.push('Boundary state:', ...this.renderRecordList(request.roleplay.boundaries));
      }
    }

    if (request.project) {
      lines.push('', 'Long-form workflow:', ...this.renderRecordList(request.project));
    }

    if (request.branch) {
      lines.push('', 'Branching:', ...this.renderRecordList(request.branch));
    }

    if (request.privacy) {
      lines.push('', 'Privacy controls:', ...this.renderRecordList(request.privacy));
    }

    if (request.promptPack) {
      lines.push('', 'Prompt pack:', ...this.renderRecordList(request.promptPack));
    }

    if (degradedModeMessage) {
      lines.push('', 'Provider capability:', degradedModeMessage);
    }

    if (request.roleplayAction || request.revisionOperation) {
      lines.push('', 'Command:', ...this.renderRecordList({
        roleplayAction: request.roleplayAction,
        revisionOperation: request.revisionOperation,
      }));
    }

    lines.push('', 'Output scaffold:');
    lines.push(this.scaffoldFor(operation, request));
    lines.push('', 'Continuity notes: Preserve established names, locations, unresolved promises, tone, and rating limits in the next turn.');
    return lines.join('\n');
  }

  private scaffoldFor(operation: CreativeOperation, request: CreativeRequest): string {
    switch (operation) {
      case 'draft_scene':
        return `Open with a concrete sensory image, establish the scene goal, complicate it, and end on a choice or reveal tied to ${request.genre || 'the selected genre'}.`;
      case 'continue_scene':
        return 'Continue from the latest beat without recapping, escalate one conflict, and preserve point of view.';
      case 'revise_passage':
        return `Apply revision pass: ${request.revisionOperation || 'line_edit'} while preserving meaning and continuity.`;
      case 'outline_novel':
        return 'Return premise, logline, act structure, chapter list, turning points, and unresolved continuity questions.';
      case 'build_character':
        return 'Return want, need, wound, contradiction, voice markers, relationships, secrets, and arc turns.';
      case 'build_world':
        return 'Return locations, factions, lore rules, cultural texture, constraints, timeline hooks, and conflict engines.';
      case 'roleplay_turn':
        return 'Respond in-character, keep out-of-character controls available, update scene state, and respect all boundaries.';
      case 'summarize_continuity':
        return 'Summarize canon facts, timeline, cast state, open threads, contradictions, and next-scene constraints.';
      case 'export_draft':
        return 'Export the current draft with title, metadata, story-bible notes, chapters, scenes, and revision history.';
      default:
        return 'Create a structured creative response.';
    }
  }

  private renderRecordList(value: Record<string, any>): string[] {
    return Object.entries(value)
      .filter(([, item]) => item !== undefined && (!Array.isArray(item) || item.length > 0))
      .map(([key, item]) => `- ${key}: ${Array.isArray(item) ? item.join(', ') : item}`);
  }

  private findBoundaryIssue(request: CreativeRequest): boolean {
    if (request.rating === 'Adult Fiction' && !request.matureMode) {
      return true;
    }
    return disallowedPatterns.some(pattern => pattern.test(request.prompt));
  }

  private boundaryRedirect(operation: CreativeOperation, request: CreativeRequest): CreativeAgentResult {
    return {
      domain: 'creative_writing',
      mode: operation,
      response: [
        'I can help rewrite this into a release-safe creative scene.',
        '',
        'Safe paths:',
        '- age-up all characters and keep the scene consensual',
        '- fade to black before explicit sexual detail',
        '- use fictional adults instead of real people',
        '- shift the request into horror, romance, tension, or aftermath without prohibited detail',
      ].join('\n'),
      sources: ['creative-writing-boundary-policy'],
      model: 'creative-writing-policy-v1',
      safety: {
        rating: request.rating,
        matureMode: request.matureMode,
        boundaryPolicy,
      },
      blocked: true,
      safeAlternatives: [
        'age-up all characters and keep the scene consensual',
        'fade to black before explicit sexual detail',
        'use fictional adults instead of real people',
        'rewrite as non-explicit tension or aftermath',
      ],
      actions: ['rewrite_safe', 'fade_to_black', 'change_rating'],
    };
  }

  private styleRedirect(
    operation: CreativeOperation,
    request: CreativeRequest,
    stylePolicy: CreativeStylePolicyResult
  ): CreativeAgentResult {
    return {
      domain: 'creative_writing',
      mode: operation,
      response: [
        'I can help rewrite this with copyright-safe style descriptors.',
        '',
        `Limitation: ${stylePolicy.reason}`,
        `Safe alternative: ${stylePolicy.safeAlternative}`,
        '',
        'Use original characters, settings, plot events, names, and prose voice.',
      ].join('\n'),
      sources: ['creative-style-policy'],
      model: 'creative-writing-style-policy-v1',
      safety: {
        rating: request.rating,
        matureMode: request.matureMode,
        boundaryPolicy,
      },
      blocked: true,
      safeAlternatives: [
        'rewrite with copyright-safe style descriptors',
        stylePolicy.safeAlternative || 'use a broad original genre descriptor',
      ],
      actions: ['rewrite_safe_style', 'change_style_reference'],
    };
  }

  private inferOperation(prompt: string): CreativeOperation {
    const text = prompt.toLowerCase();
    if (/\b(roleplay|in character|ooc|player character)\b/.test(text)) return 'roleplay_turn';
    if (/\b(revise|rewrite|line edit|copy edit|make darker|condense|expand)\b/.test(text)) return 'revise_passage';
    if (/\b(outline|beat sheet|novel|chapter list)\b/.test(text)) return 'outline_novel';
    if (/\b(character|protagonist|villain|voice)\b/.test(text)) return 'build_character';
    if (/\b(world|lore|setting|faction)\b/.test(text)) return 'build_world';
    if (/\b(summarize|continuity|recap)\b/.test(text)) return 'summarize_continuity';
    if (/\b(export|markdown|plain text|json)\b/.test(text)) return 'export_draft';
    if (/\b(continue|next beat|next scene)\b/.test(text)) return 'continue_scene';
    return 'draft_scene';
  }

  private titleFor(operation: CreativeOperation): string {
    return operation.split('_').map(part => part[0].toUpperCase() + part.slice(1)).join(' ');
  }

  private defaultFormat(operation: CreativeOperation): string {
    if (operation === 'roleplay_turn') return 'roleplay';
    if (operation === 'outline_novel') return 'outline';
    if (operation === 'export_draft') return 'markdown';
    return 'scene';
  }
}
