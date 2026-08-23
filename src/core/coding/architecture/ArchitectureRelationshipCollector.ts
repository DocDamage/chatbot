import { IndexedSymbol } from '../index/ParserProvider';
import { ArchitectureGraphCollector } from './ArchitectureGraphCollector';
import { ArchitectureNode, ScannedArchitectureFile } from './ArchitectureTypes';
import { detectArchitectureRelationships } from './ArchitectureRelationships';
import { stableId } from './ArchitectureIdentity';

export class ArchitectureRelationshipCollector {
  collect(
    files: ScannedArchitectureFile[],
    graph: ArchitectureGraphCollector,
    fileIds: Map<string, string>,
    symbolIds: Map<IndexedSymbol, string>,
    testIds: Map<string, string>,
    dependencyIds: Map<string, string>
  ): void {
    for (const relationship of detectArchitectureRelationships(files)) {
      if (relationship.unresolvedLocal) {
        graph.warn(
          'UNRESOLVED_LOCAL_IMPORT',
          `Could not resolve local import ${relationship.unresolvedLocal}.`,
          relationship.sourceFile
        );
        continue;
      }
      const source = relationship.kind === 'tests'
        ? testIds.get(relationship.sourceFile)
        : relationship.sourceSymbol
          ? symbolIds.get(relationship.sourceSymbol)
          : fileIds.get(relationship.sourceFile);
      let target = relationship.targetSymbol
        ? symbolIds.get(relationship.targetSymbol)
        : relationship.targetFile
          ? fileIds.get(relationship.targetFile)
          : undefined;
      if (!target && relationship.externalModule) {
        target = dependencyIds.get(relationship.externalModule) || graph.addNode(node(
          'external_dependency',
          stableId('external_dependency', relationship.externalModule),
          relationship.externalModule,
          0.72,
          { scope: 'inferred' },
          [{
            file: relationship.sourceFile,
            line: relationship.line,
            confidence: 0.72,
            detail: 'inferred external import'
          }]
        ));
        dependencyIds.set(relationship.externalModule, target);
      }
      if (source && target) graph.addEdge(
        relationship.kind,
        source,
        target,
        relationship.confidence,
        [{
          file: relationship.sourceFile,
          line: relationship.line,
          confidence: relationship.confidence,
          detail: relationship.detail
        }]
      );
    }
  }
}

function node(
  kind: ArchitectureNode['kind'], id: string, label: string, confidence: number,
  attributes: ArchitectureNode['attributes'], evidence: ArchitectureNode['evidence']
): ArchitectureNode {
  return { id, kind, label, confidence, attributes, evidence };
}
