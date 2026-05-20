export class LevelDesignAdvisor {
  review(description: string) {
    return {
      description,
      checklist: ['Clear goal', 'Readable route', 'Escalating challenge', 'Recovery space', 'Memorable landmark', 'Failure feedback']
    };
  }
}
