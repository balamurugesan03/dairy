import Designation from '../models/Designation.js';
import Employee from '../models/Employee.js';

// Create new designation
export const createDesignation = async (req, res) => {
  try {
    const { name, code } = req.body;

    // Check if designation name already exists
    const existingName = await Designation.findOne({ name });
    if (existingName) {
      return res.status(400).json({
        success: false,
        message: 'Designation name already exists'
      });
    }

    // Check if designation code already exists
    const existingCode = await Designation.findOne({ code });
    if (existingCode) {
      return res.status(400).json({
        success: false,
        message: 'Designation code already exists'
      });
    }

    const designation = new Designation(req.body);
    await designation.save();

    if (designation.department) {
      await designation.populate('department');
    }

    res.status(201).json({
      success: true,
      message: 'Designation created successfully',
      data: designation
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get all designations
export const getAllDesignations = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      status = '',
      department = '',
      level = ''
    } = req.query;

    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } }
      ];
    }

    if (status) query.status = status;
    if (department) query.department = department;
    if (level) query.level = level;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const designations = await Designation.find(query)
      .sort({ name: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('department');

    const total = await Designation.countDocuments(query);

    res.status(200).json({
      success: true,
      data: designations,
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

// Get designation by ID
export const getDesignationById = async (req, res) => {
  try {
    const designation = await Designation.findById(req.params.id)
      .populate('department');

    if (!designation) {
      return res.status(404).json({
        success: false,
        message: 'Designation not found'
      });
    }

    // Get employees with this designation
    const employees = await Employee.find({
      'employmentDetails.designation': req.params.id,
      'employmentDetails.status': 'Active'
    }).select('employeeNumber personalDetails.name employmentDetails.department');

    res.status(200).json({
      success: true,
      data: {
        ...designation.toObject(),
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

// Update designation
export const updateDesignation = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code } = req.body;

    const designation = await Designation.findById(id);
    if (!designation) {
      return res.status(404).json({
        success: false,
        message: 'Designation not found'
      });
    }

    // Check if name is being changed and if it already exists
    if (name && name !== designation.name) {
      const existingName = await Designation.findOne({ name, _id: { $ne: id } });
      if (existingName) {
        return res.status(400).json({
          success: false,
          message: 'Designation name already exists'
        });
      }
    }

    // Check if code is being changed and if it already exists
    if (code && code !== designation.code) {
      const existingCode = await Designation.findOne({ code, _id: { $ne: id } });
      if (existingCode) {
        return res.status(400).json({
          success: false,
          message: 'Designation code already exists'
        });
      }
    }

    const updatedDesignation = await Designation.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true }
    ).populate('department');

    res.status(200).json({
      success: true,
      message: 'Designation updated successfully',
      data: updatedDesignation
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Delete designation
export const deleteDesignation = async (req, res) => {
  try {
    const designation = await Designation.findById(req.params.id);

    if (!designation) {
      return res.status(404).json({
        success: false,
        message: 'Designation not found'
      });
    }

    // Check if there are employees with this designation
    const employeeCount = await Employee.countDocuments({
      'employmentDetails.designation': req.params.id,
      'employmentDetails.status': 'Active'
    });

    if (employeeCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete designation with ${employeeCount} active employees`
      });
    }

    // Soft delete - change status to Inactive
    designation.status = 'Inactive';
    await designation.save();

    res.status(200).json({
      success: true,
      message: 'Designation deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get active designations
export const getActiveDesignations = async (req, res) => {
  try {
    const { department = '' } = req.query;

    let designations;
    if (department) {
      designations = await Designation.findByDepartment(department)
        .sort({ name: 1 })
        .select('name code level salaryRange');
    } else {
      designations = await Designation.findActive()
        .sort({ name: 1 })
        .select('name code level salaryRange')
        .populate('department', 'name');
    }

    res.status(200).json({
      success: true,
      data: designations
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
