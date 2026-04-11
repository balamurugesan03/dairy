import MilkPurchaseSettings from '../models/MilkPurchaseSettings.js';

/**
 * milkPurchaseSettingsController.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles CRUD for the per-company Milk Purchase Settings document.
 *
 * API surface:
 *   GET    /api/milk-purchase-settings          → getSettings
 *   PUT    /api/milk-purchase-settings          → upsertSettings
 *   DELETE /api/milk-purchase-settings/reset    → resetSettings
 *   PATCH  /api/milk-purchase-settings/machines/:key → toggleMachine
 *   GET    /api/milk-purchase-settings/summary  → getSettingsSummary
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Default values (mirrors the model defaults, used for reset) ──────────────
const DEFAULTS = {
  quantityUnit           : 'Litre',
  manualEntryCombination : 'CLR-FAT',
  activeRateChartType    : 'ApplyFormula',
  printSize              : '3 inch',
  machines: {
    weighingScale      : false,
    milkAnalyzer       : false,
    digitalDisplay     : false,
    announcementSystem : false,
  },
  weighingScaleConfig: {
    comPort    : 'COM2',
    baudRate   : 9600,
    tareString : 'T',
    ctrlChar   : '#',
    length     : 0,
  },
  ledDisplayConfig: {
    device   : 'COMIENZ',
    comPort  : 'COM3',
    baudRate : 9600,
  },
  milkAnalyzerConfig: {
    device                 : 'LACTO SURE ECO',
    comPort                : 'COM11',
    baudRate               : 9600,
    manualEntryCombination : 'FAT-SNF',
  },
  otherAnalyzerConfig: {
    fatPosStart : 0,
    fatPosEnd   : 0,
    snfPosStart : 0,
    snfPosEnd   : 0,
    outputLen   : 0,
  },
};

// ─── Helper: flatten nested config object into dot-notation $set fields ────────
function flattenConfig(prefix, obj, update) {
  if (!obj || typeof obj !== 'object') return;
  Object.entries(obj).forEach(([key, val]) => {
    if (val !== undefined) update[`${prefix}.${key}`] = val;
  });
}

// ══════════════════════════════════════════════════════════════════════════════
//  GET SETTINGS
//  GET /api/milk-purchase-settings
// ══════════════════════════════════════════════════════════════════════════════
export const getSettings = async (req, res) => {
  try {
    const settings = await MilkPurchaseSettings.getOrCreate(req.companyId);
    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
//  UPSERT SETTINGS
//  PUT /api/milk-purchase-settings
// ══════════════════════════════════════════════════════════════════════════════
export const upsertSettings = async (req, res) => {
  try {
    const {
      quantityUnit,
      manualEntryCombination,
      printSize,
      machines,
      weighingScaleConfig,
      ledDisplayConfig,
      milkAnalyzerConfig,
      otherAnalyzerConfig,
    } = req.body;

    const update = {};

    if (quantityUnit           !== undefined) update.quantityUnit           = quantityUnit;
    if (manualEntryCombination !== undefined) update.manualEntryCombination = manualEntryCombination;
    if (printSize              !== undefined) update.printSize              = printSize;

    // Machine toggles – merge individually
    if (machines && typeof machines === 'object') {
      ['weighingScale', 'milkAnalyzer', 'digitalDisplay', 'announcementSystem'].forEach(k => {
        if (machines[k] !== undefined) update[`machines.${k}`] = machines[k];
      });
    }

    // Machine config sub-documents – flatten to dot-notation
    flattenConfig('weighingScaleConfig', weighingScaleConfig, update);
    flattenConfig('ledDisplayConfig',    ledDisplayConfig,    update);
    flattenConfig('milkAnalyzerConfig',  milkAnalyzerConfig,  update);
    flattenConfig('otherAnalyzerConfig', otherAnalyzerConfig, update);

    if (req.user?._id) update.lastUpdatedBy = req.user._id;

    const settings = await MilkPurchaseSettings.findOneAndUpdate(
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

// ══════════════════════════════════════════════════════════════════════════════
//  RESET SETTINGS TO DEFAULTS
//  DELETE /api/milk-purchase-settings/reset
// ══════════════════════════════════════════════════════════════════════════════
export const resetSettings = async (req, res) => {
  try {
    const settings = await MilkPurchaseSettings.findOneAndUpdate(
      { companyId: req.companyId },
      { $set: { ...DEFAULTS, lastUpdatedBy: req.user?._id } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    res.json({ success: true, message: 'Settings reset to factory defaults', data: settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
//  UPDATE INDIVIDUAL MACHINE TOGGLE
//  PATCH /api/milk-purchase-settings/machines/:key
// ══════════════════════════════════════════════════════════════════════════════
export const toggleMachine = async (req, res) => {
  try {
    const VALID_KEYS = ['weighingScale', 'milkAnalyzer', 'digitalDisplay', 'announcementSystem'];
    const { key } = req.params;

    if (!VALID_KEYS.includes(key)) {
      return res.status(400).json({
        success : false,
        message : `Invalid machine key. Valid keys: ${VALID_KEYS.join(', ')}`,
      });
    }

    if (req.body.enabled === undefined) {
      return res.status(400).json({
        success : false,
        message : 'Body must contain { enabled: true | false }',
      });
    }

    const settings = await MilkPurchaseSettings.findOneAndUpdate(
      { companyId: req.companyId },
      { $set: { [`machines.${key}`]: Boolean(req.body.enabled), lastUpdatedBy: req.user?._id } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    res.json({
      success : true,
      message : `${key} ${req.body.enabled ? 'enabled' : 'disabled'}`,
      data    : settings,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
//  FIX COM PORTS  — one-time migration: replace Linux tty* defaults with Windows COM ports
//  POST /api/milk-purchase-settings/fix-com-ports
// ══════════════════════════════════════════════════════════════════════════════
export const fixComPorts = async (req, res) => {
  try {
    const settings = await MilkPurchaseSettings.findOne({ companyId: req.companyId });
    if (!settings) {
      return res.json({ success: true, message: 'No settings record found — nothing to fix.' });
    }

    const update = {};
    const linuxPorts = ['ttyS0', 'ttyS1', 'ttyS2', 'ttyUSB0', 'ttyUSB1'];

    if (linuxPorts.includes(settings.weighingScaleConfig?.comPort)) {
      update['weighingScaleConfig.comPort'] = 'COM2';
    }
    if (linuxPorts.includes(settings.ledDisplayConfig?.comPort)) {
      update['ledDisplayConfig.comPort'] = 'COM3';
    }
    if (linuxPorts.includes(settings.milkAnalyzerConfig?.comPort)) {
      update['milkAnalyzerConfig.comPort'] = 'COM11';
    }

    if (Object.keys(update).length === 0) {
      return res.json({ success: true, message: 'COM ports already set correctly — no changes needed.', data: { weighingScale: settings.weighingScaleConfig?.comPort, ledDisplay: settings.ledDisplayConfig?.comPort, milkAnalyzer: settings.milkAnalyzerConfig?.comPort } });
    }

    const updated = await MilkPurchaseSettings.findOneAndUpdate(
      { companyId: req.companyId },
      { $set: update },
      { new: true }
    );

    res.json({
      success : true,
      message : `COM ports updated: ${Object.entries(update).map(([k, v]) => `${k.split('.')[0]} → ${v}`).join(', ')}`,
      data    : { weighingScale: updated.weighingScaleConfig?.comPort, ledDisplay: updated.ledDisplayConfig?.comPort, milkAnalyzer: updated.milkAnalyzerConfig?.comPort },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
//  GET SUMMARY  (lightweight – only fields needed for the MilkPurchase screen)
//  GET /api/milk-purchase-settings/summary
// ══════════════════════════════════════════════════════════════════════════════
export const getSettingsSummary = async (req, res) => {
  try {
    const settings = await MilkPurchaseSettings
      .findOne({ companyId: req.companyId })
      .select('quantityUnit manualEntryCombination activeRateChartType printSize machines milkAnalyzerConfig -_id');

    const data = settings || {
      quantityUnit           : DEFAULTS.quantityUnit,
      manualEntryCombination : DEFAULTS.manualEntryCombination,
      activeRateChartType    : DEFAULTS.activeRateChartType,
      printSize              : DEFAULTS.printSize,
      machines               : DEFAULTS.machines,
      milkAnalyzerConfig     : DEFAULTS.milkAnalyzerConfig,
    };

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
