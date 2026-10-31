import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';
import { isSuperAdminAccount, isAdminTierAccount, canManageUsersAccount, hasModulePermission } from '../utils/modulePermissions';

const AuthContext = createContext();
const OFFLINE_SESSION_KEY = 'dairy_offline_session';

// Same rule as backend utils/milkScope.js isAdminUser (centre logins are never admin)
const ADMIN_USER_TYPES = ['admin', 'superuser'];
export const isAdminAccount = (u) => !!u && u.loginType !== 'centre' && (
  u.loginType === 'company' || u.role === 'admin' || u.role === 'superadmin' || ADMIN_USER_TYPES.includes(u.userType)
);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const getCachedSession = () => {
  try { return JSON.parse(localStorage.getItem(OFFLINE_SESSION_KEY) || 'null'); }
  catch { return null; }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('authToken'));
  const [loading, setLoading] = useState(true);

  // Check token on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const savedToken = localStorage.getItem('authToken');
    if (!savedToken) { setLoading(false); return; }

    // Offline — restore from cached session
    if (!navigator.onLine) {
      const cached = getCachedSession();
      if (cached?.user) {
        setUser(cached.user);
        setToken(savedToken);
      } else {
        logout();
      }
      setLoading(false);
      return;
    }

    // Online — verify with server; fall back to cache if server unreachable
    try {
      const response = await authAPI.getMe();
      if (response.success) {
        setUser(response.data.user);
        setToken(savedToken);
      } else {
        logout();
      }
    } catch {
      const cached = getCachedSession();
      if (cached?.user) {
        setUser(cached.user);
        setToken(savedToken);
      } else {
        logout();
      }
    }
    setLoading(false);
  };

  const login = async (username, password) => {
    // Offline login — restore cached session if username matches
    if (!navigator.onLine) {
      const cached = getCachedSession();
      if (cached && cached.username === username.trim() && cached.token) {
        localStorage.setItem('authToken', cached.token);
        setToken(cached.token);
        setUser(cached.user);
        if (cached.user?.companyInfo) {
          localStorage.setItem('selectedCompanyId', cached.user.companyInfo._id);
          if (cached.user.companyInfo.businessTypes?.length > 0) {
            localStorage.setItem('selectedBusinessType', cached.user.companyInfo.businessTypes[0]);
          }
        }
        return { success: true, user: cached.user, offline: true };
      }
      return { success: false, message: 'No internet — please connect and login at least once first' };
    }

    try {
      const response = await authAPI.login(username, password);
      if (response.success) {
        const { token: newToken, data } = response;
        localStorage.setItem('authToken', newToken);
        setToken(newToken);
        setUser(data.user);

        // Cache session for offline use
        localStorage.setItem(OFFLINE_SESSION_KEY, JSON.stringify({
          username: username.trim(),
          token: newToken,
          user: data.user,
        }));

        // If user has company info, auto-select it
        if (data.user.companyInfo) {
          localStorage.setItem('selectedCompanyId', data.user.companyInfo._id);
          if (data.user.companyInfo.businessTypes?.length > 0) {
            localStorage.setItem('selectedBusinessType', data.user.companyInfo.businessTypes[0]);
          }
        }

        return { success: true, user: data.user };
      }
      return { success: false, message: response.message };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Login failed'
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('selectedCompanyId');
    localStorage.removeItem('selectedBusinessType');
    // Keep OFFLINE_SESSION_KEY so user can log back in offline
    setToken(null);
    setUser(null);
  };

  const changePassword = async (currentPassword, newPassword) => {
    try {
      const response = await authAPI.changePassword(currentPassword, newPassword);
      if (response.success) {
        // Update token after password change
        localStorage.setItem('authToken', response.token);
        setToken(response.token);
        return { success: true };
      }
      return { success: false, message: response.message };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Password change failed'
      };
    }
  };

  const refreshUser = async () => {
    try {
      const response = await authAPI.getMe();
      if (response.success) {
        setUser(response.data.user);
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  };

  // Module permission for an action — Super Admin has all; others what User Management assigned
  // (a sub-screen is also granted by its whole module, see utils/modulePermissions.js)
  const hasPermission = (moduleName, action) => hasModulePermission(user, moduleName, action);

  // Check if user can read a module
  const canRead = (moduleName) => hasPermission(moduleName, 'read');

  // Check if user can write/create in a module
  const canWrite = (moduleName) => hasPermission(moduleName, 'write');

  // Check if user can edit in a module
  const canEdit = (moduleName) => hasPermission(moduleName, 'edit');

  // Check if user can delete in a module
  const canDelete = (moduleName) => hasPermission(moduleName, 'delete');

  // Check if user has any access to a module
  const hasModuleAccess = (moduleName) => hasModulePermission(user, moduleName, 'any');

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!token && !!user,
    isSuperAdmin: user?.role === 'superadmin',
    // Super Admin tier (company login / superadmin / admin account / "Super Admin" user type):
    // the only one who sees the Super Admin-only options
    isSuperAdminLogin: isSuperAdminAccount(user),
    // "Admin" user type from User Management
    isAdminTier: isAdminTierAccount(user),
    // Super Admin + Admin: User Management, create users, assign permissions
    canManageUsers: canManageUsersAccount(user),
    isCompanyAdmin: user?.loginType === 'company',  // logged in via Company credentials
    isCentreLogin: user?.loginType === 'centre',     // logged in as a sub-centre
    isAdmin: user?.role === 'admin' || user?.role === 'superadmin',
    isUser: user?.role === 'user',
    userCompany: user?.company || user?.companyInfo?._id,
    companyInfo: user?.companyInfo,
    centreInfo: user?.loginType === 'centre' ? user?.companyInfo : null,
    allowedModules: user?.loginType === 'centre' ? (user?.companyInfo?.allowedModules || []) : null,
    designation: user?.designation,
    permissions: user?.permissionsObject || {},
    userCenter: user?.collectionCenter || null,
    userAgent: user?.agentId || null,
    // Admin = company login, admin-role account, or a User Management user of type Admin / Superuser:
    // their own Center / Agent is only the default — other centres / agents stay selectable
    isAdminLogin: isAdminAccount(user),
    // Ordinary user login: restricted to the Center / Agent assigned in User Management
    isStaffUser: user?.loginType === 'user' && !isAdminAccount(user),
    // Society agent login: a non-admin User linked to an Agent — Sender Agent is fixed to them
    isAgentLogin: user?.loginType === 'user' && !isAdminAccount(user) && !!user?.agentId,
    // Permission helper functions
    hasPermission,
    canRead,
    canWrite,
    canEdit,
    canDelete,
    hasModuleAccess,
    // Auth functions
    login,
    logout,
    changePassword,
    refreshUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
