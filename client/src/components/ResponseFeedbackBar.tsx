import { useState, type FC } from 'react';
import type { FeedbackCategory } from '../../../src/types/feedback';
import './ResponseFeedbackBar.css';

export interface ResponseFeedbackBarProps {
  responseId: string;
  onFeedbackSubmit?: (feedback: {
    responseId: string;
    thumbs: 'up' | 'down';
    categories?: FeedbackCategory[];
    comment?: string;
  }) => void;
}

const CATEGORY_OPTIONS: Array<{ key: FeedbackCategory; label: string }> = [
  { key: 'incorrect', label: 'Incorrect' },
  { key: 'instruction_failure', label: "Didn't follow instructions" },
  { key: 'outdated', label: 'Outdated' },
  { key: 'misunderstood', label: "Didn't understand me" },
  { key: 'bad_code', label: 'Bad code' },
  { key: 'too_verbose', label: 'Too verbose' },
  { key: 'too_short', label: 'Too short' },
  { key: 'wrong_source', label: 'Wrong source' },
  { key: 'tool_failed', label: 'Tool failed' },
  { key: 'citation_problem', label: 'Citation problem' },
  { key: 'other', label: 'Other' },
];

export const ResponseFeedbackBar: FC<ResponseFeedbackBarProps> = ({
  responseId,
  onFeedbackSubmit,
}) => {
  const [thumb, setThumb] = useState<'up' | 'down' | null>(null);
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<FeedbackCategory[]>([]);
  const [comment, setComment] = useState('');
  const [isDone, setIsDone] = useState(false);

  const handleThumbClick = (selected: 'up' | 'down') => {
    setThumb(selected);
    if (selected === 'up') {
      setIsDone(true);
      setShowFollowUp(false);
      onFeedbackSubmit?.({ responseId, thumbs: 'up' });
    } else {
      // Prompt optional follow-up
      setShowFollowUp(true);
      onFeedbackSubmit?.({ responseId, thumbs: 'down' });
    }
  };

  const toggleCategory = (cat: FeedbackCategory) => {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const handleFollowUpSubmit = () => {
    setShowFollowUp(false);
    setIsDone(true);
    onFeedbackSubmit?.({
      responseId,
      thumbs: 'down',
      categories: selectedCategories,
      comment: comment.trim() || undefined,
    });
  };

  const handleSkipFollowUp = () => {
    setShowFollowUp(false);
    setIsDone(true);
  };

  return (
    <div className="feedback-bar" data-testid="response-feedback-bar">
      <div className="feedback-buttons" role="group" aria-label="Rate response">
        <button
          type="button"
          className={`feedback-btn feedback-up ${thumb === 'up' ? 'active' : ''}`}
          onClick={() => handleThumbClick('up')}
          aria-label="Helpful response"
          aria-pressed={thumb === 'up'}
          title="Good response"
        >
          <span aria-hidden="true">👍</span>
        </button>

        <button
          type="button"
          className={`feedback-btn feedback-down ${thumb === 'down' ? 'active' : ''}`}
          onClick={() => handleThumbClick('down')}
          aria-label="Unhelpful response"
          aria-pressed={thumb === 'down'}
          title="Bad response"
        >
          <span aria-hidden="true">👎</span>
        </button>

        {isDone && <span className="feedback-thanks" role="status">Thanks for your feedback!</span>}
      </div>

      {showFollowUp && (
        <div className="feedback-followup" role="region" aria-label="Optional negative feedback follow-up">
          <div className="feedback-followup-header">
            <span>What went wrong? (Optional)</span>
            <button
              type="button"
              className="feedback-skip-btn"
              onClick={handleSkipFollowUp}
              aria-label="Skip follow-up"
            >
              Skip
            </button>
          </div>

          <div className="feedback-category-chips">
            {CATEGORY_OPTIONS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                className={`feedback-chip ${selectedCategories.includes(key) ? 'selected' : ''}`}
                onClick={() => toggleCategory(key)}
                aria-pressed={selectedCategories.includes(key)}
              >
                {label}
              </button>
            ))}
          </div>

          <textarea
            className="feedback-comment-input"
            placeholder="Additional details (optional)..."
            value={comment}
            onChange={e => setComment(e.target.value)}
            rows={2}
          />

          <div className="feedback-followup-actions">
            <button type="button" className="feedback-submit-details-btn" onClick={handleFollowUpSubmit}>
              Submit Details
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
