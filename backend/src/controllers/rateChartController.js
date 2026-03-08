import { ManualEntry, ApplyFormula, LowChart, GoldLessChart, SlabRate } from '../models/RateChart.js';

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
