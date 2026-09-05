import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModelSelectorDropdown } from '../ModelSelectorDropdown';
import { KnowledgeManagerPanel, KnowledgePackItem } from '../KnowledgeManagerPanel';

afterEach(() => {
  cleanup();
});

describe('Section 31 Client UX Specifications', () => {
  describe('31.5: Model UI (ModelSelectorDropdown)', () => {
    it('renders the 7 canonical model profile choices', () => {
      render(
        <ModelSelectorDropdown
          currentChoice="Balanced"
          configuredModelName="claude-3-5-sonnet"
          configuredProviderName="Anthropic"
        />
      );

      const select = screen.getByTestId('model-profile-select') as HTMLSelectElement;
      expect(select.value).toBe('Balanced');

      const options = Array.from(select.querySelectorAll('option')).map(o => o.value);
      expect(options).toEqual(['Auto', 'Fast', 'Balanced', 'Reasoning', 'Coding', 'Creative', 'Local']);

      expect(screen.getByTestId('model-selector-details').textContent).toContain('Anthropic / claude-3-5-sonnet');
    });

    it('emits onChoiceChange event when a new policy is selected', () => {
      const onChange = vi.fn();
      render(<ModelSelectorDropdown currentChoice="Auto" onChoiceChange={onChange} />);

      const select = screen.getByTestId('model-profile-select');
      fireEvent.change(select, { target: { value: 'Coding' } });

      expect(onChange).toHaveBeenCalledWith('Coding');
    });
  });

  describe('31.3 & 31.4: Knowledge Manager UI (KnowledgeManagerPanel)', () => {
    const mockPacks: KnowledgePackItem[] = [
      {
        id: 'official-docs',
        title: 'Official Developer Documentation',
        status: 'Current',
        sourceFamiliesCount: 18,
        indexedStorageGB: 3.2,
        downloadSizeGB: 1.1,
        license: 'Permissive',
        updatePolicy: 'Weekly',
        lastUpdated: '2026-09-04',
        version: '2026.09'
      },
      {
        id: 'academic-research',
        title: 'Academic Research & Math Pack',
        status: 'Available',
        sourceFamiliesCount: 4,
        indexedStorageGB: null,
        downloadSizeGB: 2.5,
        license: 'Open Access',
        updatePolicy: 'Monthly',
        version: '1.2.0'
      }
    ];

    it('renders the 6 canonical tabs and defaults to Installed view', () => {
      render(<KnowledgeManagerPanel initialPacks={mockPacks} />);

      expect(screen.getByTestId('km-tab-installed')).toBeTruthy();
      expect(screen.getByTestId('km-tab-available')).toBeTruthy();
      expect(screen.getByTestId('km-tab-updates')).toBeTruthy();
      expect(screen.getByTestId('km-tab-storage')).toBeTruthy();
      expect(screen.getByTestId('km-tab-custom-packs')).toBeTruthy();
      expect(screen.getByTestId('km-tab-advanced')).toBeTruthy();

      // Installed pack is visible
      expect(screen.getByTestId('km-pack-card-official-docs')).toBeTruthy();
      expect(screen.getByText(/3\.2 GB indexed/i)).toBeTruthy();
      expect(screen.getByText(/Source Families: 18/i)).toBeTruthy();
    });

    it('switches to Available tab and allows opening the pre-install modal', () => {
      const onInstall = vi.fn();
      render(<KnowledgeManagerPanel initialPacks={mockPacks} onInstall={onInstall} />);

      // Switch to Available
      fireEvent.click(screen.getByTestId('km-tab-available'));

      expect(screen.getByTestId('km-pack-card-academic-research')).toBeTruthy();
      const installBtn = screen.getByTestId('km-install-btn-academic-research');
      fireEvent.click(installBtn);

      // Modal appears
      const modal = screen.getByTestId('km-install-modal');
      expect(modal).toBeTruthy();
      expect(screen.getByText('2.5 GB')).toBeTruthy();
      expect(screen.getByText('Open Access')).toBeTruthy();

      // Confirm install
      const confirmBtn = screen.getByTestId('km-confirm-install-btn');
      fireEvent.click(confirmBtn);

      expect(onInstall).toHaveBeenCalledWith('academic-research');
      expect(screen.queryByTestId('km-install-modal')).toBeNull();
    });

    it('navigates to Storage view and displays storage aggregations', () => {
      render(<KnowledgeManagerPanel initialPacks={mockPacks} />);

      fireEvent.click(screen.getByTestId('km-tab-storage'));
      expect(screen.getByTestId('km-storage-view')).toBeTruthy();
      expect(screen.getByText(/Total indexed storage across all packs: 3.2 GB/i)).toBeTruthy();
    });
  });
});
