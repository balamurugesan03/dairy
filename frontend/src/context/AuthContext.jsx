import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
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
    if (savedToken) {
      try {
        const response = await authAPI.getMe();
        if (response.success) {
          setUser(response.data.user);
          setToken(savedToken);
        } else {
          logout();
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        logout();
      }
    }
    setLoading(false);
  };

  const login = async (username, password) => {
    try {
      const response = await authAPI.login(username, password);
      if (response.success) {
        const { token: newToken, data } = response;
        localStorage.setItem('authToken', newToken);
        setToken(newToken);
        setUser(data.user);

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

  // Check if user has permission for a module action
  const hasPermission = (moduleName, action) => {
    if (!user) return false;

    // Superadmin and admin have all permissions
    if (user.role === 'superadmin' || user.role === 'admin') {
      return true;
    }

    // Check permissions object
    if (user.permissionsObject && user.permissionsObject[moduleName]) {
      return user.permissionsObject[moduleName][action] === true;
    }

    return false;
  };

  // Check if user can read a module
  const canRead = (moduleName) => hasPermission(moduleName, 'read');

  // Check if user can write/create in a module
  const canWrite = (moduleName) => hasPermission(moduleName, 'write');

  // Check if user can edit in a module
  const canEdit = (moduleName) => hasPermission(moduleName, 'edit');

  // Check if user can delete in a module
  const canDelete = (moduleName) => hasPermission(moduleName, 'delete');

  // Check if user has any access to a module
  const hasModuleAccess = (moduleName) => {
    if (!user) return false;
    if (user.role === 'superadmin' || user.role === 'admin') return true;

    if (user.permissionsObject && user.permissionsObject[moduleName]) {
      const perms = user.permissionsObject[moduleName];
      return perms.read || perms.write || perms.edit || perms.delete;
    }
    return false;
  };

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!token && !!user,
    isSuperAdmin: user?.role === 'superadmin',
    isAdmin: user?.role === 'admin' || user?.role === 'superadmin',
    isUser: user?.role === 'user',
    userCompany: user?.company || user?.companyInfo?._id,
    companyInfo: user?.companyInfo,
    designation: user?.designation,
    permissions: user?.permissionsObject || {},
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
