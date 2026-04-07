import CropStatement from '../models/CropStatement.js';
import Farmer from '../models/Farmer.js';

// ── GET ALL ──────────────────────────────────────────────────────────────────
export const getAllStatements = async (req, res) => {
  try {
    const { search = '', status = '', page = 1, limit = 20 } = req.query;
    const query = { companyId: req.companyId };

    if (status) query.status = status;
    if (search) {
      query.$or = [
        { farmerName:   { $regex: search, $options: 'i' } },
        { statementNo:  { $regex: search, $options: 'i' } },
        { bankName:     { $regex: search, $options: 'i' } }
      ];
    }

    const total = await CropStatement.countDocuments(query);
    const statements = await CropStatement.find(query)
      .populate('farmerId', 'personalDetails farmerNumber')
      .sort({ createdAt: -1 })
      .skip((+page - 1) * +limit)
      .limit(+limit);

    res.json({ success: true, data: { statements, total, page: +page, limit: +limit } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET ONE ──────────────────────────────────────────────────────────────────
export const getStatementById = async (req, res) => {
  try {
    const stmt = await CropStatement.findOne({ _id: req.params.id, companyId: req.companyId })
      .populate('farmerId', 'personalDetails farmerNumber bankDetails');
    if (!stmt) return res.status(404).json({ success: false, message: 'Statement not found' });
    res.json({ success: true, data: stmt });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── CREATE ───────────────────────────────────────────────────────────────────
export const createStatement = async (req, res) => {
  try {
    const count = await CropStatement.countDocuments({ companyId: req.companyId });
    const statementNo = `STMT-${String(count + 1).padStart(4, '0')}`;

    const stmt = await CropStatement.create({
      ...req.body,
      statementNo,
      companyId: req.companyId
    });
    res.status(201).json({ success: true, data: stmt });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// ── UPDATE ───────────────────────────────────────────────────────────────────
export const updateStatement = async (req, res) => {
  try {
    const stmt = await CropStatement.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!stmt) return res.status(404).json({ success: false, message: 'Statement not found' });
    res.json({ success: true, data: stmt });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// ── DELETE ───────────────────────────────────────────────────────────────────
export const deleteStatement = async (req, res) => {
  try {
    const stmt = await CropStatement.findOneAndDelete({ _id: req.params.id, companyId: req.companyId });
    if (!stmt) return res.status(404).json({ success: false, message: 'Statement not found' });
    res.json({ success: true, message: 'Statement deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
