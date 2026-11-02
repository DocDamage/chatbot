/**
 * Deterministic Lattice Simulation & Replay Engine (CF-08)
 *
 * Implements tick-based simulation with seedable Mulberry32 PRNG,
 * collision resolution, action replay, state snapshots, and budget enforcement.
 */

import * as crypto from 'crypto';
import {
  LatticeScenario,
  LatticeWorldSchema,
  LatticeEntity,
  LatticeAction,
  LatticeTile,
  LatticeVector3,
  LatticeBudget,
  computeLatticeWorldDigest,
  computeLatticeScenarioDigest
} from './LatticeWorldSchema';

/**
 * Seedable Mulberry32 Pseudo-Random Number Generator
 */
export class Mulberry32PRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  public next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  public nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  public getState(): number {
    return this.state;
  }
}

export interface SimulationSnapshot {
  tick: number;
  entities: LatticeEntity[];
  tiles: LatticeTile[];
  stateDigest: string;
}

export interface SimulationResult {
  completed: boolean;
  won: boolean;
  totalTicks: number;
  finalEntities: LatticeEntity[];
  actionLog: LatticeAction[];
  snapshots: SimulationSnapshot[];
  seed: number;
  error?: string;
}

export class LatticeSimulationEngine {
  private scenario!: LatticeScenario;
  private currentWorld!: LatticeWorldSchema;
  private currentTick = 0;
  private prng!: Mulberry32PRNG;
  private actionQueue: LatticeAction[] = [];
  private actionHistory: LatticeAction[] = [];
  private snapshots: SimulationSnapshot[] = [];
  private isPaused = false;
  private isFinished = false;
  private won = false;
  private runStartedAt = 0;

  constructor(scenario?: LatticeScenario) {
    if (scenario) {
      this.loadScenario(scenario);
    }
  }

  /**
   * Load and initialize a new scenario
   */
  public loadScenario(scenario: LatticeScenario): void {
    const { scenarioDigest, ...unsignedScenario } = scenario;
    if (computeLatticeScenarioDigest(unsignedScenario) !== scenarioDigest) {
      throw new Error(`Scenario '${scenario.id}' failed digest verification.`);
    }
    this.scenario = scenario;
    this.reset();
  }

  /**
   * Reset simulation state back to initial scenario state
   */
  public reset(): void {
    this.currentTick = 0;
    this.isPaused = false;
    this.isFinished = false;
    this.won = false;
    this.runStartedAt = Date.now();
    this.actionQueue = [...(this.scenario.initialActions || [])];
    this.actionHistory = [];
    this.snapshots = [];

    // Deep clone the world schema
    this.currentWorld = {
      dimensions: { ...this.scenario.world.dimensions },
      tiles: this.scenario.world.tiles.map(t => ({ ...t, metadata: { ...(t.metadata || {}) } })),
      entities: this.scenario.world.entities.map(e => ({
        ...e,
        position: { ...e.position },
        stats: { ...e.stats },
        inventory: e.inventory ? [...e.inventory] : []
      })),
      seed: this.scenario.world.seed,
      rules: { ...(this.scenario.world.rules || {}) }
    };

    this.prng = new Mulberry32PRNG(this.currentWorld.seed);
    this.recordSnapshot();
  }

  /**
   * Queue an action for execution on current or future tick
   */
  public queueAction(action: LatticeAction): void {
    this.actionQueue.push(action);
  }

  /**
   * Advance the simulation by 1 tick
   */
  public step(): boolean {
    if (this.isFinished || this.isPaused) {
      return false;
    }

    if (this.currentTick >= this.scenario.budget.maxTicks) {
      this.isFinished = true;
      return false;
    }
    if (Date.now() - this.runStartedAt > this.scenario.budget.timeoutMs) {
      this.isFinished = true;
      return false;
    }

    this.currentTick++;

    // 1. Process queued actions for current tick
    const actionsForTick = this.actionQueue.filter(a => a.tick === this.currentTick || a.tick <= 0);
    this.actionQueue = this.actionQueue.filter(a => a.tick > this.currentTick);

    for (const action of actionsForTick) {
      this.executeAction(action);
      this.actionHistory.push(action);
    }

    // 2. Process autonomous behaviors for living entities
    for (const entity of this.currentWorld.entities) {
      if (entity.state === 'defeated') continue;
      this.processEntityBehavior(entity);
    }

    // 3. Check win/loss conditions
    this.evaluateWinCondition();

    // 4. Record snapshot for replay and rewind
    this.recordSnapshot();

    return !this.isFinished;
  }

  /**
   * Run simulation for N ticks or until completion
   */
  public runTicks(count: number): SimulationResult {
    for (let i = 0; i < count; i++) {
      const continuing = this.step();
      if (!continuing) break;
    }

    return this.getResult();
  }

  /**
   * Deterministically replay an exact action sequence from tick 0
   */
  public replay(actions: LatticeAction[]): SimulationResult {
    this.reset();
    for (const act of actions) {
      this.queueAction(act);
    }

    while (!this.isFinished && this.currentTick < this.scenario.budget.maxTicks) {
      this.step();
    }

    return this.getResult();
  }

  /**
   * Execute an individual entity action
   */
  private executeAction(action: LatticeAction): void {
    const entity = this.currentWorld.entities.find(e => e.id === action.entityId);
    if (!entity || entity.state === 'defeated') return;

    switch (action.type) {
      case 'move': {
        if (!action.targetPosition) break;
        const target = action.targetPosition;

        // Check bounds
        if (
          target.x < 0 ||
          target.x >= this.currentWorld.dimensions.width ||
          target.y < 0 ||
          target.y >= this.currentWorld.dimensions.height
        ) {
          break;
        }

        // Check tile walkability
        const tile = this.getTileAt(target.x, target.y);
        if (tile && !tile.walkable) {
          break;
        }

        // Check entity collision (cannot occupy same space as another solid entity)
        const occupied = this.currentWorld.entities.find(
          e => e.id !== entity.id && e.state !== 'defeated' && e.position.x === target.x && e.position.y === target.y && e.archetype !== 'item'
        );

        if (!occupied) {
          entity.position = { ...target };
          entity.state = 'moving';
        }
        break;
      }
      case 'attack': {
        if (action.targetEntityId) {
          const targetEntity = this.currentWorld.entities.find(e => e.id === action.targetEntityId);
          if (targetEntity && targetEntity.state !== 'defeated') {
            const attackPower = entity.stats.attack ?? 10;
            const defense = targetEntity.stats.defense ?? 0;
            const damage = Math.max(1, attackPower - defense);

            targetEntity.stats.hp = Math.max(0, targetEntity.stats.hp - damage);
            if (targetEntity.stats.hp === 0) {
              targetEntity.state = 'defeated';
            }
          }
        }
        break;
      }
      case 'collect': {
        const item = this.currentWorld.entities.find(
          e => e.archetype === 'item' && e.state !== 'defeated' && e.position.x === entity.position.x && e.position.y === entity.position.y
        );
        if (item) {
          item.state = 'defeated';
          entity.inventory = entity.inventory || [];
          entity.inventory.push(item.id);
        }
        break;
      }
      case 'wait':
        entity.state = 'idle';
        break;
      default:
        break;
    }
  }

  /**
   * Autonomous AI behavior update
   */
  private processEntityBehavior(entity: LatticeEntity): void {
    if (entity.archetype === 'player' || !entity.behavior || entity.behavior === 'static') {
      return;
    }

    if (entity.behavior === 'wander') {
      // Deterministic wander using Mulberry32 PRNG
      const directions = [
        { dx: 1, dy: 0 },
        { dx: -1, dy: 0 },
        { dx: 0, dy: 1 },
        { dx: 0, dy: -1 }
      ];
      const dirIndex = this.prng.nextInt(0, directions.length - 1);
      const dir = directions[dirIndex];

      const newPos: LatticeVector3 = {
        x: entity.position.x + dir.dx,
        y: entity.position.y + dir.dy,
        z: entity.position.z
      };

      this.executeAction({
        tick: this.currentTick,
        entityId: entity.id,
        type: 'move',
        targetPosition: newPos
      });
    }
  }

  /**
   * Evaluate scenario win/loss state
   */
  private evaluateWinCondition(): void {
    const win = this.scenario.winCondition;
    if (!win) return;

    if (win.type === 'defeat_all') {
      const enemies = this.currentWorld.entities.filter(e => e.archetype === 'enemy' && e.state !== 'defeated');
      if (enemies.length === 0) {
        this.isFinished = true;
        this.won = true;
      }
    } else if (win.type === 'reach_tile' && win.targetTile) {
      const player = this.currentWorld.entities.find(e => e.archetype === 'player' && e.state !== 'defeated');
      if (player && player.position.x === win.targetTile.x && player.position.y === win.targetTile.y) {
        this.isFinished = true;
        this.won = true;
      }
    } else if (win.type === 'survive_ticks' && win.ticksRequired) {
      const player = this.currentWorld.entities.find(e => e.archetype === 'player' && e.state !== 'defeated');
      if (player && this.currentTick >= win.ticksRequired) {
        this.isFinished = true;
        this.won = true;
      }
    }

    // Check player defeat
    const livingPlayer = this.currentWorld.entities.find(e => e.archetype === 'player' && e.state !== 'defeated');
    if (!livingPlayer && this.currentWorld.entities.some(e => e.archetype === 'player')) {
      this.isFinished = true;
      this.won = false;
    }
  }

  private getTileAt(x: number, y: number): LatticeTile | undefined {
    return this.currentWorld.tiles.find(t => t.x === x && t.y === y);
  }

  private recordSnapshot(): void {
    const stateDigest = computeLatticeWorldDigest(this.currentWorld);
    this.snapshots.push({
      tick: this.currentTick,
      entities: this.currentWorld.entities.map(e => ({
        ...e,
        position: { ...e.position },
        stats: { ...e.stats },
        inventory: e.inventory ? [...e.inventory] : []
      })),
      tiles: [...this.currentWorld.tiles],
      stateDigest
    });
  }

  public getResult(): SimulationResult {
    return {
      completed: this.isFinished,
      won: this.won,
      totalTicks: this.currentTick,
      finalEntities: this.currentWorld.entities,
      actionLog: [...this.actionHistory],
      snapshots: [...this.snapshots],
      seed: this.currentWorld.seed
    };
  }

  public getCurrentWorld(): LatticeWorldSchema {
    return this.currentWorld;
  }

  public getCurrentTick(): number {
    return this.currentTick;
  }
}
