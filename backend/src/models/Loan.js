import mongoose from 'mongoose';

const loanSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  totalAmount: { type: Number, required: true, min: 0 },
  paidAmount: { type: Number, default: 0, min: 0 },
  remainingAmount: { type: Number },
  purpose: { type: String, trim: true },
  status: { type: String, enum: ['Active', 'Closed'], default: 'Active' }
}, { timestamps: true });

// Auto-calculate remaining amount
loanSchema.pre('save', function (next) {
  this.remainingAmount = (this.totalAmount || 0) - (this.paidAmount || 0);
  if (this.remainingAmount <= 0) {
    this.remainingAmount = 0;
    this.status = 'Closed';
  }
  next();
});

loanSchema.index({ companyId: 1, employeeId: 1, status: 1 });

const Loan = mongoose.model('Loan', loanSchema);
export default Loan;
