import fs from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { Database } from '../database/Database';
import { CampaignRepository } from './CampaignRepository';
import { CampaignService } from './CampaignService';
import { Campaign, characterSchema, playerView } from './CampaignTypes';
import { applyCampaignAction, rollDice } from './CampaignMechanics';
import { readCampfireExport, readDmtArchive, readDmtWorld } from './CampaignImports';

const sheet = (name = 'Hero', extra = {}) => characterSchema.parse({ id: randomUUID(), name, maxHp: 12, hp: 12, ...extra });
const seed = (): Campaign => ({ id: randomUUID(), ownerId: 'alice', name: 'Test coast', edition: '5e-2024', premise: 'A seaside village.', scene: '', recap: '', dmNotes: '', characters: [], entities: [], combat: null, history: [], log: [], version: 0, updatedAt: new Date().toISOString(), imports: [] });

describe('campaign mechanics from Open Game Master and Campfire', () => {
  it('uses authoritative kept dice and rejects executable or oversized expressions', () => {
    const values = [3, 18];
    expect(rollDice('2d20kh1+4', () => values.shift()!).total).toBe(22);
    expect(rollDice('d20', () => 7).total).toBe(7);
    for (const invalid of ['1d6;process.exit()', '1000d6', '1d999', '1d6+NaN']) expect(() => rollDice(invalid)).toThrow();
  });
  it('resolves a critical hit with doubled dice, one modifier, and temporary HP absorption', () => {
    const state = seed(), hero = sheet('Hero', { attackBonus: 3, damage: '1d6+2' }), goblin = sheet('Goblin', { kind: 'npc', ac: 30, tempHp: 3 });
    state.characters = [hero, goblin];
    const values = [20, 4, 5];
    const result = applyCampaignAction(state, { type: 'attack', actorId: hero.id, targetId: goblin.id, advantage: 'none' }, () => values.shift()!);
    expect(result).toContain('critical hit'); expect(result).toContain('2d6+2 = 11');
    expect(goblin.hp).toBe(4); expect(goblin.tempHp).toBe(0);
  });
  it('does not hit on a natural 1 or allow an out-of-turn attack', () => {
    const state = seed(), hero = sheet(), foe = sheet('Foe', { kind: 'npc', ac: 1 }); state.characters = [hero, foe];
    expect(applyCampaignAction(state, { type: 'attack', actorId: hero.id, targetId: foe.id, advantage: 'none' }, () => 1)).toContain('miss');
    expect(foe.hp).toBe(12); state.combat = { order: [foe.id, hero.id], turn: 0, round: 1 };
    expect(() => applyCampaignAction(state, { type: 'attack', actorId: hero.id, targetId: foe.id, advantage: 'none' })).toThrow('not this combatant');
  });
  it('sorts initiative ties deterministically and advances rounds', () => {
    const state = seed(), a = sheet('A', { initiativeMod: 2 }), b = sheet('B', { initiativeMod: 2 }); state.characters = [a, b];
    applyCampaignAction(state, { type: 'initiative' }, () => 10); expect(state.combat!.order).toEqual([a.id, b.id]);
    applyCampaignAction(state, { type: 'next-turn' }); expect(state.combat!.turn).toBe(1);
    applyCampaignAction(state, { type: 'next-turn' }); expect(state.combat!.round).toBe(2);
  });
  it('enforces slot expenditure and edition-specific rest recovery', () => {
    const state = seed(), hero = sheet('Hero', { level: 4, hp: 3, hitDiceUsed: 4, spellSlots: { '1': { max: 1, used: 0 } } }); state.characters = [hero];
    applyCampaignAction(state, { type: 'slot', characterId: hero.id, level: 1, delta: 1 });
    expect(() => applyCampaignAction(state, { type: 'slot', characterId: hero.id, level: 1, delta: 1 })).toThrow('Cannot spend');
    state.edition = '5e-2014'; applyCampaignAction(state, { type: 'rest', characterId: hero.id, kind: 'long', hitDice: 0 });
    expect(hero.hitDiceUsed).toBe(2); expect(hero.hp).toBe(12); expect(hero.spellSlots['1'].used).toBe(0);
    state.edition = '5e-2024'; applyCampaignAction(state, { type: 'rest', characterId: hero.id, kind: 'long', hitDice: 0 }); expect(hero.hitDiceUsed).toBe(0);
    hero.hp = 0; expect(() => applyCampaignAction(state, { type: 'rest', characterId: hero.id, kind: 'long', hitDice: 0 })).toThrow('0 HP');
  });
});

describe('persistent private campaigns', () => {
  let directory: string, database: Database, service: CampaignService;
  const generate = jest.fn();
  beforeEach(async () => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'chatbot-campaign-'));
    database = new Database({ type: 'sqlite', filePath: path.join(directory, 'state.db') }); await database.initialize();
    generate.mockReset().mockResolvedValue({ content: JSON.stringify({ narration: 'The innkeeper waves you inside.', scene: 'Harbour inn', recap: 'The hero arrived at the harbour inn.' }) });
    service = new CampaignService(new CampaignRepository(database), { generate, getModelName: () => 'test-model' });
  });
  afterEach(async () => {
    await database.close();
    if (!path.resolve(directory).startsWith(path.join(path.resolve(os.tmpdir()), 'chatbot-campaign-'))) throw new Error('Unsafe test cleanup');
    fs.rmSync(directory, { recursive: true, force: true });
  });
  it('preserves sheets, journal and history across repository and database restarts', async () => {
    const campaign = await service.create('alice', { name: 'Coast' });
    const hero = sheet('Mira'); await service.act(campaign.id, 'alice', { type: 'character', character: hero }, 0);
    await service.talk(campaign.id, 'alice', 'I enter the inn.', 1);
    await database.close(); database = new Database({ type: 'sqlite', filePath: path.join(directory, 'state.db') }); await database.initialize();
    const reloaded = await new CampaignRepository(database).get(campaign.id, 'alice');
    expect(reloaded.characters[0].name).toBe('Mira'); expect(reloaded.history).toHaveLength(2); expect(reloaded.scene).toBe('Harbour inn'); expect(reloaded.version).toBe(2);
  });
  it('rejects other owners and concurrent duplicate slot spends', async () => {
    const campaign = await service.create('alice', { name: 'Coast' }), hero = sheet('Mage', { spellSlots: { '1': { max: 1, used: 0 } } });
    await service.act(campaign.id, 'alice', { type: 'character', character: hero }, 0);
    await expect(service.view(campaign.id, 'bob', true)).rejects.toMatchObject({ statusCode: 404 });
    const results = await Promise.allSettled([1, 2].map(() => service.act(campaign.id, 'alice', { type: 'slot', characterId: hero.id, level: 1, delta: 1 }, 1)));
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect((await service.repository.get(campaign.id, 'alice')).characters[0].spellSlots['1'].used).toBe(1);
  });
  it('keeps DM notes, hidden records and NPC statistics out of player responses and model prompts', async () => {
    const state = seed(); state.dmNotes = 'SECRET_RED_MOON'; state.characters = [sheet('Public foe', { kind: 'npc', ac: 29 }), sheet('SECRET_HIDDEN_CREATURE', { hidden: true })];
    state.entities = [{ id: randomUUID(), name: 'Public NPC', kind: 'npc', description: 'An innkeeper.', status: 'open', dmSecret: 'SECRET_DOUBLE_AGENT', hidden: false }, { id: randomUUID(), name: 'SECRET_TRAP', kind: 'lore', description: 'Hidden.', status: 'open', dmSecret: '', hidden: true }];
    await service.repository.create(state); const view = playerView(state);
    expect(JSON.stringify(view)).not.toContain('SECRET_'); expect(view.characters[0]).not.toHaveProperty('ac');
    const result = await service.talk(state.id, 'alice', 'Who is at the inn?', 0);
    expect(JSON.stringify(generate.mock.calls)).not.toContain('SECRET_'); expect(JSON.stringify(result)).not.toContain('SECRET_');
    expect(JSON.stringify(await service.export(state.id, 'alice'))).not.toContain('SECRET_');
    expect(JSON.stringify(await service.export(state.id, 'alice', true))).toContain('SECRET_DOUBLE_AGENT');
  });
  it('rejects model attempts to supply character updates without mutating a save', async () => {
    const campaign = await service.create('alice', { name: 'Coast' });
    generate.mockResolvedValue({ content: JSON.stringify({ narration: 'You have 999 HP.', recap: '', scene: '', hp: 999 }) });
    await expect(service.talk(campaign.id, 'alice', 'Continue.', 0)).rejects.toMatchObject({ code: 'CAMPAIGN_MODEL_FORMAT' });
    expect((await service.repository.get(campaign.id, 'alice')).version).toBe(0);
  });
  it('round-trips a full save into a new campaign and keeps the edition fixed', async () => {
    const a = await service.create('alice', { name: 'Legacy', edition: '5e-2014' });
    const exported = await service.export(a.id, 'alice', true); const b = await service.import('bob', 'chatbot', exported, '5e-2024');
    expect(b.edition).toBe('5e-2014'); expect(b.id).not.toBe(a.id); expect(b.ownerId).toBe('bob');
  });
});

describe('external campaign data interoperability', () => {
  const world = { world_name: 'Imported coast', entities: { a: { id: 'a', name: 'Innkeeper', categorySlug: 'npcs', description: 'A local contact.', dmNotes: 'A secret patron.', hidden: false } } };
  it('reads the DMT world payload and format-1 archive without extracting media', () => {
    const Zip = require('adm-zip'), zip = new Zip();
    zip.addFile('manifest.json', Buffer.from(JSON.stringify({ format: 1, type: 'world', name: 'Imported coast' })));
    zip.addFile('payload.json', Buffer.from(JSON.stringify(world)));
    expect(readDmtWorld(world).entities[0]).toMatchObject({ hidden: true, dmSecret: 'A secret patron.' });
    expect(readDmtArchive(zip.toBuffer()).name).toBe('Imported coast');
    const bad = new Zip(); bad.addFile('manifest.json', Buffer.from('{"format":99,"type":"world"}')); bad.addFile('payload.json', Buffer.from('{}'));
    expect(() => readDmtArchive(bad.toBuffer())).toThrow('format 1');
  });
  it('reads Campfire quest titles and bodies and preserves private fields', () => {
    const imported = readCampfireExport({ campaign: { name: 'Coast' }, quests: [{ title: 'Missing caravan', body: 'Find its tracks.', dmSecret: 'The trader is a spy.', hidden: false, status: 'completed' }] });
    expect(imported.entities[0]).toMatchObject({ name: 'Missing caravan', description: 'Find its tracks.', dmSecret: 'The trader is a spy.', hidden: true, status: 'completed' });
  });
});
