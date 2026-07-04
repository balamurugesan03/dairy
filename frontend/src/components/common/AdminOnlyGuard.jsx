import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * AdminOnlyGuard
 *
 * Wraps a group of routes so they are only reachable by admin/superadmin
 * accounts. Restricted (newly created, role 'user') accounts are redirected
 * to the dashboard even if they navigate to the URL directly — the matching
 * menu link is already hidden for them in MainLayout.
 *
 * Usage in App.jsx:
 *   <Route element={<AdminOnlyGuard />}>
 *     ... admin-only child routes ...
 *   </Route>
 */
export default function AdminOnlyGuard() {
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
