import mongoose from 'mongoose';

/**
 * MilkPurchaseSettings.js
 * ─────────────────────────────────────────────────────────────────────────────
 * One settings document per company (upsert pattern).
 * Stores: quantity unit, manual-entry parameter combo, printer type,
 *         hardware device toggles, and machine configuration settings.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Sub-schema: Hardware Machine Toggles ────────────────────────────────────
const machinesSchema = new mongoose.Schema(
  {
    weighingScale      : { type: Boolean, default: false },
    milkAnalyzer       : { type: Boolean, default: false },
    digitalDisplay     : { type: Boolean, default: false },
    announcementSystem : { type: Boolean, default: false },
  },
  { _id: false }
);

// ─── Sub-schema: Weighing Scale Configuration ─────────────────────────────────
const weighingScaleConfigSchema = new mongoose.Schema(
  {
    comPort    : { type: String, default: 'ttyS0' },
    baudRate   : { type: Number, enum: [1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200], default: 9600 },
    tareString : { type: String, default: 'T' },
    ctrlChar   : { type: String, default: '#' },
    length     : { type: Number, default: 0 },
  },
  { _id: false }
);

// ─── Sub-schema: LED Display Configuration ────────────────────────────────────
const ledDisplayConfigSchema = new mongoose.Schema(
  {
    device   : { type: String, enum: ['COMIENZ', 'ARIES', 'GENERIC', 'NONE'], default: 'COMIENZ' },
    comPort  : { type: String, default: 'ttyUSB0' },
    baudRate : { type: Number, enum: [1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200], default: 9600 },
  },
  { _id: false }
);

// ─── Sub-schema: Milk Analyzer Configuration ──────────────────────────────────
const milkAnalyzerConfigSchema = new mongoose.Schema(
  {
    device                 : { type: String, enum: ['LACTO SURE ECO', 'LACTO STAR', 'MILKO TESTER', 'EKOMILK', 'NONE'], default: 'LACTO SURE ECO' },
    comPort                : { type: String, default: 'ttyS1' },
    baudRate               : { type: Number, enum: [1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200], default: 9600 },
    manualEntryCombination : { type: String, enum: ['CLR-FAT', 'FAT-SNF'], default: 'FAT-SNF' },
  },
  { _id: false }
);

// ─── Sub-schema: Other Analyzer Manual Configuration ──────────────────────────
const otherAnalyzerConfigSchema = new mongoose.Schema(
  {
    fatPosStart : { type: Number, default: 0 },
    fatPosEnd   : { type: Number, default: 0 },
    snfPosStart : { type: Number, default: 0 },
    snfPosEnd   : { type: Number, default: 0 },
    outputLen   : { type: Number, default: 0 },
  },
  { _id: false }
);

// ─── Main Settings Schema ────────────────────────────────────────────────────
const milkPurchaseSettingsSchema = new mongoose.Schema(
  {
    // Company scoping (one document per company)
    companyId: {
      type     : mongoose.Schema.Types.ObjectId,
      ref      : 'Company',
      required : true,
      unique   : true,
      index    : true,
    },

    // ── Quantity unit for milk collection entries ──────────────────────────
    quantityUnit: {
      type    : String,
      enum    : ['Litre', 'KG'],
      default : 'Litre',
    },

    // ── Parameters shown on the manual entry screen ────────────────────────
    manualEntryCombination: {
      type    : String,
      enum    : ['CLR-FAT', 'FAT-SNF'],
      default : 'CLR-FAT',
    },

    // ── Active rate chart type used for rate calculation ──────────────────
    activeRateChartType: {
      type    : String,
      enum    : ['ManualEntry', 'ApplyFormula', 'LowChart', 'GoldLessChart', 'SlabRate'],
      default : 'ApplyFormula',
    },

    // ── Printer / paper type for milk bill printing ────────────────────────
    printSize: {
      type    : String,
      enum    : ['2 inch', '3 inch', 'Dot Matrix', 'Laser Printer'],
      default : '3 inch',
    },

    // ── Connected hardware device toggles ──────────────────────────────────
    machines: {
      type    : machinesSchema,
      default : () => ({}),
    },

    // ── Weighing Scale COM configuration ───────────────────────────────────
    weighingScaleConfig: {
      type    : weighingScaleConfigSchema,
      default : () => ({}),
    },

    // ── LED Display configuration ──────────────────────────────────────────
    ledDisplayConfig: {
      type    : ledDisplayConfigSchema,
      default : () => ({}),
    },

    // ── Milk Analyzer configuration ────────────────────────────────────────
    milkAnalyzerConfig: {
      type    : milkAnalyzerConfigSchema,
      default : () => ({}),
    },

    // ── Other Analyzer manual configuration ───────────────────────────────
    otherAnalyzerConfig: {
      type    : otherAnalyzerConfigSchema,
      default : () => ({}),
    },

    // ── Audit trail (who last saved the settings) ──────────────────────────
    lastUpdatedBy: {
      type : mongoose.Schema.Types.ObjectId,
      ref  : 'User',
    },
  },
  {
    timestamps : true,
    collection : 'milkpurchasesettings',
  }
);

// ─── Static helper: get or create default settings for a company ─────────────
milkPurchaseSettingsSchema.statics.getOrCreate = async function (companyId) {
  let doc = await this.findOne({ companyId });
  if (!doc) {
    doc = await this.create({ companyId });
  }
  return doc;
};

const MilkPurchaseSettings = mongoose.model(
  'MilkPurchaseSettings',
  milkPurchaseSettingsSchema
);

export default MilkPurchaseSettings;
