import { useState } from 'react';
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
  const [activeGroup, setActiveGroup] = useState('overview');

  if (isStaticPagesBuild) return null;

  return (
    <aside className="local-tools-workspace" aria-label="Advanced workspace">
      <div className="advanced-workspace-header">
        <div>
          <span className="advanced-workspace-eyebrow">Advanced workspace</span>
          <h2>Tools for deeper work</h2>
          <p>Keep the conversation focused, then open the area you need for projects, documents, integrations, or automation.</p>
        </div>
        <span className="advanced-workspace-status" title="These tools run locally and appear only while the advanced workspace is open">Local tools</span>
      </div>
      <nav className="advanced-workspace-nav" aria-label="Advanced workspace areas">
        <button type="button" className={activeGroup === 'overview' ? 'active' : ''} aria-pressed={activeGroup === 'overview'} onClick={() => setActiveGroup('overview')} title="Project context, memory, and documents">Workspace</button>
        <button type="button" className={activeGroup === 'build' ? 'active' : ''} aria-pressed={activeGroup === 'build'} onClick={() => setActiveGroup('build')} title="Utilities, mock APIs, and website tools">Build &amp; connect</button>
        <button type="button" className={activeGroup === 'automation' ? 'active' : ''} aria-pressed={activeGroup === 'automation'} onClick={() => setActiveGroup('automation')} title="Local runs, approvals, and sprite generation">Automation</button>
      </nav>
      <div className="advanced-workspace-content">
        {activeGroup === 'overview' && <>
          <ProjectIntelligencePanel />
          <DocumentWorkspacePanel />
        </>}
        {activeGroup === 'build' && <>
          <UtilityWorkbenchPanel />
          <MockApiWorkspacePanel />
          <WebsiteWorkspacePanel />
          <DesktopCompanionPanel />
        </>}
        {activeGroup === 'automation' && <>
          <LocalRunApprovalPanel />
          <SpriteLabPanel />
        </>}
      </div>
    </aside>
  );
}
