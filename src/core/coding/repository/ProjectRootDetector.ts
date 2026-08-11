import * as fs from 'fs';
import * as path from 'path';

export interface ProjectRoot { path: string; markers: string[]; parent?: string; }

const MARKERS = ['package.json', 'Cargo.toml', 'go.mod', 'go.work', 'pyproject.toml', 'setup.py', 'pom.xml', 'build.gradle', 'build.gradle.kts', '.sln', '.csproj', 'Package.swift', 'CMakeLists.txt', 'meson.build', 'project.godot'];

export class ProjectRootDetector {
  constructor(private readonly workspaceRoot: string) {}

  detect(files: string[]): ProjectRoot[] {
    const byDirectory = new Map<string, string[]>();
    for (const file of files) {
      const normalized = file.replace(/\\/g, '/');
      const directory = path.posix.dirname(normalized);
      const basename = path.posix.basename(normalized);
      if (MARKERS.some(marker => basename === marker || (marker.startsWith('.') && basename.endsWith(marker)))) {
        const list = byDirectory.get(directory) || [];
        list.push(basename);
        byDirectory.set(directory, list);
      }
    }
    const roots = [...byDirectory.entries()].map(([relative, markers]) => ({ path: path.resolve(this.workspaceRoot, relative), markers }));
    return roots.map(root => ({ ...root, parent: roots.filter(other => other.path !== root.path && root.path.startsWith(`${other.path}${path.sep}`)).sort((a, b) => b.path.length - a.path.length)[0]?.path }));
  }
}
