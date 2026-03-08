import PeriodicalRule from '../models/PeriodicalRule.js';
import EarningDeduction from '../models/EarningDeduction.js';

export const getAll = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [records, total] = await Promise.all([
      PeriodicalRule.find({ companyId: req.companyId })
        .sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
      PeriodicalRule.countDocuments({ companyId: req.companyId }),
    ]);
    res.json({ success: true, data: records, total });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const create = async (req, res) => {
  try {
    const {
      component, applicableTo, basedOn, pouringTime,
      amRate, pmRate, fixedRate,
      earningDeductionId,
      criteria, collectionCenterType, collectionCenterIds, allCenters,
      amountLimit, wefDate, applyPeriod,
    } = req.body;

    let itemName = '';
    if (earningDeductionId) {
      const item = await EarningDeduction.findOne({ _id: earningDeductionId, companyId: req.companyId }).select('name').lean();
      itemName = item?.name || '';
    }

    const record = await PeriodicalRule.create({
      component, applicableTo, basedOn, pouringTime,
      amRate: amRate || 0, pmRate: pmRate || 0, fixedRate: fixedRate || 0,
      earningDeductionId, itemName,
      criteria: criteria || {},
      collectionCenterType: collectionCenterType || 'PRODUCER_CENTER',
      collectionCenterIds:  collectionCenterIds  || [],
      allCenters:           allCenters           || false,
      amountLimit:          amountLimit          || { enabled: false, amount: 0, period: 'APPLYING_PERIOD' },
      wefDate, applyPeriod: applyPeriod || 'EACH_PERIOD',
      companyId: req.companyId,
      createdBy: req.user?._id,
    });

    res.status(201).json({ success: true, data: record, message: 'Periodical rule saved' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const toggleStatus = async (req, res) => {
  try {
    const record = await PeriodicalRule.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!record) return res.status(404).json({ success: false, message: 'Not found' });
    record.active = !record.active;
    await record.save();
    res.json({ success: true, data: record });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const remove = async (req, res) => {
  try {
    const record = await PeriodicalRule.findOneAndDelete({ _id: req.params.id, companyId: req.companyId });
    if (!record) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
