import { Outlet, Navigate } from 'react-router-dom';
import { useCompany } from '../../context/CompanyContext';

/**
 * BusinessTypeGuard
 *
 * Wraps a group of routes so they are only accessible when the user's
 * currently selected business type matches `requiredType`.
 *
 * Usage in App.jsx:
 *   <Route element={<BusinessTypeGuard requiredType="Dairy Cooperative Society" />}>
 *     ... dairy-only child routes ...
 *   </Route>
 *
 * Any attempt to reach a guarded route with the wrong business type
 * silently redirects to the dashboard ("/").
 */
export default function BusinessTypeGuard({ requiredType }) {
  const { selectedBusinessType } = useCompany();

  if (selectedBusinessType !== requiredType) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
