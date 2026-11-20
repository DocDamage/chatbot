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

  it('saves a character sheet with parsed inventory, conditions and spell slots', async () => {
    localStorage.setItem('chatbot-active-campaign', state.id);
    vi.mocked(campaignApi)
      .mockResolvedValueOnce([state])
      .mockResolvedValueOnce(state)
      .mockResolvedValueOnce({ campaign: state, outcome: 'Character saved.' });
    render(<CampaignPanel />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add character' }));
    const change = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
    change('Name', 'Mira');
    change('Level', '3');
    change('Damage formula', '1d8+2');
    change('Conditions (comma separated)', 'blessed, inspired');
    change('Inventory (one item | quantity per line)', 'Rope | 2\nTorch');
    fireEvent.click(screen.getByLabelText(/Pact Magic/));
    fireEvent.change(screen.getAllByLabelText('Maximum')[0], { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save sheet' }));
    await screen.findByText('Character saved.');
    expect(campaignApi).toHaveBeenCalledWith(`/${state.id}/actions`, {
      view: 'player', version: 0, action: { type: 'character', character: expect.objectContaining({
        name: 'Mira', level: 3, damage: '1d8+2', conditions: ['blessed', 'inspired'], pactMagic: true,
        inventory: [{ name: 'Rope', quantity: 2 }, { name: 'Torch', quantity: 1 }],
        spellSlots: { '1': { max: 2, used: 0 } }
      }) }
    });
    expect(screen.queryByRole('button', { name: 'Save sheet' })).toBeNull();
  });

  it('sends the selected roll and attack using the latest campaign version', async () => {
    const encounter = { ...state, version: 4, characters: [
      { id: 'hero', kind: 'player', name: 'Mira', conditions: [] },
      { id: 'wolf', kind: 'npc', name: 'Wolf', conditions: [] }
    ] };
    localStorage.setItem('chatbot-active-campaign', state.id);
    vi.mocked(campaignApi)
      .mockResolvedValueOnce([encounter])
      .mockResolvedValueOnce(encounter)
      .mockResolvedValueOnce({ campaign: { ...encounter, version: 5 }, outcome: 'Rolled 17.' })
      .mockResolvedValueOnce({ campaign: { ...encounter, version: 6 }, outcome: 'Attack resolved.' });
    render(<CampaignPanel />);
    fireEvent.change(await screen.findByLabelText('Dice expression'), { target: { value: '2d20kh1+3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Roll dice' }));
    await screen.findByText('Rolled 17.');
    expect(campaignApi).toHaveBeenCalledWith(`/${state.id}/actions`, {
      action: { type: 'roll', expression: '2d20kh1+3' }, view: 'player', version: 4
    });
    fireEvent.change(screen.getByLabelText('Attacker'), { target: { value: 'wolf' } });
    fireEvent.change(screen.getByLabelText('Target'), { target: { value: 'hero' } });
    fireEvent.click(screen.getByRole('button', { name: 'Attack' }));
    await screen.findByText('Attack resolved.');
    expect(campaignApi).toHaveBeenCalledWith(`/${state.id}/actions`, {
      action: { type: 'attack', actorId: 'wolf', targetId: 'hero' }, view: 'player', version: 5
    });
  });
});
