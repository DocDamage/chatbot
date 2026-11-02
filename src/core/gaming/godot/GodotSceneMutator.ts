/**
 * Godot Scene & Resource Mutator (PX08-T06)
 *
 * Implements safe, structured scene creations, node additions/removals,
 * property modifications, and signal connections on Godot .tscn and .tres files.
 */

import * as fs from 'fs';
import * as path from 'path';
import { EngineMutationAction, GameEngineError } from '../engine/GameEngineTypes';
import { resolveProjectPath } from '../engine/ProjectPathGuard';

export class GodotSceneMutator {
  /**
   * Apply an engine mutation action to a scene or resource file
   */
  public static async applyAction(action: EngineMutationAction, projectRoot: string): Promise<void> {
    const fullPath = resolveProjectPath(projectRoot, action.targetPath);

    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    switch (action.type) {
      case 'create_scene': {
        const rootNodeType = action.params.rootNodeType || 'Node2D';
        const rootNodeName = action.params.rootNodeName || 'Main';
        const sceneContent = `[gd_scene format=3 uid="uid://${Math.random().toString(36).substring(2, 12)}"]\n\n[node name="${rootNodeName}" type="${rootNodeType}"]\n`;
        fs.writeFileSync(fullPath, sceneContent, 'utf8');
        break;
      }

      case 'delete_scene': {
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
        break;
      }

      case 'add_node': {
        if (!fs.existsSync(fullPath)) {
          throw new GameEngineError('SCENE_NOT_FOUND', `Cannot add node; scene file not found: ${action.targetPath}`);
        }
        const nodeName = action.params.nodeName;
        const nodeType = action.params.nodeType || 'Node';
        const parent = action.params.parent || '.';

        if (!nodeName) {
          throw new GameEngineError('NODE_NOT_FOUND', 'nodeName parameter is required');
        }

        const nodeBlock = `\n[node name="${nodeName}" type="${nodeType}" parent="${parent}"]\n`;
        fs.appendFileSync(fullPath, nodeBlock, 'utf8');
        break;
      }

      case 'set_property': {
        if (!fs.existsSync(fullPath)) {
          throw new GameEngineError('SCENE_NOT_FOUND', `Scene file not found: ${action.targetPath}`);
        }
        const nodeName = action.params.nodeName;
        const propName = action.params.propertyName;
        const propValue = action.params.value;

        let content = fs.readFileSync(fullPath, 'utf8');
        const nodeRegex = new RegExp(`(\\[node name="${nodeName}"[^\\]]*\\][\\s\\S]*?)(?=\\n\\[node|\\n\\[connection|$)`);
        const match = content.match(nodeRegex);

        if (match) {
          const nodeHeader = match[1];
          const updatedNode = `${nodeHeader}\n${propName} = ${propValue}`;
          content = content.replace(nodeRegex, updatedNode);
          fs.writeFileSync(fullPath, content, 'utf8');
        } else {
          // If flat append
          content += `\n${propName} = ${propValue}\n`;
          fs.writeFileSync(fullPath, content, 'utf8');
        }
        break;
      }

      case 'connect_signal': {
        if (!fs.existsSync(fullPath)) {
          throw new GameEngineError('SCENE_NOT_FOUND', `Scene file not found: ${action.targetPath}`);
        }
        const signal = action.params.signal;
        const from = action.params.from;
        const to = action.params.to;
        const method = action.params.method;

        const connectionBlock = `\n[connection signal="${signal}" from="${from}" to="${to}" method="${method}"]\n`;
        fs.appendFileSync(fullPath, connectionBlock, 'utf8');
        break;
      }

      case 'modify_resource': {
        const resourceType = action.params.resourceType || 'Resource';
        const properties = action.params.properties || {};
        let resourceContent = `[gd_resource type="${resourceType}" format=3]\n\n[resource]\n`;
        for (const [k, v] of Object.entries(properties)) {
          resourceContent += `${k} = ${v}\n`;
        }
        fs.writeFileSync(fullPath, resourceContent, 'utf8');
        break;
      }

      default:
        // Let other handlers or scripts process
        break;
    }
  }
}
