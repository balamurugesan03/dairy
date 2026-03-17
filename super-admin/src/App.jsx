import { useState, useEffect } from 'react';
import Login from './Login';
import Dashboard from './Dashboard';

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('sa_token');
    const saved  = localStorage.getItem('sa_user');
    if (token && saved) {
      try {
        const u = JSON.parse(saved);
        if (u.role === 'superadmin') { setUser(u); }
      } catch {}
    }
    setChecking(false);
  }, []);

  const handleLogin = (token, userData) => {
    localStorage.setItem('sa_token', token);
    localStorage.setItem('sa_user', JSON.stringify(userData));
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('sa_token');
    localStorage.removeItem('sa_user');
    setUser(null);
  };

  if (checking) return null;

  return user
    ? <Dashboard user={user} onLogout={handleLogout} />
    : <Login onLogin={handleLogin} />;
}
