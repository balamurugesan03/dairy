import MilkSalesRate from '../models/MilkSalesRate.js';

// ════════════════════════════════════════════════════════════════
//  GET ALL (paginated + search + filter)
// ════════════════════════════════════════════════════════════════
export const getMilkSalesRates = async (req, res) => {
  try {
    const { page = 1, limit = 15, search = '', partyId, salesItem, partyType } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = { companyId: req.companyId };

    if (search) {
      filter.partyName = { $regex: search, $options: 'i' };
    }
    if (partyId) filter.partyId = partyId;
    if (salesItem) filter.salesItem = salesItem;
    if (partyType) filter.partyType = partyType;

    const [rates, total] = await Promise.all([
      MilkSalesRate.find(filter)
        .sort({ wefDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      MilkSalesRate.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: rates,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ════════════════════════════════════════════════════════════════
//  GET LATEST RATE (for billing — latest rate on/before a date)
// ════════════════════════════════════════════════════════════════
export const getLatestRate = async (req, res) => {
  try {
    const { partyId, salesItem, date } = req.query;

    if (!salesItem) {
      return res.status(400).json({
        success: false,
        message: 'salesItem is required'
      });
    }

    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(23, 59, 59, 999);

    const filter = {
      companyId: req.companyId,
      salesItem,
      wefDate: { $lte: targetDate }
    };
    // partyId is required for Credit Sales; optional for Local/Sample Sales
    if (partyId) filter.partyId = partyId;

    const rate = await MilkSalesRate.findOne(filter)
      .sort({ wefDate: -1 })
      .lean();

    // Return null data (not 404) when no rate is configured — avoids console errors
    res.json({ success: true, data: rate || null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ════════════════════════════════════════════════════════════════
//  GET RATE HISTORY for a party
// ════════════════════════════════════════════════════════════════
export const getRateHistory = async (req, res) => {
  try {
    const { partyId } = req.params;

    const rates = await MilkSalesRate.find({
      companyId: req.companyId,
      partyId
    })
      .sort({ wefDate: -1 })
      .lean();

    res.json({ success: true, data: rates });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ════════════════════════════════════════════════════════════════
//  CREATE
// ════════════════════════════════════════════════════════════════
export const createMilkSalesRate = async (req, res) => {
  try {
    const body = { ...req.body, companyId: req.companyId };
    // For Local/Sample Sales, partyId is not needed — strip empty strings
    if (!body.partyId || body.partyId === '') delete body.partyId;
    if (!body.partyName || body.partyName === '') delete body.partyName;
    const rate = await MilkSalesRate.create(body);
    res.status(201).json({ success: true, data: rate });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'A rate for this party, sales item and date already exists. Duplicate entries are not allowed.'
      });
    }
    res.status(400).json({ success: false, message: err.message });
  }
};

// ════════════════════════════════════════════════════════════════
//  UPDATE
// ════════════════════════════════════════════════════════════════
export const updateMilkSalesRate = async (req, res) => {
  try {
    const body = { ...req.body };
    if (!body.partyId || body.partyId === '') delete body.partyId;
    if (!body.partyName || body.partyName === '') delete body.partyName;
    const rate = await MilkSalesRate.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      body,
      { new: true, runValidators: true }
    );
    if (!rate) {
      return res.status(404).json({ success: false, message: 'Rate record not found' });
    }
    res.json({ success: true, data: rate });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'A rate for this party, sales item and date already exists.'
      });
    }
    res.status(400).json({ success: false, message: err.message });
  }
};
