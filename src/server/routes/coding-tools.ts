import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/errorHandler';
import { CodingToolsService } from '../../core/coding/integrations/CodingToolsService';
import { CodingToolError } from '../../core/coding/integrations/CodingToolConfig';

const files = z.array(z.string().min(1).max(1000)).min(1).max(64);
const documentation = z.object({ library: z.string().min(1).max(160), query: z.string().min(1).max(1500) });
export function createCodingToolsRouter(service?: CodingToolsService): Router {
  const router = Router();
  const get = () => { if (!service) throw new CodingToolError('Coding integrations are unavailable.', 503); return service; };
  router.get('/status', (_req, res) => res.json(get().status()));
  const post = (route: string, schema: z.ZodTypeAny, work: (owner: string, input: any, signal: AbortSignal) => Promise<any>) => {
    router.post(route, asyncHandler(async (req, res) => {
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) throw new CodingToolError('Invalid coding tool request.', 400, 'CODING_TOOL_INPUT');
      const controller = new AbortController();
      const cancel = () => { if (!res.writableEnded) controller.abort(); };
      res.once('close', cancel);
      try { res.json(await work(req.user!.userId, parsed.data, controller.signal)); }
      finally { res.removeListener('close', cancel); }
    }));
  };
  post('/references', z.object({ files, file: z.string().min(1).max(1000), symbol: z.string().min(1).max(200) }),
    (owner, input, signal) => get().references(owner, input, signal));
  post('/structural', z.object({ files, pattern: z.string().min(1).max(4000), language: z.string().min(1).max(40), rewrite: z.string().max(8000).optional() }),
    (owner, input, signal) => get().structural(owner, input, signal));
  post('/documentation', documentation, (owner, input, signal) => get().documentation(owner, input.query, input.library, signal));
  post('/propose', z.object({ files: z.array(z.string().min(1).max(1000)).max(12), newFiles: z.array(z.string().min(1).max(1000)).max(8).optional(), message: z.string().min(1).max(8000), automaticContext: z.boolean().optional(), propertyTests: z.boolean().optional(), documentation: documentation.optional() }),
    (owner, input, signal) => get().propose(owner, input, signal));
  return router;
}
