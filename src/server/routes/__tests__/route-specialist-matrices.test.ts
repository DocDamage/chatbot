import express from 'express';
import request from 'supertest';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { Database } from '../../../core/database/Database';
import { createHealthGeniusRouter } from '../health';
import { createStoryGeniusRouter } from '../story';
import { createBusinessGeniusRouter } from '../business';
import { createEngineeringGeniusRouter } from '../engineering';
import { createLanguageGeniusRouter } from '../language';
import { createSecurityGeniusRouter } from '../security';
import { createGeoCultureGeniusRouter } from '../geography';
import { createLegalCivicGeniusRouter } from '../legal';
import { createPhilosophyGeniusRouter } from '../philosophy';
import { createSixSigmaRouter } from '../sixsigma';
import { createGameDevRouter } from '../gamedev';
import { createMathRouter } from '../math';
import { createScienceRouter } from '../science';
import { createMarketRouter } from '../market';
import { createHistoryRouter } from '../history';
import { createPopCultureRouter } from '../pop-culture';
import { createEducationRouter } from '../education';
import { createResearchRouter } from '../research';
import { createPlansRouter } from '../plans';
import { createToolCatalogRouter } from '../toolCatalog';
import { createCreativeWritingRouter } from '../creative';
import { createChronoRouter } from '../chrono';
import { createRagQueryRouter } from '../rag-query';
import { createAgentOperationsRouter } from '../agent-operations';

describe('HTTP route decision matrices - Specialist thin routes', () => {
  let db: Database;

  beforeAll(async () => {
    db = new Database({ type: 'sqlite', filePath: ':memory:' });
    await db.initialize();
  });

  afterAll(async () => {
    await db.close();
  });

  describe('HealthGeniusRouter', () => {
    it('handles all action endpoints with custom agent and fallback params', async () => {
      const mockAgent = {
        ask: jest.fn().mockResolvedValue({ answer: 'ask ok' }),
        anatomy: jest.fn().mockResolvedValue({ answer: 'anatomy ok' }),
        fitness: jest.fn().mockResolvedValue({ answer: 'fitness ok' }),
        nutrition: jest.fn().mockResolvedValue({ answer: 'nutrition ok' }),
        redFlags: jest.fn().mockResolvedValue({ answer: 'redFlags ok' }),
        medication: jest.fn().mockResolvedValue({ answer: 'medication ok' }),
      };

      const app = express();
      app.use(express.json());
      app.use(createHealthGeniusRouter({ healthGeniusAgent: mockAgent }));

      await request(app).post('/api/health/ask').send({ query: 'headache' }).expect(200, { answer: 'ask ok' });
      expect(mockAgent.ask).toHaveBeenCalledWith('headache');

      await request(app).post('/api/health/anatomy').send({ message: 'biceps' }).expect(200, { answer: 'anatomy ok' });
      expect(mockAgent.anatomy).toHaveBeenCalledWith('biceps');

      await request(app).post('/api/health/fitness').send({}).expect(200, { answer: 'fitness ok' });
      expect(mockAgent.fitness).toHaveBeenCalledWith('');

      await request(app).post('/api/health/nutrition').send({ query: 'protein' }).expect(200, { answer: 'nutrition ok' });
      expect(mockAgent.nutrition).toHaveBeenCalledWith('protein');

      await request(app).post('/api/health/red-flags').send({ message: 'chest pain' }).expect(200, { answer: 'redFlags ok' });
      expect(mockAgent.redFlags).toHaveBeenCalledWith('chest pain');

      await request(app).post('/api/health/medication').send({ query: 'ibuprofen' }).expect(200, { answer: 'medication ok' });
      expect(mockAgent.medication).toHaveBeenCalledWith('ibuprofen');
    });

    it('instantiates default HealthGeniusAgent when no agent is provided', async () => {
      const app = express();
      app.use(express.json());
      app.use(createHealthGeniusRouter({}));

      const res = await request(app).post('/api/health/ask').send({ query: 'general health' }).expect(200);
      expect(res.body).toHaveProperty('response');
    });
  });

  describe('StoryGeniusRouter', () => {
    it('handles all action endpoints with custom agent and fallback params', async () => {
      const mockAgent = {
        ask: jest.fn().mockResolvedValue({ res: 'ask ok' }),
        plot: jest.fn().mockResolvedValue({ res: 'plot ok' }),
        character: jest.fn().mockResolvedValue({ res: 'character ok' }),
        worldbuild: jest.fn().mockResolvedValue({ res: 'worldbuild ok' }),
        dialogue: jest.fn().mockResolvedValue({ res: 'dialogue ok' }),
        continuity: jest.fn().mockResolvedValue({ res: 'continuity ok' }),
      };

      const app = express();
      app.use(express.json());
      app.use(createStoryGeniusRouter({ storyGeniusAgent: mockAgent }));

      await request(app).post('/api/story/ask').send({ query: 'story arc' }).expect(200, { res: 'ask ok' });
      expect(mockAgent.ask).toHaveBeenCalledWith('story arc');

      await request(app).post('/api/story/plot').send({ message: 'plot twist' }).expect(200, { res: 'plot ok' });
      expect(mockAgent.plot).toHaveBeenCalledWith('plot twist');

      await request(app).post('/api/story/character').send({}).expect(200, { res: 'character ok' });
      expect(mockAgent.character).toHaveBeenCalledWith('');

      await request(app).post('/api/story/worldbuild').send({ query: 'magic system' }).expect(200, { res: 'worldbuild ok' });
      expect(mockAgent.worldbuild).toHaveBeenCalledWith('magic system');

      await request(app).post('/api/story/dialogue').send({ message: 'snarky tone' }).expect(200, { res: 'dialogue ok' });
      expect(mockAgent.dialogue).toHaveBeenCalledWith('snarky tone');

      await request(app).post('/api/story/continuity').send({ query: 'check timeline' }).expect(200, { res: 'continuity ok' });
      expect(mockAgent.continuity).toHaveBeenCalledWith('check timeline');
    });

    it('instantiates default StoryGeniusAgent when no agent is provided', async () => {
      const app = express();
      app.use(express.json());
      app.use(createStoryGeniusRouter({}));

      const res = await request(app).post('/api/story/ask').send({ query: 'hero journey' }).expect(200);
      expect(res.body).toHaveProperty('response');
    });
  });

  describe('BusinessGeniusRouter', () => {
    it('handles all business endpoints with mock and fallback params', async () => {
      const mockAgent = {
        ask: jest.fn().mockResolvedValue({ res: 'ask' }),
        plan: jest.fn().mockResolvedValue({ res: 'plan' }),
        pricing: jest.fn().mockResolvedValue({ res: 'pricing' }),
        market: jest.fn().mockResolvedValue({ res: 'market' }),
        unitEconomics: jest.fn().mockResolvedValue({ res: 'unit-economics' }),
      };

      const app = express();
      app.use(express.json());
      app.use(createBusinessGeniusRouter({ businessGeniusAgent: mockAgent }));

      await request(app).post('/api/business/ask').send({ query: 'q' }).expect(200);
      await request(app).post('/api/business/plan').send({ message: 'm' }).expect(200);
      await request(app).post('/api/business/pricing').send({}).expect(200);
      await request(app).post('/api/business/market').send({ query: 'mkt' }).expect(200);
      await request(app).post('/api/business/unit-economics').send({ query: 'cac' }).expect(200);

      expect(mockAgent.ask).toHaveBeenCalledWith('q');
      expect(mockAgent.plan).toHaveBeenCalledWith('m');
      expect(mockAgent.pricing).toHaveBeenCalledWith('');
      expect(mockAgent.market).toHaveBeenCalledWith('mkt');
      expect(mockAgent.unitEconomics).toHaveBeenCalledWith('cac');
    });

    it('instantiates default agent when not provided', async () => {
      const app = express();
      app.use(express.json());
      app.use(createBusinessGeniusRouter(undefined));
      const res = await request(app).post('/api/business/ask').send({ query: 'saas' }).expect(200);
      expect(res.body).toHaveProperty('response');
    });
  });

  describe('EngineeringGeniusRouter', () => {
    it('handles all engineering endpoints with mock and fallback params', async () => {
      const mockAgent = {
        ask: jest.fn().mockResolvedValue({ res: 'ask' }),
        electronics: jest.fn().mockResolvedValue({ res: 'electronics' }),
        robotics: jest.fn().mockResolvedValue({ res: 'robotics' }),
        mechanical: jest.fn().mockResolvedValue({ res: 'mechanical' }),
        bom: jest.fn().mockResolvedValue({ res: 'bom' }),
      };

      const app = express();
      app.use(express.json());
      app.use(createEngineeringGeniusRouter({ engineeringGeniusAgent: mockAgent }));

      await request(app).post('/api/engineering/ask').send({ query: 'q' }).expect(200);
      await request(app).post('/api/engineering/electronics').send({ message: 'm' }).expect(200);
      await request(app).post('/api/engineering/robotics').send({}).expect(200);
      await request(app).post('/api/engineering/mechanical').send({ query: 'p' }).expect(200);
      await request(app).post('/api/engineering/bom').send({ message: 'r' }).expect(200);

      expect(mockAgent.ask).toHaveBeenCalledWith('q');
      expect(mockAgent.electronics).toHaveBeenCalledWith('m');
      expect(mockAgent.robotics).toHaveBeenCalledWith('');
      expect(mockAgent.mechanical).toHaveBeenCalledWith('p');
      expect(mockAgent.bom).toHaveBeenCalledWith('r');
    });

    it('instantiates default agent when not provided', async () => {
      const app = express();
      app.use(express.json());
      app.use(createEngineeringGeniusRouter(undefined));
      const res = await request(app).post('/api/engineering/ask').send({ query: 'microservices' }).expect(200);
      expect(res.body).toHaveProperty('response');
    });
  });

  describe('LanguageGeniusRouter', () => {
    it('handles all language endpoints with mock and fallback params', async () => {
      const mockAgent = {
        ask: jest.fn().mockResolvedValue({ res: 'ask' }),
        translate: jest.fn().mockResolvedValue({ res: 'trans' }),
        rewrite: jest.fn().mockResolvedValue({ res: 'rewrite' }),
        rhetoric: jest.fn().mockResolvedValue({ res: 'rhetoric' }),
        speech: jest.fn().mockResolvedValue({ res: 'speech' }),
      };

      const app = express();
      app.use(express.json());
      app.use(createLanguageGeniusRouter({ languageGeniusAgent: mockAgent }));

      await request(app).post('/api/language/ask').send({ query: 'q' }).expect(200);
      await request(app).post('/api/language/translate').send({ message: 'm' }).expect(200);
      await request(app).post('/api/language/rewrite').send({}).expect(200);
      await request(app).post('/api/language/rhetoric').send({ query: 'i' }).expect(200);
      await request(app).post('/api/language/speech').send({ message: 'g' }).expect(200);

      expect(mockAgent.ask).toHaveBeenCalledWith('q');
      expect(mockAgent.translate).toHaveBeenCalledWith('m');
      expect(mockAgent.rewrite).toHaveBeenCalledWith('');
      expect(mockAgent.rhetoric).toHaveBeenCalledWith('i');
      expect(mockAgent.speech).toHaveBeenCalledWith('g');
    });

    it('instantiates default agent when not provided', async () => {
      const app = express();
      app.use(express.json());
      app.use(createLanguageGeniusRouter(undefined));
      const res = await request(app).post('/api/language/ask').send({ query: 'syntax' }).expect(200);
      expect(res.body).toHaveProperty('response');
    });
  });

  describe('SecurityGeniusRouter', () => {
    it('handles all security endpoints with mock and fallback params', async () => {
      const mockAgent = {
        ask: jest.fn().mockResolvedValue({ res: 'ask' }),
        reviewCode: jest.fn().mockResolvedValue({ res: 'code' }),
        threatModel: jest.fn().mockResolvedValue({ res: 'threat' }),
        privacy: jest.fn().mockResolvedValue({ res: 'priv' }),
        dependencies: jest.fn().mockResolvedValue({ res: 'deps' }),
      };

      const app = express();
      app.use(express.json());
      app.use(createSecurityGeniusRouter({ securityGeniusAgent: mockAgent }));

      await request(app).post('/api/security/ask').send({ query: 'q' }).expect(200);
      await request(app).post('/api/security/review-code').send({ message: 'm' }).expect(200);
      await request(app).post('/api/security/threat-model').send({}).expect(200);
      await request(app).post('/api/security/privacy').send({ query: 'r' }).expect(200);
      await request(app).post('/api/security/dependencies').send({ message: 'i' }).expect(200);

      expect(mockAgent.ask).toHaveBeenCalledWith('q');
      expect(mockAgent.reviewCode).toHaveBeenCalledWith('m');
      expect(mockAgent.threatModel).toHaveBeenCalledWith('');
      expect(mockAgent.privacy).toHaveBeenCalledWith('r');
      expect(mockAgent.dependencies).toHaveBeenCalledWith('i');
    });

    it('instantiates default agent when not provided', async () => {
      const app = express();
      app.use(express.json());
      app.use(createSecurityGeniusRouter(undefined));
      const res = await request(app).post('/api/security/ask').send({ query: 'tls 1.3' }).expect(200);
      expect(res.body).toHaveProperty('response');
    });
  });

  describe('GeoCultureGeniusRouter', () => {
    it('handles all geography endpoints with mock and fallback params', async () => {
      const mockAgent = {
        ask: jest.fn().mockResolvedValue({ res: 'ask' }),
        country: jest.fn().mockResolvedValue({ res: 'country' }),
        culture: jest.fn().mockResolvedValue({ res: 'culture' }),
        mapContext: jest.fn().mockResolvedValue({ res: 'map' }),
      };

      const app = express();
      app.use(express.json());
      app.use(createGeoCultureGeniusRouter({ geoCultureGeniusAgent: mockAgent }));

      await request(app).post('/api/geography/ask').send({ query: 'q' }).expect(200);
      await request(app).post('/api/geography/country').send({ message: 'm' }).expect(200);
      await request(app).post('/api/geography/culture').send({}).expect(200);
      await request(app).post('/api/geography/map-context').send({ query: 'l' }).expect(200);

      expect(mockAgent.ask).toHaveBeenCalledWith('q');
      expect(mockAgent.country).toHaveBeenCalledWith('m');
      expect(mockAgent.culture).toHaveBeenCalledWith('');
      expect(mockAgent.mapContext).toHaveBeenCalledWith('l');
    });

    it('instantiates default agent when not provided', async () => {
      const app = express();
      app.use(express.json());
      app.use(createGeoCultureGeniusRouter(undefined));
      const res = await request(app).post('/api/geography/ask').send({ query: 'tokyo' }).expect(200);
      expect(res.body).toHaveProperty('response');
    });
  });

  describe('LegalCivicGeniusRouter', () => {
    it('handles all legal endpoints with mock and fallback params', async () => {
      const mockAgent = {
        ask: jest.fn().mockResolvedValue({ res: 'ask' }),
        contract: jest.fn().mockResolvedValue({ res: 'cr' }),
        risk: jest.fn().mockResolvedValue({ res: 'risk' }),
        civic: jest.fn().mockResolvedValue({ res: 'civic' }),
      };

      const app = express();
      app.use(express.json());
      app.use(createLegalCivicGeniusRouter({ legalCivicGeniusAgent: mockAgent }));

      await request(app).post('/api/legal/ask').send({ query: 'q' }).expect(200);
      await request(app).post('/api/legal/contract').send({ message: 'm' }).expect(200);
      await request(app).post('/api/legal/risk').send({}).expect(200);
      await request(app).post('/api/legal/civic').send({ query: 'r' }).expect(200);

      expect(mockAgent.ask).toHaveBeenCalledWith('q');
      expect(mockAgent.contract).toHaveBeenCalledWith('m');
      expect(mockAgent.risk).toHaveBeenCalledWith('');
      expect(mockAgent.civic).toHaveBeenCalledWith('r');
    });

    it('instantiates default agent when not provided', async () => {
      const app = express();
      app.use(express.json());
      app.use(createLegalCivicGeniusRouter(undefined));
      const res = await request(app).post('/api/legal/ask').send({ query: 'nda' }).expect(200);
      expect(res.body).toHaveProperty('response');
    });
  });

  describe('PhilosophyGeniusRouter', () => {
    it('handles all philosophy endpoints with mock and fallback params', async () => {
      const mockAgent = {
        ask: jest.fn().mockResolvedValue({ res: 'ask' }),
        argument: jest.fn().mockResolvedValue({ res: 'arg' }),
        debate: jest.fn().mockResolvedValue({ res: 'deb' }),
        ethics: jest.fn().mockResolvedValue({ res: 'eth' }),
      };

      const app = express();
      app.use(express.json());
      app.use(createPhilosophyGeniusRouter({ philosophyGeniusAgent: mockAgent }));

      await request(app).post('/api/philosophy/ask').send({ query: 'q' }).expect(200);
      await request(app).post('/api/philosophy/argument').send({ message: 'm' }).expect(200);
      await request(app).post('/api/philosophy/debate').send({}).expect(200);
      await request(app).post('/api/philosophy/ethics').send({ query: 'l' }).expect(200);

      expect(mockAgent.ask).toHaveBeenCalledWith('q');
      expect(mockAgent.argument).toHaveBeenCalledWith('m');
      expect(mockAgent.debate).toHaveBeenCalledWith('');
      expect(mockAgent.ethics).toHaveBeenCalledWith('l');
    });

    it('instantiates default agent when not provided', async () => {
      const app = express();
      app.use(express.json());
      app.use(createPhilosophyGeniusRouter(undefined));
      const res = await request(app).post('/api/philosophy/ask').send({ query: 'utilitarianism' }).expect(200);
      expect(res.body).toHaveProperty('response');
    });
  });

  describe('SixSigmaRouter', () => {
    it('handles all sixsigma endpoints with mock and fallback params', async () => {
      const mockAgent = {
        ask: jest.fn().mockResolvedValue({ res: 'ask' }),
        calculate: jest.fn().mockResolvedValue({ res: 'calc' }),
        project: jest.fn().mockResolvedValue({ res: 'proj' }),
        certification: jest.fn().mockResolvedValue({ res: 'cert' }),
        simulate: jest.fn().mockResolvedValue({ res: 'sim' }),
        export: jest.fn().mockResolvedValue({ res: 'exp' }),
      };

      const app = express();
      app.use(express.json());
      app.use(createSixSigmaRouter({ sixSigmaBlackBeltAgent: mockAgent }));

      await request(app).post('/api/sixsigma/ask').send({ query: 'q' }).expect(200);
      await request(app).post('/api/sixsigma/calculate').send({ message: 'm' }).expect(200);
      await request(app).post('/api/sixsigma/project').send({}).expect(200);
      await request(app).post('/api/sixsigma/certification').send({ query: 'f' }).expect(200);
      await request(app).post('/api/sixsigma/simulate').send({ message: 's' }).expect(200);
      await request(app).post('/api/sixsigma/export').send({ message: 'e' }).expect(200);

      expect(mockAgent.ask).toHaveBeenCalledWith('q');
      expect(mockAgent.calculate).toHaveBeenCalledWith('m');
      expect(mockAgent.project).toHaveBeenCalledWith('');
      expect(mockAgent.certification).toHaveBeenCalledWith('f');
      expect(mockAgent.simulate).toHaveBeenCalledWith('s');
      expect(mockAgent.export).toHaveBeenCalledWith('e');
    });
  });

  describe('Other Specialist Routes (gamedev, math, science, market, history, pop-culture, education, research)', () => {
    it('handles gamedev endpoints', async () => {
      const mockAgent = {
        answer: jest.fn().mockResolvedValue({ res: 'ans' }),
        prototype: jest.fn().mockResolvedValue({ res: 'proto' }),
        balance: jest.fn().mockResolvedValue({ res: 'bal' }),
        review: jest.fn().mockResolvedValue({ res: 'rev' }),
      };
      const app = express();
      app.use(express.json());
      app.use(createGameDevRouter({ gameDevGeniusAgent: mockAgent }));

      await request(app).post('/api/gamedev/design').send({ query: 'q' }).expect(200);
      await request(app).post('/api/gamedev/prototype').send({ message: 'm' }).expect(200);
      await request(app).post('/api/gamedev/balance').send({}).expect(200);
      await request(app).post('/api/gamedev/review').send({ query: 'rev' }).expect(200);

      expect(mockAgent.answer).toHaveBeenCalledWith('q');
      expect(mockAgent.prototype).toHaveBeenCalledWith('m');
      expect(mockAgent.balance).toHaveBeenCalledWith('');
      expect(mockAgent.review).toHaveBeenCalledWith('rev');
    });

    it('handles math endpoints', async () => {
      const mockAgent = {
        solve: jest.fn().mockResolvedValue({ res: 'solve' }),
        verifyQuery: jest.fn().mockResolvedValue({ res: 'verifiedQuery' }),
        verify: jest.fn().mockResolvedValue({ res: 'verified' }),
      };
      const app = express();
      app.use(express.json());
      app.use(createMathRouter({ mathGeniusAgent: mockAgent }));

      await request(app).post('/api/math/ask').send({ query: '2+2' }).expect(200);
      await request(app).post('/api/math/solve').send({ message: 'x^2=4' }).expect(200);
      await request(app).post('/api/math/verify').send({ query: 'x=2' }).expect(200);

      expect(mockAgent.solve).toHaveBeenCalledWith('2+2');
      expect(mockAgent.solve).toHaveBeenCalledWith('x^2=4');
      expect(mockAgent.verifyQuery).toHaveBeenCalledWith('x=2');

      const mockAgentNoVerifyQuery = {
        solve: jest.fn().mockResolvedValue({ res: 'solve' }),
        verify: jest.fn().mockResolvedValue({ res: 'verified' }),
      };
      const app2 = express();
      app2.use(express.json());
      app2.use(createMathRouter({ mathGeniusAgent: mockAgentNoVerifyQuery }));
      await request(app2).post('/api/math/verify').send({ answer: { content: '4' } }).expect(200);
      expect(mockAgentNoVerifyQuery.verify).toHaveBeenCalledWith({ content: '4' });
    });

    it('handles science endpoints', async () => {
      const mockAgent = {
        ask: jest.fn().mockResolvedValue({ res: 'ask' }),
        invention: jest.fn().mockResolvedValue({ res: 'inv' }),
        timeline: jest.fn().mockResolvedValue({ res: 'tl' }),
        papers: jest.fn().mockResolvedValue({ res: 'p' }),
        patents: jest.fn().mockResolvedValue({ res: 'pat' }),
      };
      const app = express();
      app.use(express.json());
      app.use(createScienceRouter({ scienceInventionGeniusAgent: mockAgent }));

      await request(app).post('/api/science/ask').send({ query: 'photosynthesis' }).expect(200);
      await request(app).post('/api/science/invention').send({ query: 'optics' }).expect(200);
      await request(app).post('/api/science/timeline').send({ query: 'relativity' }).expect(200);
      await request(app).post('/api/science/papers').send({ query: 'quantum' }).expect(200);
      await request(app).post('/api/science/patents').send({ query: 'laser' }).expect(200);

      expect(mockAgent.ask).toHaveBeenCalledWith('photosynthesis');
      expect(mockAgent.invention).toHaveBeenCalledWith('optics');
      expect(mockAgent.timeline).toHaveBeenCalledWith('relativity');
      expect(mockAgent.papers).toHaveBeenCalledWith('quantum');
      expect(mockAgent.patents).toHaveBeenCalledWith('laser');
    });

    it('handles market endpoints', async () => {
      const mockAgent = {
        analyze: jest.fn().mockResolvedValue({ res: 'ana' }),
        backtest: jest.fn().mockResolvedValue({ res: 'bt' }),
        filing: jest.fn().mockResolvedValue({ res: 'file' }),
        macro: jest.fn().mockResolvedValue({ res: 'macro' }),
      };
      const app = express();
      app.use(express.json());
      app.use(createMarketRouter({ marketGeniusAgent: mockAgent }));

      await request(app).post('/api/market/analyze').send({ query: 'tam' }).expect(200);
      await request(app).post('/api/market/backtest').send({ message: 'strat' }).expect(200);
      await request(app).post('/api/market/filing').send({ query: '10k' }).expect(200);
      await request(app).post('/api/market/macro').send({}).expect(200);
      expect(mockAgent.analyze).toHaveBeenCalledWith('tam');
      expect(mockAgent.backtest).toHaveBeenCalledWith('strat');
      expect(mockAgent.filing).toHaveBeenCalledWith('10k');
      expect(mockAgent.macro).toHaveBeenCalled();
    });

    it('handles history endpoints', async () => {
      const mockAgent = {
        ask: jest.fn().mockResolvedValue({ res: 'ask' }),
        timeline: jest.fn().mockResolvedValue({ res: 'tl' }),
        compare: jest.fn().mockResolvedValue({ res: 'comp' }),
        primarySources: jest.fn().mockResolvedValue({ res: 'sources' }),
      };
      const app = express();
      app.use(express.json());
      app.use(createHistoryRouter({ historyGeniusAgent: mockAgent }));

      await request(app).post('/api/history/ask').send({ query: 'rome' }).expect(200);
      await request(app).post('/api/history/timeline').send({ query: '1945' }).expect(200);
      await request(app).post('/api/history/compare').send({ query: 'rome vs greece' }).expect(200);
      await request(app).post('/api/history/primary-sources').send({ query: 'magna carta' }).expect(200);
      expect(mockAgent.ask).toHaveBeenCalledWith('rome');
      expect(mockAgent.timeline).toHaveBeenCalledWith('1945');
      expect(mockAgent.compare).toHaveBeenCalledWith('rome vs greece');
      expect(mockAgent.primarySources).toHaveBeenCalledWith('magna carta');
    });

    it('handles pop-culture endpoints', async () => {
      const mockAgent = {
        ask: jest.fn().mockResolvedValue({ res: 'ask' }),
        timeline: jest.fn().mockResolvedValue({ res: 'tl' }),
        franchise: jest.fn().mockResolvedValue({ res: 'fran' }),
        compare: jest.fn().mockResolvedValue({ res: 'comp' }),
      };
      const app = express();
      app.use(express.json());
      app.use(createPopCultureRouter({ popCultureGeniusAgent: mockAgent }));

      await request(app).post('/api/pop-culture/ask').send({ query: 'oscars' }).expect(200);
      await request(app).post('/api/pop-culture/timeline').send({ query: '90s' }).expect(200);
      await request(app).post('/api/pop-culture/franchise').send({ query: 'mcu' }).expect(200);
      await request(app).post('/api/pop-culture/compare').send({ query: 'star wars vs trek' }).expect(200);
      expect(mockAgent.ask).toHaveBeenCalledWith('oscars');
      expect(mockAgent.timeline).toHaveBeenCalledWith('90s');
      expect(mockAgent.franchise).toHaveBeenCalledWith('mcu');
      expect(mockAgent.compare).toHaveBeenCalledWith('star wars vs trek');
    });

    it('handles education endpoints', async () => {
      const app = express();
      app.use(express.json());
      app.use(createEducationRouter({ database: db }));

      await request(app).get('/api/education/sources').expect(200);
      await request(app).get('/api/education/stats').expect(200);
      await request(app).post('/api/education/plans').send({ title: 'Math 101', goal: 'Learn Algebra' }).expect(200);
      await request(app).post('/api/education/plans').send({ title: '' }).expect(400);
    });

    it('handles research endpoints', async () => {
      const mockPyScrappy = {
        getStatus: jest.fn().mockResolvedValue({ available: true }),
        scrapeUrl: jest.fn().mockResolvedValue({ success: true, text: 'scraped' }),
      };
      const app = express();
      app.use(express.json());
      app.use(createResearchRouter({ pyScrappyService: mockPyScrappy }));

      await request(app).get('/api/research/status').expect(200);
      await request(app).post('/api/research/scrape').send({ url: 'https://example.com' }).expect(200);
      expect(mockPyScrappy.scrapeUrl).toHaveBeenCalledWith('https://example.com', {});
    });

    it('handles plans and toolCatalog endpoints', async () => {
      const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'chatbot-plans-route-'));
      const plansApp = express();
      plansApp.use(express.json());
      plansApp.use(createPlansRouter(workspaceRoot));

      try {
        const plansRes = await request(plansApp).get('/api/plans').expect(200);
        expect(plansRes.body).toHaveProperty('plans');

        const postPlan = await request(plansApp).post('/api/plans').send({ userRequest: 'build feature' }).expect(200);
        expect(postPlan.body).toHaveProperty('planId');

        await request(plansApp).post('/api/plans').send({}).expect(400);
      } finally {
        await fs.rm(workspaceRoot, { recursive: true, force: true });
      }

      const catalogApp = express();
      catalogApp.use(express.json());
      catalogApp.use(createToolCatalogRouter({ database: db }));
      const catRes = await request(catalogApp).get('/api/tool-catalog').expect(200);
      expect(catRes.body).toHaveProperty('tools');
      await request(catalogApp).get('/api/tool-catalog/stats').expect(200);
    });

    it('handles creative writing, chrono, and rag-query routers', async () => {
      const mockCreative = {
        draftScene: jest.fn().mockResolvedValue({ text: 'draft' }),
        continueScene: jest.fn().mockResolvedValue({ text: 'cont' }),
        revisePassage: jest.fn().mockResolvedValue({ text: 'rev' }),
        outlineNovel: jest.fn().mockResolvedValue({ text: 'out' }),
        buildCharacter: jest.fn().mockResolvedValue({ text: 'char' }),
        buildWorld: jest.fn().mockResolvedValue({ text: 'world' }),
        roleplayTurn: jest.fn().mockResolvedValue({ text: 'rp' }),
        summarizeContinuity: jest.fn().mockResolvedValue({ text: 'sum' }),
        exportDraft: jest.fn().mockResolvedValue({ text: 'exp' }),
      };

      const creativeApp = express();
      creativeApp.use(express.json());
      creativeApp.use(createCreativeWritingRouter({ creativeWritingAgent: mockCreative }));
      await request(creativeApp).post('/api/creative/draft-scene').send({ prompt: 'Once upon a time' }).expect(200);
      await request(creativeApp).post('/api/creative/continue-scene').send({ prompt: 'Next day' }).expect(200);
      await request(creativeApp).post('/api/creative/revise').send({ prompt: 'Fix prose' }).expect(200);

      const chronoApp = express();
      chronoApp.use(express.json());
      chronoApp.use(createChronoRouter({
        chronoKnowledgeEngine: {
          ask: jest.fn().mockResolvedValue({ answer: 'time answer' })
        }
      }));
      const chronoRes = await request(chronoApp).post('/api/chrono/ask').send({ query: '1969' }).expect(200);
      expect(chronoRes.body).toHaveProperty('answer', 'time answer');

      const ragApp = express();
      ragApp.use(express.json());
      ragApp.use(createRagQueryRouter({
        ragService: {
          processQuery: jest.fn().mockResolvedValue({ answer: 'rag ans', sources: [], retrievedChunks: [{ text: 'chunk 1', embedding: [0.1] }] })
        }
      }));
      const ragRes = await request(ragApp).post('/api/rag/query').send({ query: 'search text' }).expect(200);
      expect(ragRes.body).toHaveProperty('answer', 'rag ans');
      expect(ragRes.body.retrievedChunks[0]).not.toHaveProperty('embedding');

      const ragResWithEmbeddings = await request(ragApp).post('/api/rag/query').send({ query: 'search text', includeEmbeddings: true }).expect(200);
      expect(ragResWithEmbeddings.body.retrievedChunks[0]).toHaveProperty('embedding');

      await request(ragApp).post('/api/rag/query').send({ query: '' }).expect(400);

      const uninitRagApp = express();
      uninitRagApp.use(express.json());
      uninitRagApp.use(createRagQueryRouter({}));
      await request(uninitRagApp).post('/api/rag/query').send({ query: 'test' }).expect(503);

      // Test agent-operations router
      const opsApp = express();
      opsApp.use(express.json());
      opsApp.use(createAgentOperationsRouter());
      const opsRes = await request(opsApp).get('/api/agent-operations/summary').expect(200);
      expect(opsRes.body).toHaveProperty('activeSessionCount');
    });
  });
});
