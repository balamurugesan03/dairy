import mongoose from 'mongoose';

const farmerSchema = new mongoose.Schema({

  farmerNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  memberId: {
    type: String,
    trim: true
  },
  personalDetails: {
    name: {
      type: String,
      required: true,
      trim: true
    },
    fatherName: {
      type: String,
      trim: true
    },
    age: {
      type: Number,
      min: 0
    },
    dob: {
      type: Date
    },
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Other']
    },
    phone: {
      type: String,
      trim: true
    }
  },
  address: {
    ward: {
      type: String,
      trim: true
    },
    village: {
      type: String,
      trim: true
    },
    panchayat: {
      type: String,
      trim: true
    },
    pin: {
      type: String,
      trim: true
    }
  },
  identityDetails: {
    aadhaar: {
      type: String,
      trim: true
    },
    pan: {
      type: String,
      trim: true
    },
    welfareNo: {
      type: String,
      trim: true
    },
    ksheerasreeId: {
      type: String,
      trim: true
    }
  },
  farmerType: {
    type: String,
    trim: true
  },
  cowType: {
    type: String,
    trim: true
  },
  bankDetails: {
    accountNumber: {
      type: String,
      trim: true
    },
    bankName: {
      type: String,
      trim: true
    },
    branch: {
      type: String,
      trim: true
    },
    ifsc: {
      type: String,
      trim: true
    }
  },
  financialDetails: {
    shareValue: {
      type: Number,
      default: 0
    },
    resolutionNo: {
      type: String,
      trim: true
    },
    resolutionDate: {
      type: Date
    },
    admissionFee: {
      type: Number,
      default: 0
    }
  },
  documents: {
    aadhaar: {
      type: String,
      trim: true
    },
    bankPassbook: {
      type: String,
      trim: true
    },
    rationCard: {
      type: String,
      trim: true
    },
    incomeProof: {
      type: String,
      trim: true
    }
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  },
  ledgerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ledger'
  }
}, {
  timestamps: true
});

// Indexes for faster queries
farmerSchema.index({ 'personalDetails.phone': 1 });
farmerSchema.index({ status: 1 });

const Farmer = mongoose.model('Farmer', farmerSchema);

export default Farmer;
