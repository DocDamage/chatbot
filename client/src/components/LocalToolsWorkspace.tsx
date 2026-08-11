import { isStaticPagesBuild } from '../api/runtime';
import LocalRunApprovalPanel from './LocalRunApprovalPanel';
import SpriteLabPanel from './SpriteLabPanel';
import ProjectIntelligencePanel from './ProjectIntelligencePanel';
import DocumentWorkspacePanel from './DocumentWorkspacePanel';
import UtilityWorkbenchPanel from './UtilityWorkbenchPanel';
import MockApiWorkspacePanel from './MockApiWorkspacePanel';
import WebsiteWorkspacePanel from './WebsiteWorkspacePanel';
import DesktopCompanionPanel from './DesktopCompanionPanel';
import './LocalToolsWorkspace.css';

export default function LocalToolsWorkspace() {
  if (isStaticPagesBuild) return null;

  return (
    <aside className="local-tools-workspace" aria-label="Local tools workspace">
      <h2 className="local-tools-heading">Local tools</h2>
      <ProjectIntelligencePanel />
      <DocumentWorkspacePanel />
      <UtilityWorkbenchPanel />
      <MockApiWorkspacePanel />
      <WebsiteWorkspacePanel />
      <DesktopCompanionPanel />
      <LocalRunApprovalPanel />
      <SpriteLabPanel />
    </aside>
  );
}
