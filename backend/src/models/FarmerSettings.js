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
    //   'Existing' — one common sequence 1, 2, 3 … for the company (the original behaviour)
    //   'Centre'   — each centre (C1, C2 …) has its own sequence 1, 2, 3 …, so the same
    //                number can exist in two centres; numbers are system-generated and locked
    numberSeries: {
      type:    String,
      enum:    ['Existing', 'Centre'],
      default: 'Existing',
    },

    // Default Centre / Agent now come from the logged-in user (User Management), not here.

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
