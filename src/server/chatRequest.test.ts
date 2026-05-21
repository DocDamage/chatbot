import fs from 'fs';
import os from 'os';
import path from 'path';
import { PlanDocumentService } from '../core/planning/PlanDocumentService';
import { buildChatContextBundle, renderChatContext } from '../types/chat';
import { enrichChatRequestWithPlan } from './chatRequest';

describe('chat request enrichment', () => {
  let workspaceRoot: string;

  beforeEach(() => {
    workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-request-'));
  });

  afterEach(() => {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  });

  it('loads saved plan content into implement requests by activePlanId', async () => {
    const plan = await new PlanDocumentService(workspaceRoot).createPlan({
      userRequest: 'Add conversation persistence',
      mode: 'plan',
      phases: ['Persist chat turns through the conversation manager.'],
    });

    const enriched = await enrichChatRequestWithPlan({
      message: 'Implement this plan',
      sessionId: 'session-1',
      mode: 'implement',
      activePlanId: plan.planId,
    }, workspaceRoot);

    expect(enriched.activePlanContent).toContain('Persist chat turns through the conversation manager.');

    const renderedContext = renderChatContext(buildChatContextBundle(enriched));
    expect(renderedContext).toContain(`Active implementation plan (${plan.planId}):`);
    expect(renderedContext).toContain('Persist chat turns through the conversation manager.');
  });
});
