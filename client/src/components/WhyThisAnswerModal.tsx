import type { FC } from 'react';
import type { WhyThisAnswerDiagnostics } from '../../../src/types/citation';
import './WhyThisAnswerModal.css';

export interface WhyThisAnswerModalProps {
  diagnostics: WhyThisAnswerDiagnostics;
  onClose: () => void;
}

export const WhyThisAnswerModal: FC<WhyThisAnswerModalProps> = ({ diagnostics, onClose }) => {
  return (
    <div className="why-answer-overlay" role="dialog" aria-modal="true" aria-labelledby="why-answer-title">
      <div className="why-answer-modal">
        <div className="why-answer-header">
          <h3 id="why-answer-title">Response Diagnostics</h3>
          <button
            type="button"
            className="why-answer-close-btn"
            onClick={onClose}
            aria-label="Close diagnostics"
          >
            ✕
          </button>
        </div>

        <div className="why-answer-body">
          <div className="why-answer-section">
            <h4>Task & Intent Analysis</h4>
            <div className="why-answer-grid">
              <div><strong>Task Type:</strong> <span>{diagnostics.taskType}</span></div>
              <div><strong>Selected Intent:</strong> <span>{diagnostics.selectedIntent}</span></div>
            </div>
          </div>

          <div className="why-answer-section">
            <h4>Context & Knowledge Retrieval</h4>
            <div className="why-answer-grid">
              <div><strong>Pack IDs:</strong> <span>{diagnostics.packIds.length > 0 ? diagnostics.packIds.join(', ') : 'None'}</span></div>
              <div><strong>Candidates Evaluated:</strong> <span>{diagnostics.retrievalCandidateCount}</span></div>
              <div><strong>Selected Sources:</strong> <span>{diagnostics.selectedSourceCount}</span></div>
              <div><strong>Context Types:</strong> <span>{diagnostics.contextTypes.join(', ')}</span></div>
            </div>
          </div>

          <div className="why-answer-section">
            <h4>Model Routing & Execution</h4>
            <div className="why-answer-grid">
              <div><strong>Provider:</strong> <span>{diagnostics.modelRoute.provider}</span></div>
              <div><strong>Model:</strong> <span>{diagnostics.modelRoute.model}</span></div>
              <div><strong>Policy:</strong> <span>{diagnostics.modelRoute.policy}</span></div>
              <div><strong>Fallback Invoked:</strong> <span>{diagnostics.modelRoute.fallbackUsed ? 'Yes' : 'No'}</span></div>
            </div>
          </div>

          {diagnostics.toolStatus && diagnostics.toolStatus.length > 0 && (
            <div className="why-answer-section">
              <h4>Tool Verifications</h4>
              <ul className="why-answer-tools">
                {diagnostics.toolStatus.map((tool, idx) => (
                  <li key={idx}>
                    <strong>{tool.toolName}:</strong> <span>{tool.status}</span>
                    {tool.summary && <span> — {tool.summary}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="why-answer-section">
            <h4>Policy Versions</h4>
            <div className="why-answer-grid">
              <div><strong>Prompt Policy:</strong> <span>{diagnostics.promptPolicyVersion}</span></div>
              <div><strong>Retrieval Policy:</strong> <span>{diagnostics.retrievalPolicyVersion}</span></div>
              <div><strong>Bot Profile:</strong> <span>{diagnostics.botProfileVersion}</span></div>
            </div>
          </div>

          {diagnostics.warnings && diagnostics.warnings.length > 0 && (
            <div className="why-answer-warnings">
              <h4>Runtime Warnings</h4>
              <ul>
                {diagnostics.warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="why-answer-footer">
          <button type="button" className="why-answer-done-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
