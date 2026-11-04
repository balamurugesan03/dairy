import mongoose from 'mongoose';

export const LEAVE_TYPES = ['Casual', 'Sick', 'Earned', 'Maternity', 'Paternity', 'Unpaid', 'Compensatory'];
// Types counted against the employee's yearly quota
export const QUOTA_LEAVE_TYPES = ['Casual', 'Sick', 'Earned'];

const leaveSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  fromDate: { type: Date, required: true },
  toDate: { type: Date, required: true },
  days: { type: Number, default: 1 },
  reason: { type: String, trim: true },
  leaveType: { type: String, enum: LEAVE_TYPES, default: 'Casual' },
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected', 'Cancelled'], default: 'Pending' },
  remarks: { type: String, trim: true },
  rejectionReason: { type: String },
  actionedAt: { type: Date }
}, { timestamps: true });

// Mongoose 9: no next()
leaveSchema.pre('save', function () {
  const from = new Date(this.fromDate); from.setHours(0, 0, 0, 0);
  const to = new Date(this.toDate); to.setHours(0, 0, 0, 0);
  this.days = Math.max(1, Math.round((to - from) / 86400000) + 1);
});

leaveSchema.index({ companyId: 1, employeeId: 1 });
leaveSchema.index({ companyId: 1, status: 1 });

const Leave = mongoose.model('Leave', leaveSchema);
export default Leave;
