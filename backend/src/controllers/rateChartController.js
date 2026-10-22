import { ManualEntry, ApplyFormula, LowChart, GoldLessChart, SlabRate, TSRateCharge } from '../models/RateChart.js';

// ════════════════════════════════════════════════════════════════
//  MANUAL ENTRY
// ════════════════════════════════════════════════════════════════
export const getManualEntries = async (req, res) => {
  try {
    const entries = await ManualEntry.find({ companyId: req.companyId }).sort({ fromDate: -1 });
    res.json({ success: true, data: entries });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createManualEntry = async (req, res) => {
  try {
    const entry = await ManualEntry.create({ ...req.body, companyId: req.companyId });
    res.status(201).json({ success: true, data: entry });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const updateManualEntry = async (req, res) => {
  try {
    const entry = await ManualEntry.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!entry) return res.status(404).json({ success: false, message: 'Entry not found' });
    res.json({ success: true, data: entry });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const deleteManualEntry = async (req, res) => {
  try {
    const entry = await ManualEntry.findOneAndDelete({ _id: req.params.id, companyId: req.companyId });
    if (!entry) return res.status(404).json({ success: false, message: 'Entry not found' });
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ════════════════════════════════════════════════════════════════
//  APPLY FORMULA
// ════════════════════════════════════════════════════════════════
export const getFormulas = async (req, res) => {
  try {
    const formulas = await ApplyFormula.find({ companyId: req.companyId }).sort({ fromDate: -1 });
    res.json({ success: true, data: formulas });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createFormula = async (req, res) => {
  try {
    const formula = await ApplyFormula.create({ ...req.body, companyId: req.companyId });
    res.status(201).json({ success: true, data: formula });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const updateFormula = async (req, res) => {
  try {
    const formula = await ApplyFormula.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!formula) return res.status(404).json({ success: false, message: 'Formula not found' });
    res.json({ success: true, data: formula });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const deleteFormula = async (req, res) => {
  try {
    const formula = await ApplyFormula.findOneAndDelete({ _id: req.params.id, companyId: req.companyId });
    if (!formula) return res.status(404).json({ success: false, message: 'Formula not found' });
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ════════════════════════════════════════════════════════════════
//  LOW CHART
// ════════════════════════════════════════════════════════════════
export const getLowCharts = async (req, res) => {
  try {
    const entries = await LowChart.find({ companyId: req.companyId }).sort({ fromDate: -1 });
    res.json({ success: true, data: entries });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createLowChart = async (req, res) => {
  try {
    const entry = await LowChart.create({ ...req.body, companyId: req.companyId });
    res.status(201).json({ success: true, data: entry });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const updateLowChart = async (req, res) => {
  try {
    const entry = await LowChart.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!entry) return res.status(404).json({ success: false, message: 'Entry not found' });
    res.json({ success: true, data: entry });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const deleteLowChart = async (req, res) => {
  try {
    const entry = await LowChart.findOneAndDelete({ _id: req.params.id, companyId: req.companyId });
    if (!entry) return res.status(404).json({ success: false, message: 'Entry not found' });
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ════════════════════════════════════════════════════════════════
//  GOLD / LESS / EXISTING RATE CHART
// ════════════════════════════════════════════════════════════════
export const getGoldLessCharts = async (req, res) => {
  try {
    const entries = await GoldLessChart.find({ companyId: req.companyId }).sort({ fromDate: -1 });
    res.json({ success: true, data: entries });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createGoldLessChart = async (req, res) => {
  try {
    const entry = await GoldLessChart.create({ ...req.body, companyId: req.companyId });
    res.status(201).json({ success: true, data: entry });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const updateGoldLessChart = async (req, res) => {
  try {
    const entry = await GoldLessChart.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!entry) return res.status(404).json({ success: false, message: 'Entry not found' });
    res.json({ success: true, data: entry });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const deleteGoldLessChart = async (req, res) => {
  try {
    const entry = await GoldLessChart.findOneAndDelete({ _id: req.params.id, companyId: req.companyId });
    if (!entry) return res.status(404).json({ success: false, message: 'Entry not found' });
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ════════════════════════════════════════════════════════════════
//  SLAB RATE
// ════════════════════════════════════════════════════════════════
export const getSlabRates = async (req, res) => {
  try {
    const entries = await SlabRate.find({ companyId: req.companyId }).sort({ fromDate: -1 });
    res.json({ success: true, data: entries });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createSlabRate = async (req, res) => {
  try {
    const entry = await SlabRate.create({ ...req.body, companyId: req.companyId });
    res.status(201).json({ success: true, data: entry });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const updateSlabRate = async (req, res) => {
  try {
    const entry = await SlabRate.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!entry) return res.status(404).json({ success: false, message: 'Entry not found' });
    res.json({ success: true, data: entry });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const deleteSlabRate = async (req, res) => {
  try {
    const entry = await SlabRate.findOneAndDelete({ _id: req.params.id, companyId: req.companyId });
    if (!entry) return res.status(404).json({ success: false, message: 'Entry not found' });
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ════════════════════════════════════════════════════════════════
//  TS (TOTAL SOLID) RATE CHARGE
// ════════════════════════════════════════════════════════════════
// 'YYYY-MM-DD' is read as a local calendar day (new Date() would read it as UTC)
const toLocalDate = (d) => {
  const m = typeof d === 'string' && /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(d);
};
const dayStart = (d) => { const x = toLocalDate(d); x.setHours(0, 0, 0, 0); return x; };
const dayEnd   = (d) => { const x = toLocalDate(d); x.setHours(23, 59, 59, 999); return x; };

// Normalises the period and rejects one that overlaps another saved period,
// so any date resolves to exactly one TS rate. On create, an open-ended period
// that started earlier is not a clash: it gets closed the day before (rate revision).
const validateTsPeriod = async (companyId, body, excludeId = null, allowClose = false) => {
  if (body.tsRate === undefined || body.tsRate === null || body.tsRate === '' || Number(body.tsRate) < 0)
    return { error: 'TS Rate is required' };
  if (!body.fromDate) return { error: 'From Date is required' };
  const fromDate = dayStart(body.fromDate);
  const toDate   = body.toDate ? dayEnd(body.toDate) : null;
  if (toDate && toDate < fromDate) return { error: 'To Date must be on or after From Date' };

  const filter = {
    companyId,
    fromDate: { $lte: toDate || new Date('9999-12-31') },
    $or: [{ toDate: null }, { toDate: { $gte: fromDate } }]
  };
  if (excludeId) filter._id = { $ne: excludeId };
  const clashes = await TSRateCharge.find(filter).sort({ fromDate: 1 });
  const closable = allowClose
    ? clashes.find(c => !c.toDate && c.fromDate < fromDate)
    : null;
  const clash = clashes.find(c => c !== closable);
  if (clash) {
    const fmt = (d) => d ? new Date(d).toLocaleDateString('en-GB') : 'open';
    return { error: `Period overlaps an existing TS rate (${fmt(clash.fromDate)} → ${fmt(clash.toDate)}, ₹${clash.tsRate})` };
  }
  return {
    data: { tsRate: Number(body.tsRate), fromDate, toDate, remarks: body.remarks || '' },
    closeId: closable?._id || null
  };
};

export const getTsRates = async (req, res) => {
  try {
    const entries = await TSRateCharge.find({ companyId: req.companyId }).sort({ fromDate: -1 });
    res.json({ success: true, data: entries });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /ts-rates/applicable?date=YYYY-MM-DD — the TS rate in force on that date
export const getApplicableTsRate = async (req, res) => {
  try {
    const date = req.query.date || new Date();
    const entry = await TSRateCharge.findOne({
      companyId: req.companyId,
      fromDate: { $lte: dayEnd(date) },
      $or: [{ toDate: null }, { toDate: { $gte: dayStart(date) } }]
    }).sort({ fromDate: -1 });
    res.json({ success: true, data: entry || null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createTsRate = async (req, res) => {
  try {
    const { error, data, closeId } = await validateTsPeriod(req.companyId, req.body, null, true);
    if (error) return res.status(400).json({ success: false, message: error });
    if (closeId) {
      const prevEnd = dayEnd(new Date(data.fromDate.getTime() - 24 * 60 * 60 * 1000));
      await TSRateCharge.updateOne({ _id: closeId, companyId: req.companyId }, { toDate: prevEnd });
    }
    const entry = await TSRateCharge.create({ ...data, companyId: req.companyId });
    res.status(201).json({ success: true, data: entry });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const updateTsRate = async (req, res) => {
  try {
    const { error, data } = await validateTsPeriod(req.companyId, req.body, req.params.id);
    if (error) return res.status(400).json({ success: false, message: error });
    const entry = await TSRateCharge.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      data,
      { new: true, runValidators: true }
    );
    if (!entry) return res.status(404).json({ success: false, message: 'Entry not found' });
    res.json({ success: true, data: entry });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const deleteTsRate = async (req, res) => {
  try {
    const entry = await TSRateCharge.findOneAndDelete({ _id: req.params.id, companyId: req.companyId });
    if (!entry) return res.status(404).json({ success: false, message: 'Entry not found' });
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
