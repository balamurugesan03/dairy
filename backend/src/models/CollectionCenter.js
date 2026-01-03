import mongoose from 'mongoose';

const collectionCenterSchema = new mongoose.Schema({
  centerName: {
    type: String,
    required: [true, 'Center name is required'],
    trim: true,
    unique: true
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
  }
}, {
  timestamps: true
});

// Index for faster queries
collectionCenterSchema.index({ centerName: 1 });
collectionCenterSchema.index({ status: 1 });
collectionCenterSchema.index({ centerType: 1 });

const CollectionCenter = mongoose.model('CollectionCenter', collectionCenterSchema);

export default CollectionCenter;
