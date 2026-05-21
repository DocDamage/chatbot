import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CreativeComposerPanel, { applyCreativePreset, buildCreativeRequestPayload, defaultCreativeComposerState } from './CreativeComposerPanel';

afterEach(() => {
  cleanup();
});

describe('CreativeComposerPanel', () => {
  it('renders creative controls and emits state changes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <CreativeComposerPanel
        mode="creative_writing"
        value={defaultCreativeComposerState}
        onChange={onChange}
      />
    );

    await user.selectOptions(screen.getByLabelText(/genre/i), 'dark_horror');
    await user.selectOptions(screen.getByLabelText(/rating/i), 'Mature');
    await user.selectOptions(screen.getByLabelText(/point of view/i), 'first');
    await user.click(screen.getByLabelText(/mature mode/i));
    await user.click(screen.getByLabelText(/quality pass/i));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ genre: 'dark_horror' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ rating: 'Mature' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ pov: 'first' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ matureMode: true }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ qualityPass: true }));
  });

  it('exposes roleplay action buttons as slash commands', async () => {
    const user = userEvent.setup();
    const onActionCommand = vi.fn();

    render(
      <CreativeComposerPanel
        mode="roleplay"
        value={defaultCreativeComposerState}
        onChange={vi.fn()}
        onActionCommand={onActionCommand}
      />
    );

    await user.click(screen.getByRole('button', { name: /summarize/i }));
    await user.click(screen.getByRole('button', { name: /branch/i }));
    await user.click(screen.getByRole('button', { name: /fade/i }));

    expect(onActionCommand).toHaveBeenCalledWith('/summary');
    expect(onActionCommand).toHaveBeenCalledWith('/branch');
    expect(onActionCommand).toHaveBeenCalledWith('/fade');
  });

  it('builds structured creative request payloads from composer state', () => {
    const payload = buildCreativeRequestPayload('Open on the ruined station.', 'roleplay', {
      ...defaultCreativeComposerState,
      genre: 'space_opera',
      format: 'roleplay',
      rating: 'Mature',
      matureMode: true,
      pov: 'second',
      tense: 'present',
      tone: 'tense',
      length: 'short',
      proseDensity: 6,
      dialogueDensity: 8,
      hardLimits: 'graphic torture, real-person sexual content',
      allowedMatureThemes: 'consensual adult romance',
      storyBibleNotes: 'The archive bell rings at midnight.',
      projectTitle: 'Archive Hearts',
      workflowStage: 'draft_chapter',
      branchId: 'branch-1',
      privacyLocalOnly: true,
      analyticsEnabled: false,
      promptPackId: 'romance-boundaries',
      promptPackInstructions: 'Keep consent explicit',
      qualityPass: true,
    });

    expect(payload).toEqual(expect.objectContaining({
      operation: 'roleplay_turn',
      genre: 'space_opera',
      format: 'roleplay',
      rating: 'Mature',
      matureMode: true,
      qualityPass: true,
    }));
    expect(payload.config).toEqual(expect.objectContaining({
      pov: 'second',
      tense: 'present',
      length: 'short',
      proseDensity: 6,
      dialogueDensity: 8,
    }));
    expect(payload.boundaries).toEqual(expect.objectContaining({
      hardLimits: ['graphic torture', 'real-person sexual content'],
      fadeToBlack: true,
      allowedMatureThemes: ['consensual adult romance'],
    }));
    expect(payload.storyBible).toEqual(expect.objectContaining({
      continuityNotes: ['The archive bell rings at midnight.'],
    }));
    expect(payload.project).toEqual(expect.objectContaining({
      title: 'Archive Hearts',
      workflowStage: 'draft_chapter',
    }));
    expect(payload.branch).toEqual(expect.objectContaining({ branchId: 'branch-1' }));
    expect(payload.privacy).toEqual(expect.objectContaining({
      localOnly: true,
      analyticsEnabled: false,
    }));
    expect(payload.promptPack).toEqual(expect.objectContaining({
      packId: 'romance-boundaries',
      instructions: ['Keep consent explicit'],
    }));
  });

  it('applies genre and format preset defaults to payload instructions', () => {
    const state = applyCreativePreset({
      ...defaultCreativeComposerState,
      genre: 'space_opera',
      format: 'chapter_draft',
    });
    const payload = buildCreativeRequestPayload('Draft the next chapter.', 'creative_writing', state);

    expect(state.rating).toBe('Teen');
    expect(state.tone).toContain('cinematic');
    expect(state.length).toBe('long');
    expect(payload.presetId).toBe('space_opera:chapter_draft');
    expect(payload.presetInstructions).toEqual(expect.arrayContaining([
      expect.stringContaining('large-scale speculative stakes'),
      expect.stringContaining('chapter hook'),
    ]));
  });
});
