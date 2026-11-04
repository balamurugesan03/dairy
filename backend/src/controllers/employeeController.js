import Employee from '../models/Employee.js';
import Attendance from '../models/Attendance.js';
import Payroll from '../models/Payroll.js';
import Loan from '../models/Loan.js';
import Leave from '../models/Leave.js';
import { getLeaveBalance, monthRange } from '../utils/hrmEngine.js';

// Fields a client may set (companyId / employeeCode handled separately)
const EDITABLE = [
  'name', 'fatherName', 'gender', 'dob', 'mobile', 'email', 'address', 'emergencyContact', 'aadhaar', 'pan',
  'department', 'role', 'employmentType', 'joiningDate', 'exitDate', 'exitReason', 'status',
  'salaryType', 'salary', 'salaryStructure', 'otRatePerHour',
  'pfApplicable', 'pfPercent', 'pfNumber', 'esiApplicable', 'esiPercent', 'esiNumber', 'professionalTax',
  'paymentMode', 'bankName', 'accountNo', 'ifsc', 'leaveQuota'
];
const pick = (body) => {
  const out = {};
  for (const k of EDITABLE) if (body[k] !== undefined) out[k] = body[k] === '' && ['dob', 'exitDate'].includes(k) ? null : body[k];
  return out;
};

const nextEmployeeCode = async (companyId) => {
  const rows = await Employee.find({ companyId, employeeCode: /^EMP-\d+$/ }, 'employeeCode').lean();
  const max = rows.reduce((m, r) => Math.max(m, parseInt(r.employeeCode.slice(4), 10) || 0), 0);
  return `EMP-${String(max + 1).padStart(3, '0')}`;
};

/** Give codes to employees created before codes existed (oldest first). */
const backfillCodes = async (companyId) => {
  const missing = await Employee.find({ companyId, $or: [{ employeeCode: { $exists: false } }, { employeeCode: null }, { employeeCode: '' }] })
    .sort({ createdAt: 1 });
  for (const emp of missing) {
    emp.employeeCode = await nextEmployeeCode(companyId);
    await emp.save();
  }
};

// Create employee
export const createEmployee = async (req, res) => {
  try {
    const data = pick(req.body);
    let code = (req.body.employeeCode || '').trim();
    if (code) {
      if (await Employee.exists({ companyId: req.companyId, employeeCode: code })) {
        return res.status(400).json({ success: false, message: `Employee code ${code} already exists` });
      }
    } else {
      await backfillCodes(req.companyId);
      code = await nextEmployeeCode(req.companyId);
    }
    const employee = new Employee({ ...data, companyId: req.companyId, employeeCode: code });
    await employee.save();
    res.status(201).json({ success: true, data: employee });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getNextCode = async (req, res) => {
  try {
    await backfillCodes(req.companyId);
    res.json({ success: true, data: { employeeCode: await nextEmployeeCode(req.companyId) } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get all employees
export const getAllEmployees = async (req, res) => {
  try {
    const { status, department, employmentType, search, limit = 500, page = 1 } = req.query;
    await backfillCodes(req.companyId);
    const query = { companyId: req.companyId };
    if (status) query.status = status;
    if (department) query.department = department;
    if (employmentType) query.employmentType = employmentType;
    if (search) {
      const rx = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
      query.$or = [{ name: rx }, { mobile: rx }, { employeeCode: rx }, { department: rx }, { role: rx }];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [total, employees, stats] = await Promise.all([
      Employee.countDocuments(query),
      Employee.find(query).sort({ employeeCode: 1, name: 1 }).skip(skip).limit(parseInt(limit)),
      buildStatistics(req.companyId)
    ]);

    res.json({
      success: true,
      data: employees,
      pagination: { total, page: parseInt(page), limit: parseInt(limit) },
      statistics: stats
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const buildStatistics = async (companyId) => {
  const all = await Employee.find({ companyId }, 'status salary salaryType department').lean();
  const active = all.filter(e => e.status === 'Active');
  const departments = {};
  for (const e of active) { const k = e.department || 'Unassigned'; departments[k] = (departments[k] || 0) + 1; }
  return {
    total: all.length,
    active: active.length,
    inactive: all.length - active.length,
    monthlySalaryCost: active.reduce((s, e) => s + (e.salaryType === 'Daily' ? (e.salary || 0) * 26 : (e.salary || 0)), 0),
    departments
  };
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

// Full profile: employee + this month attendance + leave balance + loans + recent payroll
export const getEmployeeProfile = async (req, res) => {
  try {
    const companyId = req.companyId;
    const employee = await Employee.findOne({ _id: req.params.id, companyId });
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

    const now = new Date();
    const month = parseInt(req.query.month) || now.getMonth() + 1;
    const year = parseInt(req.query.year) || now.getFullYear();
    const { start, end } = monthRange(month, year);

    const [attendance, leaveBalance, loans, payrolls, leaves] = await Promise.all([
      Attendance.find({ companyId, employeeId: employee._id, date: { $gte: start, $lte: end } }).sort({ date: 1 }).lean(),
      getLeaveBalance(employee, year, companyId),
      Loan.find({ companyId, employeeId: employee._id }).sort({ loanDate: -1 }).lean(),
      Payroll.find({ companyId, employeeId: employee._id }).sort({ year: -1, month: -1 }).limit(12).lean(),
      Leave.find({ companyId, employeeId: employee._id }).sort({ fromDate: -1 }).limit(10).lean()
    ]);

    const count = (s) => attendance.filter(a => a.status === s).length;
    res.json({
      success: true,
      data: {
        employee,
        attendance: {
          month, year, records: attendance,
          summary: {
            present: count('Present'), absent: count('Absent'), halfDay: count('Half Day'),
            leave: count('Leave'), holiday: count('Holiday'), weekOff: count('Week Off'),
            overtimeHours: attendance.reduce((s, a) => s + (a.overtimeHours || 0), 0)
          }
        },
        leaveBalance,
        leaves,
        loans,
        loanOutstanding: loans.filter(l => l.status === 'Active').reduce((s, l) => s + (l.remainingAmount || 0), 0),
        payrolls
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update employee (load + save so the salary-structure hook runs)
export const updateEmployee = async (req, res) => {
  try {
    const employee = await Employee.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

    const code = (req.body.employeeCode || '').trim();
    if (code && code !== employee.employeeCode) {
      if (await Employee.exists({ companyId: req.companyId, employeeCode: code, _id: { $ne: employee._id } })) {
        return res.status(400).json({ success: false, message: `Employee code ${code} already exists` });
      }
      employee.employeeCode = code;
    }
    employee.set(pick(req.body));
    await employee.save();
    res.json({ success: true, data: employee });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Delete employee — only when no HR history exists; otherwise mark Inactive
export const deleteEmployee = async (req, res) => {
  try {
    const companyId = req.companyId;
    const id = req.params.id;
    const [payrolls, loans] = await Promise.all([
      Payroll.countDocuments({ companyId, employeeId: id }),
      Loan.countDocuments({ companyId, employeeId: id })
    ]);
    if (payrolls || loans) {
      return res.status(400).json({
        success: false,
        message: `Employee has ${payrolls} payroll and ${loans} loan record(s). Mark the employee Inactive instead of deleting.`
      });
    }
    const employee = await Employee.findOneAndDelete({ _id: id, companyId });
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });
    await Promise.all([
      Attendance.deleteMany({ companyId, employeeId: id }),
      Leave.deleteMany({ companyId, employeeId: id })
    ]);
    res.json({ success: true, message: 'Employee deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update status (Inactive → stamps exit date when none given)
export const updateEmployeeStatus = async (req, res) => {
  try {
    const { status, exitDate, exitReason } = req.body;
    const employee = await Employee.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });
    employee.status = status;
    if (status === 'Inactive') {
      employee.exitDate = exitDate || employee.exitDate || new Date();
      if (exitReason) employee.exitReason = exitReason;
    } else {
      employee.exitDate = undefined;
      employee.exitReason = undefined;
    }
    await employee.save();
    res.json({ success: true, data: employee });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Search employees
export const searchEmployees = async (req, res) => {
  try {
    const { query = '' } = req.query;
    const rx = { $regex: query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    const employees = await Employee.find({
      companyId: req.companyId,
      $or: [{ name: rx }, { mobile: rx }, { department: rx }, { employeeCode: rx }]
    }).limit(20);
    res.json({ success: true, data: employees });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get statistics
export const getEmployeeStatistics = async (req, res) => {
  try {
    res.json({ success: true, data: await buildStatistics(req.companyId) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
