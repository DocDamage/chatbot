import {
  GeocodeRequest,
  GeocodeResult,
  ParcelResult,
  ParcelSearchRequest,
  PlaceResult,
  PlaceSearchRequest,
  ReverseGeocodeRequest,
  ReverseGeocodeResult,
  RouteProviderRequest,
  RouteResult
} from '../../types/gis';
import { ArcGISFeatureServiceProvider } from './providers/ArcGISFeatureServiceProvider';
import { CensusGeocoder } from './providers/CensusGeocoder';
import {
  DevelopmentGeocodingProvider,
  DevelopmentParcelProvider,
  DevelopmentPlacesProvider,
  DevelopmentRoutingProvider
} from './providers/MockGISProviders';
import { OSRMRoutingProvider } from './providers/OSRMRoutingProvider';

export interface GeocodingProvider {
  readonly id: string;
  readonly attribution: string;
  geocode(request: GeocodeRequest): Promise<GeocodeResult[]>;
  reverseGeocode(request: ReverseGeocodeRequest): Promise<ReverseGeocodeResult[]>;
}

export interface RoutingProvider {
  readonly id: string;
  readonly attribution: string;
  route(request: RouteProviderRequest): Promise<RouteResult>;
}

export interface PlacesProvider {
  readonly id: string;
  readonly attribution: string;
  search(request: PlaceSearchRequest): Promise<PlaceResult[]>;
}

export interface ParcelProvider {
  readonly id: string;
  readonly attribution: string;
  search(request: ParcelSearchRequest): Promise<ParcelResult[]>;
}

export interface GISProviderSet {
  geocoder: GeocodingProvider;
  routing: RoutingProvider;
  places: PlacesProvider;
  parcels: ParcelProvider;
}

export class GISProviderRegistry {
  constructor(private readonly providers: GISProviderSet) {}

  static development(): GISProviderRegistry {
    return new GISProviderRegistry({
      geocoder: new DevelopmentGeocodingProvider(),
      routing: new DevelopmentRoutingProvider(),
      places: new DevelopmentPlacesProvider(),
      parcels: new DevelopmentParcelProvider()
    });
  }

  static fromEnv(): GISProviderRegistry {
    const geocoder = process.env.GIS_GEOCODER_PROVIDER === 'census'
      ? new CensusGeocoder()
      : new DevelopmentGeocodingProvider();

    const routing = process.env.GIS_ROUTING_PROVIDER === 'osrm'
      ? new OSRMRoutingProvider(process.env.OSRM_BASE_URL || 'http://localhost:5000')
      : new DevelopmentRoutingProvider();

    const parcels = process.env.GIS_PARCEL_PROVIDER === 'arcgis' && process.env.GIS_ARCGIS_PARCEL_LAYER_URL
      ? new ArcGISFeatureServiceProvider(process.env.GIS_ARCGIS_PARCEL_LAYER_URL)
      : new DevelopmentParcelProvider();

    return new GISProviderRegistry({
      geocoder,
      routing,
      places: new DevelopmentPlacesProvider(),
      parcels
    });
  }

  get geocoder(): GeocodingProvider {
    return this.providers.geocoder;
  }

  get routing(): RoutingProvider {
    return this.providers.routing;
  }

  get places(): PlacesProvider {
    return this.providers.places;
  }

  get parcels(): ParcelProvider {
    return this.providers.parcels;
  }

  metadata() {
    return {
      geocoder: this.geocoder.id,
      routing: this.routing.id,
      places: this.places.id,
      parcels: this.parcels.id
    };
  }
}
