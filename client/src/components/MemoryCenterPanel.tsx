import React, { useState } from 'react';
import './MemoryCenterPanel.css';

export interface ProjectMemoryItem {
  id: string;
  kind: 'decision' | 'gotcha' | 'convention' | 'flow' | 'milestone' | 'failure' | 'fix' | 'context' | 'preference' | 'changelog' | 'note';
  title: string;
  content: string;
  branch: string;
  confidence: number;
  approvalState: 'proposed' | 'approved' | 'rejected';
  freshnessState: 'current' | 'possibly_stale' | 'stale' | 'superseded' | 'quarantined' | 'deleted';
  isProtected?: boolean;
  tags: string[];
  updatedAt: string;
}

interface MemoryCenterPanelProps {
  memories: ProjectMemoryItem[];
  onApproveProposal?: (id: string) => void;
  onRejectProposal?: (id: string) => void;
  onSetProtected?: (id: string, isProtected: boolean) => void;
  onExportMarkdown?: () => void;
}

export const MemoryCenterPanel: React.FC<MemoryCenterPanelProps> = ({
  memories,
  onApproveProposal,
  onRejectProposal,
  onSetProtected,
  onExportMarkdown
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'decisions' | 'gotchas' | 'proposals' | 'stale'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredMemories = memories.filter(m => {
    if (activeTab === 'decisions' && m.kind !== 'decision') return false;
    if (activeTab === 'gotchas' && m.kind !== 'gotcha') return false;
    if (activeTab === 'proposals' && m.approvalState !== 'proposed') return false;
    if (activeTab === 'stale' && m.freshnessState !== 'stale' && m.freshnessState !== 'possibly_stale') return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        m.title.toLowerCase().includes(q) ||
        m.content.toLowerCase().includes(q) ||
        m.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="memory-center-panel" role="region" aria-label="Project Memory Center">
      <div className="memory-header">
        <div>
          <h2 style={{ margin: 0, fontSize: '16px', color: '#fff' }}>Project Memory Center</h2>
          <span style={{ fontSize: '12px', color: '#7f848e' }}>Provenance-Preserving Branch & Knowledge Memory</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {onExportMarkdown && (
            <button
              onClick={onExportMarkdown}
              style={{
                padding: '6px 12px',
                borderRadius: '4px',
                border: '1px solid #3e4451',
                background: '#21252b',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Export MEMORY.md
            </button>
          )}
        </div>
      </div>

      <div className="memory-tabs" role="tablist">
        <button
          className={`memory-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
          role="tab"
          aria-selected={activeTab === 'all'}
        >
          All Memories ({memories.length})
        </button>
        <button
          className={`memory-tab-btn ${activeTab === 'decisions' ? 'active' : ''}`}
          onClick={() => setActiveTab('decisions')}
          role="tab"
          aria-selected={activeTab === 'decisions'}
        >
          Decisions ({memories.filter(m => m.kind === 'decision').length})
        </button>
        <button
          className={`memory-tab-btn ${activeTab === 'gotchas' ? 'active' : ''}`}
          onClick={() => setActiveTab('gotchas')}
          role="tab"
          aria-selected={activeTab === 'gotchas'}
        >
          Gotchas ({memories.filter(m => m.kind === 'gotcha').length})
        </button>
        <button
          className={`memory-tab-btn ${activeTab === 'proposals' ? 'active' : ''}`}
          onClick={() => setActiveTab('proposals')}
          role="tab"
          aria-selected={activeTab === 'proposals'}
        >
          Proposals ({memories.filter(m => m.approvalState === 'proposed').length})
        </button>
        <button
          className={`memory-tab-btn ${activeTab === 'stale' ? 'active' : ''}`}
          onClick={() => setActiveTab('stale')}
          role="tab"
          aria-selected={activeTab === 'stale'}
        >
          Stale / Conflicted ({memories.filter(m => m.freshnessState === 'stale' || m.freshnessState === 'possibly_stale').length})
        </button>
      </div>

      <div style={{ padding: '8px 16px', background: '#1c1f24' }}>
        <input
          type="text"
          placeholder="Search project memory (title, content, tags)..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ width: '100%', padding: '6px 10px', borderRadius: '4px', border: '1px solid #333', background: '#181a1f', color: '#fff', fontSize: '13px' }}
          aria-label="Search memories"
        />
      </div>

      <div className="memory-content" role="tabpanel">
        {filteredMemories.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#5c6370' }}>
            No memory records match the selected filter.
          </div>
        ) : (
          filteredMemories.map(mem => (
            <div key={mem.id} className="memory-card">
              <div className="memory-card-header">
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span className={`memory-kind-badge ${mem.kind}`}>{mem.kind}</span>
                  <span className="memory-state-badge">Branch: <code>{mem.branch}</code></span>
                  <span className="memory-state-badge">Freshness: <code>{mem.freshnessState}</code></span>
                  {mem.isProtected && <span style={{ fontSize: '11px', color: '#e5c07b' }}>[Protected]</span>}
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {mem.approvalState === 'proposed' && onApproveProposal && onRejectProposal && (
                    <>
                      <button
                        onClick={() => onApproveProposal(mem.id)}
                        style={{ padding: '2px 8px', fontSize: '11px', background: '#1e3d29', color: '#98c379', border: '1px solid #2d5a3d', borderRadius: '3px', cursor: 'pointer' }}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => onRejectProposal(mem.id)}
                        style={{ padding: '2px 8px', fontSize: '11px', background: '#3d1e1e', color: '#e06c75', border: '1px solid #5a2d2d', borderRadius: '3px', cursor: 'pointer' }}
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {onSetProtected && (
                    <button
                      onClick={() => onSetProtected(mem.id, !mem.isProtected)}
                      style={{ padding: '2px 8px', fontSize: '11px', background: '#282c34', color: '#abb2bf', border: '1px solid #3e4451', borderRadius: '3px', cursor: 'pointer' }}
                    >
                      {mem.isProtected ? 'Unprotect' : 'Protect'}
                    </button>
                  )}
                </div>
              </div>

              <h3 className="memory-card-title">{mem.title}</h3>
              <div className="memory-card-body">{mem.content}</div>

              {mem.tags.length > 0 && (
                <div className="memory-tags">
                  {mem.tags.map(t => (
                    <span key={t} className="memory-tag">#{t}</span>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
