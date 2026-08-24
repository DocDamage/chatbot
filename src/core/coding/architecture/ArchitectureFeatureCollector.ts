import path from 'path';
import { BuildSystemDetector } from '../repository/BuildSystemDetector';
import { ArchitectureGraphCollector } from './ArchitectureGraphCollector';
import { ArchitectureNode, ScannedArchitectureFile } from './ArchitectureTypes';
import {
  detectManifestFacts,
  detectRoutes,
  detectTables,
  isMigrationPath,
  isTestPath
} from './ArchitectureDetectors';
import { normalizeRepositoryPath, stableId } from './ArchitectureIdentity';

export interface ArchitectureFeatureState {
  testIds: Map<string, string>;
  dependencyIds: Map<string, string>;
}

export class ArchitectureFeatureCollector {
  collect(
    files: ScannedArchitectureFile[],
    graph: ArchitectureGraphCollector,
    repositoryId: string,
    fileIds: Map<string, string>,
    parentIds: Map<string, string>
  ): ArchitectureFeatureState {
    const manifests = files.map(detectManifestFacts)
      .filter((value): value is NonNullable<ReturnType<typeof detectManifestFacts>> => Boolean(value));
    const dependencyIds = new Map<string, string>();
    const testIds = new Map<string, string>();
    this.addManifestFeatures(manifests, graph, repositoryId, parentIds, dependencyIds);
    this.addBuildPlans(files, manifests, graph, repositoryId);
    this.addFileFeatures(files, graph, fileIds, testIds);
    return { testIds, dependencyIds };
  }

  private addManifestFeatures(
    manifests: NonNullable<ReturnType<typeof detectManifestFacts>>[],
    graph: ArchitectureGraphCollector,
    repositoryId: string,
    parentIds: Map<string, string>,
    dependencyIds: Map<string, string>
  ): void {
    const packageIds = new Map<string, string>();
    for (const facts of manifests) {
      const root = normalizeRepositoryPath(path.posix.dirname(facts.manifest.path));
      const dataName = facts.manifest.data?.name;
      const label = typeof dataName === 'string'
        ? dataName
        : root === '.' ? facts.manifest.kind : root;
      const packageId = packageIds.get(root) || graph.addNode(node(
        'package', stableId('package', root, facts.manifest.kind), label,
        facts.manifest.parseError ? 0.55 : 0.95,
        { manifest: facts.manifest.kind },
        [{
          file: facts.manifest.path,
          confidence: facts.manifest.parseError ? 0.55 : 0.95,
          detail: facts.manifest.parseError || 'parsed project manifest'
        }], root
      ));
      packageIds.set(root, packageId);
      graph.addEdge('contains', parentIds.get(facts.manifest.path) || repositoryId, packageId, 0.9, [
        { file: facts.manifest.path, confidence: 0.9, detail: 'manifest defines package' }
      ]);
      if (facts.manifest.parseError) {
        graph.warn('MANIFEST_PARSE_ERROR', facts.manifest.parseError, facts.manifest.path);
      }
      this.addDependencies(facts, graph, packageId, dependencyIds);
      for (const target of facts.buildTargets) {
        const targetId = graph.addNode(node(
          'build_target', stableId('build_target', facts.manifest.path, target.name),
          target.name, 0.95, { command: target.command },
          [{ file: facts.manifest.path, line: target.line, confidence: 0.95, detail: 'declared build or package script' }]
        ));
        graph.addEdge('builds', packageId, targetId, 0.95, [
          { file: facts.manifest.path, line: target.line, confidence: 0.95, detail: 'package build target' }
        ]);
      }
    }
  }

  private addDependencies(
    facts: NonNullable<ReturnType<typeof detectManifestFacts>>,
    graph: ArchitectureGraphCollector,
    packageId: string,
    dependencyIds: Map<string, string>
  ): void {
    for (const dependency of facts.dependencies) {
      const dependencyId = dependencyIds.get(dependency.name) || graph.addNode(node(
        'external_dependency', stableId('external_dependency', dependency.name),
        dependency.name, 0.9, { scope: dependency.scope },
        [{
          file: facts.manifest.path,
          line: dependency.line,
          confidence: 0.9,
          detail: `${dependency.scope} dependency`
        }]
      ));
      dependencyIds.set(dependency.name, dependencyId);
      graph.addEdge('depends_on', packageId, dependencyId, 0.9, [{
        file: facts.manifest.path,
        line: dependency.line,
        confidence: 0.9,
        detail: 'declared dependency'
      }]);
    }
  }

  private addBuildPlans(
    files: ScannedArchitectureFile[],
    manifests: NonNullable<ReturnType<typeof detectManifestFacts>>[],
    graph: ArchitectureGraphCollector,
    repositoryId: string
  ): void {
    const build = new BuildSystemDetector().detect(
      files.map(file => file.path),
      manifests.map(value => value.manifest)
    );
    for (const command of build.commands.filter(value => value.supported)) {
      const label = `${command.executable} ${command.argv.join(' ')}`.trim();
      const targetId = graph.addNode(node(
        'build_target', stableId('build_target', command.source, command.executable, ...command.argv),
        label, 0.9,
        { executable: command.executable, argv: command.argv, purpose: command.purpose, supported: true },
        [{ file: '.', confidence: 0.9, detail: `${command.source}: detected build-system command` }]
      ));
      graph.addEdge('builds', repositoryId, targetId, 0.9, [
        { file: '.', confidence: 0.9, detail: `${command.source}: repository build target` }
      ]);
    }
  }

  private addFileFeatures(
    files: ScannedArchitectureFile[],
    graph: ArchitectureGraphCollector,
    fileIds: Map<string, string>,
    testIds: Map<string, string>
  ): void {
    for (const file of files.filter(value => Boolean(value.content))) {
      const fileId = fileIds.get(file.path)!;
      if (isTestPath(file.path)) {
        const testId = graph.addNode(node(
          'test', stableId('test', file.path), path.posix.basename(file.path), 0.95,
          { cases: file.symbols.filter(symbol => symbol.kind === 'test').length },
          [{ file: file.path, confidence: 0.95, detail: 'test path or test symbols' }],
          file.path, file.language
        ));
        testIds.set(file.path, testId);
        graph.addEdge('contains', fileId, testId, 0.95, [
          { file: file.path, confidence: 0.95, detail: 'file defines tests' }
        ]);
      }
      const migrationId = isMigrationPath(file.path)
        ? graph.addNode(node(
          'migration', stableId('migration', file.path), path.posix.basename(file.path),
          0.92, {}, [{ file: file.path, confidence: 0.92, detail: 'migration or schema path' }],
          file.path, file.language
        ))
        : undefined;
      if (migrationId) graph.addEdge('contains', fileId, migrationId, 0.92, [
        { file: file.path, confidence: 0.92, detail: 'file defines migration' }
      ]);
      this.addRoutesAndTables(file, graph, fileId, migrationId);
    }
  }

  private addRoutesAndTables(
    file: ScannedArchitectureFile,
    graph: ArchitectureGraphCollector,
    fileId: string,
    migrationId?: string
  ): void {
    for (const route of detectRoutes(file)) {
      const routeId = graph.addNode(node(
        'api_route', stableId('api_route', file.path, route.method, route.routePath, String(route.line)),
        `${route.method} ${route.routePath}`, route.confidence,
        { method: route.method, routePath: route.routePath, handler: route.handler, framework: route.framework },
        [{ file: file.path, line: route.line, confidence: route.confidence, detail: 'static route registration' }],
        file.path, file.language
      ));
      graph.addEdge('registers_route', fileId, routeId, route.confidence, [
        { file: file.path, line: route.line, confidence: route.confidence, detail: 'file registers route' }
      ]);
    }
    for (const table of detectTables(file)) {
      const tableId = graph.addNode(node(
        'database_table', stableId('database_table', table.name), table.name,
        table.confidence, {},
        [{ file: file.path, line: table.line, confidence: table.confidence, detail: `${table.kind} table evidence` }]
      ));
      const sourceId = table.kind === 'creates' && migrationId ? migrationId : fileId;
      const kind = table.kind === 'creates'
        ? 'creates_table'
        : table.kind === 'reads' ? 'reads_table' : 'writes_table';
      graph.addEdge(kind, sourceId, tableId, table.confidence, [
        { file: file.path, line: table.line, confidence: table.confidence, detail: `${table.kind} database table` }
      ]);
    }
  }
}

function node(
  kind: ArchitectureNode['kind'], id: string, label: string, confidence: number,
  attributes: ArchitectureNode['attributes'], evidence: ArchitectureNode['evidence'],
  nodePath?: string, language?: string
): ArchitectureNode {
  return {
    id, kind, label, confidence, attributes, evidence,
    ...(nodePath ? { path: nodePath } : {}),
    ...(language ? { language } : {})
  };
}
