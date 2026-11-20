import { randomUUID } from 'crypto';
import { z } from 'zod/v3';
import { CampaignEntity } from './CampaignTypes';
import { AppError } from '../../utils/errors';

const portableRecord = z.object({ name: z.string().min(1).max(150), description: z.string().max(6000).optional(), dmNotes: z.string().max(6000).optional(), dmSecret: z.string().max(6000).optional(), hidden: z.boolean().optional(), categorySlug: z.string().max(100).optional() }).passthrough();
const object = z.record(z.unknown());

/** Reads the published data contract. No upstream Dart code is incorporated. */
export function readDmtWorld(input: unknown) {
  const raw = object.parse(input);
  const world = z.object({ worldName: z.string().min(1).max(150), entities: z.record(portableRecord).default({}) }).passthrough().parse({ ...raw, worldName: raw.world_name ?? raw.worldName });
  if (Object.keys(world.entities).length > 300) throw new AppError('Import at most 300 world records at a time.', 400);
  const entities: CampaignEntity[] = Object.values(world.entities).map(e => ({
    id: randomUUID(), kind: /quest/i.test(e.categorySlug || '') ? 'quest' : /location/i.test(e.categorySlug || '') ? 'location' : /npc|monster|character/i.test(e.categorySlug || '') ? 'npc' : 'lore',
    name: e.name, description: e.description || '', dmSecret: e.dmNotes || e.dmSecret || '', hidden: true, status: 'open',
  }));
  return { name: world.worldName, entities, notice: 'Imported Dungeon Master Tool world text and DM notes. Records are hidden until revealed. Character rules, media, map geometry, mind-map layout and combat saves were not converted.' };
}

export function readDmtArchive(buffer: Buffer) {
  if (buffer.length > 10 * 1024 * 1024) throw new AppError('The archive exceeds 10 MB. Export a smaller world archive.', 400);
  try {
    const Zip = require('adm-zip');
    const zip = new Zip(buffer), entries = zip.getEntries();
    if (entries.length > 2000) throw new Error('Too many archive entries');
    const read = (name: string) => {
      const found = entries.filter((e: { entryName: string }) => e.entryName === name);
      if (found.length !== 1 || found[0].header.size > 2 * 1024 * 1024) throw new Error(`Invalid ${name}`);
      return JSON.parse(found[0].getData().toString('utf8'));
    };
    const manifest = object.parse(read('manifest.json'));
    if (manifest.format !== 1 || manifest.type !== 'world') throw new Error('Only format 1 world archives are supported');
    // No archive entry is extracted to disk; embedded media paths are never followed.
    return readDmtWorld(read('payload.json'));
  } catch (e) { throw new AppError(`Cannot import this DMT archive: ${e instanceof Error ? e.message : 'invalid archive'}`, 400); }
}

/** Campfire's portable JSON export; preserve secrets as secrets and default imports to hidden. */
export function readCampfireExport(input: unknown) {
  const cfRecord = z.object({ name: z.string().max(150).optional(), title: z.string().max(150).optional(), body: z.string().max(6000).default(''), dmSecret: z.string().max(6000).default(''), hidden: z.boolean().optional(), status: z.string().max(50).optional(), role: z.string().max(120).optional(), disposition: z.string().max(40).optional() }).passthrough().refine(e => Boolean(e.name || e.title), 'A record needs a name or title');
  const data = z.object({ campaign: z.object({ name: z.string().min(1).max(150) }).passthrough(), npcs: z.array(cfRecord).max(100).default([]), quests: z.array(cfRecord).max(100).default([]), locations: z.array(cfRecord).max(100).default([]) }).passthrough().parse(input);
  const entities: CampaignEntity[] = (['npcs', 'quests', 'locations'] as const).flatMap(group => data[group].map(e => ({
    id: randomUUID(), kind: group === 'npcs' ? 'npc' as const : group === 'quests' ? 'quest' as const : 'location' as const,
    name: e.name || e.title!, description: [e.role, e.disposition, e.body].filter(Boolean).join('\n'), dmSecret: e.dmSecret, hidden: true, status: e.status === 'completed' ? 'completed' as const : e.status === 'active' ? 'active' as const : 'open' as const,
  })));
  return { name: data.campaign.name, entities, notice: 'Imported Campfire NPCs, quests and locations. Records are hidden until revealed. Characters, attachments, memberships and encounters require their original application.' };
}
