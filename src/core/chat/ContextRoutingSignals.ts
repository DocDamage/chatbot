/**
 * Context Routing Signals (CRK-P05-T02)
 *
 * Extracts deterministic signals from normalized requests and conversation state
 * to drive context planning without fragile inline regex heuristics.
 */

import { NormalizedChatRequest } from '../../types/chat-runtime';
import { ConversationState } from '../../types/conversation-state';
import { ChatConversationState } from './ChatRuntime';

export interface ExtractedSignals {
  isGreetingOrBrainstorm: boolean;
  isTextRewritingOrCreative: boolean;
  hasLoadedContentSufficient: boolean;
  explicitNoSearch: boolean;
  explicitSearchRequested: boolean;
  isCodingOrDebug: boolean;
  detectedLanguages: string[];
  detectedFrameworks: string[];
  isMathOrProof: boolean;
  isGeneralKnowledge: boolean;
  hasFreshnessRequirement: boolean;
  isProjectRepoWork: boolean;
  activePlanReferenced: boolean;
  confidence: number;
}

export class ContextRoutingSignals {
  public static extract(
    request: NormalizedChatRequest,
    state?: ConversationState | ChatConversationState | Record<string, unknown>
  ): ExtractedSignals {
    const rawText = request.message.trim();
    const text = rawText.toLowerCase();

    // 1. Explicit search constraints
    const explicitNoSearch =
      /\b(don't search|do not search|no search|don't google|offline only)\b/i.test(text);
    const explicitSearchRequested =
      /\b(search online|search web|google this|look up online|search the docs)\b/i.test(text);

    // 2. Greetings and brainstorming
    const isGreeting =
      /^(hi|hello|hey|good morning|good evening|good afternoon|howdy|sup)\b/i.test(text) &&
      text.split(/\s+/).length <= 4;
    const isBrainstorm =
      /\b(brainstorm|give me ideas|generate ideas|ideate|come up with names)\b/i.test(text);
    const isGreetingOrBrainstorm = isGreeting || isBrainstorm;

    // 3. Text rewriting, limerick, creative
    const isLimerickOrPoem = /\b(limerick|poem|haiku|rhyme|sonnet|story)\b/i.test(text);
    const isRewriting = /\b(rewrite this|rephrase this|fix grammar in this|proofread this)\b/i.test(text);
    const isTextRewritingOrCreative = isLimerickOrPoem || isRewriting;

    // 4. Loaded content sufficiency (e.g. "what does this attached file say?")
    const hasFiles = Boolean(request.loadedFiles && request.loadedFiles.length > 0);
    const referencesAttached =
      /\b(this file|attached file|this attachment|uploaded file|the file above)\b/i.test(text);
    const hasLoadedContentSufficient = hasFiles && referencesAttached;

    // 5. Active plan reference
    const rawState = state as any;
    const hasPlanInVariables = Boolean(
      rawState?.sessionVariables?.find((v: any) => v.key === 'active_plan') ||
      rawState?.variables?.activePlan
    );
    const activePlanReferenced =
      Boolean(request.activePlan || hasPlanInVariables) &&
      /\b(continue the plan|next step|plan progress|current task|resume plan)\b/i.test(text);

    // 6. Coding & debug detection
    const codingTerms = [
      'function', 'class', 'method', 'bug', 'error', 'exception', 'stacktrace',
      'refactor', 'compile', 'transpile', 'type error', 'lint', 'syntax', 'const', 'import'
    ];
    const hasErrorCode = /\b(ts\d{4,5}|error\s*\[\w+\]|e\d{4}|cannot find module)\b/i.test(text);
    const hasCodingKeyword = codingTerms.some(term => text.includes(term));
    const isCodingMode = request.mode === 'coding';
    const isCodingOrDebug = isCodingMode || hasErrorCode || hasCodingKeyword;

    // 7. Detected languages and frameworks
    const detectedLanguages: string[] = [];
    if (/\b(typescript|ts)\b/i.test(text)) detectedLanguages.push('typescript');
    if (/\b(javascript|js|node\.js|nodejs)\b/i.test(text)) detectedLanguages.push('javascript');
    if (/\b(python|py)\b/i.test(text)) detectedLanguages.push('python');
    if (/\b(rust|cargo)\b/i.test(text)) detectedLanguages.push('rust');
    if (/\b(c\+\+|cpp)\b/i.test(text)) detectedLanguages.push('cpp');
    if (/\b(c#|csharp|\.net)\b/i.test(text)) detectedLanguages.push('csharp');
    if (/\b(godot|gdscript)\b/i.test(text)) detectedLanguages.push('gdscript');

    const detectedFrameworks: string[] = [];
    if (/\b(react|next\.js|nextjs)\b/i.test(text)) detectedFrameworks.push('react');
    if (/\b(vite)\b/i.test(text)) detectedFrameworks.push('vite');
    if (/\b(godot)\b/i.test(text)) detectedFrameworks.push('godot');
    if (/\b(tailwind)\b/i.test(text)) detectedFrameworks.push('tailwind');

    // 8. Math or proof
    const isMathOrProof =
      /\b(derivative of|integral of|prove that|mathematical proof|eigenvalue|calculus|equation)\b/i.test(text);

    // 9. Freshness requirement
    const hasFreshnessRequirement =
      /\b(latest|current|new in|what changed in|recent version|release notes)\b/i.test(text);

    // 10. Project/repo references
    const isProjectRepoWork =
      /\b(in this repo|in this project|in our codebase|current test fails|my test fails|my repo)\b/i.test(text) ||
      hasErrorCode;

    // 11. General knowledge
    const isGeneralKnowledge =
      !isCodingOrDebug &&
      !isMathOrProof &&
      !isGreetingOrBrainstorm &&
      !isTextRewritingOrCreative &&
      /\b(what is|explain|how does|why do|who was|history of|overview of)\b/i.test(text);

    // Compute confidence
    let confidence = 0.85;
    if (isGreetingOrBrainstorm || isTextRewritingOrCreative || hasLoadedContentSufficient) {
      confidence = 0.98;
    } else if (hasErrorCode || explicitNoSearch || isMathOrProof) {
      confidence = 0.95;
    } else if (!isCodingOrDebug && !isGeneralKnowledge) {
      confidence = 0.65;
    }

    return {
      isGreetingOrBrainstorm,
      isTextRewritingOrCreative,
      hasLoadedContentSufficient,
      explicitNoSearch,
      explicitSearchRequested,
      isCodingOrDebug,
      detectedLanguages,
      detectedFrameworks,
      isMathOrProof,
      isGeneralKnowledge,
      hasFreshnessRequirement,
      isProjectRepoWork,
      activePlanReferenced,
      confidence,
    };
  }
}
