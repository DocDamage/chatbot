import fs from 'node:fs';
import path from 'node:path';
import { resolveProjectPath } from '../engine/ProjectPathGuard';
import { EngineMutationAction, EngineAssertion, EngineAssertionReport } from '../engine/GameEngineTypes';
import { scenarioRequestDigest } from '../engine/NativeScenarioEvidence';
import { EnrolledProject, ProjectEnrollmentError } from './ProjectEnrollmentTypes';
import { validateEnrollmentPath } from './ProjectIdentity';
import { createProjectFilePolicy } from './ProjectFilePolicy';
import { PatchConflictDetector } from '../../coding/editing/PatchConflictDetector';

export function sessionPath(project: EnrolledProject, requested: string): string {
  if (typeof requested !== 'string' || !requested.trim()) throw new ProjectEnrollmentError('SESSION_PATH_INVALID', 'A confined project-relative path is required.', 400);
  const relative = requested.startsWith('res://') ? requested.slice(6) : requested;
  if (path.isAbsolute(relative) || /^[a-z]:/i.test(relative) || relative === '.') throw new ProjectEnrollmentError('SESSION_PATH_INVALID', 'Session file paths must be relative to the enrolled project.', 400);
  validateEnrollmentPath(relative);
  return resolveProjectPath(project.canonicalRoot, relative);
}

export function guardDescriptorMutations(project: EnrolledProject, actions: EngineMutationAction[]): void {
  if (!Array.isArray(actions)) throw new ProjectEnrollmentError('INVALID_SESSION_ACTIONS', 'Mutation actions must be an array.', 400);
  const key = (file: string) => process.platform === 'win32' ? file.toLowerCase() : file;
  const descriptors = new Set(Object.keys(project.profile.facts.descriptors).map(file => key(fs.realpathSync.native(resolveProjectPath(project.canonicalRoot, file)))));
  const policy = createProjectFilePolicy(project.profile.facts.engine, Object.keys(project.profile.facts.descriptors));
  for (const action of actions) {
    const target = sessionPath(project, action?.targetPath);
    const actual = fs.existsSync(target) ? fs.realpathSync.native(target) : target;
    if (descriptors.has(key(actual))) throw new ProjectEnrollmentError('PROJECT_CONFIGURATION_EDIT_REQUIRES_REFRESH', 'Configuration edits require a dedicated profile-refresh workflow; this session cannot change its own identity.', 400);
    if (!policy.canEditText(action.targetPath)) throw new ProjectEnrollmentError('PROJECT_FILE_ROLE_REQUIRES_DEDICATED_OPERATION', 'This file role cannot enter the generic source mutation workflow.', 400);
    try { new PatchConflictDetector(project.canonicalRoot, policy).safe(action.targetPath); }
    catch { throw new ProjectEnrollmentError('PROJECT_FILE_PATH_UNSAFE', 'Project source mutation cannot traverse links or protected file roles.', 400); }
  }
}

export function guardSessionEvidence(project: EnrolledProject, report: EngineAssertionReport, assertions: EngineAssertion[], scenePath: string, scopeDigest: string): void {
  // A failed/empty check remains a failed observation, including inspection-only native results.
  if (!report.evidence && !report.passed) return;
  const evidence = report.evidence;
  if (!evidence || typeof evidence.runId !== 'string' || !/^[0-9a-f-]{36}$/i.test(evidence.runId) || evidence.engine !== project.profile.facts.engine || evidence.projectRoot !== project.canonicalRoot || evidence.scenePath !== scenePath ||
    evidence.requestDigest !== scenarioRequestDigest({ runId: evidence.runId, engine: evidence.engine, projectRoot: project.canonicalRoot, scenePath }, assertions, scopeDigest)) {
    throw new ProjectEnrollmentError('SESSION_EVIDENCE_MISMATCH', 'Native evidence does not match this session, profile, runtime and attempt.');
  }
}

export function guardNativeWritePaths(project: EnrolledProject): void {
  const paths = ['builds', '.chatbot-instrumentation'];
  if (project.profile.facts.engine === 'godot') paths.push('.godot');
  if (project.profile.facts.engine === 'unity') paths.push('Assets/Editor/ChatBotHubInstrumentationBridge.cs', 'Assets/Editor/ChatBotHubBuildBridge.cs', 'Library', 'Temp', 'Logs');
  if (project.profile.facts.engine === 'unreal') paths.push('Content/Python/chatbot_hub_instrumentation.py', 'Saved', 'Intermediate');
  for (const file of paths) sessionPath(project, file);
}
