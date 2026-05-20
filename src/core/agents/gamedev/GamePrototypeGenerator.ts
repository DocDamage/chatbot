export class GamePrototypeGenerator {
  generate(engine: string, idea: string) {
    return {
      engine,
      idea,
      files: [],
      plan: ['Create minimal scene/state.', 'Add player input.', 'Add one enemy/objective.', 'Add win/fail feedback.']
    };
  }
}
