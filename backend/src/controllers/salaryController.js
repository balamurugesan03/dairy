import Payroll from '../models/Payroll.js';
import Employee from '../models/Employee.js';

// Generate / create payroll
export const createSalary = async (req, res) => {
  try {
    const { employeeId, basicSalary, overtime = 0, deduction = 0, month, year } = req.body;

    // Check if already exists
    const existing = await Payroll.findOne({ companyId: req.companyId, employeeId, month, year });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Payroll already generated for this month' });
    }

    const payroll = new Payroll({
      companyId: req.companyId,
      employeeId,
      basicSalary,
      overtime,
      deduction,
      month: parseInt(month),
      year: parseInt(year)
    });
    await payroll.save();
    await payroll.populate('employeeId', 'name department role');
    res.status(201).json({ success: true, data: payroll });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Process payroll (same as create, called via /salary/process)
export const processSalary = async (req, res) => {
  return createSalary(req, res);
};

// Bulk process - generate payroll for all active employees
export const bulkProcessSalary = async (req, res) => {
  try {
    const { month, year, overtime = 0, deduction = 0 } = req.body;
    const employees = await Employee.find({ companyId: req.companyId, status: 'Active' });

    const results = [];
    for (const emp of employees) {
      const existing = await Payroll.findOne({ companyId: req.companyId, employeeId: emp._id, month: parseInt(month), year: parseInt(year) });
      if (!existing) {
        const payroll = new Payroll({
          companyId: req.companyId,
          employeeId: emp._id,
          basicSalary: emp.salary,
          overtime,
          deduction,
          month: parseInt(month),
          year: parseInt(year)
        });
        await payroll.save();
        results.push(payroll);
      }
    }

    res.json({ success: true, data: results, count: results.length });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Get all payroll records
export const getAllSalaries = async (req, res) => {
  try {
    const { month, year, employee, status } = req.query;
    const query = { companyId: req.companyId };

    if (month) query.month = parseInt(month);
    if (year) query.year = parseInt(year);
    if (employee) query.employeeId = employee;
    if (status) query.status = status;

    const records = await Payroll.find(query)
      .populate('employeeId', 'name department role salary')
      .sort({ year: -1, month: -1 });

    res.json({ success: true, data: records });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get payroll by ID
export const getSalaryById = async (req, res) => {
  try {
    const record = await Payroll.findOne({ _id: req.params.id, companyId: req.companyId })
      .populate('employeeId', 'name department role');
    if (!record) return res.status(404).json({ success: false, message: 'Payroll record not found' });
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update payroll
export const updateSalary = async (req, res) => {
  try {
    const { basicSalary, overtime, deduction } = req.body;
    const record = await Payroll.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      { basicSalary, overtime, deduction },
      { new: true, runValidators: true }
    ).populate('employeeId', 'name department role');
    if (!record) return res.status(404).json({ success: false, message: 'Payroll record not found' });
    // Recalculate netSalary
    record.netSalary = (record.basicSalary || 0) + (record.overtime || 0) - (record.deduction || 0);
    await record.save();
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Delete payroll
export const deleteSalary = async (req, res) => {
  try {
    const record = await Payroll.findOneAndDelete({ _id: req.params.id, companyId: req.companyId });
    if (!record) return res.status(404).json({ success: false, message: 'Payroll record not found' });
    res.json({ success: true, message: 'Payroll record deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Approve payroll
export const approveSalary = async (req, res) => {
  try {
    const record = await Payroll.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      { status: 'Approved' },
      { new: true }
    ).populate('employeeId', 'name department role');
    if (!record) return res.status(404).json({ success: false, message: 'Payroll record not found' });
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Mark payroll as paid
export const markSalaryPaid = async (req, res) => {
  try {
    const record = await Payroll.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      { status: 'Paid', paidDate: new Date() },
      { new: true }
    ).populate('employeeId', 'name department role');
    if (!record) return res.status(404).json({ success: false, message: 'Payroll record not found' });
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Get pending payroll
export const getPendingSalaries = async (req, res) => {
  try {
    const records = await Payroll.find({ companyId: req.companyId, status: 'Pending' })
      .populate('employeeId', 'name department role');
    res.json({ success: true, data: records });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get unpaid payroll
export const getUnpaidSalaries = async (req, res) => {
  try {
    const records = await Payroll.find({ companyId: req.companyId, status: { $ne: 'Paid' } })
      .populate('employeeId', 'name department role');
    res.json({ success: true, data: records });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Generate payslip (stub - returns same record)
export const generatePayslip = async (req, res) => {
  return getSalaryById(req, res);
};
