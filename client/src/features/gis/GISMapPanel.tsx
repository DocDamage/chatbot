import { useState } from 'react';
import GISMapCard from './GISMapCard';
import { calculateRoute, geocodeAddress } from './gisApi';
import type { GISMapArtifact } from './gisTypes';

export default function GISMapPanel() {
  const [query, setQuery] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [artifact, setArtifact] = useState<GISMapArtifact | null>(null);
  const [summary, setSummary] = useState('');
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busyAction, setBusyAction] = useState<'geocode' | 'route' | null>(null);

  const runGeocode = async () => {
    try {
      const trimmedQuery = query.trim();
      if (!trimmedQuery) return;
      setError('');
      setSummary('');
      setWarnings([]);
      setBusyAction('geocode');
      const result = await geocodeAddress(trimmedQuery);
      setArtifact(result.mapArtifact || null);
      setWarnings(result.warnings || []);
      setSummary(result.results.length
        ? `Found ${result.results.length} geocoding result(s).`
        : 'No geocoding results found.');
    } catch (err: unknown) {
      setArtifact(null);
      setSummary('');
      setWarnings([]);
      setError(err instanceof Error ? err.message : 'Geocode failed');
    } finally {
      setBusyAction(null);
    }
  };

  const runRoute = async () => {
    try {
      const trimmedFrom = from.trim();
      const trimmedTo = to.trim();
      if (!trimmedFrom || !trimmedTo) return;
      setError('');
      setSummary('');
      setWarnings([]);
      setBusyAction('route');
      const result = await calculateRoute([trimmedFrom, trimmedTo], 'driving');
      setArtifact(result.mapArtifact);
      setWarnings(result.warnings || []);
      setSummary(`Route: ${(result.route.distanceMeters / 1000).toFixed(2)} km.`);
    } catch (err: unknown) {
      setArtifact(null);
      setSummary('');
      setWarnings([]);
      setError(err instanceof Error ? err.message : 'Route failed');
    } finally {
      setBusyAction(null);
    }
  };

  const isBusy = busyAction !== null;

  return (
    <section className="gis-map-panel" aria-label="GIS Mapping">
      <h3>GIS Mapping</h3>
      <div>
        <label htmlFor="gis-geocode-query">Address or place</label>
        <input id="gis-geocode-query" value={query} onChange={event => setQuery(event.target.value)} placeholder="1600 Pennsylvania Ave NW" />
        <button type="button" onClick={runGeocode} disabled={!query.trim() || isBusy}>
          {busyAction === 'geocode' ? 'Mapping...' : 'Map'}
        </button>
      </div>
      <div>
        <label htmlFor="gis-route-from">Route from</label>
        <input id="gis-route-from" value={from} onChange={event => setFrom(event.target.value)} placeholder="Times Square" />
        <label htmlFor="gis-route-to">to</label>
        <input id="gis-route-to" value={to} onChange={event => setTo(event.target.value)} placeholder="Central Park" />
        <button type="button" onClick={runRoute} disabled={!from.trim() || !to.trim() || isBusy}>
          {busyAction === 'route' ? 'Routing...' : 'Route'}
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {warnings.length > 0 && (
        <ul className="gis-map-panel-warnings" aria-label="GIS warnings">
          {warnings.map(warning => <li key={warning}>{warning}</li>)}
        </ul>
      )}
      {summary && <p>{summary}</p>}
      {artifact && <GISMapCard artifact={artifact} title="GIS result" />}
    </section>
  );
}
