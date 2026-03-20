import mongoose from 'mongoose';

const agentSchema = new mongoose.Schema({
  agentCode: {
    type: String,
    required: [true, 'Agent code is required'],
    trim: true,
    unique: true
  },
  agentName: {
    type: String,
    required: [true, 'Agent name is required'],
    trim: true
  },
  collectionCenterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CollectionCenter',
    required: [true, 'Collection center is required']
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
  address: {
    type: String,
    trim: true
  },
  dateOfJoining: {
    type: Date
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company'
  }
}, {
  timestamps: true
});

agentSchema.index({ agentCode: 1 });
agentSchema.index({ collectionCenterId: 1 });
agentSchema.index({ status: 1 });
agentSchema.index({ companyId: 1 });

const Agent = mongoose.model('Agent', agentSchema);

export default Agent;
