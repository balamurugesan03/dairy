import mongoose from 'mongoose';

const departmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },

  code: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },

  description: {
    type: String,
    trim: true
  },

  headOfDepartment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },

  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  },

  employeeCount: {
    type: Number,
    default: 0
  },

  budget: {
    type: Number,
    default: 0
  },

  remarks: {
    type: String
  },

  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  }

}, {
  timestamps: true
});

// Indexes
departmentSchema.index({ name: 1, companyId: 1 }, { unique: true });
departmentSchema.index({ code: 1, companyId: 1 }, { unique: true });
departmentSchema.index({ status: 1 });
departmentSchema.index({ companyId: 1 });

// Virtual to get all employees in this department
departmentSchema.virtual('employees', {
  ref: 'Employee',
  localField: '_id',
  foreignField: 'employmentDetails.department'
});

// Instance method to check if active
departmentSchema.methods.isActive = function() {
  return this.status === 'Active';
};

// Static method to find active departments
departmentSchema.statics.findActive = function() {
  return this.find({ status: 'Active' });
};

const Department = mongoose.model('Department', departmentSchema);

export default Department;
