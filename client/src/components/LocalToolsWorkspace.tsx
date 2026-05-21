import { isStaticPagesBuild } from '../api/runtime';
import LocalRunApprovalPanel from './LocalRunApprovalPanel';
import SpriteLabPanel from './SpriteLabPanel';

export default function LocalToolsWorkspace() {
  if (isStaticPagesBuild) return null;

  return (
    <aside className="local-tools-workspace" aria-label="Local tools workspace">
      <LocalRunApprovalPanel />
      <SpriteLabPanel />
    </aside>
  );
}
