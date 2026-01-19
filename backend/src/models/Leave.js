import mongoose from 'mongoose';

const leaveSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },

  leaveType: {
    type: String,
    enum: ['Casual', 'Sick', 'Earned', 'Maternity', 'Paternity', 'Unpaid', 'Compensatory'],
    required: true
  },

  startDate: {
    type: Date,
    required: true
  },

  endDate: {
    type: Date,
    required: true
  },

  numberOfDays: {
    type: Number,
    required: true,
    min: 0.5 // Allows half-day leave
  },

  isHalfDay: {
    type: Boolean,
    default: false
  },

  halfDayType: {
    type: String,
    enum: ['First Half', 'Second Half', null]
  },

  reason: {
    type: String,
    required: true,
    trim: true
  },

  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected', 'Cancelled'],
    default: 'Pending'
  },

  appliedDate: {
    type: Date,
    default: Date.now
  },

  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },

  approvalDate: {
    type: Date
  },

  rejectionReason: {
    type: String
  },

  contactDuringLeave: {
    phone: { type: String },
    address: { type: String }
  },

  documents: [{
    type: String // URLs to medical certificates, etc.
  }],

  remarks: {
    type: String
  }

}, {
  timestamps: true
});

// Indexes
leaveSchema.index({ employee: 1, startDate: -1 });
leaveSchema.index({ status: 1 });
leaveSchema.index({ leaveType: 1 });
leaveSchema.index({ startDate: 1, endDate: 1 });

// Pre-save middleware to calculate number of days
leaveSchema.pre('save', function() {
  if (this.isModified('startDate') || this.isModified('endDate') || this.isModified('isHalfDay')) {
    if (this.isHalfDay) {
      this.numberOfDays = 0.5;
    } else {
      const start = new Date(this.startDate);
      const end = new Date(this.endDate);
      const diffTime = Math.abs(end - start);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end dates
      this.numberOfDays = diffDays;
    }
  }
});

// Static method to get leaves by date range
leaveSchema.statics.getLeavesByDateRange = function(employeeId, startDate, endDate) {
  return this.find({
    employee: employeeId,
    $or: [
      { startDate: { $gte: startDate, $lte: endDate } },
      { endDate: { $gte: startDate, $lte: endDate } },
      {
        startDate: { $lte: startDate },
        endDate: { $gte: endDate }
      }
    ]
  }).sort({ startDate: -1 });
};

// Static method to get pending leaves
leaveSchema.statics.getPendingLeaves = function() {
  return this.find({ status: 'Pending' })
    .populate('employee')
    .sort({ appliedDate: 1 });
};

// Static method to get approved leaves for a date range
leaveSchema.statics.getApprovedLeaves = function(startDate, endDate) {
  return this.find({
    status: 'Approved',
    $or: [
      { startDate: { $gte: startDate, $lte: endDate } },
      { endDate: { $gte: startDate, $lte: endDate } },
      {
        startDate: { $lte: startDate },
        endDate: { $gte: endDate }
      }
    ]
  }).populate('employee');
};

// Static method to get leave summary for employee
leaveSchema.statics.getLeaveSummary = async function(employeeId, year) {
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);

  const leaves = await this.find({
    employee: employeeId,
    status: 'Approved',
    startDate: { $gte: startDate, $lte: endDate }
  });

  const summary = {
    casual: leaves.filter(l => l.leaveType === 'Casual').reduce((sum, l) => sum + l.numberOfDays, 0),
    sick: leaves.filter(l => l.leaveType === 'Sick').reduce((sum, l) => sum + l.numberOfDays, 0),
    earned: leaves.filter(l => l.leaveType === 'Earned').reduce((sum, l) => sum + l.numberOfDays, 0),
    maternity: leaves.filter(l => l.leaveType === 'Maternity').reduce((sum, l) => sum + l.numberOfDays, 0),
    paternity: leaves.filter(l => l.leaveType === 'Paternity').reduce((sum, l) => sum + l.numberOfDays, 0),
    unpaid: leaves.filter(l => l.leaveType === 'Unpaid').reduce((sum, l) => sum + l.numberOfDays, 0),
    compensatory: leaves.filter(l => l.leaveType === 'Compensatory').reduce((sum, l) => sum + l.numberOfDays, 0)
  };

  summary.total = Object.values(summary).reduce((sum, val) => sum + val, 0);

  return summary;
};

// Instance method to approve leave
leaveSchema.methods.approve = function(approvedBy, remarks) {
  this.status = 'Approved';
  this.approvedBy = approvedBy;
  this.approvalDate = new Date();
  if (remarks) this.remarks = remarks;
  return this.save();
};

// Instance method to reject leave
leaveSchema.methods.reject = function(approvedBy, rejectionReason) {
  this.status = 'Rejected';
  this.approvedBy = approvedBy;
  this.approvalDate = new Date();
  this.rejectionReason = rejectionReason;
  return this.save();
};

// Instance method to cancel leave
leaveSchema.methods.cancel = function() {
  this.status = 'Cancelled';
  return this.save();
};

// Instance method to check if leave overlaps with another leave
leaveSchema.methods.hasOverlap = async function() {
  const overlappingLeaves = await this.constructor.find({
    employee: this.employee,
    _id: { $ne: this._id },
    status: { $in: ['Pending', 'Approved'] },
    $or: [
      {
        startDate: { $lte: this.endDate },
        endDate: { $gte: this.startDate }
      }
    ]
  });

  return overlappingLeaves.length > 0;
};

const Leave = mongoose.model('Leave', leaveSchema);

export default Leave;
