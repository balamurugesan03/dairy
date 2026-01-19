import Attendance from '../models/Attendance.js';
import Employee from '../models/Employee.js';

// Mark attendance
export const markAttendance = async (req, res) => {
  try {
    const { employee, date, checkIn, checkOut, status, shift } = req.body;

    // Check if attendance already exists for this employee and date
    const existingAttendance = await Attendance.findOne({
      employee,
      date: new Date(date).setHours(0, 0, 0, 0)
    });

    if (existingAttendance) {
      return res.status(400).json({
        success: false,
        message: 'Attendance already marked for this date'
      });
    }

    // Create new attendance record
    const attendance = new Attendance(req.body);
    await attendance.save();
    await attendance.populate('employee');

    res.status(201).json({
      success: true,
      message: 'Attendance marked successfully',
      data: attendance
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update attendance
export const updateAttendance = async (req, res) => {
  try {
    const { id } = req.params;

    const attendance = await Attendance.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true }
    ).populate('employee');

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Attendance updated successfully',
      data: attendance
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get attendance by ID
export const getAttendanceById = async (req, res) => {
  try {
    const attendance = await Attendance.findById(req.params.id)
      .populate('employee approvedBy');

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found'
      });
    }

    res.status(200).json({
      success: true,
      data: attendance
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get all attendance with filters
export const getAllAttendance = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      employee = '',
      startDate = '',
      endDate = '',
      status = '',
      shift = ''
    } = req.query;

    const query = {};

    if (employee) {
      query.employee = employee;
    }

    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    } else if (startDate) {
      query.date = { $gte: new Date(startDate) };
    } else if (endDate) {
      query.date = { $lte: new Date(endDate) };
    }

    if (status) {
      query.status = status;
    }

    if (shift) {
      query.shift = shift;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const attendance = await Attendance.find(query)
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('employee approvedBy');

    const total = await Attendance.countDocuments(query);

    res.status(200).json({
      success: true,
      data: attendance,
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

// Get attendance for a specific date
export const getAttendanceByDate = async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date is required'
      });
    }

    const attendance = await Attendance.find({
      date: new Date(date).setHours(0, 0, 0, 0)
    }).populate('employee');

    res.status(200).json({
      success: true,
      data: attendance
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get monthly attendance summary for an employee
export const getMonthlyAttendanceSummary = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({
        success: false,
        message: 'Month and year are required'
      });
    }

    const summary = await Attendance.getMonthlySummary(
      employeeId,
      parseInt(month),
      parseInt(year)
    );

    res.status(200).json({
      success: true,
      data: summary
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get attendance report for date range
export const getAttendanceReport = async (req, res) => {
  try {
    const { startDate, endDate, department = '', designation = '' } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    // Build employee filter
    const employeeFilter = { 'employmentDetails.status': 'Active' };
    if (department) employeeFilter['employmentDetails.department'] = department;
    if (designation) employeeFilter['employmentDetails.designation'] = designation;

    // Get active employees
    const employees = await Employee.find(employeeFilter)
      .populate('employmentDetails.designation employmentDetails.department');

    // Get attendance records for date range
    const attendanceRecords = await Attendance.find({
      date: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    }).populate('employee');

    // Build report for each employee
    const report = employees.map(emp => {
      const empAttendance = attendanceRecords.filter(
        a => a.employee._id.toString() === emp._id.toString()
      );

      const summary = {
        employee: {
          id: emp._id,
          employeeNumber: emp.employeeNumber,
          name: emp.personalDetails.name,
          department: emp.employmentDetails.department?.name,
          designation: emp.employmentDetails.designation?.name
        },
        attendance: {
          totalDays: empAttendance.length,
          present: empAttendance.filter(a => a.status === 'Present').length,
          absent: empAttendance.filter(a => a.status === 'Absent').length,
          halfDay: empAttendance.filter(a => a.status === 'Half Day').length,
          late: empAttendance.filter(a => a.status === 'Late').length,
          onLeave: empAttendance.filter(a => a.status === 'On Leave').length,
          holiday: empAttendance.filter(a => a.status === 'Holiday').length,
          weekOff: empAttendance.filter(a => a.status === 'Week Off').length,
          totalWorkingHours: empAttendance.reduce((sum, a) => sum + (a.workingHours || 0), 0),
          totalOvertimeHours: empAttendance.reduce((sum, a) => sum + (a.overtimeHours || 0), 0)
        }
      };

      return summary;
    });

    res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Bulk mark attendance
export const bulkMarkAttendance = async (req, res) => {
  try {
    const { attendanceRecords } = req.body;

    if (!attendanceRecords || !Array.isArray(attendanceRecords)) {
      return res.status(400).json({
        success: false,
        message: 'Attendance records array is required'
      });
    }

    const results = [];
    const errors = [];

    for (const record of attendanceRecords) {
      try {
        // Check if attendance already exists
        const existing = await Attendance.findOne({
          employee: record.employee,
          date: new Date(record.date).setHours(0, 0, 0, 0)
        });

        if (existing) {
          errors.push({
            employee: record.employee,
            message: 'Attendance already marked'
          });
          continue;
        }

        const attendance = new Attendance(record);
        await attendance.save();
        results.push(attendance);
      } catch (error) {
        errors.push({
          employee: record.employee,
          message: error.message
        });
      }
    }

    res.status(201).json({
      success: true,
      message: `${results.length} attendance records marked successfully`,
      data: results,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Delete attendance
export const deleteAttendance = async (req, res) => {
  try {
    const attendance = await Attendance.findByIdAndDelete(req.params.id);

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Attendance record deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
