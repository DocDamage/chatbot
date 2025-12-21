/**
 * Marijuana Growing Source - Complete cannabis cultivation knowledge base
 */

import axios from 'axios';
import { KnowledgeSource, KnowledgeResult } from './KnowledgeSource';
import { logger } from '../observability/logger';

export class MarijuanaGrowingSource implements KnowledgeSource {
  name = 'marijuana_growing';
  private curatedSources = [
    { name: 'Grow Weed Easy', url: 'https://www.growweedeasy.com', description: 'Cannabis growing guides and tutorials' },
    { name: 'ILGM Growing Guide', url: 'https://www.ilgm.com/growing-marijuana', description: 'Marijuana growing information' },
    { name: 'Leafly Growing', url: 'https://www.leafly.com/growing', description: 'Cannabis cultivation resources' },
    { name: 'Cannabis Training University', url: 'https://www.cannabistraininguniversity.com', description: 'Professional cannabis cultivation' },
    { name: 'Royal Queen Seeds Guide', url: 'https://www.royalqueenseeds.com/blog', description: 'Cannabis growing guides' },
  ];

  private comprehensiveKnowledge = {
    'germination': {
      title: 'Cannabis Germination',
      content: 'Germination is the first stage of cannabis growth. Soak seeds in water for 12-24 hours, then place in a moist paper towel. Keep in a warm, dark place (70-85°F). Seeds should sprout in 1-7 days. Once taproot appears (1-2cm), plant seed root-down in growing medium.',
      confidence: 0.95,
    },
    'seedling': {
      title: 'Cannabis Seedling Stage',
      content: 'Seedling stage lasts 2-3 weeks. Provide 18-24 hours of light daily. Keep humidity at 65-70%. Temperature: 68-77°F. Water when top inch of soil is dry. Use gentle nutrients (1/4 strength). Ensure good air circulation.',
      confidence: 0.95,
    },
    'vegetative': {
      title: 'Vegetative Growth Stage',
      content: 'Vegetative stage lasts 3-16 weeks. Provide 18 hours light, 6 hours dark. Temperature: 70-85°F. Humidity: 40-60%. Increase nutrients gradually. Prune and train plants (LST, topping, FIMing). Monitor pH (6.0-7.0 for soil, 5.5-6.5 for hydro).',
      confidence: 0.95,
    },
    'flowering': {
      title: 'Flowering Stage',
      content: 'Switch to 12/12 light cycle to trigger flowering. Flowering lasts 8-11 weeks. Temperature: 65-80°F. Lower humidity to 40-50%. Reduce nitrogen, increase phosphorus and potassium. Monitor trichomes for harvest timing (cloudy = peak THC, amber = more CBD/CBN).',
      confidence: 0.95,
    },
    'harvesting': {
      title: 'Harvesting Cannabis',
      content: 'Harvest when 70-90% of trichomes are cloudy/amber. Cut plants at base. Trim fan leaves. Hang upside down in dark room (60-70°F, 45-55% humidity) for 7-14 days. When stems snap (not bend), buds are ready for curing.',
      confidence: 0.95,
    },
    'curing': {
      title: 'Curing Cannabis',
      content: 'Place dried buds in airtight jars (fill 75% full). Store in dark, cool place (60-70°F). Open jars daily for first week to release moisture (burping). After 2-4 weeks, cure is complete. Proper curing improves flavor, potency, and smoothness.',
      confidence: 0.95,
    },
    'nutrients': {
      title: 'Cannabis Nutrients',
      content: 'Cannabis needs N-P-K (Nitrogen, Phosphorus, Potassium) plus micronutrients. Seedling: low nutrients. Vegetative: high N, moderate P/K. Flowering: low N, high P/K. Also need: Calcium, Magnesium, Iron, Sulfur. Use quality nutrients designed for cannabis. Monitor pH and EC.',
      confidence: 0.95,
    },
    'lighting': {
      title: 'Cannabis Lighting',
      content: 'Lighting options: LED (efficient, low heat), HPS (high yield, hot), MH (good for veg), CFL (small grows). Seedling: 200-400 PPFD. Vegetative: 400-600 PPFD. Flowering: 600-900 PPFD. Light schedule: 18/6 for veg, 12/12 for flower. Ensure proper distance from canopy.',
      confidence: 0.95,
    },
    'growing_medium': {
      title: 'Growing Mediums',
      content: 'Soil: Easy for beginners, pH 6.0-7.0. Coco coir: Good drainage, pH 5.5-6.5. Hydroponics: Faster growth, pH 5.5-6.5. DWC, Ebb & Flow, NFT systems. Choose based on experience level and setup preferences.',
      confidence: 0.95,
    },
    'pests_diseases': {
      title: 'Pests and Diseases',
      content: 'Common pests: Spider mites, aphids, thrips, whiteflies. Prevention: Clean environment, proper airflow, beneficial insects. Treatment: Neem oil, insecticidal soap, pyrethrin. Diseases: Powdery mildew, root rot, bud rot. Prevention: Proper humidity, airflow, sanitation.',
      confidence: 0.95,
    },
  };

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async search(query: string, options: { limit?: number } = {}): Promise<KnowledgeResult[]> {
    const { limit = 10 } = options;
    const results: KnowledgeResult[] = [];

    try {
      const queryLower = query.toLowerCase();

      // Check comprehensive knowledge base
      for (const [key, knowledge] of Object.entries(this.comprehensiveKnowledge)) {
        if (queryLower.includes(key) || key.includes(queryLower)) {
          results.push({
            id: `marijuana_${key}`,
            title: knowledge.title,
            content: knowledge.content,
            source: 'marijuana_growing',
            url: '',
            metadata: { topic: key },
            confidence: knowledge.confidence,
          });
        }
      }

      // Search Wikipedia
      const wikiQuery = `${query} cannabis cultivation growing`;
      try {
        const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiQuery)}`;
        const wikiResponse = await axios.get(wikiUrl);
        const wiki = wikiResponse.data;

        results.push({
          id: `marijuana_wiki_${wikiQuery}`,
          title: wiki.title,
          content: wiki.extract || '',
          source: 'wikipedia',
          url: wiki.content_urls?.desktop?.page,
          metadata: { topic: 'marijuana_growing' },
          confidence: 0.85,
        });
      } catch {
        // Wikipedia not found
      }

      // Add curated sources
      for (const source of this.curatedSources.slice(0, limit - results.length)) {
        results.push({
          id: `marijuana_${source.name.replace(/\s+/g, '_')}`,
          title: `${source.name}: ${query}`,
          content: `${source.description}. Visit ${source.url} for comprehensive information about "${query}".`,
          source: 'marijuana_growing',
          url: source.url,
          metadata: { sourceName: source.name },
          confidence: 0.9,
        });
      }

      return results.slice(0, limit);
    } catch (error: any) {
      logger.error('Marijuana growing search failed', { error: error.message });
      return [];
    }
  }

  async getById(id: string): Promise<KnowledgeResult | null> {
    const topic = id.replace('marijuana_', '');
    const knowledge = this.comprehensiveKnowledge[topic as keyof typeof this.comprehensiveKnowledge];
    
    if (knowledge) {
      return {
        id,
        title: knowledge.title,
        content: knowledge.content,
        source: 'marijuana_growing',
        url: '',
        metadata: { topic },
        confidence: knowledge.confidence,
      };
    }
    
    return null;
  }
}

