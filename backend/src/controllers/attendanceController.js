import Attendance from '../models/Attendance.js';
import Employee from '../models/Employee.js';

// Mark single attendance
export const markAttendance = async (req, res) => {
  try {
    const { employeeId, date, status } = req.body;
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const existing = await Attendance.findOne({
      companyId: req.companyId,
      employeeId,
      date: { $gte: dayStart, $lte: dayEnd }
    });

    let record;
    if (existing) {
      existing.status = status;
      record = await existing.save();
    } else {
      record = await Attendance.create({
        companyId: req.companyId,
        employeeId,
        date: dayStart,
        status
      });
    }

    await record.populate('employeeId', 'name department role');
    res.status(201).json({ success: true, data: record });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Bulk mark attendance
export const bulkMarkAttendance = async (req, res) => {
  try {
    const { attendanceRecords } = req.body;
    const results = [];

    for (const rec of attendanceRecords) {
      const { employeeId, date, status } = rec;
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);

      const record = await Attendance.findOneAndUpdate(
        { companyId: req.companyId, employeeId, date: { $gte: dayStart, $lte: dayEnd } },
        { companyId: req.companyId, employeeId, date: dayStart, status },
        { upsert: true, new: true }
      );
      results.push(record);
    }

    res.json({ success: true, data: results, count: results.length });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Get all attendance with filters
export const getAllAttendance = async (req, res) => {
  try {
    const { employeeId, startDate, endDate, status, page = 1, limit = 50 } = req.query;
    const query = { companyId: req.companyId };

    if (employeeId) query.employeeId = employeeId;
    if (status) query.status = status;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.date.$lte = end;
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Attendance.countDocuments(query);
    const records = await Attendance.find(query)
      .populate('employeeId', 'name department role')
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({ success: true, data: records, pagination: { total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get attendance by ID
export const getAttendanceById = async (req, res) => {
  try {
    const record = await Attendance.findOne({ _id: req.params.id, companyId: req.companyId })
      .populate('employeeId', 'name department role');
    if (!record) return res.status(404).json({ success: false, message: 'Attendance record not found' });
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update attendance
export const updateAttendance = async (req, res) => {
  try {
    const { status } = req.body;
    const record = await Attendance.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      { status },
      { new: true }
    ).populate('employeeId', 'name department role');
    if (!record) return res.status(404).json({ success: false, message: 'Attendance record not found' });
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Delete attendance
export const deleteAttendance = async (req, res) => {
  try {
    const record = await Attendance.findOneAndDelete({ _id: req.params.id, companyId: req.companyId });
    if (!record) return res.status(404).json({ success: false, message: 'Attendance record not found' });
    res.json({ success: true, message: 'Attendance deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get attendance by date
export const getAttendanceByDate = async (req, res) => {
  try {
    const { date } = req.query;
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const records = await Attendance.find({
      companyId: req.companyId,
      date: { $gte: dayStart, $lte: dayEnd }
    }).populate('employeeId', 'name department role');

    res.json({ success: true, data: records });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Monthly summary for an employee
export const getMonthlySummary = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { month, year } = req.query;

    const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);

    const records = await Attendance.find({
      companyId: req.companyId,
      employeeId,
      date: { $gte: startDate, $lte: endDate }
    });

    const present = records.filter(r => r.status === 'Present').length;
    const absent = records.filter(r => r.status === 'Absent').length;
    const halfDay = records.filter(r => r.status === 'Half Day').length;

    res.json({
      success: true,
      data: { present, absent, halfDay, total: records.length, records }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Attendance report
export const getAttendanceReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const query = { companyId: req.companyId };

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.date.$lte = end;
      }
    }

    const records = await Attendance.find(query).populate('employeeId', 'name department');
    const present = records.filter(r => r.status === 'Present').length;
    const absent = records.filter(r => r.status === 'Absent').length;
    const halfDay = records.filter(r => r.status === 'Half Day').length;

    res.json({ success: true, data: { records, summary: { present, absent, halfDay } } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
