import { Campaign, CampaignAction, Character, characterSchema, entitySchema } from './CampaignTypes';
import { rollExpression, DieRng, RollResult } from './vendor/openGameMasterDice';
import { applySpellSlotDelta } from './vendor/campfireSpellSlots';
import { initModDescThenSortOrderAsc } from './vendor/campfireInitiative';
import { AppError } from '../../utils/errors';

const refuse = (message: string): never => { throw new AppError(message, 400, 'CAMPAIGN_ACTION_REFUSED'); };
export function rollDice(expression: string, rng?: DieRng): RollResult {
  const normalized = expression.replace(/\s+/g, '').replace(/(^|[+-])d/gi, '$11d');
  if (normalized.length > 100) return refuse('Dice expression is too long.');
  try {
    const check = rollExpression(normalized, () => 1);
    if (check.terms.reduce((n, t) => n + (t.kind === 'dice' ? t.count : 0), 0) > 100) return refuse('Roll at most 100 dice at a time.');
    return rollExpression(normalized, rng);
  } catch (error) { return refuse(error instanceof Error ? error.message : 'Invalid dice expression.'); }
}
function character(state: Campaign, id: string) {
  return state.characters.find(c => c.id === id) || refuse('Character not found in this campaign.');
}
function damage(target: Character, amount: number) {
  const absorbed = Math.min(target.tempHp, amount);
  target.tempHp -= absorbed;
  target.hp = Math.max(0, target.hp - (amount - absorbed));
}
function attack(state: Campaign, action: Extract<CampaignAction, { type: 'attack' }>, rng?: DieRng) {
  const actor = character(state, action.actorId), target = character(state, action.targetId);
  if (actor.id === target.id || actor.hidden || target.hidden) return refuse('Choose two different revealed combatants.');
  if (!actor.hp || !target.hp) return refuse('Both combatants must have positive HP.');
  if (actor.conditions.some(c => ['unconscious', 'incapacitated', 'paralyzed', 'stunned'].includes(c.toLowerCase()))) return refuse('The attacker cannot act while incapacitated.');
  if (state.combat && state.combat.order[state.combat.turn] !== actor.id) return refuse("It is not this combatant's turn.");
  const expr = action.advantage === 'none' ? '1d20' : action.advantage === 'advantage' ? '2d20kh1' : '2d20kl1';
  const hitRoll = rollDice(`${expr}${actor.attackBonus < 0 ? '' : '+'}${actor.attackBonus}`, rng);
  const hit = hitRoll.natural === 20 || (hitRoll.natural !== 1 && hitRoll.total >= target.ac);
  if (!hit) return `${actor.name} attacks ${target.name}: ${hitRoll.expression} = ${hitRoll.total}; miss.`;
  const expression = hitRoll.natural === 20 ? actor.damage.replace(/(\d+)d/gi, (_, count) => `${Number(count) * 2}d`) : actor.damage;
  const hitDamage = rollDice(expression, rng);
  damage(target, Math.max(0, hitDamage.total));
  // Enemy AC/current HP remain private; the damage the player rolled is public.
  return `${actor.name} attacks ${target.name}: ${hitRoll.expression} = ${hitRoll.total}; ${hitRoll.natural === 20 ? 'critical hit' : 'hit'}. Damage: ${hitDamage.expression} = ${hitDamage.total}.${target.hp === 0 ? ' Target is down.' : ''}`;
}

/** Model prose never enters this function. All mutations come from validated actions. */
export function applyCampaignAction(state: Campaign, action: CampaignAction, rng?: DieRng): string {
  switch (action.type) {
    case 'character': {
      const value = characterSchema.parse(action.character);
      const validation = rollDice(value.damage, () => 1);
      if (validation.terms.some(t => t.kind === 'dice' && t.keep)) return refuse('Damage formulas cannot keep or discard dice.');
      value.damage = validation.expression;
      const existing = state.characters.findIndex(c => c.id === value.id);
      if (existing < 0) { if (state.characters.length >= 50) return refuse('The campaign has 50 characters already.'); state.characters.push(value); }
      else state.characters[existing] = value;
      return value.hidden ? 'Private character updated.' : `${value.name}'s sheet was saved.`;
    }
    case 'entity': {
      const value = entitySchema.parse(action.entity), existing = state.entities.findIndex(e => e.id === value.id);
      if (existing < 0) { if (state.entities.length >= 300) return refuse('The campaign has 300 records already.'); state.entities.push(value); }
      else state.entities[existing] = value;
      return 'Campaign record saved.';
    }
    case 'journal': state.scene = action.scene; state.recap = action.recap; if (action.dmNotes !== undefined) state.dmNotes = action.dmNotes; return 'Campaign journal saved.';
    case 'roll': {
      const roll = rollDice(action.expression, rng);
      return `${roll.expression}: ${roll.terms.map(t => t.kind === 'dice' ? t.dice.map(d => `${d.value}${d.kept ? '' : ' (discarded)'}`).join(', ') : `${t.sign < 0 ? '-' : '+'}${t.value}`).join('; ')}. Total: ${roll.total}.`;
    }
    case 'attack': return attack(state, action, rng);
    case 'hp': {
      const c = character(state, action.characterId);
      if (action.delta < 0) damage(c, -action.delta); else c.hp = Math.min(c.maxHp, c.hp + action.delta);
      return c.hidden ? 'Private character updated.' : c.kind === 'npc' ? `${c.name}'s HP was updated.` : `${c.name}: ${c.hp}/${c.maxHp} HP; ${c.tempHp} temporary HP.`;
    }
    case 'slot': {
      const c = character(state, action.characterId), result = applySpellSlotDelta(c.spellSlots, action.level, action.delta);
      if (!result.ok) return refuse(result.message);
      c.spellSlots = result.slots;
      return c.hidden ? 'Private character updated.' : `${c.name}: ${result.remaining}/${result.max} level ${action.level} spell slots remain.`;
    }
    case 'rest': {
      const c = character(state, action.characterId);
      if (state.combat) return refuse('End combat before resting.');
      if (!c.hp) return refuse('A character at 0 HP cannot begin a rest.');
      if (action.kind === 'long') {
        c.hp = c.maxHp;
        c.hitDiceUsed = state.edition === '5e-2024' ? 0 : Math.max(0, c.hitDiceUsed - Math.max(1, Math.floor(c.level / 2)));
        for (const pool of Object.values(c.spellSlots)) pool.used = 0;
      } else {
        if (action.hitDice > c.level - c.hitDiceUsed) return refuse('Not enough hit dice remain.');
        for (let i = 0; i < action.hitDice; i++) c.hp = Math.min(c.maxHp, c.hp + Math.max(0, rollDice(`1d${c.hitDie}`, rng).total + c.constitutionMod));
        c.hitDiceUsed += action.hitDice;
        if (c.pactMagic) for (const pool of Object.values(c.spellSlots)) pool.used = 0;
      }
      return c.hidden ? 'Private character rested.' : `${c.name} completed a ${action.kind} rest.`;
    }
    case 'initiative': {
      const rolls = state.characters.filter(c => !c.hidden && c.hp > 0).map((c, i) => ({
        characterId: c.id, score: rollDice(`1d20${c.initiativeMod < 0 ? '' : '+'}${c.initiativeMod}`, rng).total, initMod: c.initiativeMod, sortOrder: i,
      })).sort((a, b) => b.score - a.score || initModDescThenSortOrderAsc(a, b));
      if (rolls.length < 2) return refuse('Reveal at least two living combatants before rolling initiative.');
      state.combat = { order: rolls.map(r => r.characterId), turn: 0, round: 1 };
      return `Initiative: ${rolls.map(r => `${character(state, r.characterId).name} ${r.score}`).join(', ')}.`;
    }
    case 'next-turn': {
      if (!state.combat?.order.length) return refuse('No encounter is running.');
      state.combat.turn = (state.combat.turn + 1) % state.combat.order.length;
      if (state.combat.turn === 0) state.combat.round++;
      return `Round ${state.combat.round}: ${character(state, state.combat.order[state.combat.turn]).name}'s turn.`;
    }
    case 'end-combat': state.combat = null; return 'Encounter ended.';
  }
}
