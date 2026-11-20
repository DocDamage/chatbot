import { z } from 'zod/v3';

const text = (max: number) => z.string().max(max);
export const characterSchema = z.object({
  id: z.string().uuid(), name: z.string().trim().min(1).max(100),
  kind: z.enum(['player', 'npc']).default('player'), level: z.number().int().min(1).max(20).default(1),
  ac: z.number().int().min(0).max(40).default(10), maxHp: z.number().int().min(1).max(2000),
  hp: z.number().int().min(0).max(2000), tempHp: z.number().int().min(0).max(2000).default(0),
  initiativeMod: z.number().int().min(-10).max(30).default(0),
  attackBonus: z.number().int().min(-10).max(40).default(0), damage: text(80).default('1d6'),
  hitDie: z.union([z.literal(6), z.literal(8), z.literal(10), z.literal(12)]).default(8),
  hitDiceUsed: z.number().int().min(0).max(20).default(0), constitutionMod: z.number().int().min(-5).max(10).default(0),
  pactMagic: z.boolean().default(false),
  spellSlots: z.record(z.string().regex(/^[1-9]$/), z.object({ max: z.number().int().min(0).max(20), used: z.number().int().min(0).max(20) }).strict()).default({}),
  inventory: z.array(z.object({ name: z.string().min(1).max(100), quantity: z.number().int().min(0).max(10000) }).strict()).max(100).default([]),
  conditions: z.array(z.string().min(1).max(60)).max(30).default([]), hidden: z.boolean().default(false),
}).strict().superRefine((c, ctx) => {
  if (c.hp > c.maxHp) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'HP cannot exceed maximum HP' });
  if (c.hitDiceUsed > c.level) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Spent hit dice exceed level' });
  if (Object.values(c.spellSlots).some(s => s.used > s.max)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Spent slots exceed maximum' });
});
export const entitySchema = z.object({
  id: z.string().uuid(), kind: z.enum(['npc', 'quest', 'location', 'faction', 'lore']),
  name: z.string().trim().min(1).max(150), description: text(6000).default(''),
  status: z.enum(['open', 'active', 'completed']).default('open'),
  dmSecret: text(6000).default(''), hidden: z.boolean().default(false),
}).strict();
export const campaignSchema = z.object({
  id: z.string().uuid(), ownerId: z.string().min(1).max(100), name: z.string().min(1).max(150),
  edition: z.enum(['5e-2014', '5e-2024']), premise: text(4000), scene: text(1500).default(''),
  recap: text(6000).default(''), dmNotes: text(10000).default(''),
  characters: z.array(characterSchema).max(50), entities: z.array(entitySchema).max(300),
  combat: z.object({ order: z.array(z.string().uuid()).max(50), turn: z.number().int().min(0), round: z.number().int().min(1) }).strict().nullable(),
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: text(10000) }).strict()).max(2000),
  log: z.array(text(2000)).max(200), version: z.number().int().min(0), updatedAt: z.string(),
  imports: z.array(z.object({ source: z.string(), notice: z.string() }).strict()).max(20).default([]),
}).strict();
export type Campaign = z.infer<typeof campaignSchema>;
export type Character = z.infer<typeof characterSchema>;
export type CampaignEntity = z.infer<typeof entitySchema>;
export const campaignCreateSchema = z.object({
  name: z.string().trim().min(1).max(150), edition: z.enum(['5e-2014', '5e-2024']).default('5e-2024'),
  premise: text(4000).default('A small party arrives at a village in need of help.'),
}).strict();
export const campaignActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('character'), character: characterSchema }).strict(),
  z.object({ type: z.literal('entity'), entity: entitySchema }).strict(),
  z.object({ type: z.literal('journal'), scene: text(1500), recap: text(6000), dmNotes: text(10000).optional() }).strict(),
  z.object({ type: z.literal('roll'), expression: z.string().min(1).max(100) }).strict(),
  z.object({ type: z.literal('attack'), actorId: z.string().uuid(), targetId: z.string().uuid(), advantage: z.enum(['none', 'advantage', 'disadvantage']).default('none') }).strict(),
  z.object({ type: z.literal('hp'), characterId: z.string().uuid(), delta: z.number().int().min(-2000).max(2000) }).strict(),
  z.object({ type: z.literal('slot'), characterId: z.string().uuid(), level: z.number().int().min(1).max(9), delta: z.number().int().min(-20).max(20).refine(n => n !== 0) }).strict(),
  z.object({ type: z.literal('rest'), characterId: z.string().uuid(), kind: z.enum(['short', 'long']), hitDice: z.number().int().min(0).max(20).default(0) }).strict(),
  z.object({ type: z.literal('initiative') }).strict(), z.object({ type: z.literal('next-turn') }).strict(),
  z.object({ type: z.literal('end-combat') }).strict(),
]);
export type CampaignAction = z.infer<typeof campaignActionSchema>;

/** This projection, not the private save, is supplied to the player-facing narrator. */
export function playerView(campaign: Campaign) {
  const { dmNotes: _secret, ownerId: _owner, ...publicState } = campaign;
  const visible = new Set(campaign.characters.filter(c => !c.hidden).map(c => c.id));
  return { ...publicState,
    characters: campaign.characters.filter(c => !c.hidden).map(c => c.kind === 'npc'
      ? { id: c.id, name: c.name, kind: c.kind, conditions: c.conditions, defeated: c.hp === 0 }
      : c),
    entities: campaign.entities.filter(e => !e.hidden).map(({ dmSecret: _hidden, ...entity }) => entity),
    combat: campaign.combat ? { ...campaign.combat, order: campaign.combat.order.filter(id => visible.has(id)) } : null,
  };
}
