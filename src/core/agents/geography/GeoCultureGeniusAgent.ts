import { GenericSpecialistAgent } from '../specialists/GenericSpecialistAgent';
import { CountryProfileTool } from '../../tools/geography/CountryProfileTool';
import { CulturalEtiquetteTool } from '../../tools/geography/CulturalEtiquetteTool';
import { DemographicsTool } from '../../tools/geography/DemographicsTool';
import { GeoTimelineTool } from '../../tools/geography/GeoTimelineTool';
import { LanguageRegionTool } from '../../tools/geography/LanguageRegionTool';
import { MapLookupTool } from '../../tools/geography/MapLookupTool';

const profile = {
  id: "geography",
  label: "Geography / World Cultures Genius",
  guardrails: [
    "Distinguish culture, stereotype, law, religion, ethnicity, and politics.",
    "Avoid flattening groups into one description.",
    "Flag contested geopolitical claims."
  ],
  workflows: [
    "Classify country, culture, map, demographics, or geopolitical intent.",
    "Retrieve geography/history/culture context.",
    "Return location, people, uncertainty, and caveats."
  ],
  tools: [
    "CountryProfileTool",
    "MapLookupTool",
    "DemographicsTool",
    "LanguageRegionTool",
    "CulturalEtiquetteTool",
    "GeoTimelineTool"
  ],
  defaultSources: [
    "knowledge-base-public/geography/overview.md"
  ]
};

export class GeoCultureGeniusAgent extends GenericSpecialistAgent {
  private countryProfileTool = new CountryProfileTool();
  private mapLookupTool = new MapLookupTool();
  private demographicsTool = new DemographicsTool();
  private languageRegionTool = new LanguageRegionTool();
  private culturalEtiquetteTool = new CulturalEtiquetteTool();
  private geoTimelineTool = new GeoTimelineTool();

  constructor(documentStore?: any) {
    super(profile, documentStore);
  }

  override async ask(query: string, mode = 'ask') {
    const toolResponse = this.toolFirstResponse(query, mode);
    if (toolResponse) {
      return toolResponse;
    }

    return super.ask(query, mode);
  }

  country(query: string) {
    return this.ask(query, 'country');
  }

  culture(query: string) {
    return this.ask(query, 'culture');
  }

  mapContext(query: string) {
    return this.ask(query, 'map-context');
  }

  private toolFirstResponse(query: string, mode: string) {
    const text = query.toLowerCase();
    const results: Array<Record<string, any>> = [];

    if (mode === 'country' || /\b(country profile|capital|government|japan|brazil|nigeria|france|india|united states|usa)\b/.test(text)) {
      results.push(this.countryProfileTool.run({ query }));
      results.push(this.mapLookupTool.run({ query }));
    } else if (mode === 'culture' || /\b(culture|etiquette|custom|tradition|travel|business meeting|religion|food norms)\b/.test(text)) {
      results.push(this.culturalEtiquetteTool.run({ query }));
      results.push(this.languageRegionTool.run({ query }));
    } else if (mode === 'map-context' || /\b(map|border|territory|mountain|river|route|migration|city|region)\b/.test(text)) {
      results.push(this.mapLookupTool.run({ query }));
      results.push(this.geoTimelineTool.run({ query }));
    } else if (/\b(demographics|population|language|religion|urban|rural|migration)\b/.test(text)) {
      results.push(this.demographicsTool.run({ query }));
      results.push(this.languageRegionTool.run({ query }));
    } else if (/\b(timeline|history|geopolitical|geography)\b/.test(text)) {
      results.push(this.geoTimelineTool.run({ query }));
      results.push(this.mapLookupTool.run({ query }));
    } else {
      return undefined;
    }

    return {
      domain: 'geography',
      mode,
      response: [
        `Geography / World Cultures Genius (${mode})`,
        '',
        `Request: ${query}`,
        '',
        'Geography tool results:',
        ...results.map(result => `- ${result.tool}: ${JSON.stringify(result, null, 2)}`),
        '',
        'Guardrails:',
        ...profile.guardrails.map(rule => `- ${rule}`)
      ].join('\n'),
      sources: ['deterministic geography tools'],
      guardrails: profile.guardrails,
      tools: results.map(result => String(result.tool || 'geography-tool')),
      model: 'geography-tools'
    };
  }
}
