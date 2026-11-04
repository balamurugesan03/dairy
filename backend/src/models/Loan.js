import mongoose from 'mongoose';

const repaymentSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  amount: { type: Number, required: true, min: 0 },
  mode: { type: String, enum: ['Cash', 'Bank', 'Salary'], default: 'Cash' },
  voucherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Voucher' },
  payrollId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payroll' },
  remarks: { type: String, trim: true }
}, { _id: true });

const loanSchema = new mongoose.Schema({
  companyId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Company',  required: true },
  employeeId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  loanType:        { type: String, enum: ['Loan', 'Advance'], default: 'Loan' },
  loanDate:        { type: Date, default: Date.now },
  totalAmount:     { type: Number, required: true, min: 0 },
  paidAmount:      { type: Number, default: 0, min: 0 },
  remainingAmount: { type: Number },
  // Monthly instalment recovered through payroll.
  // 0 → Advance: whole balance next salary; Loan: not auto-recovered.
  emiAmount:       { type: Number, default: 0, min: 0 },
  deductFromSalary:{ type: Boolean, default: true },
  purpose:         { type: String, trim: true },
  status:          { type: String, enum: ['Active', 'Closed'], default: 'Active' },
  disbursalMode:   { type: String, enum: ['Cash', 'Bank'], default: 'Cash' },
  disbursalVoucherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Voucher' },
  // Opening balance carried in from before repayments were tracked
  legacyPaid:      { type: Number, min: 0 },   // no default: undefined marks a pre-history record
  repayments:      [repaymentSchema]
}, { timestamps: true });

// paid / remaining / status are always derived from repayments (Mongoose 9: no next())
loanSchema.pre('save', function () {
  if (this.legacyPaid == null) {
    // Records saved before repayment history existed keep their old paidAmount.
    this.legacyPaid = (!this.isNew && !(this.repayments || []).length) ? (this.paidAmount || 0) : 0;
  }
  const repaid = (this.repayments || []).reduce((s, r) => s + (r.amount || 0), 0);
  this.paidAmount = Math.round(((this.legacyPaid || 0) + repaid) * 100) / 100;
  this.remainingAmount = Math.round(((this.totalAmount || 0) - this.paidAmount) * 100) / 100;
  if (this.remainingAmount <= 0) {
    this.remainingAmount = 0;
    this.status = 'Closed';
  } else {
    this.status = 'Active';
  }
});

loanSchema.index({ companyId: 1, employeeId: 1, status: 1 });

const Loan = mongoose.model('Loan', loanSchema);
export default Loan;
