import { createHash } from 'crypto';
import { ApprovedRepositoryGateway } from '../security/ApprovedRepositoryGateway';

export interface CycloneDxBom { bomFormat: 'CycloneDX'; specVersion: '1.5'; serialNumber: string; version: 1; metadata: { component: { type: 'application'; name: string; version: string } }; components: Array<{ type: 'library'; name: string; version: string; purl: string }>; }
export function generateCycloneDxSbom(gateway: ApprovedRepositoryGateway): CycloneDxBom {
  const manifest = JSON.parse(gateway.readTextFile('package.json', 512 * 1024).content) as { name?: string; version?: string; dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  const entries = Object.entries({ ...manifest.dependencies, ...manifest.devDependencies }).sort(([left], [right]) => left.localeCompare(right));
  const components = entries.map(([name, version]) => ({ type: 'library' as const, name, version, purl: `pkg:npm/${encodeURIComponent(name)}@${encodeURIComponent(version)}` }));
  const serialNumber = `urn:uuid:${createHash('sha256').update(JSON.stringify(components)).digest('hex').slice(0, 32)}`;
  const bom = { bomFormat: 'CycloneDX' as const, specVersion: '1.5' as const, serialNumber, version: 1 as const, metadata: { component: { type: 'application' as const, name: manifest.name || 'repository', version: manifest.version || '0.0.0' } }, components };
  validateCycloneDxSbom(bom);
  return bom;
}
export function validateCycloneDxSbom(value: CycloneDxBom): void {
  if (value.bomFormat !== 'CycloneDX' || value.specVersion !== '1.5' || value.version !== 1 || !value.metadata.component.name) throw new Error('Invalid CycloneDX 1.5 BOM.');
  if (!value.components.every(component => component.type === 'library' && Boolean(component.name) && Boolean(component.version) && /^pkg:npm\//.test(component.purl))) throw new Error('Invalid CycloneDX component.');
}
