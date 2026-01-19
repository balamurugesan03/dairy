import Department from '../models/Department.js';
import Employee from '../models/Employee.js';

// Create new department
export const createDepartment = async (req, res) => {
  try {
    const { name, code } = req.body;

    // Check if department name already exists
    const existingName = await Department.findOne({ name });
    if (existingName) {
      return res.status(400).json({
        success: false,
        message: 'Department name already exists'
      });
    }

    // Check if department code already exists
    const existingCode = await Department.findOne({ code });
    if (existingCode) {
      return res.status(400).json({
        success: false,
        message: 'Department code already exists'
      });
    }

    const department = new Department(req.body);
    await department.save();

    if (department.headOfDepartment) {
      await department.populate('headOfDepartment');
    }

    res.status(201).json({
      success: true,
      message: 'Department created successfully',
      data: department
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get all departments
export const getAllDepartments = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      status = ''
    } = req.query;

    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } }
      ];
    }

    if (status) {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const departments = await Department.find(query)
      .sort({ name: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('headOfDepartment');

    const total = await Department.countDocuments(query);

    res.status(200).json({
      success: true,
      data: departments,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get department by ID
export const getDepartmentById = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id)
      .populate('headOfDepartment');

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }

    // Get employees in this department
    const employees = await Employee.find({
      'employmentDetails.department': req.params.id,
      'employmentDetails.status': 'Active'
    }).select('employeeNumber personalDetails.name employmentDetails.designation');

    res.status(200).json({
      success: true,
      data: {
        ...department.toObject(),
        employees
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update department
export const updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code } = req.body;

    const department = await Department.findById(id);
    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }

    // Check if name is being changed and if it already exists
    if (name && name !== department.name) {
      const existingName = await Department.findOne({ name, _id: { $ne: id } });
      if (existingName) {
        return res.status(400).json({
          success: false,
          message: 'Department name already exists'
        });
      }
    }

    // Check if code is being changed and if it already exists
    if (code && code !== department.code) {
      const existingCode = await Department.findOne({ code, _id: { $ne: id } });
      if (existingCode) {
        return res.status(400).json({
          success: false,
          message: 'Department code already exists'
        });
      }
    }

    const updatedDepartment = await Department.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true }
    ).populate('headOfDepartment');

    res.status(200).json({
      success: true,
      message: 'Department updated successfully',
      data: updatedDepartment
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Delete department
export const deleteDepartment = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }

    // Check if there are employees in this department
    const employeeCount = await Employee.countDocuments({
      'employmentDetails.department': req.params.id,
      'employmentDetails.status': 'Active'
    });

    if (employeeCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete department with ${employeeCount} active employees`
      });
    }

    // Soft delete - change status to Inactive
    department.status = 'Inactive';
    await department.save();

    res.status(200).json({
      success: true,
      message: 'Department deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get active departments
export const getActiveDepartments = async (req, res) => {
  try {
    const departments = await Department.findActive()
      .sort({ name: 1 })
      .select('name code');

    res.status(200).json({
      success: true,
      data: departments
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
