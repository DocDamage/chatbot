import { GodotTool } from '../../tools/gamedev/GodotTool';
import { UnityTool } from '../../tools/gamedev/UnityTool';
import { UnrealTool } from '../../tools/gamedev/UnrealTool';
import { PhaserTool } from '../../tools/gamedev/PhaserTool';

export class EngineAdvisor {
  private godot = new GodotTool();
  private unity = new UnityTool();
  private unreal = new UnrealTool();
  private phaser = new PhaserTool();

  advise(input: string) {
    const text = input.toLowerCase();
    if (text.includes('unity')) return this.unity.guidance(input);
    if (text.includes('unreal')) return this.unreal.guidance(input);
    if (text.includes('phaser')) return this.phaser.guidance(input);
    return this.godot.guidance(input);
  }
}
