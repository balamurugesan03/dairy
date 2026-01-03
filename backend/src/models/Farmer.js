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
    },
    idCardNumber: {
      type: String,
      trim: true
    },
    issueDate: {
      type: Date
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
  collectionCenter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CollectionCenter'
  },
  admissionDate: {
    type: Date
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
    oldShares: {
      type: Number,
      default: 0,
      min: 0
    },
    newShares: {
      type: Number,
      default: 0,
      min: 0
    },
    totalShares: {
      type: Number,
      default: 0,
      min: 0
    },
    shareValue: {
      type: Number,
      default: 0
    },
    shareTakenDate: {
      type: Date
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
  shareHistory: [{
    transactionType: {
      type: String,
      enum: ['Allotment', 'Additional Allotment', 'Redemption'],
      required: true
    },
    shares: {
      type: Number,
      required: true,
      min: 0
    },
    shareValue: {
      type: Number,
      required: true
    },
    totalValue: {
      type: Number,
      required: true
    },
    resolutionNo: {
      type: String,
      required: true,
      trim: true
    },
    resolutionDate: {
      type: Date,
      required: true
    },
    oldTotal: {
      type: Number,
      default: 0
    },
    newTotal: {
      type: Number,
      required: true
    },
    remarks: {
      type: String,
      trim: true
    },
    transactionDate: {
      type: Date,
      default: Date.now
    }
  }],
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
    },
    additionalDocuments: [{
      type: String,
      trim: true
    }]
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  },
  isMembership: {
    type: Boolean,
    default: false
  },
  ledgerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ledger'
  },
  termination: {
    isTerminated: {
      type: Boolean,
      default: false
    },
    retirementDate: {
      type: Date
    },
    resolutionNumber: {
      type: String,
      trim: true
    },
    resolutionDate: {
      type: Date
    },
    refundDate: {
      type: Date
    },
    refundAmount: {
      type: Number,
      min: 0
    },
    oldShareAmount: {
      type: Number,
      min: 0
    },
    refundReason: {
      type: String,
      enum: ['Voluntary', 'Banned', 'Dead', 'Others'],
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    terminatedBy: {
      type: String,
      trim: true
    },
    terminatedAt: {
      type: Date
    }
  }
}, {
  timestamps: true
});

// Indexes for faster queries
farmerSchema.index({ 'personalDetails.phone': 1 });
farmerSchema.index({ status: 1 });

const Farmer = mongoose.model('Farmer', farmerSchema);

export default Farmer;
