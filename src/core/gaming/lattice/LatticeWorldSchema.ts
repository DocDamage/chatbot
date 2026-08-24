/**
 * Lattice Isometric World Schema & Scenario Models (CF-08)
 *
 * Implements deterministic isometric world schemas, tile configurations,
 * entity descriptors, action envelopes, and scenario serialization.
 */

import * as crypto from 'crypto';

export interface LatticeVector3 {
  x: number;
  y: number;
  z: number;
}

export type TileType = 'grass' | 'water' | 'stone' | 'dirt' | 'sand' | 'wall' | 'void';

export interface LatticeTile {
  x: number;
  y: number;
  type: TileType;
  walkable: boolean;
  elevation: number;
  metadata?: Record<string, any>;
}

export interface LatticeEntity {
  id: string;
  archetype: 'player' | 'npc' | 'enemy' | 'item' | 'obstacle' | 'trigger';
  name: string;
  position: LatticeVector3;
  stats: {
    hp: number;
    maxHp: number;
    speed: number;
    attack?: number;
    defense?: number;
  };
  inventory?: string[];
  state: 'idle' | 'moving' | 'acting' | 'defeated' | 'active';
  behavior?: 'static' | 'patrol' | 'wander' | 'chase' | 'flee' | 'scripted';
  metadata?: Record<string, any>;
}

export type ActionType = 'move' | 'interact' | 'attack' | 'collect' | 'wait' | 'spawn' | 'custom';

export interface LatticeAction {
  tick: number;
  entityId: string;
  type: ActionType;
  targetPosition?: LatticeVector3;
  targetEntityId?: string;
  params?: Record<string, any>;
}

export interface LatticeWinCondition {
  type: 'defeat_all' | 'reach_tile' | 'collect_items' | 'survive_ticks' | 'custom';
  targetTile?: LatticeVector3;
  targetCount?: number;
  ticksRequired?: number;
}

export interface LatticeBudget {
  maxTicks: number;
  maxEntities: number;
  maxGridDimension: number;
  timeoutMs: number;
}

export const DEFAULT_LATTICE_BUDGET: LatticeBudget = {
  maxTicks: 1000,
  maxEntities: 100,
  maxGridDimension: 64,
  timeoutMs: 30000
};

export interface LatticeWorldSchema {
  dimensions: { width: number; height: number };
  tiles: LatticeTile[];
  entities: LatticeEntity[];
  seed: number;
  rules?: {
    gravity?: boolean;
    turnBased?: boolean;
    diagonalMovement?: boolean;
  };
}

export interface LatticeScenario {
  id: string;
  title: string;
  description: string;
  version: string;
  world: LatticeWorldSchema;
  initialActions?: LatticeAction[];
  winCondition?: LatticeWinCondition;
  budget: LatticeBudget;
  scenarioDigest: string;
  createdAt: string;
}

export class LatticeSchemaValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LatticeSchemaValidationError';
  }
}

/**
 * Compute the deterministic SHA-256 digest of a Lattice world or scenario
 */
export function computeLatticeWorldDigest(world: LatticeWorldSchema): string {
  const normalized = {
    dimensions: world.dimensions,
    seed: world.seed,
    tiles: world.tiles.map(t => ({ x: t.x, y: t.y, type: t.type, walkable: t.walkable, elevation: t.elevation })),
    entities: world.entities.map(e => ({ id: e.id, archetype: e.archetype, pos: e.position, stats: e.stats })),
    rules: world.rules || {}
  };

  return crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

export function computeLatticeScenarioDigest(scenario: Omit<LatticeScenario, 'scenarioDigest'>): string {
  const normalized = {
    id: scenario.id,
    title: scenario.title,
    description: scenario.description,
    version: scenario.version,
    world: scenario.world,
    initialActions: scenario.initialActions || [],
    winCondition: scenario.winCondition || null,
    budget: scenario.budget,
    createdAt: scenario.createdAt
  };
  return crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

/**
 * Validate a Lattice world schema against dimensions and limits
 */
export function validateLatticeWorldSchema(world: LatticeWorldSchema, budget: LatticeBudget = DEFAULT_LATTICE_BUDGET): void {
  if (!Number.isInteger(budget.maxTicks) || budget.maxTicks <= 0 ||
      !Number.isInteger(budget.maxEntities) || budget.maxEntities <= 0 ||
      !Number.isInteger(budget.maxGridDimension) || budget.maxGridDimension <= 0 ||
      !Number.isFinite(budget.timeoutMs) || budget.timeoutMs <= 0) {
    throw new LatticeSchemaValidationError('Lattice resource budgets must be positive finite limits.');
  }
  if (world.dimensions.width <= 0 || world.dimensions.height <= 0) {
    throw new LatticeSchemaValidationError('World dimensions must be greater than zero.');
  }

  if (world.dimensions.width > budget.maxGridDimension || world.dimensions.height > budget.maxGridDimension) {
    throw new LatticeSchemaValidationError(`World dimensions exceed maxGridDimension of ${budget.maxGridDimension}.`);
  }

  if (world.entities.length > budget.maxEntities) {
    throw new LatticeSchemaValidationError(`Entity count (${world.entities.length}) exceeds budget of ${budget.maxEntities}.`);
  }

  // Validate tile coordinates
  const tileSet = new Set<string>();
  for (const tile of world.tiles) {
    if (tile.x < 0 || tile.x >= world.dimensions.width || tile.y < 0 || tile.y >= world.dimensions.height) {
      throw new LatticeSchemaValidationError(`Tile at (${tile.x}, ${tile.y}) is out of world bounds.`);
    }
    const key = `${tile.x},${tile.y}`;
    if (tileSet.has(key)) {
      throw new LatticeSchemaValidationError(`Duplicate tile definition at (${tile.x}, ${tile.y}).`);
    }
    tileSet.add(key);
  }

  // Validate entity bounds
  const entityIds = new Set<string>();
  for (const entity of world.entities) {
    if (!entity.id || entityIds.has(entity.id)) {
      throw new LatticeSchemaValidationError(`Entity IDs must be non-empty and unique (duplicate '${entity.id}').`);
    }
    entityIds.add(entity.id);
    if (
      entity.position.x < 0 ||
      entity.position.x >= world.dimensions.width ||
      entity.position.y < 0 ||
      entity.position.y >= world.dimensions.height
    ) {
      throw new LatticeSchemaValidationError(`Entity '${entity.id}' position (${entity.position.x}, ${entity.position.y}) is out of world bounds.`);
    }
  }
}

/**
 * Create a new valid LatticeScenario
 */
export function createLatticeScenario(options: {
  id?: string;
  title: string;
  description: string;
  version?: string;
  world: LatticeWorldSchema;
  initialActions?: LatticeAction[];
  winCondition?: LatticeWinCondition;
  budget?: Partial<LatticeBudget>;
}): LatticeScenario {
  const budget: LatticeBudget = {
    ...DEFAULT_LATTICE_BUDGET,
    ...options.budget
  };

  validateLatticeWorldSchema(options.world, budget);

  const id = options.id || `scenario-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const version = options.version || '1.0.0';
  const createdAt = new Date().toISOString();
  const unsignedScenario: Omit<LatticeScenario, 'scenarioDigest'> = {
    id,
    title: options.title,
    description: options.description,
    version,
    world: options.world,
    initialActions: options.initialActions || [],
    winCondition: options.winCondition,
    budget,
    createdAt
  };
  return { ...unsignedScenario, scenarioDigest: computeLatticeScenarioDigest(unsignedScenario) };
}

/**
 * Serialize a scenario to JSON
 */
export function serializeScenario(scenario: LatticeScenario): string {
  return JSON.stringify(scenario, null, 2);
}

/**
 * Deserialize and validate a scenario from JSON
 */
export function deserializeScenario(json: string): LatticeScenario {
  try {
    const parsed = JSON.parse(json);
    validateLatticeWorldSchema(parsed.world, parsed.budget || DEFAULT_LATTICE_BUDGET);
    const { scenarioDigest, ...unsignedScenario } = parsed as LatticeScenario;
    if (!scenarioDigest || computeLatticeScenarioDigest(unsignedScenario) !== scenarioDigest) {
      throw new LatticeSchemaValidationError('Scenario digest mismatch; serialized scenario was modified.');
    }
    return parsed;
  } catch (err: any) {
    throw new LatticeSchemaValidationError(`Failed to deserialize scenario: ${err.message}`);
  }
}
