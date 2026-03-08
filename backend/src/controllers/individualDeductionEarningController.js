import IndividualDeductionEarning from '../models/IndividualDeductionEarning.js';
import Farmer from '../models/Farmer.js';
import EarningDeduction from '../models/EarningDeduction.js';

// ── GET ALL ──────────────────────────────────────────────────────
export const getAll = async (req, res) => {
  try {
    const {
      page     = 1,
      limit    = 20,
      type,
      date,
      producerId,
    } = req.query;

    const filter = { companyId: req.companyId };
    if (type)       filter.type       = type;
    if (producerId) filter.producerId = producerId;
    if (date) {
      const d = new Date(date);
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const end   = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      filter.date = { $gte: start, $lt: end };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [records, total] = await Promise.all([
      IndividualDeductionEarning.find(filter)
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      IndividualDeductionEarning.countDocuments(filter),
    ]);

    res.json({ success: true, data: records, total, page: parseInt(page) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET BY ID ────────────────────────────────────────────────────
export const getById = async (req, res) => {
  try {
    const record = await IndividualDeductionEarning.findOne({
      _id: req.params.id, companyId: req.companyId,
    }).lean();
    if (!record) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: record });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── CREATE ───────────────────────────────────────────────────────
export const create = async (req, res) => {
  try {
    const { date, type, producerCode, amount, description, earningDeductionId } = req.body;

    // Resolve producer info by memberId
    let producerId   = null;
    let producerName = '';
    if (producerCode) {
      const farmer = await Farmer.findOne({
        memberId: producerCode,
      }).select('memberId personalDetails.name').lean();

      if (!farmer) {
        return res.status(400).json({ success: false, message: `Member ID "${producerCode}" not found` });
      }
      producerId   = farmer._id;
      producerName = farmer.personalDetails?.name || '';
    }

    // Resolve item name
    let itemName = '';
    if (earningDeductionId) {
      const item = await EarningDeduction.findOne({
        _id: earningDeductionId, companyId: req.companyId,
      }).select('name').lean();
      itemName = item?.name || '';
    }

    const record = await IndividualDeductionEarning.create({
      date,
      type,
      producerId,
      producerCode,
      producerName,
      earningDeductionId,
      itemName,
      amount,
      description: description || '',
      companyId:   req.companyId,
      createdBy:   req.user?._id,
    });

    res.status(201).json({ success: true, data: record, message: 'Saved successfully' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// ── UPDATE ───────────────────────────────────────────────────────
export const update = async (req, res) => {
  try {
    const { date, type, producerCode, amount, description, earningDeductionId } = req.body;

    let producerId   = null;
    let producerName = '';
    if (producerCode) {
      const farmer = await Farmer.findOne({
        memberId: producerCode,
      }).select('memberId personalDetails.name').lean();

      if (!farmer) {
        return res.status(400).json({ success: false, message: `Member ID "${producerCode}" not found` });
      }
      producerId   = farmer._id;
      producerName = farmer.personalDetails?.name || '';
    }

    let itemName = '';
    if (earningDeductionId) {
      const item = await EarningDeduction.findOne({
        _id: earningDeductionId, companyId: req.companyId,
      }).select('name').lean();
      itemName = item?.name || '';
    }

    const record = await IndividualDeductionEarning.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      { date, type, producerId, producerCode, producerName, earningDeductionId, itemName, amount, description: description || '' },
      { new: true, runValidators: true }
    );

    if (!record) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: record, message: 'Updated successfully' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// ── DELETE ───────────────────────────────────────────────────────
export const remove = async (req, res) => {
  try {
    const record = await IndividualDeductionEarning.findOneAndDelete({
      _id: req.params.id, companyId: req.companyId,
    });
    if (!record) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── LOOKUP PRODUCER ──────────────────────────────────────────────
export const lookupProducer = async (req, res) => {
  try {
    const { code } = req.params;
    const farmer = await Farmer.findOne({
      memberId: code,
    }).select('memberId personalDetails.name').lean();

    if (!farmer) return res.status(404).json({ success: false, message: 'Member ID not found' });

    res.json({
      success: true,
      data: {
        id:   farmer._id,
        code: farmer.memberId,
        name: farmer.personalDetails?.name || '',
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
