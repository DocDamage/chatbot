import { throwApiError } from './errors';

export type GamingPlaybookKind = 'engine_selection' | 'asset_pipeline' | 'design_review' | 'modding_safety' | 'prompt_pack';

export interface GamingPlaybookResult {
  kind: GamingPlaybookKind;
  title: string;
  assumptions: string[];
  recommendations: string[];
  checklist: string[];
  risks: string[];
  followUpQuestions: string[];
}

export async function createGamingPlaybook(input: {
  kind: GamingPlaybookKind;
  goal: string;
  engine?: string;
  genre?: string;
  targetPlatform?: string;
}): Promise<GamingPlaybookResult> {
  const response = await fetch('/api/gaming/playbook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });
  if (!response.ok) await throwApiError(response, 'Unable to create gaming playbook');
  return response.json();
}
