import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { companyAPI } from '../services/api';
import './Login.css';

const Login = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [loadingCompanies, setLoadingCompanies] = useState(true);

  // Fetch companies on mount
  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      const response = await companyAPI.getPublic();
      if (response.success) {
        setCompanies(response.data || []);
      }
    } catch (err) {
      console.error('Error fetching companies:', err);
    } finally {
      setLoadingCompanies(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Please enter username and password');
      return;
    }

    setLoading(true);
    const result = await login(username.trim(), password);
    setLoading(false);

    if (!result.success) {
      setError(result.message);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <h1>DairySoft ERP</h1>
          <p>Company Login</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && (
            <div className="login-error">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
            </div>
          )}

          {/* Company Selection */}
          {companies.length > 0 && (
            <div className="form-group">
              <label htmlFor="company">Select Company</label>
              <select
                id="company"
                value={selectedCompany}
                onChange={(e) => {
                  setSelectedCompany(e.target.value);
                  // Find company and pre-fill username if available
                  const company = companies.find(c => c._id === e.target.value);
                  if (company) {
                    // Don't pre-fill username, let user enter it
                  }
                }}
                disabled={loading || loadingCompanies}
                className="company-select"
              >
                <option value="">-- Select Company --</option>
                {companies.map(company => (
                  <option key={company._id} value={company._id}>
                    {company.companyName} ({company.businessTypes.map(t => t === 'Dairy Cooperative Society' ? 'Dairy' : 'Private').join(', ')})
                  </option>
                ))}
              </select>
            </div>
          )}

          {loadingCompanies && (
            <div className="loading-companies">
              <span className="spinner-small"></span>
              Loading companies...
            </div>
          )}

          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter company username"
              disabled={loading}
              autoComplete="username"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              disabled={loading}
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? (
              <>
                <span className="spinner-small"></span>
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="login-footer">
          <p>Dairy Cooperative Management System</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
