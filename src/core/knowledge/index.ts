/**
 * Knowledge Sources Index - Central export point for all knowledge sources
 */

// Base classes and helpers
export { KnowledgeSource, KnowledgeResult } from './KnowledgeSource';
export { BaseKnowledgeSource } from './BaseKnowledgeSource';
export { getByIdForTopicSource, createTopicGetById } from './KnowledgeSourceHelper';

// Query enhancement
export { QueryEnhancer } from './QueryEnhancer';
export type { EnhancedQuery, EntityInfo } from './QueryEnhancer';

// General Purpose Sources
export { WikipediaSource } from './WikipediaSource';
export { YouTubeSource } from './YouTubeSource';
export { RedditSource } from './RedditSource';
export { StackOverflowSource } from './StackOverflowSource';
export { MediumSource } from './MediumSource';
export { QuoraSource } from './QuoraSource';
export { NewsSource } from './NewsSource';
export { GitHubSource } from './GitHubSource';

// Educational Sources
export { UniversitySource } from './UniversitySource';
export { DocumentationSource } from './DocumentationSource';
export { LibraryOfCongressSource } from './LibraryOfCongressSource';
export { ProjectGutenbergSource } from './ProjectGutenbergSource';
export { BookSource } from './BookSource';
export { ScientificPapersSource } from './ScientificPapersSource';

// Specialized Knowledge Sources
export { AnatomySource } from './AnatomySource';
export { AstrologySource } from './AstrologySource';
export { AstronomySource } from './AstronomySource';
export { BackendDesignSource } from './BackendDesignSource';
export { BotanySource } from './BotanySource';
export { CNASource } from './CNASource';
export { DSPSource } from './DSPSource';
export { FinancialAdviceSource } from './FinancialAdviceSource';
export { GardeningSource } from './GardeningSource';
export { LLMProgrammingSource } from './LLMProgrammingSource';
export { MarijuanaGrowingSource } from './MarijuanaGrowingSource';
export { MentalHealthSource } from './MentalHealthSource';
export { MusicTheorySource } from './MusicTheorySource';
export { PotterySource } from './PotterySource';
export { ReligionSource } from './ReligionSource';
export { RNSource } from './RNSource';
export { SpecializedTopicSource } from './SpecializedTopicSource';
export { UIDesignSource } from './UIDesignSource';
export { WebDesignSource } from './WebDesignSource';
export { SongwritingStyleSource } from './SongwritingStyleSource';
export { PersonalResearchSource } from './PersonalResearchSource';

// Entertainment Sources
export { EntertainmentSource } from './EntertainmentSource';

// All sources map for dynamic loading
export const KnowledgeSources = {
    // General
    wikipedia: () => new (require('./WikipediaSource').WikipediaSource)(),
    youtube: () => new (require('./YouTubeSource').YouTubeSource)(),
    reddit: () => new (require('./RedditSource').RedditSource)(),
    stackoverflow: () => new (require('./StackOverflowSource').StackOverflowSource)(),
    medium: () => new (require('./MediumSource').MediumSource)(),
    quora: () => new (require('./QuoraSource').QuoraSource)(),
    news: () => new (require('./NewsSource').NewsSource)(),
    github: () => new (require('./GitHubSource').GitHubSource)(),

    // Educational
    university: () => new (require('./UniversitySource').UniversitySource)(),
    documentation: () => new (require('./DocumentationSource').DocumentationSource)(),
    library_of_congress: () => new (require('./LibraryOfCongressSource').LibraryOfCongressSource)(),
    gutenberg: () => new (require('./ProjectGutenbergSource').ProjectGutenbergSource)(),
    books: () => new (require('./BookSource').BookSource)(),
    scientific_papers: () => new (require('./ScientificPapersSource').ScientificPapersSource)(),

    // Specialized
    anatomy: () => new (require('./AnatomySource').AnatomySource)(),
    astrology: () => new (require('./AstrologySource').AstrologySource)(),
    astronomy: () => new (require('./AstronomySource').AstronomySource)(),
    backend_design: () => new (require('./BackendDesignSource').BackendDesignSource)(),
    botany: () => new (require('./BotanySource').BotanySource)(),
    cna: () => new (require('./CNASource').CNASource)(),
    dsp: () => new (require('./DSPSource').DSPSource)(),
    financial_advice: () => new (require('./FinancialAdviceSource').FinancialAdviceSource)(),
    gardening: () => new (require('./GardeningSource').GardeningSource)(),
    llm_programming: () => new (require('./LLMProgrammingSource').LLMProgrammingSource)(),
    marijuana_growing: () => new (require('./MarijuanaGrowingSource').MarijuanaGrowingSource)(),
    mental_health: () => new (require('./MentalHealthSource').MentalHealthSource)(),
    music_theory: () => new (require('./MusicTheorySource').MusicTheorySource)(),
    pottery: () => new (require('./PotterySource').PotterySource)(),
    religion: () => new (require('./ReligionSource').ReligionSource)(),
    rn: () => new (require('./RNSource').RNSource)(),
    specialized_topic: (topic: string) => new (require('./SpecializedTopicSource').SpecializedTopicSource)(topic),
    ui_design: () => new (require('./UIDesignSource').UIDesignSource)(),
    web_design: () => new (require('./WebDesignSource').WebDesignSource)(),
    songwriting_style: () => new (require('./SongwritingStyleSource').SongwritingStyleSource)(),
    personal_research: () => new (require('./PersonalResearchSource').PersonalResearchSource)(),

    // Entertainment
    entertainment: () => new (require('./EntertainmentSource').EntertainmentSource)(),
};

/**
 * Get a knowledge source by name
 */
export function getKnowledgeSource(name: string, ...args: any[]): KnowledgeSource | null {
    const factory = (KnowledgeSources as any)[name];
    if (factory) {
        return factory(...args);
    }
    return null;
}

/**
 * Get all available knowledge sources
 */
export function getAllKnowledgeSources(): KnowledgeSource[] {
    return Object.keys(KnowledgeSources)
        .filter(key => key !== 'specialized_topic')
        .map(key => (KnowledgeSources as any)[key]());
}

// Import the interface
import { KnowledgeSource as KnowledgeSourceInterface } from './KnowledgeSource';
type KnowledgeSource = KnowledgeSourceInterface;
