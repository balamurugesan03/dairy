import mongoose from 'mongoose';

/**
 * FarmerSettings.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Singleton settings document per company for the Farmer Management module.
 *
 * membershipFunction controls what happens when a Non-Member is assigned
 * Membership and the Member Number entered differs from the existing Farmer
 * Number. Previously this asked a Yes/No confirmation dialog every time
 * ("Confirm Farmer Number Replacement"); it's now a standing setting so the
 * decision doesn't have to be made on every activation:
 *   'SubmitLinks'        — (the old "Yes") replace the Farmer Number with
 *                          the Member Number.
 *   'OpenLinksAndOthers' — (the old "No") keep the existing Farmer Number;
 *                          store the Member Number separately.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const farmerSettingsSchema = new mongoose.Schema(
  {
    companyId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Company',
      required: true,
      unique:   true,
      index:    true,
    },

    membershipFunction: {
      type:    String,
      enum:    ['SubmitLinks', 'OpenLinksAndOthers'],
      default: 'SubmitLinks', // preserves the old Yes-was-the-common-choice behavior by default
    },

    // Farmer Number series for NEW farmers (existing numbers are never changed):
    //   'Existing' — one common sequence 1, 2, 3 … (the original behaviour)
    //   'Centre'   — each centre has its own sequence, prefixed with the centre's
    //                numeric Farmer No Code: code 1 → 1001, 1002 …; code 2 → 2001 …
    // Numbers stay digits-only (Milk Purchase Farmer No is numeric) and unique.
    numberSeries: {
      type:    String,
      enum:    ['Existing', 'Centre'],
      default: 'Existing',
    },
    // Digits in the per-centre sequence part (3 → code 1 gives 1001)
    centreSeriesWidth: {
      type:    Number,
      min:     1,
      max:     6,
      default: 3,
    },

    // Default Centre / Agent preselected for admin logins on entry forms.
    // Staff and agent logins always use their own assigned centre / agent.
    defaultCentre: { type: mongoose.Schema.Types.ObjectId, ref: 'CollectionCenter', default: null },
    defaultAgent:  { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },

    lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    collection: 'farmersettings',
  }
);

// Static helper: get or create defaults for a company
farmerSettingsSchema.statics.getOrCreate = async function (companyId) {
  let doc = await this.findOne({ companyId });
  if (!doc) doc = await this.create({ companyId });
  return doc;
};

export default mongoose.model('FarmerSettings', farmerSettingsSchema);
