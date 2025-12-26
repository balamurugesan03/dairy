import mongoose from 'mongoose';

const promotionSchema = new mongoose.Schema({
  promotionType: {
    type: String,
    enum: ['Flyer', 'Marketing', 'Advertisement', 'Campaign'],
    required: true
  },
  promotionDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  expense: {
    type: Number,
    default: 0,
    min: 0
  },
  targetAudience: {
    type: String,
    trim: true
  },
  recordedBy: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Indexes for faster queries
promotionSchema.index({ promotionDate: -1 });
promotionSchema.index({ promotionType: 1 });

const Promotion = mongoose.model('Promotion', promotionSchema);

export default Promotion;
