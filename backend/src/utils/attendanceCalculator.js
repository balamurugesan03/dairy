/**
 * Utility functions for attendance calculations
 */

/**
 * Calculate working hours between check-in and check-out
 * @param {Date} checkIn - Check-in time
 * @param {Date} checkOut - Check-out time
 * @param {number} breakTimeMinutes - Break time in minutes
 * @returns {number} - Working hours
 */
export const calculateWorkingHours = (checkIn, checkOut, breakTimeMinutes = 0) => {
  if (!checkIn || !checkOut) return 0;

  const checkInTime = new Date(checkIn);
  const checkOutTime = new Date(checkOut);

  const diffMs = checkOutTime - checkInTime;
  const diffHours = diffMs / (1000 * 60 * 60);

  const breakHours = breakTimeMinutes / 60;
  const workingHours = Math.max(0, diffHours - breakHours);

  return Math.round(workingHours * 100) / 100;
};

/**
 * Calculate overtime hours
 * @param {number} workingHours - Actual working hours
 * @param {number} standardHours - Standard working hours (default 8)
 * @returns {number} - Overtime hours
 */
export const calculateOvertimeHours = (workingHours, standardHours = 8) => {
  const overtime = Math.max(0, workingHours - standardHours);
  return Math.round(overtime * 100) / 100;
};

/**
 * Determine attendance status based on working hours
 * @param {number} workingHours - Actual working hours
 * @param {number} standardHours - Standard working hours (default 8)
 * @returns {string} - Attendance status
 */
export const determineAttendanceStatus = (workingHours, standardHours = 8) => {
  if (workingHours >= standardHours) {
    return 'Present';
  } else if (workingHours >= standardHours / 2) {
    return 'Half Day';
  } else if (workingHours > 0) {
    return 'Half Day';
  }
  return 'Absent';
};

/**
 * Check if employee is late
 * @param {Date} checkIn - Check-in time
 * @param {string} shiftStartTime - Shift start time (HH:mm format)
 * @param {number} graceMinutes - Grace period in minutes (default 15)
 * @returns {object} - Object with isLate and minutes
 */
export const checkLateArrival = (checkIn, shiftStartTime = '09:00', graceMinutes = 15) => {
  if (!checkIn) return { isLate: false, minutes: 0 };

  const checkInTime = new Date(checkIn);
  const [hours, minutes] = shiftStartTime.split(':').map(Number);

  const shiftStart = new Date(checkInTime);
  shiftStart.setHours(hours, minutes, 0, 0);

  const graceTime = new Date(shiftStart.getTime() + graceMinutes * 60000);

  if (checkInTime > graceTime) {
    const lateMinutes = Math.floor((checkInTime - shiftStart) / 60000);
    return { isLate: true, minutes: lateMinutes };
  }

  return { isLate: false, minutes: 0 };
};

/**
 * Check if employee left early
 * @param {Date} checkOut - Check-out time
 * @param {string} shiftEndTime - Shift end time (HH:mm format)
 * @param {number} graceMinutes - Grace period in minutes (default 15)
 * @returns {object} - Object with isEarly and minutes
 */
export const checkEarlyDeparture = (checkOut, shiftEndTime = '18:00', graceMinutes = 15) => {
  if (!checkOut) return { isEarly: false, minutes: 0 };

  const checkOutTime = new Date(checkOut);
  const [hours, minutes] = shiftEndTime.split(':').map(Number);

  const shiftEnd = new Date(checkOutTime);
  shiftEnd.setHours(hours, minutes, 0, 0);

  const graceTime = new Date(shiftEnd.getTime() - graceMinutes * 60000);

  if (checkOutTime < graceTime) {
    const earlyMinutes = Math.floor((shiftEnd - checkOutTime) / 60000);
    return { isEarly: true, minutes: earlyMinutes };
  }

  return { isEarly: false, minutes: 0 };
};

/**
 * Calculate monthly attendance summary
 * @param {Array} attendanceRecords - Array of attendance records
 * @returns {object} - Monthly summary
 */
export const calculateMonthlySummary = (attendanceRecords = []) => {
  const summary = {
    totalDays: attendanceRecords.length,
    present: 0,
    absent: 0,
    halfDay: 0,
    late: 0,
    onLeave: 0,
    holiday: 0,
    weekOff: 0,
    totalWorkingHours: 0,
    totalOvertimeHours: 0,
    averageWorkingHours: 0
  };

  attendanceRecords.forEach(record => {
    switch (record.status) {
      case 'Present':
        summary.present++;
        break;
      case 'Absent':
        summary.absent++;
        break;
      case 'Half Day':
        summary.halfDay++;
        break;
      case 'Late':
        summary.late++;
        summary.present++; // Late is still considered present
        break;
      case 'On Leave':
        summary.onLeave++;
        break;
      case 'Holiday':
        summary.holiday++;
        break;
      case 'Week Off':
        summary.weekOff++;
        break;
    }

    summary.totalWorkingHours += record.workingHours || 0;
    summary.totalOvertimeHours += record.overtimeHours || 0;
  });

  // Calculate average working hours (excluding holidays and week offs)
  const workingDays = summary.totalDays - summary.holiday - summary.weekOff;
  summary.averageWorkingHours = workingDays > 0
    ? Math.round((summary.totalWorkingHours / workingDays) * 100) / 100
    : 0;

  summary.totalWorkingHours = Math.round(summary.totalWorkingHours * 100) / 100;
  summary.totalOvertimeHours = Math.round(summary.totalOvertimeHours * 100) / 100;

  return summary;
};

/**
 * Calculate attendance percentage
 * @param {number} presentDays - Number of present days
 * @param {number} totalWorkingDays - Total working days
 * @returns {number} - Attendance percentage
 */
export const calculateAttendancePercentage = (presentDays, totalWorkingDays) => {
  if (totalWorkingDays === 0) return 0;
  const percentage = (presentDays / totalWorkingDays) * 100;
  return Math.round(percentage * 100) / 100;
};

/**
 * Get working days in a month (excluding weekends)
 * @param {number} month - Month (1-12)
 * @param {number} year - Year
 * @param {Array} weekendDays - Weekend days (0=Sunday, 6=Saturday)
 * @returns {number} - Number of working days
 */
export const getWorkingDaysInMonth = (month, year, weekendDays = [0, 6]) => {
  const daysInMonth = new Date(year, month, 0).getDate();
  let workingDays = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay();

    if (!weekendDays.includes(dayOfWeek)) {
      workingDays++;
    }
  }

  return workingDays;
};

/**
 * Check if a date is a weekend
 * @param {Date} date - Date to check
 * @param {Array} weekendDays - Weekend days (0=Sunday, 6=Saturday)
 * @returns {boolean} - True if weekend
 */
export const isWeekend = (date, weekendDays = [0, 6]) => {
  const dayOfWeek = new Date(date).getDay();
  return weekendDays.includes(dayOfWeek);
};

/**
 * Calculate punctuality score based on late arrivals
 * @param {number} totalDays - Total working days
 * @param {number} lateDays - Number of late arrivals
 * @returns {number} - Punctuality score (0-100)
 */
export const calculatePunctualityScore = (totalDays, lateDays) => {
  if (totalDays === 0) return 100;
  const score = ((totalDays - lateDays) / totalDays) * 100;
  return Math.round(score * 100) / 100;
};

/**
 * Generate attendance report for an employee
 * @param {Array} attendanceRecords - Array of attendance records
 * @param {number} month - Month
 * @param {number} year - Year
 * @returns {object} - Detailed attendance report
 */
export const generateAttendanceReport = (attendanceRecords, month, year) => {
  const summary = calculateMonthlySummary(attendanceRecords);
  const workingDays = getWorkingDaysInMonth(month, year);
  const actualWorkingDays = workingDays - summary.holiday;

  const attendancePercentage = calculateAttendancePercentage(
    summary.present + summary.late,
    actualWorkingDays
  );

  const punctualityScore = calculatePunctualityScore(
    summary.present + summary.late,
    summary.late
  );

  return {
    month,
    year,
    summary,
    workingDays,
    actualWorkingDays,
    attendancePercentage,
    punctualityScore,
    generatedAt: new Date()
  };
};

export default {
  calculateWorkingHours,
  calculateOvertimeHours,
  determineAttendanceStatus,
  checkLateArrival,
  checkEarlyDeparture,
  calculateMonthlySummary,
  calculateAttendancePercentage,
  getWorkingDaysInMonth,
  isWeekend,
  calculatePunctualityScore,
  generateAttendanceReport
};
