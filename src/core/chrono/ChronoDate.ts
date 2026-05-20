export type ChronoPrecision = 'exact' | 'year' | 'decade' | 'century' | 'millennium' | 'range' | 'unknown' | 'approximate';
export type ChronoCalendar = 'gregorian' | 'julian' | 'bce_ce' | 'approximate';

export interface ChronoDate {
  startYear: number;
  endYear?: number;
  precision: ChronoPrecision;
  calendar: ChronoCalendar;
  confidence: number;
  note?: string;
}

export interface ChronoEntity {
  id: string;
  type: 'person' | 'place' | 'event' | 'work' | 'invention' | 'discovery' | 'civilization' | 'movement' | 'organization' | 'species' | 'technology';
  name: string;
  aliases: string[];
  startDate?: ChronoDate;
  endDate?: ChronoDate;
  domains: Array<'pop_culture' | 'history' | 'science' | 'invention'>;
  wikidataId?: string;
  externalIds?: Record<string, string>;
}

export interface ChronoEvent {
  id: string;
  name: string;
  date: ChronoDate;
  location?: string;
  domain: 'pop_culture' | 'history' | 'science' | 'invention';
  entityIds: string[];
  description: string;
  sourceIds: string[];
}

export interface ChronoClaim {
  id: string;
  entityId?: string;
  eventId?: string;
  claim: string;
  date?: ChronoDate;
  confidence: number;
  sourceIds: string[];
  status: 'verified' | 'disputed' | 'approximate' | 'uncertain' | 'deprecated';
}

export interface ChronoSource {
  id: string;
  title: string;
  url?: string;
  authority: 'primary' | 'academic' | 'institutional' | 'reference' | 'metadata' | 'community';
  sourceType: 'structured' | 'text' | 'scholarly' | 'patent' | 'institutional' | 'metadata';
  license?: string;
  confidence: number;
}
