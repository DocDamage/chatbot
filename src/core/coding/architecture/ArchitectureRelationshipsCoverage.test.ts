import { IndexedSymbol } from '../index/ParserProvider';
import { ArchitectureFeatureCollector } from './ArchitectureFeatureCollector';
import { ArchitectureGraphCollector } from './ArchitectureGraphCollector';
import { contentDigest, stableId } from './ArchitectureIdentity';
import { ArchitectureRelationshipCollector } from './ArchitectureRelationshipCollector';
import {
  ArchitectureRelationshipCandidate,
  detectArchitectureRelationships
} from './ArchitectureRelationships';
import { ArchitectureStructureCollector } from './ArchitectureStructureCollector';
import { ScannedArchitectureFile } from './ArchitectureTypes';

function symbol(
  file: string,
  name: string,
  kind: IndexedSymbol['kind'],
  line: number
): IndexedSymbol {
  return {
    kind,
    name,
    file,
    line,
    confidence: 0.9,
    parser: 'coverage-parser'
  };
}

function source(
  file: string,
  content: string,
  symbols: IndexedSymbol[] = []
): ScannedArchitectureFile {
  return {
    path: file,
    size: content.length,
    digest: contentDigest(content),
    generated: false,
    binary: false,
    parsed: true,
    content,
    symbols
  };
}

function relationshipFiles(): ScannedArchitectureFile[] {
  return [
    source('package.json', JSON.stringify({
      name: 'relationship-fixture',
      dependencies: { express: '^5' }
    })),
    source('src/helper.ts', 'export function helper() { return true; }', [
      symbol('src/helper.ts', 'helper', 'function', 1)
    ]),
    source('src/base.ts', 'export interface Base {}', [
      symbol('src/base.ts', 'Base', 'interface', 1)
    ]),
    source('src/runner.ts', 'export interface Runner {}', [
      symbol('src/runner.ts', 'Runner', 'interface', 1)
    ]),
    source('src/service.ts', [
      "import { helper } from './helper'; import './helper';",
      "import express from 'express';",
      "import fs from 'node:fs';",
      "import scoped from '@scope/pkg/subpath';",
      'export class Service extends Base {',
      '  reference() { const held = helper; return held; }',
      '  run() { return helper(); }',
      '}',
      'export class Worker implements Runner {}',
      'function localOnly() { return true; }',
      'localOnly();',
      'const zz = 1;'
    ].join('\n'), [
      symbol('src/service.ts', 'Service', 'class', 5),
      symbol('src/service.ts', 'reference', 'method', 6),
      symbol('src/service.ts', 'run', 'method', 7),
      symbol('src/service.ts', 'Worker', 'class', 9),
      symbol('src/service.ts', 'localOnly', 'function', 10)
    ]),
    source('src/service.test.ts', [
      "import { helper } from './helper';",
      "test('helper', () => helper());"
    ].join('\n'), [
      symbol('src/service.test.ts', 'helper test', 'test', 2)
    ]),
    source('src/missing.ts', "import value from './does-not-exist';"),
    source('src/dup-a.ts', 'export function duplicate() { return 1; }', [
      symbol('src/dup-a.ts', 'duplicate', 'function', 1)
    ]),
    source('src/dup-b.ts', 'export function duplicate() { return 2; }', [
      symbol('src/dup-b.ts', 'duplicate', 'function', 1)
    ]),
    source('src/use-dup.ts', 'duplicate();'),
    source('python/main.py', [
      'from python.helper import run',
      'import requests',
      'import google.cloud'
    ].join('\n')),
    source('python/helper.py', 'def run():\n    return True', [
      symbol('python/helper.py', 'run', 'function', 1)
    ]),
    source('native/main.c', [
      '#include "helper.h"',
      '#include <stdio.h>',
      'int main(void) { return helper(); }'
    ].join('\n')),
    source('native/helper.h', 'int helper(void);'),
    source('go.mod', 'module example.com/demo\n\ngo 1.24'),
    source('cmd/main.go', [
      'package main',
      'import (',
      '  "example.com/demo/internal/api"',
      '  "example.com/demo/internal/missing"',
      '  "fmt"',
      ')',
      'func main() { api.Run() }'
    ].join('\n'), [
      symbol('cmd/main.go', 'main', 'function', 7)
    ]),
    source('internal/api/api.go', 'package api\nfunc Run() {}', [
      symbol('internal/api/api.go', 'Run', 'function', 2)
    ]),
    source('rust/Cargo.toml', [
      '[package]',
      'name = "relationship-rust"',
      'version = "0.1.0"'
    ].join('\n')),
    source('rust/src/lib.rs', [
      'use crate::helper::answer;',
      'use serde::Serialize;',
      'pub fn run() -> i32 { answer() }'
    ].join('\n'), [
      symbol('rust/src/lib.rs', 'run', 'function', 3)
    ]),
    source('rust/src/helper.rs', 'pub fn answer() -> i32 { 42 }', [
      symbol('rust/src/helper.rs', 'answer', 'function', 1)
    ]),
    source('scripts/main.lua', [
      'local helper = require("scripts.helper")',
      'local missing = require("outside.module")',
      'return helper.run()'
    ].join('\n')),
    source('scripts/helper.lua', 'local M = {}\nfunction M.run() return true end\nreturn M', [
      symbol('scripts/helper.lua', 'run', 'function', 2)
    ]),
    source('styles/app.css', '@import "./base.css";'),
    source('styles/base.css', 'body { display: block; }')
  ];
}

function find(
  values: ArchitectureRelationshipCandidate[],
  predicate: (value: ArchitectureRelationshipCandidate) => boolean
): ArchitectureRelationshipCandidate {
  const result = values.find(predicate);
  expect(result).toBeDefined();
  return result!;
}

describe('CF-01 relationship branch coverage', () => {
  it('detects polyglot local, unresolved, external, test, inheritance, call, and reference edges', () => {
    const relationships = detectArchitectureRelationships(relationshipFiles());

    expect(find(relationships, value =>
      value.kind === 'imports'
      && value.sourceFile === 'src/service.ts'
      && value.targetFile === 'src/helper.ts'
    )).toEqual(expect.objectContaining({ confidence: 0.94 }));
    expect(relationships.filter(value =>
      value.sourceFile === 'src/service.ts'
      && value.targetFile === 'src/helper.ts'
      && value.line === 1
    )).toHaveLength(1);
    expect(find(relationships, value =>
      value.kind === 'tests'
      && value.sourceFile === 'src/service.test.ts'
      && value.targetFile === 'src/helper.ts'
    )).toBeDefined();
    expect(find(relationships, value =>
      value.unresolvedLocal === './does-not-exist'
    )).toEqual(expect.objectContaining({ confidence: 0.45 }));
    expect(find(relationships, value =>
      value.unresolvedLocal === 'example.com/demo/internal/missing'
    )).toBeDefined();

    for (const [sourceFile, targetFile] of [
      ['python/main.py', 'python/helper.py'],
      ['native/main.c', 'native/helper.h'],
      ['cmd/main.go', 'internal/api/api.go'],
      ['rust/src/lib.rs', 'rust/src/helper.rs'],
      ['scripts/main.lua', 'scripts/helper.lua'],
      ['styles/app.css', 'styles/base.css']
    ]) {
      expect(find(relationships, value =>
        value.kind === 'imports'
        && value.sourceFile === sourceFile
        && value.targetFile === targetFile
      )).toBeDefined();
    }

    for (const dependency of [
      'express', 'fs', '@scope/pkg', 'requests', 'google', 'stdio', 'fmt', 'serde',
      'outside'
    ]) {
      expect(find(relationships, value =>
        value.kind === 'depends_on' && value.externalModule === dependency
      )).toBeDefined();
    }

    expect(find(relationships, value =>
      value.kind === 'extends' && value.targetSymbol?.name === 'Base'
    )).toBeDefined();
    expect(find(relationships, value =>
      value.kind === 'implements' && value.targetSymbol?.name === 'Runner'
    )).toBeDefined();
    expect(find(relationships, value =>
      value.kind === 'references' && value.targetSymbol?.name === 'helper'
    )).toBeDefined();
    expect(find(relationships, value =>
      value.kind === 'calls' && value.targetSymbol?.name === 'helper'
    )).toBeDefined();
    expect(relationships.some(value =>
      value.sourceFile === 'src/use-dup.ts'
      && value.targetSymbol?.name === 'duplicate'
    )).toBe(false);
    expect(relationships.some(value => value.targetSymbol?.name === 'localOnly')).toBe(false);
  });

  it('materializes resolvable edges, reuses declared dependencies, and warns once per missing import', () => {
    const files = relationshipFiles();
    const graph = new ArchitectureGraphCollector(5000);
    const structure = new ArchitectureStructureCollector().collect(files, graph, 'relationships');
    const features = new ArchitectureFeatureCollector().collect(
      files,
      graph,
      structure.repositoryId,
      structure.fileIds,
      structure.parentIds
    );
    const declaredExpress = features.dependencyIds.get('express');
    expect(declaredExpress).toBe(stableId('external_dependency', 'express'));

    new ArchitectureRelationshipCollector().collect(
      files,
      graph,
      structure.fileIds,
      structure.symbolIds,
      features.testIds,
      features.dependencyIds
    );
    const nodes = graph.nodes();
    const edges = graph.edges();

    expect(features.dependencyIds.get('express')).toBe(declaredExpress);
    expect(nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'external_dependency',
        label: '@scope/pkg',
        attributes: { scope: 'inferred' }
      }),
      expect.objectContaining({
        kind: 'external_dependency',
        label: 'serde',
        attributes: { scope: 'inferred' }
      })
    ]));
    expect(edges.map(edge => edge.kind)).toEqual(expect.arrayContaining([
      'imports', 'tests', 'depends_on', 'extends', 'implements', 'calls', 'references'
    ]));
    expect(graph.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'UNRESOLVED_LOCAL_IMPORT',
        file: 'src/missing.ts'
      }),
      expect.objectContaining({
        code: 'UNRESOLVED_LOCAL_IMPORT',
        file: 'cmd/main.go'
      })
    ]));

    const warningCount = graph.warnings.length;
    new ArchitectureRelationshipCollector().collect(
      files,
      graph,
      structure.fileIds,
      structure.symbolIds,
      features.testIds,
      features.dependencyIds
    );
    expect(graph.warnings).toHaveLength(warningCount);
  });

  it('skips relationships when source or target identity is intentionally unavailable', () => {
    const files = relationshipFiles();
    const graph = new ArchitectureGraphCollector(100);
    const relationshipCollector = new ArchitectureRelationshipCollector();
    relationshipCollector.collect(
      files,
      graph,
      new Map(),
      new Map(),
      new Map(),
      new Map()
    );
    expect(graph.edges()).toEqual([]);
    expect(graph.nodes().every(node => node.kind === 'external_dependency')).toBe(true);
    expect(graph.warnings.some(warning => warning.code === 'UNRESOLVED_LOCAL_IMPORT')).toBe(true);
  });
});
