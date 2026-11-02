import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import GamingPlaybookPanel from '../GamingPlaybookPanel';
import * as gamingApi from '../../api/gaming';

describe('RT-GAME-002: GamingPlaybookPanel Workflow Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('validates required goal before submitting', async () => {
    render(<GamingPlaybookPanel />);

    const button = screen.getByRole('button', { name: /create playbook/i });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it('creates gaming playbook and renders recommendations, checklist, and risks', async () => {
    vi.spyOn(gamingApi, 'createGamingPlaybook').mockResolvedValueOnce({
      id: 'playbook-1',
      title: 'Godot 2D Platformer Design Playbook',
      summary: 'Architecture and balance recommendations for platformer.',
      recommendations: ['Use CharacterBody2D', 'Implement state machine for movement'],
      checklist: ['Setup input map', 'Configure collision layers'],
      risks: ['Physics tick jitter on high refresh monitors'],
      followUpQuestions: ['What is the target framerate?']
    } as any);

    render(<GamingPlaybookPanel />);

    const goalInput = screen.getByPlaceholderText(/goal, problem, or game idea/i);
    fireEvent.change(goalInput, { target: { value: 'Build a smooth platformer' } });

    const engineInput = screen.getByPlaceholderText(/engine\/tool optional/i);
    fireEvent.change(engineInput, { target: { value: 'Godot 4' } });

    const submitBtn = screen.getByRole('button', { name: /create playbook/i });
    expect((submitBtn as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Godot 2D Platformer Design Playbook')).toBeTruthy();
      expect(screen.getByText('Use CharacterBody2D')).toBeTruthy();
      expect(screen.getByText('Setup input map')).toBeTruthy();
      expect(screen.getByText('Physics tick jitter on high refresh monitors')).toBeTruthy();
    });
  });

  it('handles submission error gracefully', async () => {
    vi.spyOn(gamingApi, 'createGamingPlaybook').mockRejectedValueOnce(new Error('Network failure'));

    render(<GamingPlaybookPanel />);

    const goalInput = screen.getByPlaceholderText(/goal, problem, or game idea/i);
    fireEvent.change(goalInput, { target: { value: 'Test goal' } });

    fireEvent.click(screen.getByRole('button', { name: /create playbook/i }));

    await waitFor(() => {
      expect(screen.getByText('Network failure')).toBeTruthy();
    });
  });
});
