import Employee from '../models/Employee.js';
import Department from '../models/Department.js';
import Designation from '../models/Designation.js';

// Create new employee
export const createEmployee = async (req, res) => {
  try {
    const { employeeNumber, personalDetails } = req.body;

    // Check if employee number already exists
    const existingEmployee = await Employee.findOne({ employeeNumber });
    if (existingEmployee) {
      return res.status(400).json({
        success: false,
        message: 'Employee number already exists'
      });
    }

    // Check if phone number already exists
    if (personalDetails?.phone) {
      const existingPhone = await Employee.findOne({ 'personalDetails.phone': personalDetails.phone });
      if (existingPhone) {
        return res.status(400).json({
          success: false,
          message: 'Phone number already exists'
        });
      }
    }

    // Create new employee
    const employee = new Employee(req.body);
    await employee.save();

    // Populate references
    await employee.populate('employmentDetails.designation employmentDetails.department employmentDetails.reportingTo');

    // Update employee count in department and designation
    if (employee.employmentDetails.department) {
      await Department.findByIdAndUpdate(
        employee.employmentDetails.department,
        { $inc: { employeeCount: 1 } }
      );
    }
    if (employee.employmentDetails.designation) {
      await Designation.findByIdAndUpdate(
        employee.employmentDetails.designation,
        { $inc: { employeeCount: 1 } }
      );
    }

    res.status(201).json({
      success: true,
      message: 'Employee created successfully',
      data: employee
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get all employees with pagination and filters
export const getAllEmployees = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      status = '',
      department = '',
      designation = '',
      employmentType = '',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};

    // Search across multiple fields
    if (search) {
      query.$or = [
        { employeeNumber: { $regex: search, $options: 'i' } },
        { 'personalDetails.name': { $regex: search, $options: 'i' } },
        { 'personalDetails.phone': { $regex: search, $options: 'i' } },
        { 'personalDetails.email': { $regex: search, $options: 'i' } }
      ];
    }

    // Apply filters
    if (status) {
      query['employmentDetails.status'] = status;
    }
    if (department) {
      query['employmentDetails.department'] = department;
    }
    if (designation) {
      query['employmentDetails.designation'] = designation;
    }
    if (employmentType) {
      query['employmentDetails.employmentType'] = employmentType;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const employees = await Employee.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('employmentDetails.designation employmentDetails.department employmentDetails.reportingTo');

    const total = await Employee.countDocuments(query);

    // Calculate statistics
    const stats = {
      total,
      active: await Employee.countDocuments({ ...query, 'employmentDetails.status': 'Active' }),
      inactive: await Employee.countDocuments({ ...query, 'employmentDetails.status': 'Inactive' }),
      onLeave: await Employee.countDocuments({ ...query, 'employmentDetails.status': 'On Leave' })
    };

    res.status(200).json({
      success: true,
      data: employees,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        limit: parseInt(limit)
      },
      statistics: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get employee by ID
export const getEmployeeById = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id)
      .populate('employmentDetails.designation employmentDetails.department employmentDetails.reportingTo');

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    res.status(200).json({
      success: true,
      data: employee
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update employee
export const updateEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const { employeeNumber, personalDetails } = req.body;

    // Check if employee exists
    const employee = await Employee.findById(id);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Check if employee number is being changed and if it already exists
    if (employeeNumber && employeeNumber !== employee.employeeNumber) {
      const existingEmployee = await Employee.findOne({ employeeNumber, _id: { $ne: id } });
      if (existingEmployee) {
        return res.status(400).json({
          success: false,
          message: 'Employee number already exists'
        });
      }
    }

    // Check if phone number is being changed and if it already exists
    if (personalDetails?.phone && personalDetails.phone !== employee.personalDetails.phone) {
      const existingPhone = await Employee.findOne({
        'personalDetails.phone': personalDetails.phone,
        _id: { $ne: id }
      });
      if (existingPhone) {
        return res.status(400).json({
          success: false,
          message: 'Phone number already exists'
        });
      }
    }

    // Update department and designation counts if changed
    const oldDepartment = employee.employmentDetails.department;
    const oldDesignation = employee.employmentDetails.designation;
    const newDepartment = req.body.employmentDetails?.department;
    const newDesignation = req.body.employmentDetails?.designation;

    if (oldDepartment && newDepartment && oldDepartment.toString() !== newDepartment.toString()) {
      await Department.findByIdAndUpdate(oldDepartment, { $inc: { employeeCount: -1 } });
      await Department.findByIdAndUpdate(newDepartment, { $inc: { employeeCount: 1 } });
    }

    if (oldDesignation && newDesignation && oldDesignation.toString() !== newDesignation.toString()) {
      await Designation.findByIdAndUpdate(oldDesignation, { $inc: { employeeCount: -1 } });
      await Designation.findByIdAndUpdate(newDesignation, { $inc: { employeeCount: 1 } });
    }

    // Update employee
    const updatedEmployee = await Employee.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true }
    ).populate('employmentDetails.designation employmentDetails.department employmentDetails.reportingTo');

    res.status(200).json({
      success: true,
      message: 'Employee updated successfully',
      data: updatedEmployee
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Delete employee (soft delete - change status to Inactive)
export const deleteEmployee = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Soft delete - change status to Inactive
    employee.employmentDetails.status = 'Inactive';
    await employee.save();

    // Update department and designation counts
    if (employee.employmentDetails.department) {
      await Department.findByIdAndUpdate(
        employee.employmentDetails.department,
        { $inc: { employeeCount: -1 } }
      );
    }
    if (employee.employmentDetails.designation) {
      await Designation.findByIdAndUpdate(
        employee.employmentDetails.designation,
        { $inc: { employeeCount: -1 } }
      );
    }

    res.status(200).json({
      success: true,
      message: 'Employee deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Search employees
export const searchEmployees = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const employees = await Employee.find({
      $or: [
        { employeeNumber: { $regex: query, $options: 'i' } },
        { 'personalDetails.name': { $regex: query, $options: 'i' } },
        { 'personalDetails.phone': { $regex: query, $options: 'i' } },
        { 'personalDetails.email': { $regex: query, $options: 'i' } }
      ],
      'employmentDetails.status': 'Active'
    })
      .limit(10)
      .populate('employmentDetails.designation employmentDetails.department');

    res.status(200).json({
      success: true,
      data: employees
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get employee statistics
export const getEmployeeStatistics = async (req, res) => {
  try {
    const total = await Employee.countDocuments();
    const active = await Employee.countDocuments({ 'employmentDetails.status': 'Active' });
    const inactive = await Employee.countDocuments({ 'employmentDetails.status': 'Inactive' });
    const onLeave = await Employee.countDocuments({ 'employmentDetails.status': 'On Leave' });
    const terminated = await Employee.countDocuments({ 'employmentDetails.status': 'Terminated' });
    const resigned = await Employee.countDocuments({ 'employmentDetails.status': 'Resigned' });

    // Department-wise count
    const departmentStats = await Employee.aggregate([
      {
        $group: {
          _id: '$employmentDetails.department',
          count: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'departments',
          localField: '_id',
          foreignField: '_id',
          as: 'department'
        }
      },
      {
        $unwind: '$department'
      },
      {
        $project: {
          departmentName: '$department.name',
          count: 1
        }
      }
    ]);

    // Employment type-wise count
    const employmentTypeStats = await Employee.aggregate([
      {
        $group: {
          _id: '$employmentDetails.employmentType',
          count: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        overall: {
          total,
          active,
          inactive,
          onLeave,
          terminated,
          resigned
        },
        byDepartment: departmentStats,
        byEmploymentType: employmentTypeStats
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update employee status
export const updateEmployeeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['Active', 'Inactive', 'On Leave', 'Terminated', 'Resigned'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value'
      });
    }

    const employee = await Employee.findById(id);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    const oldStatus = employee.employmentDetails.status;
    employee.employmentDetails.status = status;
    await employee.save();

    // Update department count if status changes to/from Active
    if (oldStatus === 'Active' && status !== 'Active') {
      if (employee.employmentDetails.department) {
        await Department.findByIdAndUpdate(
          employee.employmentDetails.department,
          { $inc: { employeeCount: -1 } }
        );
      }
      if (employee.employmentDetails.designation) {
        await Designation.findByIdAndUpdate(
          employee.employmentDetails.designation,
          { $inc: { employeeCount: -1 } }
        );
      }
    } else if (oldStatus !== 'Active' && status === 'Active') {
      if (employee.employmentDetails.department) {
        await Department.findByIdAndUpdate(
          employee.employmentDetails.department,
          { $inc: { employeeCount: 1 } }
        );
      }
      if (employee.employmentDetails.designation) {
        await Designation.findByIdAndUpdate(
          employee.employmentDetails.designation,
          { $inc: { employeeCount: 1 } }
        );
      }
    }

    res.status(200).json({
      success: true,
      message: 'Employee status updated successfully',
      data: employee
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
