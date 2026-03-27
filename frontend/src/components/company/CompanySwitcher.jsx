import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../../context/CompanyContext';
import './CompanySwitcher.css';

const CompanySwitcher = () => {
  const { selectedCompany, selectedBusinessType, switchCompany } = useCompany();
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const [tempBusinessType, setTempBusinessType] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
        setTempBusinessType('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSwitch = () => {
    if (!tempBusinessType) {
      alert('Please select a business type');
      return;
    }

    switchCompany(selectedCompany, tempBusinessType);
    setShowDropdown(false);
    navigate('/');
  };

  const availableBusinessTypes = selectedCompany?.businessTypes || [];

  // Only show switcher if this company has more than one business type
  if (!selectedCompany || !selectedBusinessType || availableBusinessTypes.length <= 1) {
    if (!selectedCompany || !selectedBusinessType) return null;
    // Still render button (read-only) if only one type
  }

  return (
    <div className="company-switcher" ref={dropdownRef}>
      <button
        className="company-switcher-button"
        onClick={() => setShowDropdown(!showDropdown)}
        title="Switch Business Type"
      >
        <div className="company-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div className="company-info">
          <div className="company-name">{selectedCompany.companyName}</div>
          <div className="business-type">{selectedBusinessType}</div>
        </div>
        {availableBusinessTypes.length > 1 && (
          <svg className={`dropdown-arrow ${showDropdown ? 'open' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M6 9l6 6 6-6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </button>

      {showDropdown && availableBusinessTypes.length > 1 && (
        <div className="company-switcher-dropdown">
          <div className="dropdown-header">
            <h3>{selectedCompany.companyName}</h3>
          </div>

          <div className="dropdown-content">
            <div className="dropdown-section">
              <label className="dropdown-label">Switch Business Type</label>
              <div className="business-type-options">
                {availableBusinessTypes.map((type) => (
                  <label
                    key={type}
                    className={`business-type-option ${(tempBusinessType || selectedBusinessType) === type ? 'selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="tempBusinessType"
                      value={type}
                      checked={(tempBusinessType || selectedBusinessType) === type}
                      onChange={(e) => setTempBusinessType(e.target.value)}
                    />
                    <span className="option-text">{type}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="dropdown-footer">
            <button
              className="dropdown-btn btn-cancel"
              onClick={() => {
                setShowDropdown(false);
                setTempBusinessType('');
              }}
            >
              Cancel
            </button>
            <button
              className="dropdown-btn btn-switch"
              onClick={handleSwitch}
              disabled={!tempBusinessType || tempBusinessType === selectedBusinessType}
            >
              Switch
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanySwitcher;
