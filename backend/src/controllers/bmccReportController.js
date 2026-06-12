import mongoose from 'mongoose';
import BMCCOperatingCost from '../models/BMCCOperatingCost.js';
import MilkCollection from '../models/MilkCollection.js';

const toObjId = (id) => {
  const s = id?.toString();
  return mongoose.Types.ObjectId.isValid(s) ? new mongoose.Types.ObjectId(s) : id;
};

// GET /api/bmcc-operating-cost/monthly-summary?month=&year=
export const getMonthlySummary = async (req, res) => {
  try {
    const { month, year } = req.query;
    const companyId = toObjId(req.companyId);
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);

    const fromDate = new Date(y, m - 1, 1, 0, 0, 0, 0);
    const toDate   = new Date(y, m,     0, 23, 59, 59, 999); // last day of month

    const [result] = await MilkCollection.aggregate([
      { $match: { companyId, date: { $gte: fromDate, $lte: toDate } } },
      {
        $group: {
          _id:               null,
          totalMilkProcured: { $sum: '$qty' },
          avgFAT:            { $avg: '$fat' },
          avgSNF:            { $avg: '$snf' },
          days:              { $addToSet: { $dateToString: { format: '%Y-%m-%d', date: '$date' } } },
          producers:         { $addToSet: '$farmerNumber' }
        }
      },
      {
        $project: {
          _id: 0,
          totalMilkProcured:   { $round: ['$totalMilkProcured', 2] },
          procurementDays:     { $size: '$days' },
          totalProducerCount:  { $size: '$producers' },
          avgFAT:              { $round: ['$avgFAT', 2] },
          avgSNF:              { $round: ['$avgSNF', 2] },
          avgDailyProcurement: {
            $cond: [
              { $gt: [{ $size: '$days' }, 0] },
              { $round: [{ $divide: ['$totalMilkProcured', { $size: '$days' }] }, 2] },
              0
            ]
          }
        }
      }
    ]);

    res.json({
      success: true,
      data: result || {
        totalMilkProcured: 0, avgDailyProcurement: 0,
        procurementDays: 0, totalProducerCount: 0,
        avgFAT: 0, avgSNF: 0
      }
    });
  } catch (err) {
    console.error('bmcc getMonthlySummary error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/bmcc-operating-cost/report?month=&year=
export const getReport = async (req, res) => {
  try {
    const { month, year } = req.query;
    const report = await BMCCOperatingCost.findOne({
      companyId: req.companyId,
      month: parseInt(month, 10),
      year:  parseInt(year,  10),
    });
    res.json({ success: true, data: report || null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/bmcc-operating-cost/save  (upsert by company+month+year)
export const saveReport = async (req, res) => {
  try {
    const { month, year, ...rest } = req.body;
    const companyId = req.companyId;

    const report = await BMCCOperatingCost.findOneAndUpdate(
      { companyId, month: parseInt(month, 10), year: parseInt(year, 10) },
      { companyId, month: parseInt(month, 10), year: parseInt(year, 10), ...rest },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/bmcc-operating-cost/update/:id
export const updateReport = async (req, res) => {
  try {
    const { id } = req.params;
    const report = await BMCCOperatingCost.findOneAndUpdate(
      { _id: id, companyId: req.companyId },
      { $set: req.body },
      { new: true }
    );
    if (!report) return res.status(404).json({ success: false, message: 'Report not found' });
    res.json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/bmcc-operating-cost/delete/:id
export const deleteReport = async (req, res) => {
  try {
    const { id } = req.params;
    await BMCCOperatingCost.findOneAndDelete({ _id: id, companyId: req.companyId });
    res.json({ success: true, message: 'Report deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
