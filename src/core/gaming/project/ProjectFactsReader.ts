import fs from 'node:fs';
import path from 'node:path';
import { EngineKind, parseUnityProjectVersion, parseUnrealAssociation } from './EngineVersions';
import { ProjectEnrollmentError, ProjectFacts } from './ProjectEnrollmentTypes';
import { readProjectText } from './ProjectIdentity';

function strings(source: string): string[] {
  return [...source.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map(match => JSON.parse(`"${match[1]}"`) as string);
}

/** Static metadata only. No engine scripts, project hooks, XML entities or plugins are executed. */
export function readProjectFacts(root: string, engine: EngineKind): ProjectFacts {
  const descriptors: Record<string, string> = {};
  let totalBytes = 0;
  const read = (relative: string): string => {
    const record = readProjectText(root, relative);
    totalBytes += record.byteLength;
    if (totalBytes > 4 * 1024 * 1024 || Object.keys(descriptors).length >= 32) throw new ProjectEnrollmentError('PROFILE_METADATA_LIMIT', 'Project metadata needs a narrower inspection plan.', 413);
    descriptors[relative] = record.sha256;
    return record.content;
  };
  const json = (relative: string): Record<string, any> => {
    let value: unknown;
    try { value = JSON.parse(read(relative)); }
    catch (error) {
      if (error instanceof ProjectEnrollmentError) throw error;
      throw new ProjectEnrollmentError('INVALID_PROJECT_DESCRIPTOR', `Malformed JSON metadata: ${relative}`, 400);
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ProjectEnrollmentError('INVALID_PROJECT_DESCRIPTOR', `Expected a JSON object: ${relative}`, 400);
    return value as Record<string, any>;
  };
  const facts: ProjectFacts = { engine, descriptors, projectVersion: null, association: null, features: [], language: 'unknown', renderer: null,
    languageEvidence: { source: 'Engine/project metadata; source-file classification remains G01.3 work.', confidence: 'inferred' },
    buildTarget: null, packages: {}, unknowns: ['Export target/modules/templates are not qualified by enrollment.'] };
  if (engine === 'godot') {
    const config = read('project.godot');
    if (!/^config_version\s*=\s*5\s*$/m.test(config)) throw new ProjectEnrollmentError('UNSUPPORTED_GODOT_PROJECT_FORMAT', 'Only the Godot 4 project format is enrolled by this resolver.', 400);
    facts.features = strings(config.match(/^config\/features\s*=\s*PackedStringArray\(([^\r\n]*)\)/m)?.[1] || '');
    const projects = fs.readdirSync(root).filter(name => /\.csproj$/i.test(name)).sort();
    facts.language = facts.features.includes('C#') || projects.length > 0 ? 'csharp' : 'gdscript';
    facts.languageEvidence.source = 'project.godot features and root .csproj presence/absence; mixed/external scripts still require source classification.';
    const dotnet = projects.map(file => ({ file, targetFramework: read(file).match(/<TargetFramework>([^<]+)<\/TargetFramework>/)?.[1] || null }));
    facts.renderer = config.match(/^renderer\/rendering_method\s*=\s*"([^"\r\n]+)"/m)?.[1] || null;
    if (!facts.renderer) facts.unknowns.push('No renderer setting was observed; no renderer was inferred.');
    const enabled = strings(config.match(/\[editor_plugins\][\s\S]*?^enabled\s*=\s*PackedStringArray\(([^\r\n]*)\)/m)?.[1] || '');
    const plugins = enabled.map(resource => {
      if (!/^res:\/\/addons\/.+\/plugin\.cfg$/.test(resource)) throw new ProjectEnrollmentError('UNSUPPORTED_PLUGIN_REFERENCE', 'Plugin metadata must be a project-confined addon/plugin.cfg.', 400);
      const source = read(resource.slice(6));
      return { name: source.match(/^name\s*=\s*"([^"\r\n]+)"/m)?.[1] || null, version: source.match(/^version\s*=\s*"([^"\r\n]+)"/m)?.[1] || null };
    });
    facts.packages = { dotnet, plugins };
  } else if (engine === 'unity') {
    facts.projectVersion = parseUnityProjectVersion(read('ProjectSettings/ProjectVersion.txt'));
    const manifest = json('Packages/manifest.json');
    const lock = fs.existsSync(path.join(root, 'Packages/packages-lock.json')) ? json('Packages/packages-lock.json') : null;
    facts.language = 'csharp'; facts.packages = { dependencies: manifest.dependencies || {}, lock };
    facts.languageEvidence.source = 'ProjectSettings/ProjectVersion.txt and Unity engine language convention.';
    if (!lock) facts.unknowns.push('Unity package lock is absent; package resolution is not reproducible.');
    for (const name of ['ProjectSettings/GraphicsSettings.asset', 'ProjectSettings/ProjectSettings.asset']) {
      if (fs.existsSync(path.join(root, name))) read(name); // Bind raw metadata; do not treat YAML as a native scene model.
    }
  } else if (engine === 'unreal') {
    const projects = fs.readdirSync(root).filter(name => /\.uproject$/i.test(name)).sort();
    if (projects.length !== 1) throw new ProjectEnrollmentError('AMBIGUOUS_UNREAL_PROJECT', 'Choose a directory with exactly one .uproject descriptor.', 400);
    const project = json(projects[0]);
    facts.association = parseUnrealAssociation(JSON.stringify(project));
    facts.language = 'cpp-or-blueprint'; facts.packages = { plugins: project.Plugins || [], modules: project.Modules || [] };
    facts.languageEvidence.source = `${projects[0]} module/plugin metadata; source/Blueprint classification remains unresolved.`;
    facts.unknowns.push('Native compiler/toolchain and project plugin compatibility require separate qualification.');
  } else {
    const projects = fs.readdirSync(root).filter(name => /\.rmmzproject$/i.test(name)).sort();
    if (projects.length !== 1) throw new ProjectEnrollmentError('MZ_PROJECT_MARKER_REQUIRED', 'Choose an RPG Maker MZ project, not an MV project.', 400);
    read(projects[0]);
    const core = read('js/rmmz_core.js');
    if (!/Utils\.RPGMAKER_NAME\s*=\s*["']MZ["']/.test(core)) throw new ProjectEnrollmentError('MZ_RUNTIME_IDENTITY_REQUIRED', 'MZ core identity could not be established statically.', 400);
    facts.projectVersion = core.match(/Utils\.RPGMAKER_VERSION\s*=\s*["'](\d+\.\d+\.\d+)["']/)?.[1] || null;
    const pluginSource = read('js/plugins.js');
    const assignment = pluginSource.match(/(?:var|let|const)\s+\$plugins\s*=\s*(\[[\s\S]*\])\s*;?\s*$/);
    if (!assignment) throw new ProjectEnrollmentError('UNSUPPORTED_MZ_PLUGIN_SYNTAX', 'Plugin configuration needs a static JSON assignment; it will not be evaluated.', 400);
    const plugins: unknown = JSON.parse(assignment[1]);
    if (!Array.isArray(plugins)) throw new ProjectEnrollmentError('INVALID_MZ_PLUGINS', 'Expected an ordered plugin array.', 400);
    facts.language = 'javascript'; facts.packages = { plugins };
    facts.languageEvidence = { source: 'Statically read js/rmmz_core.js and js/plugins.js JavaScript sources.', confidence: 'observed' };
  }
  return facts;
}
