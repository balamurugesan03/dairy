import mongoose from 'mongoose';

const farmerPaymentSchema = new mongoose.Schema({
  // Auto-generated payment number
  paymentNumber: {
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
  paymentDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  // Payment period
  paymentPeriod: {
    fromDate: Date,
    toDate: Date,
    periodType: {
      type: String,
      enum: ['Daily', 'Weekly', 'Fortnightly', 'Monthly', 'Custom'],
      default: 'Monthly'
    }
  },
  // Milk collection details
  milkDetails: {
    totalQuantity: {
      type: Number,
      default: 0,
      min: 0
    },
    morningQuantity: {
      type: Number,
      default: 0,
      min: 0
    },
    eveningQuantity: {
      type: Number,
      default: 0,
      min: 0
    },
    avgFat: {
      type: Number,
      default: 0,
      min: 0
    },
    avgSNF: {
      type: Number,
      default: 0,
      min: 0
    },
    avgRate: {
      type: Number,
      default: 0,
      min: 0
    },
    collectionDays: {
      type: Number,
      default: 0
    }
  },
  // Amount calculations
  milkAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  // Bonuses and incentives
  bonuses: [{
    type: {
      type: String,
      enum: ['Quality Bonus', 'Quantity Bonus', 'Festival Bonus', 'Loyalty Bonus', 'Fat Incentive', 'Other'],
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    description: String
  }],
  totalBonus: {
    type: Number,
    default: 0,
    min: 0
  },
  grossAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  // Advance deductions
  advanceAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  advancesAdjusted: [{
    advanceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Advance'
    },
    advanceNumber: String,
    amount: {
      type: Number,
      min: 0
    },
    adjustedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Other deductions
  deductions: [{
    type: {
      type: String,
      enum: ['Feed', 'Medicine', 'Loan EMI', 'Insurance', 'Society Fee', 'Cattle Feed', 'Mineral Mixture', 'Veterinary', 'Transport', 'Other'],
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    description: String,
    referenceId: mongoose.Schema.Types.ObjectId,
    referenceType: String
  }],
  totalDeduction: {
    type: Number,
    default: 0,
    min: 0
  },
  // TDS if applicable
  tdsAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  tdsPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  // Net calculations
  netPayable: {
    type: Number,
    required: true,
    min: 0
  },
  // Payment details
  paymentMode: {
    type: String,
    enum: ['Cash', 'Bank', 'UPI', 'Cheque', 'NEFT', 'RTGS'],
    default: 'Cash'
  },
  bankDetails: {
    bankName: String,
    accountNumber: String,
    ifscCode: String,
    accountHolderName: String,
    transactionId: String,
    upiId: String,
    chequeNumber: String,
    chequeDate: Date
  },
  paidAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  balanceAmount: {
    type: Number,
    default: 0
  },
  // Previous balance carried forward
  previousBalance: {
    type: Number,
    default: 0
  },
  // Voucher reference
  voucherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Voucher'
  },
  // Approval workflow
  approvalStatus: {
    type: String,
    enum: ['Draft', 'Pending Approval', 'Approved', 'Rejected'],
    default: 'Approved'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,
  rejectionReason: String,
  // Additional info
  remarks: {
    type: String,
    trim: true,
    maxlength: 500
  },
  paymentSlipPrinted: {
    type: Boolean,
    default: false
  },
  paymentSlipPrintedAt: Date,
  // SMS/Notification sent
  notificationSent: {
    type: Boolean,
    default: false
  },
  notificationSentAt: Date,
  status: {
    type: String,
    enum: ['Draft', 'Pending', 'Partial', 'Paid', 'Cancelled'],
    default: 'Pending'
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
farmerPaymentSchema.index({ companyId: 1, paymentDate: -1 });
farmerPaymentSchema.index({ farmerId: 1, paymentDate: -1 });
farmerPaymentSchema.index({ status: 1 });
farmerPaymentSchema.index({ paymentNumber: 1 });
farmerPaymentSchema.index({ paymentMode: 1 });
farmerPaymentSchema.index({ 'paymentPeriod.fromDate': 1, 'paymentPeriod.toDate': 1 });

// Pre-save hook to generate payment number and calculate totals
farmerPaymentSchema.pre('save', async function(next) {
  // Generate payment number if not exists
  if (!this.paymentNumber) {
    const count = await this.constructor.countDocuments({ companyId: this.companyId });
    const year = new Date().getFullYear().toString().slice(-2);
    const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
    this.paymentNumber = `PAY${year}${month}${(count + 1).toString().padStart(5, '0')}`;
  }

  // Calculate totals
  this.totalBonus = this.bonuses?.reduce((sum, b) => sum + (b.amount || 0), 0) || 0;
  this.grossAmount = (this.milkAmount || 0) + this.totalBonus;
  this.totalDeduction = (this.advanceAmount || 0) +
                        (this.deductions?.reduce((sum, d) => sum + (d.amount || 0), 0) || 0) +
                        (this.tdsAmount || 0);
  this.netPayable = this.grossAmount - this.totalDeduction + (this.previousBalance || 0);
  this.balanceAmount = this.netPayable - (this.paidAmount || 0);

  // Update status based on payment
  if (this.status !== 'Cancelled' && this.status !== 'Draft') {
    if (this.paidAmount === 0) {
      this.status = 'Pending';
    } else if (this.balanceAmount === 0) {
      this.status = 'Paid';
    } else if (this.paidAmount > 0 && this.balanceAmount > 0) {
      this.status = 'Partial';
    }
  }

  next();
});

// Virtual for farmer details
farmerPaymentSchema.virtual('farmer', {
  ref: 'Farmer',
  localField: 'farmerId',
  foreignField: '_id',
  justOne: true
});

// Static method to get farmer's payment summary
farmerPaymentSchema.statics.getFarmerPaymentSummary = async function(farmerId, fromDate, toDate) {
  const matchQuery = {
    farmerId: new mongoose.Types.ObjectId(farmerId),
    status: { $ne: 'Cancelled' }
  };

  if (fromDate && toDate) {
    matchQuery.paymentDate = { $gte: new Date(fromDate), $lte: new Date(toDate) };
  }

  const result = await this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        totalMilkAmount: { $sum: '$milkAmount' },
        totalBonus: { $sum: '$totalBonus' },
        totalDeductions: { $sum: '$totalDeduction' },
        totalAdvanceDeducted: { $sum: '$advanceAmount' },
        totalNetPayable: { $sum: '$netPayable' },
        totalPaid: { $sum: '$paidAmount' },
        totalBalance: { $sum: '$balanceAmount' },
        paymentCount: { $sum: 1 }
      }
    }
  ]);

  return result[0] || {
    totalMilkAmount: 0,
    totalBonus: 0,
    totalDeductions: 0,
    totalAdvanceDeducted: 0,
    totalNetPayable: 0,
    totalPaid: 0,
    totalBalance: 0,
    paymentCount: 0
  };
};

// Static method to get pending payments
farmerPaymentSchema.statics.getPendingPayments = async function(companyId) {
  return await this.find({
    companyId,
    status: { $in: ['Pending', 'Partial'] }
  })
  .populate('farmerId', 'farmerNumber personalDetails')
  .sort({ paymentDate: -1 });
};

const FarmerPayment = mongoose.model('FarmerPayment', farmerPaymentSchema);

export default FarmerPayment;
