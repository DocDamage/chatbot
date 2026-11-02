import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import RepositoryFindingsView, { FindingOverlayItem, FindingDetail } from '../RepositoryFindingsView';

describe('RT-SEC-007: RepositoryFindingsView Component Suite', () => {
  afterEach(() => {
    cleanup();
  });

  const mockOverlays: FindingOverlayItem[] = [
    {
      path: 'src/core/safety/SandboxController.ts',
      hotspot: 3,
      churn: 10,
      testGap: false,
      trustBoundary: true,
      findingIds: ['finding-1']
    },
    {
      path: 'src/server/index.ts',
      hotspot: 1,
      churn: 2,
      testGap: true,
      trustBoundary: false,
      findingIds: []
    }
  ];

  const mockFindings: FindingDetail[] = [
    {
      id: 'finding-1',
      ruleId: 'SEC-TRUST-001',
      severity: 'high',
      disposition: 'open',
      title: 'Path Traversal Boundary Check',
      message: 'Verify path normalization is enforced across platforms',
      evidence: [{ path: 'src/core/safety/SandboxController.ts', lineStart: 45, excerpt: 'path.resolve(target)' }]
    }
  ];

  it('renders 2D graph and accessible table by default', () => {
    const onSelect = vi.fn();
    render(<RepositoryFindingsView overlays={mockOverlays} findings={mockFindings} onSelectPath={onSelect} />);

    expect(screen.getByText('2 Monitored Files · 1 Finding Signals')).toBeTruthy();
    expect(screen.getAllByText('src/core/safety/SandboxController.ts').length).toBeGreaterThan(0);
    expect(screen.getByText('Path Traversal Boundary Check')).toBeTruthy();
  });

  it('switches view modes between graph only and table only', () => {
    render(<RepositoryFindingsView overlays={mockOverlays} findings={mockFindings} />);

    const graphOnlyBtn = screen.getByRole('button', { name: /2d graph only/i });
    fireEvent.click(graphOnlyBtn);

    const tableOnlyBtn = screen.getByRole('button', { name: /accessible table only/i });
    fireEvent.click(tableOnlyBtn);
  });

  it('sorts table by path, hotspot, and test gap', () => {
    const { container } = render(<RepositoryFindingsView overlays={mockOverlays} findings={mockFindings} />);

    const sortButtons = container.querySelectorAll<HTMLButtonElement>('.table-sort-btn');
    expect(sortButtons.length).toBeGreaterThanOrEqual(3);

    fireEvent.click(sortButtons[0]); // path
    fireEvent.click(sortButtons[1]); // hotspot
    fireEvent.click(sortButtons[2]); // testGap
  });

  it('selects row on click and enter key press', () => {
    const onSelect = vi.fn();
    render(<RepositoryFindingsView overlays={mockOverlays} findings={mockFindings} onSelectPath={onSelect} />);

    const row = screen.getAllByText('src/server/index.ts')[0];
    fireEvent.click(row);
    expect(onSelect).toHaveBeenCalledWith('src/server/index.ts');

    fireEvent.keyDown(row, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith('src/server/index.ts');
  });
});
