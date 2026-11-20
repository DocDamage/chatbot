import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import CampaignPanel from './CampaignPanel';
import { campaignApi, importCampaign } from '../api/campaigns';

vi.mock('../api/campaigns', () => ({ campaignApi: vi.fn(), importCampaign: vi.fn() }));
vi.mock('../api/http', () => ({ initializeLocalSession: vi.fn().mockResolvedValue(undefined) }));
const state = { id: 'campaign-a', name: 'Harbour lights', edition: '5e-2024', premise: 'A harbour.', scene: '', recap: '', version: 0, characters: [], entities: [], history: [], log: [], combat: null, imports: [] };
beforeEach(() => { cleanup(); localStorage.clear(); vi.resetAllMocks(); vi.mocked(campaignApi).mockResolvedValue([]); });

describe('campaign workspace', () => {
  it('creates a campaign with an explicit edition', async () => {
    vi.mocked(campaignApi).mockImplementation(async (_path = '', body?: unknown) => body ? state : [] as any);
    render(<CampaignPanel />);
    fireEvent.change(screen.getByLabelText('Campaign name'), { target: { value: 'Harbour lights' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create campaign' }));
    await screen.findByText('Harbour lights', { selector: 'strong' });
    expect(campaignApi).toHaveBeenCalledWith('', expect.objectContaining({ name: 'Harbour lights', edition: '5e-2024' }));
  });
  it('resumes saved dialogue and only opens private notes after an explicit DM action', async () => {
    localStorage.setItem('chatbot-active-campaign', state.id);
    const publicState = { ...state, history: [{ role: 'assistant', content: 'Your ship returns to the harbour.' }] };
    vi.mocked(campaignApi).mockImplementation(async (path = '') => path === '' ? [state] : path.includes('view=dm') ? { ...publicState, dmNotes: 'SECRET_PATRON' } : publicState as any);
    render(<CampaignPanel />); await screen.findByText('Your ship returns to the harbour.');
    expect(screen.queryByDisplayValue('SECRET_PATRON')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'DM notes & records' })); await screen.findByDisplayValue('SECRET_PATRON');
    fireEvent.click(screen.getByRole('button', { name: 'Return to player view' }));
    await waitFor(() => expect(screen.queryByDisplayValue('SECRET_PATRON')).toBeNull());
  });
  it('retains the player message and exposes a retryable error on a failed model turn', async () => {
    localStorage.setItem('chatbot-active-campaign', state.id);
    vi.mocked(campaignApi).mockImplementation(async (path = '') => { if (path.endsWith('/turn')) throw new Error('Ollama is offline'); return path === '' ? [state] : state as any; });
    render(<CampaignPanel />); await screen.findByText('Harbour lights', { selector: 'strong' });
    fireEvent.change(screen.getByLabelText('Your next move'), { target: { value: 'I open the door.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue adventure' })); await screen.findByRole('alert');
    expect(screen.getByDisplayValue('I open the door.')).toBeTruthy(); expect(screen.getByRole('alert').textContent).toContain('Ollama is offline');
  });
  it('accepts a DMT world archive through the dedicated import path', async () => {
    vi.mocked(importCampaign).mockResolvedValue({ ...state, imports: [{ source: 'dmt', notice: 'Records imported hidden.' }] } as any);
    render(<CampaignPanel />); const file = new File(['archive'], 'coast.dmtz');
    fireEvent.change(screen.getByLabelText('Choose world export'), { target: { files: [file] } });
    await screen.findByText('Records imported hidden.'); expect(importCampaign).toHaveBeenCalledWith(file, 'dmt', '5e-2024');
  });
});
