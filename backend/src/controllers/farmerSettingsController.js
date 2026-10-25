import FarmerSettings from '../models/FarmerSettings.js';
import CollectionCenter from '../models/CollectionCenter.js';

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
const VALID_NUMBER_SERIES = ['Existing', 'Centre'];

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
    const { membershipFunction, numberSeries, centreSeriesWidth, defaultCentre, defaultAgent } = req.body;

    if (membershipFunction !== undefined && !VALID_MEMBERSHIP_FUNCTIONS.includes(membershipFunction)) {
      return res.status(400).json({
        success: false,
        message: `membershipFunction must be one of: ${VALID_MEMBERSHIP_FUNCTIONS.join(', ')}`,
      });
    }
    if (numberSeries !== undefined && !VALID_NUMBER_SERIES.includes(numberSeries)) {
      return res.status(400).json({
        success: false,
        message: `numberSeries must be one of: ${VALID_NUMBER_SERIES.join(', ')}`,
      });
    }

    // Centre-wise series needs every active centre to have a unique numeric code
    if (numberSeries === 'Centre') {
      const centres = await CollectionCenter.find({ companyId: req.companyId, status: 'Active' })
        .select('centerName farmerNoCode').lean();
      const missing = centres.filter(c => !c.farmerNoCode).map(c => c.centerName);
      if (missing.length) {
        return res.status(400).json({
          success: false,
          message: `Set a Farmer No Code for these centres first (Collection Centre → Edit): ${missing.join(', ')}`,
        });
      }
    }

    const update = {};
    if (membershipFunction !== undefined) update.membershipFunction = membershipFunction;
    if (numberSeries !== undefined) update.numberSeries = numberSeries;
    if (centreSeriesWidth !== undefined) update.centreSeriesWidth = Number(centreSeriesWidth) || 3;
    if (defaultCentre !== undefined) update.defaultCentre = defaultCentre || null;
    if (defaultAgent !== undefined) update.defaultAgent = defaultAgent || null;
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
