import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { GISMappingAgent } from '../../core/agents/gis/GISMappingAgent';
import { GISService } from '../../core/gis/GISService';
import { ValidationError } from '../../utils/errors';
import {
  AnalysisBufferRequest,
  AnalysisNearestRequest,
  GeocodeRequest,
  GISCoordinate,
  LayerImportRequest,
  LayerQueryRequest,
  MapSessionState,
  ParcelSearchRequest,
  PlaceSearchRequest,
  ReverseGeocodeRequest,
  RouteRequest
} from '../../types/gis';

interface GISEnabledServices {
  gisService?: GISService;
  gisMappingAgent?: GISMappingAgent;
}

export function createGISRouter(services: GISEnabledServices = {}): Router {
  const router = Router();

  const getService = () => {
    if (!services.gisService) {
      services.gisService = new GISService();
    }
    return services.gisService;
  };

  const getAgent = () => {
    if (!services.gisMappingAgent) {
      services.gisMappingAgent = new GISMappingAgent(getService());
    }
    return services.gisMappingAgent;
  };

  router.post('/api/gis/ask', asyncHandler(async (req, res) => {
    const query = stringBody(req.body.query || req.body.message, 'query');
    res.json(await getAgent().ask(query));
  }));

  router.post('/api/gis/geocode', asyncHandler(async (req, res) => {
    const request: GeocodeRequest = {
      query: stringBody(req.body.query || req.body.address, 'query'),
      limit: optionalNumber(req.body.limit),
      country: optionalString(req.body.country),
      region: optionalString(req.body.region),
      persistExactAddress: req.body.persistExactAddress === true
    };
    res.json(await getService().geocode(request));
  }));

  router.post('/api/gis/reverse-geocode', asyncHandler(async (req, res) => {
    const request: ReverseGeocodeRequest = {
      coordinate: coordinateBody(req.body.coordinate || req.body, 'coordinate'),
      limit: optionalNumber(req.body.limit)
    };
    res.json(await getService().reverseGeocode(request));
  }));

  router.post('/api/gis/route', asyncHandler(async (req, res) => {
    const request: RouteRequest = {
      stops: Array.isArray(req.body.stops) ? req.body.stops : [req.body.from, req.body.to].filter(Boolean),
      profile: routeProfileBody(req.body.profile),
      avoidHighways: req.body.avoidHighways === true,
      alternatives: req.body.alternatives === true
    };
    res.json(await getService().route(request));
  }));

  router.post('/api/gis/places/search', asyncHandler(async (req, res) => {
    const request: PlaceSearchRequest = {
      query: stringBody(req.body.query, 'query'),
      center: req.body.center,
      radiusMeters: optionalNumber(req.body.radiusMeters),
      limit: optionalNumber(req.body.limit),
      category: optionalString(req.body.category),
      openNow: req.body.openNow === true
    };
    res.json(await getService().searchPlaces(request));
  }));

  router.post('/api/gis/parcels/search', asyncHandler(async (req, res) => {
    const request: ParcelSearchRequest = {
      query: optionalString(req.body.query),
      coordinate: req.body.coordinate,
      parcelId: optionalString(req.body.parcelId),
      bounds: req.body.bounds,
      limit: optionalNumber(req.body.limit)
    };
    res.json(await getService().searchParcels(request));
  }));

  router.post('/api/gis/layers/import', asyncHandler(async (req, res) => {
    const request: LayerImportRequest = {
      name: stringBody(req.body.name, 'name'),
      data: req.body.data,
      format: req.body.format,
      crs: optionalString(req.body.crs),
      sourceUrl: optionalString(req.body.sourceUrl),
      attribution: optionalString(req.body.attribution),
      licenseNote: optionalString(req.body.licenseNote)
    };
    res.json(getService().importLayer(request));
  }));

  router.get('/api/gis/layers', asyncHandler(async (_req, res) => {
    res.json(getService().listLayers());
  }));

  router.post('/api/gis/layers/query', asyncHandler(async (req, res) => {
    const request: LayerQueryRequest = {
      layerId: stringBody(req.body.layerId, 'layerId'),
      bounds: req.body.bounds,
      limit: optionalNumber(req.body.limit),
      where: req.body.where
    };
    res.json(getService().queryLayer(request));
  }));

  router.post('/api/gis/analysis/distance', asyncHandler(async (req, res) => {
    const from = coordinateBody(req.body.from, 'from');
    const to = coordinateBody(req.body.to, 'to');
    const spatial = new (await import('../../core/gis/SpatialAnalysisService')).SpatialAnalysisService();
    res.json({ distanceMeters: spatial.distanceMeters(from, to) });
  }));

  router.post('/api/gis/analysis/buffer', asyncHandler(async (req, res) => {
    const request: AnalysisBufferRequest = {
      coordinate: req.body.coordinate || req.body.center || req.body.location,
      radiusMeters: numberBody(req.body.radiusMeters, 'radiusMeters'),
      segments: optionalNumber(req.body.segments)
    };
    res.json(await getService().buffer(request));
  }));

  router.post('/api/gis/analysis/nearest', asyncHandler(async (req, res) => {
    const request: AnalysisNearestRequest = {
      coordinate: req.body.coordinate,
      layerId: stringBody(req.body.layerId, 'layerId'),
      limit: optionalNumber(req.body.limit)
    };
    res.json(await getService().nearest(request));
  }));

  router.post('/api/gis/sessions', asyncHandler(async (req, res) => {
    const state: MapSessionState = {
      title: stringBody(req.body.title || req.body.state?.title, 'title'),
      center: req.body.center || req.body.state?.center,
      zoom: optionalNumber(req.body.zoom || req.body.state?.zoom),
      layers: req.body.layers || req.body.state?.layers || [],
      markers: req.body.markers || req.body.state?.markers,
      routes: req.body.routes || req.body.state?.routes,
      notes: optionalString(req.body.notes || req.body.state?.notes)
    };
    res.json({ session: getService().saveSession(state) });
  }));

  router.get('/api/gis/sessions', asyncHandler(async (_req, res) => {
    res.json({ sessions: getService().listSessions() });
  }));

  router.get('/api/gis/sessions/:id', asyncHandler(async (req, res) => {
    res.json({ session: getService().getSession(req.params.id) });
  }));

  return router;
}

function stringBody(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError(`${name} is required.`);
  }
  return value.trim();
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function numberBody(value: unknown, name: string): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new ValidationError(`${name} must be a number.`);
  }
  return numeric;
}

function optionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function coordinateBody(value: unknown, name: string): GISCoordinate {
  const candidate = value as Partial<GISCoordinate>;
  if (!candidate || !Number.isFinite(candidate.lat) || !Number.isFinite(candidate.lng)) {
    throw new ValidationError(`${name} must include numeric lat and lng.`);
  }
  if (Number(candidate.lat) < -90 || Number(candidate.lat) > 90) {
    throw new ValidationError(`${name} must include a latitude between -90 and 90.`);
  }
  if (Number(candidate.lng) < -180 || Number(candidate.lng) > 180) {
    throw new ValidationError(`${name} must include a longitude between -180 and 180.`);
  }
  return {
    lat: Number(candidate.lat),
    lng: Number(candidate.lng)
  };
}

function routeProfileBody(value: unknown): RouteRequest['profile'] {
  if (value === undefined || value === null || value === '') return undefined;
  if (value === 'driving' || value === 'walking' || value === 'cycling') return value;
  throw new ValidationError('profile must be driving, walking, or cycling.');
}
