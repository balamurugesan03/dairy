import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const collectionCenterSchema = new mongoose.Schema({
  centerName: {
    type: String,
    required: [true, 'Center name is required'],
    trim: true
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },
  centerType: {
    type: String,
    enum: ['Head Office', 'Sub Centre'],
    required: [true, 'Center type is required']
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  },
  // Additional useful fields
  address: {
    street: {
      type: String,
      trim: true
    },
    village: {
      type: String,
      trim: true
    },
    district: {
      type: String,
      trim: true
    },
    state: {
      type: String,
      trim: true
    },
    pincode: {
      type: String,
      trim: true
    }
  },
  contactDetails: {
    phone: {
      type: String,
      trim: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true
    },
    incharge: {
      type: String,
      trim: true
    }
  },
  description: {
    type: String,
    trim: true
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  // Sub-centre login credentials
  username: {
    type: String,
    trim: true,
    lowercase: true,
    sparse: true,
    unique: true
  },
  password: {
    type: String,
    select: false
  },
  isLoginEnabled: {
    type: Boolean,
    default: false
  },
  allowedModules: {
    type: [String],
    default: ['milkCollection', 'milkSales']
  }
}, {
  timestamps: true
});

// Index for faster queries
collectionCenterSchema.index({ centerName: 1 });
collectionCenterSchema.index({ status: 1 });
collectionCenterSchema.index({ centerType: 1 });
collectionCenterSchema.index({ companyId: 1 });

// Hash password before saving
collectionCenterSchema.pre('save', async function s() {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

collectionCenterSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const CollectionCenter = mongoose.model('CollectionCenter', collectionCenterSchema);

export default CollectionCenter;
