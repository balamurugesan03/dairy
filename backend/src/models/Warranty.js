import mongoose from 'mongoose';

const warrantySchema = new mongoose.Schema({
  productName: {
    type: String,
    required: true,
    trim: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Farmer'
  },
  customerName: {
    type: String,
    required: true,
    trim: true
  },
  warrantyStartDate: {
    type: Date,
    required: true
  },
  warrantyEndDate: {
    type: Date,
    required: true
  },
  claimHistory: [{
    claimDate: {
      type: Date,
      required: true
    },
    issue: {
      type: String,
      required: true,
      trim: true
    },
    resolution: {
      type: String,
      trim: true
    },
    status: {
      type: String,
      enum: ['Pending', 'Resolved', 'Rejected'],
      default: 'Pending'
    }
  }],
  status: {
    type: String,
    enum: ['Active', 'Expired', 'Claimed'],
    default: 'Active'
  }
}, {
  timestamps: true
});

// Indexes for faster queries
warrantySchema.index({ warrantyEndDate: 1 });
warrantySchema.index({ status: 1 });

const Warranty = mongoose.model('Warranty', warrantySchema);

export default Warranty;
