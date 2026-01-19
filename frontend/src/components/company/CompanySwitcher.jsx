import { useState, useEffect, useRef } from 'react';
import { useCompany } from '../../context/CompanyContext';
import './CompanySwitcher.css';

const CompanySwitcher = () => {
  const { selectedCompany, selectedBusinessType, companies, fetchCompanies, switchCompany } = useCompany();
  const [showDropdown, setShowDropdown] = useState(false);
  const [tempCompanyId, setTempCompanyId] = useState('');
  const [tempBusinessType, setTempBusinessType] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (showDropdown && companies.length === 0) {
      fetchCompanies();
    }
  }, [showDropdown]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
        setTempCompanyId('');
        setTempBusinessType('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCompanyChange = (companyId) => {
    setTempCompanyId(companyId);
    setTempBusinessType(''); // Reset business type when company changes
  };

  const handleSwitch = () => {
    if (!tempCompanyId || !tempBusinessType) {
      alert('Please select both company and business type');
      return;
    }

    const company = companies.find(c => c._id === tempCompanyId);
    if (company) {
      switchCompany(company, tempBusinessType);
      setShowDropdown(false);
    }
  };

  const tempCompanyData = companies.find(c => c._id === tempCompanyId);
  const availableBusinessTypes = tempCompanyData?.businessTypes || [];

  if (!selectedCompany || !selectedBusinessType) {
    return null;
  }

  return (
    <div className="company-switcher" ref={dropdownRef}>
      <button
        className="company-switcher-button"
        onClick={() => setShowDropdown(!showDropdown)}
        title="Switch Company"
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
        <svg className={`dropdown-arrow ${showDropdown ? 'open' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M6 9l6 6 6-6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {showDropdown && (
        <div className="company-switcher-dropdown">
          <div className="dropdown-header">
            <h3>Switch Company</h3>
          </div>

          <div className="dropdown-content">
            <div className="dropdown-section">
              <label className="dropdown-label">Select Company</label>
              <select
                className="dropdown-select"
                value={tempCompanyId}
                onChange={(e) => handleCompanyChange(e.target.value)}
              >
                <option value="">-- Select a company --</option>
                {companies.map((company) => (
                  <option key={company._id} value={company._id}>
                    {company.companyName}
                  </option>
                ))}
              </select>
            </div>

            {tempCompanyId && availableBusinessTypes.length > 0 && (
              <div className="dropdown-section">
                <label className="dropdown-label">Select Business Type</label>
                <div className="business-type-options">
                  {availableBusinessTypes.map((type) => (
                    <label
                      key={type}
                      className={`business-type-option ${tempBusinessType === type ? 'selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name="tempBusinessType"
                        value={type}
                        checked={tempBusinessType === type}
                        onChange={(e) => setTempBusinessType(e.target.value)}
                      />
                      <span className="option-text">{type}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="dropdown-footer">
            <button
              className="dropdown-btn btn-cancel"
              onClick={() => {
                setShowDropdown(false);
                setTempCompanyId('');
                setTempBusinessType('');
              }}
            >
              Cancel
            </button>
            <button
              className="dropdown-btn btn-switch"
              onClick={handleSwitch}
              disabled={!tempCompanyId || !tempBusinessType}
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
