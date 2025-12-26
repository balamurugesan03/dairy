import { useState, useRef, useEffect } from 'react';
import './SearchableSelect.css';

const SearchableSelect = ({
  options = [],
  placeholder = 'Select...',
  value,
  onChange,
  onSearch,
  loading = false,
  allowClear = true,
  showSearch = true,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredOptions, setFilteredOptions] = useState(options);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    setFilteredOptions(options);
  }, [options]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);

    if (onSearch) {
      onSearch(value);
    } else {
      const filtered = options.filter(option =>
        option.label.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredOptions(filtered);
    }
  };

  const handleSelect = (option) => {
    onChange(option.value);
    setIsOpen(false);
    setSearchTerm('');
    setFilteredOptions(options);
  };

  const handleClear = () => {
    onChange(null);
    setSearchTerm('');
    setFilteredOptions(options);
  };

  const getSelectedLabel = () => {
    const selected = options.find(opt => opt.value === value);
    return selected ? selected.label : '';
  };

  return (
    <div className={`searchable-select ${disabled ? 'disabled' : ''}`} ref={dropdownRef}>
      <div className="select-input-wrapper" onClick={() => !disabled && setIsOpen(!isOpen)}>
        <input
          ref={inputRef}
          type="text"
          className="select-input"
          placeholder={placeholder}
          value={isOpen ? searchTerm : getSelectedLabel()}
          onChange={handleSearchChange}
          onFocus={() => !disabled && setIsOpen(true)}
          disabled={disabled}
          readOnly={!showSearch}
        />
        <div className="select-actions">
          {allowClear && value && !disabled && (
            <span className="clear-icon" onClick={(e) => { e.stopPropagation(); handleClear(); }}>
              ×
            </span>
          )}
          <span className={`arrow-icon ${isOpen ? 'open' : ''}`}>▼</span>
        </div>
      </div>

      {isOpen && (
        <div className="select-dropdown">
          {loading ? (
            <div className="select-loading">Loading...</div>
          ) : filteredOptions.length > 0 ? (
            <ul className="select-options">
              {filteredOptions.map((option, index) => (
                <li
                  key={index}
                  className={`select-option ${option.value === value ? 'selected' : ''}`}
                  onClick={() => handleSelect(option)}
                >
                  {option.label}
                </li>
              ))}
            </ul>
          ) : (
            <div className="select-empty">No options found</div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
