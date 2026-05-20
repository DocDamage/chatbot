export class GodotTool {
  guidance(topic: string) {
    return {
      engine: 'Godot',
      source: 'Godot stable documentation',
      topic,
      notes: ['Prefer Godot 4 APIs: await signals, @export, @onready, instantiate(), and CharacterBody2D/3D.']
    };
  }
}
