import Employee from '../models/Employee.js';

// Create employee
export const createEmployee = async (req, res) => {
  try {
    const { name, mobile, address, department, role, salary, joiningDate, status } = req.body;
    const employee = new Employee({
      companyId: req.companyId,
      name, mobile, address, department, role, salary, joiningDate, status
    });
    await employee.save();
    res.status(201).json({ success: true, data: employee });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Get all employees
export const getAllEmployees = async (req, res) => {
  try {
    const { status, department, search, limit = 100, page = 1 } = req.query;
    const query = { companyId: req.companyId };
    if (status) query.status = status;
    if (department) query.department = department;
    if (search) query.name = { $regex: search, $options: 'i' };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Employee.countDocuments(query);
    const employees = await Employee.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const active = await Employee.countDocuments({ companyId: req.companyId, status: 'Active' });
    const inactive = await Employee.countDocuments({ companyId: req.companyId, status: 'Inactive' });

    res.json({
      success: true,
      data: employees,
      pagination: { total, page: parseInt(page), limit: parseInt(limit) },
      statistics: { total, active, inactive }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get employee by ID
export const getEmployeeById = async (req, res) => {
  try {
    const employee = await Employee.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });
    res.json({ success: true, data: employee });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update employee
export const updateEmployee = async (req, res) => {
  try {
    const { name, mobile, address, department, role, salary, joiningDate, status } = req.body;
    const employee = await Employee.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      { name, mobile, address, department, role, salary, joiningDate, status },
      { new: true, runValidators: true }
    );
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });
    res.json({ success: true, data: employee });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Delete employee
export const deleteEmployee = async (req, res) => {
  try {
    const employee = await Employee.findOneAndDelete({ _id: req.params.id, companyId: req.companyId });
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });
    res.json({ success: true, message: 'Employee deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update status
export const updateEmployeeStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const employee = await Employee.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      { status },
      { new: true }
    );
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });
    res.json({ success: true, data: employee });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Search employees
export const searchEmployees = async (req, res) => {
  try {
    const { query } = req.query;
    const employees = await Employee.find({
      companyId: req.companyId,
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { mobile: { $regex: query, $options: 'i' } },
        { department: { $regex: query, $options: 'i' } }
      ]
    }).limit(20);
    res.json({ success: true, data: employees });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get statistics
export const getEmployeeStatistics = async (req, res) => {
  try {
    const total = await Employee.countDocuments({ companyId: req.companyId });
    const active = await Employee.countDocuments({ companyId: req.companyId, status: 'Active' });
    const inactive = await Employee.countDocuments({ companyId: req.companyId, status: 'Inactive' });
    res.json({ success: true, data: { total, active, inactive } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
