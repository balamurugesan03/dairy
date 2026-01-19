import { useState, useEffect } from 'react';
import './FilterPanel.css';
import { message } from '../../utils/toast';

const FilterPanel = ({
  filters,
  onFilterChange,
  onClearFilters,
  filterConfig = [],
  presetStorageKey = 'filterPresets',
  showPresets = true
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [savedPresets, setSavedPresets] = useState([]);
  const [showPresetMenu, setShowPresetMenu] = useState(false);

  // Load saved presets from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(presetStorageKey);
      if (stored) {
        setSavedPresets(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load filter presets:', error);
    }
  }, [presetStorageKey]);

  // Save presets to localStorage
  const savePresetsToStorage = (presets) => {
    try {
      localStorage.setItem(presetStorageKey, JSON.stringify(presets));
      setSavedPresets(presets);
    } catch (error) {
      console.error('Failed to save filter presets:', error);
      message.error('Failed to save preset');
    }
  };

  const handleSavePreset = () => {
    if (!presetName.trim()) {
      message.error('Please enter a preset name');
      return;
    }

    // Check if any filters are active
    const hasActiveFilters = Object.values(filters).some(val => val !== '' && val !== null && val !== undefined);
    if (!hasActiveFilters) {
      message.error('No filters to save');
      return;
    }

    const newPreset = {
      id: Date.now(),
      name: presetName.trim(),
      filters: { ...filters },
      createdAt: new Date().toISOString()
    };

    const existingIndex = savedPresets.findIndex(p => p.name === presetName.trim());
    let updatedPresets;

    if (existingIndex >= 0) {
      // Update existing preset
      updatedPresets = [...savedPresets];
      updatedPresets[existingIndex] = newPreset;
      message.success(`Preset "${presetName}" updated`);
    } else {
      // Add new preset
      updatedPresets = [...savedPresets, newPreset];
      message.success(`Preset "${presetName}" saved`);
    }

    savePresetsToStorage(updatedPresets);
    setPresetName('');
    setShowPresetModal(false);
  };

  const handleLoadPreset = (preset) => {
    onFilterChange(preset.filters);
    setShowPresetMenu(false);
    message.success(`Loaded preset "${preset.name}"`);
  };

  const handleDeletePreset = (presetId) => {
    const updatedPresets = savedPresets.filter(p => p.id !== presetId);
    savePresetsToStorage(updatedPresets);
    message.success('Preset deleted');
  };

  const getActiveFilterCount = () => {
    return Object.values(filters).filter(val => val !== '' && val !== null && val !== undefined).length;
  };

  const renderFilterField = (config) => {
    const value = filters[config.key] || '';

    switch (config.type) {
      case 'text':
      case 'number':
        return (
          <input
            type={config.type}
            className="filter-input"
            value={value}
            onChange={(e) => onFilterChange({ ...filters, [config.key]: e.target.value })}
            placeholder={config.placeholder || config.label}
          />
        );

      case 'select':
        return (
          <select
            className="filter-select"
            value={value}
            onChange={(e) => onFilterChange({ ...filters, [config.key]: e.target.value })}
          >
            <option value="">All {config.label}</option>
            {config.options.map((option) => (
              <option key={option.value || option} value={option.value || option}>
                {option.label || option}
              </option>
            ))}
          </select>
        );

      case 'date':
        return (
          <input
            type="date"
            className="filter-input"
            value={value}
            onChange={(e) => onFilterChange({ ...filters, [config.key]: e.target.value })}
          />
        );

      case 'daterange':
        return (
          <div className="filter-daterange">
            <input
              type="date"
              className="filter-input"
              value={filters[config.fromKey] || ''}
              onChange={(e) => onFilterChange({ ...filters, [config.fromKey]: e.target.value })}
              placeholder="From"
            />
            <span className="daterange-separator">to</span>
            <input
              type="date"
              className="filter-input"
              value={filters[config.toKey] || ''}
              onChange={(e) => onFilterChange({ ...filters, [config.toKey]: e.target.value })}
              placeholder="To"
            />
          </div>
        );

      case 'range':
        return (
          <div className="filter-range">
            <input
              type="number"
              className="filter-input"
              value={filters[config.minKey] || ''}
              onChange={(e) => onFilterChange({ ...filters, [config.minKey]: e.target.value })}
              placeholder={`Min ${config.label}`}
            />
            <span className="range-separator">-</span>
            <input
              type="number"
              className="filter-input"
              value={filters[config.maxKey] || ''}
              onChange={(e) => onFilterChange({ ...filters, [config.maxKey]: e.target.value })}
              placeholder={`Max ${config.label}`}
            />
          </div>
        );

      default:
        return null;
    }
  };

  const basicFilters = filterConfig.filter(f => !f.advanced);
  const advancedFilters = filterConfig.filter(f => f.advanced);
  const activeCount = getActiveFilterCount();

  return (
    <div className="filter-panel">
      <div className="filter-panel-header">
        <div className="filter-header-left">
          <h3>Filters</h3>
          {activeCount > 0 && (
            <span className="filter-count-badge">{activeCount}</span>
          )}
        </div>

        <div className="filter-header-actions">
          {showPresets && savedPresets.length > 0 && (
            <div className="preset-menu-wrapper">
              <button
                className="btn-icon"
                onClick={() => setShowPresetMenu(!showPresetMenu)}
                title="Load preset"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M9.5 13a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"/>
                </svg>
              </button>

              {showPresetMenu && (
                <div className="preset-dropdown">
                  <div className="preset-dropdown-header">Saved Presets</div>
                  {savedPresets.map((preset) => (
                    <div key={preset.id} className="preset-item">
                      <button
                        className="preset-name"
                        onClick={() => handleLoadPreset(preset)}
                      >
                        {preset.name}
                      </button>
                      <button
                        className="preset-delete"
                        onClick={() => handleDeletePreset(preset.id)}
                        title="Delete preset"
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                          <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                          <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {showPresets && (
            <button
              className="btn-icon"
              onClick={() => setShowPresetModal(true)}
              title="Save current filters"
              disabled={activeCount === 0}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
              </svg>
            </button>
          )}

          {activeCount > 0 && (
            <button className="btn-text" onClick={onClearFilters}>
              Clear all
            </button>
          )}

          {advancedFilters.length > 0 && (
            <button
              className="btn-text"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              {showAdvanced ? 'Hide' : 'Show'} advanced
            </button>
          )}
        </div>
      </div>

      <div className="filter-panel-body">
        {/* Basic Filters */}
        <div className="filter-grid">
          {basicFilters.map((config) => (
            <div key={config.key} className="filter-field">
              <label className="filter-label">{config.label}</label>
              {renderFilterField(config)}
            </div>
          ))}
        </div>

        {/* Advanced Filters */}
        {showAdvanced && advancedFilters.length > 0 && (
          <div className="filter-advanced">
            <div className="filter-grid">
              {advancedFilters.map((config) => (
                <div key={config.key} className="filter-field">
                  <label className="filter-label">{config.label}</label>
                  {renderFilterField(config)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active Filter Chips */}
        {activeCount > 0 && (
          <div className="filter-chips">
            {Object.entries(filters).map(([key, value]) => {
              if (!value || value === '') return null;

              const config = filterConfig.find(f => f.key === key || f.minKey === key || f.maxKey === key || f.fromKey === key || f.toKey === key);
              if (!config) return null;

              let label = config.label;
              let displayValue = value;

              // Handle special cases
              if (config.type === 'select') {
                const option = config.options.find(opt => (opt.value || opt) === value);
                displayValue = option?.label || option || value;
              }

              return (
                <div key={key} className="filter-chip">
                  <span className="chip-label">{label}:</span>
                  <span className="chip-value">{displayValue}</span>
                  <button
                    className="chip-remove"
                    onClick={() => onFilterChange({ ...filters, [key]: '' })}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                      <path d="M4.646 4.646a.5.5 0 0 1 .708 0L6 5.293l.646-.647a.5.5 0 0 1 .708.708L6.707 6l.647.646a.5.5 0 0 1-.708.708L6 6.707l-.646.647a.5.5 0 0 1-.708-.708L5.293 6l-.647-.646a.5.5 0 0 1 0-.708z"/>
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Save Preset Modal */}
      {showPresetModal && (
        <div className="modal-overlay" onClick={() => setShowPresetModal(false)}>
          <div className="preset-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Save Filter Preset</h3>
            <input
              type="text"
              className="preset-name-input"
              placeholder="Enter preset name"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSavePreset()}
              autoFocus
            />
            <div className="preset-modal-actions">
              <button className="btn-secondary" onClick={() => setShowPresetModal(false)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleSavePreset}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterPanel;
