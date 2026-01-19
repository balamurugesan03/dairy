import { useState, useEffect } from 'react';
import { useCompany } from '../../context/CompanyContext';
import CompanySetup from './CompanySetup';
import './CompanySelection.css';

const CompanySelection = () => {
  const { companies, fetchCompanies, setCompany } = useCompany();
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [selectedBusinessType, setSelectedBusinessType] = useState('');
  const [showSetup, setShowSetup] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    setLoading(true);
    await fetchCompanies();
    setLoading(false);
  };

  const selectedCompanyData = companies.find(c => c._id === selectedCompanyId);
  const availableBusinessTypes = selectedCompanyData?.businessTypes || [];

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!selectedCompanyId || !selectedBusinessType) {
      alert('Please select both company and business type');
      return;
    }

    const company = companies.find(c => c._id === selectedCompanyId);
    if (company) {
      setCompany(company, selectedBusinessType);
    }
  };

  const handleCompanyCreated = (newCompany) => {
    // Reload companies and switch to selection
    loadCompanies();
    setShowSetup(false);
    // Auto-select the new company
    setSelectedCompanyId(newCompany._id);
    // If only one business type, auto-select it
    if (newCompany.businessTypes.length === 1) {
      setSelectedBusinessType(newCompany.businessTypes[0]);
    }
  };

  if (showSetup) {
    return <CompanySetup onComplete={handleCompanyCreated} />;
  }

  return (
    <div className="company-selection-container">
      <div className="company-selection-card">
        <div className="company-selection-header">
          <div className="logo-section">
            <div className="logo-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h1>Welcome to Dairy Management</h1>
            <p>Select your company and business type to continue</p>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading companies...</p>
          </div>
        ) : companies.length === 0 ? (
          <div className="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" strokeWidth="2"/>
            </svg>
            <h2>No Companies Found</h2>
            <p>Create your first company to get started</p>
            <button className="btn btn-primary" onClick={() => setShowSetup(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <line x1="12" y1="5" x2="12" y2="19" strokeWidth="2" strokeLinecap="round"/>
                <line x1="5" y1="12" x2="19" y2="12" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Create Company
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="selection-form">
            <div className="form-section">
              <label className="form-label">Select Company *</label>
              <select
                className="form-select"
                value={selectedCompanyId}
                onChange={(e) => {
                  setSelectedCompanyId(e.target.value);
                  setSelectedBusinessType(''); // Reset business type when company changes
                }}
                required
              >
                <option value="">-- Select a company --</option>
                {companies.map((company) => (
                  <option key={company._id} value={company._id}>
                    {company.companyName}
                  </option>
                ))}
              </select>
            </div>

            {selectedCompanyId && availableBusinessTypes.length > 0 && (
              <div className="form-section">
                <label className="form-label">Select Business Type *</label>
                <div className="business-type-cards">
                  {availableBusinessTypes.map((type) => (
                    <label
                      key={type}
                      className={`business-type-card ${selectedBusinessType === type ? 'selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name="businessType"
                        value={type}
                        checked={selectedBusinessType === type}
                        onChange={(e) => setSelectedBusinessType(e.target.value)}
                        required
                      />
                      <div className="card-content">
                        <div className="card-icon">
                          {type === 'Dairy Cooperative Society' ? (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" strokeWidth="2"/>
                              <path d="M12 6v6l4 2" strokeWidth="2" strokeLinecap="round"/>
                            </svg>
                          ) : (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="2"/>
                              <path d="M9 12h6M12 9v6" strokeWidth="2" strokeLinecap="round"/>
                            </svg>
                          )}
                        </div>
                        <div className="card-title">{type}</div>
                        <div className="card-description">
                          {type === 'Dairy Cooperative Society'
                            ? 'Manage dairy operations, farmer payments, and subsidies'
                            : 'Handle business operations, warranty, machines, and promotions'}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="form-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowSetup(true)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <line x1="12" y1="5" x2="12" y2="19" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="5" y1="12" x2="19" y2="12" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                Create New Company
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!selectedCompanyId || !selectedBusinessType}
              >
                Continue
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M5 12h14M12 5l7 7-7 7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default CompanySelection;
