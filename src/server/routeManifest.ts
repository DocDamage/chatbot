import { RequestHandler } from 'express';
import { auditPrivilegedRequest } from '../middleware/auth';
import { createAudioRouter } from './routes/audio';
import { createBusinessGeniusRouter } from './routes/business';
import { createChronoRouter } from './routes/chrono';
import { createCodeRouter } from './routes/code';
import { createCreativeWritingRouter } from './routes/creative';
import { createEngineeringGeniusRouter } from './routes/engineering';
import { createExportRouter } from './routes/export';
import { createFilesRouter } from './routes/files';
import { createFLStudioControlRouter } from './routes/flstudio';
import { createGameDevRouter } from './routes/gamedev';
import { createGamingRouter } from './routes/gaming';
import { createGeoCultureGeniusRouter } from './routes/geography';
import { createHealthGeniusRouter } from './routes/health';
import { createHistoryRouter } from './routes/history';
import { createKnowledgeOnlineRouter } from './routes/knowledge-online';
import { createLanguageGeniusRouter } from './routes/language';
import { createLegalCivicGeniusRouter } from './routes/legal';
import { createMarketRouter } from './routes/market';
import { createMathRouter } from './routes/math';
import { createMusicProductionGeniusRouter } from './routes/music';
import { createPhilosophyGeniusRouter } from './routes/philosophy';
import { createPlansRouter } from './routes/plans';
import { createPopCultureRouter } from './routes/pop-culture';
import { createRagQueryRouter } from './routes/rag-query';
import { createScienceRouter } from './routes/science';
import { createSecurityGeniusRouter } from './routes/security';
import { createSixSigmaRouter } from './routes/sixsigma';
import { createStoryGeniusRouter } from './routes/story';

export interface RouteManifestEntry {
  name: string;
  mount?: string;
  readiness: boolean;
  privilege?: 'admin' | 'developer';
  auditAction?: string;
}

export const routeManifest: RouteManifestEntry[] = [
  { name: 'rag-query', readiness: true },
  { name: 'code', mount: '/api/code', readiness: true, privilege: 'developer', auditAction: 'code' },
  { name: 'plans', mount: '/api/plans', readiness: false, privilege: 'developer', auditAction: 'plans' },
  { name: 'files', mount: '/api/files', readiness: false, privilege: 'developer', auditAction: 'files' },
  { name: 'audio', mount: '/api/audio', readiness: false, privilege: 'developer', auditAction: 'audio' },
  { name: 'math', readiness: true },
  { name: 'market', readiness: true },
  { name: 'gamedev', readiness: true },
  { name: 'gaming', readiness: true },
  { name: 'sixsigma', readiness: true },
  { name: 'chrono', readiness: true },
  { name: 'pop-culture', readiness: true },
  { name: 'history', readiness: true },
  { name: 'science', readiness: true },
  { name: 'music', readiness: true },
  { name: 'flstudio', readiness: true },
  { name: 'story', readiness: true },
  { name: 'creative', readiness: true },
  { name: 'legal', readiness: true },
  { name: 'health', readiness: true },
  { name: 'security', readiness: true },
  { name: 'business', readiness: true },
  { name: 'philosophy', readiness: true },
  { name: 'language', readiness: true },
  { name: 'geography', readiness: true },
  { name: 'engineering', readiness: true },
  { name: 'knowledge-online', mount: '/api/knowledge-online', readiness: true, privilege: 'developer', auditAction: 'knowledge-online' },
  { name: 'admin', mount: '/api/admin', readiness: false, privilege: 'admin', auditAction: 'admin' },
  { name: 'export', mount: '/api/export', readiness: false, privilege: 'admin', auditAction: 'export' },
];

interface RegisterRouteDeps {
  app: {
    use: (...handlers: any[]) => void;
  };
  getServices: () => any;
  workspaceRoot: string;
  adminOnly: RequestHandler[];
  developerOnly: RequestHandler[];
  requireReady: () => RequestHandler;
  mountServiceRouter: (createRouter: () => RequestHandler) => RequestHandler;
}

export function registerManifestRoutes(deps: RegisterRouteDeps): void {
  const routerFactories: Record<string, () => RequestHandler> = {
    'rag-query': () => createRagQueryRouter(deps.getServices()),
    code: () => createCodeRouter(deps.getServices()),
    plans: () => createPlansRouter(deps.workspaceRoot),
    files: () => createFilesRouter(deps.workspaceRoot),
    audio: () => createAudioRouter(deps.workspaceRoot),
    math: () => createMathRouter(deps.getServices()),
    market: () => createMarketRouter(deps.getServices()),
    gamedev: () => createGameDevRouter(deps.getServices()),
    gaming: () => createGamingRouter(deps.getServices()),
    sixsigma: () => createSixSigmaRouter(deps.getServices()),
    chrono: () => createChronoRouter(deps.getServices()),
    'pop-culture': () => createPopCultureRouter(deps.getServices()),
    history: () => createHistoryRouter(deps.getServices()),
    science: () => createScienceRouter(deps.getServices()),
    music: () => createMusicProductionGeniusRouter(deps.getServices()),
    flstudio: () => createFLStudioControlRouter(deps.getServices()),
    story: () => createStoryGeniusRouter(deps.getServices()),
    creative: () => createCreativeWritingRouter(deps.getServices()),
    legal: () => createLegalCivicGeniusRouter(deps.getServices()),
    health: () => createHealthGeniusRouter(deps.getServices()),
    security: () => createSecurityGeniusRouter(deps.getServices()),
    business: () => createBusinessGeniusRouter(deps.getServices()),
    philosophy: () => createPhilosophyGeniusRouter(deps.getServices()),
    language: () => createLanguageGeniusRouter(deps.getServices()),
    geography: () => createGeoCultureGeniusRouter(deps.getServices()),
    engineering: () => createEngineeringGeniusRouter(deps.getServices()),
    'knowledge-online': () => createKnowledgeOnlineRouter(deps.getServices()),
    admin: () => createAdminRouter(deps.getServices()),
    export: () => createExportRouter(deps.getServices()),
  };

  for (const entry of routeManifest) {
    const routeHandlers: RequestHandler[] = [];
    if (entry.readiness) routeHandlers.push(deps.requireReady());
    routeHandlers.push(deps.mountServiceRouter(routerFactories[entry.name]));

    if (entry.mount) {
      const authHandlers = entry.privilege === 'admin'
        ? deps.adminOnly
        : entry.privilege === 'developer'
          ? deps.developerOnly
          : [];
      const audit = entry.auditAction ? [auditPrivilegedRequest(entry.auditAction)] : [];
      deps.app.use(entry.mount, ...authHandlers, ...audit);
    }

    deps.app.use(...routeHandlers);
  }
}

function createAdminRouter(services: any): RequestHandler {
  const { createAdminRouter: factory } = require('./routes/admin');
  return factory(services);
}
