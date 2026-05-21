# GIS Mapping Module — QGIS-Informed Enhanced Plan

Status: Superseding feature plan  
Repo target: `DocDamage/chatbot`  
Output type: Markdown planning/spec file only  
Do not track this work in `RELEASE_COMPLETION_AUDIT.md`.

## 0. Purpose

This document upgrades the chatbot GIS Mapping plan using QGIS and QGIS Documentation as a reference point for what a serious GIS application must support.

This is not a request to copy QGIS source code. QGIS is GPL-licensed, so its source should be treated as architectural reference, not copied into this MIT-style chatbot app unless the project owner intentionally accepts compatible licensing obligations. The goal here is to adapt the product lessons:

- unified data-source management
- provider registry pattern
- layer/project/session model
- CRS-aware processing
- browser-style GIS file/service explorer
- layer metadata and styling
- processing toolbox/jobs
- OGC/web-service support
- layout/export/report workflows
- careful provenance, licensing, and privacy handling

## 1. Bottom Line

The original GIS plan was good for a map assistant. QGIS shows what is missing for a real GIS-capable chatbot.

The GIS module should not be only:

```text
geocode -> show pin
route -> show line
import GeoJSON -> draw layer
```

It should become:

```text
GIS Browser + Data Source Manager
+ Provider Registry
+ Project/Map Session Model
+ Layer Tree
+ CRS Service
+ Style/Label/Metadata Model
+ Processing Toolbox
+ OGC/ArcGIS Connections
+ Spatial Database/PostGIS
+ Map Layout/Export
+ Chat Agent that can operate all of the above
```

That is the difference between a toy map feature and a serious GIS assistant.

## 2. QGIS Lessons To Steal Conceptually

### 2.1 Unified Data Source Manager

QGIS does not make every format its own random workflow. It has a Data Source Manager and Browser pattern.

For the chatbot, this means the GIS module needs a first-class file/service browser:

```text
client/src/features/gis/GISBrowserPanel.tsx
client/src/features/gis/DataSourceManagerModal.tsx
client/src/features/gis/ServiceConnectionPanel.tsx
client/src/features/gis/DatasetPreviewPanel.tsx
client/src/features/gis/LayerImportWizard.tsx
src/core/gis/GISBrowserService.ts
src/core/gis/GISDataSourceManager.ts
src/core/gis/GISServiceConnectionManager.ts
```

Required behavior:

- Browse local workspace folders.
- Detect GIS files.
- Detect compressed GIS files.
- Show file metadata before import.
- Preview vector attributes.
- Preview raster metadata when supported.
- Show CRS before adding the layer.
- Show geometry type.
- Show feature count where cheap/safe.
- Save favorites.
- Save service connections.
- Filter/search data sources.
- Let chat say: `load the parcels layer from the GIS folder`.
- Let chat say: `connect to this ArcGIS REST FeatureServer`.
- Let chat say: `preview this shapefile before importing it`.

Supported source groups:

```text
Files:
- GeoJSON
- CSV
- KML/KMZ
- GPX
- zipped Shapefile
- GeoPackage
- FlatGeobuf
- raster metadata placeholders for GeoTIFF/MBTiles

Databases:
- PostGIS
- SQLite/SpatiaLite later
- GeoPackage

Web services:
- WMS
- WMTS
- WFS
- OGC API Features
- ArcGIS REST FeatureServer
- ArcGIS REST MapServer
- XYZ tiles
- vector tiles later
```

### 2.2 Provider Registry

QGIS uses providers as a core architecture concept. The chatbot GIS should do the same.

Do not hardwire Google/Mapbox/OSRM/ArcGIS calls directly in route handlers.

Create:

```text
src/core/gis/providers/GISProviderRegistry.ts
src/core/gis/providers/GISProviderMetadata.ts
src/core/gis/providers/GISProviderCapabilities.ts
src/core/gis/providers/GISDataProvider.ts
src/core/gis/providers/GISProviderHealth.ts
```

Provider categories:

```ts
type GISProviderKind =
  | 'geocoder'
  | 'reverse_geocoder'
  | 'routing'
  | 'places'
  | 'parcel'
  | 'tile'
  | 'feature_service'
  | 'coverage_service'
  | 'processing'
  | 'export';
```

Provider metadata must include:

```ts
interface GISProviderMetadata {
  id: string;
  label: string;
  kind: GISProviderKind;
  source: 'local' | 'hosted' | 'government' | 'commercial' | 'open-data';
  termsUrl?: string;
  attribution: string;
  cachePolicy: {
    allowed: boolean;
    ttlSeconds?: number;
    restrictions?: string[];
  };
  rateLimit?: {
    requestsPerMinute?: number;
    requestsPerDay?: number;
  };
  capabilities: string[];
  requiredEnv: string[];
}
```

Provider capabilities must answer:

```text
Can it geocode?
Can it reverse geocode?
Can it route?
Can it do batch?
Can it handle polygons?
Can it search inside bounds?
Can it search along route?
Can it return GeoJSON?
Can it return feature schema?
Can it expose CRS?
Can it cache results?
Can it support auth?
```

### 2.3 Layer Model

QGIS treats layers as first-class objects with type, source, CRS, metadata, style, label, visibility, filter, provider, and project membership.

The chatbot needs the same.

Create:

```text
src/types/gis.ts
src/core/gis/GISLayerService.ts
src/core/gis/GISLayerMetadataService.ts
src/core/gis/GISLayerTreeService.ts
src/core/gis/GISLayerFilterService.ts
src/core/gis/GISLayerDependencyService.ts
src/core/gis/GISLayerValidationService.ts
```

Layer types:

```ts
type GISLayerType =
  | 'vector'
  | 'raster'
  | 'table'
  | 'mesh'
  | 'point_cloud'
  | 'vector_tile'
  | 'raster_tile'
  | 'annotation'
  | 'group'
  | 'temporary_result';
```

Layer flags:

```ts
interface GISLayerFlags {
  visible: boolean;
  identifiable: boolean;
  searchable: boolean;
  removable: boolean;
  editable: boolean;
  private: boolean;
  temporary: boolean;
  queryFiltered: boolean;
}
```

Layer metadata:

```ts
interface GISLayerMetadata {
  id: string;
  name: string;
  type: GISLayerType;
  sourceUri: string;
  providerId: string;
  crs?: string;
  geometryType?: 'Point' | 'LineString' | 'Polygon' | 'MultiPoint' | 'MultiLineString' | 'MultiPolygon' | 'GeometryCollection';
  extent?: [number, number, number, number];
  featureCount?: number;
  fields?: GISField[];
  attribution?: string;
  licenseNote?: string;
  sourceFetchedAt?: string;
  sourceUpdatedAt?: string;
  provenance: GISProvenance[];
}
```

Layer tree:

```ts
interface GISLayerTreeNode {
  id: string;
  layerId?: string;
  type: 'layer' | 'group';
  name: string;
  children?: GISLayerTreeNode[];
  visible: boolean;
  opacity?: number;
  sortOrder: number;
}
```

### 2.4 Layer Properties Drawer

A GIS user needs to inspect the source, fields, CRS, style, metadata, filters, and dependencies of a layer.

Create:

```text
client/src/features/gis/LayerPropertiesDrawer.tsx
client/src/features/gis/LayerInformationTab.tsx
client/src/features/gis/LayerSourceTab.tsx
client/src/features/gis/LayerFieldsTab.tsx
client/src/features/gis/LayerStyleTab.tsx
client/src/features/gis/LayerLabelsTab.tsx
client/src/features/gis/LayerFilterTab.tsx
client/src/features/gis/LayerMetadataTab.tsx
client/src/features/gis/LayerProcessingHistoryTab.tsx
```

Minimum tabs:

| Tab | Purpose |
|---|---|
| Information | Read-only summary, provider, CRS, extent, feature count |
| Source | Data source URI, provider, auth profile, reload/replace source |
| Fields | Attribute schema, field types, sample values |
| Style | Symbol, color, line width, fill opacity, categorized styling |
| Labels | Label field, placement, visibility |
| Filter | SQL-like/provider filter or in-memory expression |
| Metadata | Attribution, license, links, contacts, update time |
| History | Processing jobs and generated outputs |

### 2.5 CRS Service

The original plan mentioned CRS, but QGIS makes clear that CRS is not optional.

Create:

```text
src/core/gis/crs/CRSService.ts
src/core/gis/crs/CRSTransformService.ts
src/core/gis/crs/CRSDetectionService.ts
src/core/gis/crs/MeasurementService.ts
client/src/features/gis/CRSBadge.tsx
client/src/features/gis/CRSWarningBanner.tsx
```

Rules:

- Every layer must have a CRS or an explicit `unknown` CRS state.
- The map project/session must have a project CRS.
- Imported datasets must detect or ask for CRS.
- Measurements must use appropriate projection/ellipsoid logic.
- Distance/area calculations must warn when using unsuitable CRS.
- The UI must show CRS on layer cards and in processing parameter selectors.
- Chat responses must mention CRS limitations when analysis depends on it.

Required response warning examples:

```text
This area calculation is approximate because the layer is in EPSG:4326. Reproject to a local projected CRS for reliable parcel area.
```

```text
The uploaded layer has no CRS metadata. Assign a CRS before routing, overlay, buffer, or area analysis.
```

### 2.6 Processing Toolbox

QGIS has a Processing Toolbox, processing providers, algorithms, models, scripts, history, logs, batch execution, and parameter dialogs.

The chatbot GIS module needs a smaller but similar concept.

Create:

```text
src/core/gis/processing/GISProcessingRegistry.ts
src/core/gis/processing/GISProcessingAlgorithm.ts
src/core/gis/processing/GISProcessingJobService.ts
src/core/gis/processing/GISProcessingHistoryService.ts
src/core/gis/processing/GISProcessingParameterSchema.ts
src/core/gis/processing/algorithms/BufferAlgorithm.ts
src/core/gis/processing/algorithms/ClipAlgorithm.ts
src/core/gis/processing/algorithms/IntersectAlgorithm.ts
src/core/gis/processing/algorithms/DissolveAlgorithm.ts
src/core/gis/processing/algorithms/NearestAlgorithm.ts
src/core/gis/processing/algorithms/CentroidAlgorithm.ts
src/core/gis/processing/algorithms/ReprojectAlgorithm.ts
src/core/gis/processing/algorithms/JoinAttributesByLocationAlgorithm.ts
src/core/gis/processing/providers/TurfProcessingProvider.ts
src/core/gis/processing/providers/PostGISProcessingProvider.ts
src/core/gis/processing/providers/QGISProcessProvider.ts
client/src/features/gis/ProcessingToolboxPanel.tsx
client/src/features/gis/ProcessingJobLogPanel.tsx
client/src/features/gis/ProcessingHistoryPanel.tsx
```

Processing registry shape:

```ts
interface GISProcessingAlgorithm {
  id: string;
  label: string;
  providerId: string;
  group: string;
  description: string;
  parameters: GISProcessingParameter[];
  outputs: GISProcessingOutput[];
  run(input: GISProcessingRunInput): Promise<GISProcessingRunResult>;
}
```

Initial algorithms:

```text
native:buffer
native:clip
native:intersect
native:distance
native:nearest
native:centroid
native:bounds
native:area
native:length
native:reproject
native:merge_layers
native:filter_by_expression
native:join_attributes_by_location
native:points_in_polygon
native:route_between_points
native:places_within_radius
native:parcels_within_buffer
```

Batch mode:

- Allow repeating one algorithm over multiple layers.
- Allow repeating one algorithm over each feature.
- Keep logs and generated temporary outputs.
- Generated outputs appear as temporary layers until saved.

Optional QGIS CLI integration:

```text
src/core/gis/processing/providers/QGISProcessProvider.ts
```

This provider should shell out to `qgis_process` only when:

- `GIS_QGIS_PROCESS_ENABLED=true`
- `QGIS_PROCESS_PATH` is configured
- the server host has QGIS installed
- inputs are local files or safe temp exports
- command execution is sandboxed
- output JSON is validated
- execution timeouts and max file sizes are enforced

This gives the chatbot access to real GIS processing later without embedding QGIS code.

### 2.7 OGC and ArcGIS Connections

The plan must support web GIS services like a real GIS app.

Create:

```text
src/core/gis/connections/GISConnectionManager.ts
src/core/gis/connections/OGCConnectionService.ts
src/core/gis/connections/ArcGISConnectionService.ts
src/core/gis/providers/ogc/WMSProvider.ts
src/core/gis/providers/ogc/WMTSProvider.ts
src/core/gis/providers/ogc/WFSProvider.ts
src/core/gis/providers/ogc/OGCApiFeaturesProvider.ts
src/core/gis/providers/arcgis/ArcGISFeatureServerProvider.ts
src/core/gis/providers/arcgis/ArcGISMapServerProvider.ts
client/src/features/gis/ConnectionManagerPanel.tsx
client/src/features/gis/NewServiceConnectionDialog.tsx
```

Connection model:

```ts
interface GISServiceConnection {
  id: string;
  name: string;
  kind: 'wms' | 'wmts' | 'wfs' | 'ogc_api_features' | 'arcgis_feature_server' | 'arcgis_map_server' | 'xyz_tiles' | 'vector_tiles';
  baseUrl: string;
  authProfileId?: string;
  headers?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  lastCapabilitiesFetchAt?: string;
  capabilitiesCacheTtlSeconds?: number;
  attribution?: string;
}
```

Required behavior:

- Save named service connections.
- Fetch capabilities.
- List available service layers.
- Add selected service layers to map.
- Cache capabilities responses.
- Validate URL allowlists for admin/developer environments.
- Never store raw passwords in project/session JSON.
- Support auth profiles, not plain credentials.
- Show attribution.
- Show provider terms/source.
- Surface service errors clearly.

### 2.8 Project / Map Session Model

QGIS has persistent project state. The chatbot needs a map-session/project equivalent.

Create:

```text
src/core/gis/project/GISProjectService.ts
src/core/gis/project/GISProjectSerializer.ts
src/core/gis/project/GISProjectValidator.ts
src/core/gis/project/GISBadLayerHandler.ts
client/src/features/gis/MapSessionManager.tsx
client/src/features/gis/BadLayerDialog.tsx
```

Project/session state should persist:

```ts
interface GISProjectState {
  id: string;
  title: string;
  projectCrs: string;
  transformContext?: Record<string, any>;
  units: {
    distance: 'meters' | 'kilometers' | 'feet' | 'miles';
    area: 'square_meters' | 'hectares' | 'acres' | 'square_feet' | 'square_miles';
  };
  mapView: {
    center: [number, number];
    zoom: number;
    bearing?: number;
    pitch?: number;
    bounds?: [number, number, number, number];
  };
  layerTree: GISLayerTreeNode[];
  layers: GISLayerMetadata[];
  styles: GISLayerStyle[];
  labels: GISLabelStyle[];
  serviceConnections: string[];
  bookmarks: GISSpatialBookmark[];
  layouts: GISLayoutTemplate[];
  processingHistory: GISProcessingHistoryEntry[];
  privacy: {
    redactExactAddresses: boolean;
    savedWithPrivateLocations: boolean;
  };
  provenance: GISProvenance[];
}
```

Bad-layer behavior:

- If a local file path no longer exists, keep the layer but mark it broken.
- Let user relink source.
- Let user remove broken layer.
- Let user keep metadata without geometry.
- Chat should be able to say: `the parcels layer is broken because the source file is missing`.

### 2.9 Styles, Labels, Expressions, and Filters

A GIS assistant must style layers, not just render them randomly.

Create:

```text
src/core/gis/style/GISStyleService.ts
src/core/gis/style/GISLabelService.ts
src/core/gis/expression/GISExpressionEngine.ts
src/core/gis/query/GISQueryBuilder.ts
client/src/features/gis/StyleEditorPanel.tsx
client/src/features/gis/LabelEditorPanel.tsx
client/src/features/gis/LayerFilterBuilder.tsx
```

Initial style modes:

```text
single symbol
categorized by field
graduated numeric ranges
heatmap
clustered points
route style
parcel boundary style
selection highlight
temporary result style
```

Initial label modes:

```text
label by field
label expression
min/max zoom visibility
collision avoidance placeholder
halo/outline
```

Expression/filter examples:

```text
zone = 'R-2'
owner_type = 'municipal'
assessment_value > 250000
business_category IN ('restaurant', 'coffee')
distance_meters < 500
```

Security requirement:

- Do not pass arbitrary SQL from the chat directly into a database.
- Parse/validate expressions into safe AST first.
- Provider-level filters must be compiled from safe allowlisted fields/operators.

### 2.10 Attribute Table and Identify Tool

Create:

```text
client/src/features/gis/AttributeTablePanel.tsx
client/src/features/gis/FeatureIdentifyPanel.tsx
client/src/features/gis/FeatureDetailsCard.tsx
src/core/gis/query/GISFeatureQueryService.ts
```

Required behavior:

- Click feature -> show attributes.
- Search attributes.
- Sort fields.
- Filter visible features.
- Select features.
- Export selected features.
- Run processing only on selected features.
- Explain feature attributes in chat.

Chat examples:

```text
What is this parcel?
Which selected parcels are over 2 acres?
Export the selected businesses to CSV.
Run a 500-foot buffer on the selected road segment.
```

### 2.11 Layout, Print, Reports, Atlas

QGIS has print layout, layout manager, export to PDF/SVG/image, reports, and atlas generation. Your chatbot should eventually generate map reports.

Create:

```text
src/core/gis/layout/GISLayoutService.ts
src/core/gis/layout/GISLayoutTemplateService.ts
src/core/gis/layout/GISMapReportService.ts
src/core/gis/export/GISExportService.ts
client/src/features/gis/MapLayoutExportDialog.tsx
client/src/features/gis/MapReportPreview.tsx
```

Initial export targets:

```text
GeoJSON
CSV
PNG map snapshot
PDF map report
HTML report
```

Later:

```text
SVG
print layout templates
atlas by feature
parcel report
route report
business search report
zoning summary report
```

Map reports should include:

- title
- map image
- legend
- scale
- north arrow
- data sources
- CRS
- generation time
- limitations
- provider attribution
- selected feature tables

### 2.12 Temporal and 3D Later

Do not implement first, but reserve space for:

```text
temporal layers
time slider
GPS tracks over time
3D terrain
point clouds
mesh layers
elevation profiles
LiDAR/LAZ metadata
```

These should be marked Phase 5+.

## 3. Updated Backend File Plan

Create:

```text
src/types/gis.ts

src/core/gis/GISService.ts
src/core/gis/GISPrivacy.ts
src/core/gis/GISCache.ts
src/core/gis/GISProvenance.ts
src/core/gis/GISDataSourceManager.ts
src/core/gis/GISBrowserService.ts
src/core/gis/GISServiceConnectionManager.ts

src/core/gis/providers/GISProviderRegistry.ts
src/core/gis/providers/GISProviderMetadata.ts
src/core/gis/providers/GISProviderCapabilities.ts
src/core/gis/providers/GISDataProvider.ts
src/core/gis/providers/geocoding/CensusGeocoder.ts
src/core/gis/providers/geocoding/MapboxGeocoder.ts
src/core/gis/providers/geocoding/GoogleGeocoder.ts
src/core/gis/providers/geocoding/NominatimGeocoder.ts
src/core/gis/providers/routing/OSRMRoutingProvider.ts
src/core/gis/providers/routing/ValhallaRoutingProvider.ts
src/core/gis/providers/routing/GoogleRoutesProvider.ts
src/core/gis/providers/places/GooglePlacesProvider.ts
src/core/gis/providers/places/OverpassPlacesProvider.ts
src/core/gis/providers/parcels/ArcGISParcelProvider.ts
src/core/gis/providers/ogc/WMSProvider.ts
src/core/gis/providers/ogc/WMTSProvider.ts
src/core/gis/providers/ogc/WFSProvider.ts
src/core/gis/providers/ogc/OGCApiFeaturesProvider.ts
src/core/gis/providers/arcgis/ArcGISFeatureServerProvider.ts
src/core/gis/providers/arcgis/ArcGISMapServerProvider.ts

src/core/gis/layers/GISLayerService.ts
src/core/gis/layers/GISLayerTreeService.ts
src/core/gis/layers/GISLayerMetadataService.ts
src/core/gis/layers/GISLayerFilterService.ts
src/core/gis/layers/GISLayerValidationService.ts
src/core/gis/layers/GISLayerDependencyService.ts

src/core/gis/crs/CRSService.ts
src/core/gis/crs/CRSTransformService.ts
src/core/gis/crs/CRSDetectionService.ts
src/core/gis/crs/MeasurementService.ts

src/core/gis/query/GISFeatureQueryService.ts
src/core/gis/query/GISQueryBuilder.ts
src/core/gis/expression/GISExpressionEngine.ts

src/core/gis/style/GISStyleService.ts
src/core/gis/style/GISLabelService.ts

src/core/gis/processing/GISProcessingRegistry.ts
src/core/gis/processing/GISProcessingAlgorithm.ts
src/core/gis/processing/GISProcessingJobService.ts
src/core/gis/processing/GISProcessingHistoryService.ts
src/core/gis/processing/GISProcessingParameterSchema.ts
src/core/gis/processing/providers/TurfProcessingProvider.ts
src/core/gis/processing/providers/PostGISProcessingProvider.ts
src/core/gis/processing/providers/QGISProcessProvider.ts
src/core/gis/processing/algorithms/BufferAlgorithm.ts
src/core/gis/processing/algorithms/ClipAlgorithm.ts
src/core/gis/processing/algorithms/IntersectAlgorithm.ts
src/core/gis/processing/algorithms/DissolveAlgorithm.ts
src/core/gis/processing/algorithms/NearestAlgorithm.ts
src/core/gis/processing/algorithms/CentroidAlgorithm.ts
src/core/gis/processing/algorithms/ReprojectAlgorithm.ts
src/core/gis/processing/algorithms/JoinAttributesByLocationAlgorithm.ts

src/core/gis/project/GISProjectService.ts
src/core/gis/project/GISProjectSerializer.ts
src/core/gis/project/GISProjectValidator.ts
src/core/gis/project/GISBadLayerHandler.ts

src/core/gis/layout/GISLayoutService.ts
src/core/gis/layout/GISLayoutTemplateService.ts
src/core/gis/layout/GISMapReportService.ts
src/core/gis/export/GISExportService.ts

src/core/agents/gis/GISMappingAgent.ts
src/server/routes/gis.ts
```

Modify:

```text
src/server/routeManifest.ts
src/core/initialization/ServiceInitializer.ts
src/core/router/* intent routing files
src/core/tools/* tool registry files
src/core/config/ConfigValidator.ts
package.json
client/package.json
.env.example
```

## 4. Updated Frontend File Plan

Create:

```text
client/src/features/gis/GISMapPanel.tsx
client/src/features/gis/GISMapCard.tsx
client/src/features/gis/GISBrowserPanel.tsx
client/src/features/gis/DataSourceManagerModal.tsx
client/src/features/gis/ServiceConnectionPanel.tsx
client/src/features/gis/NewServiceConnectionDialog.tsx
client/src/features/gis/DatasetPreviewPanel.tsx
client/src/features/gis/LayerImportWizard.tsx
client/src/features/gis/LayerTreePanel.tsx
client/src/features/gis/LayerPropertiesDrawer.tsx
client/src/features/gis/LayerInformationTab.tsx
client/src/features/gis/LayerSourceTab.tsx
client/src/features/gis/LayerFieldsTab.tsx
client/src/features/gis/LayerStyleTab.tsx
client/src/features/gis/LayerLabelsTab.tsx
client/src/features/gis/LayerFilterTab.tsx
client/src/features/gis/LayerMetadataTab.tsx
client/src/features/gis/AttributeTablePanel.tsx
client/src/features/gis/FeatureIdentifyPanel.tsx
client/src/features/gis/FeatureDetailsCard.tsx
client/src/features/gis/ProcessingToolboxPanel.tsx
client/src/features/gis/ProcessingJobLogPanel.tsx
client/src/features/gis/ProcessingHistoryPanel.tsx
client/src/features/gis/CRSBadge.tsx
client/src/features/gis/CRSWarningBanner.tsx
client/src/features/gis/StyleEditorPanel.tsx
client/src/features/gis/LabelEditorPanel.tsx
client/src/features/gis/LayerFilterBuilder.tsx
client/src/features/gis/MapSessionManager.tsx
client/src/features/gis/BadLayerDialog.tsx
client/src/features/gis/MapLayoutExportDialog.tsx
client/src/features/gis/MapReportPreview.tsx
client/src/features/gis/gisApi.ts
client/src/features/gis/gisTypes.ts
client/src/features/gis/useGISMap.ts
client/src/features/gis/gisStyles.css
```

UI structure:

```text
Chat Response
  ├─ Text answer
  ├─ GISMapCard
  │   ├─ MapLibre/Leaflet map
  │   ├─ LayerTreePanel
  │   ├─ FeatureIdentifyPanel
  │   ├─ AttributeTablePanel
  │   ├─ CRSBadge
  │   └─ Export buttons
  └─ Source/provenance footer

GIS Workspace View
  ├─ GISBrowserPanel
  ├─ DataSourceManagerModal
  ├─ GISMapPanel
  ├─ LayerTreePanel
  ├─ LayerPropertiesDrawer
  ├─ ProcessingToolboxPanel
  └─ MapLayoutExportDialog
```

## 5. Updated API Plan

Core chat-driven GIS endpoints:

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/gis/ask` | Natural-language GIS command |
| POST | `/api/gis/geocode` | Address to coordinate candidates |
| POST | `/api/gis/reverse-geocode` | Coordinates to address/context |
| POST | `/api/gis/route` | Route between points/stops |
| POST | `/api/gis/places/search` | Business/POI search |
| POST | `/api/gis/parcels/search` | Parcel/property lookup |

Data source and connection endpoints:

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/gis/browser` | Browse workspace GIS files/services |
| POST | `/api/gis/browser/preview` | Preview source metadata/fields |
| GET | `/api/gis/connections` | List saved service connections |
| POST | `/api/gis/connections` | Create service connection |
| POST | `/api/gis/connections/:id/capabilities` | Fetch service capabilities |
| POST | `/api/gis/connections/:id/layers/add` | Add service layer to session |

Layer endpoints:

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/gis/layers` | List layers in session/project |
| POST | `/api/gis/layers/import` | Import file/URL/service layer |
| GET | `/api/gis/layers/:id/metadata` | Layer information |
| GET | `/api/gis/layers/:id/features` | Query features |
| POST | `/api/gis/layers/:id/filter` | Apply safe filter |
| POST | `/api/gis/layers/:id/style` | Save style |
| POST | `/api/gis/layers/:id/labels` | Save label config |
| POST | `/api/gis/layers/:id/relink` | Fix broken source |

Processing endpoints:

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/gis/processing/providers` | List processing providers |
| GET | `/api/gis/processing/algorithms` | List algorithms |
| GET | `/api/gis/processing/algorithms/:id` | Algorithm parameter schema |
| POST | `/api/gis/processing/run` | Run algorithm |
| POST | `/api/gis/processing/batch` | Run batch algorithm |
| GET | `/api/gis/processing/jobs/:id` | Job status/log/result |
| GET | `/api/gis/processing/history` | Processing history |

Project/session/export endpoints:

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/gis/projects` | Save map session/project |
| GET | `/api/gis/projects/:id` | Load map session/project |
| PATCH | `/api/gis/projects/:id` | Update map session/project |
| POST | `/api/gis/projects/:id/export` | Export project/layers/report |
| POST | `/api/gis/layouts` | Create layout/report template |
| POST | `/api/gis/layouts/:id/render` | Render PDF/PNG/HTML report |

## 6. Updated Database Schema Plan

PostGIS is the production target. SQLite may be used for local metadata only.

```sql
CREATE TABLE gis_projects (
  id UUID PRIMARY KEY,
  user_id TEXT,
  title TEXT NOT NULL,
  project_crs TEXT NOT NULL DEFAULT 'EPSG:4326',
  state_json JSONB NOT NULL DEFAULT '{}',
  privacy_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE gis_layers (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES gis_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  layer_type TEXT NOT NULL,
  source_uri TEXT,
  provider_id TEXT NOT NULL,
  crs TEXT,
  geometry_type TEXT,
  extent GEOMETRY,
  fields_json JSONB NOT NULL DEFAULT '[]',
  metadata_json JSONB NOT NULL DEFAULT '{}',
  flags_json JSONB NOT NULL DEFAULT '{}',
  style_json JSONB NOT NULL DEFAULT '{}',
  label_json JSONB NOT NULL DEFAULT '{}',
  filter_json JSONB NOT NULL DEFAULT '{}',
  provenance_json JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE gis_features (
  id UUID PRIMARY KEY,
  layer_id UUID NOT NULL REFERENCES gis_layers(id) ON DELETE CASCADE,
  external_id TEXT,
  properties JSONB NOT NULL DEFAULT '{}',
  geom GEOMETRY NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX gis_features_geom_idx ON gis_features USING GIST (geom);
CREATE INDEX gis_features_layer_id_idx ON gis_features(layer_id);
CREATE INDEX gis_features_properties_idx ON gis_features USING GIN (properties);

CREATE TABLE gis_service_connections (
  id UUID PRIMARY KEY,
  user_id TEXT,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  base_url TEXT NOT NULL,
  auth_profile_id TEXT,
  headers_json JSONB NOT NULL DEFAULT '{}',
  capabilities_json JSONB,
  attribution TEXT,
  capabilities_fetched_at TIMESTAMPTZ,
  cache_ttl_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE gis_provider_cache (
  id UUID PRIMARY KEY,
  provider_id TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  request_kind TEXT NOT NULL,
  response_json JSONB NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider_id, request_hash)
);

CREATE TABLE gis_processing_jobs (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES gis_projects(id) ON DELETE SET NULL,
  user_id TEXT,
  algorithm_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  status TEXT NOT NULL,
  parameters_json JSONB NOT NULL DEFAULT '{}',
  result_json JSONB,
  logs_json JSONB NOT NULL DEFAULT '[]',
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE gis_spatial_bookmarks (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES gis_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  crs TEXT NOT NULL,
  bounds GEOMETRY NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE gis_layout_templates (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES gis_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  template_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## 7. Updated Environment Variables

```env
GIS_ENABLED=true
GIS_DEFAULT_REGION=US
GIS_DEFAULT_PROJECT_CRS=EPSG:4326
GIS_DEFAULT_CENTER_LAT=41.2705
GIS_DEFAULT_CENTER_LNG=-72.9470
GIS_DEFAULT_ZOOM=11

POSTGIS_URL=postgres://user:password@localhost:5432/chatbot_gis
GIS_SQLITE_FALLBACK=true

GIS_TILE_PROVIDER=osm
GIS_TILE_URL=https://tile.openstreetmap.org/{z}/{x}/{y}.png
GIS_TILE_ATTRIBUTION=OpenStreetMap contributors

GIS_GEOCODER_PROVIDER=census
GIS_ROUTING_PROVIDER=osrm
GIS_PLACES_PROVIDER=google
GIS_PARCEL_PROVIDER=arcgis

GIS_PROVIDER_CACHE_TTL_SECONDS=2592000
GIS_CAPABILITIES_CACHE_TTL_SECONDS=86400
GIS_REDACT_EXACT_ADDRESSES=true
GIS_ALLOW_PUBLIC_NOMINATIM=false

MAPBOX_API_KEY=
GOOGLE_MAPS_API_KEY=
FOURSQUARE_API_KEY=
ARCGIS_API_KEY=
OSRM_BASE_URL=http://localhost:5000
VALHALLA_BASE_URL=
OVERPASS_API_URL=https://overpass-api.de/api/interpreter

GIS_QGIS_PROCESS_ENABLED=false
QGIS_PROCESS_PATH=
GIS_PROCESSING_TIMEOUT_MS=60000
GIS_MAX_UPLOAD_MB=100
GIS_MAX_FEATURES_PER_LAYER=250000
```

## 8. Chat Agent Behavior

Create:

```text
src/core/agents/gis/GISMappingAgent.ts
```

Profile:

```ts
const profile = {
  id: 'gis',
  label: 'GIS Mapping Specialist',
  guardrails: [
    'Do not persist exact user addresses unless the user explicitly saves a map session.',
    'State geocoding confidence and provider uncertainty.',
    'Attribute map, parcel, business, service, and route data sources.',
    'Do not represent parcel/property/zoning/flood output as legal, survey, engineering, or title advice.',
    'Respect geocoding, map tile, OGC, ArcGIS, and place provider terms.',
    'Warn when CRS choice can affect distance, area, buffer, or overlay results.',
    'Do not run arbitrary SQL or shell commands from chat text.'
  ],
  workflows: [
    'Classify GIS intent: address, route, parcel, business, layer, service connection, styling, query, export, or processing.',
    'Call deterministic GIS tools before free-form LLM response.',
    'Return text plus mapArtifact when visual output is useful.',
    'Use project/session context when the user says this layer, these parcels, selected features, or current map.',
    'Offer online/provider ingestion when required GIS data is missing.',
    'Save provenance for all external data.'
  ],
  tools: [
    'GeocodeTool',
    'ReverseGeocodeTool',
    'RouteTool',
    'PlacesSearchTool',
    'ParcelLookupTool',
    'DataSourceBrowserTool',
    'LayerImportTool',
    'LayerStyleTool',
    'LayerFilterTool',
    'FeatureIdentifyTool',
    'ProcessingTool',
    'CRSTool',
    'MapExportTool'
  ]
};
```

Natural language routing examples:

| User says | Route to |
|---|---|
| `map this address` | geocode + map artifact |
| `load this shapefile` | Data Source Manager + Layer Import |
| `connect to this WMS` | Service Connection Manager |
| `show zoning around this parcel` | Parcel provider + layer overlay |
| `make parcels red where zone = commercial` | Layer style/filter |
| `buffer this road by 500 feet` | Processing Toolbox |
| `what CRS is this layer in?` | CRS service/layer metadata |
| `export this map as PDF` | Layout/export service |
| `why is this layer not loading?` | Bad layer handler |

## 9. Map Artifact Contract

Every GIS chat answer should support a structured map artifact.

```ts
interface GISChatResponse {
  response: string;
  mapArtifact?: {
    projectId?: string;
    sessionId?: string;
    projectCrs: string;
    center?: [number, number];
    zoom?: number;
    bounds?: [number, number, number, number];
    layerTree?: GISLayerTreeNode[];
    layers: GISLayerArtifact[];
    markers?: GISMarkerArtifact[];
    routes?: GISRouteArtifact[];
    selectedFeatureIds?: string[];
    warnings?: string[];
    attribution: string[];
    providerMetadata: GISProviderMetadata[];
  };
  processingJob?: {
    id: string;
    algorithmId: string;
    status: string;
    resultLayerIds?: string[];
  };
  sources?: string[];
  warnings?: string[];
}
```

Map artifact rules:

- Always include attribution.
- Always include CRS.
- Include warnings for approximate measurements.
- Include source/provenance for imported layers.
- Do not include raw private addresses in saved artifact unless user explicitly saves them.

## 10. Data Ingestion Rules

When the user asks for missing GIS data:

1. Check project/session layers.
2. Check local knowledge/RAG.
3. Check saved service connections.
4. If missing, ask or prompt to search external sources depending on current mode/policy.
5. Prefer official government/open data portals for parcels, zoning, flood, wetlands, roads, transit, boundaries.
6. Ingest only when terms/license allow it.
7. Store:
   - source URL
   - provider ID
   - fetch time
   - license/terms note
   - CRS
   - extent
   - layer schema
   - attribution
   - cache policy
8. Never silently scrape assessor/property websites.
9. Never silently store exact private user locations.

## 11. Implementation Phases

### Phase 1 — Real Map MVP

Deliver:

- `GISMappingAgent`
- `/api/gis/ask`
- `/api/gis/geocode`
- `/api/gis/reverse-geocode`
- `/api/gis/route`
- `GISProviderRegistry`
- `GISService`
- `GISPrivacy`
- `GISCache`
- `GISMapCard`
- `GISMapPanel`
- basic map artifact rendering
- source attribution
- CRS field in every response

Acceptance:

- User can ask: `Map 1600 Pennsylvania Ave NW`.
- User can ask: `Route from Times Square to Central Park`.
- Response includes text, confidence, attribution, CRS, and map artifact.
- Exact addresses are redacted from logs.

### Phase 2 — Data Source Manager and Layer Tree

Deliver:

- GIS Browser Panel
- Data Source Manager Modal
- Layer import wizard
- layer tree
- layer metadata service
- GeoJSON/CSV/KML/GPX/zipped Shapefile import
- layer visibility/opacity
- feature identify
- attribute table

Acceptance:

- User can upload or select a GIS file.
- UI previews metadata before import.
- User can toggle layers.
- User can click features and inspect attributes.
- Chat can refer to `this layer` and `selected features`.

### Phase 3 — CRS and Processing Toolbox

Deliver:

- CRS service
- measurement service
- CRS warnings
- Processing registry
- Processing toolbox panel
- buffer/intersect/clip/nearest/centroid/reproject
- processing history/logs
- temporary output layers

Acceptance:

- User can run a buffer on a selected feature.
- User gets a warning if layer CRS is unknown or unsuitable.
- Output appears as a temporary layer that can be saved.

### Phase 4 — OGC/ArcGIS Services and Parcels

Deliver:

- connection manager
- WMS/WMTS/WFS/OGC API Features adapters
- ArcGIS FeatureServer/MapServer adapters
- parcel lookup provider
- zoning/flood/wetland overlay support
- capabilities cache
- service layer picker

Acceptance:

- User can connect to a public ArcGIS FeatureServer.
- User can add a service layer to the map.
- User can ask for parcel/zoning context around an address.
- Results include source, timestamp, and limitations.

### Phase 5 — Business/POI and Route Intelligence

Deliver:

- places provider registry
- nearby/category/text search
- business cards
- search along route
- route alternatives
- route report

Acceptance:

- User can ask for businesses near an address.
- User can ask for businesses along a route.
- Cards and markers stay linked.

### Phase 6 — Layouts, Reports, Atlas

Deliver:

- map export
- report generation
- layout templates
- PDF/PNG/HTML output
- parcel report
- route report
- business report
- atlas-by-feature later

Acceptance:

- User can export the current map/report.
- Export includes title, map, legend, scale, CRS, attribution, and limitations.

### Phase 7 — Advanced GIS

Later:

- heatmaps
- clustering
- choropleths
- service areas/isochrones
- batch route optimization
- temporal layers
- 3D terrain
- point-cloud metadata
- offline map packages
- QGIS process integration behind admin flag

## 12. Testing Plan

Add tests:

```text
src/server/routes/__tests__/gis-routes.test.ts
src/core/gis/__tests__/GISService.test.ts
src/core/gis/__tests__/GISProviderRegistry.test.ts
src/core/gis/__tests__/GISPrivacy.test.ts
src/core/gis/__tests__/GISCache.test.ts
src/core/gis/__tests__/GISDataSourceManager.test.ts
src/core/gis/__tests__/GISLayerService.test.ts
src/core/gis/__tests__/CRSService.test.ts
src/core/gis/__tests__/GISProcessingRegistry.test.ts
src/core/gis/__tests__/GISProcessingJobService.test.ts
src/core/gis/__tests__/GISServiceConnectionManager.test.ts
src/core/gis/__tests__/GISProjectService.test.ts
src/core/gis/__tests__/GISExportService.test.ts
client/src/features/gis/__tests__/GISMapCard.test.tsx
client/src/features/gis/__tests__/GISBrowserPanel.test.tsx
client/src/features/gis/__tests__/LayerTreePanel.test.tsx
client/src/features/gis/__tests__/ProcessingToolboxPanel.test.tsx
```

Must test:

- geocode request validation
- reverse-geocode validation
- route request validation
- provider fallback
- provider capability discovery
- exact address redaction
- cache TTL behavior
- GeoJSON validation
- unsafe ZIP rejection
- service connection URL validation
- WMS/WMTS/WFS capabilities parsing with fixtures
- ArcGIS FeatureServer metadata parsing with fixtures
- unknown CRS warnings
- unsuitable CRS warnings for area/buffer
- processing algorithm parameter validation
- processing job logs/history
- layer style serialization
- layer filter AST safety
- broken layer handling
- map artifact rendering
- export response validation

Verification commands:

```bash
npm run type-check
npm run test:routes
npm run test:services
npm run release:check
cd client && npm run type-check && npm run test && npm run build
```

Nothing is `Verified` without command output or direct manual inspection evidence.

## 13. Security and Privacy

Required:

- Redact exact addresses from logs.
- Do not store exact user home/work addresses unless user saves a project/session.
- Keep API keys server-side.
- Rate-limit provider endpoints.
- Use URL allowlists/blocklists for service connections.
- Prevent SSRF through WMS/WFS/ArcGIS URL inputs.
- Validate uploaded archive contents.
- Reject path traversal in ZIP/shapefile import.
- Cap file sizes and feature counts.
- Validate GeoJSON geometry.
- Sanitize attributes before rendering.
- Never run arbitrary SQL from chat.
- Never run arbitrary shell commands from chat.
- QGIS CLI integration must be admin-disabled by default.
- Include provider attribution.
- Include legal/survey/engineering limitation notes for parcel/zoning/flood analysis.

## 14. Packages To Evaluate

Server:

```text
@turf/turf
proj4
epsg-index or equivalent CRS lookup package
wellknown or wkx
geojson-validation or custom Zod GeoJSON schemas
shpjs
@tmcw/togeojson or maintained equivalent
@ngageoint/geopackage or maintained GeoPackage parser
p-limit
```

Client:

```text
maplibre-gl
react-map-gl/maplibre or direct MapLibre wrapper
```

Do not install blindly. Check package maintenance, license, bundle size, and TypeScript support first.

## 15. Codex / Cursor / Claude Implement Prompt

Use this in Implement Mode only:

```text
You are implementing the QGIS-informed GIS Mapping module for this chatbot repository.

Read:
- docs/gis_mapping_qgis_enhanced_feature_plan.md
- docs/gis_mapping_feature_plan.md if it exists
- README.md
- src/server/routeManifest.ts
- src/server/routes/geography.ts
- src/core/agents/geography/GeoCultureGeniusAgent.ts

Rules:
- Do not edit RELEASE_COMPLETION_AUDIT.md.
- GIS work belongs in GIS docs and GIS source files only.
- Do not merge GIS into the geography/culture route.
- Do not copy QGIS GPL source code. Use QGIS only as architectural/product reference.
- Create a separate GIS module with provider registry, layer model, CRS service, project/session model, processing registry, API routes, and client map components.
- API keys must stay server-side.
- Exact addresses must be redacted from logs.
- Public Nominatim must not be used for autocomplete, bulk geocoding, systematic queries, or production high-volume use.
- Every map artifact must include CRS and attribution.
- Spatial analysis must warn when CRS/units make the result approximate.
- OGC/ArcGIS connections must defend against SSRF.
- Do not execute arbitrary SQL or shell commands from chat.
- QGIS qgis_process integration must be optional, disabled by default, sandboxed, and admin-controlled.
- Plan Mode may only write Markdown plans.
- Implement Mode is required for source-code changes.
- Debug Mode is required for diagnostics and repairs.

Milestone 1:
1. Add src/types/gis.ts.
2. Add src/core/gis/GISService.ts.
3. Add src/core/gis/providers/GISProviderRegistry.ts.
4. Add src/core/gis/GISPrivacy.ts.
5. Add src/core/gis/GISCache.ts.
6. Add geocoding/routing provider interfaces and safe mock/dev providers.
7. Add src/core/gis/crs/CRSService.ts with minimal EPSG:4326 support and warning model.
8. Add src/core/agents/gis/GISMappingAgent.ts.
9. Add src/server/routes/gis.ts.
10. Register GIS in src/server/routeManifest.ts.
11. Add /api/gis/geocode, /api/gis/reverse-geocode, /api/gis/route, /api/gis/ask.
12. Add client/src/features/gis/GISMapCard.tsx with mapArtifact placeholder rendering.
13. Add route/service tests.
14. Update .env.example and docs.

Milestone 2:
1. Add GIS Browser/Data Source Manager.
2. Add GeoJSON/CSV/KML/GPX/zipped Shapefile import.
3. Add layer tree and layer metadata drawer.
4. Add feature identify and attribute table.
5. Add safe layer filters.

Milestone 3:
1. Add processing registry.
2. Add buffer/intersect/clip/nearest/centroid/reproject.
3. Add processing history/logs.
4. Add CRS warnings and measurement service.

Verification:
- npm run type-check
- npm run test:routes
- npm run test:services
- cd client && npm run type-check && npm run test && npm run build

Do not mark anything Verified without actual command output or direct manual inspection evidence.
```

## 16. Reference Repos and Docs

QGIS source:

```text
https://github.com/qgis/QGIS
```

QGIS documentation:

```text
https://github.com/qgis/QGIS-Documentation
https://docs.qgis.org/latest
```

Specific concepts used as reference:

```text
QGIS provider registry
QGIS map layer model
QGIS project/session persistence
QGIS processing registry/toolbox
QGIS Data Source Manager and Browser Panel
QGIS CRS guidance
QGIS OGC client support
QGIS vector layer properties
QGIS print layout/layout manager
QGIS qgis_process command-line processing
```

## 17. Final Standard

The chatbot should eventually let a user work like this:

```text
User: Connect to this town ArcGIS parcel service.
Bot: Shows service capabilities, layers, attribution, and import options.

User: Add parcels, zoning, wetlands, and roads.
Bot: Adds service layers to the map session and shows CRS/source warnings.

User: Find parcels within 500 feet of this road and color them by zoning.
Bot: Runs a spatial query/processing job, creates a result layer, applies categorized styling, and explains the result.

User: Export this as a PDF report.
Bot: Generates a map report with legend, scale, CRS, data sources, timestamp, and limitations.
```

That is the target. Anything less is just a map widget.
