import { digestJson } from '../engine/CanonicalJson';
import { EngineKind, parseGodotExecutableVersion, selectExactRuntime } from './EngineVersions';
import { readProjectFacts } from './ProjectFactsReader';
import { ProjectRuntimeCatalog } from './ProjectRuntimeCatalog';
import { EnrolledRuntime, ProfileBlocker, ProfileSelection, ProjectIdentity, ProjectProfile } from './ProjectEnrollmentTypes';

export function projectProfileDigest(identity: ProjectIdentity, profile: Omit<ProjectProfile, 'profileDigest' | 'observedAt'>): string {
  const stableRuntime = profile.runtime ? { ...profile.runtime, observedAt: undefined } : null;
  if (stableRuntime) delete stableRuntime.observedAt;
  return digestJson('game-project-profile:v1', { identity: {
    canonicalRoot: identity.canonicalRoot, filesystemIdentity: identity.filesystemIdentity, physicalKey: identity.physicalKey
  }, ...profile, runtime: stableRuntime });
}

export class ProjectProfileResolver {
  constructor(readonly catalog: ProjectRuntimeCatalog) {}

  public async resolve(identity: ProjectIdentity, engine: EngineKind, selection: ProfileSelection): Promise<ProjectProfile> {
    const facts = readProjectFacts(identity.canonicalRoot, engine);
    const inventory = await this.catalog.inventory(engine);
    const blockers: ProfileBlocker[] = [];
    let runtime: EnrolledRuntime | null = null;
    try {
      if (engine === 'rpg-maker-mz') throw new Error('MZ_RUNTIME_ENROLLMENT_NOT_QUALIFIED');
      if (!inventory.runtimes.length) throw new Error('RUNTIME_NOT_INSTALLED');
      let selectedId = selection.selectedRuntimeId;
      const selected = inventory.runtimes.find(candidate => candidate.runtimeId === selectedId);
      let version = selection.expectedVersion || facts.projectVersion || selected?.exactVersion;
      if (facts.projectVersion && selection.expectedVersion && facts.projectVersion !== selection.expectedVersion) throw new Error('PROJECT_RUNTIME_VERSION_MISMATCH');
      if (engine === 'godot') {
        if (!version) throw new Error('RUNTIME_SELECTION_REQUIRED');
        parseGodotExecutableVersion(version);
        if (!version.startsWith('4.')) throw new Error('UNSUPPORTED_GODOT_RUNTIME');
        const requirements = facts.features.filter(value => /^\d+\.\d+(?:\.\d+)?$/.test(value));
        if (requirements.length > 1) throw new Error('AMBIGUOUS_GODOT_FEATURE_VERSION');
        if (requirements[0] && !version.startsWith(`${requirements[0]}.`)) throw new Error('PROJECT_RUNTIME_VERSION_MISMATCH');
        if (facts.language === 'csharp' && !/(?:^|\.)mono(?:\.|$)/i.test(version)) throw new Error('GODOT_MONO_RUNTIME_REQUIRED');
      }
      if (engine === 'unreal') {
        const association = facts.association!;
        const associationKey = (value: string) => value.replace(/^\{([0-9a-f-]{36})\}$/i, '$1').toLowerCase();
        const associated = inventory.runtimes.filter(candidate => candidate.associations.some(value => associationKey(value) === associationKey(association)));
        if (!selectedId && associated.length === 1) { selectedId = associated[0].runtimeId; version ||= associated[0].exactVersion; }
        if (!selectedId && associated.length > 1) throw new Error('AMBIGUOUS_RUNTIME_SELECTION');
        if (!version) throw new Error('UNRESOLVED_UNREAL_ASSOCIATION');
        // Numeric associations constrain the release; GUIDs resolve only via host mappings or explicit selection.
        if (/^\d+\.\d+(?:\.\d+)?$/.test(association) && version !== association && !version.startsWith(`${association}.`)) throw new Error('PROJECT_RUNTIME_VERSION_MISMATCH');
      }
      const chosen = selectExactRuntime(engine, version || '', inventory.runtimes, selectedId, selection.expectedBuildDigest);
      runtime = inventory.runtimes.find(candidate => candidate.runtimeId === chosen.runtimeId)!;
      if (engine === 'godot' && facts.language === 'csharp') blockers.push({ code: 'DOTNET_TOOLCHAIN_NOT_ENROLLED', message: 'Enroll the project target framework and matching .NET SDK before C# execution.' });
      if (!selectedId && !selection.expectedBuildDigest) blockers.push(...inventory.blockers);
      else for (const failure of inventory.blockers) facts.unknowns.push(`Another installation could not be inspected: ${failure.code}`);
    } catch (error) {
      const code = error instanceof Error ? error.message : String(error);
      const actions: Record<string, string> = {
        RUNTIME_NOT_INSTALLED: `Install/configure a ${engine} executable in the host inventory, then refresh this enrollment.`,
        RUNTIME_SELECTION_REQUIRED: 'Choose selectedRuntimeId from the inspected runtime inventory; project format/features do not identify an exact release.',
        AMBIGUOUS_RUNTIME_SELECTION: 'Multiple matching installations exist. Choose their exact selectedRuntimeId.',
        PROJECT_RUNTIME_VERSION_MISMATCH: 'The selected runtime conflicts with the project metadata. Select a compatible runtime; do not migrate the project implicitly.',
        UNRESOLVED_UNREAL_ASSOCIATION: 'Resolve the EngineAssociation through the host installation registry or explicitly select an inspected runtime.',
        MZ_RUNTIME_ENROLLMENT_NOT_QUALIFIED: 'MZ metadata was read statically; its runtime enrollment adapter still needs native qualification.'
      };
      blockers.push({ code, message: actions[code] || `Select an inspected exact ${engine} runtime compatible with the observed project metadata. No project migration was performed.` }, ...inventory.blockers);
    }
    const packages = facts.packages as Record<string, any>;
    let compatibilityPackages: unknown = {};
    if (engine === 'unity') {
      const dependencies = packages.dependencies;
      if (!dependencies || typeof dependencies !== 'object' || Array.isArray(dependencies)) blockers.push({ code: 'INVALID_PACKAGE_MANIFEST', message: 'Unity dependencies must be a versioned object.' });
      else {
        const locked = packages.lock?.dependencies;
        const entries = locked && typeof locked === 'object' && !Array.isArray(locked) ? Object.entries(locked) : [];
        compatibilityPackages = { direct: dependencies, locked: Object.fromEntries(entries.map(([name, item]) => {
          const dependency = item as Record<string, unknown>;
          return [name, { version: dependency?.version ?? null, source: dependency?.source ?? null, hash: dependency?.hash ?? null }];
        })) };
        if (Object.values(dependencies).some(value => typeof value !== 'string' || /^(?:file:|link:|[a-z]:[\\/]|\/)/i.test(value))) blockers.push({ code: 'LOCAL_PACKAGE_COMPATIBILITY_UNRESOLVED', message: 'Local Unity packages need their own version/content enrollment; project paths are not knowledge target facets.' });
        if (!locked || typeof locked !== 'object' || Array.isArray(locked) || entries.some(([, value]) => {
          const dependency = value as Record<string, unknown>;
          return !dependency || typeof dependency.version !== 'string' || /^(?:file:|link:|[a-z]:[\\/]|\/)/i.test(dependency.version) || ['local', 'embedded'].includes(String(dependency.source));
        }) || Object.keys(dependencies).some(name => !Object.hasOwn(locked || {}, name) ||
          (/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(dependencies[name]) && locked[name]?.version !== dependencies[name]))) blockers.push({ code: 'PACKAGE_VERSION_UNRESOLVED', message: 'Every direct package needs a matching reproducible lock entry; local package contents require separate enrollment.' });
      }
      if (!packages.lock) blockers.push({ code: 'PACKAGE_LOCK_REQUIRED', message: 'Resolve and retain the Unity package lock before treating the profile as exact.' });
    } else if (engine === 'godot') {
      compatibilityPackages = packages.plugins;
      if (packages.plugins.some((plugin: any) => !plugin.name || !plugin.version)) blockers.push({ code: 'PLUGIN_VERSION_UNRESOLVED', message: 'Enabled addons need explicit name/version metadata.' });
    } else if (engine === 'unreal') compatibilityPackages = packages.plugins;
    const targetId = runtime && !blockers.length ? digestJson('game-knowledge-target:v1', {
      engine, exactVersion: runtime.exactVersion, buildIdentity: runtime.buildIdentityDigest || runtime.exactVersion,
      language: facts.language, renderer: facts.renderer, packages: compatibilityPackages
    }) : null;
    const profile = { schemaVersion: 1 as const, facts, runtime, selection, targetId, blockers,
      resolution: blockers.length ? 'blocked' as const : 'resolved' as const };
    return { ...profile, profileDigest: projectProfileDigest(identity, profile), observedAt: new Date().toISOString() };
  }
}
