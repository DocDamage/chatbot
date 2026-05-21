import { CreativeRating } from './CreativeTypes';

export type CreativeExportFormat = 'markdown' | 'text' | 'json';

export type CreativeProjectPrivacy = {
  localOnly: boolean;
  analyticsEnabled: boolean;
  retentionDays?: number;
};

export type DraftVersion = {
  id: string;
  content: string;
  branchId?: string;
  createdAt: string;
};

export type CreativeBranch = {
  id: string;
  name: string;
  parentVersionId?: string;
};

export type CreativeScene = {
  id: string;
  title: string;
  summary?: string;
  versions: DraftVersion[];
  branches: CreativeBranch[];
  currentVersionId?: string;
};

export type CreativeChapter = {
  id: string;
  title: string;
  scenes: CreativeScene[];
};

export type CreativeProject = {
  id: string;
  title: string;
  genre: string;
  rating: CreativeRating;
  chapters: CreativeChapter[];
  currentBranchId?: string;
  privacy: CreativeProjectPrivacy;
  createdAt: string;
  updatedAt: string;
};

export class CreativeProjectStore {
  private projects = new Map<string, CreativeProject>();
  private nextProjectId = 1;
  private nextChapterId = 1;
  private nextSceneId = 1;
  private nextVersionId = 1;
  private nextBranchId = 1;

  createProject(input: {
    title: string;
    genre: string;
    rating: CreativeRating;
    privacy?: Partial<CreativeProjectPrivacy>;
  }): CreativeProject {
    const now = new Date().toISOString();
    const project: CreativeProject = {
      id: `creative-project-${this.nextProjectId++}`,
      title: input.title,
      genre: input.genre,
      rating: input.rating,
      chapters: [],
      privacy: {
        localOnly: input.privacy?.localOnly ?? false,
        analyticsEnabled: input.privacy?.analyticsEnabled ?? true,
        retentionDays: input.privacy?.retentionDays,
      },
      createdAt: now,
      updatedAt: now,
    };
    this.projects.set(project.id, project);
    return project;
  }

  getProject(id: string): CreativeProject {
    const project = this.projects.get(id);
    if (!project) {
      throw new Error(`Creative project not found: ${id}`);
    }
    return project;
  }

  findProject(id: string): CreativeProject | undefined {
    return this.projects.get(id);
  }

  deleteProject(id: string): void {
    this.projects.delete(id);
  }

  addChapter(projectId: string, input: { title: string }): CreativeChapter {
    const project = this.getProject(projectId);
    const chapter = { id: `chapter-${this.nextChapterId++}`, title: input.title, scenes: [] };
    project.chapters.push(chapter);
    this.touch(project);
    return chapter;
  }

  addScene(projectId: string, chapterId: string, input: { title: string; summary?: string }): CreativeScene {
    const chapter = this.getChapter(projectId, chapterId);
    const scene = {
      id: `scene-${this.nextSceneId++}`,
      title: input.title,
      summary: input.summary,
      versions: [],
      branches: [],
    };
    chapter.scenes.push(scene);
    this.touch(this.getProject(projectId));
    return scene;
  }

  addDraftVersion(projectId: string, sceneId: string, input: { content: string; branchId?: string }): DraftVersion {
    const scene = this.mustGetScene(projectId, sceneId);
    const version = {
      id: `draft-${this.nextVersionId++}`,
      content: input.content,
      branchId: input.branchId,
      createdAt: new Date().toISOString(),
    };
    scene.versions.push(version);
    scene.currentVersionId = version.id;
    this.touch(this.getProject(projectId));
    return version;
  }

  createBranch(projectId: string, sceneId: string, input: { name: string; parentVersionId?: string }): CreativeBranch {
    const scene = this.mustGetScene(projectId, sceneId);
    const branch = { id: `branch-${this.nextBranchId++}`, name: input.name, parentVersionId: input.parentVersionId };
    scene.branches.push(branch);
    return branch;
  }

  restoreBranch(projectId: string, sceneId: string, branchId: string): CreativeScene {
    const project = this.getProject(projectId);
    const scene = this.mustGetScene(projectId, sceneId);
    const branchVersion = [...scene.versions].reverse().find(version => version.branchId === branchId);
    if (!branchVersion) {
      throw new Error(`Branch has no draft version: ${branchId}`);
    }
    project.currentBranchId = branchId;
    scene.currentVersionId = branchVersion.id;
    this.touch(project);
    return scene;
  }

  getScene(projectId: string, sceneId: string): CreativeScene | undefined {
    return this.getProject(projectId).chapters.flatMap(chapter => chapter.scenes).find(scene => scene.id === sceneId);
  }

  exportProject(projectId: string, format: CreativeExportFormat) {
    const project = this.getProject(projectId);
    const payload = {
      id: project.id,
      title: project.title,
      genre: project.genre,
      rating: project.rating,
      privacy: project.privacy,
      chapters: project.chapters,
    };
    if (format === 'json') {
      return { format, content: JSON.stringify(payload, null, 2) };
    }
    const lines = [
      `# ${project.title}`,
      '',
      `Genre: ${project.genre}`,
      `Rating: ${project.rating}`,
      '',
      ...project.chapters.flatMap(chapter => [
        `## ${chapter.title}`,
        '',
        ...chapter.scenes.flatMap(scene => [
          `### ${scene.title}`,
          scene.summary || '',
          this.currentContent(scene),
          '',
        ]),
      ]),
    ];
    return { format, content: format === 'text' ? lines.filter(Boolean).join('\n') : lines.join('\n') };
  }

  private getChapter(projectId: string, chapterId: string): CreativeChapter {
    const chapter = this.getProject(projectId).chapters.find(item => item.id === chapterId);
    if (!chapter) {
      throw new Error(`Creative chapter not found: ${chapterId}`);
    }
    return chapter;
  }

  private mustGetScene(projectId: string, sceneId: string): CreativeScene {
    const scene = this.getScene(projectId, sceneId);
    if (!scene) {
      throw new Error(`Creative scene not found: ${sceneId}`);
    }
    return scene;
  }

  private currentContent(scene: CreativeScene): string {
    const current = scene.versions.find(version => version.id === scene.currentVersionId);
    return current?.content || '';
  }

  private touch(project: CreativeProject): void {
    project.updatedAt = new Date().toISOString();
  }
}
