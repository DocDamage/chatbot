/**
 * Godot Project Inspector (PX08-T03)
 *
 * Provides bounded read-only inspection of Godot project configuration,
 * scenes (.tscn), node hierarchies, scripts (.gd), resources (.tres), and input maps.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  EngineProjectInfo,
  EngineSceneInfo,
  EngineScriptInfo,
  EngineNodeInfo,
  GameEngineError
} from '../engine/GameEngineTypes';
import { resolveProjectPath } from '../engine/ProjectPathGuard';

export class GodotProjectInspector {
  /**
   * Inspect high-level project metadata and configuration
   */
  public static inspectProject(projectRoot: string): EngineProjectInfo {
    const resolvedRoot = path.resolve(projectRoot);
    const projectGodotPath = path.join(resolvedRoot, 'project.godot');

    let projectName = path.basename(resolvedRoot);
    let mainScene: string | undefined;
    const configSummary: Record<string, any> = {};

    if (fs.existsSync(projectGodotPath)) {
      const content = fs.readFileSync(projectGodotPath, 'utf8');
      const nameMatch = content.match(/config\/name="([^"]+)"/);
      if (nameMatch) projectName = nameMatch[1];

      const sceneMatch = content.match(/run\/main_scene="([^"]+)"/);
      if (sceneMatch) mainScene = sceneMatch[1];

      const featuresMatch = content.match(/config\/features=PackedStringArray\(([^)]+)\)/);
      if (featuresMatch) {
        configSummary.features = featuresMatch[1].replace(/"/g, '').split(',').map(s => s.trim());
      }
    }

    const scenes: string[] = [];
    const scripts: string[] = [];
    const resources: string[] = [];
    const assets: string[] = [];

    const scan = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === '.git' || entry.name === '.godot') continue;
        const full = path.join(dir, entry.name);
        const rel = path.relative(resolvedRoot, full).replace(/\\/g, '/');

        if (entry.isDirectory()) {
          scan(full);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (ext === '.tscn' || ext === '.scn') scenes.push(rel);
          else if (ext === '.gd' || ext === '.cs') scripts.push(rel);
          else if (ext === '.tres' || ext === '.res') resources.push(rel);
          else if (['.png', '.jpg', '.wav', '.ogg', '.svg'].includes(ext)) assets.push(rel);
        }
      }
    };

    if (fs.existsSync(resolvedRoot)) {
      scan(resolvedRoot);
    }

    return {
      name: projectName,
      path: resolvedRoot,
      engine: 'godot',
      engineVersion: '4.2.x',
      mainScene,
      scenes,
      scripts,
      resources,
      assets,
      configSummary
    };
  }

  /**
   * Parse a Godot .tscn file into a structured EngineSceneInfo
   */
  public static inspectScene(projectRoot: string, sceneRelativePath: string): EngineSceneInfo {
    const resolvedPath = resolveProjectPath(projectRoot, sceneRelativePath);

    if (!fs.existsSync(resolvedPath)) {
      throw new GameEngineError('SCENE_NOT_FOUND', `Scene file not found: ${sceneRelativePath}`);
    }

    const content = fs.readFileSync(resolvedPath, 'utf8');
    const lines = content.split('\n');

    const nodes: EngineNodeInfo[] = [];
    let rootNode: EngineNodeInfo | null = null;
    const dependencies: string[] = [];

    // Parse ext_resource headers
    for (const line of lines) {
      const extMatch = line.match(/\[ext_resource\s+type="([^"]+)"\s+path="([^"]+)"\s+id="([^"]+)"\]/);
      if (extMatch) {
        dependencies.push(extMatch[2]);
      }
    }

    // Parse [node name="X" type="Y" parent="Z"]
    let currentNode: EngineNodeInfo | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      const nodeHeaderMatch = line.match(/\[node\s+name="([^"]+)"(?:\s+type="([^"]+)")?(?:\s+parent="([^"]*)")?/);
      if (nodeHeaderMatch) {
        const name = nodeHeaderMatch[1];
        const type = nodeHeaderMatch[2] || 'Node';
        const parentPath = nodeHeaderMatch[3] !== undefined ? nodeHeaderMatch[3] : undefined;

        currentNode = {
          id: `node-${nodes.length + 1}`,
          name,
          type,
          parentPath,
          children: [],
          properties: {}
        };

        nodes.push(currentNode);
        if (!parentPath || parentPath === '.') {
          if (!rootNode) rootNode = currentNode;
        }
        continue;
      }

      // If inside a node block, parse property assignments
      if (currentNode && line && !line.startsWith('[') && line.includes('=')) {
        const eqIdx = line.indexOf('=');
        const propKey = line.substring(0, eqIdx).trim();
        const propVal = line.substring(eqIdx + 1).trim();
        currentNode.properties[propKey] = propVal;
      }
    }

    // Build hierarchy
    if (!rootNode && nodes.length > 0) {
      rootNode = nodes[0];
    } else if (!rootNode) {
      rootNode = {
        id: 'node-root',
        name: 'Root',
        type: 'Node',
        children: [],
        properties: {}
      };
    }

    // Attach children to root for simplicity if flat
    for (const n of nodes) {
      if (n !== rootNode) {
        rootNode.children.push(n);
      }
    }

    return {
      path: sceneRelativePath,
      name: path.basename(sceneRelativePath, path.extname(sceneRelativePath)),
      rootNode,
      nodeCount: nodes.length,
      dependencies
    };
  }

  /**
   * Parse a GDScript file for exported methods, properties, and signals
   */
  public static inspectScript(projectRoot: string, scriptRelativePath: string): EngineScriptInfo {
    const resolvedPath = resolveProjectPath(projectRoot, scriptRelativePath);

    if (!fs.existsSync(resolvedPath)) {
      throw new GameEngineError('SCRIPT_VALIDATION_FAILED', `Script file not found: ${scriptRelativePath}`);
    }

    const content = fs.readFileSync(resolvedPath, 'utf8');
    const digest = crypto.createHash('sha256').update(content).digest('hex');
    const lines = content.split('\n');

    let extendsClass: string | undefined;
    const methods: EngineScriptInfo['methods'] = [];
    const properties: EngineScriptInfo['properties'] = [];
    const signals: EngineScriptInfo['signals'] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      const extMatch = trimmed.match(/^extends\s+([A-Za-z0-9_]+)/);
      if (extMatch) extendsClass = extMatch[1];

      const sigMatch = trimmed.match(/^signal\s+([A-Za-z0-9_]+)(?:\(([^)]*)\))?/);
      if (sigMatch) {
        const sigArgs = sigMatch[2] ? sigMatch[2].split(',').map(s => s.trim()) : [];
        signals.push({ name: sigMatch[1], args: sigArgs });
      }

      const varMatch = trimmed.match(/^(?:@export\s+)?var\s+([A-Za-z0-9_]+)(?::\s*([A-Za-z0-9_]+))?(?:\s*=\s*(.+))?/);
      if (varMatch) {
        properties.push({
          name: varMatch[1],
          type: varMatch[2] || 'Variant',
          defaultValue: varMatch[3]
        });
      }

      const funcMatch = trimmed.match(/^func\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)(?:\s*->\s*([A-Za-z0-9_]+))?/);
      if (funcMatch) {
        const args = funcMatch[2] ? funcMatch[2].split(',').map(s => s.trim()) : [];
        methods.push({
          name: funcMatch[1],
          args,
          returnType: funcMatch[3]
        });
      }
    }

    return {
      path: scriptRelativePath,
      language: 'gdscript',
      extendsClass,
      methods,
      properties,
      signals,
      linesOfCode: lines.length,
      digest
    };
  }
}
