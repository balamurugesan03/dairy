import UnionSalesSlip from '../models/UnionSalesSlip.js';

// ── Auto-generate slip number: USS-YYMM-XXXXX ─────────────────────────────
const generateSlipNo = async (companyId) => {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `USS-${yy}${mm}-`;

  const last = await UnionSalesSlip.findOne(
    { companyId, slipNo: { $regex: `^${prefix}` } },
    { slipNo: 1 },
    { sort: { slipNo: -1 } }
  );

  let seq = 1;
  if (last) {
    const parts = last.slipNo.split('-');
    seq = parseInt(parts[parts.length - 1], 10) + 1;
  }
  return `${prefix}${String(seq).padStart(5, '0')}`;
};

// ── CREATE ─────────────────────────────────────────────────────────────────
export const createSlip = async (req, res) => {
  try {
    const { date, time } = req.body;

    // Duplicate check: same date + time for this company
    const dateObj = new Date(date);
    dateObj.setHours(0, 0, 0, 0);
    const nextDay = new Date(dateObj);
    nextDay.setDate(nextDay.getDate() + 1);

    const existing = await UnionSalesSlip.findOne({
      companyId: req.companyId,
      date: { $gte: dateObj, $lt: nextDay },
      time,
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: `A Union Sales Slip already exists for ${new Date(date).toLocaleDateString('en-IN')} - ${time} session.`,
      });
    }

    const slipNo = await generateSlipNo(req.companyId);

    // Auto-calculate amount
    const qty = parseFloat(req.body.qty) || 0;
    const rate = parseFloat(req.body.rate) || 0;
    const amount = parseFloat((qty * rate).toFixed(2));

    const slip = new UnionSalesSlip({
      ...req.body,
      slipNo,
      amount,
      date: dateObj,
      companyId: req.companyId,
      createdBy: req.user?._id,
    });

    await slip.save();
    res.status(201).json({ success: true, data: slip });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'A record already exists for this Date and Time session.',
      });
    }
    console.error('Error creating union sales slip:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

// ── GET ALL ────────────────────────────────────────────────────────────────
export const getAllSlips = async (req, res) => {
  try {
    const {
      month, year, fromDate, toDate,
      time, search,
      page = 1, limit = 100,
      sortField = 'date', sortOrder = 'desc',
    } = req.query;

    const query = { companyId: req.companyId };

    // Month + Year filter
    if (month && year) {
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999);
      query.date = { $gte: startDate, $lte: endDate };
    } else if (fromDate || toDate) {
      query.date = {};
      if (fromDate) query.date.$gte = new Date(fromDate);
      if (toDate) {
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999);
        query.date.$lte = to;
      }
    }

    if (time) query.time = time;

    const sortDir = sortOrder === 'asc' ? 1 : -1;
    const sortObj = { [sortField]: sortDir };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await UnionSalesSlip.countDocuments(query);

    let records = await UnionSalesSlip.find(query)
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit));

    // Search filter (client-side friendly, applied after fetch)
    if (search?.trim()) {
      const q = search.trim().toLowerCase();
      records = records.filter(r =>
        r.slipNo?.toLowerCase().includes(q) ||
        r.time?.toLowerCase().includes(q)
      );
    }

    // Monthly totals aggregation
    const totals = await UnionSalesSlip.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalQty: { $sum: '$qty' },
          totalAmount: { $sum: '$amount' },
          totalUnionSpoilage: { $sum: '$unionSpoilage' },
          totalTransportationSpoilage: { $sum: '$transportationSpoilage' },
          count: { $sum: 1 },
        },
      },
    ]);

    res.json({
      success: true,
      data: records,
      totals: totals[0] || { totalQty: 0, totalAmount: 0, totalUnionSpoilage: 0, totalTransportationSpoilage: 0, count: 0 },
      pagination: {
        currentPage: parseInt(page),
        total,
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Error fetching union sales slips:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET SINGLE ─────────────────────────────────────────────────────────────
export const getSlipById = async (req, res) => {
  try {
    const slip = await UnionSalesSlip.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!slip) return res.status(404).json({ success: false, message: 'Record not found' });
    res.json({ success: true, data: slip });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── UPDATE ─────────────────────────────────────────────────────────────────
export const updateSlip = async (req, res) => {
  try {
    const { date, time, qty, rate } = req.body;

    // Duplicate check: same date + time (exclude self)
    if (date && time) {
      const dateObj = new Date(date);
      dateObj.setHours(0, 0, 0, 0);
      const nextDay = new Date(dateObj);
      nextDay.setDate(nextDay.getDate() + 1);

      const duplicate = await UnionSalesSlip.findOne({
        companyId: req.companyId,
        date: { $gte: dateObj, $lt: nextDay },
        time,
        _id: { $ne: req.params.id },
      });

      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: `Another record already exists for ${new Date(date).toLocaleDateString('en-IN')} - ${time} session.`,
        });
      }
    }

    // Recalculate amount if qty or rate changed
    const updates = { ...req.body };
    if (qty !== undefined || rate !== undefined) {
      const existing = await UnionSalesSlip.findById(req.params.id);
      const newQty = parseFloat(qty ?? existing?.qty ?? 0);
      const newRate = parseFloat(rate ?? existing?.rate ?? 0);
      updates.amount = parseFloat((newQty * newRate).toFixed(2));
    }

    // Normalize date
    if (updates.date) {
      const d = new Date(updates.date);
      d.setHours(0, 0, 0, 0);
      updates.date = d;
    }

    const { slipNo, companyId, createdBy, ...safeUpdates } = updates;

    const slip = await UnionSalesSlip.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      { $set: safeUpdates },
      { new: true, runValidators: true }
    );

    if (!slip) return res.status(404).json({ success: false, message: 'Record not found' });
    res.json({ success: true, data: slip });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'A record already exists for this Date and Time session.',
      });
    }
    res.status(400).json({ success: false, message: error.message });
  }
};

// ── DELETE ─────────────────────────────────────────────────────────────────
export const deleteSlip = async (req, res) => {
  try {
    const slip = await UnionSalesSlip.findOneAndDelete({
      _id: req.params.id,
      companyId: req.companyId,
    });
    if (!slip) return res.status(404).json({ success: false, message: 'Record not found' });
    res.json({ success: true, message: 'Record deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
