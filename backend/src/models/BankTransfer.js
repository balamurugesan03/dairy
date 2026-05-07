import mongoose from 'mongoose';
import { generateCode } from './Counter.js';

// Individual transfer detail schema
const transferDetailSchema = new mongoose.Schema({
  farmerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Farmer',
    required: true
  },
  producerId: { type: String },
  producerName: { type: String },
  netPayable: { type: Number, default: 0 },
  transferAmount: { type: Number, default: 0, min: 0 },
  approved: { type: Boolean, default: false },
  bankDetails: {
    accountNumber: String,
    bankName: String,
    branch: String,
    ifscCode: String,
    micr: String,
    bankLedgerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ledger' },
    bankCode: String
  },
  paymentMode: {
    type: String,
    enum: ['Bank Transfer', 'Cash', 'Cheque'],
    default: 'Bank Transfer'
  },
  transferStatus: {
    type: String,
    enum: ['Pending', 'Transferred', 'Failed', 'Cancelled'],
    default: 'Pending'
  },
  transferReference: String,
  failureReason: String,
  transferredAt: Date
});

// Main bank transfer schema
const bankTransferSchema = new mongoose.Schema({
  transferNumber: {
    type: String,
    unique: true
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company'
  },

  // Transfer basis
  transferBasis: {
    type: String,
    enum: ['As on Date Balance', 'Last Processed Period', 'Register Ledger'],
    default: 'As on Date Balance'
  },

  // Date fields
  asOnDate: {
    type: Date,
    required: true
  },
  applyDate: {
    type: Date,
    required: true
  },

  // Filter criteria
  collectionCenter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CollectionCenter',
    default: null
  },
  collectionCenterName: { type: String, default: 'All' },

  bank: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bank',
    default: null
  },
  bankName: { type: String, default: 'All' },

  // Round down settings
  roundDownAmount: {
    type: Number,
    default: 10,
    min: 1,
    max: 1000
  },

  // Due by list flag
  dueByList: {
    type: Boolean,
    default: false
  },

  // Transfer details
  transferDetails: [transferDetailSchema],

  // Summary amounts
  totalNetPayable: { type: Number, default: 0 },
  totalTransferAmount: { type: Number, default: 0 },
  totalApproved: { type: Number, default: 0 },
  totalProducers: { type: Number, default: 0 },

  // Status
  status: {
    type: String,
    enum: ['Draft', 'Retrieved', 'Applied', 'Completed', 'Cancelled'],
    default: 'Draft'
  },

  // Audit fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  appliedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  appliedAt: Date,

  // Voucher reference
  voucherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Voucher'
  },

  remarks: { type: String, maxlength: 500 }
}, { timestamps: true });

// Indexes
bankTransferSchema.index({ companyId: 1, applyDate: -1 });
bankTransferSchema.index({ status: 1 });
bankTransferSchema.index({ transferNumber: 1 });
bankTransferSchema.index({ collectionCenter: 1 });

// Pre-save hook for auto-generation
bankTransferSchema.pre('save', async function() {
  if (!this.transferNumber) {
    this.transferNumber = await generateCode('BT', this.companyId, { pad: 5 });
  }

  // Calculate totals
  if (this.transferDetails && this.transferDetails.length > 0) {
    this.totalNetPayable = this.transferDetails.reduce((sum, d) => sum + (d.netPayable || 0), 0);
    this.totalTransferAmount = this.transferDetails
      .filter(d => d.approved)
      .reduce((sum, d) => sum + (d.transferAmount || 0), 0);
    this.totalApproved = this.transferDetails.filter(d => d.approved).length;
    this.totalProducers = this.transferDetails.length;
  }

});

// Instance method to apply round down
bankTransferSchema.methods.applyRoundDown = function(roundDownValue) {
  this.transferDetails.forEach(detail => {
    if (detail.netPayable > 0) {
      // Round down to nearest multiple
      detail.transferAmount = Math.floor(detail.netPayable / roundDownValue) * roundDownValue;
    } else {
      detail.transferAmount = 0;
    }
  });
  return this;
};

// Instance method to toggle approval
bankTransferSchema.methods.toggleApproval = function(detailId, approved) {
  const detail = this.transferDetails.id(detailId);
  if (detail) {
    detail.approved = approved;
  }
  return this;
};

// Instance method to toggle all approvals
bankTransferSchema.methods.toggleAllApprovals = function(approved) {
  this.transferDetails.forEach(detail => {
    if (detail.netPayable > 0 && detail.transferAmount > 0) {
      detail.approved = approved;
    }
  });
  return this;
};

// Static method to get producer balances
bankTransferSchema.statics.getProducerBalances = async function(companyId, asOnDate, collectionCenter, bank) {
  const Farmer = mongoose.model('Farmer');
  const FarmerPayment = mongoose.model('FarmerPayment');

  // Build filter
  const farmerFilter = { companyId, status: 'Active' };
  if (collectionCenter) {
    farmerFilter.collectionCenter = collectionCenter;
  }

  // Get all active farmers
  const farmers = await Farmer.find(farmerFilter)
    .select('farmerNumber personalDetails bankDetails collectionCenter')
    .lean();

  // For each farmer, calculate net payable
  const balances = [];

  for (const farmer of farmers) {
    // Get sum of all unpaid balances up to asOnDate
    const paymentAgg = await FarmerPayment.aggregate([
      {
        $match: {
          companyId: new mongoose.Types.ObjectId(companyId),
          farmerId: farmer._id,
          paymentDate: { $lte: new Date(asOnDate) },
          status: { $in: ['Pending', 'Partial'] }
        }
      },
      {
        $group: {
          _id: null,
          totalBalance: { $sum: '$balanceAmount' }
        }
      }
    ]);

    const payment = paymentAgg[0] || { totalBalance: 0 };
    const netPayable = payment.totalBalance || 0;

    // Filter by bank if specified (bank filter values are bank names)
    const bankDetails = farmer.bankDetails || {};
    if (bank && bankDetails.bankName !== bank) {
      continue;
    }

    balances.push({
      farmerId: farmer._id,
      producerId: farmer.farmerNumber,
      producerName: farmer.personalDetails?.name || 'Unknown',
      netPayable: netPayable,
      transferAmount: 0,
      approved: false,
      bankDetails: {
        accountNumber: bankDetails.accountNumber || '',
        bankName: bankDetails.bankName || '',
        ifscCode: bankDetails.ifscCode || '',
        bankCode: bankDetails.branchCode || ''
      }
    });
  }

  return balances;
};

const BankTransfer = mongoose.model('BankTransfer', bankTransferSchema);

export default BankTransfer;
