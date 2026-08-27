import { RequestHandler } from 'express';
import { ChatRequest } from '../../core/orchestrator/Orchestrator';
import { ConversationManager } from '../../core/conversation/ConversationManager';
import { LocalKnowledgeAnswerer } from '../../core/knowledge/LocalKnowledgeAnswerer';
import { KnowledgeOsChatAgent } from '../../core/knowledge-os/KnowledgeOsChatAgent';
import { PlanDocumentService } from '../../core/planning/PlanDocumentService';
import { CreativeWritingAgent } from '../../core/creative/CreativeWritingAgent';
import { detectUserIntent, requiresSwitchForIntent } from '../../core/modes/ModePolicy';
import { HumanLanguageRoute, HumanLanguageRouter } from '../../core/nlu/HumanLanguageRouter';
import { asyncHandler } from '../../middleware/errorHandler';
import { rateLimiter } from '../../middleware/rateLimiter';
import { sanitizeInput, validateChatRequest } from '../../middleware/validator';
import { ChatRequestDto, buildChatContextBundle } from '../../types/chat';
import { enrichChatRequestWithPlan } from '../chatRequest';
import { CodingAuthorization } from '../../core/coding/authorization/CodingAuthorization';
import { WikipediaSource } from '../../core/knowledge/WikipediaSource';
import { KnowledgeResult } from '../../core/knowledge/KnowledgeSource';
import { ConversationalTaskOrchestrator } from '../../core/tasks/ConversationalTaskOrchestrator';

type ChatSpecialistMode =
  | 'coding'
  | 'math'
  | 'gaming'
  | 'market'
  | 'gamedev'
  | 'pop_culture'
  | 'history'
  | 'science'
  | 'music'
  | 'suno'
  | 'fl_studio'
  | 'fl_studio_control'
  | 'pro_tools'
  | 'logic'
  | 'mix_master'
  | 'story'
  | 'creative_writing'
  | 'roleplay'
  | 'legal'
  | 'health'
  | 'security'
  | 'business'
  | 'philosophy'
  | 'language'
  | 'geography'
  | 'engineering'
  | 'knowledge_os';

const MONTH_PATTERN = '(?:January|February|March|April|May|June|July|August|September|October|November|December)';

function normalizeReferenceLine(line: string): string {
  return line
    .replace(/^(?:rowspan|colspan|scope)="[^"]*"\s*\|\s*/i, '')
    .replace(/^\*\s*/, '')
    .trim();
}

function extractDatedReleaseFacts(content: string, limit: number): string[] {
  const releasedSection = content.match(/==\s*Released albums\s*==([\s\S]*?)(?=\n==|$)/i)?.[1];
  if (!releasedSection) return [];

  const allLines = releasedSection
    .split(/\r?\n/)
    .map(normalizeReferenceLine)
    .filter(Boolean);
  const hasLabelColumn = allLines.slice(0, 8).some(line => /^Label$/i.test(line));
  const lines = allLines.filter(line => !/^(?:Release Date|Artist|Album|Notes|Label)$/i.test(line));
  const datePattern = new RegExp(`^${MONTH_PATTERN}(?:\\s+\\d{1,2})?$`, 'i');
  const records: Array<{ date: string; artist: string; album: string; notes: string[] }> = [];
  let date = '';

  for (let index = 0; index < lines.length;) {
    const line = lines[index];
    if (datePattern.test(line)) {
      date = line;
      index += 1;
      continue;
    }
    if (!date || !lines[index + 1] || datePattern.test(lines[index + 1])) {
      index += 1;
      continue;
    }

    const artist = line;
    const album = lines[index + 1];
    index += 2;
    const notes: string[] = [];
    if (hasLabelColumn && index < lines.length && !datePattern.test(lines[index])) {
      index += 1; // Label is useful provenance but not needed in the answer fact.
    } else {
      while (index < lines.length && /^(?:Debuted|Certified)/i.test(lines[index])) {
        notes.push(lines[index]);
        index += 1;
      }
    }
    records.push({ date, artist, album, notes });
  }

  const score = (record: typeof records[number]) => {
    const notes = record.notes.join(' ');
    let value = record.notes.length;
    if (/No\.\s*1\b/i.test(notes)) value += 5;
    if (/Diamond/i.test(notes)) value += 6;
    const platinum = notes.match(/(?:Certified\s+)?(\d+)\s*x\s*Platinum/i);
    if (platinum) value += Math.min(Number(platinum[1]), 7);
    else if (/Platinum/i.test(notes)) value += 2;
    return value;
  };

  return records
    .map((record, index) => ({ record, index, score: score(record) }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, limit)
    .sort((left, right) => left.index - right.index)
    .map(({ record }) => {
      const notes = record.notes.length > 0 ? `; ${record.notes.join('; ')}` : '';
      return `- ${record.date}: ${record.artist} — ${record.album}${notes}`;
    });
}

function extractTimelineFacts(content: string, year: string, limit: number): string[] {
  const eventsSection = content.match(/==\s*Events\s*==([\s\S]*?)(?=\n==[^=]|$)/i)?.[1];
  if (!eventsSection) return [];

  const facts: string[] = [];
  let month = '';
  for (const rawLine of eventsSection.split(/\r?\n/)) {
    const heading = rawLine.match(/^===\s*([^=]+?)\s*===$/);
    if (heading) {
      month = heading[1].trim();
      continue;
    }

    const event = rawLine.match(/^\*\s*([^*].*?)\s+[–-]\s+(.+)$/);
    if (!event) continue;
    const datePart = event[1].trim();
    const description = normalizeReferenceLine(event[2]);
    const hasNamedMonth = new RegExp(`\\b${MONTH_PATTERN}\\b`, 'i').test(datePart);
    const fullDate = hasNamedMonth ? datePart : [month, datePart].filter(Boolean).join(' ');
    facts.push(`- ${fullDate}, ${year}: ${description}`);
    if (facts.length >= limit) break;
  }

  return facts;
}

function compactPublicReference(result: KnowledgeResult, query: string): string {
  const intro = result.content
    .split(/\r?\n/)
    .map(line => line.trim())
    .find(line => line.length > 30 && !line.startsWith('=='));
  const requestedYear = query.match(/\b(?:19|20)\d{2}\b/)?.[0];
  const titleMatchesYear = requestedYear && new RegExp(`\\b${requestedYear}\\b`).test(result.title);
  const factLimit = /\b(?:brief|briefly|concise|quick|short|one or two|a few)\b/i.test(query)
    ? 6
    : /\b(?:more|detailed|detail|comprehensive|in[- ]depth|thorough|as much as possible|deep dive)\b/i.test(query)
      ? 16
      : 12;
  const releaseFacts = titleMatchesYear ? extractDatedReleaseFacts(result.content, factLimit) : [];
  const timelineFacts = titleMatchesYear && requestedYear
    ? extractTimelineFacts(result.content, requestedYear, factLimit)
    : [];

  if (releaseFacts.length > 0) {
    return [
      intro,
      `Every dated release below is listed on the source page for ${requestedYear}:`,
      ...releaseFacts
    ].filter(Boolean).join('\n');
  }

  if (timelineFacts.length > 0) {
    return [
      intro,
      `Every dated event below is listed on the source page for ${requestedYear}:`,
      ...timelineFacts
    ].filter(Boolean).join('\n');
  }

  const queryTerms = query.toLowerCase().match(/[a-z0-9]{3,}/g) || [];
  const usefulLines = result.content
    .split(/\r?\n/)
    .map(normalizeReferenceLine)
    .filter(line => line.length > 25)
    .filter((line, index) => index < 12 || queryTerms.some(term => line.toLowerCase().includes(term)));
  return Array.from(new Set(usefulLines)).join('\n').slice(0, 4000);
}

const specialistModes = new Set([
  'coding',
  'math',
  'gaming',
  'market',
  'gamedev',
  'pop_culture',
  'history',
  'science',
  'music',
  'suno',
  'fl_studio',
  'fl_studio_control',
  'pro_tools',
  'logic',
  'mix_master',
  'story',
  'creative_writing',
  'roleplay',
  'legal',
  'health',
  'security',
  'business',
  'philosophy',
  'language',
  'geography',
  'engineering',
  'knowledge_os'
]);

export interface LegacyChatRouteDeps {
  getServices: () => any;
  getOrchestrator: () => any;
  waitForReady: (timeoutMs?: number) => Promise<void>;
  getConversationManager: () => ConversationManager;
  workspaceRoot?: string;
}

export function createLegacyChatHandlers(deps: LegacyChatRouteDeps): RequestHandler[] {
  const humanLanguageRouter = new HumanLanguageRouter();
  const codingAuthorization = new CodingAuthorization();
  const wikipediaSource = new WikipediaSource();
  const taskOrchestrator = new ConversationalTaskOrchestrator(deps.workspaceRoot || process.cwd());

  const useGenerativeKnowledgeFallback = () =>
    process.env.LLM_KNOWLEDGE_FALLBACK === 'true';

  const publicKnowledgeQuery = (message: string) => message
    .replace(/^\s*(?:what\s+can\s+you\s+tell\s+me\s+about|what\s+do\s+you\s+know\s+about|tell\s+me\s+about|explain|describe|give\s+me\s+(?:information|details)\s+about)\s+/i, '')
    .replace(/[?!.]+$/g, '')
    .trim() || message;

  const generateKnowledgeFallback = async (
    message: string,
    mode: string,
    nlu?: HumanLanguageRoute,
    request?: ChatRequestDto
  ) => {
    const category = mode.replace(/_/g, ' ');
    let onlineContext = '';
    let onlineSources: string[] = [];

    if (process.env.ONLINE_KNOWLEDGE_FALLBACK === 'true') {
      try {
        const normalizedQuery = publicKnowledgeQuery(message);
        const results = await wikipediaSource.search(normalizedQuery, { limit: 1, includeDetails: true });
        onlineSources = results.map(result => result.url).filter((url): url is string => !!url);
        onlineContext = results.length > 0
          ? [
              'Public reference context:',
              ...results.map(result => `Source: ${result.title}\nURL: ${result.url || 'unavailable'}\n${compactPublicReference(result, normalizedQuery)}`)
            ].join('\n\n')
          : '';
      } catch {
        // The configured local model remains available if public lookup fails.
      }
    }

    const answerInstruction = onlineContext
      ? `Answer the user's question directly using only the supplied public reference facts, with emphasis on ${category}. Every name, date, title, statistic, release, and event in the answer must appear in those facts. Omit anything else.`
      : `Answer the user's question directly using your general knowledge, with emphasis on ${category}.`;
    const categoryInstruction = [
      answerInstruction,
      'Do not return a workflow, routing explanation, or unrelated local passages.',
      'Use the supplied public reference context when present and do not contradict its dates or names.',
      'State uncertainty plainly when a claim cannot be supported.',
      onlineContext
    ].join(' ');
    const systemPrompt = [request?.systemPrompt, categoryInstruction].filter(Boolean).join('\n\n');
    const result = await deps.getOrchestrator().processRequest({
      ...(request || {}),
      message,
      sessionId: request?.sessionId || 'legacy-chat',
      mode,
      systemPrompt,
      temperature: onlineContext ? 0 : 0.2,
      // Local retrieval already produced a typed miss. Re-running broad RAG here
      // can reintroduce the same irrelevant context that caused the miss.
      useRAG: false
    });

    return {
      ...result,
      mode,
      nlu,
      sources: Array.from(new Set([...(result.sources || []), ...onlineSources]))
    };
  };

  const processSpecialistChat = async (
    message: string,
    mode: ChatSpecialistMode,
    nlu?: HumanLanguageRoute,
    request?: ChatRequestDto
  ) => {
    const services = deps.getServices();
    if (!services) return undefined;

    if (mode === 'creative_writing' || mode === 'roleplay') {
      const agent = services.creativeWritingAgent || new CreativeWritingAgent();
      const creativeRequest = {
        prompt: message,
        ...(request?.creative || {}),
        operation: mode === 'roleplay' ? 'roleplay_turn' : request?.creative?.operation,
      };
      const result = mode === 'roleplay'
        ? await agent.roleplayTurn(creativeRequest)
        : await agent.ask(message, creativeRequest);
      return { ...result, nlu };
    }

    if (mode === 'knowledge_os') {
      const result = await new KnowledgeOsChatAgent(services).ask(message);
      return { ...result, nlu };
    }

    if (mode === 'coding' && services.codingAgent) {
      const authorization = codingAuthorization.authorize({
        requestId: request?.sessionId,
        mode: request?.mode,
        action: 'inspect'
      });
      codingAuthorization.assert(authorization);
      const result = await services.codingAgent.handle({
        message,
        runVerification: false,
        context: request ? buildChatContextBundle(request) : undefined,
      });
      return { ...result, nlu, codingAuthorization: authorization };
    }

    if (mode === 'math' && services.mathGeniusAgent) return { ...(await services.mathGeniusAgent.solve(message)), nlu };
    if (mode === 'market' && services.marketGeniusAgent) return { ...(await services.marketGeniusAgent.analyze(message)), nlu };
    if (mode === 'gamedev' && services.gameDevGeniusAgent) return { ...(await services.gameDevGeniusAgent.answer(message)), nlu };
    if (mode === 'gaming' && services.gamingGeniusAgent) return { ...(await services.gamingGeniusAgent.ask(message)), nlu };

    if (mode === 'pop_culture' || mode === 'history' || mode === 'science') {
      if (mode === 'pop_culture' && isMusicIndustryHistoryQuestion(message) && services.popCultureGeniusAgent) {
        const result = await services.popCultureGeniusAgent.ask(message);
        return { response: result.response, sources: result.sources, mode, model: 'pop-culture-specialist', nlu };
      }

      const localAnswer = await new LocalKnowledgeAnswerer(services.ragDocumentStore).answer(message, mode);
      if (localAnswer && !localAnswer.knowledgeMiss && localAnswer.sources.length > 0) {
        return { ...localAnswer, nlu };
      }

      if (useGenerativeKnowledgeFallback()) {
        return generateKnowledgeFallback(message, mode, nlu, request);
      }
    }

    if (mode === 'pop_culture' && services.popCultureGeniusAgent) {
      const result = await services.popCultureGeniusAgent.ask(message);
      return { response: result.response, sources: result.sources, mode, model: 'pop-culture-specialist', nlu };
    }
    if (mode === 'history' && services.historyGeniusAgent) {
      const result = await services.historyGeniusAgent.ask(message);
      return { response: result.response, sources: result.sources, mode, model: 'history-specialist', nlu };
    }
    if (mode === 'science' && services.scienceInventionGeniusAgent) {
      const result = await services.scienceInventionGeniusAgent.ask(message);
      return { response: result.response, sources: result.sources, mode, model: 'science-specialist', nlu };
    }
    if (mode === 'fl_studio_control' && services.flStudioControlAgent) {
      return { ...(await services.flStudioControlAgent.command(message, { mode: 'dry_run' })), nlu };
    }

    if (['suno', 'fl_studio', 'pro_tools', 'logic', 'mix_master'].includes(mode)) {
      const musicAgent = services.musicProductionGeniusAgent;
      if (mode === 'suno') return { ...(await musicAgent.sunoPrompt(message)), nlu };
      if (mode === 'fl_studio') return { ...(await musicAgent.flStudioWorkflow(message)), nlu };
      if (mode === 'pro_tools') return { ...(await musicAgent.proToolsWorkflow(message)), nlu };
      if (mode === 'logic') return { ...(await musicAgent.logicWorkflow(message)), nlu };
      if (mode === 'mix_master') {
        const mixResult = services.mixGeniusAgent
          ? await services.mixGeniusAgent.plan({ query: message })
          : await musicAgent.mix(message);
        return { ...mixResult, nlu };
      }
    }

    const genericAgents: Record<string, any> = {
      music: services.musicProductionGeniusAgent,
      story: services.storyGeniusAgent,
      legal: services.legalCivicGeniusAgent,
      health: services.healthGeniusAgent,
      security: services.securityGeniusAgent,
      business: services.businessGeniusAgent,
      philosophy: services.philosophyGeniusAgent,
      language: services.languageGeniusAgent,
      geography: services.geoCultureGeniusAgent,
      engineering: services.engineeringGeniusAgent
    };

    if (mode === 'music' && services.mixGeniusAgent && nlu?.intent?.startsWith('mix.')) {
      return { ...(await services.mixGeniusAgent.plan({ query: message })), nlu };
    }
    if (genericAgents[mode]) {
      const result = await genericAgents[mode].ask(message);
      if (
        useGenerativeKnowledgeFallback()
        && result?.knowledgeMiss === true
      ) {
        return generateKnowledgeFallback(message, mode, nlu, request);
      }
      return { ...result, nlu };
    }

    return undefined;
  };

  return [
    rateLimiter.middleware(),
    validateChatRequest,
    asyncHandler(async (req, res) => {
      await deps.waitForReady(Number(process.env.REQUEST_READY_TIMEOUT_MS || 10000));

      const body = req.body as ChatRequestDto;
      const { message, sessionId, userId, mode } = body;
      const sanitizedMessage = sanitizeInput(message);
      const chatRequest = await enrichChatRequestWithPlan({ ...body, message: sanitizedMessage });
      const conversationManager = deps.getConversationManager();
      const persistMetadata = {
        userId,
        mode,
        activePlanId: chatRequest.activePlanId,
        activeFileBrowserMode: chatRequest.activeFileBrowserMode,
        loadedFiles: chatRequest.loadedFiles?.map(file => file.path),
        loadedAudio: chatRequest.loadedAudio?.map(audio => audio.path),
      };
      await conversationManager.addMessage(sessionId, 'user', sanitizedMessage, persistMetadata);

      const sendAndPersist = async (payload: any) => {
        await conversationManager.addMessage(sessionId, 'assistant', assistantContent(payload), {
          ...persistMetadata,
          model: payload?.model,
        });
        return res.json(payload);
      };

      const taskResult = taskOrchestrator.handle(sessionId, sanitizedMessage, mode);
      if (taskResult) {
        return sendAndPersist(taskResult);
      }

      const detectedIntent = detectUserIntent(sanitizedMessage);
      const switchRequirement = requiresSwitchForIntent(mode, detectedIntent);
      if (switchRequirement.required && !(mode === 'plan' && detectedIntent === 'implement')) {
        return sendAndPersist({
          response: switchRequirement.message,
          sources: [],
          mode,
          model: 'mode-policy',
          modeSwitch: {
            targetMode: switchRequirement.targetMode,
            reason: detectedIntent
          }
        });
      }

      if (mode === 'plan') {
        const plan = await new PlanDocumentService(deps.workspaceRoot || process.cwd()).createPlan({
          userRequest: sanitizedMessage,
          mode: 'plan'
        });
        return sendAndPersist({
          response: `${plan.summary}\n\nSaved plan: ${plan.planPath}\n\nSwitch to Implement when you want to turn this plan into code.`,
          sources: [plan.planPath],
          mode: 'plan',
          model: 'plan-document-service',
          planId: plan.planId,
          planPath: plan.planPath,
          savedMarkdown: true,
          suggestedNextMode: 'implement',
          actions: [
            { type: 'switch_mode', label: 'Switch to Implement', mode: 'implement' },
            { type: 'open_plan', label: 'Open Plan', planId: plan.planId }
          ]
        });
      }

      const nlu = humanLanguageRouter.route({ message: sanitizedMessage, explicitMode: mode });
      const nluRoute = nlu.confidence >= 0.75 && isRecognizedSpecialistMode(nlu.route) ? nlu.route : undefined;
      const specialistMode = nluRoute || inferChatSpecialistMode(sanitizedMessage, mode);
      const services = deps.getServices();

      if (shouldPreferLocalLibraryAnswer(sanitizedMessage, mode, nlu)) {
        const localResponse = await new LocalKnowledgeAnswerer(services?.ragDocumentStore).answer(sanitizedMessage, 'ask');
        if (localResponse && !localResponse.knowledgeMiss) {
          return sendAndPersist({ ...localResponse, nlu });
        }
      }

      if (!specialistMode && nlu.clarification) {
        return sendAndPersist({
          response: nlu.clarification,
          sources: [],
          mode: 'clarify',
          model: 'human-language-router',
          nlu
        });
      }

      if (specialistMode) {
        return sendAndPersist(await processSpecialistChat(sanitizedMessage, specialistMode, nlu, chatRequest));
      }

      if (!mode || mode === 'ask') {
        const localResponse = await new LocalKnowledgeAnswerer(services?.ragDocumentStore).answer(sanitizedMessage, 'ask');
        if (localResponse && (!localResponse.knowledgeMiss || !useGenerativeKnowledgeFallback())) {
          return sendAndPersist({ ...localResponse, nlu });
        }
        if (localResponse?.knowledgeMiss && useGenerativeKnowledgeFallback()) {
          return sendAndPersist(await generateKnowledgeFallback(sanitizedMessage, 'ask', nlu, chatRequest));
        }
      }

      const request: ChatRequest = { ...chatRequest, message: sanitizedMessage, sessionId, userId };
      return sendAndPersist(await deps.getOrchestrator().processRequest(request));
    })
  ];
}

function assistantContent(payload: any): string {
  if (!payload) return '';
  if (typeof payload.response === 'string') return payload.response;
  if (typeof payload.message === 'string') return payload.message;
  return JSON.stringify(payload);
}

function isRecognizedSpecialistMode(mode: string | undefined): mode is ChatSpecialistMode {
  return !!mode && specialistModes.has(mode);
}

function isMusicIndustryHistoryQuestion(message: string): boolean {
  return /\b(?:music industry|record industry|music business|music history|record label)\b/i.test(message)
    && /\b(?:19\d{2}|20\d{2})\b/.test(message);
}

function inferChatSpecialistMode(message: string, mode?: string): ChatSpecialistMode | undefined {
  if (mode && specialistModes.has(mode)) return mode as ChatSpecialistMode;

  const text = message.toLowerCase();
  if (/\b(knowledge os|knowledge system|local database|database status|how many chunks|how many sources|knowledge graph|graph centrality|private memory|local wiki)\b/.test(text)) return 'knowledge_os';
  if (/\b(?:music industry|record industry|music business|music history|record label)\b/.test(text)) return 'pop_culture';
  if (/\b(video game|gaming|game lore|speedrun|speedrunning|modding|rom hack|emulation|save editor|esports|competitive mechanics|game platform|steam deck|nintendo|playstation|xbox)\b/.test(text)) return 'gaming';
  if (/\b(connect to fl|control fl|fl studio control|piano roll|channel rack|mixer track|send chord|send notes|step sequence|solo the drums|turn down track|transport)\b/.test(text)) return 'fl_studio_control';
  if (/\b(suno|fl studio|pro tools|logic pro|logic|daw|loop|beat|808|bpm|mix|mastering|muddy|chord|drum pattern|sample|soundtrack|neptunes|genre timeline|vocal chain|channel rack|piano roll)\b/.test(text)) return 'music';
  if (/(pop culture|movie|film|tv|television|music|album|song|radio|comic|animation|video game|celebrity|award|franchise|meme)/.test(text)) return 'pop_culture';
  if (/\b(roleplay|in character|out of character|ooc|player character|narrator mode|scene state)\b/.test(text)) return 'roleplay';
  if (/\b(creative writing|draft scene|continue scene|revise passage|outline novel|chapter draft|short story|screenplay|fiction draft|export draft)\b/.test(text)) return 'creative_writing';
  if (/\b(plot|character|dialogue|worldbuild|worldbuilding|lore|quest|faction|scene|story|backstory)\b/.test(text)) return 'story';
  if (/\b(threat model|secure code|security|privacy|dependency audit|secrets scan|auth flow|auth|authentication|login|jwt|oauth|session|cookie|password reset|csrf|vulnerability)\b/.test(text)) return 'security';
  if (/\b(contract|clause|legal|civic|jurisdiction|statute|case law|rights|obligations|non-compete|noncompete|enforceable|indemnification|liability|lawsuit|sued)\b/.test(text)) return 'legal';
  if (/\b(symptom|anatomy|nutrition|fitness|medication|medicine|drug interaction|side effect|red flag|health|chest pain|shortness of breath|workout|calories|macros|protein|knee pain|shoulder pain|back pain)\b/.test(text)) return 'health';
  if (/\b(pricing|unit economics|business model|startup|product strategy|market research|kpi|kpis|metric|metrics|mrr|arpu|cac|ltv|payback|activation|retention)\b/.test(text)) return 'business';
  if (/\b(argument|fallacy|ethics|debate|socratic|philosophy)\b/.test(text)) return 'philosophy';
  if (/\b(translate|rewrite|tone|grammar|rhetoric|speech|readability)\b/.test(text)) return 'language';
  if (/\b(country|culture|map|geography|demographics|geopolitical|language region)\b/.test(text)) return 'geography';
  if (/\b(ohm|circuit|motor|robot|robotics|mechanical|beam load|cad|bom|electronics)\b/.test(text)) return 'engineering';
  if (/\b(history|historical|ancient|medieval|empire|war|civilization|archaeology|archaeological|dynasty|revolution|bc|bce|ce)\b/.test(text)) return 'history';
  if (/(invention|invented|discovery|science|scientific|paper|patent|technology|physics|chemistry|biology|astronomy|medicine)/.test(text)) return 'science';
  if (/(tell me (something|the biggest story|a story)|biggest story|top story|major event|what happened|what was big|what was popular|pop culture reference).{0,24}\b(19[2-9]\d|20[0-2]\d)\b/.test(text)) return 'pop_culture';
  return undefined;
}

function shouldPreferLocalLibraryAnswer(
  message: string,
  mode: string | undefined,
  nlu: HumanLanguageRoute
): boolean {
  if (mode && mode !== 'ask') {
    return false;
  }

  if (nlu.route !== 'history' || !nlu.matchedPhrases.includes('what happened in')) {
    return false;
  }

  const text = message.toLowerCase();
  if (/\b(?:\d{1,5}\s*(?:bc|bce)|1[0-9]{3}|20[0-2]\d)\b/.test(text)) {
    return false;
  }

  if (/\b(history|historical|ancient|medieval|empire|war|battle|civilization|archaeology|archaeological|dynasty|revolution|republic|kingdom)\b/.test(text)) {
    return false;
  }

  return true;
}
