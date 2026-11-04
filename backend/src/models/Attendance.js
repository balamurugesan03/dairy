import mongoose from 'mongoose';

export const ATTENDANCE_STATUSES = ['Present', 'Absent', 'Half Day', 'Leave', 'Holiday', 'Week Off'];

const attendanceSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  date: { type: Date, required: true },
  status: { type: String, enum: ATTENDANCE_STATUSES, default: 'Present' },
  overtimeHours: { type: Number, default: 0, min: 0 },
  remarks: { type: String, trim: true },
  // Set when the day was filled by an approved leave
  leaveId: { type: mongoose.Schema.Types.ObjectId, ref: 'Leave' },
  leaveType: { type: String }
}, { timestamps: true });

// One attendance record per employee per day
attendanceSchema.index({ companyId: 1, employeeId: 1, date: 1 }, { unique: true });
attendanceSchema.index({ companyId: 1, date: 1 });

const Attendance = mongoose.model('Attendance', attendanceSchema);
export default Attendance;
