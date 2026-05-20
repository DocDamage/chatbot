export class UnrealTool {
  guidance(topic: string) {
    return {
      engine: 'Unreal',
      source: 'Epic Unreal Engine documentation',
      topic,
      notes: ['State target Unreal version before giving Blueprint or C++ API-specific guidance.']
    };
  }
}
