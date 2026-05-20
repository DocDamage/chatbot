import { Phrasebook } from '../DomainPhrasebook';

export const knowledgeOsPhrasebook: Phrasebook = [
  {
    phrases: ['knowledge os', 'knowledge system status', 'what is in your database', 'how many chunks', 'how many sources'],
    intent: 'knowledge_os.status',
    meaning: 'inspect the local knowledge operating system, RAG persistence, and database counts',
    domain: 'knowledge_os',
    route: 'knowledge_os',
    confidence: 0.9
  },
  {
    phrases: ['show the knowledge graph', 'graph centrality', 'most connected nodes', 'what is connected'],
    intent: 'knowledge_os.graph',
    meaning: 'inspect the local knowledge graph and central nodes',
    domain: 'knowledge_os',
    route: 'knowledge_os',
    confidence: 0.9
  },
  {
    phrases: ['search local wiki', 'local wiki pages', 'wiki pages', 'ingest wiki'],
    intent: 'knowledge_os.wiki',
    meaning: 'inspect or manage the local markdown knowledge wiki',
    domain: 'knowledge_os',
    route: 'knowledge_os',
    confidence: 0.86
  },
  {
    phrases: ['private memory', 'what do you remember', 'pending memories', 'memory stats'],
    intent: 'knowledge_os.memory',
    meaning: 'inspect local private memory state and relevant memories',
    domain: 'knowledge_os',
    route: 'knowledge_os',
    confidence: 0.86
  }
];
