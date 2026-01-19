import mongoose from 'mongoose';

const salarySchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },

  month: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },

  year: {
    type: Number,
    required: true
  },

  // Earnings
  earnings: {
    basicSalary: { type: Number, required: true, default: 0 },
    allowances: {
      hra: { type: Number, default: 0 },
      da: { type: Number, default: 0 },
      ta: { type: Number, default: 0 },
      medical: { type: Number, default: 0 },
      special: { type: Number, default: 0 },
      other: { type: Number, default: 0 }
    },
    overtime: {
      hours: { type: Number, default: 0 },
      ratePerHour: { type: Number, default: 0 },
      amount: { type: Number, default: 0 }
    },
    bonus: { type: Number, default: 0 },
    incentive: { type: Number, default: 0 }
  },

  // Deductions
  deductions: {
    pf: { type: Number, default: 0 },
    esi: { type: Number, default: 0 },
    pt: { type: Number, default: 0 },
    tds: { type: Number, default: 0 },
    loan: { type: Number, default: 0 },
    advance: { type: Number, default: 0 },
    lossOfPay: {
      days: { type: Number, default: 0 },
      amount: { type: Number, default: 0 }
    },
    other: { type: Number, default: 0 }
  },

  // Attendance summary
  attendanceSummary: {
    totalDays: { type: Number, default: 0 },
    presentDays: { type: Number, default: 0 },
    absentDays: { type: Number, default: 0 },
    halfDays: { type: Number, default: 0 },
    paidLeaveDays: { type: Number, default: 0 },
    unpaidLeaveDays: { type: Number, default: 0 },
    holidays: { type: Number, default: 0 },
    workingHours: { type: Number, default: 0 },
    overtimeHours: { type: Number, default: 0 }
  },

  // Salary calculations
  grossSalary: {
    type: Number,
    default: 0
  },

  totalDeductions: {
    type: Number,
    default: 0
  },

  netSalary: {
    type: Number,
    default: 0
  },

  // Payment details
  paymentDetails: {
    paymentDate: { type: Date },
    paymentMethod: {
      type: String,
      enum: ['Bank Transfer', 'Cash', 'Cheque', 'UPI'],
      default: 'Bank Transfer'
    },
    transactionId: { type: String },
    isPaid: { type: Boolean, default: false }
  },

  // Payslip generation
  payslipGenerated: {
    type: Boolean,
    default: false
  },

  payslipGeneratedDate: {
    type: Date
  },

  status: {
    type: String,
    enum: ['Draft', 'Processed', 'Approved', 'Paid', 'Hold'],
    default: 'Draft'
  },

  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },

  approvedDate: {
    type: Date
  },

  remarks: {
    type: String
  }

}, {
  timestamps: true
});

// Compound index for employee, month, and year (one record per employee per month)
salarySchema.index({ employee: 1, month: 1, year: 1 }, { unique: true });
salarySchema.index({ employee: 1 });
salarySchema.index({ month: 1, year: 1 });
salarySchema.index({ status: 1 });
salarySchema.index({ 'paymentDetails.isPaid': 1 });

// Pre-save middleware to calculate gross, deductions, and net salary
salarySchema.pre('save', function() {
  // Calculate total earnings
  const basicSalary = this.earnings.basicSalary || 0;
  const totalAllowances = Object.values(this.earnings.allowances).reduce((sum, val) => sum + (val || 0), 0);
  const overtimeAmount = this.earnings.overtime.amount || 0;
  const bonus = this.earnings.bonus || 0;
  const incentive = this.earnings.incentive || 0;

  this.grossSalary = basicSalary + totalAllowances + overtimeAmount + bonus + incentive;

  // Calculate total deductions (excluding lossOfPay which is already calculated)
  const deductionValues = { ...this.deductions };
  delete deductionValues.lossOfPay; // Handle separately
  const totalRegularDeductions = Object.values(deductionValues).reduce((sum, val) => sum + (val || 0), 0);
  const lossOfPayAmount = this.deductions.lossOfPay.amount || 0;

  this.totalDeductions = totalRegularDeductions + lossOfPayAmount;

  // Calculate net salary
  this.netSalary = this.grossSalary - this.totalDeductions;
});

// Static method to get salary for a specific month/year
salarySchema.statics.getSalaryByMonth = function(employeeId, month, year) {
  return this.findOne({
    employee: employeeId,
    month: month,
    year: year
  }).populate('employee approvedBy');
};

// Static method to get all pending salaries
salarySchema.statics.getPendingSalaries = function() {
  return this.find({
    status: { $in: ['Draft', 'Processed'] }
  }).populate('employee');
};

// Static method to get unpaid salaries
salarySchema.statics.getUnpaidSalaries = function() {
  return this.find({
    'paymentDetails.isPaid': false,
    status: 'Approved'
  }).populate('employee');
};

// Instance method to mark as paid
salarySchema.methods.markAsPaid = function(paymentMethod, transactionId) {
  this.paymentDetails.isPaid = true;
  this.paymentDetails.paymentDate = new Date();
  this.paymentDetails.paymentMethod = paymentMethod;
  this.paymentDetails.transactionId = transactionId;
  this.status = 'Paid';
  return this.save();
};

// Instance method to approve salary
salarySchema.methods.approve = function(approvedBy) {
  this.status = 'Approved';
  this.approvedBy = approvedBy;
  this.approvedDate = new Date();
  return this.save();
};

// Instance method to generate payslip
salarySchema.methods.generatePayslip = function() {
  this.payslipGenerated = true;
  this.payslipGeneratedDate = new Date();
  return this.save();
};

const Salary = mongoose.model('Salary', salarySchema);

export default Salary;
