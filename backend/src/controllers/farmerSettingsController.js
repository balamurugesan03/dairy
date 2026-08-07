import FarmerSettings from '../models/FarmerSettings.js';

/**
 * farmerSettingsController.js
 * ─────────────────────────────────────────────────────────────────────────────
 * CRUD for the per-company Farmer Management Settings document.
 *
 * API surface:
 *   GET /api/farmer-settings   → getSettings
 *   PUT /api/farmer-settings   → upsertSettings
 * ─────────────────────────────────────────────────────────────────────────────
 */

const VALID_MEMBERSHIP_FUNCTIONS = ['SubmitLinks', 'OpenLinksAndOthers'];

// ══════════════════════════════════════════════════════════════════════════════
//  GET SETTINGS
//  GET /api/farmer-settings
// ══════════════════════════════════════════════════════════════════════════════
export const getSettings = async (req, res) => {
  try {
    const settings = await FarmerSettings.getOrCreate(req.companyId);
    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
//  UPSERT SETTINGS
//  PUT /api/farmer-settings
// ══════════════════════════════════════════════════════════════════════════════
export const upsertSettings = async (req, res) => {
  try {
    const { membershipFunction } = req.body;

    if (membershipFunction !== undefined && !VALID_MEMBERSHIP_FUNCTIONS.includes(membershipFunction)) {
      return res.status(400).json({
        success: false,
        message: `membershipFunction must be one of: ${VALID_MEMBERSHIP_FUNCTIONS.join(', ')}`,
      });
    }

    const update = {};
    if (membershipFunction !== undefined) update.membershipFunction = membershipFunction;
    if (req.user?._id) update.lastUpdatedBy = req.user._id;

    const settings = await FarmerSettings.findOneAndUpdate(
      { companyId: req.companyId },
      { $set: update },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, message: 'Settings saved successfully', data: settings });
  } catch (err) {
    const status = err.name === 'ValidationError' ? 400 : 500;
    res.status(status).json({ success: false, message: err.message });
  }
};

export default { getSettings, upsertSettings };
