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
  const [showPassword, setShowPassword] = useState(false);

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
    <div className="lg-page">
      {/* ── Brand panel ─────────────────────────────────────────── */}
      <aside className="lg-brand" aria-hidden="true">
        <svg className="lg-waves" viewBox="0 0 600 800" preserveAspectRatio="none">
          <path d="M0 610 C 150 560, 300 680, 600 600 L600 800 L0 800 Z" fill="rgba(255,255,255,0.04)" />
          <path d="M0 670 C 180 620, 340 740, 600 660 L600 800 L0 800 Z" fill="rgba(120,200,80,0.10)" />
          <path d="M0 730 C 200 690, 380 790, 600 720 L600 800 L0 800 Z" fill="rgba(255,255,255,0.05)" />
        </svg>

        <div className="lg-brand-inner">
          <div className="lg-brand-mark">
            <span className="lg-dot" />
            DairySoft
          </div>

          <div className="lg-brand-copy">
            <h1>Run your dairy society<br />with confidence.</h1>
            <p>Milk collection, producer payments, accounts and statutory reports — in one place, built for co-operative societies.</p>

            <ul className="lg-features">
              <li>
                <span className="lg-feat-icon">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2h8l-1 5 3 4v9a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-9l3-4z"/><path d="M6 13h12"/></svg>
                </span>
                <div><b>Milk collection &amp; payments</b><span>Shift-wise purchase, rate charts and payment registers</span></div>
              </li>
              <li>
                <span className="lg-feat-icon">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/></svg>
                </span>
                <div><b>Accounts &amp; reports</b><span>Day Book, Cash Book, R&amp;D and final accounts</span></div>
              </li>
              <li>
                <span className="lg-feat-icon">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/><path d="M9 12l2 2 4-4"/></svg>
                </span>
                <div><b>Secure &amp; works offline</b><span>Each society&apos;s data kept separate, with offline sign-in</span></div>
              </li>
            </ul>
          </div>

          <div className="lg-brand-foot">© {new Date().getFullYear()} DairySoft · Dairy Management System</div>
        </div>
      </aside>

      {/* ── Sign-in panel ───────────────────────────────────────── */}
      <main className="lg-main">
        <div className="lg-card">
          <img src="/dairysoft-logo.jpeg" alt="DairySoft" className="lg-logo" />

          <div className="lg-heading">
            <h2>Welcome back</h2>
            <p>Sign in to your society account</p>
          </div>

          <form onSubmit={handleSubmit} className="lg-form" noValidate>
            {!isOnline && (
              <div className="lg-alert lg-alert-warn" role="status">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1l22 22"/><path d="M16.7 11.1A10.9 10.9 0 0 1 19 12.5M5 12.5a10.9 10.9 0 0 1 5.2-2.8M10.7 5.1A16 16 0 0 1 22.6 9M1.4 9a16 16 0 0 1 4.4-2.7M8.5 16.1a5 5 0 0 1 7 0M12 20h.01"/></svg>
                <span><b>Offline mode</b> — using your cached session.</span>
              </div>
            )}
            {error && (
              <div className="lg-alert lg-alert-error" role="alert">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span>{error}</span>
              </div>
            )}

            {/* Society Code */}
            <div className="lg-field">
              <label htmlFor="society-code">Society code</label>
              <div className={`lg-input${codeCompany ? ' is-valid' : ''}${codeError ? ' is-invalid' : ''}`}>
                <svg className="lg-input-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V8l7-5 7 5v13"/><path d="M9 21v-6h6v6"/></svg>
                <input
                  id="society-code"
                  type="text"
                  inputMode="numeric"
                  className="lg-code"
                  value={societyCode}
                  onChange={handleCodeChange}
                  placeholder="e.g. 1001"
                  disabled={loading}
                  autoComplete="off"
                  autoFocus
                  maxLength={6}
                />
                {codeLookingUp && <span className="lg-input-end"><span className="lg-spinner lg-spinner-dark" /></span>}
                {!codeLookingUp && codeCompany && (
                  <span className="lg-input-end lg-ok">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                  </span>
                )}
              </div>
              {codeCompany && (
                <div className="lg-company">
                  <span className="lg-company-name">{codeCompany.companyName}</span>
                  <span className="lg-company-type">
                    {codeCompany.businessTypes?.map(t => t.includes('Dairy') ? 'Dairy' : 'Private').join(', ')}
                  </span>
                </div>
              )}
              {codeError && <p className="lg-hint-error">{codeError}</p>}
            </div>

            <div className="lg-field">
              <label htmlFor="username">Username</label>
              <div className="lg-input">
                <svg className="lg-input-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>
                <input
                  type="text"
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  disabled={loading}
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="lg-field">
              <label htmlFor="password">Password</label>
              <div className="lg-input">
                <svg className="lg-input-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  disabled={loading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="lg-input-end lg-eye"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17.9 17.9A10.4 10.4 0 0 1 12 20c-7 0-11-8-11-8a19.8 19.8 0 0 1 5.1-5.9M9.9 4.2A9.6 9.6 0 0 1 12 4c7 0 11 8 11 8a19.6 19.6 0 0 1-2.2 3.2M14.1 14.1a3 3 0 1 1-4.2-4.2"/><path d="M1 1l22 22"/></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
            </div>

            <button type="submit" className="lg-submit" disabled={loading}>
              {loading ? (<><span className="lg-spinner" /> Signing in…</>) : (
                <>
                  Sign in
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg>
                </>
              )}
            </button>
          </form>

          <p className="lg-help">Trouble signing in? Contact your society administrator.</p>
        </div>
      </main>
    </div>
  );
};

export default Login;
