import mongoose from 'mongoose';

const r2 = (n) => Math.round((n || 0) * 100) / 100;

const payrollSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  month: { type: Number, required: true, min: 1, max: 12 },
  year: { type: Number, required: true },
  salaryType: { type: String, enum: ['Monthly', 'Daily'], default: 'Monthly' },
  fixedSalary: { type: Number, default: 0 },       // employee salary at processing time

  // ── Attendance snapshot ──────────────────────────────────
  attendance: {
    daysInMonth: { type: Number, default: 0 },
    present: { type: Number, default: 0 },
    halfDay: { type: Number, default: 0 },
    absent: { type: Number, default: 0 },
    paidLeave: { type: Number, default: 0 },
    unpaidLeave: { type: Number, default: 0 },
    holiday: { type: Number, default: 0 },
    weekOff: { type: Number, default: 0 },
    unmarked: { type: Number, default: 0 },
    notEmployed: { type: Number, default: 0 },
    lopDays: { type: Number, default: 0 },
    paidDays: { type: Number, default: 0 }
  },

  // ── Earnings ─────────────────────────────────────────────
  earnings: {
    basic: { type: Number, default: 0 },
    da: { type: Number, default: 0 },
    hra: { type: Number, default: 0 },
    ta: { type: Number, default: 0 },
    otherAllowance: { type: Number, default: 0 },
    overtimeHours: { type: Number, default: 0 },
    overtimeRate: { type: Number, default: 0 },
    overtimeAmount: { type: Number, default: 0 },
    bonus: { type: Number, default: 0 },
    arrears: { type: Number, default: 0 }
  },

  // ── Deductions ───────────────────────────────────────────
  deductions: {
    pf: { type: Number, default: 0 },
    esi: { type: Number, default: 0 },
    professionalTax: { type: Number, default: 0 },
    loanRecovery: { type: Number, default: 0 },
    advanceRecovery: { type: Number, default: 0 },
    other: { type: Number, default: 0 }
  },
  loanRecoveries: [{
    loanId: { type: mongoose.Schema.Types.ObjectId, ref: 'Loan' },
    loanType: { type: String },
    amount: { type: Number, default: 0 }
  }],

  // ── Totals (legacy field names kept for old records/reports) ──
  basicSalary: { type: Number, default: 0 },   // earned basic (legacy: fixed salary)
  overtime: { type: Number, default: 0 },      // = earnings.overtimeAmount
  grossSalary: { type: Number, default: 0 },
  deduction: { type: Number, default: 0 },     // = total deductions
  netSalary: { type: Number },

  manualOvertime: { type: Boolean, default: false },   // OT hours typed in, not from attendance
  remarks: { type: String, trim: true },
  status: { type: String, enum: ['Pending', 'Approved', 'Paid'], default: 'Pending' },
  approvedAt: { type: Date },
  paidDate: { type: Date },
  paymentMode: { type: String, enum: ['Cash', 'Bank'] },
  bankLedgerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ledger' },
  voucherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Voucher' }
}, { timestamps: true });

// Totals are always derived (Mongoose 9: no next())
payrollSchema.pre('save', function () {
  const e = this.earnings || {};
  const d = this.deductions || {};
  const structured = !!(e.basic || e.da || e.hra || e.ta || e.otherAllowance ||
    e.overtimeAmount || e.bonus || e.arrears);

  if (structured) {
    this.basicSalary = r2(e.basic);
    this.overtime = r2(e.overtimeAmount);
    this.grossSalary = r2((e.basic || 0) + (e.da || 0) + (e.hra || 0) + (e.ta || 0) +
      (e.otherAllowance || 0) + (e.overtimeAmount || 0) + (e.bonus || 0) + (e.arrears || 0));
  } else {
    // Legacy record: basic + overtime
    this.grossSalary = r2((this.basicSalary || 0) + (this.overtime || 0));
  }

  const dedTotal = (d.pf || 0) + (d.esi || 0) + (d.professionalTax || 0) +
    (d.loanRecovery || 0) + (d.advanceRecovery || 0) + (d.other || 0);
  if (dedTotal > 0 || structured) this.deduction = r2(dedTotal);

  this.netSalary = r2(this.grossSalary - (this.deduction || 0));
});

// One payroll per employee per month+year
payrollSchema.index({ companyId: 1, employeeId: 1, month: 1, year: 1 }, { unique: true });
payrollSchema.index({ companyId: 1, year: 1, month: 1, status: 1 });

const Payroll = mongoose.model('Payroll', payrollSchema);
export default Payroll;
