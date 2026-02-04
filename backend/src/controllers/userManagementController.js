import User from '../models/User.js';
import Company from '../models/Company.js';

// Get all users for a company (company admin)
export const getCompanyUsers = async (req, res) => {
  try {
    const companyId = req.userCompany;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company not found'
      });
    }

    const { status, designation, search } = req.query;

    const query = { company: companyId };

    if (status) query.status = status;
    if (designation) query.designation = designation;
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { displayName: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    console.error('Get company users error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching users',
      error: error.message
    });
  }
};

// Get single user (company admin)
export const getCompanyUser = async (req, res) => {
  try {
    const companyId = req.userCompany;
    const userId = req.params.id;

    const user = await User.findOne({
      _id: userId,
      company: companyId
    }).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: { user }
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

// Create user for company (company admin)
export const createCompanyUser = async (req, res) => {
  try {
    const companyId = req.userCompany;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company not found'
      });
    }

    const {
      username,
      password,
      displayName,
      userType,
      designation,
      phone,
      email,
      permissions,
      joiningDate,
      expireDate
    } = req.body;

    // Validate required fields
    if (!username || !password || !displayName) {
      return res.status(400).json({
        success: false,
        message: 'Username, password, and display name are required'
      });
    }

    // Check if username already exists
    const existingUser = await User.findOne({ username: username.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Username already exists. Please choose a different username.'
      });
    }

    // Also check if username exists in Company model
    const existingCompany = await Company.findOne({ username: username.toLowerCase() });
    if (existingCompany) {
      return res.status(400).json({
        success: false,
        message: 'Username already exists. Please choose a different username.'
      });
    }

    // Set default permissions if not provided
    const userPermissions = permissions || User.getDefaultPermissions();

    const newUser = await User.create({
      username,
      password,
      displayName,
      userType: userType || 'ordinary',
      designation: designation || 'Other',
      role: 'user',
      company: companyId,
      phone,
      email,
      permissions: userPermissions,
      joiningDate: joiningDate || null,
      expireDate: expireDate || null,
      status: 'active'
    });

    // Remove password from response
    newUser.password = undefined;

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: { user: newUser }
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

// Update user (company admin)
export const updateCompanyUser = async (req, res) => {
  try {
    const companyId = req.userCompany;
    const userId = req.params.id;

    const user = await User.findOne({
      _id: userId,
      company: companyId
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const {
      username,
      displayName,
      userType,
      designation,
      phone,
      email,
      permissions,
      status,
      joiningDate,
      expireDate
    } = req.body;

    // Check if new username already exists
    if (username && username.toLowerCase() !== user.username) {
      const existingUser = await User.findOne({
        username: username.toLowerCase(),
        _id: { $ne: userId }
      });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Username already exists'
        });
      }

      // Also check Company model
      const existingCompany = await Company.findOne({ username: username.toLowerCase() });
      if (existingCompany) {
        return res.status(400).json({
          success: false,
          message: 'Username already exists'
        });
      }
    }

    // Update fields
    if (username) user.username = username;
    if (displayName) user.displayName = displayName;
    if (userType) user.userType = userType;
    if (designation) user.designation = designation;
    if (phone !== undefined) user.phone = phone;
    if (email !== undefined) user.email = email;
    if (permissions) user.permissions = permissions;
    if (status) user.status = status;
    if (joiningDate !== undefined) user.joiningDate = joiningDate || null;
    if (expireDate !== undefined) user.expireDate = expireDate || null;

    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: { user }
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

// Reset user password (company admin)
export const resetCompanyUserPassword = async (req, res) => {
  try {
    const companyId = req.userCompany;
    const userId = req.params.id;

    const user = await User.findOne({
      _id: userId,
      company: companyId
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters'
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

// Delete/Deactivate user (company admin)
export const deleteCompanyUser = async (req, res) => {
  try {
    const companyId = req.userCompany;
    const userId = req.params.id;

    const user = await User.findOne({
      _id: userId,
      company: companyId
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
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
      message: 'Error deactivating user',
      error: error.message
    });
  }
};

// Get available modules list
export const getModulesList = async (req, res) => {
  try {
    const modules = User.getModules();

    // Return modules with display names
    const modulesWithLabels = modules.map(module => ({
      value: module,
      label: module.charAt(0).toUpperCase() + module.slice(1).replace(/([A-Z])/g, ' $1')
    }));

    res.status(200).json({
      success: true,
      data: modulesWithLabels
    });
  } catch (error) {
    console.error('Get modules error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching modules',
      error: error.message
    });
  }
};

// Get designations list
export const getDesignationsList = async (req, res) => {
  try {
    const designations = [
      { value: 'Secretary', label: 'Secretary' },
      { value: 'Assistant Secretary', label: 'Assistant Secretary' },
      { value: 'Attender', label: 'Attender' },
      { value: 'Auditor', label: 'Auditor' },
      { value: 'Branch Supervisor', label: 'Branch Supervisor' },
      { value: 'Cleaner', label: 'Cleaner' },
      { value: 'Dairy Department', label: 'Dairy Department' },
      { value: 'Data Entry Operator', label: 'Data Entry Operator' },
      { value: 'Junior Clerk', label: 'Junior Clerk' },
      { value: 'Officer', label: 'Officer' },
      { value: 'Lab Assistant', label: 'Lab Assistant' },
      { value: 'Lab Technician', label: 'Lab Technician' },
      { value: 'Milma', label: 'Milma' },
      { value: 'Peon', label: 'Peon' },
      { value: 'Plant Operator', label: 'Plant Operator' },
      { value: 'President', label: 'President' },
      { value: 'Procurement Assistant', label: 'Procurement Assistant' },
      { value: 'Sales Man', label: 'Sales Man' },
      { value: 'Senior Clerk', label: 'Senior Clerk' },
      { value: 'System Administrator', label: 'System Administrator' },
      { value: 'Technical Supervisor', label: 'Technical Supervisor' },
      { value: 'Other', label: 'Other' }
    ];

    res.status(200).json({
      success: true,
      data: designations
    });
  } catch (error) {
    console.error('Get designations error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching designations',
      error: error.message
    });
  }
};

// Get user types list
export const getUserTypesList = async (req, res) => {
  try {
    const userTypes = [
      { value: 'auditor', label: 'Auditor' },
      { value: 'dairy_department', label: 'Dairy Department' },
      { value: 'society', label: 'Society' },
      { value: 'milma', label: 'Milma' },
      { value: 'president', label: 'President' },
      { value: 'superuser', label: 'Superuser' },
      { value: 'admin', label: 'Admin' },
      { value: 'ordinary', label: 'Ordinary' }
    ];

    res.status(200).json({
      success: true,
      data: userTypes
    });
  } catch (error) {
    console.error('Get user types error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user types',
      error: error.message
    });
  }
};

export default {
  getCompanyUsers,
  getCompanyUser,
  createCompanyUser,
  updateCompanyUser,
  resetCompanyUserPassword,
  deleteCompanyUser,
  getModulesList,
  getDesignationsList,
  getUserTypesList
};
