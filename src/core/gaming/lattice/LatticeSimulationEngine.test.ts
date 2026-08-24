/**
 * CF-08 Lattice Game-Development Capability Test Suite
 */

import {
  createLatticeScenario,
  validateLatticeWorldSchema,
  computeLatticeScenarioDigest,
  serializeScenario,
  deserializeScenario,
  LatticeWorldSchema,
  LatticeSchemaValidationError
} from './LatticeWorldSchema';
import {
  LatticeSimulationEngine,
  Mulberry32PRNG
} from './LatticeSimulationEngine';
import { LatticeVisualizer } from './LatticeVisualizer';
import { LatticeGameAdapter } from './LatticeGameAdapter';

describe('CF-08 Lattice Game-Development Capability', () => {
  const sampleWorld: LatticeWorldSchema = {
    dimensions: { width: 5, height: 5 },
    seed: 12345,
    tiles: [
      { x: 0, y: 0, type: 'wall', walkable: false, elevation: 1 },
      { x: 1, y: 0, type: 'wall', walkable: false, elevation: 1 },
      { x: 2, y: 0, type: 'wall', walkable: false, elevation: 1 },
      { x: 3, y: 0, type: 'wall', walkable: false, elevation: 1 },
      { x: 4, y: 0, type: 'wall', walkable: false, elevation: 1 },

      { x: 0, y: 1, type: 'wall', walkable: false, elevation: 1 },
      { x: 1, y: 1, type: 'stone', walkable: true, elevation: 0 },
      { x: 2, y: 1, type: 'stone', walkable: true, elevation: 0 },
      { x: 3, y: 1, type: 'stone', walkable: true, elevation: 0 },
      { x: 4, y: 1, type: 'wall', walkable: false, elevation: 1 },

      { x: 0, y: 2, type: 'wall', walkable: false, elevation: 1 },
      { x: 1, y: 2, type: 'stone', walkable: true, elevation: 0 },
      { x: 2, y: 2, type: 'stone', walkable: true, elevation: 0 },
      { x: 3, y: 2, type: 'stone', walkable: true, elevation: 0 },
      { x: 4, y: 2, type: 'wall', walkable: false, elevation: 1 },

      { x: 0, y: 3, type: 'wall', walkable: false, elevation: 1 },
      { x: 1, y: 3, type: 'stone', walkable: true, elevation: 0 },
      { x: 2, y: 3, type: 'stone', walkable: true, elevation: 0 },
      { x: 3, y: 3, type: 'stone', walkable: true, elevation: 0 },
      { x: 4, y: 3, type: 'wall', walkable: false, elevation: 1 },

      { x: 0, y: 4, type: 'wall', walkable: false, elevation: 1 },
      { x: 1, y: 4, type: 'wall', walkable: false, elevation: 1 },
      { x: 2, y: 4, type: 'wall', walkable: false, elevation: 1 },
      { x: 3, y: 4, type: 'wall', walkable: false, elevation: 1 },
      { x: 4, y: 4, type: 'wall', walkable: false, elevation: 1 }
    ],
    entities: [
      {
        id: 'player-1',
        archetype: 'player',
        name: 'Knight',
        position: { x: 1, y: 1, z: 0 },
        stats: { hp: 100, maxHp: 100, speed: 1, attack: 20, defense: 5 },
        state: 'idle'
      },
      {
        id: 'enemy-1',
        archetype: 'enemy',
        name: 'Skeleton',
        position: { x: 3, y: 3, z: 0 },
        stats: { hp: 30, maxHp: 30, speed: 1, attack: 10, defense: 2 },
        state: 'idle',
        behavior: 'wander'
      }
    ]
  };

  describe('Lattice World Schema & Scenario Validation', () => {
    it('creates a valid scenario with cryptographic digest', () => {
      const scenario = createLatticeScenario({
        title: 'Mini Dungeon',
        description: 'Test dungeon scenario',
        world: sampleWorld,
        winCondition: { type: 'defeat_all' }
      });

      expect(scenario.scenarioDigest).toBeDefined();
      const { scenarioDigest, ...unsignedScenario } = scenario;
      expect(scenarioDigest).toBe(computeLatticeScenarioDigest(unsignedScenario));
      expect(scenario.world.dimensions.width).toBe(5);
    });

    it('rejects worlds with out-of-bounds entity positions', () => {
      const invalidWorld: LatticeWorldSchema = {
        ...sampleWorld,
        entities: [
          {
            id: 'escaped-entity',
            archetype: 'player',
            name: 'Out of Bounds',
            position: { x: 10, y: 10, z: 0 },
            stats: { hp: 10, maxHp: 10, speed: 1 },
            state: 'idle'
          }
        ]
      };

      expect(() => {
        validateLatticeWorldSchema(invalidWorld);
      }).toThrow(LatticeSchemaValidationError);
    });

    it('rejects worlds exceeding dimension budgets', () => {
      const hugeWorld: LatticeWorldSchema = {
        dimensions: { width: 128, height: 128 },
        tiles: [],
        entities: [],
        seed: 1
      };

      expect(() => {
        validateLatticeWorldSchema(hugeWorld, { maxGridDimension: 64, maxEntities: 10, maxTicks: 100, timeoutMs: 1000 });
      }).toThrow(/exceed maxGridDimension/);
    });

    it('serializes and deserializes scenarios deterministically', () => {
      const scenario = createLatticeScenario({
        title: 'Serialization Test',
        description: 'Testing JSON roundtrip',
        world: sampleWorld
      });

      const json = serializeScenario(scenario);
      const deserialized = deserializeScenario(json);

      expect(deserialized.id).toBe(scenario.id);
      expect(deserialized.scenarioDigest).toBe(scenario.scenarioDigest);
      expect(deserialized.world.entities.length).toBe(scenario.world.entities.length);
    });

    it('rejects tampered serialized scenario actions or budgets', () => {
      const scenario = createLatticeScenario({ title: 'Integrity', description: 'd', world: sampleWorld });
      const tampered = JSON.parse(serializeScenario(scenario));
      tampered.budget.maxTicks += 1;
      expect(() => deserializeScenario(JSON.stringify(tampered))).toThrow(/digest mismatch/);
    });
  });

  describe('Deterministic PRNG & Simulation Replay', () => {
    it('Mulberry32 PRNG produces identical sequences from identical seeds', () => {
      const rngA = new Mulberry32PRNG(98765);
      const rngB = new Mulberry32PRNG(98765);

      const seqA = Array.from({ length: 10 }, () => rngA.next());
      const seqB = Array.from({ length: 10 }, () => rngB.next());

      expect(seqA).toEqual(seqB);
    });

    it('replaying an action sequence produces exact deterministic snapshots', () => {
      const scenario = createLatticeScenario({
        title: 'Replay Scenario',
        description: 'Deterministic replay test',
        world: sampleWorld
      });

      const engineA = new LatticeSimulationEngine(scenario);
      const engineB = new LatticeSimulationEngine(scenario);

      // Player actions
      const actions = [
        { tick: 1, entityId: 'player-1', type: 'move' as const, targetPosition: { x: 2, y: 1, z: 0 } },
        { tick: 2, entityId: 'player-1', type: 'move' as const, targetPosition: { x: 2, y: 2, z: 0 } },
        { tick: 3, entityId: 'player-1', type: 'wait' as const }
      ];

      const resA = engineA.replay(actions);
      const resB = engineB.replay(actions);

      expect(resA.totalTicks).toBe(resB.totalTicks);
      expect(resA.finalEntities[0].position).toEqual(resB.finalEntities[0].position);
      expect(resA.snapshots.map(s => s.stateDigest)).toEqual(resB.snapshots.map(s => s.stateDigest));
    });
  });

  describe('Simulation Mechanics & Collision Resolution', () => {
    it('allows movement onto walkable tiles and prevents walking into walls', () => {
      const scenario = createLatticeScenario({
        title: 'Collision Test',
        description: 'Wall collision verification',
        world: sampleWorld
      });

      const engine = new LatticeSimulationEngine(scenario);

      // 1. Move to walkable (2, 1)
      engine.queueAction({
        tick: 1,
        entityId: 'player-1',
        type: 'move',
        targetPosition: { x: 2, y: 1, z: 0 }
      });
      engine.step();

      let world = engine.getCurrentWorld();
      let player = world.entities.find(e => e.id === 'player-1')!;
      expect(player.position.x).toBe(2);
      expect(player.position.y).toBe(1);

      // 2. Try moving north into wall (2, 0)
      engine.queueAction({
        tick: 2,
        entityId: 'player-1',
        type: 'move',
        targetPosition: { x: 2, y: 0, z: 0 }
      });
      engine.step();

      world = engine.getCurrentWorld();
      player = world.entities.find(e => e.id === 'player-1')!;
      // Should remain at (2, 1)
      expect(player.position.x).toBe(2);
      expect(player.position.y).toBe(1);
    });

    it('resolves attack actions and triggers win condition when enemies are defeated', () => {
      const scenario = createLatticeScenario({
        title: 'Combat Win Test',
        description: 'Attack and defeat_all check',
        world: sampleWorld,
        winCondition: { type: 'defeat_all' }
      });

      const engine = new LatticeSimulationEngine(scenario);

      // Attack enemy-1 (30 HP, player attack 20 - def 2 = 18 damage/hit)
      engine.queueAction({ tick: 1, entityId: 'player-1', type: 'attack', targetEntityId: 'enemy-1' });
      engine.step();

      let enemy = engine.getCurrentWorld().entities.find(e => e.id === 'enemy-1')!;
      expect(enemy.stats.hp).toBe(12);
      expect(enemy.state).not.toBe('defeated');

      // Second hit finishes enemy
      engine.queueAction({ tick: 2, entityId: 'player-1', type: 'attack', targetEntityId: 'enemy-1' });
      engine.step();

      enemy = engine.getCurrentWorld().entities.find(e => e.id === 'enemy-1')!;
      expect(enemy.stats.hp).toBe(0);
      expect(enemy.state).toBe('defeated');

      const result = engine.getResult();
      expect(result.won).toBe(true);
      expect(result.completed).toBe(true);
    });
  });

  describe('Accessible & Visual Representations', () => {
    it('renders non-visual 2D ASCII grid with legend', () => {
      const ascii = LatticeVisualizer.renderAsciiGrid(sampleWorld);
      expect(ascii).toContain('Lattice World (5x5)');
      expect(ascii).toContain('Legend: [P] Player');
      expect(ascii).toContain('P');
      expect(ascii).toContain('E');
      expect(ascii).toContain('#');
    });

    it('renders non-visual markdown entity table', () => {
      const table = LatticeVisualizer.renderEntityTable(sampleWorld.entities);
      expect(table).toContain('| ID | Name | Archetype |');
      expect(table).toContain('| player-1 | Knight | player | (1, 1, 0) | 100/100 | idle |');
      expect(table).toContain('| enemy-1 | Skeleton | enemy | (3, 3, 0) | 30/30 | idle |');
    });

    it('renders lightweight 2D isometric SVG preview', () => {
      const svg = LatticeVisualizer.renderIsometricSvg(sampleWorld);
      expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
      expect(svg).toContain('<polygon points=');
      expect(svg).toContain('<circle cx=');
      expect(svg).toContain('</svg>');
    });
  });

  describe('Lattice Game Adapter & Gaming Specialist Integration', () => {
    it('creates starter dungeon scenario and generates complete playbook', () => {
      const adapter = new LatticeGameAdapter();
      const scenario = adapter.createIsometricDungeonScenario({ width: 6, height: 6, enemyCount: 1 });

      expect(scenario.world.dimensions.width).toBe(6);
      expect(scenario.world.entities.some(e => e.archetype === 'player')).toBe(true);
      expect(scenario.world.entities.some(e => e.archetype === 'enemy')).toBe(true);

      const playbook = adapter.generateIsometricPlaybook(scenario);
      expect(playbook.scenario.title).toBe(scenario.title);
      expect(playbook.asciiMap).toBeDefined();
      expect(playbook.entityTable).toBeDefined();
      expect(playbook.svgPreview).toBeDefined();
      expect(playbook.simulation.totalTicks).toBeGreaterThan(0);
      expect(playbook.recommendations.length).toBeGreaterThan(0);
    });
  });
});
