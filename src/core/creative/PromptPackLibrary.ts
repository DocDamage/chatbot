type PromptPackPrompt = {
  id: string;
  title: string;
  text: string;
};

export type PromptPack = {
  id: string;
  name: string;
  category: 'genre' | 'trope' | 'character_archetype' | 'scene_type' | 'tone_profile' | 'custom';
  prompts: PromptPackPrompt[];
  builtIn?: boolean;
};

export class PromptPackLibrary {
  private packs = new Map<string, PromptPack>();
  private nextId = 1;

  constructor() {
    this.seedBuiltIns();
  }

  create(input: Omit<PromptPack, 'id'>): PromptPack {
    const pack = { ...input, id: `prompt-pack-${this.nextId++}` };
    this.packs.set(pack.id, pack);
    return pack;
  }

  find(id: string): PromptPack | undefined {
    return this.packs.get(id);
  }

  list(): PromptPack[] {
    return Array.from(this.packs.values());
  }

  apply(packId: string, promptId: string, userPrompt: string): string {
    const pack = this.mustFind(packId);
    const prompt = pack.prompts.find(item => item.id === promptId);
    if (!prompt) {
      throw new Error(`Prompt not found: ${promptId}`);
    }
    return [userPrompt, '', `Prompt pack: ${pack.name}`, prompt.text].join('\n');
  }

  export(packId: string): string {
    return JSON.stringify(this.mustFind(packId), null, 2);
  }

  import(serialized: string): PromptPack {
    const parsed = JSON.parse(serialized) as PromptPack;
    const pack = { ...parsed, id: `prompt-pack-${this.nextId++}`, builtIn: false };
    this.packs.set(pack.id, pack);
    return pack;
  }

  delete(packId: string): void {
    this.packs.delete(packId);
  }

  private mustFind(id: string): PromptPack {
    const pack = this.find(id);
    if (!pack) {
      throw new Error(`Prompt pack not found: ${id}`);
    }
    return pack;
  }

  private seedBuiltIns(): void {
    this.packs.set('builtin-dark-horror', {
      id: 'builtin-dark-horror',
      name: 'Dark Horror Scene Kit',
      category: 'genre',
      builtIn: true,
      prompts: [
        { id: 'dread', title: 'Build dread', text: 'Escalate through implication, sensory contradiction, and delayed revelation.' },
      ],
    });
  }
}
