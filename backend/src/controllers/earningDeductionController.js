import EarningDeduction from '../models/EarningDeduction.js';

// ════════════════════════════════════════════════════════════════
//  GET ALL — paginated + search + filter
// ════════════════════════════════════════════════════════════════
export const getAll = async (req, res) => {
  try {
    const {
      page     = 1,
      limit    = 20,
      search   = '',
      category = '',
      active,
    } = req.query;

    const filter = { companyId: req.companyId };

    if (search) {
      filter.$or = [
        { name:      { $regex: search, $options: 'i' } },
        { shortName: { $regex: search, $options: 'i' } },
        { nameMl:    { $regex: search, $options: 'i' } },
      ];
    }
    if (category) filter.category = category;
    if (active !== undefined && active !== '') filter.active = active === 'true';

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [records, total] = await Promise.all([
      EarningDeduction.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      EarningDeduction.countDocuments(filter),
    ]);

    res.json({
      success:    true,
      data:       records,
      total,
      page:       parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ════════════════════════════════════════════════════════════════
//  GET ALL ACTIVE — for dropdown use in payroll screens
// ════════════════════════════════════════════════════════════════
export const getActive = async (req, res) => {
  try {
    const records = await EarningDeduction.find({
      companyId: req.companyId,
      active:    true,
    })
      .sort({ name: 1 })
      .lean();

    res.json({ success: true, data: records });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ════════════════════════════════════════════════════════════════
//  GET BY ID
// ════════════════════════════════════════════════════════════════
export const getById = async (req, res) => {
  try {
    const record = await EarningDeduction.findOne({
      _id:       req.params.id,
      companyId: req.companyId,
    }).lean();

    if (!record) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }

    res.json({ success: true, data: record });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ════════════════════════════════════════════════════════════════
//  CREATE
// ════════════════════════════════════════════════════════════════
export const create = async (req, res) => {
  try {
    const { name, nameMl, shortName, category, ledgerGroup, formula, active } = req.body;

    const record = await EarningDeduction.create({
      name,
      nameMl:      nameMl || '',
      shortName:   shortName?.toUpperCase(),
      category,
      ledgerGroup,
      formula:     formula || '',
      active:      active !== undefined ? active : true,
      companyId:   req.companyId,
      createdBy:   req.user?._id,
    });

    res.status(201).json({ success: true, data: record, message: 'Created successfully' });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        message: `Short name "${req.body.shortName?.toUpperCase()}" already exists for this company`,
      });
    }
    res.status(400).json({ success: false, message: err.message });
  }
};

// ════════════════════════════════════════════════════════════════
//  UPDATE
// ════════════════════════════════════════════════════════════════
export const update = async (req, res) => {
  try {
    const { name, nameMl, shortName, category, ledgerGroup, formula, active } = req.body;

    const record = await EarningDeduction.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      {
        name,
        nameMl:      nameMl || '',
        shortName:   shortName?.toUpperCase(),
        category,
        ledgerGroup,
        formula:     formula || '',
        active,
      },
      { new: true, runValidators: true }
    );

    if (!record) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }

    res.json({ success: true, data: record, message: 'Updated successfully' });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        message: `Short name "${req.body.shortName?.toUpperCase()}" already exists for this company`,
      });
    }
    res.status(400).json({ success: false, message: err.message });
  }
};

// ════════════════════════════════════════════════════════════════
//  TOGGLE STATUS
// ════════════════════════════════════════════════════════════════
export const toggleStatus = async (req, res) => {
  try {
    const record = await EarningDeduction.findOne({
      _id:       req.params.id,
      companyId: req.companyId,
    });

    if (!record) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }

    record.active = !record.active;
    await record.save();

    res.json({ success: true, data: record, message: `Status set to ${record.active ? 'Active' : 'Inactive'}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ════════════════════════════════════════════════════════════════
//  BULK UPDATE PERIODICAL SETTINGS
// ════════════════════════════════════════════════════════════════
export const bulkUpdateSettings = async (req, res) => {
  try {
    const { items } = req.body; // [{ id, applyToAll, defaultAmount, frequency }]

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'No items provided' });
    }

    const ops = items.map(item => ({
      updateOne: {
        filter: { _id: item.id, companyId: req.companyId },
        update: {
          applyToAll:    item.applyToAll,
          defaultAmount: item.defaultAmount,
          frequency:     item.frequency,
        },
      },
    }));

    await EarningDeduction.bulkWrite(ops);

    res.json({ success: true, message: 'Settings saved successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ════════════════════════════════════════════════════════════════
//  DELETE
// ════════════════════════════════════════════════════════════════
export const remove = async (req, res) => {
  try {
    const record = await EarningDeduction.findOneAndDelete({
      _id:       req.params.id,
      companyId: req.companyId,
    });

    if (!record) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }

    res.json({ success: true, message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
