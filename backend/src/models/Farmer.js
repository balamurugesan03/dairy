import mongoose from 'mongoose';

const farmerSchema = new mongoose.Schema({

  farmerNumber: {
    type: String,
    required: true,
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
    },
    caste: {
      type: String,
      trim: true
    },
    photo: {
      type: String,
      trim: true
    },
    nomineeName: {
      type: String,
      trim: true
    },
    nomineeRelation: {
      type: String,
      trim: true
    }
  },
  address: {
    houseName: {
      type: String,
      trim: true
    },
    houseNumber: {
      type: String,
      trim: true
    },
    ward: {
      type: String,
      trim: true
    },
    // Ward number of the Panchayat ward (ward above may be a name, "Ward 5", …)
    wardNumber: {
      type: String,
      trim: true
    },
    place: {
      type: String,
      trim: true
    },
    post: {
      type: String,
      trim: true
    },
    village: {
      type: String,
      trim: true
    },
    // Grama Panchayat (local body). Older records may hold the PIN-code Block /
    // Taluk here — LSGD lookups therefore also match village / place / taluk.
    panchayat: {
      type: String,
      trim: true
    },
    // Block / Taluk auto-filled from the PIN code
    taluk: {
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
    rationCardNo: {
      type: String,
      trim: true
    },
    voterId: {
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
  // DP system farmer import columns RateType / ImportType
  rateType: {
    type: String,
    trim: true
  },
  importType: {
    type: String,
    trim: true
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
    },
    micr: {
      type: String,
      trim: true
    },
    bankLedgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ledger'
    }
  },
  // Secondary bank account (Farmer Settings → Secondary Bank). bankDetails above is the Primary.
  secondaryBankDetails: {
    accountNumber: { type: String, trim: true },
    bankName:      { type: String, trim: true },
    branch:        { type: String, trim: true },
    ifsc:          { type: String, trim: true },
    micr:          { type: String, trim: true },
    bankLedgerId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Ledger' }
  },
  // Which account this farmer's payments go to (only when Secondary Bank is enabled)
  payTo: {
    type: String,
    enum: ['Primary', 'Secondary'],
    default: 'Primary'
  },
  // Parent Grouping (Farmer Settings → Parent Grouping): this farmer is a child of another
  // farmer of the same company. One level only — a parent cannot itself have a parent.
  // The child's payments go to the parent's chosen bank account (utils/farmerPayee.js).
  parentFarmer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Farmer',
    default: null,
    index: true
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
  membershipDate: {
    type: Date
  },
  oldFarmerNumber: {
    type: String,
    trim: true
  },
  eligibility: {
    totalQtySupplied: {
      type: Number,
      default: 0
    },
    firstCollectionDate: {
      type: Date
    },
    isEligible: {
      type: Boolean,
      default: false
    },
    eligibleSince: {
      type: Date
    },
    eligibleReason: {
      type: String,
      enum: ['Quantity', 'Tenure']
    }
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
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  }
}, {
  timestamps: true
});

// Indexes for faster queries
farmerSchema.index({ 'personalDetails.phone': 1 });
farmerSchema.index({ status: 1 });
farmerSchema.index({ companyId: 1 });
// Farmer Number is unique per centre: with the Center-wise series C1 and C2 both have a
// farmer 1. The Existing (single) series is kept company-unique by utils/farmerSeries.js.
farmerSchema.index({ companyId: 1, collectionCenter: 1, farmerNumber: 1 }, { unique: true });
farmerSchema.index({ companyId: 1, farmerNumber: 1 });

const Farmer = mongoose.model('Farmer', farmerSchema);

export default Farmer;
