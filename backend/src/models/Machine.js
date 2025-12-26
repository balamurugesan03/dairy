import mongoose from 'mongoose';

const machineSchema = new mongoose.Schema({
  machineId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  machineName: {
    type: String,
    required: true,
    trim: true
  },
  allocatedTo: {
    type: String,
    trim: true
  },
  allocationDate: {
    type: Date
  },
  replacementHistory: [{
    date: {
      type: Date,
      required: true
    },
    reason: {
      type: String,
      required: true,
      trim: true
    },
    replacedWith: {
      type: String,
      trim: true
    }
  }],
  status: {
    type: String,
    enum: ['Active', 'Standby', 'Maintenance'],
    default: 'Active'
  }
}, {
  timestamps: true
});

// Indexes for faster queries
machineSchema.index({ status: 1 });

const Machine = mongoose.model('Machine', machineSchema);

export default Machine;
