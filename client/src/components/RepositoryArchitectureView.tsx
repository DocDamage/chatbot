import React, { useState } from 'react';

export interface ArchitectureCardModel {
  id: string;
  subsystem: string;
  title: string;
  purpose: string;
  sourceFiles: Array<{ filePath: string; fileDigest: string; sizeBytes: number }>;
  keySymbols: Array<{ name: string; kind: string; signature?: string; filePath: string }>;
  cruxExcerpts: Array<{
    filePath: string;
    startLine: number;
    endLine: number;
    symbolName?: string;
    codeSnippet: string;
    explanation: string;
  }>;
  typedLinks: Array<{ targetCardId: string; relationship: string; description?: string }>;
  entrypoints: string[];
  tests: string[];
  risksAndGotchas: string[];
  humanNotes?: string;
}

interface RepositoryArchitectureViewProps {
  cards: ArchitectureCardModel[];
  onSelectCard?: (cardId: string) => void;
  onUpdateNotes?: (cardId: string, notes: string) => void;
}

export const RepositoryArchitectureView: React.FC<RepositoryArchitectureViewProps> = ({
  cards,
  onSelectCard,
  onUpdateNotes
}) => {
  const [selectedId, setSelectedId] = useState<string>(cards[0]?.id || '');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [editingNotes, setEditingNotes] = useState<string>('');
  const [isEditingNotes, setIsEditingNotes] = useState<boolean>(false);

  const filteredCards = cards.filter(c =>
    c.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
    c.subsystem.toLowerCase().includes(searchFilter.toLowerCase()) ||
    c.purpose.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const selectedCard = cards.find(c => c.id === selectedId) || filteredCards[0];

  const handleStartEdit = () => {
    setEditingNotes(selectedCard?.humanNotes || '');
    setIsEditingNotes(true);
  };

  const handleSaveNotes = () => {
    if (selectedCard && onUpdateNotes) {
      onUpdateNotes(selectedCard.id, editingNotes);
    }
    setIsEditingNotes(false);
  };

  return (
    <div className="repo-arch-view" style={{ display: 'flex', height: '100%', gap: '16px' }} role="region" aria-label="Repository Architecture Map">
      {/* Sidebar List */}
      <div style={{ width: '280px', borderRight: '1px solid var(--border-color, #333)', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <input
          type="text"
          placeholder="Filter architecture cards..."
          value={searchFilter}
          onChange={e => setSearchFilter(e.target.value)}
          aria-label="Filter architecture cards"
          style={{ width: '100%', padding: '6px 10px', borderRadius: '4px', border: '1px solid #444', background: '#222', color: '#fff' }}
        />
        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }} role="list">
          {filteredCards.map(card => (
            <button
              key={card.id}
              onClick={() => {
                setSelectedId(card.id);
                if (onSelectCard) onSelectCard(card.id);
              }}
              style={{
                textAlign: 'left',
                padding: '8px 10px',
                borderRadius: '4px',
                background: card.id === selectedCard?.id ? 'var(--accent-bg, #2a3b5c)' : 'transparent',
                border: card.id === selectedCard?.id ? '1px solid var(--accent-border, #4a7bdc)' : '1px solid transparent',
                color: '#fff',
                cursor: 'pointer'
              }}
              role="listitem"
            >
              <div style={{ fontWeight: 600, fontSize: '13px' }}>{card.title}</div>
              <div style={{ fontSize: '11px', color: '#aaa' }}>{card.subsystem}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Card Detail */}
      {selectedCard ? (
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px' }}>{selectedCard.title}</h3>
              <span style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase' }}>Subsystem: {selectedCard.subsystem}</span>
            </div>
            <button
              onClick={handleStartEdit}
              style={{ padding: '4px 10px', fontSize: '12px', cursor: 'pointer' }}
            >
              {selectedCard.humanNotes ? 'Edit Notes' : 'Add Notes'}
            </button>
          </div>

          <div style={{ marginTop: '12px', lineHeight: 1.5 }}>
            <p>{selectedCard.purpose}</p>
          </div>

          {/* Human Notes */}
          {(selectedCard.humanNotes || isEditingNotes) && (
            <div style={{ marginTop: '16px', padding: '12px', background: '#1c2430', borderRadius: '6px', borderLeft: '4px solid #4a90e2' }}>
              <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>Human Notes & Architectural Context</div>
              {isEditingNotes ? (
                <div>
                  <textarea
                    value={editingNotes}
                    onChange={e => setEditingNotes(e.target.value)}
                    rows={3}
                    style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #444', borderRadius: '4px', padding: '6px' }}
                  />
                  <div style={{ marginTop: '6px', display: 'flex', gap: '8px' }}>
                    <button onClick={handleSaveNotes} style={{ padding: '4px 12px' }}>Save</button>
                    <button onClick={() => setIsEditingNotes(false)} style={{ padding: '4px 12px' }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '13px', color: '#ccc' }}>{selectedCard.humanNotes}</div>
              )}
            </div>
          )}

          {/* Key Symbols */}
          <div style={{ marginTop: '20px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Key Symbols & Contracts</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
              {selectedCard.keySymbols.map(sym => (
                <div key={sym.name} style={{ padding: '8px', background: '#1e1e1e', borderRadius: '4px', border: '1px solid #333' }}>
                  <div style={{ fontWeight: 600, color: '#61afef', fontSize: '13px' }}>{sym.name}</div>
                  <div style={{ fontSize: '11px', color: '#999' }}>{sym.kind} in <code>{sym.filePath}</code></div>
                </div>
              ))}
            </div>
          </div>

          {/* Crux Excerpts */}
          {selectedCard.cruxExcerpts.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Crux Code Excerpts</h4>
              {selectedCard.cruxExcerpts.map((excerpt, idx) => (
                <div key={idx} style={{ marginBottom: '12px', background: '#181818', borderRadius: '4px', padding: '10px', border: '1px solid #282828' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#aaa', marginBottom: '6px' }}>
                    <span><code>{excerpt.filePath}</code> (lines {excerpt.startLine}-{excerpt.endLine})</span>
                    <span>{excerpt.explanation}</span>
                  </div>
                  <pre style={{ margin: 0, padding: '8px', background: '#0f0f0f', borderRadius: '4px', fontSize: '12px', overflowX: 'auto' }}>
                    <code>{excerpt.codeSnippet}</code>
                  </pre>
                </div>
              ))}
            </div>
          )}

          {/* Risks and Gotchas */}
          {selectedCard.risksAndGotchas.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#e5c07b' }}>Risks & Gotchas</h4>
              <ul style={{ margin: 0, paddingLeft: '20px', color: '#ddd', fontSize: '13px' }}>
                {selectedCard.risksAndGotchas.map((r, i) => (
                  <li key={i} style={{ marginBottom: '4px' }}>{r}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div style={{ flex: 1, padding: '24px', color: '#888' }}>No architecture card selected.</div>
      )}
    </div>
  );
};
