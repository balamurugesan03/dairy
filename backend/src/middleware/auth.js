import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Company from '../models/Company.js';

// Protect routes - verify JWT token
export const protect = async (req, res, next) => {
  try {
    let token;

    // Check for token in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'You are not logged in. Please log in to get access.'
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token. Please log in again.'
        });
      }
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Your token has expired. Please log in again.'
        });
      }
      throw err;
    }

    // Ensure decoded has required fields
    if (!decoded || !decoded.id) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token format. Please log in again.'
      });
    }

    let currentUser;
    const tokenType = decoded.type || 'user';

    if (tokenType === 'company') {
      // Token is for a Company
      currentUser = await Company.findById(decoded.id);
      if (!currentUser) {
        return res.status(401).json({
          success: false,
          message: 'The company belonging to this token no longer exists.'
        });
      }

      // Check if company is active
      if (currentUser.status !== 'Active') {
        return res.status(401).json({
          success: false,
          message: 'Your company account has been deactivated. Please contact administrator.'
        });
      }

      req.userType = 'company';
      req.user = currentUser;
      // For company users, set their role as admin
      req.user.role = 'admin';
    } else {
      // Token is for a User (superadmin or admin)
      currentUser = await User.findById(decoded.id);
      if (!currentUser) {
        return res.status(401).json({
          success: false,
          message: 'The user belonging to this token no longer exists.'
        });
      }

      // Check if user is active
      if (currentUser.status !== 'active') {
        return res.status(401).json({
          success: false,
          message: 'Your account has been deactivated. Please contact administrator.'
        });
      }

      // Check if user changed password after token was issued
      if (typeof currentUser.changedPasswordAfter === 'function' && currentUser.changedPasswordAfter(decoded.iat)) {
        return res.status(401).json({
          success: false,
          message: 'User recently changed password. Please log in again.'
        });
      }

      req.userType = 'user';
      req.user = currentUser;
    }

    // Final check - ensure user is set
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication failed. Please log in again.'
      });
    }

    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message, error.stack);
    return res.status(500).json({
      success: false,
      message: 'Authentication error: ' + error.message
    });
  }
};

// Restrict access to specific roles
export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action'
      });
    }
    next();
  };
};

// Add company filter for multi-tenant data isolation
export const addCompanyFilter = (req, res, next) => {
  // Check if user exists
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  // Super admin can access all data or filter by selected company
  if (req.user.role === 'superadmin') {
    // If superadmin provides a company filter in query, use it
    if (req.query.company) {
      req.companyFilter = { company: req.query.company };
    } else {
      // No filter for superadmin - can see all
      req.companyFilter = {};
    }
    // Set company for creating new records if provided
    if (req.body && req.body.company) {
      req.userCompany = req.body.company;
    }
  } else if (req.userType === 'company') {
    // Company user - filter by their own company ID
    req.companyFilter = { company: req.user._id };
    req.userCompany = req.user._id;
  } else {
    // Regular admin user with company reference
    if (!req.user || !req.user.company) {
      return res.status(403).json({
        success: false,
        message: 'No company assigned to your account. Please contact administrator.'
      });
    }
    const companyId = req.user.company._id || req.user.company;
    req.companyFilter = { company: companyId };
    req.userCompany = companyId;
  }

  next();
};

// Optional auth - doesn't require auth but attaches user if token present
export const optionalAuth = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const currentUser = await User.findById(decoded.id).populate('company');
      if (currentUser && currentUser.status === 'active') {
        req.user = currentUser;
      }
    }

    next();
  } catch (error) {
    // Continue without user if token is invalid
    next();
  }
};

// Check module permission
export const checkPermission = (moduleName, action) => {
  return (req, res, next) => {
    // Superadmin and admin have all permissions
    if (req.user.role === 'superadmin' || req.user.role === 'admin') {
      return next();
    }

    // For company login (direct company login), treat as admin
    if (req.userType === 'company') {
      return next();
    }

    // Check user permissions
    if (!req.user.permissions || req.user.permissions.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'No permissions assigned. Please contact administrator.'
      });
    }

    const modulePermission = req.user.permissions.find(p => p.module === moduleName);

    if (!modulePermission) {
      return res.status(403).json({
        success: false,
        message: `No access to ${moduleName} module`
      });
    }

    if (!modulePermission[action]) {
      return res.status(403).json({
        success: false,
        message: `You don't have ${action} permission for ${moduleName}`
      });
    }

    next();
  };
};

// Check if user is admin (company admin or superadmin)
export const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'superadmin' && req.user.role !== 'admin' && req.userType !== 'company') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
  next();
};

export default { protect, restrictTo, addCompanyFilter, optionalAuth, checkPermission, requireAdmin };
