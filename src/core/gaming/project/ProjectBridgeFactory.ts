import { GameEngineBridge } from '../engine/GameEngineBridge';
import { GodotMcpXAdapter } from '../godot/GodotMcpXAdapter';
import { GodotCliBackend } from '../godot/GodotCliBackend';
import { UnityEngineAdapter } from '../unity/UnityEngineAdapter';
import { UnrealEngineAdapter } from '../unreal/UnrealEngineAdapter';
import { InstalledGameEditorBackend } from '../../native-runtime/NativeGameEditorBackends';
import { EnrolledProject, ProjectEnrollmentError } from './ProjectEnrollmentTypes';

export type ProjectBridgeFactory = (project: EnrolledProject) => GameEngineBridge;

/** New bridge and adapter per session; only the enrolled executable may back native calls. */
export function projectBridgeFactory(workspaceRoot: string): ProjectBridgeFactory {
  return project => {
    const runtime = project.profile.runtime;
    if (!runtime || project.profile.resolution !== 'resolved') throw new ProjectEnrollmentError('PROJECT_PROFILE_UNRESOLVED', 'Resolve the exact project/runtime profile before connecting.');
    const bridge = new GameEngineBridge();
    bridge.addApprovedRoot(workspaceRoot);
    if (runtime.engine === 'godot') {
      const backend = new GodotCliBackend(runtime.executablePath, process.cwd());
      bridge.registerAdapter(new GodotMcpXAdapter(backend, backend));
    } else {
      const backend = new InstalledGameEditorBackend({ [runtime.engine]: runtime.executablePath, ollamaEndpoint: '' });
      if (runtime.engine === 'unity') bridge.registerAdapter(new UnityEngineAdapter(backend));
      else if (runtime.engine === 'unreal') bridge.registerAdapter(new UnrealEngineAdapter(backend));
      else throw new ProjectEnrollmentError('PROJECT_SESSION_UNSUPPORTED', 'This enrolled engine has no qualified session adapter.');
    }
    return bridge;
  };
}
