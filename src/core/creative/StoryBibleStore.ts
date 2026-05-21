import { StoryBibleContext } from './CreativeTypes';

type StoryBibleItem = {
  id: string;
  name?: string;
  title?: string;
  role?: string;
  description?: string;
  summary?: string;
  text?: string;
  order?: number;
  pinned?: boolean;
};

export type StoryBibleRecord = {
  id: string;
  title: string;
  characters: StoryBibleItem[];
  locations: StoryBibleItem[];
  factions: StoryBibleItem[];
  loreRules: StoryBibleItem[];
  timelineEvents: StoryBibleItem[];
  chapters: StoryBibleItem[];
  scenes: StoryBibleItem[];
  styleGuide: StoryBibleItem[];
  ratingRules: StoryBibleItem[];
  continuityNotes: StoryBibleItem[];
};

type StoryBibleInput = Partial<Omit<StoryBibleRecord, 'id'>> & { title: string };

export class StoryBibleStore {
  private bibles = new Map<string, StoryBibleRecord>();
  private nextId = 1;

  create(input: StoryBibleInput): StoryBibleRecord {
    const bible: StoryBibleRecord = {
      id: `bible-${this.nextId++}`,
      title: input.title,
      characters: input.characters || [],
      locations: input.locations || [],
      factions: input.factions || [],
      loreRules: input.loreRules || [],
      timelineEvents: input.timelineEvents || [],
      chapters: input.chapters || [],
      scenes: input.scenes || [],
      styleGuide: input.styleGuide || [],
      ratingRules: input.ratingRules || [],
      continuityNotes: input.continuityNotes || [],
    };
    this.bibles.set(bible.id, bible);
    return bible;
  }

  get(id: string): StoryBibleRecord {
    const bible = this.bibles.get(id);
    if (!bible) {
      throw new Error(`Story bible not found: ${id}`);
    }
    return bible;
  }

  update(id: string, patch: Partial<StoryBibleInput>): StoryBibleRecord {
    const current = this.get(id);
    const next = { ...current, ...patch, id };
    this.bibles.set(id, next);
    return next;
  }

  buildContext(id: string, options: { pinnedOnly?: boolean } = { pinnedOnly: true }): StoryBibleContext {
    const bible = this.get(id);
    return {
      characters: this.renderItems(bible.characters, options.pinnedOnly),
      locations: this.renderItems(bible.locations, options.pinnedOnly),
      factions: this.renderItems(bible.factions, options.pinnedOnly),
      loreRules: this.renderItems(bible.loreRules, options.pinnedOnly),
      timelineEvents: this.renderItems(
        [...bible.timelineEvents].sort((a, b) => (a.order || 0) - (b.order || 0)),
        options.pinnedOnly
      ),
      chapters: this.renderItems(bible.chapters, options.pinnedOnly),
      scenes: this.renderItems(bible.scenes, options.pinnedOnly),
      styleGuide: this.renderItems(bible.styleGuide, options.pinnedOnly),
      ratingRules: this.renderItems(bible.ratingRules, options.pinnedOnly),
      continuityNotes: this.renderItems(bible.continuityNotes, options.pinnedOnly),
    };
  }

  private renderItems(items: StoryBibleItem[], pinnedOnly = true): string[] {
    return items
      .filter(item => !pinnedOnly || item.pinned)
      .map(item => {
        const label = item.name || item.title || item.summary || item.text || item.id;
        const detail = item.role || item.description;
        return detail ? `${label} - ${detail}` : label;
      });
  }
}
