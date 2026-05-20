import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export interface CreatePlanInput {
  userRequest: string;
  mode: string;
  affectedFiles?: string[];
  phases?: string[];
  acceptanceCriteria?: string[];
  risks?: string[];
  verificationChecklist?: string[];
}

export interface SavedPlan {
  planId: string;
  planPath: string;
  title: string;
  summary: string;
  content: string;
  savedMarkdown: true;
  suggestedNextMode: 'implement';
  createdAt: string;
}

export class PlanDocumentService {
  constructor(private readonly workspaceRoot = process.cwd()) {}

  async createPlan(input: CreatePlanInput): Promise<SavedPlan> {
    const createdAt = new Date().toISOString();
    const title = this.titleFromRequest(input.userRequest);
    const shortId = crypto.createHash('sha1').update(`${input.userRequest}:${createdAt}`).digest('hex').slice(0, 8);
    const date = createdAt.slice(0, 10);
    const planId = `${this.slug(title)}-${shortId}`;
    const planPath = path.posix.join('plans', date, `${planId}.md`);
    const absolutePath = path.join(this.workspaceRoot, planPath);
    const content = this.renderMarkdown(input, title, createdAt, planId);

    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, content, 'utf8');

    return {
      planId,
      planPath,
      title,
      summary: `Saved Markdown plan for "${input.userRequest}".`,
      content,
      savedMarkdown: true,
      suggestedNextMode: 'implement',
      createdAt
    };
  }

  async listPlans(): Promise<Array<Omit<SavedPlan, 'content'>>> {
    const plansRoot = path.join(this.workspaceRoot, 'plans');
    const files = await this.walkMarkdown(plansRoot).catch(() => []);
    const plans: Array<Omit<SavedPlan, 'content'>> = [];
    for (const file of files) {
      const content = await fs.readFile(file, 'utf8');
      const plan = this.parsePlan(file, content);
      const { content: _content, ...rest } = plan;
      plans.push(rest);
    }
    return plans.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getPlan(planId: string): Promise<SavedPlan | undefined> {
    const plansRoot = path.join(this.workspaceRoot, 'plans');
    const files = await this.walkMarkdown(plansRoot).catch(() => []);
    const match = files.find(file => path.basename(file, '.md') === planId);
    if (!match) return undefined;
    return this.parsePlan(match, await fs.readFile(match, 'utf8'));
  }

  private parsePlan(file: string, content: string): SavedPlan {
    const title = content.match(/^#\s+(.+)$/m)?.[1] || path.basename(file, '.md');
    const createdAt = content.match(/\*\*Created:\*\*\s*(.+)$/m)?.[1] || new Date(0).toISOString();
    const planId = path.basename(file, '.md');
    return {
      planId,
      planPath: path.relative(this.workspaceRoot, file).replace(/\\/g, '/'),
      title,
      summary: `Saved Markdown plan: ${title}.`,
      content,
      savedMarkdown: true,
      suggestedNextMode: 'implement',
      createdAt
    };
  }

  private renderMarkdown(input: CreatePlanInput, title: string, createdAt: string, planId: string): string {
    return [
      `# ${title}`,
      '',
      `**Plan ID:** ${planId}`,
      `**User request:** ${input.userRequest}`,
      `**Mode:** ${input.mode}`,
      `**Created:** ${createdAt}`,
      '',
      '## Affected files',
      this.list(input.affectedFiles || ['To be confirmed during implementation.']),
      '',
      '## Implementation phases',
      this.list(input.phases || ['Inspect affected modules.', 'Make focused changes in Implement mode.', 'Run verification.']),
      '',
      '## Acceptance criteria',
      this.list(input.acceptanceCriteria || ['Behavior matches the request.', 'Relevant checks pass.']),
      '',
      '## Risks',
      this.list(input.risks || ['Unknown coupling until implementation evidence is gathered.']),
      '',
      '## Verification checklist',
      this.list(input.verificationChecklist || ['npm run type-check', 'npm test -- --runInBand', 'npm run build']),
      '',
      '## Implementation entry point',
      'Switch to Implement mode, load this plan by `planId`, inspect the affected files, and convert the phases into code changes. Do not apply patches from Plan mode.',
      ''
    ].join('\n');
  }

  private list(items: string[]): string {
    return items.map(item => `- ${item}`).join('\n');
  }

  private titleFromRequest(request: string): string {
    const compact = request.trim().replace(/\s+/g, ' ');
    return compact.length > 72 ? `${compact.slice(0, 69).trim()}...` : compact || 'Implementation Plan';
  }

  private slug(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 72) || 'plan';
  }

  private async walkMarkdown(root: string): Promise<string[]> {
    const entries = await fs.readdir(root, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const child = path.join(root, entry.name);
      if (entry.isDirectory()) files.push(...await this.walkMarkdown(child));
      if (entry.isFile() && entry.name.endsWith('.md')) files.push(child);
    }
    return files;
  }
}
