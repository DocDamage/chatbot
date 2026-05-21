import { GISChatResponse, GeocodeRequest, ParcelSearchRequest, PlaceSearchRequest, RouteRequest } from '../../../types/gis';
import { GISService } from '../../gis/GISService';

const profile = {
  id: 'gis',
  label: 'GIS Mapping Specialist',
  guardrails: [
    'Do not persist exact user addresses unless the user explicitly saves a map session.',
    'State provider uncertainty and geocoding confidence.',
    'Attribute map, parcel, business, route, and layer data sources.',
    'Do not represent parcel/property data as legal, survey, title, or engineering advice.',
    'Respect geocoding, map tile, and place provider terms.'
  ],
  workflows: [
    'Classify GIS intent: address, route, parcel, business, layer, or spatial analysis.',
    'Call deterministic GIS providers before free-form explanation.',
    'Return text plus mapArtifact when visual output is useful.',
    'Warn when development providers are being used.'
  ]
};

export class GISMappingAgent {
  constructor(private readonly gisService = new GISService()) {}

  async ask(query: string): Promise<GISChatResponse> {
    if (!query || !query.trim()) {
      return this.helpResponse();
    }
    return this.gisService.ask(query);
  }

  async geocode(request: GeocodeRequest): Promise<GISChatResponse> {
    const result = await this.gisService.geocode(request);
    return {
      domain: 'gis',
      mode: 'geocode',
      response: `Found ${result.results.length} geocoding result(s).`,
      mapArtifact: result.mapArtifact,
      warnings: result.warnings,
      providerMetadata: result.providerMetadata,
      sources: result.providerMetadata.map(item => item.provider)
    };
  }

  async route(request: RouteRequest): Promise<GISChatResponse> {
    const result = await this.gisService.route(request);
    return {
      domain: 'gis',
      mode: 'route',
      response: `Route calculated: ${(result.route.distanceMeters / 1000).toFixed(2)} km, approximately ${Math.round((result.route.durationSeconds || 0) / 60)} minutes.`,
      mapArtifact: result.mapArtifact,
      warnings: result.warnings,
      providerMetadata: result.providerMetadata,
      sources: result.providerMetadata.map(item => item.provider)
    };
  }

  async places(request: PlaceSearchRequest): Promise<GISChatResponse> {
    const result = await this.gisService.searchPlaces(request);
    return {
      domain: 'gis',
      mode: 'places',
      response: `Found ${result.results.length} place result(s).`,
      mapArtifact: result.mapArtifact,
      warnings: result.warnings,
      providerMetadata: result.providerMetadata,
      sources: result.providerMetadata.map(item => item.provider)
    };
  }

  async parcels(request: ParcelSearchRequest): Promise<GISChatResponse> {
    const result = await this.gisService.searchParcels(request);
    return {
      domain: 'gis',
      mode: 'parcels',
      response: `Found ${result.results.length} parcel/property result(s).`,
      mapArtifact: result.mapArtifact,
      warnings: result.warnings,
      providerMetadata: result.providerMetadata,
      sources: result.providerMetadata.map(item => item.provider)
    };
  }

  getProfile() {
    return profile;
  }

  private helpResponse(): GISChatResponse {
    return {
      domain: 'gis',
      mode: 'help',
      response: [
        'GIS Mapping Specialist can geocode addresses, reverse geocode coordinates, calculate routes, search places, look up parcels, import layers, query layers, and run basic spatial analysis.',
        '',
        'Example requests:',
        '- Map 1600 Pennsylvania Ave NW',
        '- Route from Times Square to Central Park',
        '- Find coffee near New Haven, CT',
        '- Search parcel DEV-PARCEL-001',
        '- Create a 500 meter buffer around 41.2705,-72.9470'
      ].join('\n'),
      warnings: profile.guardrails,
      providerMetadata: []
    };
  }
}
