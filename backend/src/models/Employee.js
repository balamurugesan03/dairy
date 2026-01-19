import mongoose from 'mongoose';

const employeeSchema = new mongoose.Schema({
  // Unique identifier
  employeeNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },

  // Personal information
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
    dob: {
      type: Date
    },
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Other'],
      required: true
    },
    phone: {
      type: String,
      required: true,
      trim: true
    },
    alternatePhone: {
      type: String,
      trim: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true
    },
    maritalStatus: {
      type: String,
      enum: ['Single', 'Married', 'Divorced', 'Widowed']
    },
    bloodGroup: {
      type: String,
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
    }
  },

  // Employment details
  employmentDetails: {
    designation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Designation',
      required: true
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: true
    },
    dateOfJoining: {
      type: Date,
      required: true
    },
    employmentType: {
      type: String,
      enum: ['Full-time', 'Part-time', 'Contract', 'Temporary'],
      default: 'Full-time'
    },
    workingHours: {
      type: Number,
      default: 8 // hours per day
    },
    reportingTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee'
    },
    probationPeriod: {
      type: Number, // in months
      default: 3
    },
    confirmationDate: {
      type: Date
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive', 'On Leave', 'Terminated', 'Resigned'],
      default: 'Active'
    }
  },

  // Address information
  address: {
    currentAddress: {
      street: { type: String },
      village: { type: String },
      city: { type: String },
      district: { type: String },
      state: { type: String },
      pincode: { type: String }
    },
    permanentAddress: {
      street: { type: String },
      village: { type: String },
      city: { type: String },
      district: { type: String },
      state: { type: String },
      pincode: { type: String },
      sameAsCurrent: { type: Boolean, default: false }
    }
  },

  // Bank details for salary
  bankDetails: {
    accountNumber: {
      type: String,
      trim: true
    },
    accountHolderName: {
      type: String,
      trim: true
    },
    bankName: {
      type: String,
      trim: true
    },
    branchName: {
      type: String,
      trim: true
    },
    ifscCode: {
      type: String,
      trim: true,
      uppercase: true
    }
  },

  // Salary information
  salaryDetails: {
    basicSalary: {
      type: Number,
      required: true,
      default: 0
    },
    allowances: {
      hra: { type: Number, default: 0 }, // House Rent Allowance
      da: { type: Number, default: 0 },  // Dearness Allowance
      ta: { type: Number, default: 0 },  // Travel Allowance
      medical: { type: Number, default: 0 },
      special: { type: Number, default: 0 },
      other: { type: Number, default: 0 }
    },
    deductions: {
      pf: { type: Number, default: 0 },  // Provident Fund
      esi: { type: Number, default: 0 }, // Employee State Insurance
      pt: { type: Number, default: 0 },  // Professional Tax
      tds: { type: Number, default: 0 }, // Tax Deducted at Source
      loan: { type: Number, default: 0 },
      advance: { type: Number, default: 0 },
      other: { type: Number, default: 0 }
    },
    grossSalary: {
      type: Number,
      default: 0
    },
    netSalary: {
      type: Number,
      default: 0
    }
  },

  // Leave balance
  leaveBalance: {
    casual: { type: Number, default: 12 },
    sick: { type: Number, default: 7 },
    earned: { type: Number, default: 15 },
    maternity: { type: Number, default: 0 },
    paternity: { type: Number, default: 0 }
  },

  // Document references
  documents: {
    aadhaar: { type: String },
    pan: { type: String },
    bankPassbook: { type: String },
    photo: { type: String },
    resume: { type: String },
    educationCertificates: [{ type: String }],
    experienceCertificates: [{ type: String }]
  },

  // Emergency contact
  emergencyContact: {
    name: { type: String },
    relationship: { type: String },
    phone: { type: String },
    address: { type: String }
  },

  // Additional information
  remarks: {
    type: String
  }

}, {
  timestamps: true
});

// Indexes for performance
employeeSchema.index({ employeeNumber: 1 });
employeeSchema.index({ 'personalDetails.phone': 1 });
employeeSchema.index({ 'personalDetails.email': 1 });
employeeSchema.index({ 'employmentDetails.status': 1 });
employeeSchema.index({ 'employmentDetails.department': 1 });
employeeSchema.index({ 'employmentDetails.designation': 1 });

// Pre-save middleware to calculate gross and net salary
employeeSchema.pre('save', function() {
  if (this.isModified('salaryDetails')) {
    const { basicSalary, allowances, deductions } = this.salaryDetails;

    // Calculate gross salary
    const totalAllowances = Object.values(allowances).reduce((sum, val) => sum + (val || 0), 0);
    this.salaryDetails.grossSalary = basicSalary + totalAllowances;

    // Calculate net salary
    const totalDeductions = Object.values(deductions).reduce((sum, val) => sum + (val || 0), 0);
    this.salaryDetails.netSalary = this.salaryDetails.grossSalary - totalDeductions;
  }
});

// Virtual for full name
employeeSchema.virtual('fullName').get(function() {
  return this.personalDetails.name;
});

// Virtual for age
employeeSchema.virtual('age').get(function() {
  if (!this.personalDetails.dob) return null;
  const today = new Date();
  const birthDate = new Date(this.personalDetails.dob);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
});

// Instance method to check if employee is active
employeeSchema.methods.isActive = function() {
  return this.employmentDetails.status === 'Active';
};

// Static method to find active employees
employeeSchema.statics.findActive = function() {
  return this.find({ 'employmentDetails.status': 'Active' });
};

// Static method to find by department
employeeSchema.statics.findByDepartment = function(departmentId) {
  return this.find({ 'employmentDetails.department': departmentId });
};

const Employee = mongoose.model('Employee', employeeSchema);

export default Employee;
