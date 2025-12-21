/**
 * Knowledge Source - Interface for external knowledge sources
 */

export interface KnowledgeSource {
  name: string;
  search(query: string, options?: any): Promise<KnowledgeResult[]>;
  getById(id: string): Promise<KnowledgeResult | null>;
  isAvailable(): Promise<boolean>;
}

export interface KnowledgeResult {
  id: string;
  title: string;
  content: string;
  source: string;
  url?: string;
  metadata?: Record<string, any>;
  confidence?: number;
}

