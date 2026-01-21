import mongoose from 'mongoose';

const advanceSchema = new mongoose.Schema({
  // Auto-generated advance number
  advanceNumber: {
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
  advanceDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  // Advance type categorization
  advanceType: {
    type: String,
    enum: ['Regular', 'Emergency', 'Festival', 'Medical', 'Agriculture', 'Cattle Purchase', 'Feed', 'Other'],
    default: 'Regular'
  },
  advanceAmount: {
    type: Number,
    required: [true, 'Advance amount is required'],
    min: [1, 'Advance amount must be greater than 0']
  },
  adjustedAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  balanceAmount: {
    type: Number,
    required: true,
    min: 0
  },
  // Payment mode details
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
    upiId: String,
    chequeNumber: String,
    chequeDate: Date
  },
  // Interest and repayment
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
  totalDue: {
    type: Number,
    default: 0
  },
  // Repayment settings
  repaymentType: {
    type: String,
    enum: ['Lump Sum', 'Monthly Deduction', 'Per Payment Deduction', 'Custom'],
    default: 'Per Payment Deduction'
  },
  monthlyDeductionAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  deductionPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  expectedRepaymentDate: Date,
  // Adjustment history
  adjustments: [{
    date: {
      type: Date,
      required: true,
      default: Date.now
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    referenceType: {
      type: String,
      enum: ['Sale', 'Payment', 'Manual', 'Interest'],
      required: true
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId
    },
    paymentNumber: String,
    remarks: String,
    adjustedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  // Approval workflow
  approvalStatus: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Approved'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,
  rejectionReason: String,
  // Limits
  farmerCreditLimit: {
    type: Number,
    default: 0
  },
  availableLimit: {
    type: Number,
    default: 0
  },
  // Voucher reference
  voucherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Voucher'
  },
  // Additional info
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
  // Document attachments
  documents: [{
    name: String,
    url: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  status: {
    type: String,
    enum: ['Active', 'Partially Adjusted', 'Adjusted', 'Cancelled', 'Overdue'],
    default: 'Active'
  },
  cancelledAt: Date,
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  cancellationReason: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes for faster queries
advanceSchema.index({ companyId: 1, advanceDate: -1 });
advanceSchema.index({ farmerId: 1, advanceDate: -1 });
advanceSchema.index({ status: 1 });
advanceSchema.index({ advanceNumber: 1 });
advanceSchema.index({ advanceType: 1 });
advanceSchema.index({ approvalStatus: 1 });

// Pre-save hook to generate advance number and calculate totals
advanceSchema.pre('save', async function(next) {
  // Generate advance number if not exists
  if (!this.advanceNumber) {
    const count = await this.constructor.countDocuments({ companyId: this.companyId });
    const year = new Date().getFullYear().toString().slice(-2);
    const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
    this.advanceNumber = `ADV${year}${month}${(count + 1).toString().padStart(5, '0')}`;
  }

  // Calculate interest amount if interest rate is set
  if (this.interestRate > 0) {
    this.interestAmount = (this.advanceAmount * this.interestRate) / 100;
    this.totalDue = this.advanceAmount + this.interestAmount;
  } else {
    this.totalDue = this.advanceAmount;
  }

  // Update status based on balance
  if (this.balanceAmount === 0 && this.adjustedAmount > 0) {
    this.status = 'Adjusted';
  } else if (this.adjustedAmount > 0 && this.balanceAmount > 0) {
    this.status = 'Partially Adjusted';
  }

  next();
});

// Virtual for farmer details
advanceSchema.virtual('farmer', {
  ref: 'Farmer',
  localField: 'farmerId',
  foreignField: '_id',
  justOne: true
});

// Method to check if advance is overdue
advanceSchema.methods.checkOverdue = function() {
  if (this.expectedRepaymentDate && new Date() > this.expectedRepaymentDate && this.balanceAmount > 0) {
    this.status = 'Overdue';
    return true;
  }
  return false;
};

// Static method to get farmer's total outstanding advance
advanceSchema.statics.getFarmerOutstanding = async function(farmerId) {
  const result = await this.aggregate([
    { $match: { farmerId: new mongoose.Types.ObjectId(farmerId), status: { $in: ['Active', 'Partially Adjusted', 'Overdue'] } } },
    { $group: { _id: null, totalOutstanding: { $sum: '$balanceAmount' }, count: { $sum: 1 } } }
  ]);
  return result[0] || { totalOutstanding: 0, count: 0 };
};

const Advance = mongoose.model('Advance', advanceSchema);

export default Advance;
