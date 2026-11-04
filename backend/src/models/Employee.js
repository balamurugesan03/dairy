import mongoose from 'mongoose';

// Default yearly leave allotment (days). Unpaid / Maternity / Paternity /
// Compensatory have no quota — they are not balance-checked.
export const DEFAULT_LEAVE_QUOTA = { Casual: 12, Sick: 12, Earned: 15 };

const employeeSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  employeeCode: { type: String, trim: true },               // EMP-001 (auto)

  // ── Personal ─────────────────────────────────────────────
  name: { type: String, required: true, trim: true },
  fatherName: { type: String, trim: true },
  gender: { type: String, enum: ['Male', 'Female', 'Other', ''], default: '' },
  dob: { type: Date },
  mobile: { type: String, required: true, trim: true },
  email: { type: String, trim: true },
  address: { type: String, trim: true },
  emergencyContact: { type: String, trim: true },
  aadhaar: { type: String, trim: true },
  pan: { type: String, trim: true, uppercase: true },

  // ── Job ──────────────────────────────────────────────────
  department: { type: String, trim: true },
  role: { type: String, trim: true },                        // designation
  employmentType: { type: String, enum: ['Permanent', 'Temporary', 'Contract', 'Daily Wage'], default: 'Permanent' },
  joiningDate: { type: Date, default: Date.now },
  exitDate: { type: Date },
  exitReason: { type: String, trim: true },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },

  // ── Salary ───────────────────────────────────────────────
  // Monthly → `salary` is the monthly gross (sum of salaryStructure when given).
  // Daily   → `salary` is the per-day wage.
  salaryType: { type: String, enum: ['Monthly', 'Daily'], default: 'Monthly' },
  salary: { type: Number, required: true, min: 0 },
  salaryStructure: {
    basic: { type: Number, default: 0, min: 0 },
    da: { type: Number, default: 0, min: 0 },
    hra: { type: Number, default: 0, min: 0 },
    ta: { type: Number, default: 0, min: 0 },
    otherAllowance: { type: Number, default: 0, min: 0 }
  },
  otRatePerHour: { type: Number, default: 0, min: 0 },       // 0 → derived from salary

  // ── Statutory ────────────────────────────────────────────
  pfApplicable: { type: Boolean, default: false },
  pfPercent: { type: Number, default: 12, min: 0 },           // on Basic + DA
  pfNumber: { type: String, trim: true },
  esiApplicable: { type: Boolean, default: false },
  esiPercent: { type: Number, default: 0.75, min: 0 },        // on gross
  esiNumber: { type: String, trim: true },
  professionalTax: { type: Number, default: 0, min: 0 },      // fixed per month

  // ── Payment ──────────────────────────────────────────────
  paymentMode: { type: String, enum: ['Cash', 'Bank'], default: 'Cash' },
  bankName: { type: String, trim: true },
  accountNo: { type: String, trim: true },
  ifsc: { type: String, trim: true, uppercase: true },

  // ── Leave allotment per year ─────────────────────────────
  leaveQuota: {
    Casual: { type: Number, default: DEFAULT_LEAVE_QUOTA.Casual, min: 0 },
    Sick: { type: Number, default: DEFAULT_LEAVE_QUOTA.Sick, min: 0 },
    Earned: { type: Number, default: DEFAULT_LEAVE_QUOTA.Earned, min: 0 }
  }
}, { timestamps: true });

// Monthly gross = sum of the structure when one is entered (Mongoose 9: no next()).
export const structureTotal = (s = {}) =>
  (Number(s.basic) || 0) + (Number(s.da) || 0) + (Number(s.hra) || 0) +
  (Number(s.ta) || 0) + (Number(s.otherAllowance) || 0);

// pre('validate') so `salary` (required) is filled before validation runs.
employeeSchema.pre('validate', function () {
  if (this.salaryType !== 'Daily') {
    const total = structureTotal(this.salaryStructure);
    if (total > 0) this.salary = total;
  }
});

employeeSchema.index({ companyId: 1, status: 1 });
employeeSchema.index(
  { companyId: 1, employeeCode: 1 },
  { unique: true, partialFilterExpression: { employeeCode: { $type: 'string' } } }
);

const Employee = mongoose.model('Employee', employeeSchema);
export default Employee;
