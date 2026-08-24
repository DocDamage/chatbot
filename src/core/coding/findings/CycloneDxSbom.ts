[ERROR] - (starship::print): Under a 'dumb' terminal (TERM=dumb).

import { createHash } from 'crypto';
import { ApprovedRepositoryGateway } from '../security/ApprovedRepositoryGateway';

export interface CycloneDxBom { bomFormat: 'CycloneDX'; specVersion: '1.5'; serialNumber: string; version: 1; metadata: { component: { type: 'application'; name: string; version: string } }; components: Array<{ type: 'library'; name: string; version: string; purl: string }>; }
export function generateCycloneDxSbom(gateway: ApprovedRepositoryGateway): CycloneDxBom {
  const manifest = JSON.parse(gateway.readTextFile('package.json', 512 * 1024).content) as { name?: string; version?: string; dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  const entries = Object.entries({ ...manifest.dependencies, ...manifest.devDependencies }).sort(([left], [right]) => left.localeCompare(right));
  const components = entries.map(([name, version]) => ({ type: 'library' as const, name, version, purl: `pkg:npm/${encodeURIComponent(name)}@${encodeURIComponent(version)}` }));
  const serialNumber = `urn:uuid:${createHash('sha256').update(JSON.stringify(components)).digest('hex').slice(0, 32)}`;
  return { bomFormat: 'CycloneDX', specVersion: '1.5', serialNumber, version: 1, metadata: { component: { type: 'application', name: manifest.name || 'repository', version: manifest.version || '0.0.0' } }, components };
}

