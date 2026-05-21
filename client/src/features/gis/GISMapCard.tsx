import { useMemo } from 'react';
import type { GISBoundingBox, GISCoordinate, GISMapArtifact, GISRouteArtifact } from './gisTypes';
import './GISMapCard.css';

interface GISMapCardProps {
  artifact: GISMapArtifact;
  title?: string;
}

const WIDTH = 720;
const HEIGHT = 280;
const PAD = 30;

export default function GISMapCard({ artifact, title = 'GIS Map' }: GISMapCardProps) {
  const bounds = useMemo(() => artifact.bounds || inferBounds(artifact), [artifact]);
  const markers = artifact.markers || [];
  const routes = artifact.routes || [];

  if (!bounds) {
    return (
      <section className="gis-map-card" aria-label={title}>
        <div className="gis-map-card-header">
          <span className="gis-map-card-title">{title}</span>
          <span className="gis-map-card-meta">No geometry to render</span>
        </div>
      </section>
    );
  }

  return (
    <section className="gis-map-card" aria-label={title}>
      <div className="gis-map-card-header">
        <span className="gis-map-card-title">{title}</span>
        <span className="gis-map-card-meta">
          {markers.length} marker(s) · {routes.length} route(s) · {artifact.layers.length} layer(s)
        </span>
      </div>
      <svg className="gis-map-card-canvas" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="GIS map preview">
        {routes.map(route => renderRoute(route, bounds))}
        {markers.map(marker => {
          const point = project(marker.coordinate, bounds);
          return (
            <g key={marker.id}>
              <circle cx={point.x} cy={point.y} r="7" fill="#38bdf8" stroke="#0f172a" strokeWidth="3" />
              <text className="gis-map-marker-label" x={point.x + 10} y={point.y - 8}>{marker.label}</text>
            </g>
          );
        })}
      </svg>
      <footer className="gis-map-card-footer">
        {artifact.attribution.length > 0 && (
          <div>Attribution: {artifact.attribution.join(' · ')}</div>
        )}
        {artifact.providerMetadata.length > 0 && (
          <div className="gis-map-card-list">
            {artifact.providerMetadata.map(item => (
              <span className="gis-map-card-chip" key={`${item.kind}-${item.provider}`}>{item.kind}: {item.provider}</span>
            ))}
          </div>
        )}
      </footer>
    </section>
  );
}

function renderRoute(route: GISRouteArtifact, bounds: GISBoundingBox) {
  if (route.geometry.type !== 'LineString' || !Array.isArray(route.geometry.coordinates)) {
    return null;
  }

  const points = route.geometry.coordinates
    .filter(isPosition)
    .map(position => project({ lng: position[0], lat: position[1] }, bounds))
    .map(point => `${point.x},${point.y}`)
    .join(' ');

  return <polyline key={route.id} points={points} fill="none" stroke="#f97316" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />;
}

function inferBounds(artifact: GISMapArtifact): GISBoundingBox | undefined {
  const coordinates: GISCoordinate[] = [
    ...(artifact.markers || []).map(marker => marker.coordinate),
    ...extractRouteCoordinates(artifact.routes || [])
  ];

  if (coordinates.length === 0) return undefined;

  const west = Math.min(...coordinates.map(coordinate => coordinate.lng));
  const east = Math.max(...coordinates.map(coordinate => coordinate.lng));
  const south = Math.min(...coordinates.map(coordinate => coordinate.lat));
  const north = Math.max(...coordinates.map(coordinate => coordinate.lat));
  const lngPad = Math.max(0.005, (east - west) * 0.15);
  const latPad = Math.max(0.005, (north - south) * 0.15);

  return {
    west: west - lngPad,
    east: east + lngPad,
    south: south - latPad,
    north: north + latPad
  };
}

function extractRouteCoordinates(routes: GISRouteArtifact[]): GISCoordinate[] {
  return routes.flatMap(route => {
    if (route.geometry.type !== 'LineString' || !Array.isArray(route.geometry.coordinates)) return [];
    return route.geometry.coordinates.filter(isPosition).map(position => ({ lng: position[0], lat: position[1] }));
  });
}

function project(coordinate: GISCoordinate, bounds: GISBoundingBox): { x: number; y: number } {
  const width = Math.max(0.000001, bounds.east - bounds.west);
  const height = Math.max(0.000001, bounds.north - bounds.south);
  return {
    x: PAD + ((coordinate.lng - bounds.west) / width) * (WIDTH - PAD * 2),
    y: HEIGHT - PAD - ((coordinate.lat - bounds.south) / height) * (HEIGHT - PAD * 2)
  };
}

function isPosition(value: unknown): value is [number, number] {
  return Array.isArray(value) && Number.isFinite(value[0]) && Number.isFinite(value[1]);
}
