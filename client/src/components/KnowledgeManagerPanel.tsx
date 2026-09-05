import React, { useState } from 'react';
import './KnowledgeManagerPanel.css';

export type KMTab = 'Installed' | 'Available' | 'Updates' | 'Storage' | 'Custom Packs' | 'Advanced';

export interface KnowledgePackItem {
  id: string;
  title: string;
  status: 'Current' | 'Update Available' | 'Disabled' | 'Available';
  sourceFamiliesCount: number;
  indexedStorageGB: number | null;
  downloadSizeGB?: number | null;
  license?: string;
  updatePolicy?: string;
  lastUpdated?: string;
  version: string;
}

export interface KnowledgeManagerPanelProps {
  initialPacks?: KnowledgePackItem[];
  onInstall?: (packId: string) => void;
  onUpdate?: (packId: string) => void;
  onToggleDisable?: (packId: string, disabled: boolean) => void;
}

const DEFAULT_PACKS: KnowledgePackItem[] = [
  {
    id: 'official-docs',
    title: 'Official Developer Documentation',
    status: 'Current',
    sourceFamiliesCount: 18,
    indexedStorageGB: 3.2,
    downloadSizeGB: 1.1,
    license: 'Official / Permissive',
    updatePolicy: 'Weekly + Release-driven',
    lastUpdated: '2026-09-04',
    version: '2026.09'
  },
  {
    id: 'developer-qa',
    title: 'Developer Q&A (Stack Exchange / SO)',
    status: 'Update Available',
    sourceFamiliesCount: 6,
    indexedStorageGB: 4.8,
    downloadSizeGB: 1.9,
    license: 'CC-BY-SA 4.0 / Attributed',
    updatePolicy: 'Monthly reconciliation',
    lastUpdated: '2026-08-15',
    version: '2026.08'
  },
  {
    id: 'academic-research',
    title: 'Academic Research & Math Pack',
    status: 'Available',
    sourceFamiliesCount: 4,
    indexedStorageGB: null, // unknown until installed
    downloadSizeGB: 2.5,
    license: 'Open Access / ArXiv / Semantic Scholar',
    updatePolicy: 'Incremental monthly',
    version: '1.2.0'
  }
];

export const KnowledgeManagerPanel: React.FC<KnowledgeManagerPanelProps> = ({
  initialPacks = DEFAULT_PACKS,
  onInstall,
  onUpdate,
  onToggleDisable
}) => {
  const [activeTab, setActiveTab] = useState<KMTab>('Installed');
  const [packs, setPacks] = useState<KnowledgePackItem[]>(initialPacks);
  const [selectedPackForInstall, setSelectedPackForInstall] = useState<KnowledgePackItem | null>(null);

  const tabs: KMTab[] = ['Installed', 'Available', 'Updates', 'Storage', 'Custom Packs', 'Advanced'];

  const filteredPacks = packs.filter(p => {
    if (activeTab === 'Installed') return p.status === 'Current' || p.status === 'Update Available' || p.status === 'Disabled';
    if (activeTab === 'Available') return p.status === 'Available';
    if (activeTab === 'Updates') return p.status === 'Update Available';
    return true;
  });

  const handleInstallClick = (pack: KnowledgePackItem) => {
    setSelectedPackForInstall(pack);
  };

  const confirmInstall = () => {
    if (selectedPackForInstall) {
      onInstall?.(selectedPackForInstall.id);
      setPacks(prev =>
        prev.map(p => (p.id === selectedPackForInstall.id ? { ...p, status: 'Current', indexedStorageGB: 2.5 } : p))
      );
      setSelectedPackForInstall(null);
    }
  };

  const handleUpdate = (packId: string) => {
    onUpdate?.(packId);
    setPacks(prev =>
      prev.map(p => (p.id === packId ? { ...p, status: 'Current', lastUpdated: new Date().toISOString().split('T')[0] } : p))
    );
  };

  const handleToggle = (packId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'Disabled' ? 'Current' : 'Disabled';
    onToggleDisable?.(packId, nextStatus === 'Disabled');
    setPacks(prev =>
      prev.map(p => (p.id === packId ? { ...p, status: nextStatus as any } : p))
    );
  };

  return (
    <div className="knowledge-manager-panel" data-testid="knowledge-manager-panel">
      <div className="km-tabs" role="tablist">
        {tabs.map(tab => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            className={`km-tab-btn ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
            data-testid={`km-tab-${tab.toLowerCase().replace(' ', '-')}`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="km-content">
        {activeTab === 'Storage' ? (
          <div className="km-storage-view" data-testid="km-storage-view">
            <h3>Knowledge Storage Quota & Capacity</h3>
            <p>Total indexed storage across all packs: {packs.reduce((sum, p) => sum + (p.indexedStorageGB || 0), 0).toFixed(1)} GB</p>
          </div>
        ) : activeTab === 'Custom Packs' ? (
          <div className="km-custom-packs-view" data-testid="km-custom-packs-view">
            <h3>Custom Knowledge Packs</h3>
            <p>Import curated user repository files, local markdown corpora, or custom API endpoints.</p>
          </div>
        ) : activeTab === 'Advanced' ? (
          <div className="km-advanced-view" data-testid="km-advanced-view">
            <h3>Advanced Knowledge Settings</h3>
            <p>Re-embedding migrations, atomic stage recovery, and BM25/Dense hybrid fusion weights.</p>
          </div>
        ) : (
          <div className="km-pack-list" data-testid="km-pack-list">
            {filteredPacks.map(pack => (
              <div key={pack.id} className="km-pack-card" data-testid={`km-pack-card-${pack.id}`}>
                <div className="km-pack-header">
                  <h4 className="km-pack-title">{pack.title}</h4>
                  <span
                    className={`km-pack-badge ${
                      pack.status === 'Current'
                        ? 'current'
                        : pack.status === 'Update Available'
                        ? 'update'
                        : 'disabled'
                    }`}
                  >
                    {pack.status}
                  </span>
                </div>

                <div className="km-pack-stats">
                  <span>Source Families: {pack.sourceFamiliesCount}</span>
                  <span>
                    Storage: {pack.indexedStorageGB !== null ? `${pack.indexedStorageGB} GB indexed` : 'Unknown'}
                  </span>
                  <span>Version: {pack.version}</span>
                  {pack.lastUpdated && <span>Last Updated: {pack.lastUpdated}</span>}
                </div>

                <div className="km-pack-actions">
                  {pack.status === 'Available' ? (
                    <button
                      className="km-btn km-btn-primary"
                      onClick={() => handleInstallClick(pack)}
                      data-testid={`km-install-btn-${pack.id}`}
                    >
                      Install
                    </button>
                  ) : (
                    <>
                      {pack.status === 'Update Available' && (
                        <button
                          className="km-btn km-btn-primary"
                          onClick={() => handleUpdate(pack.id)}
                          data-testid={`km-update-btn-${pack.id}`}
                        >
                          Update
                        </button>
                      )}
                      <button
                        className="km-btn"
                        onClick={() => handleToggle(pack.id, pack.status)}
                        data-testid={`km-toggle-btn-${pack.id}`}
                      >
                        {pack.status === 'Disabled' ? 'Enable' : 'Disable'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedPackForInstall && (
        <div className="km-modal-overlay" data-testid="km-install-modal">
          <div className="km-modal-content">
            <h3>Install Knowledge Pack</h3>
            <h4>{selectedPackForInstall.title}</h4>
            <div className="km-modal-row">
              <span>Estimated Download:</span>
              <strong>{selectedPackForInstall.downloadSizeGB ? `${selectedPackForInstall.downloadSizeGB} GB` : 'Unknown'}</strong>
            </div>
            <div className="km-modal-row">
              <span>Estimated Indexed Storage:</span>
              <strong>{selectedPackForInstall.indexedStorageGB ? `${selectedPackForInstall.indexedStorageGB} GB` : 'Unknown'}</strong>
            </div>
            <div className="km-modal-row">
              <span>License / Attribution:</span>
              <strong>{selectedPackForInstall.license || 'Unknown'}</strong>
            </div>
            <div className="km-modal-row">
              <span>Update Policy:</span>
              <strong>{selectedPackForInstall.updatePolicy || 'Manual'}</strong>
            </div>

            <div className="km-pack-actions" style={{ marginTop: '16px' }}>
              <button
                className="km-btn km-btn-primary"
                onClick={confirmInstall}
                data-testid="km-confirm-install-btn"
              >
                Install
              </button>
              <button
                className="km-btn"
                onClick={() => setSelectedPackForInstall(null)}
                data-testid="km-cancel-install-btn"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
