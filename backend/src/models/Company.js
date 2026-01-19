import mongoose from 'mongoose';

const companySchema = new mongoose.Schema({
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

// Validation to ensure at least one business type is selected
companySchema.pre('save', function() {
  if (!this.businessTypes || this.businessTypes.length === 0) {
    throw new Error('At least one business type must be selected');
  }
});

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
