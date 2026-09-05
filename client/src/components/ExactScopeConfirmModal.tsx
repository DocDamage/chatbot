import { useState, useEffect, useRef } from 'react';

interface ExactScopeConfirmModalProps {
  isOpen: boolean;
  title: string;
  capabilityName: string;
  actionLabel: string;
  actionDescription: string;
  requiredScope: string;
  onConfirm: (confirmedScope: string) => void;
  onCancel: () => void;
}

export default function ExactScopeConfirmModal({
  isOpen,
  title,
  capabilityName,
  actionLabel,
  actionDescription,
  requiredScope,
  onConfirm,
  onCancel
}: ExactScopeConfirmModalProps) {
  const [typedScope, setTypedScope] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
      setTypedScope('');
      const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 50);
      return () => {
        window.clearTimeout(focusTimer);
        previouslyFocusedRef.current?.focus();
      };
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onCancel();
      } else if (e.key === 'Tab' && modalRef.current) {
        const focusable = Array.from(modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ));
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const isMatch = typedScope.trim() === requiredScope.trim();

  return (
    <div className="exact-scope-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-scope-title">
      <div className="exact-scope-modal-content" ref={modalRef}>
        <div className="exact-scope-modal-header">
          <span className="exact-scope-warning-icon" aria-hidden="true">⚠️</span>
          <div>
            <h3 id="modal-scope-title">{title || 'Exact-Scope Confirmation Required'}</h3>
            <p className="exact-scope-subtext">This action alters security or availability policy for <strong>{capabilityName}</strong>.</p>
          </div>
        </div>

        <div className="exact-scope-modal-body">
          <div className="exact-scope-callout">
            <span className="exact-scope-action-label">Action: {actionLabel}</span>
            <p className="exact-scope-action-desc">{actionDescription}</p>
          </div>

          <p className="exact-scope-instructions">
            To confirm this dangerous action, please type the exact confirmation phrase below:
          </p>
          <div className="exact-scope-required-box" aria-label="Required confirmation scope">
            <code>{requiredScope}</code>
          </div>

          <div className="exact-scope-input-group">
            <label htmlFor="exact-scope-input">Type confirmation phrase:</label>
            <input
              id="exact-scope-input"
              ref={inputRef}
              type="text"
              value={typedScope}
              onChange={(e) => setTypedScope(e.target.value)}
              placeholder={requiredScope}
              autoComplete="off"
              spellCheck="false"
            />
          </div>
        </div>

        <div className="exact-scope-modal-footer">
          <button type="button" className="btn-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-danger"
            disabled={!isMatch}
            onClick={() => {
              if (isMatch) onConfirm(requiredScope);
            }}
          >
            Confirm &amp; Execute
          </button>
        </div>
      </div>
    </div>
  );
}
