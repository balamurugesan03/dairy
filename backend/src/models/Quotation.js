import mongoose from 'mongoose';

const quotationSchema = new mongoose.Schema({
  quotationNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  quotationDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  customerName: {
    type: String,
    required: true,
    trim: true
  },
  customerPhone: {
    type: String,
    trim: true
  },
  items: [{
    itemName: {
      type: String,
      required: true,
      trim: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 0
    },
    rate: {
      type: Number,
      required: true,
      min: 0
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    }
  }],
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  validUntil: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Converted', 'Expired'],
    default: 'Pending'
  },
  convertedToSaleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sales'
  }
}, {
  timestamps: true
});

// Indexes for faster queries
quotationSchema.index({ status: 1 });
quotationSchema.index({ validUntil: 1 });

const Quotation = mongoose.model('Quotation', quotationSchema);

export default Quotation;
