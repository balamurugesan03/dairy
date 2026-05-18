import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { companyAPI } from '../services/api';
import './Login.css';

const useOnline = () => {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on  = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online',  on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
};

const Login = () => {
  const { login } = useAuth();
  const isOnline = useOnline();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef(null);

  // Fetch companies on mount
  useEffect(() => {
    fetchCompanies();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchCompanies = async () => {
    // Offline — load from cache
    if (!navigator.onLine) {
      try {
        const cached = JSON.parse(localStorage.getItem('dairy_cached_companies') || '[]');
        setCompanies(cached);
      } catch { setCompanies([]); }
      setLoadingCompanies(false);
      return;
    }
    try {
      const response = await companyAPI.getPublic();
      if (response.success) {
        const list = response.data || [];
        setCompanies(list);
        localStorage.setItem('dairy_cached_companies', JSON.stringify(list));
      }
    } catch {
      // Server unreachable — fall back to cache
      try {
        const cached = JSON.parse(localStorage.getItem('dairy_cached_companies') || '[]');
        setCompanies(cached);
      } catch { setCompanies([]); }
    } finally {
      setLoadingCompanies(false);
    }
  };

  const filteredCompanies = companies.filter(c =>
    c.companyName.toLowerCase().includes(searchText.toLowerCase())
  );

  const handleSelectCompany = (company) => {
    setSelectedCompany(company._id);
    setSearchText(company.companyName);
    setShowDropdown(false);
  };

  const handleSearchChange = (e) => {
    setSearchText(e.target.value);
    setSelectedCompany('');
    setShowDropdown(true);
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
          {!isOnline && (
            <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 13, color: '#92400e', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>⚠</span>
              <span><b>Offline Mode</b> — using cached session. Enter your username to continue.</span>
            </div>
          )}
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

          {/* Company Search */}
          <div className="form-group" ref={searchRef}>
            <label htmlFor="company-search">Company</label>
            <div className="company-search-wrapper">
              <input
                id="company-search"
                type="text"
                value={searchText}
                onChange={handleSearchChange}
                onFocus={() => setShowDropdown(true)}
                placeholder={loadingCompanies ? 'Loading companies...' : 'Search company...'}
                disabled={loading || loadingCompanies}
                autoComplete="off"
              />
              {searchText && (
                <button
                  type="button"
                  className="company-clear-btn"
                  onClick={() => { setSearchText(''); setSelectedCompany(''); setShowDropdown(true); }}
                  tabIndex={-1}
                >×</button>
              )}
              {showDropdown && filteredCompanies.length > 0 && (
                <ul className="company-dropdown">
                  {filteredCompanies.map(company => (
                    <li
                      key={company._id}
                      className={`company-option${selectedCompany === company._id ? ' selected' : ''}`}
                      onMouseDown={() => handleSelectCompany(company)}
                    >
                      <span className="company-option-name">{company.companyName}</span>
                      <span className="company-option-type">
                        {company.businessTypes.map(t => t === 'Dairy Cooperative Society' ? 'Dairy' : 'Private').join(', ')}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {showDropdown && !loadingCompanies && searchText && filteredCompanies.length === 0 && (
                <ul className="company-dropdown">
                  <li className="company-no-result">No companies found</li>
                </ul>
              )}
            </div>
          </div>

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
