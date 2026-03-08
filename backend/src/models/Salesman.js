import mongoose from 'mongoose';

const salesmanSchema = new mongoose.Schema({
  salesmanId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  name: {
    type: String,
    required: [true, 'Salesman name is required'],
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  commission: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  },
  ledgerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ledger'
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company'
  }
}, {
  timestamps: true
});

salesmanSchema.index({ salesmanId: 1 });
salesmanSchema.index({ name: 1 });
salesmanSchema.index({ status: 1 });
salesmanSchema.index({ companyId: 1 });

const Salesman = mongoose.model('Salesman', salesmanSchema);

export default Salesman;
