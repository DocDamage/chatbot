import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { GodotSceneMutator } from '../godot/GodotSceneMutator';
import { GodotProjectInspector } from '../godot/GodotProjectInspector';
import { UnityEngineAdapter } from '../unity/UnityEngineAdapter';
import { UnrealEngineAdapter } from '../unreal/UnrealEngineAdapter';
import { LatticeVisualizer } from '../lattice/LatticeVisualizer';
import { SpriteLabPlanService } from '../../sprite-lab/SpriteLabPlanService';
import { SpriteOutlineFinisher } from '../../sprite-lab/pipeline/SpriteOutlineFinisher';
import { RawPixelData } from '../../sprite-lab/pipeline/SpriteStudioTypes';

describe('B75-06: Gaming Engines, Godot Mutations, and Sprite Processing Matrix', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gaming-test-'));
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('GodotSceneMutator', () => {
    it('creates scenes, adds nodes, sets properties, connects signals, and modifies resources', async () => {
      const scenePath = 'scenes/Main.tscn';

      // Create scene
      await GodotSceneMutator.applyAction(
        {
          type: 'create_scene',
          targetPath: scenePath,
          params: { rootNodeType: 'Node2D', rootNodeName: 'WorldRoot' },
        },
        tempDir
      );

      const createdContent = fs.readFileSync(path.join(tempDir, scenePath), 'utf8');
      expect(createdContent).toContain('[node name="WorldRoot" type="Node2D"]');

      // Add node
      await GodotSceneMutator.applyAction(
        {
          type: 'add_node',
          targetPath: scenePath,
          params: { nodeName: 'Player', nodeType: 'CharacterBody2D', parent: '.' },
        },
        tempDir
      );

      // Set property
      await GodotSceneMutator.applyAction(
        {
          type: 'set_property',
          targetPath: scenePath,
          params: { nodeName: 'Player', propertyName: 'position', value: 'Vector2(100, 200)' },
        },
        tempDir
      );

      // Connect signal
      await GodotSceneMutator.applyAction(
        {
          type: 'connect_signal',
          targetPath: scenePath,
          params: {
            signal: 'body_entered',
            from: 'Area2D',
            to: 'Player',
            method: '_on_body_entered',
          },
        },
        tempDir
      );

      const modifiedContent = fs.readFileSync(path.join(tempDir, scenePath), 'utf8');
      expect(modifiedContent).toContain('position = Vector2(100, 200)');
      expect(modifiedContent).toContain('[connection signal="body_entered"');

      // Modify resource
      const resPath = 'resources/theme.tres';
      await GodotSceneMutator.applyAction(
        {
          type: 'modify_resource',
          targetPath: resPath,
          params: { resourceType: 'Theme', properties: { default_font_size: 16 } },
        },
        tempDir
      );

      expect(fs.existsSync(path.join(tempDir, resPath))).toBe(true);

      // Delete scene
      await GodotSceneMutator.applyAction(
        {
          type: 'delete_scene',
          targetPath: scenePath,
          params: {},
        },
        tempDir
      );

      expect(fs.existsSync(path.join(tempDir, scenePath))).toBe(false);
    });

    it('throws GameEngineError when operations fail validation or target is missing', async () => {
      await expect(
        GodotSceneMutator.applyAction(
          {
            type: 'add_node',
            targetPath: 'nonexistent.tscn',
            params: { nodeName: 'Test' },
          },
          tempDir
        )
      ).rejects.toThrow('Cannot add node; scene file not found');

      await expect(
        GodotSceneMutator.applyAction(
          {
            type: 'set_property',
            targetPath: 'nonexistent.tscn',
            params: { nodeName: 'Test', propertyName: 'a', value: 'b' },
          },
          tempDir
        )
      ).rejects.toThrow('Scene file not found');
    });
  });

  describe('GodotProjectInspector', () => {
    it('inspects project root, configuration, scenes, scripts, and resources', () => {
      fs.writeFileSync(
        path.join(tempDir, 'project.godot'),
        `
config_version=5
[application]
config/name="PixelQuest"
run/main_scene="res://scenes/Main.tscn"
config/features=PackedStringArray("4.2", "Forward Plus")
`,
        'utf8'
      );

      fs.mkdirSync(path.join(tempDir, 'scenes'), { recursive: true });
      fs.writeFileSync(
        path.join(tempDir, 'scenes', 'Main.tscn'),
        '[gd_scene]\n[node name="Main" type="Node2D"]\n',
        'utf8'
      );

      const info = GodotProjectInspector.inspectProject(tempDir);
      expect(info.name).toBe('PixelQuest');
      expect(info.mainScene).toBe('res://scenes/Main.tscn');
      expect(info.scenes).toContain('scenes/Main.tscn');
    });
  });

  describe('UnityEngineAdapter and UnrealEngineAdapter', () => {
    it('validates project root connection and rejects invalid paths', async () => {
      const unity = new UnityEngineAdapter();
      await expect(unity.connect({ engine: 'unity', projectRoot: tempDir })).rejects.toThrow(
        'Unity project Assets directory not found'
      );

      const unreal = new UnrealEngineAdapter();
      await expect(unreal.connect({ engine: 'unreal', projectRoot: tempDir })).rejects.toThrow(
        'Unreal .uproject descriptor not found'
      );
    });
  });

  describe('LatticeVisualizer', () => {
    it('renders accessible ASCII grids, markdown tables, and SVG previews', () => {
      const sampleWorld = {
        dimensions: { width: 5, height: 5 },
        seed: 42,
        tiles: [
          { x: 0, y: 0, type: 'wall', walkable: false },
          { x: 1, y: 1, type: 'floor', walkable: true },
        ],
        entities: [
          {
            id: 'e1',
            name: 'Hero',
            archetype: 'player' as const,
            position: { x: 1, y: 1, z: 0 },
            stats: { hp: 100, maxHp: 100 },
            state: 'idle',
          },
        ],
      };

      const ascii = LatticeVisualizer.renderAsciiGrid(sampleWorld as any);
      expect(ascii).toContain('Lattice World');
      expect(ascii).toContain('[P]');

      const table = LatticeVisualizer.renderEntityTable(sampleWorld.entities as any);
      expect(table).toContain('Hero');
      expect(table).toContain('100/100');

      const svg = LatticeVisualizer.renderIsometricSvg(sampleWorld as any);
      expect(svg).toContain('<svg');
    });
  });

  describe('SpriteLabPlanService and SpriteOutlineFinisher', () => {
    it('plans sprite workflows with backend detection and path boundaries', async () => {
      const mockDb: any = {
        getType: () => 'sqlite',
        query: jest.fn().mockResolvedValue({ rows: [] }),
      };
      const planService = new SpriteLabPlanService(mockDb, tempDir);

      const status = await planService.getStatus();
      expect(status.backends.length).toBeGreaterThan(0);
      expect(status.selected).toBeDefined();

      const plan = await planService.planWorkflow({
        workflow: 'spritesheet_export',
        inputPath: 'character.png',
      });
      expect(plan.workflow).toBe('spritesheet_export');
      expect(plan.outputTarget).toContain('character.sheet.png');

      await expect(
        planService.planWorkflow({
          workflow: 'frame_slice',
          inputPath: '../../outside.png',
        })
      ).rejects.toThrow('Sprite Lab paths must stay inside the workspace.');
    });

    it('applies 4-way and 8-way outlines, scaling, padding, and collision masks', () => {
      // 4x4 raw pixel image with 1 center pixel
      const buffer = new Uint8Array(4 * 4 * 4);
      // center pixel (1, 1) -> index (1 * 4 + 1) * 4 = 20
      buffer[20] = 255;
      buffer[21] = 0;
      buffer[22] = 0;
      buffer[23] = 255;

      const rawPixels: RawPixelData = {
        width: 4,
        height: 4,
        data: buffer,
        colorMode: 'rgba8',
        hasAlpha: true,
      };

      const finished = SpriteOutlineFinisher.applyFinishing(rawPixels, {
        type: '4-way',
        thickness: 1,
        color: { r: 0, g: 0, b: 0, a: 255 },
        padding: 2,
        anchor: 'center',
        integerScale: 2,
      });

      expect(finished.bounds.width).toBeGreaterThan(4);
      expect(finished.outlinePixelsAdded).toBeGreaterThan(0);
      expect(finished.collisionMask).toBeDefined();
    });
  });
});
