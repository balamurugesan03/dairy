import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const companySchema = new mongoose.Schema({
  // Login credentials
  username: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    select: false
  },

  // Basic company information
  companyName: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },

  businessTypes: [{
    type: String,
    enum: ['Dairy Cooperative Society', 'Private Firm'],
    required: true
  }],

  // Address information
  state: {
    type: String,
    trim: true
  },

  district: {
    type: String,
    trim: true
  },

  address: {
    type: String,
    trim: true
  },

  // Society details
  societyName: {
    type: String,
    trim: true
  },

  societyCode: {
    type: String,
    trim: true
  },

  // Contact information
  phone: {
    type: String,
    trim: true
  },

  email: {
    type: String,
    trim: true,
    lowercase: true
  },

  // Registration details
  dateOfRegistration: {
    type: Date
  },

  startDate: {
    type: Date
  },

  gstNumber: {
    type: String,
    trim: true,
    uppercase: true
  },

  milmaCode: {
    type: String,
    trim: true
  },

  ssiRegistration: {
    type: String,
    trim: true
  },

  ssiRegistrationDate: {
    type: Date
  },

  panNumber: {
    type: String,
    trim: true,
    uppercase: true
  },

  // Audit information
  yearOfAudit: {
    type: String,
    trim: true
  },

  auditClassification: {
    type: String,
    trim: true
  },

  // Status
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  }

}, {
  timestamps: true
});

// Indexes for performance
companySchema.index({ companyName: 1 });
companySchema.index({ status: 1 });
companySchema.index({ businessTypes: 1 });
companySchema.index({ username: 1 });

// Pre-save hook to hash password
companySchema.pre('save', async function() {
  // Validate business types
  if (!this.businessTypes || this.businessTypes.length === 0) {
    throw new Error('At least one business type must be selected');
  }

  // Hash password if modified
  if (this.isModified('password') && this.password) {
    this.password = await bcrypt.hash(this.password, 12);
  }
});

// Instance method to compare password
companySchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Static method to find active companies
companySchema.statics.findActive = function() {
  return this.find({ status: 'Active' });
};

// Static method to find by business type
companySchema.statics.findByBusinessType = function(businessType) {
  return this.find({
    businessTypes: businessType,
    status: 'Active'
  });
};

// Instance method to check if company supports a business type
companySchema.methods.hasBusinessType = function(businessType) {
  return this.businessTypes.includes(businessType);
};

// Instance method to check if company is active
companySchema.methods.isActive = function() {
  return this.status === 'Active';
};

const Company = mongoose.model('Company', companySchema);

export default Company;
