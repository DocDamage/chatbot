import { apiFetch } from './http';
import { throwApiError } from './errors';

export interface CampaignCharacter {
  id: string; name: string; kind: 'player' | 'npc'; level?: number; ac?: number; hp?: number; maxHp?: number;
  tempHp?: number; attackBonus?: number; damage?: string; initiativeMod?: number; hitDie?: number;
  constitutionMod?: number; hitDiceUsed?: number; pactMagic?: boolean; hidden?: boolean;
  spellSlots?: Record<string, { max: number; used: number }>; inventory?: Array<{ name: string; quantity: number }>;
  conditions: string[];
}
export interface CampaignRecord { id: string; name: string; kind: string; description: string; status: string; hidden?: boolean; dmSecret?: string }
export interface CampaignState {
  id: string; name: string; edition: '5e-2014' | '5e-2024'; premise: string; scene: string; recap: string; dmNotes?: string;
  version: number; characters: CampaignCharacter[]; entities: CampaignRecord[]; history: Array<{ role: string; content: string }>;
  combat: { order: string[]; turn: number; round: number } | null; log: string[]; imports: Array<{ source: string; notice: string }>;
}
export async function campaignApi<T>(path = '', body?: unknown): Promise<T> {
  const response = await apiFetch(`/api/campaigns${path}`, body === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!response.ok) return throwApiError(response, 'Campaign request failed.');
  return response.json();
}
export async function importCampaign(file: File, format: string, edition: string): Promise<CampaignState> {
  const body = new FormData(); body.set('file', file); body.set('format', format); body.set('edition', edition);
  const response = await apiFetch('/api/campaigns/import', { method: 'POST', body });
  if (!response.ok) return throwApiError(response, 'Campaign import failed.');
  return response.json();
}
