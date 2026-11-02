/**
 * Bot Profiles API Routes (CRK-P02-T05)
 *
 * Exposes admin and developer endpoints for profile management, version audits,
 * rollback operations, and context resolution (§949-962).
 */

import { Router, Request, Response } from 'express';
import { BotProfileRepository } from '../../core/profiles/BotProfileRepository';
import { BotProfileResolver } from '../../core/profiles/BotProfileResolver';
import { BUILTIN_PROFILES } from '../../core/profiles/DefaultBotProfile';
import { baseBotProfileSchema } from '../../types/bot-profile';

export function createBotProfileRouter(repo?: BotProfileRepository): Router {
  const router = Router();
  const repository = repo || new BotProfileRepository();

  // Seed builtin profiles if repository is fresh
  (async () => {
    const existing = await repository.listProfiles();
    if (existing.length === 0) {
      for (const profile of BUILTIN_PROFILES) {
        await repository.saveProfile(profile, 'system-seed');
      }
    }
  })().catch(() => {});

  const resolver = new BotProfileResolver(repository);

  // 1. List profiles
  router.get('/', async (_req: Request, res: Response) => {
    try {
      const profiles = await repository.listProfiles();
      res.json({ success: true, data: profiles });
    } catch (err: unknown) {
      res.status(500).json({ success: false, error: (err as Error).message });
    }
  });

  // 2. Get single profile
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const profile = await repository.getProfile(req.params.id);
      if (!profile) {
        return res.status(404).json({ success: false, error: `Profile '${req.params.id}' not found` });
      }
      res.json({ success: true, data: profile });
    } catch (err: unknown) {
      res.status(500).json({ success: false, error: (err as Error).message });
    }
  });

  // 3. Get version history
  router.get('/:id/versions', async (req: Request, res: Response) => {
    try {
      const versions = await repository.getVersionHistory(req.params.id);
      res.json({ success: true, data: versions });
    } catch (err: unknown) {
      res.status(500).json({ success: false, error: (err as Error).message });
    }
  });

  // 4. Create or update profile
  router.post('/', async (req: Request, res: Response) => {
    try {
      const author = String(req.body.author || req.headers['x-user-id'] || 'admin');
      const profileData = baseBotProfileSchema.partial().parse(req.body.profile);

      if (!profileData.id || !profileData.name) {
        return res.status(400).json({ success: false, error: "Missing required 'id' or 'name' fields" });
      }

      const saved = await repository.saveProfile(profileData as any, author);
      res.status(201).json({ success: true, data: saved });
    } catch (err: unknown) {
      res.status(400).json({ success: false, error: (err as Error).message });
    }
  });

  // 5. Rollback profile version
  router.post('/:id/rollback', async (req: Request, res: Response) => {
    try {
      const targetVersion = Number(req.body.version);
      if (!Number.isInteger(targetVersion) || targetVersion < 1) {
        return res.status(400).json({ success: false, error: 'Target version must be a positive integer' });
      }
      const author = String(req.body.author || req.headers['x-user-id'] || 'admin');
      const rolledBack = await repository.rollbackToVersion(req.params.id, targetVersion, author);
      res.json({ success: true, data: rolledBack });
    } catch (err: unknown) {
      res.status(400).json({ success: false, error: (err as Error).message });
    }
  });

  // 6. Resolve profile from context
  router.post('/resolve', async (req: Request, res: Response) => {
    try {
      const resolved = await resolver.resolve(req.body || {});
      res.json({ success: true, data: resolved });
    } catch (err: unknown) {
      res.status(500).json({ success: false, error: (err as Error).message });
    }
  });

  return router;
}
