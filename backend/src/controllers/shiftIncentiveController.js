import ShiftIncentive from '../models/ShiftIncentive.js';

// ════════════════════════════════════════════════════════════════
//  GET ALL — paginated + search + filter
// ════════════════════════════════════════════════════════════════
export const getShiftIncentives = async (req, res) => {
  try {
    const {
      page   = 1,
      limit  = 15,
      search = '',
      shift,
      status
    } = req.query;

    const skip   = (parseInt(page) - 1) * parseInt(limit);
    const filter = { companyId: req.companyId };

    if (search) filter.center = { $regex: search, $options: 'i' };
    if (shift)  filter.shift  = shift;
    if (status !== undefined && status !== '') filter.status = status === 'true';

    const [incentives, total] = await Promise.all([
      ShiftIncentive.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      ShiftIncentive.countDocuments(filter)
    ]);

    res.json({
      success:    true,
      data:       incentives,
      total,
      page:       parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ════════════════════════════════════════════════════════════════
//  GET BY ID
// ════════════════════════════════════════════════════════════════
export const getShiftIncentiveById = async (req, res) => {
  try {
    const incentive = await ShiftIncentive.findOne({
      _id:       req.params.id,
      companyId: req.companyId
    }).lean();

    if (!incentive) {
      return res.status(404).json({ success: false, message: 'Shift incentive not found' });
    }

    res.json({ success: true, data: incentive });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ════════════════════════════════════════════════════════════════
//  GET ACTIVE — for milk purchase billing
//  GET /shift-incentives/active?shift=MOR&center=&date=
// ════════════════════════════════════════════════════════════════
export const getActiveIncentives = async (req, res) => {
  try {
    const { shift, center, date } = req.query;
    const targetDate = date ? new Date(date) : new Date();

    const filter = {
      companyId: req.companyId,
      status:    true,
      startDate: { $lte: targetDate },
      $or: [
        { endDate: { $gte: targetDate } },
        { endDate: null },
        { endDate: { $exists: false } }
      ]
    };

    if (shift)  filter.shift  = shift;
    if (center) filter.center = { $regex: center, $options: 'i' };

    const incentives = await ShiftIncentive.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, data: incentives });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ════════════════════════════════════════════════════════════════
//  CREATE
// ════════════════════════════════════════════════════════════════
export const createShiftIncentive = async (req, res) => {
  try {
    const incentive = await ShiftIncentive.create({
      ...req.body,
      companyId: req.companyId
    });

    res.status(201).json({
      success: true,
      message: 'Shift incentive created successfully',
      data:    incentive
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
export const updateShiftIncentive = async (req, res) => {
  try {
    const incentive = await ShiftIncentive.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!incentive) {
      return res.status(404).json({ success: false, message: 'Shift incentive not found' });
    }

    res.json({
      success: true,
      message: 'Shift incentive updated successfully',
      data:    incentive
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
export const deleteShiftIncentive = async (req, res) => {
  try {
    const incentive = await ShiftIncentive.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      { status: false },
      { new: true }
    );

    if (!incentive) {
      return res.status(404).json({ success: false, message: 'Shift incentive not found' });
    }

    res.json({
      success: true,
      message: 'Shift incentive deactivated successfully',
      data:    incentive
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ════════════════════════════════════════════════════════════════
//  TOGGLE STATUS
// ════════════════════════════════════════════════════════════════
export const toggleStatus = async (req, res) => {
  try {
    const incentive = await ShiftIncentive.findOne({
      _id:       req.params.id,
      companyId: req.companyId
    });

    if (!incentive) {
      return res.status(404).json({ success: false, message: 'Shift incentive not found' });
    }

    incentive.status = !incentive.status;
    await incentive.save();

    res.json({
      success: true,
      message: `Shift incentive ${incentive.status ? 'activated' : 'deactivated'} successfully`,
      data:    incentive
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
