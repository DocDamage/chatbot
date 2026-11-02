import type { FC } from 'react';
import type { ChatRunRecord } from '../../../src/types/chat-diagnostics';
import './ChatDiagnosticsModal.css';

export interface ChatDiagnosticsModalProps {
  run: ChatRunRecord;
  onClose: () => void;
}

export const ChatDiagnosticsModal: FC<ChatDiagnosticsModalProps> = ({ run, onClose }) => {
  const isFailed = run.status === 'failed';

  return (
    <div className="chat-diag-overlay" role="dialog" aria-modal="true" aria-labelledby="chat-diag-title">
      <div className="chat-diag-modal">
        <div className="chat-diag-header">
          <div className="chat-diag-title-area">
            <h3 id="chat-diag-title">Execution Diagnostics</h3>
            <span className={`chat-diag-badge status-${run.status}`}>{run.status.toUpperCase()}</span>
          </div>
          <button
            type="button"
            className="chat-diag-close-btn"
            onClick={onClose}
            aria-label="Close diagnostics"
          >
            ✕
          </button>
        </div>

        <div className="chat-diag-body">
          <div className="chat-diag-section">
            <h4>Request Identification</h4>
            <div className="chat-diag-grid">
              <div><strong>Request ID:</strong> <span>{run.requestId}</span></div>
              <div><strong>Trace ID:</strong> <span>{run.traceId}</span></div>
              <div><strong>Task Type:</strong> <span>{run.taskType}</span></div>
              <div><strong>Profile:</strong> <span>{run.botProfileVersion}</span></div>
            </div>
          </div>

          {isFailed && (
            <div className="chat-diag-section failure-alert">
              <h4>Failure Taxonomy & Reason</h4>
              <div className="chat-diag-grid">
                <div><strong>Failure Code:</strong> <span className="failure-code">{run.failureCode || 'UNKNOWN'}</span></div>
                <div><strong>Message:</strong> <span>{run.failureMessage || 'No error details recorded.'}</span></div>
              </div>
            </div>
          )}

          <div className="chat-diag-section">
            <h4>Model & Routing</h4>
            <div className="chat-diag-grid">
              <div><strong>Provider:</strong> <span>{run.selectedModel?.provider || 'None'}</span></div>
              <div><strong>Model:</strong> <span>{run.selectedModel?.model || 'None'}</span></div>
              <div><strong>Fallback:</strong> <span>{run.selectedModel?.fallbackUsed ? 'Yes' : 'No'}</span></div>
              <div><strong>Policy:</strong> <span>{run.modelPolicyVersion}</span></div>
            </div>
          </div>

          <div className="chat-diag-section">
            <h4>Stage Timings Waterfall</h4>
            <div className="chat-diag-waterfall">
              {Object.entries(run.stageTimings).map(([stage, ms]) => (
                <div key={stage} className="waterfall-row">
                  <span className="stage-name">{stage}</span>
                  <div className="stage-bar-track">
                    <div
                      className="stage-bar"
                      style={{ width: `${Math.min(100, Math.max(8, (ms / (run.latencyMs || 1000)) * 100))}%` }}
                    />
                  </div>
                  <span className="stage-duration">{ms} ms</span>
                </div>
              ))}
            </div>
          </div>

          <div className="chat-diag-section">
            <h4>Evidence & Verifications</h4>
            <div className="chat-diag-grid">
              <div><strong>Sources Selected:</strong> <span>{run.selectedSourceIds.length}</span></div>
              <div><strong>Tools Executed:</strong> <span>{run.toolCallIds.length}</span></div>
              <div><strong>Validation Codes:</strong> <span>{run.validationCodes.join(', ') || 'None'}</span></div>
              <div><strong>Total Latency:</strong> <span>{run.latencyMs ? `${run.latencyMs} ms` : 'N/A'}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
