import { CreativeProjectStore } from './CreativeProjectStore';

export class CreativePrivacyManager {
  constructor(private readonly projects: CreativeProjectStore) {}

  redactLog(text: string): string {
    return text
      .replace(/\b[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, '[email]')
      .replace(/\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g, '[phone]');
  }

  deleteProject(projectId: string): void {
    this.projects.deleteProject(projectId);
  }

  analyticsAllowed(projectId: string): boolean {
    return this.projects.getProject(projectId).privacy.analyticsEnabled;
  }
}
