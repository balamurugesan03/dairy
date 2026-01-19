import mongoose from 'mongoose';

const designationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },

  code: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },

  level: {
    type: String,
    enum: ['Entry', 'Junior', 'Mid', 'Senior', 'Manager', 'Executive'],
    default: 'Entry'
  },

  description: {
    type: String,
    trim: true
  },

  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department'
  },

  salaryRange: {
    min: { type: Number, default: 0 },
    max: { type: Number, default: 0 }
  },

  responsibilities: [{
    type: String
  }],

  qualifications: [{
    type: String
  }],

  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  },

  employeeCount: {
    type: Number,
    default: 0
  },

  remarks: {
    type: String
  }

}, {
  timestamps: true
});

// Indexes
designationSchema.index({ name: 1 });
designationSchema.index({ code: 1 });
designationSchema.index({ status: 1 });
designationSchema.index({ department: 1 });
designationSchema.index({ level: 1 });

// Virtual to get all employees with this designation
designationSchema.virtual('employees', {
  ref: 'Employee',
  localField: '_id',
  foreignField: 'employmentDetails.designation'
});

// Instance method to check if active
designationSchema.methods.isActive = function() {
  return this.status === 'Active';
};

// Static method to find active designations
designationSchema.statics.findActive = function() {
  return this.find({ status: 'Active' });
};

// Static method to find by department
designationSchema.statics.findByDepartment = function(departmentId) {
  return this.find({ department: departmentId, status: 'Active' });
};

const Designation = mongoose.model('Designation', designationSchema);

export default Designation;
