import AgriStatsReport from '../models/AgriStatsReport.js';

// ── GET ALL ──────────────────────────────────────────────────────────────────
export const getAllReports = async (req, res) => {
  try {
    const { search = '', status = '', month = '', year = '', page = 1, limit = 20 } = req.query;
    const query = { companyId: req.companyId };

    if (status) query.status = status;
    if (month)  query.month  = month;
    if (year)   query.year   = +year;
    if (search) {
      query.$or = [
        { reportNo: { $regex: search, $options: 'i' } },
        { district: { $regex: search, $options: 'i' } }
      ];
    }

    const total = await AgriStatsReport.countDocuments(query);
    const reports = await AgriStatsReport.find(query)
      .select('reportNo district month year status reportDate createdAt')
      .sort({ createdAt: -1 })
      .skip((+page - 1) * +limit)
      .limit(+limit);

    res.json({ success: true, data: { reports, total, page: +page, limit: +limit } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET ONE ──────────────────────────────────────────────────────────────────
export const getReportById = async (req, res) => {
  try {
    const report = await AgriStatsReport.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!report) return res.status(404).json({ success: false, message: 'Report not found' });
    res.json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── CREATE ───────────────────────────────────────────────────────────────────
export const createReport = async (req, res) => {
  try {
    const count = await AgriStatsReport.countDocuments({ companyId: req.companyId });
    const reportNo = `AGR-${String(count + 1).padStart(4, '0')}`;
    const report = await AgriStatsReport.create({ ...req.body, reportNo, companyId: req.companyId });
    res.status(201).json({ success: true, data: report });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// ── UPDATE ───────────────────────────────────────────────────────────────────
export const updateReport = async (req, res) => {
  try {
    const report = await AgriStatsReport.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!report) return res.status(404).json({ success: false, message: 'Report not found' });
    res.json({ success: true, data: report });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// ── DELETE ───────────────────────────────────────────────────────────────────
export const deleteReport = async (req, res) => {
  try {
    const report = await AgriStatsReport.findOneAndDelete({ _id: req.params.id, companyId: req.companyId });
    if (!report) return res.status(404).json({ success: false, message: 'Report not found' });
    res.json({ success: true, message: 'Report deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
