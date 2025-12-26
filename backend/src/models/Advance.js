import mongoose from 'mongoose';

const advanceSchema = new mongoose.Schema({
  farmerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Farmer',
    required: true
  },
  advanceDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  advanceAmount: {
    type: Number,
    required: true,
    min: 0
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
  adjustments: [{
    date: {
      type: Date,
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    referenceType: {
      type: String,
      enum: ['Sale', 'Payment'],
      required: true
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    }
  }],
  voucherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Voucher'
  },
  status: {
    type: String,
    enum: ['Active', 'Adjusted', 'Cancelled'],
    default: 'Active'
  }
}, {
  timestamps: true
});

// Indexes for faster queries
advanceSchema.index({ farmerId: 1, advanceDate: -1 });
advanceSchema.index({ status: 1 });

const Advance = mongoose.model('Advance', advanceSchema);

export default Advance;
