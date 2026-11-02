import React, { useState } from 'react';
import './ModelSelectorDropdown.css';

export type ModelProfileChoice = 'Auto' | 'Fast' | 'Balanced' | 'Reasoning' | 'Coding' | 'Creative' | 'Local';

export interface ModelSelectorDropdownProps {
  currentChoice?: ModelProfileChoice;
  onChoiceChange?: (choice: ModelProfileChoice) => void;
  configuredModelName?: string;
  configuredProviderName?: string;
}

export const ModelSelectorDropdown: React.FC<ModelSelectorDropdownProps> = ({
  currentChoice = 'Auto',
  onChoiceChange,
  configuredModelName,
  configuredProviderName
}) => {
  const [selected, setSelected] = useState<ModelProfileChoice>(currentChoice);

  const choices: ModelProfileChoice[] = ['Auto', 'Fast', 'Balanced', 'Reasoning', 'Coding', 'Creative', 'Local'];

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value as ModelProfileChoice;
    setSelected(val);
    onChoiceChange?.(val);
  };

  return (
    <div className="model-selector-container" data-testid="model-selector-container">
      <label htmlFor="model-profile-select" className="model-selector-label">
        Model Policy:
      </label>
      <select
        id="model-profile-select"
        className="model-selector-select"
        value={selected}
        onChange={handleChange}
        aria-label="Select Model Profile Policy"
        data-testid="model-profile-select"
      >
        {choices.map(choice => (
          <option key={choice} value={choice}>
            {choice}
          </option>
        ))}
      </select>
      {configuredModelName && (
        <span className="model-selector-details" data-testid="model-selector-details">
          ({configuredProviderName ? `${configuredProviderName} / ` : ''}{configuredModelName})
        </span>
      )}
    </div>
  );
};
