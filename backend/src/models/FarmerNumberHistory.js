import mongoose from 'mongoose';

const farmerNumberHistorySchema = new mongoose.Schema({
  farmerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Farmer',
    required: true
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  oldNumber: {
    type: String,
    required: true,
    trim: true
  },
  newNumber: {
    type: String,
    required: true,
    trim: true
  },
  changedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  changedAt: {
    type: Date,
    default: Date.now
  },
  reason: {
    type: String,
    trim: true,
    default: 'Membership Activation'
  }
});

farmerNumberHistorySchema.index({ companyId: 1, oldNumber: 1 });
farmerNumberHistorySchema.index({ farmerId: 1 });

const FarmerNumberHistory = mongoose.model('FarmerNumberHistory', farmerNumberHistorySchema);

export default FarmerNumberHistory;
