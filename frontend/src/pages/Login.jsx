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
  const [username,    setUsername]    = useState('');
  const [password,    setPassword]    = useState('');
  const [error,       setError]       = useState('');
  const [loading,     setLoading]     = useState(false);

  // Society code lookup
  const [societyCode,    setSocietyCode]    = useState('');
  const [codeCompany,    setCodeCompany]    = useState(null);   // { _id, companyName, businessTypes }
  const [codeLookingUp,  setCodeLookingUp]  = useState(false);
  const [codeError,      setCodeError]      = useState('');

  const lookupTimer = useRef(null);

  const handleCodeChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6); // digits only, max 6
    setSocietyCode(val);
    setCodeCompany(null);
    setCodeError('');

    clearTimeout(lookupTimer.current);
    if (val.length >= 4) {
      setCodeLookingUp(true);
      lookupTimer.current = setTimeout(async () => {
        try {
          // Try live lookup first
          if (navigator.onLine) {
            const res = await companyAPI.getByCode(val);
            if (res?.success && res.data) {
              setCodeCompany(res.data);
              setCodeError('');
            } else {
              setCodeError('No company found with this code');
              setCodeCompany(null);
            }
          } else {
            // Offline — check cache
            const cached = JSON.parse(localStorage.getItem('dairy_cached_companies') || '[]');
            const found = cached.find(c => c.societyCode === val);
            if (found) { setCodeCompany(found); setCodeError(''); }
            else { setCodeError('Code not found in cached data'); setCodeCompany(null); }
          }
        } catch {
          setCodeError('Lookup failed — check connection');
        } finally {
          setCodeLookingUp(false);
        }
      }, 400);
    } else {
      setCodeLookingUp(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!societyCode.trim()) {
      setError('Please enter your society code');
      return;
    }
    if (!codeCompany) {
      setError('Enter a valid society code to continue');
      return;
    }
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

          {/* Society Code */}
          <div className="form-group">
            <label htmlFor="society-code">Society Code</label>
            <div className="society-code-wrapper">
              <input
                id="society-code"
                type="text"
                inputMode="numeric"
                value={societyCode}
                onChange={handleCodeChange}
                placeholder="Enter 4-digit society code (e.g. 1001)"
                disabled={loading}
                autoComplete="off"
                autoFocus
                maxLength={6}
              />
              {codeLookingUp && <span className="code-spinner"><span className="spinner-small"></span></span>}
            </div>
            {/* Company name confirmation */}
            {codeCompany && (
              <div className="code-company-found">
                <span className="code-check">✓</span>
                <span className="code-company-name">{codeCompany.companyName}</span>
                <span className="code-company-type">
                  {codeCompany.businessTypes?.map(t => t.includes('Dairy') ? 'Dairy' : 'Private').join(', ')}
                </span>
              </div>
            )}
            {codeError && <p className="code-error">{codeError}</p>}
          </div>

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
