import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SourcesDrawer } from './SourcesDrawer';
import type { SourcesDrawerData } from '../../../src/types/citation';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('SourcesDrawer Component', () => {
  const mockData: SourcesDrawerData = {
    totalSources: 2,
    compactLabel: 'Sources (2)',
    cards: [
      {
        id: 'sc-1',
        title: 'Godot 4.7 documentation',
        category: 'official_docs',
        categoryLabel: 'Official documentation',
        version: '4.7',
        badges: ['Official documentation', 'v4.7', '0.95 authority'],
        snippet: 'Node is the base element for all tree nodes in Godot.',
        action: {
          type: 'open_url',
          target: 'https://docs.godotengine.org/en/4.7/',
          label: 'Open source',
        },
      },
      {
        id: 'sc-2',
        title: 'player_controller.gd',
        category: 'repo_evidence',
        categoryLabel: 'Repository evidence',
        badges: ['Repository evidence'],
        action: {
          type: 'open_file',
          target: 'src/player_controller.gd',
          label: 'Open file',
        },
      },
    ],
    unresolvedCitations: ['cit-missing-01'],
  };

  it('renders compact toggle button with label', () => {
    render(<SourcesDrawer data={mockData} />);
    expect(screen.getByText('Sources (2)')).toBeDefined();
  });

  it('expands to show source cards and warning when clicked', () => {
    render(<SourcesDrawer data={mockData} />);
    const toggle = screen.getByRole('button', { name: /Sources \(2\)/i });
    fireEvent.click(toggle);

    expect(screen.getByText('Godot 4.7 documentation')).toBeDefined();
    expect(screen.getByText('player_controller.gd')).toBeDefined();
    expect(screen.getByText(/1 source reference\(s\) could not be verified/i)).toBeDefined();
  });

  it('triggers onOpenSource action callback', () => {
    const onOpenSource = vi.fn();
    render(<SourcesDrawer data={mockData} onOpenSource={onOpenSource} />);
    fireEvent.click(screen.getByRole('button', { name: /Sources \(2\)/i }));

    const openSourceBtn = screen.getByRole('button', { name: 'Open source' });
    fireEvent.click(openSourceBtn);
    expect(onOpenSource).toHaveBeenCalledWith(mockData.cards[0]);
  });
});
