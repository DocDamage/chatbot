export type NluDomain =
  | 'music'
  | 'fl_studio_control'
  | 'coding'
  | 'market'
  | 'gamedev'
  | 'math'
  | 'story'
  | 'legal'
  | 'health'
  | 'security'
  | 'business'
  | 'philosophy'
  | 'language'
  | 'geography'
  | 'engineering'
  | 'history'
  | 'science'
  | 'pop_culture'
  | 'knowledge_os'
  | 'general';

export interface PhrasebookEntry {
  phrases: string[];
  intent: string;
  meaning: string;
  domain: NluDomain;
  route?: string;
  slots?: Record<string, string>;
  confidence?: number;
}

export type Phrasebook = PhrasebookEntry[];
