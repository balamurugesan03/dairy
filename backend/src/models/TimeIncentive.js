import mongoose from 'mongoose';

const parametersSchema = new mongoose.Schema(
  {
    belowFat:  { type: Number, default: null },
    aboveFat:  { type: Number, default: null },
    belowSnf:  { type: Number, default: null },
    aboveSnf:  { type: Number, default: null },
    belowRate: { type: Number, default: null },
    aboveRate: { type: Number, default: null },
  },
  { _id: false }
);

const timeIncentiveSchema = new mongoose.Schema(
  {
    shift: {
      type:     [String],
      enum:     ['AM', 'PM'],
      required: [true, 'At least one shift is required'],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message:   'At least one shift (AM / PM) must be selected',
      },
    },

    centerType: {
      type:     String,
      enum:     ['ALL', 'LIST'],
      required: [true, 'Center type is required'],
    },

    centers: {
      type:    [String],
      default: [],
    },

    startDate: {
      type:     Date,
      required: [true, 'Start date is required'],
    },

    endDate: {
      type:     Date,
      required: [true, 'End date is required'],
    },

    timeFrom: {
      type:     String,
      required: [true, 'Time From is required'],
      match:    [/^\d{2}:\d{2}$/, 'Time From must be in HH:mm format'],
    },

    timeTo: {
      type:     String,
      required: [true, 'Time To is required'],
      match:    [/^\d{2}:\d{2}$/, 'Time To must be in HH:mm format'],
    },

    rate: {
      type:     Number,
      required: [true, 'Rate is required'],
      min:      [0, 'Rate cannot be negative'],
    },

    rateLocked: {
      type:    Boolean,
      default: false,
    },

    locked: {
      type:    Boolean,
      default: false,
    },

    parameters: {
      type:    parametersSchema,
      default: () => ({}),
    },

    status: {
      type:    Boolean,
      default: true,
    },

    companyId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Company',
      required: true,
    },
  },
  { timestamps: true }
);

// ── Cross-field validation ────────────────────────────────────────────────────
timeIncentiveSchema.pre('validate', async function () {
  if (this.startDate && this.endDate && this.endDate <= this.startDate) {
    this.invalidate('endDate', 'End date must be after start date');
  }

  if (this.timeFrom && this.timeTo && this.timeTo <= this.timeFrom) {
    this.invalidate('timeTo', 'Time To must be after Time From');
  }

  if (this.centerType === 'LIST' && (!this.centers || this.centers.length === 0)) {
    this.invalidate('centers', 'At least one center must be selected when Center Type is LIST');
  }
});

// ── Indexes ───────────────────────────────────────────────────────────────────
timeIncentiveSchema.index({ companyId: 1, status: 1 });
timeIncentiveSchema.index({ companyId: 1, startDate: 1, endDate: 1 });
timeIncentiveSchema.index({ companyId: 1, shift: 1, startDate: 1 });

export default mongoose.model('TimeIncentive', timeIncentiveSchema);
