export class PhaserTool {
  guidance(topic: string) {
    return {
      engine: 'Phaser',
      source: 'Phaser documentation',
      topic,
      notes: ['Use TypeScript scenes, preload/create/update separation, and explicit arcade physics tuning.']
    };
  }
}
