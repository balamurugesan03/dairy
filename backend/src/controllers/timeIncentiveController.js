import TimeIncentive from '../models/TimeIncentive.js';

// ════════════════════════════════════════════════════════════════
//  OVERLAP HELPER
//  Two records conflict when ALL four conditions hold:
//    1. They share at least one shift (AM / PM)
//    2. Their date ranges overlap
//    3. Their time ranges overlap
//    4. Their center scopes overlap
// ════════════════════════════════════════════════════════════════
async function hasOverlap(data, excludeId, companyId) {
  const { shift, centerType, centers, startDate, endDate, timeFrom, timeTo } = data;

  // Base query — date range + time range + shift overlap
  const query = {
    companyId,
    status:    true,
    shift:     { $in: shift },                    // shares ≥1 shift
    startDate: { $lte: new Date(endDate) },        // date ranges overlap
    endDate:   { $gte: new Date(startDate) },
    timeFrom:  { $lt: timeTo },                    // time ranges overlap (HH:mm string compare)
    timeTo:    { $gt: timeFrom },
  };

  if (excludeId) query._id = { $ne: excludeId };

  // Center scope overlap
  if (centerType === 'LIST') {
    query.$or = [
      { centerType: 'ALL' },
      { centerType: 'LIST', centers: { $in: centers } },
    ];
  }
  // centerType === 'ALL' → overlaps with every record, no extra clause needed

  return TimeIncentive.findOne(query).lean();
}

// ════════════════════════════════════════════════════════════════
//  GET ACTIVE — for MilkPurchase: find active incentive for
//  given shift + center + date + current server time
//  GET /time-incentives/active?shift=AM&center=CenterName&date=YYYY-MM-DD
// ════════════════════════════════════════════════════════════════
export const getActiveTimeIncentive = async (req, res) => {
  try {
    const { shift, center, date } = req.query;

    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    const targetDateEnd = new Date(targetDate);
    targetDateEnd.setHours(23, 59, 59, 999);

    // Current time as HH:mm string (server time)
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const filter = {
      companyId: req.companyId,
      status:    true,
      startDate: { $lte: targetDateEnd },
      timeFrom:  { $lte: currentTime },
      timeTo:    { $gt:  currentTime },
      $and: [
        {
          $or: [
            { endDate: { $gte: targetDate } },
            { endDate: null },
            { endDate: { $exists: false } }
          ]
        }
      ]
    };

    // Shift match (shift is stored as array ['AM','PM'])
    if (shift) filter.shift = { $in: [shift] };

    // Center match
    if (center) {
      filter.$and.push({
        $or: [
          { centerType: 'ALL' },
          { centerType: 'LIST', centers: center }
        ]
      });
    } else {
      // No center specified — only ALL-type incentives apply
      filter.$and.push({ centerType: 'ALL' });
    }

    const incentive = await TimeIncentive.findOne(filter).sort({ createdAt: -1 }).lean();

    res.json({ success: true, data: incentive || null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ════════════════════════════════════════════════════════════════
//  GET ALL — paginated + search + filters
// ════════════════════════════════════════════════════════════════
export const getAllTimeIncentives = async (req, res) => {
  try {
    const {
      page         = 1,
      limit        = 15,
      shift        = '',
      centerType   = '',
      status       = '',
    } = req.query;

    const skip   = (parseInt(page) - 1) * parseInt(limit);
    const filter = { companyId: req.companyId };

    if (shift)      filter.shift      = shift;
    if (centerType) filter.centerType = centerType;
    if (status !== '') filter.status  = status === 'true';

    const [incentives, total] = await Promise.all([
      TimeIncentive.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      TimeIncentive.countDocuments(filter),
    ]);

    res.json({
      success:    true,
      data:       incentives,
      total,
      page:       parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ════════════════════════════════════════════════════════════════
//  GET BY ID
// ════════════════════════════════════════════════════════════════
export const getTimeIncentiveById = async (req, res) => {
  try {
    const incentive = await TimeIncentive.findOne({
      _id:       req.params.id,
      companyId: req.companyId,
    }).lean();

    if (!incentive) {
      return res.status(404).json({ success: false, message: 'Time incentive not found' });
    }

    res.json({ success: true, data: incentive });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ════════════════════════════════════════════════════════════════
//  CREATE
// ════════════════════════════════════════════════════════════════
export const createTimeIncentive = async (req, res) => {
  try {
    const overlap = await hasOverlap(req.body, null, req.companyId);
    if (overlap) {
      return res.status(400).json({
        success: false,
        message: 'An overlapping time incentive already exists for the selected shift, center, date and time range.',
      });
    }

    const incentive = await TimeIncentive.create({
      ...req.body,
      companyId: req.companyId,
    });

    res.status(201).json({
      success: true,
      message: 'Time incentive created successfully',
      data:    incentive,
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join('. ') });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// ════════════════════════════════════════════════════════════════
//  UPDATE
// ════════════════════════════════════════════════════════════════
export const updateTimeIncentive = async (req, res) => {
  try {
    const overlap = await hasOverlap(req.body, req.params.id, req.companyId);
    if (overlap) {
      return res.status(400).json({
        success: false,
        message: 'An overlapping time incentive already exists for the selected shift, center, date and time range.',
      });
    }

    const incentive = await TimeIncentive.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!incentive) {
      return res.status(404).json({ success: false, message: 'Time incentive not found' });
    }

    res.json({
      success: true,
      message: 'Time incentive updated successfully',
      data:    incentive,
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join('. ') });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// ════════════════════════════════════════════════════════════════
//  SOFT DELETE — sets status = false
// ════════════════════════════════════════════════════════════════
export const deleteTimeIncentive = async (req, res) => {
  try {
    const incentive = await TimeIncentive.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      { status: false },
      { new: true }
    );

    if (!incentive) {
      return res.status(404).json({ success: false, message: 'Time incentive not found' });
    }

    res.json({
      success: true,
      message: 'Time incentive deactivated successfully',
      data:    incentive,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ════════════════════════════════════════════════════════════════
//  TOGGLE STATUS  (PATCH /:id/status)
// ════════════════════════════════════════════════════════════════
export const toggleTimeIncentiveStatus = async (req, res) => {
  try {
    const incentive = await TimeIncentive.findOne({
      _id:       req.params.id,
      companyId: req.companyId,
    });

    if (!incentive) {
      return res.status(404).json({ success: false, message: 'Time incentive not found' });
    }

    incentive.status = !incentive.status;
    await incentive.save();

    res.json({
      success: true,
      message: `Time incentive ${incentive.status ? 'activated' : 'deactivated'} successfully`,
      data:    incentive,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
