export class UnityTool {
  guidance(topic: string) {
    return {
      engine: 'Unity',
      source: 'Unity 6.4 Manual',
      topic,
      notes: ['Use version-aware Unity APIs and separate MonoBehaviour gameplay logic from data/config assets.']
    };
  }
}
