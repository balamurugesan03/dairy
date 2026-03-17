import { useState } from 'react';
import { authAPI } from './api';
import './Login.css';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!username || !password) { setError('Enter username and password'); return; }
    setLoading(true);
    try {
      const res = await authAPI.login({ username: username.trim().toLowerCase(), password });
      if (!res.success) { setError(res.message || 'Login failed'); return; }
      if (res.data?.user?.role !== 'superadmin') {
        setError('Access denied. Super Admin only.');
        return;
      }
      // Response shape: { success, token, data: { user } }
      onLogin(res.token, res.data.user);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sa-login-page">
      <div className="sa-login-card">
        <div className="sa-login-icon">🛡️</div>
        <h1>Super Admin</h1>
        <p className="sa-login-sub">Dairy Society ERP — Admin Panel</p>

        {error && <div className="sa-error">{error}</div>}

        <form onSubmit={handleSubmit} className="sa-login-form">
          <div className="sa-field">
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="superadmin"
              autoFocus
            />
          </div>
          <div className="sa-field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <button type="submit" className="sa-btn-login" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
