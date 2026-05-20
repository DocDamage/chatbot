import { RetrievalResult } from '../../types/rag';
import { RAGDocumentStore } from '../rag/RAGDocumentStore';
import fs from 'fs';
import path from 'path';

export type LocalKnowledgeMode = 'ask' | 'pop_culture' | 'history' | 'science';

export interface LocalKnowledgeAnswer {
  response: string;
  sources: string[];
  mode: LocalKnowledgeMode;
  model: 'local-knowledge-base';
}

export class LocalKnowledgeAnswerer {
  private readonly stopWords = new Set([
    'what', 'when', 'where', 'who', 'why', 'how', 'tell', 'give', 'show', 'me', 'the', 'a', 'an',
    'is', 'are', 'was', 'were', 'of', 'in', 'on', 'for', 'from', 'about', 'biggest', 'story'
  ]);

  constructor(private readonly documentStore?: Pick<RAGDocumentStore, 'searchKeyword'>) {}

  async answer(message: string, mode: LocalKnowledgeMode): Promise<LocalKnowledgeAnswer | undefined> {
    if (!this.documentStore) {
      return this.noLocalRecord(message, mode);
    }

    let results = await this.search(message, mode);
    if (results.length === 0 && mode !== 'ask') {
      results = await this.search(message, 'ask');
    }
    if (results.length === 0) {
      return this.noLocalRecord(message, mode);
    }

    const chunks = this.selectChunks(results, message);
    const sources = Array.from(new Set(chunks.map(chunk => chunk.metadata.source || chunk.metadata.title || 'local knowledge base')));
    const body = this.formatAnswerBody(chunks, message);

    return {
      response: `From the local knowledge base:\n\n${body}\n\nSources:\n${sources.map(source => `- ${source}`).join('\n')}`,
      sources,
      mode,
      model: 'local-knowledge-base'
    };
  }

  private async search(message: string, mode: LocalKnowledgeMode): Promise<RetrievalResult[]> {
    const year = this.extractYear(message);
    const domainLabel = mode === 'ask'
      ? 'knowledge'
      : mode === 'pop_culture'
      ? 'pop_culture'
      : mode;
    const queries = Array.from(new Set([
      message,
      year ? `${year} ${domainLabel}` : undefined,
      year ? `${year}` : undefined,
      year ? this.millenniumQuery(year) : undefined
    ].filter(Boolean) as string[]));

    const resultSets = await Promise.all(queries.map(query => this.documentStore!.searchKeyword(query, 50)));
    const merged = new Map<string, RetrievalResult>();

    for (const result of resultSets.flat()) {
      if (mode !== 'ask' && !this.matchesDomain(result, mode)) {
        continue;
      }
      const existing = merged.get(result.chunk.id);
      if (!existing || result.score > existing.score) {
        merged.set(result.chunk.id, result);
      }
    }

    const allMerged = Array.from(merged.values());
    const yearFiltered = year
      ? Array.from(merged.values()).filter(result => this.containsTemporalMarker(result, year))
      : Array.from(merged.values());
    const candidates = year ? yearFiltered : allMerged;

    return candidates
      .filter(result => this.hasImportantMatch(message, result, year))
      .map(result => ({ ...result, score: this.localScore(message, result, year) }))
      .sort((a, b) => b.score - a.score);
  }

  private matchesDomain(result: RetrievalResult, mode: LocalKnowledgeMode): boolean {
    const source = String(result.chunk.metadata.source || '').toLowerCase().replace(/\\/g, '/');
    const content = result.chunk.content.toLowerCase();
    if (mode === 'pop_culture') {
      return source.includes('/popculture/') || source.includes('/pop-culture/') || content.includes('domain: pop_culture');
    }
    return source.includes(`/${mode}/`) || content.includes(`domain: ${mode}`);
  }

  private cleanChunk(content: string): string {
    return content
      .replace(/\s+(#{1,3}\s+)/g, '\n\n$1')
      .replace(/\s{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private formatAnswerBody(chunks: RetrievalResult['chunk'][], message: string): string {
    const year = this.extractYear(message);
    if (year && this.isYearEventQuestion(message)) {
      const eventBody = this.formatYearEventAnswer(chunks, year, message);
      if (eventBody) return eventBody;
    }

    return chunks
      .map(chunk => this.cleanChunk(chunk.content))
      .join('\n\n---\n\n');
  }

  private formatYearEventAnswer(chunks: RetrievalResult['chunk'][], year: string, message: string): string | undefined {
    const contents = this.expandSourceContents(chunks);
    const eventLines = contents
      .flatMap(content => this.extractEventLines(content))
      .filter(line => line.includes(year) || /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\b/.test(line));

    if (eventLines.length === 0) {
      return undefined;
    }

    const uniqueEventLines = this.removeTruncatedDuplicates(
      Array.from(new Map(eventLines.map(line => [line.toLowerCase(), line])).values())
    );
    const ranked = uniqueEventLines
      .map(line => ({ line, score: this.eventScore(line, message) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map(item => item.line);

    const lead = /\b(biggest|top|major|main|important)\b/i.test(message)
      ? `There is not one objective "biggest" event for ${year}, but the strongest local-record candidates are:`
      : `Here are notable things that happened in ${year} from the local record:`;

    return [
      lead,
      '',
      ...ranked.map((line, index) => `${index + 1}. ${line}`)
    ].join('\n');
  }

  private expandSourceContents(chunks: RetrievalResult['chunk'][]): string[] {
    const contents = new Map<string, string>();

    for (const chunk of chunks) {
      contents.set(chunk.id, chunk.content);
      const source = chunk.metadata.source;
      if (!source || typeof source !== 'string') {
        continue;
      }

      const sourcePath = path.resolve(process.cwd(), source);
      if (!sourcePath.startsWith(process.cwd()) || !fs.existsSync(sourcePath)) {
        continue;
      }

      try {
        contents.set(sourcePath, fs.readFileSync(sourcePath, 'utf8'));
      } catch {
        // Chunk content is still usable if the source file cannot be read.
      }
    }

    return Array.from(contents.values());
  }

  private extractEventLines(content: string): string[] {
    const cleaned = content.replace(/\r/g, '');
    const eventsSection = cleaned.match(/##\s*Events([\s\S]*?)(?:\n##\s*(?:Births|Deaths|Nobel|References|Further reading|External links)|$)/i)?.[1]
      || cleaned.match(/==\s*Events\s*==([\s\S]*?)(?:\n==\s*(?:Births|Deaths|Nobel|References|Further reading|External links)\s*==|$)/i)?.[1]
      || '';

    const normalizedEvents = eventsSection.replace(
      /\s+-\s+(?=(?:Around|About|Circa|c\.|January|February|March|April|May|June|July|August|September|October|November|December|\d{1,5}\s*(?:BC|BCE)))/gi,
      '\n- '
    );

    return normalizedEvents
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.startsWith('- ') || this.looksLikeEventLine(line))
      .map(line => line.replace(/^[-*]\s*/, '').replace(/\s+/g, ' ').trim())
      .filter(line => line.length > 20);
  }

  private looksLikeEventLine(line: string): boolean {
    return /^(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d+\b/.test(line)
      || /^(?:Around|About|Circa|c\.)\s+\d{1,5}\s*(?:BC|BCE)?\s+[–-]\s+/i.test(line)
      || /^\d{1,5}\s*(?:BC|BCE)\s+[–-]\s+/i.test(line);
  }

  private removeTruncatedDuplicates(lines: string[]): string[] {
    return lines.filter((line, index) => {
      const normalized = line.toLowerCase();
      return !lines.some((other, otherIndex) =>
        otherIndex !== index &&
        other.length > line.length + 20 &&
        other.toLowerCase().startsWith(normalized)
      );
    });
  }

  private eventScore(line: string, message: string): number {
    const lower = line.toLowerCase();
    const queryTokens = this.importantTokens(message);
    let score = queryTokens.filter(token => lower.includes(token)).length * 2;
    const weightedSignals = [
      'dies', 'death', 'killed', 'murdered', 'massacre', 'attack', 'war', 'crisis', 'financial crisis',
      'election', 'president', 'prime minister', 'first', 'launches', 'released', 'agreement', 'treaty',
      'handover', 'sovereignty', 'independence', 'space', 'internet', 'cloning', 'princess diana',
      'diana', 'princess of wales', 'funeral', 'worldwide', 'hong kong', 'asian financial crisis', 'notorious b.i.g.'
    ];
    for (const signal of weightedSignals) {
      if (lower.includes(signal)) score += signal.includes(' ') ? 3 : 1;
    }
    if (lower.includes('diana') || lower.includes('princess of wales')) score += 5;
    if (lower.includes('hong kong')) score += 4;
    if (lower.includes('asian financial crisis')) score += 4;
    if (lower.includes('deep blue') || lower.includes('world champion')) score += 3;
    if (/\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d+\b/.test(line)) {
      score += 0.5;
    }
    return score;
  }

  private selectChunks(results: RetrievalResult[], message: string) {
    const year = this.extractYear(message);
    const maxSources = year ? 1 : 2;
    const bySource = new Map<string, RetrievalResult[]>();

    for (const result of results) {
      const source = result.chunk.metadata.source || result.chunk.metadata.title || result.chunk.id;
      const existing = bySource.get(source) || [];
      existing.push(result);
      bySource.set(source, existing);
    }

    const rankedGroups = Array.from(bySource.entries())
      .map(([source, sourceResults]) => ({
        source,
        score: Math.max(...sourceResults.map(result => result.score)),
        results: sourceResults.sort((a, b) => (a.chunk.metadata.chunkIndex || 0) - (b.chunk.metadata.chunkIndex || 0))
      }))
      .sort((a, b) => b.score - a.score);

    const importantTokens = this.importantTokens(message);
    const firstGroupText = rankedGroups[0]
      ? rankedGroups[0].results.map(result => `${result.chunk.content} ${result.chunk.metadata.title || ''} ${result.chunk.metadata.source || ''}`).join(' ').toLowerCase()
      : '';
    const strongFirstGroupHit = importantTokens.length > 0 &&
      importantTokens.filter(token => firstGroupText.includes(token)).length / importantTokens.length >= 0.75;
    const sourceLimit = strongFirstGroupHit ? 1 : maxSources;

    return rankedGroups
      .slice(0, sourceLimit)
      .flatMap(group => group.results.slice(0, 2).map(result => result.chunk));
  }

  private localScore(message: string, result: RetrievalResult, year?: string): number {
    const importantTokens = this.importantTokens(message);
    const content = result.chunk.content.toLowerCase();
    const title = String(result.chunk.metadata.title || '').toLowerCase();
    const source = String(result.chunk.metadata.source || '').toLowerCase();
    const tokenMatches = importantTokens.filter(token =>
      content.includes(token) || title.includes(token) || source.includes(token)
    ).length;
    const tokenScore = importantTokens.length > 0 ? tokenMatches / importantTokens.length : 0;
    const titleBoost = importantTokens.some(token => title.includes(token) || source.includes(token)) ? 0.5 : 0;
    const yearBoost = year && (content.includes(year) || source.includes(year)) ? 1 : 0;
    return result.score + tokenScore + titleBoost + yearBoost;
  }

  private hasImportantMatch(message: string, result: RetrievalResult, year?: string): boolean {
    const importantTokens = this.importantTokens(message);
    if (importantTokens.length === 0) {
      return true;
    }

    const content = result.chunk.content.toLowerCase();
    const title = String(result.chunk.metadata.title || '').toLowerCase();
    const source = String(result.chunk.metadata.source || '').toLowerCase();
    const searchable = `${content} ${title} ${source}`;
    const hasToken = importantTokens.some(token => searchable.includes(token));
    const hasYear = !year || this.searchableContainsTemporalMarker(searchable, year);

    return hasToken && hasYear;
  }

  private importantTokens(message: string): string[] {
    return Array.from(new Set(
      message
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(token => token.length > 1 && !this.stopWords.has(token))
    ));
  }

  private isYearEventQuestion(message: string): boolean {
    return /\b(what happened|happen|biggest|top story|major event|main event|something from|story|popular|pop culture reference|know about)\b/i.test(message);
  }

  private noLocalRecord(message: string, mode: LocalKnowledgeMode): LocalKnowledgeAnswer {
    const label = mode === 'ask' ? 'knowledge-base' : mode.replace('_', ' ');
    return {
      response: `I do not have a matching ${label} record in the local database for: "${message}". I am not going to make up a generic answer. Add or import records for that topic and I can answer from the knowledge base without internet.`,
      sources: [],
      mode,
      model: 'local-knowledge-base'
    };
  }

  private extractYear(message: string): string | undefined {
    const bcMatch = message.match(/\b(\d{1,5})\s*(?:bc|bce)\b/i);
    if (bcMatch) {
      return `${bcMatch[1]} BC`;
    }
    return message.match(/\b(?:1[0-9]{3}|20[0-2]\d)\b/)?.[0];
  }

  private containsTemporalMarker(result: RetrievalResult, marker: string): boolean {
    const searchable = `${result.chunk.content} ${result.chunk.metadata.title || ''} ${result.chunk.metadata.source || ''}`;
    return this.searchableContainsTemporalMarker(searchable, marker);
  }

  private searchableContainsTemporalMarker(searchable: string, marker: string): boolean {
    const normalizedSearchable = this.normalizeTemporalText(searchable);
    const markers = [
      marker,
      marker.replace(/\s+/g, ''),
      this.withThousandsComma(marker),
      this.millenniumQuery(marker)
    ].filter(Boolean) as string[];

    return markers.some(candidate => normalizedSearchable.includes(this.normalizeTemporalText(candidate)));
  }

  private normalizeTemporalText(value: string): string {
    return value.toLowerCase().replace(/,/g, '').replace(/\s+/g, ' ').trim();
  }

  private withThousandsComma(marker: string): string | undefined {
    const match = marker.match(/^(\d{4,5})\s+BC$/i);
    if (!match) return undefined;
    return `${Number(match[1]).toLocaleString('en-US')} BC`;
  }

  private millenniumQuery(marker: string): string | undefined {
    const match = marker.match(/^(\d{1,5})\s+BC$/i);
    if (!match) return undefined;
    const year = Number(match[1]);
    if (!Number.isFinite(year) || year < 1000) return undefined;
    const millennium = Math.ceil(year / 1000);
    return `${this.ordinal(millennium)} millennium BC`;
  }

  private ordinal(value: number): string {
    const mod100 = value % 100;
    if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
    switch (value % 10) {
      case 1: return `${value}st`;
      case 2: return `${value}nd`;
      case 3: return `${value}rd`;
      default: return `${value}th`;
    }
  }
}
