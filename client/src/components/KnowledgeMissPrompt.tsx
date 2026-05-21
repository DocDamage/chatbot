interface KnowledgeMissPromptProps {
  query: string;
  domain: string;
  recommendedSources?: string[];
  onSearch: () => void;
  onCancel: () => void;
}

function KnowledgeMissPrompt({
  query,
  domain,
  recommendedSources = [],
  onSearch,
  onCancel,
}: KnowledgeMissPromptProps) {
  return (
    <div className="assistant-cta-bar" aria-label="Knowledge miss prompt">
      <div>
        <strong>I do not have this in the local knowledge database.</strong>
        <span>{domain}: {query}</span>
        {recommendedSources.length > 0 && (
          <small>{recommendedSources.join(', ')}</small>
        )}
      </div>
      <button type="button" onClick={onSearch}>Search Online</button>
      <button type="button" onClick={onCancel}>Cancel</button>
    </div>
  );
}

export default KnowledgeMissPrompt;
