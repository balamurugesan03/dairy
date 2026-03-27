import FinancialYear from '../models/FinancialYear.js';

// ── List all financial years for company ─────────────────────────────────────
export const getFinancialYears = async (req, res) => {
  try {
    const years = await FinancialYear.find({ companyId: req.companyId })
      .sort({ startDate: -1 });
    res.json({ success: true, data: years });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Get the currently Active financial year ──────────────────────────────────
export const getActiveFinancialYear = async (req, res) => {
  try {
    const year = await FinancialYear.findOne({
      companyId: req.companyId,
      status: 'Active'
    });
    res.json({ success: true, data: year || null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Check if a specific date is in a frozen period ───────────────────────────
export const checkFrozenDate = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.json({ success: true, data: { frozen: false } });

    const frozen = await FinancialYear.findOne({
      companyId: req.companyId,
      isFrozen: true,
      startDate: { $lte: new Date(date) },
      endDate:   { $gte: new Date(date) }
    });
    res.json({ success: true, data: { frozen: !!frozen, year: frozen || null } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Create a new financial year ───────────────────────────────────────────────
export const createFinancialYear = async (req, res) => {
  try {
    const { name, startDate, endDate, status, notes } = req.body;

    // Only one Active year allowed
    if (status === 'Active') {
      const existing = await FinancialYear.findOne({ companyId: req.companyId, status: 'Active' });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: `"${existing.name}" is already the active year. Close it first before activating another.`
        });
      }
    }

    const year = await FinancialYear.create({
      companyId: req.companyId,
      name,
      startDate,
      endDate,
      status: status || 'Upcoming',
      notes
    });

    res.status(201).json({ success: true, data: year });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: `Financial year "${req.body.name}" already exists.` });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Update a financial year (name, dates, notes, status) ─────────────────────
export const updateFinancialYear = async (req, res) => {
  try {
    const year = await FinancialYear.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!year) return res.status(404).json({ success: false, message: 'Financial year not found.' });

    if (year.status === 'Closed' && year.isFrozen) {
      return res.status(403).json({ success: false, message: 'Cannot edit a frozen financial year. Unfreeze it first.' });
    }

    const { name, startDate, endDate, notes, status } = req.body;

    // Guard: if trying to activate another while one is active
    if (status === 'Active' && year.status !== 'Active') {
      const existing = await FinancialYear.findOne({ companyId: req.companyId, status: 'Active' });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: `"${existing.name}" is already the active year. Close it first.`
        });
      }
    }

    if (name)      year.name = name;
    if (startDate) year.startDate = startDate;
    if (endDate)   year.endDate = endDate;
    if (notes !== undefined) year.notes = notes;
    if (status)    year.status = status;

    await year.save();
    res.json({ success: true, data: year });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: `Financial year "${req.body.name}" already exists.` });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Close a financial year (freeze all transactions) ─────────────────────────
export const closeFinancialYear = async (req, res) => {
  try {
    const year = await FinancialYear.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!year) return res.status(404).json({ success: false, message: 'Financial year not found.' });

    if (year.status === 'Closed') {
      return res.status(400).json({ success: false, message: 'This financial year is already closed.' });
    }
    if (year.status === 'Upcoming') {
      return res.status(400).json({ success: false, message: 'Cannot close an Upcoming financial year. Activate it first.' });
    }

    year.status   = 'Closed';
    year.isFrozen = true;
    year.closedAt = new Date();
    year.closedBy = req.user?.displayName || req.company?.companyName || 'System';
    await year.save();

    res.json({ success: true, data: year, message: `Financial year "${year.name}" has been closed and frozen.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Toggle freeze state (Freeze / Unfreeze) ───────────────────────────────────
export const toggleFreeze = async (req, res) => {
  try {
    const year = await FinancialYear.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!year) return res.status(404).json({ success: false, message: 'Financial year not found.' });

    if (year.status === 'Active') {
      return res.status(400).json({ success: false, message: 'Cannot freeze an Active financial year. Close it first.' });
    }

    year.isFrozen = !year.isFrozen;
    await year.save();

    const action = year.isFrozen ? 'frozen' : 'unfrozen';
    res.json({ success: true, data: year, message: `Financial year "${year.name}" has been ${action}.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Activate an upcoming year ────────────────────────────────────────────────
export const activateFinancialYear = async (req, res) => {
  try {
    const year = await FinancialYear.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!year) return res.status(404).json({ success: false, message: 'Financial year not found.' });

    if (year.status === 'Active') {
      return res.status(400).json({ success: false, message: 'This year is already active.' });
    }
    if (year.status === 'Closed') {
      return res.status(400).json({ success: false, message: 'Cannot activate a closed financial year.' });
    }

    const existing = await FinancialYear.findOne({ companyId: req.companyId, status: 'Active' });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `"${existing.name}" is currently active. Close it before activating another.`
      });
    }

    year.status   = 'Active';
    year.isFrozen = false;
    await year.save();

    res.json({ success: true, data: year, message: `Financial year "${year.name}" is now Active.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Delete a financial year (only Upcoming) ───────────────────────────────────
export const deleteFinancialYear = async (req, res) => {
  try {
    const year = await FinancialYear.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!year) return res.status(404).json({ success: false, message: 'Financial year not found.' });

    if (year.status !== 'Upcoming') {
      return res.status(400).json({ success: false, message: 'Only Upcoming financial years can be deleted.' });
    }

    await year.deleteOne();
    res.json({ success: true, message: `Financial year "${year.name}" deleted.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
