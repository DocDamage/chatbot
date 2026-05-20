import fs from 'fs';
import os from 'os';
import path from 'path';
import { PlanDocumentService } from './PlanDocumentService';

describe('PlanDocumentService', () => {
  it('saves markdown plans with metadata and can read them back', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'plan-docs-'));
    const service = new PlanDocumentService(root);

    const plan = await service.createPlan({
      userRequest: 'Add a file explorer',
      mode: 'plan',
      affectedFiles: ['src/server/index.ts'],
      phases: ['Create service', 'Mount route'],
      acceptanceCriteria: ['Plan is saved'],
      risks: ['Route conflict'],
      verificationChecklist: ['npm run type-check']
    });

    expect(plan.savedMarkdown).toBe(true);
    expect(plan.suggestedNextMode).toBe('implement');
    expect(plan.planPath).toMatch(/plans\/\d{4}-\d{2}-\d{2}\/add-a-file-explorer-[a-f0-9]+\.md$/);
    expect(fs.existsSync(path.join(root, plan.planPath))).toBe(true);

    const loaded = await service.getPlan(plan.planId);
    expect(loaded?.content).toContain('# Add a file explorer');
    expect(loaded?.content).toContain('Implementation entry point');
  });
});
