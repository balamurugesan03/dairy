import HistoricalRule from '../models/HistoricalRule.js';
import EarningDeduction from '../models/EarningDeduction.js';

// ── GET ALL ──────────────────────────────────────────────────────
export const getAll = async (req, res) => {
  try {
    const { page = 1, limit = 50, component } = req.query;
    const filter = { companyId: req.companyId };
    if (component) filter.component = component;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [records, total] = await Promise.all([
      HistoricalRule.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      HistoricalRule.countDocuments(filter),
    ]);

    res.json({ success: true, data: records, total, page: parseInt(page) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── CREATE ───────────────────────────────────────────────────────
export const create = async (req, res) => {
  try {
    const {
      component, applicableTo, basedOn, pouringTime,
      amRate, pmRate, fixedRate, startDate, endDate,
      earningDeductionId, applyDate,
    } = req.body;

    // Resolve item name
    let itemName = '';
    if (earningDeductionId) {
      const item = await EarningDeduction.findOne({
        _id: earningDeductionId, companyId: req.companyId,
      }).select('name').lean();
      itemName = item?.name || '';
    }

    const record = await HistoricalRule.create({
      component, applicableTo, basedOn, pouringTime,
      amRate:    amRate    || 0,
      pmRate:    pmRate    || 0,
      fixedRate: fixedRate || 0,
      startDate, endDate,
      earningDeductionId,
      itemName,
      applyDate,
      companyId: req.companyId,
      createdBy: req.user?._id,
    });

    res.status(201).json({ success: true, data: record, message: 'Rule added successfully' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// ── DELETE ───────────────────────────────────────────────────────
export const remove = async (req, res) => {
  try {
    const record = await HistoricalRule.findOneAndDelete({
      _id: req.params.id, companyId: req.companyId,
    });
    if (!record) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
