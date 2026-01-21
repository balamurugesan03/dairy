import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Company from '../models/Company.js';

// Generate JWT token
const signToken = (id, type = 'user') => {
  return jwt.sign({ id, type }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

// Create and send token response
const createSendToken = (user, statusCode, res, type = 'user', companyData = null) => {
  const token = signToken(user._id, type);

  // Remove password from output
  user.password = undefined;

  const userData = {
    ...user.toObject(),
    role: type === 'company' ? 'admin' : user.role
  };

  // Add permissions object for easy frontend access
  if (user.permissions && user.permissions.length > 0) {
    const permObj = {};
    user.permissions.forEach(p => {
      permObj[p.module] = {
        read: p.read,
        write: p.write,
        edit: p.edit,
        delete: p.delete
      };
    });
    userData.permissionsObject = permObj;
  }

  // Include company info if available
  if (companyData) {
    userData.companyInfo = companyData;
  }

  res.status(statusCode).json({
    success: true,
    token,
    data: {
      user: userData
    }
  });
};

// Login - supports Company (admin), User (company users), and Superadmin
export const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Check if username and password exist
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide username and password'
      });
    }

    // First try to find in Company model (company admin login)
    const company = await Company.findOne({ username: username.toLowerCase() })
      .select('+password');

    if (company) {
      // Check password
      if (!(await company.comparePassword(password))) {
        return res.status(401).json({
          success: false,
          message: 'Incorrect username or password'
        });
      }

      // Check if company is active
      if (company.status !== 'Active') {
        return res.status(401).json({
          success: false,
          message: 'Your company account has been deactivated. Please contact administrator.'
        });
      }

      // Send token for company admin
      return createSendToken(company, 200, res, 'company', {
        _id: company._id,
        companyName: company.companyName,
        businessTypes: company.businessTypes
      });
    }

    // If not found in Company, try User model
    let user = await User.findOne({ username: username.toLowerCase() })
      .select('+password')
      .populate('company', 'companyName businessTypes status');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Incorrect username or password'
      });
    }

    // Check password
    if (!(await user.comparePassword(password))) {
      return res.status(401).json({
        success: false,
        message: 'Incorrect username or password'
      });
    }

    // Check if user is active
    if (user.status !== 'active') {
      return res.status(401).json({
        success: false,
        message: 'Your account has been deactivated. Please contact administrator.'
      });
    }

    // For non-superadmin users, check if their company is active
    if (user.role !== 'superadmin' && user.company) {
      if (user.company.status !== 'Active') {
        return res.status(401).json({
          success: false,
          message: 'Your company has been deactivated. Please contact administrator.'
        });
      }
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    // Prepare company data for response
    let companyData = null;
    if (user.company) {
      companyData = {
        _id: user.company._id,
        companyName: user.company.companyName,
        businessTypes: user.company.businessTypes
      };
    }

    // Send token
    return createSendToken(user, 200, res, 'user', companyData);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Error logging in',
      error: error.message
    });
  }
};

// Get current user
export const getMe = async (req, res) => {
  try {
    // req.user is set by auth middleware and includes the type
    let userData = req.user;

    const userObj = {
      ...userData.toObject(),
      role: req.userType === 'company' ? 'admin' : userData.role
    };

    // Add permissions object for easy frontend access
    if (userData.permissions && userData.permissions.length > 0) {
      const permObj = {};
      userData.permissions.forEach(p => {
        permObj[p.module] = {
          read: p.read,
          write: p.write,
          edit: p.edit,
          delete: p.delete
        };
      });
      userObj.permissionsObject = permObj;
    }

    // If it's a company login, add company info
    if (req.userType === 'company') {
      userObj.companyInfo = {
        _id: userData._id,
        companyName: userData.companyName,
        businessTypes: userData.businessTypes
      };
    } else if (userData.company) {
      // If it's a user with a company, fetch company details
      const companyData = await Company.findById(userData.company)
        .select('companyName businessTypes');
      if (companyData) {
        userObj.companyInfo = {
          _id: companyData._id,
          companyName: companyData.companyName,
          businessTypes: companyData.businessTypes
        };
      }
    }

    res.status(200).json({
      success: true,
      data: {
        user: userObj
      }
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user data',
      error: error.message
    });
  }
};

// Change own password
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide current password and new password'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters'
      });
    }

    // Get user with password
    const user = await User.findById(req.user._id).select('+password');

    // Check current password
    if (!(await user.comparePassword(currentPassword))) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Send new token
    createSendToken(user, 200, res);
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error changing password',
      error: error.message
    });
  }
};

// Create user (superadmin only)
export const createUser = async (req, res) => {
  try {
    const { username, password, displayName, role, company, status } = req.body;

    // Validate required fields
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    // Check if username already exists
    const existingUser = await User.findOne({ username: username.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Username already exists'
      });
    }

    // Company admin must have a company
    if (role === 'admin' && !company) {
      return res.status(400).json({
        success: false,
        message: 'Company is required for admin users'
      });
    }

    const newUser = await User.create({
      username,
      password,
      displayName: displayName || username,
      role: role || 'admin',
      company: role === 'superadmin' ? undefined : company,
      status: status || 'active'
    });

    // Remove password from response
    newUser.password = undefined;

    res.status(201).json({
      success: true,
      data: {
        user: newUser
      }
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating user',
      error: error.message
    });
  }
};

// Get all users (superadmin only)
export const getAllUsers = async (req, res) => {
  try {
    const { role, company, status, search } = req.query;

    const query = {};

    if (role) query.role = role;
    if (company) query.company = company;
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { displayName: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .populate('company', 'companyName')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching users',
      error: error.message
    });
  }
};

// Get single user (superadmin only)
export const getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate('company');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        user
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user',
      error: error.message
    });
  }
};

// Update user (superadmin only)
export const updateUser = async (req, res) => {
  try {
    const { username, displayName, role, company, status } = req.body;

    // Don't allow password update through this route
    if (req.body.password) {
      return res.status(400).json({
        success: false,
        message: 'Use reset password route to change password'
      });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if new username already exists
    if (username && username !== user.username) {
      const existingUser = await User.findOne({ username: username.toLowerCase() });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Username already exists'
        });
      }
    }

    // Update fields
    if (username) user.username = username;
    if (displayName) user.displayName = displayName;
    if (role) user.role = role;
    if (status) user.status = status;

    // Update company (or remove for superadmin)
    if (role === 'superadmin') {
      user.company = undefined;
    } else if (company) {
      user.company = company;
    }

    await user.save({ validateBeforeSave: false });

    const updatedUser = await User.findById(user._id).populate('company');

    res.status(200).json({
      success: true,
      data: {
        user: updatedUser
      }
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating user',
      error: error.message
    });
  }
};

// Reset user password (superadmin only)
export const resetUserPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters'
      });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error resetting password',
      error: error.message
    });
  }
};

// Delete user (soft delete - set inactive)
export const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Don't allow deleting yourself
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account'
      });
    }

    // Soft delete - set status to inactive
    user.status = 'inactive';
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      message: 'User deactivated successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting user',
      error: error.message
    });
  }
};

export default {
  login,
  getMe,
  changePassword,
  createUser,
  getAllUsers,
  getUser,
  updateUser,
  resetUserPassword,
  deleteUser
};
