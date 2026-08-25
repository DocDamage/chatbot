import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import LocalToolsWorkspace from './LocalToolsWorkspace';

vi.mock('../api/runtime', () => ({ isStaticPagesBuild: false }));
vi.mock('./ProjectIntelligencePanel', () => ({ default: () => <div>Project intelligence panel</div> }));
vi.mock('./DocumentWorkspacePanel', () => ({ default: () => <div>Document workspace panel</div> }));
vi.mock('./UtilityWorkbenchPanel', () => ({ default: () => <div>Utility workbench panel</div> }));
vi.mock('./MockApiWorkspacePanel', () => ({ default: () => <div>Mock API panel</div> }));
vi.mock('./WebsiteWorkspacePanel', () => ({ default: () => <div>Website workspace panel</div> }));
vi.mock('./DesktopCompanionPanel', () => ({ default: () => <div>Desktop companion panel</div> }));
vi.mock('./LocalRunApprovalPanel', () => ({ default: () => <div>Local run panel</div> }));
vi.mock('./SpriteLabPanel', () => ({ default: () => <div>Sprite lab panel</div> }));
vi.mock('./CapabilityHubPanel', () => ({ default: () => <div>Capability hub panel</div> }));

afterEach(() => cleanup());

describe('LocalToolsWorkspace', () => {
  it('groups local tools into task-oriented workspace areas', async () => {
    const user = userEvent.setup();
    render(<LocalToolsWorkspace />);

    expect(screen.getByRole('heading', { name: 'Tools for deeper work' })).toBeTruthy();
    expect(screen.getByText('Project intelligence panel')).toBeTruthy();
    expect(screen.queryByText('Utility workbench panel')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Build & connect' }));
    expect(screen.getByText('Utility workbench panel')).toBeTruthy();
    expect(screen.getByText('Website workspace panel')).toBeTruthy();
    expect(screen.queryByText('Project intelligence panel')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Capability Hub' }));
    expect(screen.getByText('Capability hub panel')).toBeTruthy();
    expect(screen.queryByText('Utility workbench panel')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Automation' }));
    expect(screen.getByText('Local run panel')).toBeTruthy();
    expect(screen.getByText('Sprite lab panel')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Workspace' }));
    expect(screen.getByText('Document workspace panel')).toBeTruthy();
  });
});
