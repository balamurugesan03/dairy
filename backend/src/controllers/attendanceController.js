import Attendance, { ATTENDANCE_STATUSES } from '../models/Attendance.js';
import Employee from '../models/Employee.js';
import Payroll from '../models/Payroll.js';
import { toDay, endOfDay, monthRange, dayKey } from '../utils/hrmEngine.js';

const POPULATE = 'name employeeCode department role';

/** Paid payroll for that month locks its attendance. */
const lockedMonth = async (companyId, employeeIds, date) => {
  const d = toDay(date);
  const ids = Array.isArray(employeeIds) ? employeeIds : [employeeIds];
  const paid = await Payroll.findOne({
    companyId, employeeId: { $in: ids }, month: d.getMonth() + 1, year: d.getFullYear(), status: 'Paid'
  }).populate('employeeId', 'name').lean();
  return paid ? `Salary for ${paid.employeeId?.name || 'employee'} is already paid for this month — revert the payment to change attendance.` : null;
};

// Mark single attendance
export const markAttendance = async (req, res) => {
  try {
    const { employeeId, date, status, overtimeHours = 0, remarks } = req.body;
    if (!ATTENDANCE_STATUSES.includes(status)) return res.status(400).json({ success: false, message: 'Invalid status' });
    const lock = await lockedMonth(req.companyId, employeeId, date);
    if (lock) return res.status(400).json({ success: false, message: lock });

    const day = toDay(date);
    const record = await Attendance.findOneAndUpdate(
      { companyId: req.companyId, employeeId, date: { $gte: day, $lte: endOfDay(day) } },
      { $set: { companyId: req.companyId, employeeId, date: day, status, overtimeHours, remarks },
        ...(status !== 'Leave' ? { $unset: { leaveId: 1, leaveType: 1 } } : {}) },
      { upsert: true, new: true }
    ).populate('employeeId', POPULATE);
    res.status(201).json({ success: true, data: record });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Bulk mark attendance (one day, many employees)
export const bulkMarkAttendance = async (req, res) => {
  try {
    const { attendanceRecords = [] } = req.body;
    if (!attendanceRecords.length) return res.json({ success: true, data: [], count: 0 });

    const bad = attendanceRecords.find(r => !ATTENDANCE_STATUSES.includes(r.status));
    if (bad) return res.status(400).json({ success: false, message: `Invalid status "${bad.status}"` });

    const lock = await lockedMonth(req.companyId, attendanceRecords.map(r => r.employeeId), attendanceRecords[0].date);
    if (lock) return res.status(400).json({ success: false, message: lock });

    const ops = attendanceRecords.map(({ employeeId, date, status, overtimeHours = 0, remarks = '' }) => {
      const day = toDay(date);
      const keepLeave = status === 'Leave';
      return {
        updateOne: {
          filter: { companyId: req.companyId, employeeId, date: { $gte: day, $lte: endOfDay(day) } },
          update: {
            $set: { companyId: req.companyId, employeeId, date: day, status, overtimeHours: Number(overtimeHours) || 0, remarks },
            ...(keepLeave ? {} : { $unset: { leaveId: 1, leaveType: 1 } })
          },
          upsert: true
        }
      };
    });
    const result = await Attendance.bulkWrite(ops, { ordered: false });
    res.json({ success: true, count: attendanceRecords.length, upserted: result.upsertedCount, modified: result.modifiedCount });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Get all attendance with filters
export const getAllAttendance = async (req, res) => {
  try {
    const { employeeId, startDate, endDate, status, page = 1, limit = 500 } = req.query;
    const query = { companyId: req.companyId };

    if (employeeId) query.employeeId = employeeId;
    if (status) query.status = status;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = toDay(startDate);
      if (endDate) query.date.$lte = endOfDay(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [total, records] = await Promise.all([
      Attendance.countDocuments(query),
      Attendance.find(query).populate('employeeId', POPULATE).sort({ date: -1 }).skip(skip).limit(parseInt(limit))
    ]);

    res.json({ success: true, data: records, pagination: { total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get attendance by ID
export const getAttendanceById = async (req, res) => {
  try {
    const record = await Attendance.findOne({ _id: req.params.id, companyId: req.companyId })
      .populate('employeeId', POPULATE);
    if (!record) return res.status(404).json({ success: false, message: 'Attendance record not found' });
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update attendance
export const updateAttendance = async (req, res) => {
  try {
    const existing = await Attendance.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!existing) return res.status(404).json({ success: false, message: 'Attendance record not found' });
    const lock = await lockedMonth(req.companyId, existing.employeeId, existing.date);
    if (lock) return res.status(400).json({ success: false, message: lock });

    const { status, overtimeHours, remarks } = req.body;
    if (status) {
      existing.status = status;
      if (status !== 'Leave') { existing.leaveId = undefined; existing.leaveType = undefined; }
    }
    if (overtimeHours !== undefined) existing.overtimeHours = Number(overtimeHours) || 0;
    if (remarks !== undefined) existing.remarks = remarks;
    await existing.save();
    await existing.populate('employeeId', POPULATE);
    res.json({ success: true, data: existing });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Delete attendance
export const deleteAttendance = async (req, res) => {
  try {
    const existing = await Attendance.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!existing) return res.status(404).json({ success: false, message: 'Attendance record not found' });
    const lock = await lockedMonth(req.companyId, existing.employeeId, existing.date);
    if (lock) return res.status(400).json({ success: false, message: lock });
    await existing.deleteOne();
    res.json({ success: true, message: 'Attendance deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get attendance by date
export const getAttendanceByDate = async (req, res) => {
  try {
    const day = toDay(req.query.date);
    const records = await Attendance.find({
      companyId: req.companyId,
      date: { $gte: day, $lte: endOfDay(day) }
    }).populate('employeeId', POPULATE);
    res.json({ success: true, data: records });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const summarise = (records) => {
  const c = (s) => records.filter(r => r.status === s).length;
  return {
    present: c('Present'), absent: c('Absent'), halfDay: c('Half Day'), leave: c('Leave'),
    holiday: c('Holiday'), weekOff: c('Week Off'),
    overtimeHours: records.reduce((s, r) => s + (r.overtimeHours || 0), 0),
    total: records.length
  };
};

// Monthly summary for an employee
export const getMonthlySummary = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { start, end } = monthRange(parseInt(req.query.month), parseInt(req.query.year));
    const records = await Attendance.find({
      companyId: req.companyId, employeeId, date: { $gte: start, $lte: end }
    }).sort({ date: 1 });
    res.json({ success: true, data: { ...summarise(records), records } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Monthly register: one row per employee with a status per day.
 * GET /attendance/register?month=&year=&department=
 */
export const getMonthlyRegister = async (req, res) => {
  try {
    const month = parseInt(req.query.month);
    const year = parseInt(req.query.year);
    if (!month || !year) return res.status(400).json({ success: false, message: 'month and year are required' });
    const { start, end, days } = monthRange(month, year);

    const empQuery = {
      companyId: req.companyId,
      joiningDate: { $lte: end },
      $or: [{ status: 'Active' }, { exitDate: { $gte: start } }]
    };
    if (req.query.department) empQuery.department = req.query.department;
    const employees = await Employee.find(empQuery, 'name employeeCode department role status joiningDate exitDate')
      .sort({ employeeCode: 1, name: 1 }).lean();

    const records = await Attendance.find({
      companyId: req.companyId,
      employeeId: { $in: employees.map(e => e._id) },
      date: { $gte: start, $lte: end }
    }).lean();

    const byEmp = new Map();
    for (const r of records) {
      const k = String(r.employeeId);
      if (!byEmp.has(k)) byEmp.set(k, []);
      byEmp.get(k).push(r);
    }

    const rows = employees.map(emp => {
      const recs = byEmp.get(String(emp._id)) || [];
      const dayMap = {};
      for (const r of recs) {
        const d = new Date(r.date).getDate();
        dayMap[d] = { status: r.status, overtimeHours: r.overtimeHours || 0, leaveType: r.leaveType, id: r._id };
      }
      return { employee: emp, days: dayMap, summary: summarise(recs) };
    });

    res.json({ success: true, data: { month, year, daysInMonth: days, rows } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Attendance report (date range totals per employee)
export const getAttendanceReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const query = { companyId: req.companyId };
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = toDay(startDate);
      if (endDate) query.date.$lte = endOfDay(endDate);
    }
    const records = await Attendance.find(query).populate('employeeId', POPULATE).lean();
    const perEmployee = {};
    for (const r of records) {
      const k = String(r.employeeId?._id || r.employeeId);
      if (!perEmployee[k]) perEmployee[k] = { employee: r.employeeId, records: [] };
      perEmployee[k].records.push(r);
    }
    res.json({
      success: true,
      data: {
        records,
        summary: summarise(records),
        employees: Object.values(perEmployee).map(p => ({ employee: p.employee, ...summarise(p.records) })),
        dates: [...new Set(records.map(r => dayKey(r.date)))].length
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
