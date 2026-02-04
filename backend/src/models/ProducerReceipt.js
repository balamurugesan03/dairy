import mongoose from 'mongoose';

const producerReceiptSchema = new mongoose.Schema({
  // Auto-generated receipt number
  receiptNumber: {
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
  receiptDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  // Receipt type - what type of advance/loan this receipt is for
  receiptType: {
    type: String,
    enum: ['CF Advance', 'Loan Advance', 'Cash Advance'],
    required: [true, 'Receipt type is required']
  },
  // Payment mode
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
  // Amount received
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [1, 'Amount must be greater than 0']
  },
  // Reference to the original advance/loan
  referenceType: {
    type: String,
    enum: ['Advance', 'Loan'],
    required: true
  },
  referenceId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'referenceModel'
  },
  referenceModel: {
    type: String,
    enum: ['Advance', 'ProducerLoan']
  },
  referenceNumber: String, // Advance number or Loan number
  // Balance tracking
  previousBalance: {
    type: Number,
    default: 0,
    min: 0
  },
  newBalance: {
    type: Number,
    default: 0,
    min: 0
  },
  // Voucher reference for accounting
  voucherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Voucher'
  },
  // Additional details
  remarks: {
    type: String,
    trim: true,
    maxlength: 500
  },
  // Status
  status: {
    type: String,
    enum: ['Active', 'Cancelled'],
    default: 'Active'
  },
  // Cancellation details
  cancelledAt: Date,
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  cancellationReason: String,
  // Print tracking
  printCount: {
    type: Number,
    default: 0
  },
  lastPrintedAt: Date,
  // Created by
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes for faster queries
producerReceiptSchema.index({ companyId: 1, receiptDate: -1 });
producerReceiptSchema.index({ farmerId: 1, receiptDate: -1 });
producerReceiptSchema.index({ status: 1 });
producerReceiptSchema.index({ receiptNumber: 1 });
producerReceiptSchema.index({ receiptType: 1 });
producerReceiptSchema.index({ referenceType: 1, referenceId: 1 });

// Pre-save hook to generate receipt number
producerReceiptSchema.pre('save', async function(next) {
  // Generate receipt number if not exists
  if (!this.receiptNumber) {
    const count = await this.constructor.countDocuments({ companyId: this.companyId });
    const year = new Date().getFullYear().toString().slice(-2);
    const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
    this.receiptNumber = `PREC${year}${month}${(count + 1).toString().padStart(5, '0')}`;
  }

  // Set reference model based on reference type
  if (this.referenceType === 'Advance') {
    this.referenceModel = 'Advance';
  } else if (this.referenceType === 'Loan') {
    this.referenceModel = 'ProducerLoan';
  }

  next();
});

// Virtual for farmer details
producerReceiptSchema.virtual('farmer', {
  ref: 'Farmer',
  localField: 'farmerId',
  foreignField: '_id',
  justOne: true
});

// Static method to get farmer's total receipts
producerReceiptSchema.statics.getFarmerReceiptSummary = async function(farmerId, fromDate, toDate) {
  const matchQuery = {
    farmerId: new mongoose.Types.ObjectId(farmerId),
    status: 'Active'
  };

  if (fromDate && toDate) {
    matchQuery.receiptDate = { $gte: new Date(fromDate), $lte: new Date(toDate) };
  }

  const result = await this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: '$receiptType',
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    }
  ]);

  return result;
};

// Static method to get receipts by reference
producerReceiptSchema.statics.getReceiptsByReference = async function(referenceType, referenceId) {
  return await this.find({
    referenceType,
    referenceId,
    status: 'Active'
  }).sort({ receiptDate: -1 });
};

const ProducerReceipt = mongoose.model('ProducerReceipt', producerReceiptSchema);

export default ProducerReceipt;
