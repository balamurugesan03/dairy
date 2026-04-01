import mongoose from 'mongoose';

/**
 * DairySettings.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Singleton settings document per company.
 * Stores: payment cycle days, account start date, and opening balances.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const dairySettingsSchema = new mongoose.Schema(
  {
    companyId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Company',
      required: true,
      unique:   true,
      index:    true,
    },

    // ── Payment Settings ───────────────────────────────────────────────────
    // Default payment cycle length (days). Drives auto-date on payment register.
    paymentDays: {
      type:    Number,
      enum:    [7, 10, 15, 30],
      default: 15,
    },

    // The starting date of the payment cycle (from date for the register)
    paymentFromDate: {
      type: Date,
    },

    // ── Account Settings ──────────────────────────────────────────────────
    // The calendar date from which this society's accounts start in the software.
    accountStartDate: {
      type: Date,
    },

    // Opening balance on accountStartDate (cash / bank position on day-1)
    accountStartDateOpeningBalance: {
      type:    Number,
      default: 0,
    },
    accountStartDateOpeningBalanceType: {
      type:    String,
      enum:    ['Dr', 'Cr'],
      default: 'Dr',
    },

    // Opening balance at the start of the currently active financial year
    financialYearOpeningBalance: {
      type:    Number,
      default: 0,
    },
    financialYearOpeningBalanceType: {
      type:    String,
      enum:    ['Dr', 'Cr'],
      default: 'Dr',
    },

    // ── Audit trail ────────────────────────────────────────────────────────
    lastUpdatedBy: { type: String },
  },
  {
    timestamps: true,
    collection: 'dairysettings',
  }
);

// Static helper: get or create defaults for a company
dairySettingsSchema.statics.getOrCreate = async function (companyId) {
  let doc = await this.findOne({ companyId });
  if (!doc) doc = await this.create({ companyId });
  return doc;
};

export default mongoose.model('DairySettings', dairySettingsSchema);
