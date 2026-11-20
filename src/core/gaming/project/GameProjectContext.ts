import { ApprovedRepositoryGateway } from '../../coding/security/ApprovedRepositoryGateway';
import { captureFiles } from '../../coding/integrations/ToolWorkspace';
import { selectAutomaticContext } from '../../coding/integrations/AutomaticContext';
import { createProjectFilePolicy } from './ProjectFilePolicy';
import { GameProjectRegistry } from './GameProjectRegistry';
import { ProjectOwner, ProjectEnrollmentError, EnrolledProject } from './ProjectEnrollmentTypes';
import { projectOperationLocks } from './ProjectOperationLocks';
import { digestJson } from '../engine/CanonicalJson';

/** Read-only project source context. Runtime execution does not become qualified by source enrollment. */
export class GameProjectContext {
  constructor(private readonly registry: GameProjectRegistry) {}
  private async run<T>(owner: ProjectOwner, id: string, work: (project: EnrolledProject, gateway: ApprovedRepositoryGateway) => T): Promise<T & { projectScope: object }> {
    const enrolled = await this.registry.get(owner, id);
    return projectOperationLocks.run(enrolled.physicalKey, async () => {
      const project = await this.registry.get(owner, id);
      const policy = createProjectFilePolicy(project.profile.facts.engine, Object.keys(project.profile.facts.descriptors));
      const result = work(project, new ApprovedRepositoryGateway(project.canonicalRoot, { filePolicy: policy }));
      const current = await this.registry.get(owner, id);
      if (current.revision !== project.revision || current.profile.profileDigest !== project.profile.profileDigest) throw new ProjectEnrollmentError('PROJECT_CONTEXT_STALE', 'Project profile changed while selecting context.');
      return { ...result, projectScope: { projectId: id, profileDigest: project.profile.profileDigest, profileRevision: project.revision, physicalKey: project.physicalKey } };
    });
  }
  files(owner: ProjectOwner, id: string) {
    return this.run(owner, id, (project, gateway) => {
      const policy = createProjectFilePolicy(project.profile.facts.engine, Object.keys(project.profile.facts.descriptors));
      const files = gateway.listFiles('.', 1000);
      return { files: files.map(file => ({ ...policy.classify(file), textReadable: policy.canReadText(file), genericTextEditable: policy.canEditText(file) })),
        discoveryLimitReached: files.length === 1000, limit: 1000 };
    });
  }
  search(owner: ProjectOwner, id: string, query: string) {
    return this.run(owner, id, (_project, gateway) => gateway.searchText(query, { maxFiles: 1000, maxResults: 50, maxBytesPerFile: 32000 }));
  }
  select(owner: ProjectOwner, id: string, files: string[], message: string, automatic: boolean) {
    return this.run(owner, id, (project, gateway) => {
      const filePolicy = createProjectFilePolicy(project.profile.facts.engine, Object.keys(project.profile.facts.descriptors));
      const selection = selectAutomaticContext(project.canonicalRoot, captureFiles(project.canonicalRoot, files, 16000, 12, filePolicy, 'read'), [], message, automatic, { filePolicy, readOnly: true });
      for (const file of selection.readOnly) {
        const current = gateway.readTextFile(file.path, 16000);
        if (current.truncated || current.sha256 !== file.sha256) throw new ProjectEnrollmentError('PROJECT_CONTEXT_STALE', `Source changed while selecting context: ${file.path}`);
      }
      const sourceHashes = Object.fromEntries(selection.readOnly.map(file => [file.path, file.sha256]).sort(([a], [b]) => a.localeCompare(b)));
      return { ...selection, contextDigest: digestJson('project-source-context:v1', { projectId: id, owner, physicalKey: project.physicalKey,
        profileDigest: project.profile.profileDigest, sourceHashes }), sourceHashes,
        limitations: [...selection.limitations, 'Read-only bounded source context; no edit approval, native verification, full project snapshot or retrieval corpus activation.'] };
    });
  }
}
