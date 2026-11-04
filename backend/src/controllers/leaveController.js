import Leave, { LEAVE_TYPES, QUOTA_LEAVE_TYPES } from '../models/Leave.js';
import Employee from '../models/Employee.js';
import Attendance from '../models/Attendance.js';
import Payroll from '../models/Payroll.js';
import { toDay, endOfDay, eachDay, getLeaveBalance } from '../utils/hrmEngine.js';

const POPULATE = 'name employeeCode department role';

/** Days in [from, to] that belong to `year` (a leave may cross Dec → Jan). */
const daysInYear = (from, to, year) =>
  eachDay(from, to).filter(d => d.getFullYear() === year).length;

/** Quota check for Casual / Sick / Earned. Returns an error message or null. */
const checkBalance = async (employee, leaveType, from, to, companyId, excludeId = null) => {
  if (!QUOTA_LEAVE_TYPES.includes(leaveType)) return null;
  const years = [...new Set([from.getFullYear(), to.getFullYear()])];
  for (const y of years) {
    const bal = (await getLeaveBalance(employee, y, companyId, excludeId))[leaveType];
    const need = daysInYear(from, to, y);
    if (need > bal.balance) {
      return `${leaveType} leave balance for ${y} is ${Math.max(0, bal.balance)} day(s); ${need} requested. Use Unpaid leave or raise the quota on the employee.`;
    }
  }
  return null;
};

/** Paid salary months covered by the leave — those days can't change. */
const paidMonthClash = async (companyId, employeeId, from, to) => {
  const months = [...new Set(eachDay(from, to).map(d => `${d.getFullYear()}-${d.getMonth() + 1}`))]
    .map(k => { const [y, m] = k.split('-').map(Number); return { year: y, month: m }; });
  const paid = await Payroll.findOne({ companyId, employeeId, status: 'Paid', $or: months }).lean();
  return paid ? `Salary for ${paid.month}/${paid.year} is already paid — revert that payment first.` : null;
};

/** Write a "Leave" attendance record for every day of an approved leave. */
const writeLeaveAttendance = async (leave) => {
  const ops = eachDay(leave.fromDate, leave.toDate).map(day => ({
    updateOne: {
      filter: { companyId: leave.companyId, employeeId: leave.employeeId._id || leave.employeeId, date: { $gte: day, $lte: endOfDay(day) } },
      update: { $set: {
        companyId: leave.companyId, employeeId: leave.employeeId._id || leave.employeeId, date: day,
        status: 'Leave', leaveId: leave._id, leaveType: leave.leaveType, overtimeHours: 0,
        remarks: `${leave.leaveType} leave`
      } },
      upsert: true
    }
  }));
  if (ops.length) await Attendance.bulkWrite(ops, { ordered: false });
};
const clearLeaveAttendance = (leave) =>
  Attendance.deleteMany({ companyId: leave.companyId, leaveId: leave._id });

// Apply for leave
export const applyLeave = async (req, res) => {
  try {
    const { employeeId, fromDate, toDate, reason, leaveType = 'Casual', autoApprove = false } = req.body;
    if (!employeeId || !fromDate || !toDate) {
      return res.status(400).json({ success: false, message: 'Employee, from date and to date are required' });
    }
    if (!LEAVE_TYPES.includes(leaveType)) return res.status(400).json({ success: false, message: 'Invalid leave type' });
    const from = toDay(fromDate);
    const to = toDay(toDate);
    if (to < from) return res.status(400).json({ success: false, message: 'To date must be on or after from date' });

    const employee = await Employee.findOne({ _id: employeeId, companyId: req.companyId });
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

    const overlap = await Leave.findOne({
      companyId: req.companyId, employeeId, status: { $in: ['Pending', 'Approved'] },
      fromDate: { $lte: endOfDay(to) }, toDate: { $gte: from }
    }).lean();
    if (overlap) {
      return res.status(400).json({
        success: false,
        message: `Overlaps an existing ${overlap.status.toLowerCase()} ${overlap.leaveType} leave (${overlap.fromDate.toLocaleDateString('en-IN')} – ${overlap.toDate.toLocaleDateString('en-IN')})`
      });
    }

    const balErr = await checkBalance(employee, leaveType, from, to, req.companyId);
    if (balErr) return res.status(400).json({ success: false, message: balErr });

    const leave = new Leave({ companyId: req.companyId, employeeId, fromDate: from, toDate: to, reason, leaveType });
    if (autoApprove) {
      const clash = await paidMonthClash(req.companyId, employeeId, from, to);
      if (clash) return res.status(400).json({ success: false, message: clash });
      leave.status = 'Approved';
      leave.actionedAt = new Date();
    }
    await leave.save();
    if (leave.status === 'Approved') await writeLeaveAttendance(leave);
    await leave.populate('employeeId', POPULATE);
    res.status(201).json({ success: true, data: leave });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Get all leaves (date filter = leaves overlapping the range)
export const getAllLeaves = async (req, res) => {
  try {
    const { startDate, endDate, employee, status, leaveType } = req.query;
    const query = { companyId: req.companyId };
    if (employee) query.employeeId = employee;
    if (status) query.status = status;
    if (leaveType) query.leaveType = leaveType;
    if (startDate) query.toDate = { $gte: toDay(startDate) };
    if (endDate) query.fromDate = { $lte: endOfDay(endDate) };

    const leaves = await Leave.find(query).populate('employeeId', POPULATE).sort({ fromDate: -1 });
    res.json({ success: true, data: leaves });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get leave by ID
export const getLeaveById = async (req, res) => {
  try {
    const leave = await Leave.findOne({ _id: req.params.id, companyId: req.companyId }).populate('employeeId', POPULATE);
    if (!leave) return res.status(404).json({ success: false, message: 'Leave not found' });
    res.json({ success: true, data: leave });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Approve leave → marks the days as Leave in attendance
export const approveLeave = async (req, res) => {
  try {
    const leave = await Leave.findOne({ _id: req.params.id, companyId: req.companyId, status: 'Pending' });
    if (!leave) return res.status(404).json({ success: false, message: 'Leave not found or already processed' });

    const employee = await Employee.findOne({ _id: leave.employeeId, companyId: req.companyId });
    const balErr = employee && await checkBalance(employee, leave.leaveType, toDay(leave.fromDate), toDay(leave.toDate), req.companyId, leave._id);
    if (balErr) return res.status(400).json({ success: false, message: balErr });
    const clash = await paidMonthClash(req.companyId, leave.employeeId, leave.fromDate, leave.toDate);
    if (clash) return res.status(400).json({ success: false, message: clash });

    leave.status = 'Approved';
    leave.remarks = req.body?.remarks || leave.remarks;
    leave.actionedAt = new Date();
    await leave.save();
    await writeLeaveAttendance(leave);
    await leave.populate('employeeId', POPULATE);
    res.json({ success: true, data: leave });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Reject leave
export const rejectLeave = async (req, res) => {
  try {
    const leave = await Leave.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId, status: 'Pending' },
      { status: 'Rejected', rejectionReason: req.body?.rejectionReason || '', actionedAt: new Date() },
      { new: true }
    ).populate('employeeId', POPULATE);
    if (!leave) return res.status(404).json({ success: false, message: 'Leave not found or already processed' });
    res.json({ success: true, data: leave });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Cancel an approved leave → removes its attendance days
export const cancelLeave = async (req, res) => {
  try {
    const leave = await Leave.findOne({ _id: req.params.id, companyId: req.companyId, status: { $in: ['Approved', 'Pending'] } });
    if (!leave) return res.status(404).json({ success: false, message: 'Leave not found or already closed' });
    if (leave.status === 'Approved') {
      const clash = await paidMonthClash(req.companyId, leave.employeeId, leave.fromDate, leave.toDate);
      if (clash) return res.status(400).json({ success: false, message: clash });
      await clearLeaveAttendance(leave);
    }
    leave.status = 'Cancelled';
    leave.remarks = req.body?.remarks || leave.remarks;
    leave.actionedAt = new Date();
    await leave.save();
    await leave.populate('employeeId', POPULATE);
    res.json({ success: true, data: leave });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Delete leave
export const deleteLeave = async (req, res) => {
  try {
    const leave = await Leave.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!leave) return res.status(404).json({ success: false, message: 'Leave not found' });
    if (leave.status === 'Approved') {
      const clash = await paidMonthClash(req.companyId, leave.employeeId, leave.fromDate, leave.toDate);
      if (clash) return res.status(400).json({ success: false, message: clash });
      await clearLeaveAttendance(leave);
    }
    await leave.deleteOne();
    res.json({ success: true, message: 'Leave deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Leave balance per type for a year
export const getLeaveBalanceForEmployee = async (req, res) => {
  try {
    const employee = await Employee.findOne({ _id: req.params.employeeId, companyId: req.companyId });
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });
    const year = parseInt(req.query.year) || new Date().getFullYear();
    res.json({ success: true, data: { year, balance: await getLeaveBalance(employee, year, req.companyId) } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get leave summary for employee
export const getLeaveSummary = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const leaves = await Leave.find({ companyId: req.companyId, employeeId });
    const c = (s) => leaves.filter(l => l.status === s).length;
    res.json({ success: true, data: { total: leaves.length, approved: c('Approved'), pending: c('Pending'), rejected: c('Rejected'), cancelled: c('Cancelled') } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
