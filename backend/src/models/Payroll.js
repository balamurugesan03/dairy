import mongoose from 'mongoose';

const payrollSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  basicSalary: { type: Number, required: true, min: 0 },
  overtime: { type: Number, default: 0, min: 0 },
  deduction: { type: Number, default: 0, min: 0 },
  netSalary: { type: Number },
  month: { type: Number, required: true, min: 1, max: 12 },
  year: { type: Number, required: true },
  status: { type: String, enum: ['Pending', 'Approved', 'Paid'], default: 'Pending' },
  paidDate: { type: Date }
}, { timestamps: true });

// Auto-calculate net salary before save
payrollSchema.pre('save', function (next) {
  this.netSalary = (this.basicSalary || 0) + (this.overtime || 0) - (this.deduction || 0);
  next();
});

// One payroll per employee per month+year
payrollSchema.index({ companyId: 1, employeeId: 1, month: 1, year: 1 }, { unique: true });

const Payroll = mongoose.model('Payroll', payrollSchema);
export default Payroll;
