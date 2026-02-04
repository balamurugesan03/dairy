import mongoose from 'mongoose';

const emiScheduleSchema = new mongoose.Schema({
  emiNumber: {
    type: Number,
    required: true
  },
  dueDate: {
    type: Date,
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  paidAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  paidDate: Date,
  status: {
    type: String,
    enum: ['Pending', 'Partial', 'Paid', 'Overdue'],
    default: 'Pending'
  },
  paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FarmerPayment'
  },
  remarks: String
});

const producerLoanSchema = new mongoose.Schema({
  // Auto-generated loan number
  loanNumber: {
    type: String,
    unique: true
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company'
  },
  farmerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Farmer',
    required: [true, 'Farmer is required']
  },
  loanDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  // Loan type categorization
  loanType: {
    type: String,
    enum: ['Cash Advance', 'CF Advance', 'Loan Advance'],
    required: [true, 'Loan type is required']
  },
  // Loan scheme for EMI calculation
  loanScheme: {
    type: String,
    enum: ['Monthly', 'Weekly', 'Custom'],
    default: 'Monthly'
  },
  // Principal amount
  principalAmount: {
    type: Number,
    required: [true, 'Principal amount is required'],
    min: [1, 'Principal amount must be greater than 0']
  },
  // Interest details
  interestType: {
    type: String,
    enum: ['Percentage', 'Flat'],
    default: 'Percentage'
  },
  interestRate: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  interestAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  // Total loan amount (principal + interest)
  totalLoanAmount: {
    type: Number,
    required: true,
    min: 0
  },
  // EMI details
  totalEMI: {
    type: Number,
    required: [true, 'Total EMI count is required'],
    min: 1
  },
  emiAmount: {
    type: Number,
    required: true,
    min: 0
  },
  // EMI schedule
  emiSchedule: [emiScheduleSchema],
  // Payment mode for disbursement
  paymentMode: {
    type: String,
    enum: ['Cash', 'Bank', 'UPI', 'Cheque'],
    default: 'Cash'
  },
  bankDetails: {
    bankName: String,
    accountNumber: String,
    ifscCode: String,
    transactionId: String,
    upiId: String
  },
  chequeNumber: String,
  chequeDate: Date,
  // Amount tracking
  disbursedAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  outstandingAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  recoveredAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  // Voucher reference for accounting
  voucherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Voucher'
  },
  // Status tracking
  status: {
    type: String,
    enum: ['Active', 'Closed', 'Defaulted', 'Cancelled'],
    default: 'Active'
  },
  // Additional details
  purpose: {
    type: String,
    trim: true,
    maxlength: 500
  },
  remarks: {
    type: String,
    trim: true,
    maxlength: 500
  },
  guarantorName: String,
  guarantorPhone: String,
  // Cancellation details
  cancelledAt: Date,
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  cancellationReason: String,
  // Closure details
  closedAt: Date,
  closedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Created by
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes for faster queries
producerLoanSchema.index({ companyId: 1, loanDate: -1 });
producerLoanSchema.index({ farmerId: 1, loanDate: -1 });
producerLoanSchema.index({ status: 1 });
producerLoanSchema.index({ loanNumber: 1 });
producerLoanSchema.index({ loanType: 1 });

// Pre-save hook to generate loan number and calculate amounts
producerLoanSchema.pre('save', async function(next) {
  // Generate loan number if not exists
  if (!this.loanNumber) {
    const count = await this.constructor.countDocuments({ companyId: this.companyId });
    const year = new Date().getFullYear().toString().slice(-2);
    const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
    this.loanNumber = `LOAN${year}${month}${(count + 1).toString().padStart(5, '0')}`;
  }

  // Calculate interest amount
  if (this.interestType === 'Percentage' && this.interestRate > 0) {
    this.interestAmount = (this.principalAmount * this.interestRate) / 100;
  } else if (this.interestType === 'Flat') {
    // interestAmount is directly set for flat interest
  }

  // Calculate total loan amount
  this.totalLoanAmount = this.principalAmount + this.interestAmount;

  // Calculate EMI amount
  if (this.totalEMI > 0) {
    this.emiAmount = Math.ceil(this.totalLoanAmount / this.totalEMI);
  }

  // Set disbursed amount
  if (this.isNew) {
    this.disbursedAmount = this.principalAmount;
    this.outstandingAmount = this.totalLoanAmount;
  }

  // Generate EMI schedule if not exists and loan is new
  if (this.isNew && (!this.emiSchedule || this.emiSchedule.length === 0)) {
    const schedule = [];
    const startDate = new Date(this.loanDate);

    for (let i = 1; i <= this.totalEMI; i++) {
      const dueDate = new Date(startDate);

      if (this.loanScheme === 'Monthly') {
        dueDate.setMonth(dueDate.getMonth() + i);
      } else if (this.loanScheme === 'Weekly') {
        dueDate.setDate(dueDate.getDate() + (i * 7));
      } else {
        // Custom - default to monthly
        dueDate.setMonth(dueDate.getMonth() + i);
      }

      // Last EMI might be different due to rounding
      const emiAmt = i === this.totalEMI
        ? this.totalLoanAmount - (this.emiAmount * (this.totalEMI - 1))
        : this.emiAmount;

      schedule.push({
        emiNumber: i,
        dueDate,
        amount: emiAmt,
        paidAmount: 0,
        status: 'Pending'
      });
    }

    this.emiSchedule = schedule;
  }

  // Update status based on recovery
  if (this.status !== 'Cancelled') {
    if (this.outstandingAmount <= 0 && this.recoveredAmount >= this.totalLoanAmount) {
      this.status = 'Closed';
      if (!this.closedAt) {
        this.closedAt = new Date();
      }
    }
  }

  next();
});

// Virtual for farmer details
producerLoanSchema.virtual('farmer', {
  ref: 'Farmer',
  localField: 'farmerId',
  foreignField: '_id',
  justOne: true
});

// Method to check for overdue EMIs
producerLoanSchema.methods.checkOverdueEMIs = function() {
  const today = new Date();
  let hasOverdue = false;

  this.emiSchedule.forEach(emi => {
    if (emi.status === 'Pending' && new Date(emi.dueDate) < today) {
      emi.status = 'Overdue';
      hasOverdue = true;
    }
  });

  if (hasOverdue && this.status === 'Active') {
    this.status = 'Defaulted';
  }

  return hasOverdue;
};

// Method to record EMI payment
producerLoanSchema.methods.recordEMIPayment = function(emiNumber, amount, paymentId) {
  const emi = this.emiSchedule.find(e => e.emiNumber === emiNumber);

  if (!emi) {
    throw new Error('EMI not found');
  }

  emi.paidAmount += amount;
  emi.paymentId = paymentId;
  emi.paidDate = new Date();

  if (emi.paidAmount >= emi.amount) {
    emi.status = 'Paid';
  } else if (emi.paidAmount > 0) {
    emi.status = 'Partial';
  }

  // Update loan totals
  this.recoveredAmount += amount;
  this.outstandingAmount = this.totalLoanAmount - this.recoveredAmount;

  // Check if loan is fully paid
  if (this.outstandingAmount <= 0) {
    this.status = 'Closed';
    this.closedAt = new Date();
  }

  return emi;
};

// Static method to get farmer's total outstanding loans
producerLoanSchema.statics.getFarmerOutstanding = async function(farmerId) {
  const result = await this.aggregate([
    {
      $match: {
        farmerId: new mongoose.Types.ObjectId(farmerId),
        status: { $in: ['Active', 'Defaulted'] }
      }
    },
    {
      $group: {
        _id: null,
        totalOutstanding: { $sum: '$outstandingAmount' },
        totalDisbursed: { $sum: '$disbursedAmount' },
        totalRecovered: { $sum: '$recoveredAmount' },
        count: { $sum: 1 }
      }
    }
  ]);
  return result[0] || { totalOutstanding: 0, totalDisbursed: 0, totalRecovered: 0, count: 0 };
};

// Static method to get farmer's outstanding by loan type
producerLoanSchema.statics.getFarmerOutstandingByType = async function(farmerId) {
  const result = await this.aggregate([
    {
      $match: {
        farmerId: new mongoose.Types.ObjectId(farmerId),
        status: { $in: ['Active', 'Defaulted'] }
      }
    },
    {
      $group: {
        _id: '$loanType',
        totalOutstanding: { $sum: '$outstandingAmount' },
        count: { $sum: 1 }
      }
    }
  ]);

  // Convert to object for easier access
  const byType = {
    'Cash Advance': 0,
    'CF Advance': 0,
    'Loan Advance': 0
  };

  result.forEach(r => {
    byType[r._id] = r.totalOutstanding;
  });

  return byType;
};

const ProducerLoan = mongoose.model('ProducerLoan', producerLoanSchema);

export default ProducerLoan;
