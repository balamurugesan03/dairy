import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * AdminOnlyGuard
 *
 * Wraps a group of routes so they are only reachable by admin accounts (company
 * login, admin / superadmin, or a User Management user of type Admin / Superuser) —
 * or, when `perm` is given, by a user granted that module in User Management
 * (e.g. perm="settings.societyInfo"). Others are redirected to the dashboard even
 * if they type the URL — the matching menu link is already hidden in MainLayout.
 *
 * Usage in App.jsx:
 *   <Route element={<AdminOnlyGuard perm="settings.financialYear" />}>
 *     ... child routes ...
 *   </Route>
 */
export default function AdminOnlyGuard({ perm }) {
  const { isAdminLogin, hasModuleAccess } = useAuth();

  if (!isAdminLogin && !(perm && hasModuleAccess(perm))) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
