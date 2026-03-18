import mongoose from 'mongoose';

// ════════════════════════════════════════════════════════════════
//  ShiftIncentive Schema  (v2 — multi-section independent toggles)
//  Supports: Rate-based, Percentage-based, and Parameter-based
//  sections — each independently enabled via a checkbox.
// ════════════════════════════════════════════════════════════════

const rateBasedSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    qty:     { type: Boolean, default: false },
    amount:  { type: Boolean, default: false },
    rate:    { type: Number,  default: 0, min: 0 }
  },
  { _id: false }
);

const percentageBasedSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    qty:     { type: Boolean, default: false },
    amount:  { type: Boolean, default: false },
    rate:    { type: Number,  default: 0, min: 0, max: 100 }
  },
  { _id: false }
);

const parameterBasedSchema = new mongoose.Schema(
  {
    enabled:     { type: Boolean, default: false },
    belowFat:    { type: Number,  default: 0 },
    belowSnf:    { type: Number,  default: 0 },
    belowAmount: { type: Number,  default: 0 },
    aboveFat:    { type: Number,  default: 0 },
    aboveSnf:    { type: Number,  default: 0 },
    aboveAmount: { type: Number,  default: 0 }
  },
  { _id: false }
);

const shiftIncentiveSchema = new mongoose.Schema(
  {
    // ── Core fields ─────────────────────────────────────────────
    shift: {
      type:     String,
      enum:     ['AM', 'PM', 'BOTH'],
      required: [true, 'Shift is required']
    },
    center: {
      type:     String,
      required: [true, 'Center is required'],
      trim:     true
    },
    applicableType: {
      type:    String,
      enum:    ['ALL', 'LIST'],
      default: 'ALL'
    },
    listText: {
      type:    String,
      default: ''
    },

    // ── Date range ──────────────────────────────────────────────
    startDate: {
      type:     Date,
      required: [true, 'Start date is required']
    },
    endDate: {
      type:     Date,
      required: false
    },

    // ── Calculation sections (independently enabled) ─────────────
    rateBased:       { type: rateBasedSchema,       default: () => ({}) },
    percentageBased: { type: percentageBasedSchema, default: () => ({}) },
    parameterBased:  { type: parameterBasedSchema,  default: () => ({}) },

    // ── Status ──────────────────────────────────────────────────
    status: {
      type:    Boolean,
      default: true
    },

    // ── Multi-tenant ────────────────────────────────────────────
    companyId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Company',
      required: true
    }
  },
  { timestamps: true }
);

// ── Validation: endDate > startDate ────────────────────────────
shiftIncentiveSchema.pre('validate', function () {
  if (this.startDate && this.endDate && this.endDate <= this.startDate) {
    this.invalidate('endDate', 'End date must be after start date');
  }
});

// ── Indexes ─────────────────────────────────────────────────────
shiftIncentiveSchema.index({ companyId: 1, status: 1 });
shiftIncentiveSchema.index({ companyId: 1, shift: 1, startDate: -1 });
shiftIncentiveSchema.index({ companyId: 1, center: 'text' });

export default mongoose.model('ShiftIncentive', shiftIncentiveSchema);
