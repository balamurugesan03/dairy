import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },

  date: {
    type: Date,
    required: true
  },

  checkIn: {
    type: Date
  },

  checkOut: {
    type: Date
  },

  status: {
    type: String,
    enum: ['Present', 'Absent', 'Half Day', 'Late', 'On Leave', 'Holiday', 'Week Off'],
    default: 'Absent'
  },

  shift: {
    type: String,
    enum: ['Morning', 'Evening', 'Night', 'General'],
    default: 'General'
  },

  workingHours: {
    type: Number,
    default: 0 // Calculated in hours
  },

  overtimeHours: {
    type: Number,
    default: 0
  },

  lateArrival: {
    isLate: { type: Boolean, default: false },
    minutes: { type: Number, default: 0 }
  },

  earlyDeparture: {
    isEarly: { type: Boolean, default: false },
    minutes: { type: Number, default: 0 }
  },

  breakTime: {
    type: Number,
    default: 0 // in minutes
  },

  location: {
    checkInLocation: { type: String },
    checkOutLocation: { type: String }
  },

  remarks: {
    type: String
  },

  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },

  isApproved: {
    type: Boolean,
    default: false
  }

}, {
  timestamps: true
});

// Compound index for employee and date (one record per employee per day)
attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });
attendanceSchema.index({ date: 1 });
attendanceSchema.index({ status: 1 });
attendanceSchema.index({ employee: 1, date: -1 });

// Pre-save middleware to calculate working hours
attendanceSchema.pre('save', function() {
  if (this.checkIn && this.checkOut) {
    // Calculate working hours
    const checkInTime = new Date(this.checkIn);
    const checkOutTime = new Date(this.checkOut);
    const diffMs = checkOutTime - checkInTime;
    const diffHours = diffMs / (1000 * 60 * 60);

    // Subtract break time
    const breakHours = this.breakTime / 60;
    this.workingHours = Math.max(0, diffHours - breakHours);

    // Calculate overtime (assuming 8 hours is standard)
    const standardHours = 8;
    this.overtimeHours = Math.max(0, this.workingHours - standardHours);

    // Auto-set status based on working hours
    if (this.workingHours >= standardHours) {
      this.status = 'Present';
    } else if (this.workingHours >= standardHours / 2) {
      this.status = 'Half Day';
    }
  }
});

// Static method to get attendance for a date range
attendanceSchema.statics.getAttendanceByDateRange = function(employeeId, startDate, endDate) {
  return this.find({
    employee: employeeId,
    date: {
      $gte: startDate,
      $lte: endDate
    }
  }).sort({ date: -1 });
};

// Static method to get monthly attendance summary
attendanceSchema.statics.getMonthlySummary = async function(employeeId, month, year) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  const attendance = await this.find({
    employee: employeeId,
    date: {
      $gte: startDate,
      $lte: endDate
    }
  });

  const summary = {
    totalDays: attendance.length,
    present: attendance.filter(a => a.status === 'Present').length,
    absent: attendance.filter(a => a.status === 'Absent').length,
    halfDay: attendance.filter(a => a.status === 'Half Day').length,
    late: attendance.filter(a => a.status === 'Late').length,
    onLeave: attendance.filter(a => a.status === 'On Leave').length,
    holiday: attendance.filter(a => a.status === 'Holiday').length,
    weekOff: attendance.filter(a => a.status === 'Week Off').length,
    totalWorkingHours: attendance.reduce((sum, a) => sum + (a.workingHours || 0), 0),
    totalOvertimeHours: attendance.reduce((sum, a) => sum + (a.overtimeHours || 0), 0)
  };

  return summary;
};

// Instance method to mark as late
attendanceSchema.methods.markAsLate = function(minutes) {
  this.lateArrival.isLate = true;
  this.lateArrival.minutes = minutes;
  this.status = 'Late';
};

const Attendance = mongoose.model('Attendance', attendanceSchema);

export default Attendance;
