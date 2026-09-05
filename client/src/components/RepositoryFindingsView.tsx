import { useState } from 'react';

export interface FindingOverlayItem {
  path: string;
  hotspot: number;
  ownership?: string;
  churn?: number;
  testGap: boolean;
  trustBoundary: boolean;
  findingIds: string[];
}

export interface FindingDetail {
  id: string;
  ruleId: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  disposition: string;
  title: string;
  message: string;
  evidence: Array<{ path: string; lineStart: number; excerpt: string }>;
}

interface RepositoryFindingsViewProps {
  overlays: FindingOverlayItem[];
  findings?: FindingDetail[];
  onSelectPath?: (path: string) => void;
}

export default function RepositoryFindingsView({ overlays, findings = [], onSelectPath }: RepositoryFindingsViewProps) {
  const [selectedPath, setSelectedPath] = useState<string | null>(overlays[0]?.path || null);
  const [viewMode, setViewMode] = useState<'both' | 'table_only' | 'graph_only'>('both');
  const [sortBy, setSortBy] = useState<'hotspot' | 'path' | 'testGap'>('hotspot');
  const [sortAsc, setSortAsc] = useState(false);

  const sortedOverlays = [...overlays].sort((a, b) => {
    if (sortBy === 'hotspot') {
      return sortAsc ? a.hotspot - b.hotspot : b.hotspot - a.hotspot;
    }
    if (sortBy === 'testGap') {
      return sortAsc ? (a.testGap === b.testGap ? 0 : a.testGap ? -1 : 1) : (a.testGap === b.testGap ? 0 : a.testGap ? 1 : -1);
    }
    return sortAsc ? a.path.localeCompare(b.path) : b.path.localeCompare(a.path);
  });

  const selectedOverlay = overlays.find(o => o.path === selectedPath);
  const pathFindings = findings.filter(f => selectedOverlay?.findingIds.includes(f.id) || f.evidence.some(e => e.path === selectedPath));

  const handleRowClick = (path: string) => {
    setSelectedPath(path);
    if (onSelectPath) onSelectPath(path);
  };

  return (
    <div className="repository-findings-view" aria-label="Repository Findings and 2D Graph Overlay">
      <div className="findings-view-toolbar">
        <div className="findings-view-mode-toggle" role="group" aria-label="Visualization view mode">
          <button
            type="button"
            className={viewMode === 'both' ? 'active' : ''}
            aria-pressed={viewMode === 'both'}
            onClick={() => setViewMode('both')}
          >
            2D Graph &amp; Table
          </button>
          <button
            type="button"
            className={viewMode === 'graph_only' ? 'active' : ''}
            aria-pressed={viewMode === 'graph_only'}
            onClick={() => setViewMode('graph_only')}
          >
            2D Graph Only
          </button>
          <button
            type="button"
            className={viewMode === 'table_only' ? 'active' : ''}
            aria-pressed={viewMode === 'table_only'}
            onClick={() => setViewMode('table_only')}
          >
            Accessible Table Only
          </button>
        </div>

        <span className="findings-count-badge">
          {overlays.length} Monitored Files · {findings.length} Finding Signals
        </span>
      </div>

      <div className={`findings-visual-layout mode-${viewMode}`}>
        {/* 2D SVG Graph View */}
        {(viewMode === 'both' || viewMode === 'graph_only') && (
          <div className="findings-graph-container" role="region" aria-label="2D Interactive Hotspot Graph">
            <svg
              className="findings-2d-svg"
              viewBox="0 0 500 240"
              role="img"
              aria-label="Interactive 2D node map of repository files colored by hotspot severity"
            >
              <defs>
                <linearGradient id="hotspotGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ff4d4d" />
                  <stop offset="100%" stopColor="#ff8533" />
                </linearGradient>
                <linearGradient id="safeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00d4ff" />
                  <stop offset="100%" stopColor="#0066cc" />
                </linearGradient>
              </defs>

              {/* Background grid */}
              <rect x="0" y="0" width="500" height="240" fill="rgba(10, 15, 25, 0.6)" rx="8" />

              {/* Connection links */}
              {sortedOverlays.slice(0, 10).map((overlay, index) => {
                const x = 50 + (index % 5) * 95;
                const y = index < 5 ? 60 : 160;
                return (
                  <line
                    key={`line-${overlay.path}`}
                    x1="250"
                    y1="110"
                    x2={x}
                    y2={y}
                    stroke="rgba(255, 255, 255, 0.15)"
                    strokeDasharray={overlay.trustBoundary ? '4,4' : 'none'}
                    strokeWidth="1.5"
                  />
                );
              })}

              {/* Central hub node */}
              <circle cx="250" cy="110" r="16" fill="#6366f1" stroke="#a5b4fc" strokeWidth="2" />
              <text x="250" y="114" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="bold">Root</text>

              {/* File Nodes */}
              {sortedOverlays.slice(0, 10).map((overlay, index) => {
                const x = 50 + (index % 5) * 95;
                const y = index < 5 ? 60 : 160;
                const isSelected = overlay.path === selectedPath;
                const radius = Math.min(22, Math.max(12, 10 + overlay.hotspot * 2));
                const fillColor = overlay.hotspot > 0 ? 'url(#hotspotGrad)' : 'url(#safeGrad)';
                const shortName = overlay.path.split('/').pop() || overlay.path;

                return (
                  <g
                    key={`node-${overlay.path}`}
                    className={`graph-node ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleRowClick(overlay.path)}
                    style={{ cursor: 'pointer' }}
                    tabIndex={0}
                    role="button"
                    aria-label={`File ${overlay.path}, Hotspot score ${overlay.hotspot}, ${overlay.testGap ? 'Has test gap' : 'Tested'}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleRowClick(overlay.path);
                      }
                    }}
                  >
                    <circle
                      cx={x}
                      cy={y}
                      r={radius}
                      fill={fillColor}
                      stroke={isSelected ? '#fff' : overlay.trustBoundary ? '#fbbf24' : 'rgba(255,255,255,0.4)'}
                      strokeWidth={isSelected ? 3 : 1.5}
                    />
                    <text
                      x={x}
                      y={y + radius + 12}
                      textAnchor="middle"
                      fill="#e2e8f0"
                      fontSize="9"
                      className="node-label"
                    >
                      {shortName.length > 12 ? `${shortName.slice(0, 10)}…` : shortName}
                    </text>
                    {overlay.trustBoundary && (
                      <text x={x} y={y - radius - 3} textAnchor="middle" fill="#fbbf24" fontSize="8" fontWeight="bold">
                        🛡️
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
            <div className="graph-legend" aria-label="Graph legend">
              <span><span className="legend-dot red" aria-hidden="true"></span> High Hotspot / Finding</span>
              <span><span className="legend-dot blue" aria-hidden="true"></span> Clean / Normal</span>
              <span><span className="legend-dot yellow" aria-hidden="true"></span> Trust Boundary</span>
            </div>
          </div>
        )}

        {/* Accessible Data Table View */}
        {(viewMode === 'both' || viewMode === 'table_only') && (
          <div className="findings-table-container">
            <table className="findings-accessible-table" aria-label="Repository findings table by file path">
              <thead>
                <tr>
                  <th scope="col">
                    <button
                      type="button"
                      className="table-sort-btn"
                      onClick={() => { setSortBy('path'); setSortAsc(!sortAsc); }}
                    >
                      File Path {sortBy === 'path' ? (sortAsc ? '▲' : '▼') : ''}
                    </button>
                  </th>
                  <th scope="col">
                    <button
                      type="button"
                      className="table-sort-btn"
                      onClick={() => { setSortBy('hotspot'); setSortAsc(!sortAsc); }}
                    >
                      Hotspot {sortBy === 'hotspot' ? (sortAsc ? '▲' : '▼') : ''}
                    </button>
                  </th>
                  <th scope="col">Trust Boundary</th>
                  <th scope="col">
                    <button
                      type="button"
                      className="table-sort-btn"
                      onClick={() => { setSortBy('testGap'); setSortAsc(!sortAsc); }}
                    >
                      Test Coverage {sortBy === 'testGap' ? (sortAsc ? '▲' : '▼') : ''}
                    </button>
                  </th>
                  <th scope="col">Signals</th>
                </tr>
              </thead>
              <tbody>
                {sortedOverlays.map((item) => {
                  const isSelected = item.path === selectedPath;
                  return (
                    <tr
                      key={item.path}
                      className={isSelected ? 'selected-row' : ''}
                      onClick={() => handleRowClick(item.path)}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleRowClick(item.path);
                        }
                      }}
                    >
                      <td className="file-path-cell">
                        <code>{item.path}</code>
                      </td>
                      <td>
                        <span className={`hotspot-pill score-${Math.min(4, item.hotspot)}`}>
                          {item.hotspot}
                        </span>
                      </td>
                      <td>
                        {item.trustBoundary ? (
                          <span className="badge-boundary">Trust Boundary</span>
                        ) : (
                          <span className="text-muted">Standard</span>
                        )}
                      </td>
                      <td>
                        {item.testGap ? (
                          <span className="badge-test-gap">Test Gap</span>
                        ) : (
                          <span className="badge-tested">Covered</span>
                        )}
                      </td>
                      <td>
                        <span className="finding-count-pill">{item.findingIds.length}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Selected file findings detail drawer */}
      {selectedOverlay && (
        <div className="selected-path-findings-drawer" aria-label={`Findings detail for ${selectedOverlay.path}`}>
          <div className="drawer-header">
            <h4>Findings for <code>{selectedOverlay.path}</code></h4>
            <span className="hotspot-summary-tag">Hotspot Index: {selectedOverlay.hotspot}</span>
          </div>

          {pathFindings.length === 0 ? (
            <p className="no-findings-msg">No active defect signals or warnings for this file.</p>
          ) : (
            <div className="findings-detail-list">
              {pathFindings.map((finding) => (
                <div key={finding.id} className={`finding-card severity-${finding.severity}`}>
                  <div className="finding-card-header">
                    <span className={`severity-tag ${finding.severity}`}>{finding.severity.toUpperCase()}</span>
                    <span className="finding-title">{finding.title}</span>
                    <span className="finding-rule-id"><code>{finding.ruleId}</code></span>
                  </div>
                  <p className="finding-message">{finding.message}</p>
                  {finding.evidence.map((ev, i) => (
                    <div key={i} className="finding-evidence-snippet">
                      <span className="line-num">Line {ev.lineStart}:</span>
                      <code>{ev.excerpt}</code>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
