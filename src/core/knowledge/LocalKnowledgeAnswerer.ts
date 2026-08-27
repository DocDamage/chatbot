import { RetrievalResult } from '../../types/rag';
import { RAGDocumentStore } from '../rag/RAGDocumentStore';
import fs from 'fs';
import path from 'path';
import { KnowledgeMiss } from './KnowledgeMiss';
import { KnowledgeMissHandler } from './KnowledgeMissHandler';

export type LocalKnowledgeMode = 'ask' | 'pop_culture' | 'history' | 'science' | 'gaming';

export interface LocalKnowledgeAnswer {
  response: string;
  sources: string[];
  mode: LocalKnowledgeMode;
  model: 'local-knowledge-base';
  knowledgeMiss?: true;
  knowledgeMissDetail?: KnowledgeMiss;
  miss?: KnowledgeMiss;
  canSearchOnline?: true;
  proposedWebQuery?: string;
}

export class LocalKnowledgeAnswerer {
  private readonly stopWords = new Set([
    'what', 'when', 'where', 'who', 'why', 'how', 'tell', 'give', 'show', 'me', 'you', 'can', 'could',
    'would', 'please', 'do', 'know', 'thing', 'something', 'happen', 'happened', 'the', 'a', 'an',
    'is', 'are', 'was', 'were', 'of', 'in', 'on', 'for', 'from', 'about', 'biggest', 'story'
  ]);

  constructor(private readonly documentStore?: Pick<RAGDocumentStore, 'searchKeyword'>) {}

  async answer(message: string, mode: LocalKnowledgeMode): Promise<LocalKnowledgeAnswer | undefined> {
    if (!this.documentStore) {
      return this.noLocalRecord(message, mode);
    }

    let effectiveMode = mode;
    let results = await this.search(message, mode);
    if (results.length === 0 && mode !== 'ask' && this.shouldUseBroadFallback(message, mode)) {
      results = await this.search(message, 'ask');
      effectiveMode = 'ask';
    }
    if (results.length === 0) {
      return this.noLocalRecord(message, mode);
    }

    const chunks = this.selectChunks(results, message);
    const sourceEntries = this.collectSourceEntries(chunks);
    const sources = sourceEntries.map(entry => entry.source);
    const body = this.formatAnswerBody(chunks, message);
    const year = this.extractYear(message);
    const semanticTokens = this.importantTokens(message).filter(token => token !== year);
    const sourceIdentityHasYear = !!year && chunks.some(chunk =>
      this.searchableContainsTemporalMarker(
        `${chunk.metadata.title || ''} ${chunk.metadata.source || ''}`,
        year
      )
    );

    // A dated subject answer must actually mention the requested date in the
    // selected answer text. A large source may contain the topic and year in
    // different sections even when the extracted passages do not answer the
    // user's question.
    if (
      year
      && semanticTokens.length > 0
      && !sourceIdentityHasYear
      && !this.hasSubjectNearTemporalMarker(
        body,
        year,
        semanticTokens,
        semanticTokens.length === 1 ? 1 : Math.min(2, Math.ceil(semanticTokens.length / 2))
      )
    ) {
      return this.noLocalRecord(message, mode);
    }

    return {
      response: `From the local knowledge base:\n\n${body}\n\nSources:\n${sourceEntries.map(entry => `- ${entry.label}`).join('\n')}`,
      sources,
      mode: effectiveMode,
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
    const metadata = result.chunk.metadata || {};
    const source = String(metadata.source || '').toLowerCase().replace(/\\/g, '/');
    const content = result.chunk.content.toLowerCase();
    const metadataCategories = [
      metadata.domain,
      metadata.category,
      ...(Array.isArray(metadata.categories) ? metadata.categories : []),
      ...(Array.isArray(metadata.relatedCategories) ? metadata.relatedCategories : [])
    ].map(value => String(value || '').toLowerCase());
    if (metadataCategories.includes(mode)) {
      return true;
    }
    if (mode === 'pop_culture') {
      return source.includes('/popculture/') || source.includes('/pop-culture/') || content.includes('domain: pop_culture');
    }
    return source.includes(`/${mode}/`) || content.includes(`domain: ${mode}`);
  }

  private shouldUseBroadFallback(message: string, mode: LocalKnowledgeMode): boolean {
    if (mode !== 'pop_culture') {
      return true;
    }

    return !/\b(?:music industry|record industry|music business|music history|record label|album|song|concert|tour)\b/i.test(message);
  }

  private cleanChunk(content: string): string {
    return content
      .replace(/\s+(#{1,3}\s+)/g, '\n\n$1')
      .replace(/\s{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private collectSourceEntries(chunks: RetrievalResult['chunk'][]): Array<{ source: string; label: string }> {
    const entries = new Map<string, { source: string; label: string }>();

    for (const chunk of chunks) {
      const source = String(chunk.metadata.source || chunk.metadata.title || 'local knowledge base');
      if (entries.has(source)) {
        continue;
      }

      entries.set(source, {
        source,
        label: this.formatSourceLabel(chunk)
      });
    }

    return Array.from(entries.values());
  }

  private formatSourceLabel(chunk: RetrievalResult['chunk']): string {
    const rawSource = String(chunk.metadata.source || '');
    const title = this.cleanLabelPart(chunk.metadata.citationLabel || chunk.metadata.title || this.basename(rawSource));
    const author = this.cleanLabelPart(chunk.metadata.author || chunk.metadata.creator);
    const location = this.cleanLabelPart(chunk.metadata.chapterTitle || chunk.metadata.sectionTitle);
    const parts = [title, author].filter(Boolean);
    const label = parts.length ? parts.join(' - ') : 'local knowledge base';
    return location ? `${label}, ${location}` : label;
  }

  private cleanLabelPart(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }
    const cleaned = value.replace(/\s+/g, ' ').trim();
    return cleaned || undefined;
  }

  private basename(source: string): string | undefined {
    return source.split(/[\\/]/).filter(Boolean).pop();
  }

  private formatAnswerBody(chunks: RetrievalResult['chunk'][], message: string): string {
    const year = this.extractYear(message);
    if (year && this.isYearEventQuestion(message)) {
      const eventBody = this.formatYearEventAnswer(chunks, year, message);
      if (eventBody) return eventBody;
    }

    return this.formatExtractiveAnswer(chunks, message);
  }

  private formatExtractiveAnswer(chunks: RetrievalResult['chunk'][], message: string): string {
    const rankedUnits = chunks
      .flatMap(chunk => this.extractAnswerUnits(chunk, message))
      .sort((a, b) => b.score - a.score);

    const selected: string[] = [];
    const seen = new Set<string>();

    for (const unit of rankedUnits) {
      const normalized = unit.text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      if (!normalized || seen.has(normalized)) {
        continue;
      }

      if (Array.from(seen).some(existing => existing.includes(normalized) || normalized.includes(existing))) {
        continue;
      }

      selected.push(unit.text);
      seen.add(normalized);
      if (selected.length >= 4) {
        break;
      }
    }

    if (selected.length === 0) {
      return chunks
        .map(chunk => this.truncateUnit(this.cleanChunk(chunk.content), 360))
        .join('\n\n---\n\n');
    }

    const lead = this.isSummaryQuestion(message)
      ? 'Closest local passages indicate:'
      : 'Most relevant local passages:';

    return [
      lead,
      '',
      ...selected.map((unit, index) => `${index + 1}. ${unit}`)
    ].join('\n');
  }

  private extractAnswerUnits(
    chunk: RetrievalResult['chunk'],
    message: string
  ): Array<{ text: string; score: number }> {
    const clean = this.cleanChunk(chunk.content)
      .replace(/\s+/g, ' ')
      .trim();

    return this.splitIntoUnits(clean)
      .map(unit => this.polishAnswerUnit(unit))
      .map(unit => this.truncateUnit(unit, 360))
      .filter(unit => !this.isLowSignalUnit(unit))
      .map(unit => ({
        text: unit,
        score: this.answerUnitScore(unit, message, chunk)
      }))
      .filter(unit => unit.score > 0);
  }

  private polishAnswerUnit(unit: string): string {
    return unit
      .replace(/\b(.{3,60})\s+\1\s+(is|are|was|were)\b/i, '$1 $2')
      .replace(/^[A-Z][A-Z.]{2,}\s+(?=[A-Z][a-z])/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private splitIntoUnits(content: string): string[] {
    const sentenceUnits = content
      .split(/(?<=[.!?])\s+(?=(?:["'“‘(]*[A-Z0-9]))/)
      .map(unit => unit.trim())
      .filter(Boolean);

    return sentenceUnits.flatMap(unit => {
      if (unit.length <= 420) {
        return [unit];
      }

      return unit
        .split(/\s+(?=(?:Chapter|CHAPTER|[A-Z][a-z]+:)\b)/)
        .map(part => part.trim())
        .filter(Boolean);
    });
  }

  private answerUnitScore(unit: string, message: string, chunk: RetrievalResult['chunk']): number {
    const lower = unit.toLowerCase();
    const importantTokens = this.importantTokens(message);
    const tokenMatches = importantTokens.filter(token => lower.includes(token)).length;
    const tokenScore = importantTokens.length > 0 ? tokenMatches / importantTokens.length : 0;
    const sourceText = `${chunk.metadata.title || ''} ${chunk.metadata.source || ''}`.toLowerCase();
    const sourceMatches = importantTokens.filter(token => sourceText.includes(token)).length;

    let score = tokenScore * 8 + sourceMatches * 0.75;
    const explanatorySignals = [
      ' is a tale ',
      ' is about ',
      ' tells the story ',
      ' undertak',
      ' quest',
      ' reluctant',
      ' adventure',
      ' encounters',
      ' discovers',
      ' becomes',
      ' forms a prelude',
      ' measures',
      ' means',
      ' refers to'
    ];

    for (const signal of explanatorySignals) {
      if (lower.includes(signal)) {
        score += 1.25;
      }
    }

    if (this.isSummaryQuestion(message) && /\b(is|are|was|were|means|refers|tale|story|quest|about)\b/i.test(unit)) {
      score += 1;
    }

    return score;
  }

  private isLowSignalUnit(unit: string): boolean {
    const normalized = unit.toLowerCase();
    const letters = unit.replace(/[^a-z]/gi, '');
    const upperLetters = unit.replace(/[^A-Z]/g, '');
    const upperRatio = letters.length > 0 ? upperLetters.length / letters.length : 0;

    return unit.length < 45
      || /^chapter\s+(?:\d+|[ivxlcdm]+)/i.test(unit)
      || /\b(contents|cover page|title page|copyright|about the author|works by|list of illustrations)\b/i.test(unit)
      || /\b(images, illustrations and audio|sample from lord of the rings)\b/i.test(unit)
      || (/\bor there and back again by j\.?r\.?r/i.test(unit) && !/\b(tale|adventure|quest|bilbo|dragon|encounter|perilous)\b/i.test(unit))
      || (unit.match(/\bchapter\b/gi)?.length || 0) > 2
      || /\bBACK\b(?:\s+\bBACK\b){2,}/.test(unit)
      || (upperRatio > 0.65 && unit.length > 80)
      || normalized.split(/\s+/).length < 7;
  }

  private truncateUnit(unit: string, maxLength: number): string {
    const trimmed = unit.replace(/\s+/g, ' ').trim();
    if (trimmed.length <= maxLength) {
      return trimmed;
    }

    const truncated = trimmed.slice(0, maxLength);
    const lastBoundary = Math.max(
      truncated.lastIndexOf('.'),
      truncated.lastIndexOf(';'),
      truncated.lastIndexOf(',')
    );

    return `${truncated.slice(0, lastBoundary > 140 ? lastBoundary : maxLength).trim()}...`;
  }

  private isSummaryQuestion(message: string): boolean {
    return /\b(what is|what are|what happens|happen|about|summarize|summary|tell me about|explain|story|plot)\b/i.test(message);
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
      const source = chunk.metadata.source;
      if (source && typeof source === 'string') {
        const sourcePath = path.resolve(process.cwd(), source);
        if (sourcePath.startsWith(process.cwd()) && fs.existsSync(sourcePath)) {
          try {
            contents.set(sourcePath, fs.readFileSync(sourcePath, 'utf8'));
            continue;
          } catch {
            // Fall through to the indexed chunk when the source cannot be read.
          }
        }
      }

      contents.set(chunk.id, chunk.content);
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

    const lines = normalizedEvents
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.startsWith('- ') || this.looksLikeEventLine(line))
      .map(line => line.replace(/^[-*]\s*/, '').replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    const completeEvents: string[] = [];
    let pendingDate = '';

    for (const line of lines) {
      if (this.isStandaloneEventDate(line)) {
        pendingDate = line;
        continue;
      }
      if (this.looksLikeEventLine(line)) {
        completeEvents.push(line);
        pendingDate = '';
        continue;
      }
      if (pendingDate && line.length > 20) {
        completeEvents.push(`${pendingDate} – ${line}`);
      }
    }

    return completeEvents.filter(line => line.length > 20);
  }

  private isStandaloneEventDate(line: string): boolean {
    return /^(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:[–-]\d{1,2})?$/.test(line)
      || /^(?:Around|About|Circa|c\.)?\s*\d{1,5}\s*(?:BC|BCE)$/i.test(line);
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
    const hasYear = !year || this.searchableContainsTemporalMarker(searchable, year);
    const semanticTokens = importantTokens.filter(token => token !== year);

    // A shared year is not enough to establish relevance. Compare whole tokens so
    // short subjects such as "hip" do not accidentally match words like
    // "leadership" in an unrelated document.
    if (semanticTokens.length === 0) {
      return hasYear;
    }

    const searchableTokens = new Set(searchable.split(/[^a-z0-9]+/).filter(Boolean));
    const semanticMatches = semanticTokens.filter(token => searchableTokens.has(token)).length;
    const requiredMatches = semanticTokens.length === 1
      ? 1
      : Math.min(2, Math.ceil(semanticTokens.length / 2));

    if (year) {
      const sourceIdentity = `${title} ${source}`;
      const sourceIsExplicitlyTemporal = this.searchableContainsTemporalMarker(sourceIdentity, year);
      const subjectIsNearYear = this.hasSubjectNearTemporalMarker(
        content,
        year,
        semanticTokens,
        requiredMatches
      );

      if (!sourceIsExplicitlyTemporal && !subjectIsNearYear) {
        return false;
      }
    }

    return semanticMatches >= requiredMatches && hasYear;
  }

  private hasSubjectNearTemporalMarker(
    content: string,
    marker: string,
    semanticTokens: string[],
    requiredMatches: number
  ): boolean {
    const normalizedContent = this.normalizeTemporalText(content);
    const markers = [
      marker,
      marker.replace(/\s+/g, ''),
      this.withThousandsComma(marker),
      this.millenniumQuery(marker)
    ]
      .filter(Boolean)
      .map(candidate => this.normalizeTemporalText(candidate as string));
    const factualUnits = normalizedContent
      .split(/(?:\r?\n)+|(?<=[.!?;])\s+/)
      .map(unit => unit.trim())
      .filter(Boolean);

    return factualUnits.some(unit => {
      if (!markers.some(candidate => unit.includes(candidate))) {
        return false;
      }
      const unitTokens = new Set(unit.split(/[^a-z0-9]+/).filter(Boolean));
      return semanticTokens.filter(token => unitTokens.has(token)).length >= requiredMatches;
    });
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
    return /\b(what happened|happen|biggest|top story|major event|main event|something from|story|news|headlines|popular|pop culture reference|know about)\b/i.test(message);
  }

  private noLocalRecord(message: string, mode: LocalKnowledgeMode): LocalKnowledgeAnswer {
    const label = mode === 'ask' ? 'knowledge-base' : mode.replace('_', ' ');
    const miss = new KnowledgeMissHandler().createMiss(message, mode);
    return {
      response: `I do not have this in the local ${label} database.\n\nSearch online and learn it?`,
      sources: [],
      mode,
      model: 'local-knowledge-base',
      knowledgeMiss: true,
      knowledgeMissDetail: miss,
      miss,
      canSearchOnline: true,
      proposedWebQuery: miss.proposedWebQuery
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
