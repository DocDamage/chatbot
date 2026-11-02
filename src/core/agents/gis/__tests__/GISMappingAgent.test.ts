import { describe, expect, it } from '@jest/globals';
import { GISMappingAgent } from '../GISMappingAgent';

describe('RT-AGENT-GIS-001: GISMappingAgent Spatial and Routing Suite', () => {
  it('returns help response when query is empty', async () => {
    const agent = new GISMappingAgent();
    const help = await agent.ask('');
    expect(help.mode).toBe('help');
    expect(help.response).toContain('GIS Mapping Specialist');
    expect(agent.getProfile().id).toBe('gis');
  });

  it('geocodes addresses and returns map artifacts', async () => {
    const agent = new GISMappingAgent();
    const result = await agent.geocode({ query: '1600 Pennsylvania Ave NW, Washington, DC' });
    expect(result.domain).toBe('gis');
    expect(result.mode).toBe('geocode');
    expect(result.response).toContain('Found');
  });

  it('calculates routes between origin and destination coordinates', async () => {
    const agent = new GISMappingAgent();
    const result = await agent.route({
      stops: [{ lat: 40.7128, lng: -74.006 }, { lat: 40.785091, lng: -73.968285 }],
      profile: 'driving'
    });
    expect(result.mode).toBe('route');
    expect(result.response).toContain('Route calculated');
  });

  it('searches places and parcels', async () => {
    const agent = new GISMappingAgent();
    const places = await agent.places({ query: 'coffee', center: { lat: 41.3083, lng: -72.9279 } });
    expect(places.mode).toBe('places');

    const parcels = await agent.parcels({ query: 'DEV-PARCEL-001' });
    expect(parcels.mode).toBe('parcels');
  });
});
