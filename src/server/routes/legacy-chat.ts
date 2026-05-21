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
      const result = await services.codingAgent.handle({
        message,
        runVerification: false,
        context: request ? buildChatContextBundle(request) : undefined,
      });
      return { ...result, nlu };
    }

    if (mode === 'math' && services.mathGeniusAgent) return { ...(await services.mathGeniusAgent.solve(message)), nlu };
    if (mode === 'market' && services.marketGeniusAgent) return { ...(await services.marketGeniusAgent.analyze(message)), nlu };
    if (mode === 'gamedev' && services.gameDevGeniusAgent) return { ...(await services.gameDevGeniusAgent.answer(message)), nlu };
    if (mode === 'gaming' && services.gamingGeniusAgent) return { ...(await services.gamingGeniusAgent.ask(message)), nlu };

    if (mode === 'pop_culture' || mode === 'history' || mode === 'science') {
      const localAnswer = await new LocalKnowledgeAnswerer(services.ragDocumentStore).answer(message, mode);
      if (localAnswer && (localAnswer.sources.length > 0 || /\b(?:\d{1,5}\s*(?:bc|bce)|1[0-9]{3}|20[0-2]\d)\b/i.test(message))) {
        return { ...localAnswer, nlu };
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
    if (genericAgents[mode]) return { ...(await genericAgents[mode].ask(message)), nlu };

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

      const services = deps.getServices();
      if (!mode || mode === 'ask') {
        const localResponse = await new LocalKnowledgeAnswerer(services?.ragDocumentStore).answer(sanitizedMessage, 'ask');
        if (localResponse) return sendAndPersist(localResponse);
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

function inferChatSpecialistMode(message: string, mode?: string): ChatSpecialistMode | undefined {
  if (mode && specialistModes.has(mode)) return mode as ChatSpecialistMode;

  const text = message.toLowerCase();
  if (/\b(knowledge os|knowledge system|local database|database status|how many chunks|how many sources|knowledge graph|graph centrality|private memory|local wiki)\b/.test(text)) return 'knowledge_os';
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
