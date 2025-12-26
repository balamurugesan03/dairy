import mongoose from 'mongoose';

const farmerPaymentSchema = new mongoose.Schema({
  farmerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Farmer',
    required: true
  },
  paymentDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  milkAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  advanceAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  deductions: [{
    type: {
      type: String,
      trim: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    description: {
      type: String,
      trim: true
    }
  }],
  totalDeduction: {
    type: Number,
    default: 0,
    min: 0
  },
  netPayable: {
    type: Number,
    required: true,
    min: 0
  },
  paymentMode: {
    type: String,
    enum: ['Cash', 'Bank'],
    default: 'Cash'
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
  voucherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Voucher'
  },
  status: {
    type: String,
    enum: ['Paid', 'Pending'],
    default: 'Pending'
  }
}, {
  timestamps: true
});

// Indexes for faster queries
farmerPaymentSchema.index({ farmerId: 1, paymentDate: -1 });
farmerPaymentSchema.index({ status: 1 });

const FarmerPayment = mongoose.model('FarmerPayment', farmerPaymentSchema);

export default FarmerPayment;
