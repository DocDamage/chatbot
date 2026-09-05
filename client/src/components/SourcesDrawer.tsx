import { useState, type FC } from 'react';
import type { SourcesDrawerData, SourceCard } from '../../../src/types/citation';
import './SourcesDrawer.css';

export interface SourcesDrawerProps {
  data: SourcesDrawerData;
  onOpenSource?: (card: SourceCard) => void;
}

export const SourcesDrawer: FC<SourcesDrawerProps> = ({ data, onOpenSource }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!data || data.totalSources === 0) {
    return null;
  }

  const handleAction = (card: SourceCard) => {
    if (onOpenSource) {
      onOpenSource(card);
      return;
    }
    if (card.action.type === 'open_url' && card.action.target) {
      window.open(card.action.target, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="sources-drawer" data-testid="sources-drawer">
      <button
        type="button"
        className="sources-drawer-toggle"
        onClick={() => setIsOpen(prev => !prev)}
        aria-expanded={isOpen}
        aria-controls="sources-drawer-content"
      >
        <span className="sources-drawer-icon" aria-hidden="true">📚</span>
        <span className="sources-drawer-label">{data.compactLabel}</span>
        <span className="sources-drawer-chevron" aria-hidden="true">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div id="sources-drawer-content" className="sources-drawer-content" role="region" aria-label="Cited knowledge sources">
          {data.unresolvedCitations && data.unresolvedCitations.length > 0 && (
            <div className="sources-drawer-warning" role="status">
              <span>⚠️ {data.unresolvedCitations.length} source reference(s) could not be verified.</span>
            </div>
          )}

          <div className="sources-card-list">
            {data.cards.map(card => (
              <div key={card.id} className="source-card" data-testid={`source-card-${card.id}`}>
                <div className="source-card-header">
                  <span className="source-card-title">{card.title}</span>
                  <div className="source-card-badges">
                    {card.badges.map((badge, idx) => (
                      <span key={idx} className="source-badge">{badge}</span>
                    ))}
                  </div>
                </div>

                {card.snippet && (
                  <p className="source-card-snippet">{card.snippet}</p>
                )}

                {card.action.type !== 'none' && (
                  <div className="source-card-footer">
                    <button
                      type="button"
                      className="source-card-action-btn"
                      onClick={() => handleAction(card)}
                    >
                      {card.action.label}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
